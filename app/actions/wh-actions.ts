'use server'

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ── 1. ดึงข้อมูลใบงานที่ WH ต้องรับผิดชอบ ──────────────────────
// สถานะใบงานที่ WH เห็น: at_warehouse, checked_in
// item ที่แสดง: at_warehouse, checked_in เท่านั้น (ไม่เอา receiving/rejected)
export async function getWHData() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('requests')
    .select(`*, drug_items (*)`)
    .in('current_status', ['at_warehouse', 'checked_in'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching WH data:", error);
    return { success: false, data: [], error: error.message };
  }

  if (data) {
    const filtered = data
      .map(req => ({
        ...req,
        // ✅ แสดง item ที่ยังต้องจัดการ: at_warehouse (รอรับเข้า), checked_in (รอจัดเก็บ)
        // ไม่แสดง receiving (จัดเก็บแล้ว) และ rejected (ถูกปฏิเสธ)
        drug_items: req.drug_items.filter(
          (item: any) => !['receiving', 'rejected'].includes(item.current_status)
        )
      }))
      .filter(req => req.drug_items.length > 0);

    return { success: true, data: filtered };
  }

  return { success: true, data: [] };
}

// ── 2. Step 1a: ตรวจสภาพสินค้า รายชิ้น (checked_in) ────────────
// กด "✓ รับเข้า" ทีละ item → เปลี่ยนเป็น checked_in
export async function stampCheckedIn(
  itemId: number,
  staffId: string,
  remark: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: item, error: fetchErr } = await supabase
    .from('drug_items')
    .select('request_id')
    .eq('id', itemId)
    .single();

  if (fetchErr || !item) return { success: false, error: "หาข้อมูลยาไม่พบ" };

  // 1. อัปเดตสถานะยาเป็น checked_in
  const { error: updateErr } = await supabase
    .from('drug_items')
    .update({ current_status: 'checked_in' })
    .eq('id', itemId);

  if (updateErr) return { success: false, error: updateErr.message };

  // 2. เช็คว่า item ทั้งหมดในใบงานตรวจรับแล้วหรือยัง
  // ใช้ .every() เลียบแบบ logistics (ไม่ใช้ .neq() กันบั๊ก)
  const { data: allItems } = await supabase
    .from('drug_items')
    .select('id, current_status')
    .eq('request_id', item.request_id);

  const isAllChecked = allItems?.every(i =>
    ['checked_in', 'receiving', 'rejected'].includes(i.current_status)
  );

  // ถ้าครบ → อัปเดตใบงานหลักเป็น checked_in ด้วย
  if (isAllChecked) {
    await supabase
      .from('requests')
      .update({ current_status: 'checked_in', updated_at: new Date().toISOString() })
      .eq('id', item.request_id);
  }

  // 3. บันทึก Log (ใส่ drug_item_id เลียบแบบ logistics)
  await supabase.from('status_logs').insert({
    request_id: item.request_id,
    staff_id: staffId,
    department: 'warehouse',
    status_name: 'checked_in',
    staff_remark: remark || 'ตรวจสภาพสินค้าเรียบร้อย',
    drug_item_id: itemId
  });

  revalidatePath('/admin/wh/dashboard');
  return { success: true };
}

// ── 3. Step 1b: ยืนยันตรวจรับทั้งใบ (confirmCheckedInBatch) ────
// กดหลังจาก stampCheckedIn ครบทุก item แล้ว
// บันทึก log ยืนยันระดับใบงาน + อัปเดตใบงานหลักเป็น checked_in ให้ชัวร์
// (เลียบแบบ confirmLogisticsBatch ของ logistics)
export async function confirmCheckedInBatch(
  requestId: number,
  staffId: string,
  remark: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // 1. ดึง item ทั้งหมดของใบงาน
  const { data: allItems, error: fetchErr } = await supabase
    .from('drug_items')
    .select('id, current_status')
    .eq('request_id', requestId);

  if (fetchErr) return { success: false, error: fetchErr.message };

  // 2. ตรวจสอบว่า item ทุกชิ้น checked_in ครบจริงก่อนบันทึก
  // (ป้องกัน race condition กรณีที่ยังมีบางชิ้นค้างอยู่)
  const isAllChecked = allItems?.every(i =>
    ['checked_in', 'receiving', 'rejected'].includes(i.current_status)
  );

  if (!isAllChecked) {
    return { success: false, error: 'ยังมีรายการยาที่ยังไม่ได้ตรวจรับ กรุณาตรวจรับให้ครบก่อน' };
  }

  // 3. บันทึก Log ยืนยันทั้งใบ — 1 แถวต่อ 1 item (เลียบแบบ confirmLogisticsBatch)
  const logs = allItems
    ?.filter(i => i.current_status === 'checked_in') // บันทึกเฉพาะที่เพิ่ง checked_in
    .map(i => ({
      request_id: requestId,
      staff_id: staffId,
      department: 'warehouse',
      status_name: 'checked_in_confirmed',  // status พิเศษสำหรับ log ยืนยันทั้งใบ
      staff_remark: remark || 'ยืนยันตรวจรับทั้งใบงาน',
      drug_item_id: i.id
    })) ?? [];

  if (logs.length > 0) {
    await supabase.from('status_logs').insert(logs);
  }

  // 4. อัปเดตใบงานหลักเป็น checked_in ให้ชัวร์
  await supabase
    .from('requests')
    .update({ current_status: 'checked_in', updated_at: new Date().toISOString() })
    .eq('id', requestId);

  revalidatePath('/admin/wh/dashboard');
  return { success: true };
}

// ── 4. Step 2: จัดเก็บเข้าคลัง รายชิ้น (receiving) ────────────
// กด "📦 จัดเก็บ" ทีละ item → เปลี่ยนเป็น receiving
// เมื่อครบทุกชิ้น → ปิดใบงานหลักอัตโนมัติ (เลียบแบบ logistics)
export async function stampReceiving(
  itemId: number,
  staffId: string,
  remark: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: item, error: fetchErr } = await supabase
    .from('drug_items')
    .select('request_id')
    .eq('id', itemId)
    .single();

  if (fetchErr || !item) return { success: false, error: "หาข้อมูลยาไม่พบ" };

  // 1. อัปเดตสถานะยาเป็น receiving
  const { error: updateErr } = await supabase
    .from('drug_items')
    .update({ current_status: 'receiving' })
    .eq('id', itemId);

  if (updateErr) return { success: false, error: updateErr.message };

  // 2. ดึงสถานะทุก item — ใช้ .every() เลียบแบบ logistics
  const { data: allItems } = await supabase
    .from('drug_items')
    .select('id, current_status')
    .eq('request_id', item.request_id);

  const hasReceived    = allItems?.some(i => i.current_status === 'receiving');
  const isAllProcessed = allItems?.every(i =>
    ['receiving', 'rejected'].includes(i.current_status)
  );

  // 3. ถ้าครบทุกชิ้น → ปิดใบงานหลัก
  if (isAllProcessed) {
    const finalRequestStatus = hasReceived ? 'receiving' : 'rejected';
    await supabase
      .from('requests')
      .update({ current_status: finalRequestStatus, updated_at: new Date().toISOString() })
      .eq('id', item.request_id);
  }

  // 4. บันทึก Log (ใส่ drug_item_id เลียบแบบ logistics)
  await supabase.from('status_logs').insert({
    request_id: item.request_id,
    staff_id: staffId,
    department: 'warehouse',
    status_name: 'receiving',
    staff_remark: remark || 'จัดเก็บเข้าคลังเรียบร้อย',
    drug_item_id: itemId
  });

  revalidatePath('/admin/wh/dashboard');
  return { success: true };
}

export async function rejectWHItem(
  itemId: number,
  staffId: string,
  remark: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // 1. ดึง request_id มาก่อน
  const { data: item, error: fetchErr } = await supabase
    .from('drug_items')
    .select('request_id')
    .eq('id', itemId)
    .single();

  if (fetchErr || !item) return { success: false, error: "หาข้อมูลยาไม่พบ" };

  // 2. อัปเดตสถานะเป็น rejected
  const { error: updateErr } = await supabase
    .from('drug_items')
    .update({ current_status: 'rejected' })
    .eq('id', itemId);

  if (updateErr) return { success: false, error: updateErr.message };

  // 3. เช็คว่าหลังจาก reject แล้ว ใบงานนี้ปิดได้หรือยัง (ทุกชิ้นกลายเป็น receiving หรือ rejected แล้วหรือยัง)
  const { data: allItems } = await supabase
    .from('drug_items')
    .select('id, current_status')
    .eq('request_id', item.request_id);

  const isAllProcessed = allItems?.every(i =>
    ['receiving', 'rejected'].includes(i.current_status)
  );

  // ถ้าทุกชิ้นถูกจัดการหมดแล้ว (receiving หรือ rejected) → ปิดใบงานหลัก
  if (isAllProcessed) {
    // ถ้ามีบางชิ้น receiving = สำเร็จ ถ้าไม่มีเลย = ปฏิเสธทั้งใบ
    const hasReceived = allItems?.some(i => i.current_status === 'receiving');
    const finalRequestStatus = hasReceived ? 'receiving' : 'rejected';
    
    await supabase
      .from('requests')
      .update({ current_status: finalRequestStatus, updated_at: new Date().toISOString() })
      .eq('id', item.request_id);
  }

  // 4. บันทึก Log
  await supabase.from('status_logs').insert({
    request_id: item.request_id,
    drug_item_id: itemId,
    staff_id: staffId,
    department: 'warehouse',
    status_name: 'rejected',
    staff_remark: `ปฏิเสธรายการ: ${remark}`
  });

  revalidatePath('/admin/wh/dashboard');
  return { success: true };
}
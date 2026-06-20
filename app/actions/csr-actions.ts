'use server'

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

// ดึง Session เพื่อเช็คว่าเป็น CSR หรือ Manager
async function getCSRSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('staff_session');
  if (!sessionCookie) throw new Error("ไม่ได้ Login");
  
  const session = JSON.parse(sessionCookie.value);
  
  if (session.department !== 'csr' && session.department !== 'manager') {
    throw new Error("คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
  }
  return session;
}

export async function getCSRDashboardData() {
  try {
    await getCSRSession();
    const supabase = await createClient();
    
    // ดึงลูกค้าที่รออนุมัติ
    const { data: clients, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
      
    // ดึงใบงาน
    const { data: requests, error: reqErr } = await supabase
      .from('requests')
      .select(`
        *,
        drug_items (*)
      `)
      .order('created_at', { ascending: false });
      
    if (clientErr || reqErr) {
      throw new Error("ดึงข้อมูลพลาด: " + (clientErr?.message || reqErr?.message));
    }
    
    return { success: true, clients, requests };

  } catch (e: any) {
    console.error("DEBUG - Catch Error:", e.message);
    return { success: false, error: e.message };
  }
}

// ฟังก์ชันรวม: อนุมัติ หรือ ปฏิเสธ ลูกค้า
export async function reviewClient(clientId: string, action: 'approved' | 'rejected') {
  try {
    await getCSRSession();
    const supabase = await createClient();
    
    // 1. ดึงข้อมูลลูกค้า
    const { data: client, error: fetchErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (fetchErr || !client) throw new Error("หาข้อมูลลูกค้าไม่พบ");

    // 2. อัปเดตสถานะในตาราง clients
    const { error: updateErr } = await supabase
      .from('clients')
      .update({ status: action })
      .eq('id', clientId);
    
    if (updateErr) throw updateErr;

    // 3. ถ้าอนุมัติ ให้ insert ข้อมูลไปที่ b2b_customers
    if (action === 'approved') {
      const { error: insertErr } = await supabase
        .from('b2b_customers')
        .insert({
          email: client.email,
          hospital_name: client.hospital_name,
          phone: client.phone,
          contact_name: client.contact_name,
        });

      if (insertErr) throw insertErr;
    }

    revalidatePath('/admin/csr/dashboard');
    return { success: true };

  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// อัปเดตสถานะใบงาน
export async function approveRequest(requestId: number, staffId: string, remark?: string) {
  const supabase = await createClient();

  // 1. บันทึกประวัติลง status_logs
  const { error: logError } = await supabase
    .from('status_logs')
    .insert({
      request_id: requestId,
      staff_id: staffId,
      department: 'csr', // ตรงกับค่าในตาราง staff_users
      status_name: 'approved',
      staff_remark: remark || 'อนุมัติใบงานเรียบร้อยโดย CSR'
    });

  if (logError) {
    console.error("Log Insert Error:", logError);
    throw new Error("บันทึกประวัติการทำงานไม่สำเร็จ");
  }

  // 2. อัปเดตสถานะในตาราง requests
  const { error: updateError } = await supabase
    .from('requests')
    .update({ 
      current_status: 'approved',
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (updateError) {
    console.error("Request Update Error:", updateError);
    throw new Error("อัปเดตสถานะใบงานไม่สำเร็จ");
  }

  return { success: true };
}

export async function rejectRequest(requestId: number, staffId: string, remark: string) {
  const supabase = await createClient();

  // 1. บันทึก log สถานะ rejected
  const { error: logError } = await supabase
    .from('status_logs')
    .insert({
      request_id: requestId,
      staff_id: staffId,
      department: 'csr',
      status_name: 'rejected',
      staff_remark: remark // บังคับให้ใส่หมายเหตุเวลาปฏิเสธจะดีมากครับ
    });

  if (logError) throw new Error("บันทึกประวัติการปฏิเสธไม่สำเร็จ");

  // 2. อัปเดตสถานะเป็น rejected
  await supabase
    .from('requests')
    .update({ current_status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', requestId);

  return { success: true };
}

// 6. Stamp กำลังแลกเปลี่ยน (Exchange)
export async function startExchangeProcess(requestId: number, staffId: string, remark?: string) {
  const supabase = await createClient();

  // บันทึก Log
  await supabase.from('status_logs').insert({
    request_id: requestId,
    staff_id: staffId,
    department: 'csr',
    status_name: 'exchanging',
    staff_remark: remark || 'เริ่มกระบวนการแลกเปลี่ยนสินค้า'
  });

  // อัปเดตสถานะ
  await supabase
    .from('requests')
    .update({ current_status: 'exchanging', updated_at: new Date().toISOString() })
    .eq('id', requestId);

  revalidatePath('/admin/csr/dashboard');
  return { success: true };
}

// 7. Stamp งานเสร็จสิ้น (Completed)
export async function completeRequest(requestId: number, staffId: string, remark?: string) {
  const supabase = await createClient();

  // บันทึก Log
  await supabase.from('status_logs').insert({
    request_id: requestId,
    staff_id: staffId,
    department: 'csr',
    status_name: 'completed',
    staff_remark: remark || 'งานเสร็จสิ้นเรียบร้อย'
  });

  // อัปเดตสถานะ
  await supabase
    .from('requests')
    .update({ current_status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', requestId);

  revalidatePath('/admin/csr/dashboard');
  return { success: true };
}
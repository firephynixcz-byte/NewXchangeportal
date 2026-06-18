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
export async function updateRequestStatus(requestId: number, status: string, remark: string) {
  try {
    const session = await getCSRSession();
    const supabase = await createClient();

    const { error: reqError } = await supabase
      .from('requests')
      .update({ 
        current_status: status, 
        updated_at: new Date().toISOString(),
        updated_by: session.id 
      })
      .eq('id', requestId);

    if (reqError) throw reqError;

    await supabase
      .from('status_logs')
      .insert({
        request_id: requestId,
        department: 'csr',
        status_name: status,
        staff_remark: remark
      });

    revalidatePath('/admin/csr/dashboard');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
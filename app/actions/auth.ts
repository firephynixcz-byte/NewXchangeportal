'use server'

import { createClient } from '@/lib/supabase/server';

export async function registerCustomer(payload: any) {
  const supabase = await createClient()

  try {
    // 1. นำข้อมูลลงตาราง clients
    // กิตเช็ค field ให้ตรงกับที่กิตสร้างไว้ใน Supabase นะครับ
    const { data, error } = await supabase
      .from('clients')
      .insert([
        {
          hospital_name: payload.hospital_name,
          province: payload.province,
          contact_name: payload.contact_name,
          position: payload.position,
          phone: payload.phone,
          email: payload.email,
          signature: payload.signature, // เก็บ Base64 ของลายเซ็นต์
          pdpa_consented_at: new Date().toISOString(),
          status: 'pending' // สถานะเริ่มต้น
        }
      ])
      .select()

    if (error) throw error

    // 2. สำเร็จ! ส่งค่ากลับไปบอกหน้าบ้าน
    return { success: true, data }
    
  } catch (error: any) {
    console.error("Registration Error:", error)
    // จัดการกรณี email ซ้ำหรือ error อื่นๆ
    return { 
        success: false, 
        error: error.code === '23505' ? "อีเมลนี้ได้ทำการลงทะเบียนไปแล้ว" : "เกิดข้อผิดพลาดในการบันทึกข้อมูล" 
    }
  }
}
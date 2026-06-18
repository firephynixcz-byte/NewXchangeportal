'use server'

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import OTPEmail from '@/lib/emails/OTPEmail'; 
import * as React from 'react';

// ตั้งค่า Resend (ตรวจสอบให้แน่ใจว่า .env.local มี RESEND_API_KEY แล้ว)
const resend = new Resend(process.env.RESEND_API_KEY);
console.log("DEBUG: API Key ที่อ่านได้คือ:", process.env.RESEND_API_KEY);

// 1. ฟังก์ชันส่ง OTP
export async function sendOTP(email: string) {
  try {
    const supabase = await createClient();
    
    // 1. เช็คอีเมลในฐานข้อมูล
    const { data: customer, error: customerErr } = await supabase
      .from('b2b_customers')
      .select('*')
      .eq('email', email)
      .single();

    if (customerErr || !customer) {
      throw new Error("ไม่พบอีเมลนี้ในระบบลูกค้า");
    }

    // 2. สร้าง OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 3. บันทึกลง otp_logs
    const { error: logErr } = await supabase
      .from('otp_logs')
      .insert({
        email: email,
        otp_code: otp,
        expires_at: new Date(Date.now() + 5 * 60000).toISOString(),
        used: false
      });

    if (logErr) throw logErr;

    // 4. เตรียมเนื้อหาอีเมลจาก OTPEmail Component
    const emailHtml = await render(React.createElement(OTPEmail, { otp: otp }));

    // 5. ส่งอีเมลผ่าน Resend
    const { error: emailErr } = await resend.emails.send({
      from: 'GPO Xchange <onboarding@resend.dev>',
      to: email,
      subject: 'รหัส OTP ยืนยันการเข้าใช้งานระบบ Xchange',
      html: emailHtml, // ใช้ค่าที่ Render มาแล้ว
    });

    if (emailErr) throw emailErr;

    return { success: true };
  } catch (e: any) {
    console.error("DEBUG: SendOTP Error:", e.message);
    return { success: false, error: e.message };
  }
}

// 2. ฟังก์ชันยืนยัน OTP
export async function verifyOTP(email: string, otp: string) {
  try {
    const supabase = await createClient();

    const { data: log, error: logErr } = await supabase
      .from('otp_logs')
      .select('*')
      .eq('email', email)
      .eq('otp_code', otp)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (logErr || !log) throw new Error("รหัส OTP ไม่ถูกต้องหรือหมดอายุ");

    await supabase.from('otp_logs').update({ used: true }).eq('id', log.id);

    const { data: customer } = await supabase
      .from('b2b_customers')
      .select('*')
      .eq('email', email)
      .single();

    const cookieStore = await cookies();
    cookieStore.set('customer_session', JSON.stringify(customer), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// 3. ฟังก์ชันดึง Session
export async function getCustomerSession() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('customer_session');
    if (!sessionCookie) return null;
    
    const session = JSON.parse(sessionCookie.value);
    
    // ดึงข้อมูลใหม่ล่าสุดจาก Database เพื่อให้แน่ใจว่าได้ contact_name มาด้วย
    const supabase = await createClient();
    const { data: customer } = await supabase
      .from('b2b_customers')
      .select('id, email, hospital_name, contact_name')
      .eq('email', session.email) // หรือใช้ .eq('id', session.id)
      .single();

    return customer; // คืนค่า object ที่มี contact_name ครบถ้วน
  } catch {
    return null;
  }
}

// 4. Logout
export async function logoutCustomer() {
  const cookieStore = await cookies();
  cookieStore.delete('customer_session');
}
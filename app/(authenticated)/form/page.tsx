// app/(authenticated)/form/page.tsx
'use client'; // ยังจำเป็นถ้า FormWizardPage ของกิตเป็น Client Component

import FormWizardPage from './FormWizardPage';

export default function Page() {
  // หน้า Page ตอนนี้ไม่ต้องสนเรื่อง Auth แล้ว เพราะ Layout จัดการให้กิตแล้วครับ
  // กิตก็แค่ Render ตัว Form เข้าไปตรงๆ เลย
  return <FormWizardPage />;
}
// app/form/page.tsx
import { getCustomerSession } from '@/app/actions/auth-actions';
import { redirect } from 'next/navigation';
import FormWizardPage from './FormWizardPage';

export default async function Page() {
  const session = await getCustomerSession();
  
  // ถ้าไม่มี Session จริงๆ ถึงจะส่งไป Login (ป้องกันคนไม่ Login แอบเข้ามา)
  if (!session) {
    redirect('/login'); // หรือ path หน้า Login จริงๆ ของกิต
  }

  // ถ้ามี Session แล้ว -> ส่งเข้า FormWizardPage ทันที
  // ตัดเงื่อนไขอื่นที่อาจจะทำให้มันเด้งออกไปครับ
  return <FormWizardPage />;
}
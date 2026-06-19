import Sidebar from '@/components/Sidebar';
import { getCustomerSession } from '@/app/actions/auth-actions';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customer = await getCustomerSession();

  return (
    // เปลี่ยน flex เป็น h-screen และ overflow-hidden เพื่อล็อกไม่ให้หน้าจอรวมเลื่อน
    <div className="flex h-screen overflow-hidden">
      
      {/* 1. Sidebar: ฟิกซ์ไว้ที่ความกว้าง 64 (256px) */}
      <div className="w-64 flex-shrink-0">
        <Sidebar customer={customer} />
      </div>
      
      {/* 2. Main Content: ให้เลื่อนเฉพาะส่วนนี้ */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        {children}
      </main>
      
    </div>
  );
}
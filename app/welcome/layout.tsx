// app/welcome/layout.tsx
import { Suspense } from 'react';
import { getCustomerSession } from '@/app/actions/auth-actions';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

// ฟังก์ชันดึง Session แยกออกมาเพื่อให้ง่ายต่อการจัดการ
async function SidebarWrapper() {
  const session = await getCustomerSession();
  if (!session) redirect('/');
  return <Sidebar customer={session} />;
}

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#f5fbf9]">
      {/* ห่อ SidebarWrapper ด้วย Suspense 
        วิธีนี้จะทำให้ Next.js ไม่มองว่าเป็น blocking route ครับ
      */}
      <aside className="w-64 h-screen sticky top-0 bg-white/80 backdrop-blur-xl border-r border-teal-50 shadow-sm z-50">
        <Suspense fallback={<div className="p-6 text-sm text-teal-600">Loading...</div>}>
          <SidebarWrapper />
        </Suspense>
      </aside>

      <main className="flex-1 h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
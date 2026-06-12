import './globals.css';
import type { Metadata } from 'next';
import { Sarabun } from 'next/font/google';

// ตั้งค่าฟอนต์ Sarabun
const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '700', '800'],
  variable: '--font-sarabun', // ใช้ variable เพื่อให้ Tailwind เรียกใช้ได้
});

export const metadata: Metadata = {
  title: 'GPO Xchange Portal',
  description: 'ระบบรับคืนและแลกเปลี่ยนสินค้าองค์การเภสัชกรรม',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // เพิ่ม sarabun.variable เข้าไปที่นี่ เพื่อให้ Tailwind เข้าถึง font-sarabun ได้
    <html lang="th" className={`${sarabun.variable}`}>
      <body className="font-sans antialiased text-gray-900 bg-slate-50">
        
        {/* ── Sticky Glass Header ── */}
        <header className="fixed top-0 left-0 w-full bg-white/90 backdrop-blur-lg border-b border-teal-100 z-50">
          <div className="max-w-[1200px] mx-auto h-[56px] px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="bg-gradient-to-br from-teal-800 to-teal-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-md">
                GPO
              </span>
              <span className="text-teal-950 font-black text-sm tracking-tight hidden sm:block">
                องค์การเภสัชกรรม สาขาภาคใต้
              </span>
            </div>
          </div>
        </header>

        {/* ── Main Content Area ── */}
        {/* ใช้ pt-[56px] เพื่อให้เนื้อหาไม่โดน Header บัง */}
        <main className="pt-[56px] min-h-screen">
          {children}
        </main>
        
      </body>
    </html>
  );
}
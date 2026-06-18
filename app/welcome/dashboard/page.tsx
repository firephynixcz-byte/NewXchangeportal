'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// สมมติว่ากิตมี action สำหรับเช็ค session หรือดึงข้อมูลลูกค้า
import { getCustomerSession } from '@/app/actions/auth-actions'; 

export default function CustomerDashboard() {
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const session = await getCustomerSession();
      
      // ถ้าไม่มี session ให้เด้งกลับไปหน้า login ทันที
      if (!session) {
        router.push('/welcome');
        return;
      }
      
      setCustomer(session);
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading) return <div className="p-10 text-center">กำลังตรวจสอบสิทธิ์...</div>;
  if (!customer) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 mb-8">
          <p className="text-slate-500 font-medium">สวัสดีครับ/ค่ะ</p>
          <h1 className="text-3xl font-black text-slate-800">
            ยินดีต้อนรับ คุณ {customer.contact_name}
          </h1>
          <p className="text-lg text-blue-600 font-bold mt-1">
            โรงพยาบาล: {customer.hospital_name}
          </p>
        </header>

        {/* ส่วนเมนูเหมือนเดิม */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* กิตใส่รายการเมนู 4 รายการที่คุยกันไว้ตรงนี้ครับ */}
        </div>
      </div>
    </div>
  );
}
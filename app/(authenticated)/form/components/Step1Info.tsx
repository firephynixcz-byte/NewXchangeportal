'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ReturnRepository } from '../../../repositories/ReturnRepository';

interface Step1Props {
  next: () => void;
  updateData: React.Dispatch<React.SetStateAction<any>>;
}

const TYPES = [
  { label: 'รับคืนลดหนี้',     icon: '💰' },
  { label: 'รับคืน Recall',    icon: '⚠️' },
  { label: 'รับคืนแลกเปลี่ยน', icon: '🔄' },
  { label: 'อื่นๆ',            icon: '⋯'  },
] as const;

export default function Step1Info({ next, updateData }: Step1Props) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState('');
  const [otherDetail, setOtherDetail] = useState('');
  const [today, setToday] = useState('');
  const [docNumber, setDocNumber] = useState('Loading...'); 
  const [clientData, setClientData] = useState<any>(null);
  const [customerCode, setCustomerCode] = useState('');

useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      
      // ดึงแค่ข้อมูล client โดยตรง (ไม่ต้องเช็ค session ซ้ำที่นี่)
      // เปลี่ยนไปใช้ getUser() เพื่อเอา email หรือ userId จาก auth provider
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return; 

      const { data, error } = await supabase
        .from('clients')
        .select('*, b2b_customers(*)')
        .eq('email', user.email)
        .single();
        
      if (error || !data) {
        console.error("Client fetch error:", error);
        return;
      }
      
      setClientData(data);
      setCustomerCode(data.customer_code || '');
      
      try {
        const nextNumber = await ReturnRepository.getNextDocNumber();
        setDocNumber(nextNumber);
      } catch { 
        setDocNumber("S001/2026"); 
      }
    };
    init();
    setToday(new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }));
  }, []); // ลบ [router] ออก เพราะเราไม่ได้ใช้ router แล้ว

  const handleNext = () => {
    if (!selectedType) return alert('กรุณาเลือกประเภทรายการ');
    if (selectedType === 'อื่นๆ' && !otherDetail.trim()) return alert('กรุณาระบุรายละเอียด');
    
    updateData((prev: any) => ({
      ...prev,
      sender: { 
        ...prev.sender, 
        doc_number: docNumber,
        request_type: selectedType,
        return_reason: selectedType === 'อื่นๆ' ? otherDetail : selectedType,
        hospital_name: clientData?.hospital_name,
        addr_province: clientData?.province,
        customer_code: customerCode,
        contact_name: clientData?.contact_name,
        customer_email: clientData?.email,
        phone: clientData?.phone,
        department: clientData?.department,
        b2b_customer_id: clientData?.b2b_customer_id,
        client_id: clientData?.id
      },
      sigFullname: clientData?.contact_name,
      sigPosition: clientData?.position
    }));
    next();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-7">
        <h2 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2">
          <div className="w-1 h-4 bg-teal-600 rounded-full" /> รายละเอียดรายการ
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {TYPES.map((t) => (
            <button
              key={t.label} type="button" onClick={() => setSelectedType(t.label)}
              className={`flex flex-col items-center gap-3 py-6 px-2 rounded-2xl border-2 transition-all ${
                selectedType === t.label ? 'border-teal-600 bg-teal-50 shadow-md' : 'border-slate-50 bg-slate-50 hover:border-slate-200'
              }`}
            >
              <span className="text-2xl">{t.icon}</span>
              <span className={`text-[11px] font-black ${selectedType === t.label ? 'text-teal-700' : 'text-slate-500'}`}>{t.label}</span>
            </button>
          ))}
        </div>
        {selectedType === 'อื่นๆ' && (
          <div className="mb-6">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">ระบุรายละเอียดเพิ่มเติม</label>
            <input onChange={(e) => setOtherDetail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">เลขที่เอกสาร</label>
            <div className="px-4 py-3 rounded-xl bg-slate-50 text-slate-500 font-medium text-sm border border-slate-100">{docNumber}</div></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">วันที่ทำรายการ</label>
            <div className="px-4 py-3 rounded-xl bg-slate-50 text-slate-500 font-medium text-sm border border-slate-100">{today}</div></div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-7">
        <h2 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2">
          <div className="w-1 h-4 bg-teal-600 rounded-full" /> ข้อมูลหน่วยงาน
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">ชื่อหน่วยงาน</label>
            <div className="px-4 py-3 rounded-xl bg-slate-50 text-slate-500 font-medium text-sm border border-slate-100">{clientData?.hospital_name || '...'}</div></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">จังหวัด</label>
            <div className="px-4 py-3 rounded-xl bg-slate-50 text-slate-500 font-medium text-sm border border-slate-100">{clientData?.province || '...'}</div></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">รหัสลูกค้า (Customer Code)</label>
            <input value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-teal-200 outline-none" /></div>
        </div>
      </div>

      <button onClick={handleNext} className="w-full py-4 rounded-2xl font-black text-white bg-teal-700 hover:bg-teal-800 transition-all active:scale-[0.98] shadow-lg shadow-teal-200">
        ดำเนินการต่อ →
      </button>
    </div>
  );
}
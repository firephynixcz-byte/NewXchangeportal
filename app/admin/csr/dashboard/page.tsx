'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCSRDashboardData, reviewClient, approveRequest, startExchangeProcess, completeRequest } from '@/app/actions/csr-actions';
import { getStaffSession } from '@/app/actions/auth-staff';

// ── Status config ──────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending_review: { label: 'รอตรวจสอบ',  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-400' },
  approved:       { label: 'อนุมัติแล้ว', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  receiving:      { label: 'กำลังรับสินค้า', color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200',     dot: 'bg-blue-500' },
  exchanging:     { label: 'กำลังแลกเปลี่ยน', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
  completed:      { label: 'เสร็จสิ้น',   color: 'text-slate-600',   bg: 'bg-slate-100 border-slate-200',  dot: 'bg-slate-400' },
};

const EXP_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pass:    { label: 'ปกติ',         color: 'text-emerald-700', bg: 'bg-emerald-50' },
  near:    { label: 'ใกล้หมดอายุ', color: 'text-amber-700',   bg: 'bg-amber-50' },
  expired: { label: 'หมดอายุ',     color: 'text-red-700',     bg: 'bg-red-50' },
  pending: { label: 'รอตรวจสอบ',   color: 'text-slate-600',   bg: 'bg-slate-100' },
};

// ── Sub-components ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function DrugItemRow({ item }: { item: any }) {
  const exp = EXP_STATUS_CONFIG[item.exp_status] ?? { label: item.exp_status, color: 'text-slate-500', bg: 'bg-slate-50' };
  return (
    <div className="grid grid-cols-12 gap-2 text-xs px-3 py-2.5 bg-white rounded-xl border border-slate-100 hover:border-teal-200 hover:bg-teal-50/30 transition-all duration-150">
      {/* ชื่อยา */}
      <div className="col-span-4 font-semibold text-slate-800 truncate">{item.drug_name}</div>
      {/* จำนวน + หน่วย */}
      <div className="col-span-2 text-slate-500 font-medium">{item.qty} <span className="text-slate-400">{item.unit}</span></div>
      {/* Lot */}
      <div className="col-span-2 text-slate-400 font-mono truncate">{item.lot_number ?? '—'}</div>
      {/* วันหมดอายุ */}
      <div className="col-span-2 text-slate-400">{item.exp_date ? new Date(item.exp_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</div>
      {/* exp_status */}
      <div className="col-span-2 flex justify-end">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${exp.bg} ${exp.color}`}>{exp.label}</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function CSRDashboard() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedReq, setExpandedReq] = useState<number | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getCSRDashboardData();
    if (data.success) {
      setClients(data.clients || []);
      setRequests(data.requests || []);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleBack = () => router.replace('/');

  const handleReviewClient = async (id: string, action: 'approved' | 'rejected') => {
    const res = await reviewClient(id, action);
    if (res.success) {
      alert(action === 'approved' ? 'อนุมัติเรียบร้อย' : 'ปฏิเสธเรียบร้อย');
      fetchData();
    } else alert('Error: ' + res.error);
  };
  
  const handleUpdateStatus = async (id: number, newStatus: string) => {
  const remark = prompt('ระบุหมายเหตุ:');
  if (remark === null) return;

  try {
    // กิตต้องดึง ID พนักงานจาก Session ก่อนเสมอ
    const session = await getStaffSession(); 
    if (!session?.id) {
      alert("ไม่พบ Session พนักงาน กรุณาล็อกอินใหม่");
      return;
    }
    
    type ApiResponse = { success: boolean, error?: string };
    let res;
    // เลือกฟังก์ชันให้ตรงกับ newStatus ที่ส่งมา
    if (newStatus === 'approved') {
      res = await approveRequest(id, session.id, remark || '');
    } else if (newStatus === 'exchanging') {
      res = await startExchangeProcess(id, session.id, remark || '');
    } else if (newStatus === 'completed') {
      res = await completeRequest(id, session.id, remark || '');
    } else {
      alert('สถานะไม่รู้จัก');
      return;
    }

    if (res.success) {
      alert('อัปเดตสถานะเรียบร้อย');
      fetchData();
    } else {
      alert('Error: ' + (res.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'));
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    console.error(err);
  }
};

  // ── Loading ──
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f4f8' }}>
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 font-medium">กำลังโหลดข้อมูล...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #f0f7f4 0%, #f0f4f8 60%)' }}>

      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl transition-all group"
            >
              <span className="group-hover:-translate-x-0.5 transition-transform">←</span> ย้อนกลับ
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div>
              <h1 className="text-base font-black text-slate-800 leading-tight">CSR Command Center</h1>
              <p className="text-[11px] text-slate-400">GPO Xchange Portal • จัดการคำร้องและอนุมัติลูกค้า</p>
            </div>
          </div>
          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-orange-700 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              รออนุมัติ {clients.length} ราย
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              ใบงาน {requests.length} รายการ
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ══ SECTION 1: อนุมัติลูกค้า ══ */}
        <section className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden">
          {/* Section header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100"
            style={{ background: 'linear-gradient(90deg, #fff7ed, #ffffff)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm"
                style={{ background: 'linear-gradient(135deg,#fed7aa,#fb923c)' }}>🏥</div>
              <div>
                <h2 className="text-sm font-black text-slate-800">ลูกค้าที่รออนุมัติ</h2>
                <p className="text-xs text-slate-400">{clients.length} รายการ</p>
              </div>
            </div>
          </div>

          {clients.length === 0 ? (
            <div className="py-14 text-center">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-sm text-slate-400 font-medium">ไม่มีลูกค้าที่รออนุมัติ</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {clients.map((client, idx) => (
                <div key={client.id}
                  className="flex items-center justify-between px-7 py-4 hover:bg-slate-50/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-sm font-black text-slate-400">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 group-hover:text-teal-700 transition-colors">{client.hospital_name}</p>
                      {client.province && <p className="text-xs text-slate-400">{client.province}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReviewClient(client.id, 'approved')}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md shadow-emerald-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all"
                      style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}
                    >✓ อนุมัติ</button>
                    <button
                      onClick={() => handleReviewClient(client.id, 'rejected')}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md shadow-red-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all"
                      style={{ background: 'linear-gradient(135deg,#dc2626,#f87171)' }}
                    >✕ ปฏิเสธ</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ══ SECTION 2: Workflow ══ */}
        <section className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden">
          {/* Section header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100"
            style={{ background: 'linear-gradient(90deg,#eff6ff,#ffffff)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm"
                style={{ background: 'linear-gradient(135deg,#bfdbfe,#3b82f6)' }}>📋</div>
              <div>
                <h2 className="text-sm font-black text-slate-800">จัดการใบงาน (Workflow)</h2>
                <p className="text-xs text-slate-400">{requests.length} รายการ</p>
              </div>
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-7 py-3 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <div className="col-span-3">Ref ID</div>
            <div className="col-span-2">สถานะ</div>
            <div className="col-span-5">รายการสินค้า</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {requests.length === 0 ? (
            <div className="py-14 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm text-slate-400 font-medium">ไม่มีใบงานในระบบ</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {requests.map((req) => {
                const isExpanded = expandedReq === req.id;
                const drugCount = req.drug_items?.length ?? 0;
                return (
                  <div key={req.id} className="hover:bg-slate-50/40 transition-colors">
                    <div className="grid grid-cols-12 gap-4 px-7 py-4 items-center">

                      {/* Ref ID */}
                      <div className="col-span-3">
                        <p className="text-sm font-black text-slate-800 font-mono">{req.ref_id}</p>
                        {req.hospital_name && <p className="text-xs text-slate-400 mt-0.5 truncate">{req.hospital_name}</p>}
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        <StatusBadge status={req.current_status} />
                      </div>

                      {/* Drug items preview */}
                      <div className="col-span-5">
                        <button
                          onClick={() => setExpandedReq(isExpanded ? null : req.id)}
                          className="flex items-center gap-2 text-xs text-slate-500 hover:text-teal-700 font-semibold transition-colors group"
                        >
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-50 text-teal-600 font-black text-[10px] group-hover:bg-teal-100">
                            {drugCount}
                          </span>
                          รายการสินค้า
                          <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                        </button>
                      </div>

                      {/* Action */}
                      <div className="col-span-2 text-right">
                        {req.current_status === 'pending_review' && (
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'approved')}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg,#2563eb,#3b82f6)' }}
                          >Approve</button>
                        )}
                        {req.current_status === 'receiving' && (
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'exchanging')}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg,#ea580c,#f97316)' }}
                          >Start Exchange</button>
                        )}
                        {req.current_status === 'exchanging' && (
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'completed')}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}
                          >Complete</button>
                        )}
                      </div>
                    </div>

                    {/* Drug items expanded */}
                    {isExpanded && drugCount > 0 && (
                      <div className="px-7 pb-4">
                        {/* Column labels */}
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide px-3 mb-1.5">
                          <div className="col-span-4">ชื่อยา / สินค้า</div>
                          <div className="col-span-2">จำนวน</div>
                          <div className="col-span-2">Lot No.</div>
                          <div className="col-span-2">วันหมดอายุ</div>
                          <div className="col-span-2 text-right">สถานะ</div>
                        </div>
                        <div className="space-y-1.5">
                          {req.drug_items.map((item: any) => (
                            <DrugItemRow key={item.id} item={item} />
                          ))}
                        </div>
                        {/* Summary */}
                        {req.drug_items.some((i: any) => i.value_amount) && (
                          <div className="mt-3 flex justify-end">
                            <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-2 text-xs">
                              <span className="text-slate-500">มูลค่ารวม: </span>
                              <span className="font-black text-teal-700">
                                ฿{req.drug_items.reduce((s: number, i: any) => s + (Number(i.value_amount) || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
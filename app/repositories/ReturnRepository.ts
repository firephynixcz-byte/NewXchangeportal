// repositories/ReturnRepository.ts
import { createClient } from '@/lib/supabase/client'; // ใช้ตัวเดียวกับที่เราใช้ในระบบหลัก
import { nanoid } from 'nanoid';

/**
 * ฟังก์ชันช่วยแปลงวันที่สำหรับตาราง Database
 */
const sanitizeDate = (date: any) => {
  if (!date) return null;
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
};

export const ReturnRepository = {
  async getNextDocNumber() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('requests')
      .select('doc_number')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
  
    if (error) {
      console.error("Error fetching doc_number:", error);
      return "S001/2026";
    }

    if (!data || !data.doc_number) return "S001/2026"; 

    const lastNum = parseInt(data.doc_number.split('/')[0].replace('S', ''));
    const nextNum = (lastNum + 1).toString().padStart(3, '0');
    return `S${nextNum}/2026`;
  },
  
  /**
   * บันทึกข้อมูลใบคำขอลงตาราง requests และรายการยาลง drug_items
   */
  async createReturnRequest(data: any) {
    const supabase = createClient();
    const refId = nanoid(10).toUpperCase();

    // 1. บันทึกตารางหลัก requests (ปรับชื่อ column ให้ตรงกับ schema ใหม่ของกิต)
    const { data: request, error: requestError } = await supabase
      .from('requests')
      .insert({
        ref_id: refId,
        request_date: new Date().toISOString(),
        doc_number: data.sender?.doc_number,
        request_type: data.sender?.request_type,
        return_reason: data.sender?.return_reason,
        hospital_name: data.sender?.hospital_name,
        addr_province: data.sender?.addr_province,
        customer_code: data.sender?.customer_code,
        contact_name: data.sender?.contact_name,
        customer_email: data.sender?.customer_email,
        phone: data.sender?.phone,
        department: data.sender?.department,
        b2b_customer_id: data.sender?.b2b_customer_id,
        client_id: data.sender?.client_id,
        
        // ข้อมูลอื่นๆ ที่กิตส่งมาใน formData
        signature_url: data.signature,
        signer_name: data.sigFullname,
        signer_position: data.sigPosition,
        total_value: Number(data.totalValue) || 0,
        exchange_product_list: Array.isArray(data.items) ? JSON.stringify(data.items) : null,
      })
      .select('id')
      .single();

    if (requestError) throw requestError;

    // 2. บันทึกรายการยา (ถ้าตาราง drug_items ของกิตยังอยู่)
    if (data.items && data.items.length > 0) {
      const itemsToInsert = data.items.map((item: any) => ({
        request_id: request.id,
        drug_name: item.drugName,
        qty: Number(item.qty) || 0,
        unit: item.unit,
        lot_number: item.lot,
        exp_date: sanitizeDate(item.exp),
        value_amount: Number(item.value) || 0,
        invoice_number: item.invoiceNumber,
        product_type: item.productType || 'ทั่วไป',
        exp_status: item.expStatus || 'pending'
      }));

      const { error: itemsError } = await supabase
        .from('drug_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
    }

    return { refId };
  }
};
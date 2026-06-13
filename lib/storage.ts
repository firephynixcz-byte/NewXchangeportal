// lib/storage.ts
import { createClient } from '@/lib/supabase/client';
import { UploadResult } from '@/types/upload';

const supabase = createClient()

export const uploadSignature = async (file: File): Promise<UploadResult> => {
  const fileName = `${Date.now()}_${file.name}`;
  
  // bucket ชื่อ 'signatures' ต้องตรงกับที่กิตสร้างใน Dashboard
  const { data, error } = await supabase.storage
    .from('signatures') 
    .upload(fileName, file);

  if (error) return { url: null, error: error.message };

  // ดึง URL จาก Bucket ชื่อ 'signatures' เหมือนกัน
  const { data: publicUrlData } = supabase.storage
    .from('signatures')
    .getPublicUrl(fileName);

  return { url: publicUrlData.publicUrl, error: null };
};
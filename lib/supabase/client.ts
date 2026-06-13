// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'; // <--- เพิ่มบรรทัดนี้ครับ

export function createClient() {
  console.log("Checking URL:", process.env.NEXT_PUBLIC_SUPABASE_URL); 
  
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
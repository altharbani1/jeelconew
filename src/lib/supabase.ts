import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseKey);

// اختبار اتصال بسيط
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.rpc('version'); // أو استعلام جدول بسيط
    if (error) {
      console.error('❌ Supabase connection error:', error.message);
      return false;
    }
    console.log('✅ Supabase connection success:', data);
    return true;
  } catch (e) {
    console.error('❌ Supabase connection exception:', e);
    return false;
  }
}

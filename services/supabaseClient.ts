import { createClient } from '@supabase/supabase-js';


const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
console.log('env ok?', !!import.meta.env.VITE_SUPABASE_URL);

export const supabase = createClient(supabaseUrl, supabaseKey);

// دالة لاختبار الاتصال بقاعدة البيانات
export async function testConnection() {
	const { data, error } = await supabase.from('app_users').select('*').limit(1);
	if (error) {
		console.error('Supabase connection error:', error.message);
		return false;
	} else {
		console.log('Supabase connection success:', data);
		return true;
	}
}
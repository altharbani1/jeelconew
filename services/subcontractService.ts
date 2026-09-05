import { supabase } from './supabaseClient';

export const SUBCONTRACT_BUCKET = 'subcontract-files';
export const subcontractService = {
    async companyId(): Promise<string> {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error('تسجيل الدخول السحابي مطلوب');
        const { data, error } = await supabase.from('app_users').select('company_id').eq('id', auth.user.id).single();
        if (error || !data?.company_id) throw new Error('تعذر تحديد الشركة');
        return data.company_id;
    },
    async load(collection: string) {
        const companyId = await this.companyId();
        const { data, error } = await supabase.from('jilco_realtime_data').select('data').eq('collection', collection).eq('company_id', companyId);
        if (error) throw error;
        return (data || []).map(row => row.data);
    },
    async mutate(collection: string, id: string, record: any, revision: number) {
        const { data, error } = await supabase.rpc('mutate_subcontract_record', {
            p_collection: collection, p_id: id, p_data: record, p_revision: revision
        });
        if (error) throw new Error(error.code === '40001' ? 'تم تعديل السجل من جلسة أخرى. أغلق النموذج وافتحه مجددًا لمراجعة أحدث البيانات.' : error.message);
        return data;
    },
    async attachmentUrl(path: string) {
        const { data, error } = await supabase.storage.from(SUBCONTRACT_BUCKET).createSignedUrl(path, 300);
        if (error) throw error;
        return data.signedUrl;
    }
};

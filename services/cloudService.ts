
import { supabase } from './supabaseClient';
import LZString from 'lz-string';

// القائمة الشاملة لجميع مفاتيح التخزين
const STORAGE_KEYS = [
  'jilco_quote_data',
  'jilco_quotes_archive',
  'jilco_invoices_archive',
  'jilco_receipts_archive',
  'jilco_contracts_archive',
  'jilco_customers',
  'jilco_projects',
  'jilco_phases',
  'jilco_specs_db',
  'jilco_suppliers',
  'jilco_supplier_products',
  'jilco_purchase_invoices',
  'jilco_supplier_payments',
  'jilco_warranties_archive',
  'jilco_hr_employees',
  'jilco_hr_commissions',
  'jilco_smart_elevators',
  'jilco_documents',
  'jilco_system_users',
  'jilco_claims_archive',
  'jilco_expenses_archive',
  'jilco_calculator_prices_v6'
];

// مفاتيح الصور (نستثنيها من النسخة الاحتياطية النصية)
const IMAGE_KEYS = ['jilco_logo', 'jilco_stamp'];

const BUCKET = 'jilco-assets';

// ========== مساعد: مفتاح النسخة الاحتياطية حسب المستخدم ==========
const getBackupKey = (username?: string) =>
  username ? `backup_${username}` : 'backup_default';

export const cloudService = {

  // 1. اختبار الاتصال
  async testConnection() {
    try {
      const { error } = await supabase.from('jilco_backups').select('key').limit(1);
      return !error;
    } catch (e) {
      return false;
    }
  },

  // 2. تهيئة (الجدول يُنشأ عبر Supabase Dashboard)
  async initDb() {
    return true;
  },

  // 3. جمع البيانات المحلية (بدون الصور)
  getLocalData() {
    const data: Record<string, any> = {};
    STORAGE_KEYS.forEach(key => {
      const val = localStorage.getItem(key);
      if (val) data[key] = val;
    });
    return data;
  },

  // 4. رفع البيانات مع الضغط + تخصيص لكل مستخدم
  async uploadData(data: any, username?: string) {
    try {
      const jsonData = JSON.stringify(data);
      // ضغط البيانات بـ lz-string (يقلل الحجم 60-80%)
      const compressed = LZString.compressToUTF16(jsonData);
      const key = getBackupKey(username);

      console.log(`📦 حجم البيانات: ${(jsonData.length / 1024).toFixed(1)}KB → مضغوط: ${(compressed.length / 1024).toFixed(1)}KB`);

      const { error } = await supabase
        .from('jilco_backups')
        .upsert(
          { key, data: compressed, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Upload Error:', e);
      throw e;
    }
  },

  // 5. استرجاع البيانات مع فك الضغط
  async downloadData(username?: string) {
    try {
      const key = getBackupKey(username);
      const { data, error } = await supabase
        .from('jilco_backups')
        .select('data')
        .eq('key', key)
        .single();

      if (error || !data) return null;

      // محاولة فك الضغط
      let raw = data.data;
      if (typeof raw === 'string') {
        const decompressed = LZString.decompressFromUTF16(raw);
        // إذا نجح الضغط استخدمه، وإلا البيانات غير مضغوطة (للتوافق مع النسخ القديمة)
        if (decompressed) raw = decompressed;
        return JSON.parse(raw);
      }
      return raw;
    } catch (e) {
      console.error('Download Error:', e);
      return null;
    }
  },

  // 6. معلومات النسخة الاحتياطية
  async getBackupInfo(username?: string) {
    try {
      const key = getBackupKey(username);
      const { data, error } = await supabase
        .from('jilco_backups')
        .select('updated_at, data')
        .eq('key', key)
        .single();

      if (error || !data) return { exists: false };
      const sizeBytes = typeof data.data === 'string' ? data.data.length * 2 : 0;
      return { exists: true, updatedAt: data.updated_at, sizeBytes };
    } catch (e) {
      return { error: true, exists: false };
    }
  },

  // ========== Supabase Storage للصور ==========

  // 7. رفع صورة وإرجاع الرابط العام
  async uploadImage(base64Data: string, filename: string): Promise<string | null> {
    try {
      // تحويل Base64 إلى Blob
      const base64 = base64Data.split(',')[1] || base64Data;
      const mimeMatch = base64Data.match(/data:([^;]+);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const byteChars = atob(base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArr[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArr], { type: mime });
      const ext = mime.split('/')[1] || 'png';
      const path = `${filename}_${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true, contentType: mime });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return urlData.publicUrl;
    } catch (e) {
      console.error('Image Upload Error:', e);
      return null;
    }
  },

  // 8. الحصول على رابط صورة
  getImageUrl(path: string): string {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  },

  // ==========================================
  // 🌟 NEW REAL-TIME DOCUMENT STORE METHODS
  // ==========================================

  // 9. الاستماع للتغييرات الحية على مجموعة معينة (Subscribe)
  subscribeToCollection(collection: string, onUpdate: (payload: any) => void) {
    if (collection === 'jilco_customers') {
      const channel = supabase.channel(`realtime_customers`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload: any) => {
           let mappedPayload: any = { eventType: payload.eventType };
           if (payload.new && payload.new.legacy_id) {
               mappedPayload.new = {
                   record_id: payload.new.legacy_id,
                   data: {
                       id: payload.new.legacy_id,
                       fullName: payload.new.full_name,
                       phone: payload.new.phone,
                       email: payload.new.email,
                       address: payload.new.address,
                       type: payload.new.type,
                       status: payload.new.status,
                       vatNumber: payload.new.vat_number,
                       nationalId: payload.new.national_id,
                       lastContactDate: payload.new.last_contact_date,
                       notes: payload.new.notes,
                       createdAt: payload.new.created_at
                   }
               };
           }
           if (payload.old) {
               // Fallback: If legacy_id is not in old payload, we might need to handle it or guess from cache, but usually Realtime provides it if REPLICA IDENTITY is set.
               mappedPayload.old = { record_id: payload.old.legacy_id || payload.old.id };
           }
           onUpdate(mappedPayload);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }

    const channel = supabase.channel(`realtime_${collection}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jilco_realtime_data', filter: `collection=eq.${collection}` },
        (payload) => onUpdate(payload)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // 10. تحميل مجموعة كاملة (مثل: جميع عروض الأسعار)
  async loadCollection(collection: string) {
    try {
      if (collection === 'jilco_customers') {
        const { data, error } = await supabase.from('customers').select('*');
        if (error) throw error;
        return (data || []).map((row: any) => ({
          record_id: row.legacy_id || row.id,
          data: {
            id: row.legacy_id || row.id,
            fullName: row.full_name,
            phone: row.phone,
            email: row.email,
            address: row.address,
            type: row.type,
            status: row.status,
            vatNumber: row.vat_number,
            nationalId: row.national_id,
            lastContactDate: row.last_contact_date,
            notes: row.notes,
            createdAt: row.created_at
          }
        }));
      }

      const { data, error } = await supabase
        .from('jilco_realtime_data')
        .select('record_id, data')
        .eq('collection', collection);

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error(`Failed to load collection ${collection}:`, e);
      return [];
    }
  },

  // 11. إضافة أو تحديث سجل واحد فقط (Upsert Record)
  async saveRecord(collection: string, recordId: string, dataObj: any) {
    try {
      if (collection === 'jilco_customers') {
        const payload = {
            legacy_id: dataObj.id,
            full_name: dataObj.fullName,
            phone: dataObj.phone,
            email: dataObj.email,
            address: dataObj.address,
            type: dataObj.type || 'individual',
            status: dataObj.status || 'new',
            vat_number: dataObj.vatNumber,
            national_id: dataObj.nationalId,
            last_contact_date: dataObj.lastContactDate || null,
            notes: dataObj.notes || []
        };
        const { error } = await supabase.from('customers').upsert(payload, { onConflict: 'legacy_id' });
        if (error) throw error;
        return true;
      }

      const { error } = await supabase
        .from('jilco_realtime_data')
        .upsert(
          {
            collection,
            record_id: recordId,
            data: dataObj,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'collection, record_id' }
        );

      if (error) {
        console.error(`Supabase Upsert Error in ${collection}:`, error);
        throw error;
      }
      return true;
    } catch (e) {
      console.error(`Failed to save record ${recordId} in ${collection}:`, e);
      return false;
    }
  },

  // 12. حذف سجل
  async deleteRecord(collection: string, recordId: string) {
    try {
      if (collection === 'jilco_customers') {
         const { error } = await supabase.from('customers').delete().eq('legacy_id', recordId);
         if (error) throw error;
         return true;
      }

      const { error } = await supabase
        .from('jilco_realtime_data')
        .delete()
        .eq('collection', collection)
        .eq('record_id', recordId);

      if (error) throw error;
      return true;
    } catch (e) {
      console.error(`Failed to delete record ${recordId} in ${collection}:`, e);
      return false;
    }
  },

  // 13. Data Migration Tool for Customers
  async migrateLegacyCustomers() {
    try {
      // 1. Load legacy records from JSON store
      const { data, error } = await supabase
        .from('jilco_realtime_data')
        .select('record_id, data')
        .eq('collection', 'jilco_customers');
      
      if (error || !data) return false;
      
      let migrated = 0;
      for (const row of data) {
         const cData = row.data;
         const payload = {
            legacy_id: cData.id || row.record_id,
            full_name: cData.fullName || 'بدون اسم',
            phone: cData.phone || '',
            email: cData.email || '',
            address: cData.address || '',
            type: cData.type || 'individual',
            status: cData.status || 'new',
            vat_number: cData.vatNumber || '',
            national_id: cData.nationalId || '',
            last_contact_date: cData.lastContactDate || null,
            notes: cData.notes || []
         };
         await supabase.from('customers').upsert(payload, { onConflict: 'legacy_id' });
         migrated++;
      }
      return migrated;
    } catch { return -1; }
  }
};

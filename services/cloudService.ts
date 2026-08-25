
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
           if (payload.old) mappedPayload.old = { record_id: payload.old.legacy_id || payload.old.id };
           onUpdate(mappedPayload);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }

    if (collection === 'jilco_quotes_archive') {
      // For now we only listen to main quotes table updates, mapping sub-tables would be complex for realtime
      const channel = supabase.channel(`realtime_quotes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, async (payload: any) => {
            if (payload.eventType === 'DELETE' && payload.old) {
                onUpdate({ eventType: 'DELETE', old: { record_id: payload.old.legacy_id || payload.old.id } });
            } else if (payload.new && payload.new.legacy_id) {
                const quoteAll = await cloudService.loadCollection('jilco_quotes_archive');
                const fullQuoteData = quoteAll?.find((q:any) => q.record_id === payload.new.legacy_id);
                if (fullQuoteData) {
                    onUpdate({ eventType: payload.eventType, new: fullQuoteData });
                }
            }
        }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }

    if (collection === 'jilco_contracts_archive' || collection === 'jilco_invoices_archive' || collection === 'jilco_receipts_archive') {
        const tableMap: any = {
            'jilco_contracts_archive': 'contracts',
            'jilco_invoices_archive': 'invoices',
            'jilco_receipts_archive': 'receipts'
        };
        const tableName = tableMap[collection];
        const channel = supabase.channel(`realtime_${tableName}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, async (payload: any) => {
                if (payload.eventType === 'DELETE' && payload.old) {
                    onUpdate({ eventType: 'DELETE', old: { record_id: payload.old.legacy_id || payload.old.id } });
                } else if (payload.new && payload.new.legacy_id) {
                    const allData = await cloudService.loadCollection(collection);
                    const record = allData?.find((q:any) => q.record_id === payload.new.legacy_id);
                    if (record) onUpdate({ eventType: payload.eventType, new: record });
                }
            }).subscribe();
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

      if (collection === 'jilco_quotes_archive') {
         const { data: quotes, error: qErr } = await supabase.from('quotes').select('*, quote_items(*), quote_specs(*)');
         if (qErr) throw qErr;
         return (quotes || []).map((row: any) => ({
             record_id: row.legacy_id || row.id,
             data: {
                 id: row.legacy_id || row.id,
                 ...row,
                 details: {
                     number: row.number,
                     date: row.date,
                     customerName: row.customer_name,
                     customerAddress: row.customer_address,
                     projectName: row.project_name,
                     validity: row.validity,
                     taxRate: Number(row.tax_rate),
                     warrantyInstallation: row.warranty_installation,
                     warrantyMotor: row.warranty_motor,
                     paymentTerms: row.payment_terms || [],
                     termsAndConditions: row.terms_and_conditions,
                     features: row.features || [],
                     handoverAndWarranty: row.handover_and_warranty,
                     firstPartyObligations: row.first_party_obligations,
                     secondPartyObligations: row.second_party_obligations,
                     worksDuration: row.works_duration,
                     showGallery: row.show_gallery,
                     galleryImages: row.gallery_images || {}
                 },
                 items: (row.quote_items || []).map((item: any) => ({
                     id: item.legacy_id || item.id,
                     description: item.description,
                     details: item.details,
                     quantity: Number(item.quantity),
                     unitPrice: Number(item.unit_price),
                     total: Number(item.total)
                 })),
                 techSpecs: row.quote_specs && row.quote_specs.length > 0 ? {
                     ...row.quote_specs[0],
                     elevatorType: row.quote_specs[0].elevator_type,
                     driveType: row.quote_specs[0].drive_type,
                     controlSystem: row.quote_specs[0].control_system,
                     powerSupply: row.quote_specs[0].power_supply,
                     externalDoors: row.quote_specs[0].external_doors,
                     machineRoom: row.quote_specs[0].machine_room
                 } : {}
             }
         }));
      }

      const phase3Collections: any = {
          'jilco_contracts_archive': {
              table: 'contracts',
              mapFn: (row: any) => {
                 const contractData = {
                     id: row.legacy_id || row.id,
                     number: row.number, date: row.date, firstPartyName: row.first_party_name,
                     secondPartyName: row.second_party_name, secondPartyId: row.second_party_id,
                     location: row.location, totalValue: Number(row.total_value), elevatorType: row.elevator_type,
                     stops: Number(row.stops), elevatorCount: Number(row.elevator_count),
                     internalDoorsCount: Number(row.internal_doors_count), externalDoorsCount: Number(row.external_doors_count),
                     accessControl: row.access_control, durationMonths: Number(row.duration_months),
                     firstPartyObligations: row.first_party_obligations, secondPartyObligations: row.second_party_obligations,
                     handoverAndWarranty: row.handover_and_warranty, worksDuration: row.works_duration
                 };
                 // Simulate old wrapping so frontend doesn't break
                 return { id: contractData.id, data: contractData, specs: {} }; // Assuming specs might need to be joined later
              }
          },
          'jilco_invoices_archive': {
              table: 'invoices',
              mapFn: (row: any) => ({
                  id: row.legacy_id || row.id, number: row.number, date: row.date, dueDate: row.due_date,
                  customerName: row.customer_name, customerVatNumber: row.customer_vat_number,
                  items: row.items || [], status: row.status, discountAmount: Number(row.discount_amount),
                  isTaxInclusive: row.is_tax_inclusive
              })
          },
          'jilco_receipts_archive': {
              table: 'receipts',
              mapFn: (row: any) => ({
                  id: row.legacy_id || row.id, number: row.number, date: row.date, receivedFrom: row.received_from,
                  amount: Number(row.amount), amountInWords: row.amount_in_words, paymentMethod: row.payment_method,
                  bankName: row.bank_name, checkNumber: row.check_number, forReason: row.for_reason,
                  attachments: row.attachments || []
              })
          }
      };

      if (phase3Collections[collection]) {
          const cfg = phase3Collections[collection];
          const { data, error } = await supabase.from(cfg.table).select('*');
          if (error) throw error;
          return (data || []).map((row: any) => ({ record_id: row.legacy_id || row.id, data: cfg.mapFn(row) }));
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

      if (collection === 'jilco_quotes_archive') {
         const qData = dataObj;
         const d = qData.details ? qData.details : qData; // Support wrapped or flat
         if (!d.number?.trim()) throw new Error('رقم عرض السعر مطلوب');
         const quotePayload = {
            legacy_id: qData.id || d.number,
            number: d.number.trim(),
            date: d.date || null,
            customer_name: d.customerName,
            customer_address: d.customerAddress,
            project_name: d.projectName,
            validity: d.validity,
            tax_rate: Number(d.taxRate) || 0,
            warranty_installation: d.warrantyInstallation,
            warranty_motor: d.warrantyMotor,
            payment_terms: d.paymentTerms,
            terms_and_conditions: d.termsAndConditions,
            features: d.features,
            handover_and_warranty: d.handoverAndWarranty,
            first_party_obligations: d.firstPartyObligations,
            second_party_obligations: d.secondPartyObligations,
            works_duration: d.worksDuration,
            show_gallery: d.showGallery,
            gallery_images: d.galleryImages,
            total: (qData.items || []).reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0)
         };

         const { data: savedQuote, error: quoteError } = await supabase
           .from('quotes')
           .upsert(quotePayload, { onConflict: 'legacy_id' })
           .select('id')
           .single();
         if (quoteError || !savedQuote) throw quoteError || new Error('تعذر حفظ عرض السعر');

         const qId = savedQuote.id;
         const { error: deleteItemsError } = await supabase.from('quote_items').delete().eq('quote_id', qId);
         if (deleteItemsError) throw deleteItemsError;
         const { error: deleteSpecsError } = await supabase.from('quote_specs').delete().eq('quote_id', qId);
         if (deleteSpecsError) throw deleteSpecsError;

         if (qData.items?.length > 0) {
            const itemsPayload = qData.items.map((item: any) => ({
                legacy_id: item.id || crypto.randomUUID(),
                quote_id: qId,
                quote_legacy_id: qData.id,
                description: item.description,
                details: item.details,
                quantity: Number(item.quantity) || 0,
                unit_price: Number(item.unitPrice) || 0,
                total: Number(item.total) || 0
            }));
            const { error: itemsError } = await supabase.from('quote_items').insert(itemsPayload);
            if (itemsError) throw itemsError;
         }

         if (qData.techSpecs) {
            const specsPayload = {
                quote_id: qId,
                quote_legacy_id: qData.id,
                elevator_type: qData.techSpecs.elevatorType,
                capacity: qData.techSpecs.capacity,
                speed: qData.techSpecs.speed,
                stops: qData.techSpecs.stops,
                drive_type: qData.techSpecs.driveType,
                control_system: qData.techSpecs.controlSystem,
                power_supply: qData.techSpecs.powerSupply,
                cabin: qData.techSpecs.cabin,
                doors: qData.techSpecs.doors,
                external_doors: qData.techSpecs.externalDoors,
                machine_room: qData.techSpecs.machineRoom,
                rails: qData.techSpecs.rails,
                ropes: qData.techSpecs.ropes,
                safety: qData.techSpecs.safety,
                emergency: qData.techSpecs.emergency
            };
            const { error: specsError } = await supabase.from('quote_specs').insert(specsPayload);
            if (specsError) throw specsError;
         }

         return true;
      }

      const phase3Upserts: any = {
          'jilco_contracts_archive': {
              table: 'contracts',
              mapFn: (payloadRecord: any) => {
                 // Check if it's wrapped in { data: {...} } or not
                 const d = payloadRecord.data ? payloadRecord.data : payloadRecord;
                 return {
                     legacy_id: payloadRecord.id || d.number, number: d.number, date: d.date, first_party_name: d.firstPartyName,
                     second_party_name: d.secondPartyName, second_party_id: d.secondPartyId,
                     location: d.location, total_value: d.totalValue, elevator_type: d.elevatorType,
                     stops: d.stops, elevator_count: d.elevatorCount, internal_doors_count: d.internalDoorsCount,
                     external_doors_count: d.externalDoorsCount, access_control: d.accessControl,
                     duration_months: d.durationMonths, first_party_obligations: d.firstPartyObligations,
                     second_party_obligations: d.secondPartyObligations, handover_and_warranty: d.handoverAndWarranty,
                     works_duration: d.worksDuration
                 };
              }
          },
          'jilco_invoices_archive': {
              table: 'invoices',
              mapFn: (payloadRecord: any) => {
                  const d = payloadRecord.data ? payloadRecord.data : payloadRecord;
                  return {
                      legacy_id: payloadRecord.id || d.number, number: d.number, date: d.date, due_date: d.dueDate,
                      customer_name: d.customerName, customer_vat_number: d.customerVatNumber,
                      items: d.items, status: d.status, discount_amount: d.discountAmount, is_tax_inclusive: d.isTaxInclusive
                  };
              }
          },
          'jilco_receipts_archive': {
              table: 'receipts',
              mapFn: (payloadRecord: any) => {
                  const d = payloadRecord.data ? payloadRecord.data : payloadRecord;
                  return {
                      legacy_id: payloadRecord.id || d.number, number: d.number, date: d.date, received_from: d.receivedFrom,
                      amount: d.amount, amount_in_words: d.amountInWords, payment_method: d.paymentMethod,
                      bank_name: d.bankName, check_number: d.checkNumber, for_reason: d.forReason, attachments: d.attachments
                  };
              }
          }
      };

      if (phase3Upserts[collection]) {
          const cfg = phase3Upserts[collection];
          const payload = cfg.mapFn(dataObj);
          const { error } = await supabase.from(cfg.table).upsert(payload, { onConflict: 'legacy_id' });
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

      if (collection === 'jilco_quotes_archive') {
         const { error } = await supabase.from('quotes').delete().eq('legacy_id', recordId);
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
  },

  // 14. Data Migration Tool for Quotes
  async migrateLegacyQuotes() {
      try {
        const { data, error } = await supabase
          .from('jilco_realtime_data')
          .select('record_id, data')
          .eq('collection', 'jilco_quotes_archive');
        
        if (error || !data) return false;

        let migrated = 0;
        for (const row of data) {
           await this.saveRecord('jilco_quotes_archive', row.record_id, row.data);
           migrated++;
        }
        return migrated;
      } catch { return -1; }
  },

  // 15. Data Migration Tool for Contracts
  async migrateLegacyContracts() {
      try {
        const { data, error } = await supabase.from('jilco_realtime_data').select('record_id, data').eq('collection', 'jilco_contracts_archive');
        if (error || !data) return false;
        let migrated = 0;
        for (const row of data) { await this.saveRecord('jilco_contracts_archive', row.record_id, row.data); migrated++; }
        return migrated;
      } catch { return -1; }
  },

  // 16. Data Migration Tool for Invoices
  async migrateLegacyInvoices() {
      try {
        const { data, error } = await supabase.from('jilco_realtime_data').select('record_id, data').eq('collection', 'jilco_invoices_archive');
        if (error || !data) return false;
        let migrated = 0;
        for (const row of data) { await this.saveRecord('jilco_invoices_archive', row.record_id, row.data); migrated++; }
        return migrated;
      } catch { return -1; }
  },

  // 17. Data Migration Tool for Receipts
  async migrateLegacyReceipts() {
      try {
        const { data, error } = await supabase.from('jilco_realtime_data').select('record_id, data').eq('collection', 'jilco_receipts_archive');
        if (error || !data) return false;
        let migrated = 0;
        for (const row of data) { await this.saveRecord('jilco_receipts_archive', row.record_id, row.data); migrated++; }
        return migrated;
      } catch { return -1; }
  }
};

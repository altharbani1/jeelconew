-- =========================================================
-- إصلاح جدول الفواتير: إضافة الأعمدة المفقودة
-- قم بتشغيل هذا الكود في Supabase > SQL Editor
-- =========================================================

-- 1. إضافة عمود legacy_id (للربط مع الكود القديم)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS legacy_id TEXT UNIQUE;

-- 2. إضافة رقم الفاتورة
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS number TEXT;

-- 3. إضافة تاريخ الفاتورة
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS date DATE;

-- 4. إضافة اسم العميل
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- 5. إضافة الرقم الضريبي للعميل
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_vat_number TEXT;

-- 6. إضافة بنود الفاتورة (JSONB لتخزين مصفوفة البنود)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 7. إضافة مبلغ الخصم
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- 8. إضافة خيار الضريبة الشاملة
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_tax_inclusive BOOLEAN DEFAULT TRUE;

-- 9. إنشاء index على legacy_id للبحث السريع
CREATE INDEX IF NOT EXISTS idx_invoices_legacy_id ON invoices(legacy_id);

-- 10. إضافة عمود due_date إذا لم يكن موجوداً
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;

-- التحقق من الأعمدة بعد الإضافة
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

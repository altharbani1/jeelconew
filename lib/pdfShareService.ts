/**
 * 📄 خدمة PDF الاحترافية — JilcoPdfService
 * توليد PDF من عنصر HTML ومشاركته عبر واتساب أو تحميله
 */

export interface ShareOptions {
    elementId: string;        // id للعنصر المراد تحويله لـ PDF
    fileName: string;         // اسم ملف PDF مثل: "فاتورة_INV-001"
    recipientPhone?: string;  // رقم واتساب مع كود الدولة مثل: "966501234567"
    message?: string;         // رسالة مرافقة للواتساب
    documentTitle?: string;   // عنوان المستند للمشاركة
}

export type ShareResult =
    | { status: 'shared' }         // تم المشاركة عبر Web Share API
    | { status: 'downloaded' }     // تم التحميل (fallback)
    | { status: 'whatsapp_web' }   // جاري فتح واتساب ويب
    | { status: 'error'; message: string };

/**
 * توليد PDF من عنصر HTML
 */
async function generatePdfBlob(elementId: string, fileName: string): Promise<Blob> {
    const element = document.getElementById(elementId);
    if (!element) throw new Error(`العنصر "${elementId}" غير موجود`);

    // @ts-ignore - html2canvas عبر CDN
    const canvas = await window.html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        foreignObjectRendering: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // A4 بالبيكسل عند 96 DPI: 794 × 1123
    const a4Width = 210;   // mm
    const a4Height = 297;  // mm

    // @ts-ignore - jsPDF عبر CDN
    const { jsPDF } = window.jspdf;
    const orientation = imgHeight > imgWidth ? 'p' : 'l';
    const pdf = new jsPDF(orientation, 'mm', 'a4');

    const pdfWidth = orientation === 'p' ? a4Width : a4Height;
    const pdfHeight = orientation === 'p' ? a4Height : a4Width;

    // حساب عدد الصفحات
    const ratio = imgWidth / (pdfWidth);
    const realImgHeight = imgHeight / ratio;
    let remainingHeight = realImgHeight;
    let position = 0;

    while (remainingHeight > 0) {
        if (position > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position === 0 ? 0 : -(position), pdfWidth, realImgHeight);
        position += pdfHeight;
        remainingHeight -= pdfHeight;
    }

    return pdf.output('blob');
}

/**
 * تحميل PDF مباشرة
 */
export async function downloadPdf(elementId: string, fileName: string): Promise<void> {
    const blob = await generatePdfBlob(elementId, fileName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * المشاركة الرئيسية — تجرب Web Share API أولاً ثم تتراجع للبدائل
 */
export async function shareDocument(options: ShareOptions): Promise<ShareResult> {
    const { elementId, fileName, recipientPhone, message, documentTitle } = options;

    try {
        // 1. توليد PDF
        const blob = await generatePdfBlob(elementId, fileName);
        const file = new File([blob], `${fileName}.pdf`, { type: 'application/pdf', lastModified: Date.now() });

        // 3. تجهيز رسالة الواتساب
        const defaultMessage = `مرحباً،\n\nمرفق ${documentTitle || fileName}.\n\nيُرجى مراجعته والتواصل معنا لأي استفسار.\n\nجيلكو للمصاعد 🏢`;
        const finalMessage = message ? message.trim() : defaultMessage;

        // --- محاولة استخدام Web Share API (تدعم إرفاق ملفات في الموبايل) ---
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    title: documentTitle || fileName,
                    text: finalMessage,
                    files: [file]
                });
                return { status: 'shared' };
            } catch (error: any) {
                // المستخدم ألغى المشاركة
                if (error.name === 'AbortError') {
                    return { status: 'error', message: 'تم الإلغاء' };
                }
                // في حالة فشل أخرى، نكمل للـ Fallback
                console.error('Web Share API failed', error);
            }
        }

        // --- Fallback للـ Desktop والمتصفحات غير الداعمة ---

        // 2. تحميل الملف للمستخدم (ليتمكن من إرساله يدوياً)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.pdf`;
        a.click();
        URL.revokeObjectURL(url);

        const encodedMessage = encodeURIComponent(finalMessage);

        // 4. تحديد الرابط بناءً على وجود رقم الهاتف ونوع الجهاز
        let whatsappUrl = '';
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (recipientPhone) {
            const phone = recipientPhone.replace(/[^0-9]/g, '');
            // استخدام رابط wa.me الموحد الذي يفتح التطبيق أو الويب تلقائياً
            whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
        } else {
            // في حال عدم وجود رقم، توجيه المستخدم لفتح الواتساب عام للبحث عن جهة الاتصال
            whatsappUrl = isMobile
                ? `whatsapp://send?text=${encodedMessage}`
                : `https://web.whatsapp.com/send?text=${encodedMessage}`;
        }

        // 5. محاولة فتح الرابط في نافذة جديدة
        const newWindow = window.open(whatsappUrl, '_blank');

        // Fallback إذا كان المتصفح يمنع النوافذ المنبثقة
        if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
            window.location.href = whatsappUrl;
        }

        return { status: 'whatsapp_web' };

    } catch (error: any) {
        console.error('Share Error:', error);
        return { status: 'error', message: error?.message || 'تعذر المعالجة' };
    }
}

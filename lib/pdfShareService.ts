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
        const blob = await generatePdfBlob(elementId, fileName);
        const pdfFile = new File([blob], `${fileName}.pdf`, { type: 'application/pdf' });

        // -------------------------------------------------------
        // 1️⃣ الجهاز يدعم مشاركة الملفات (موبايل بشكل رئيسي)
        // -------------------------------------------------------
        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            try {
                await navigator.share({
                    files: [pdfFile],
                    title: documentTitle || fileName,
                    text: message || `مرفق: ${documentTitle || fileName}`,
                });
                return { status: 'shared' };
            } catch (shareErr: any) {
                // إذا أغلق المستخدم نافذة المشاركة يدوياً
                if (shareErr.name === 'AbortError') return { status: 'downloaded' };
                // وإلا نتجاهل تفريعة المشاركة ونهبط للبديل Desktop/WhatsApp Web
                console.warn('Web Share API failed, falling back to Web WhatsApp', shareErr);
            }
        }

        // -------------------------------------------------------
        // 2️⃣ Desktop: تحميل PDF + فتح واتساب ويب
        // -------------------------------------------------------
        // تحميل الملف أولاً
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.pdf`;
        a.click();
        URL.revokeObjectURL(url);

        // فتح واتساب ويب مع رسالة جاهزة
        const whatsappMsg = encodeURIComponent(
            message || `مرحباً،\n\nمرفق ${documentTitle || fileName}.\n\nيُرجى مراجعته والتواصل معنا لأي استفسار.\n\nجيلكو للمصاعد 🏢`
        );

        if (recipientPhone) {
            const phone = recipientPhone.replace(/[^0-9]/g, '');
            window.open(`https://wa.me/${phone}?text=${whatsappMsg}`, '_blank');
        } else {
            window.open(`https://web.whatsapp.com/`, '_blank');
        }

        return { status: 'whatsapp_web' };

    } catch (error: any) {
        if (error?.name === 'AbortError') {
            // المستخدم أغلق قائمة المشاركة يدوياً
            return { status: 'downloaded' };
        }
        return { status: 'error', message: error?.message || 'خطأ غير متوقع' };
    }
}

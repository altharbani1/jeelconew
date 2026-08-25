import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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

async function waitForDocumentAssets(element: HTMLElement): Promise<void> {
    await document.fonts?.ready;
    const images = Array.from(element.querySelectorAll<HTMLImageElement>('img'));
    await Promise.all(images.map(async image => {
        if (!image.complete) {
            await new Promise<void>(resolve => {
                image.addEventListener('load', () => resolve(), { once: true });
                image.addEventListener('error', () => resolve(), { once: true });
            });
        }
        try { await image.decode(); } catch { /* continue if decoding is unsupported */ }
    }));
}

export async function printDocument(elementId: string): Promise<void> {
    const element = document.getElementById(elementId);
    if (!element) throw new Error(`العنصر "${elementId}" غير موجود`);
    await waitForDocumentAssets(element);
    window.print();
}

/**
 * توليد PDF من عنصر HTML
 */
async function generatePdfBlob(elementId: string, fileName: string): Promise<Blob> {
    const element = document.getElementById(elementId);
    if (!element) throw new Error(`العنصر "${elementId}" غير موجود`);

    await waitForDocumentAssets(element);

    // عروض الأسعار تتكون من صفحات A4 مستقلة. تصوير كل صفحة على حدة
    // يمنع الصفحة البيضاء والملف الضخم الناتجين عن تصوير الحاوية كاملة.
    const pages = Array.from(element.querySelectorAll<HTMLElement>('.a4-page'));
    const targets = pages.length > 0 ? pages : [element];
    const pdf = new jsPDF('p', 'mm', 'a4');

    for (let index = 0; index < targets.length; index += 1) {
        const canvas = await html2canvas(targets[index], {
            scale: Math.min(window.devicePixelRatio || 1, 2),
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
            foreignObjectRendering: false,
        });

        if (index > 0) pdf.addPage('a4', 'p');
        const image = canvas.toDataURL('image/jpeg', 0.92);
        const renderedHeight = Math.min(297, (canvas.height * 210) / canvas.width);
        pdf.addImage(image, 'JPEG', 0, 0, 210, renderedHeight, undefined, 'FAST');
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
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);

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

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
    | { status: 'manual_attachment'; whatsappUrl: string; whatsappOpened: boolean }
    | { status: 'error'; message: string };

/** Find a page break between rendered text lines or before an image. */
function getSafePageEnd(target: HTMLElement, canvas: HTMLCanvasElement, start: number, pageHeight: number): number {
    const idealEnd = Math.min(start + pageHeight, canvas.height);
    if (idealEnd === canvas.height) return idealEnd;

    const targetRect = target.getBoundingClientRect();
    const scale = canvas.width / targetRect.width;
    const occupied: Array<{ top: number; bottom: number }> = [];
    const addRect = (rect: DOMRect) => {
        if (rect.width <= 0 || rect.height <= 0) return;
        occupied.push({
            top: Math.max(0, (rect.top - targetRect.top) * scale),
            bottom: Math.min(canvas.height, (rect.bottom - targetRect.top) * scale)
        });
    };

    // Range rectangles describe individual text lines, including wrapped Arabic
    // paragraphs. Element rectangles alone would treat an entire paragraph as
    // one indivisible block and leave large blank parts of a PDF page.
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    let textNode: Node | null;
    while ((textNode = walker.nextNode())) {
        if (!textNode.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(textNode);
        for (const rect of Array.from(range.getClientRects())) addRect(rect);
    }
    for (const image of Array.from(target.querySelectorAll('img'))) addRect(image.getBoundingClientRect());

    // Never extend a slice beyond A4. Move its end up to a gap when a glyph or
    // image crosses the intended cut, leaving that content for the next page.
    let safeEnd = idealEnd;
    for (let attempt = 0; attempt < occupied.length; attempt += 1) {
        const crossing = occupied.find(({ top, bottom }) => top < safeEnd + 2 && bottom > safeEnd - 2);
        if (!crossing) break;
        safeEnd = Math.floor(crossing.top) - 3;
    }
    return safeEnd >= start + pageHeight * 0.7 ? safeEnd : idealEnd;
}

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

    let pdfPageIndex = 0;
    for (let index = 0; index < targets.length; index += 1) {
        const canvas = await html2canvas(targets[index], {
            // A4 at 2.5x is about 240 dpi. Lossless PNG keeps small Arabic
            // glyphs and fine borders sharp when the PDF is printed.
            scale: 2.5,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
            foreignObjectRendering: false,
        });

        // A quote section can grow beyond one A4 sheet when editable terms or
        // obligations are long. Slice tall canvases into page-sized images so
        // exporting never squeezes or silently drops their lower content.
        const pageCanvasHeight = Math.floor((canvas.width * 297) / 210);
        for (let y = 0; y < canvas.height;) {
            const pageEnd = getSafePageEnd(targets[index], canvas, y, pageCanvasHeight);
            const sliceHeight = pageEnd - y;
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = sliceHeight;
            const context = pageCanvas.getContext('2d');
            if (!context) throw new Error('تعذر تجهيز صفحة PDF');
            context.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

            if (pdfPageIndex > 0) pdf.addPage('a4', 'p');
            pdfPageIndex += 1;
            const image = pageCanvas.toDataURL('image/png');
            const renderedHeight = (sliceHeight * 210) / canvas.width;
            pdf.addImage(image, 'PNG', 0, 0, 210, renderedHeight, undefined, 'FAST');
            y = pageEnd;
        }
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
        const defaultMessage = `مرحباً،\n\nيرجى مراجعة ${documentTitle || fileName} والتواصل معنا لأي استفسار.\n\nجيلكو للمصاعد 🏢`;
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

        // A blocked popup must not navigate away from an unsaved quote draft.
        // The caller offers a direct link and explains that the PDF still needs
        // to be attached manually before the user sends the WhatsApp message.
        const whatsappOpened = Boolean(newWindow && !newWindow.closed);
        return { status: 'manual_attachment', whatsappUrl, whatsappOpened };

    } catch (error: any) {
        console.error('Share Error:', error);
        return { status: 'error', message: error?.message || 'تعذر المعالجة' };
    }
}

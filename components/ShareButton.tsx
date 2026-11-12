import React, { useState, useRef, useEffect } from 'react';
import { Share2, Download, MessageCircle, X, Loader2, CheckCircle, AlertCircle, Phone } from 'lucide-react';
import { shareDocument, downloadPdf } from '../lib/pdfShareService';

interface ShareButtonProps {
    language?: string;
    elementId: string;         // id العنصر المراد تحويله
    fileName: string;          // اسم الملف بدون امتداد
    documentTitle?: string;    // عنوان المستند
    recipientPhone?: string;   // رقم الهاتف (اختياري)
    recipientName?: string;    // اسم المستلم للرسالة
    documentType?: 'quote' | 'invoice' | 'receipt' | 'contract';
    className?: string;
}

const DOC_LABELS: Record<string, string> = {
    quote: 'عرض السعر',
    invoice: 'الفاتورة',
    receipt: 'سند القبض',
    contract: 'العقد',
};

const DOC_MESSAGES: Record<string, (name: string, title: string) => string> = {
    quote: (name, title) =>
        `🏢 *جيلكو للمصاعد*\n\nالسلام عليكم ${name ? `${name} ` : ''}☀️\n\nنرجو مراجعة ${title} وإفادتنا لاعتماده.\n\nنرحب بأي استفسار.\n\n📞 للتواصل: شركة جيلكو للمصاعد`,
    invoice: (name, title) =>
        `🏢 *جيلكو للمصاعد*\n\nالسلام عليكم ${name ? `${name} ` : ''}☀️\n\nيُرجى مراجعة ${title} وإفادتنا بأي ملاحظة.\n\n📞 للتواصل: شركة جيلكو للمصاعد`,
    receipt: (name, title) =>
        `🏢 *جيلكو للمصاعد*\n\nالسلام عليكم ${name ? `${name} ` : ''}☀️\n\nيُرجى مراجعة ${title}.\n\nشكراً لثقتكم بنا 🙏\n\n📞 للتواصل: شركة جيلكو للمصاعد`,
    contract: (name, title) =>
        `🏢 *جيلكو للمصاعد*\n\nالسلام عليكم ${name ? `${name} ` : ''}☀️\n\nيُرجى مراجعة ${title} والإفادة.\n\n📞 للتواصل: شركة جيلكو للمصاعد`,
};

export const ShareButton: React.FC<ShareButtonProps> = ({
    language = "ar",
    elementId,
    fileName,
    documentTitle,
    recipientPhone: defaultPhone = '',
    recipientName = '',
    documentType = 'invoice',
    className = '',
}) => {
    const copy = (ar: string, en: string) => language === "en" ? en : ar;
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'manual' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [phone, setPhone] = useState(defaultPhone);
    const [feedback, setFeedback] = useState('');
    const [whatsappLink, setWhatsappLink] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const label = DOC_LABELS[documentType] || 'المستند';
    const autoMessage = language === "en" ? `Hello ${recipientName || "there"}, please find ${documentTitle || "the document"} attached.` : (DOC_MESSAGES[documentType] || DOC_MESSAGES.invoice)(
        recipientName,
        documentTitle || label
    );

    useEffect(() => {
        setMessage(autoMessage);
    }, [autoMessage]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        };
    }, []);

    const handleShare = async (type: 'whatsapp' | 'download') => {
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        setStatus('loading');
        setIsOpen(false);
        setFeedback('');
        setWhatsappLink('');

        try {
            if (type === 'download') {
                await downloadPdf(elementId, fileName);
                setStatus('success');
                setFeedback(copy("تم تنزيل ملف PDF.", "PDF downloaded."));
                feedbackTimerRef.current = setTimeout(() => setStatus('idle'), 3000);
                return;
            }

            const result = await shareDocument({
                elementId,
                fileName,
                recipientPhone: phone || undefined,
                message,
                documentTitle: documentTitle || label,
            });

            if (result.status === 'error') {
                setStatus('error');
                setFeedback(copy(result.message, "Could not share the document. Try downloading the PDF."));
                feedbackTimerRef.current = setTimeout(() => setStatus('idle'), 4000);
            } else if (result.status === 'manual_attachment') {
                setStatus('manual');
                setWhatsappLink(result.whatsappUrl);
                setFeedback(result.whatsappOpened
                    ? copy("تم تنزيل PDF وفتح واتساب. أرفق الملف يدويًا قبل إرسال الرسالة.", "The PDF was downloaded and WhatsApp was opened. Attach the file before sending.")
                    : copy("تم تنزيل PDF، لكن تعذر فتح واتساب تلقائيًا. افتحه من الرابط وأرفق الملف يدويًا.", "The PDF was downloaded. Open WhatsApp from the link and attach the file."));
            } else {
                setStatus('success');
                setFeedback(copy("اكتملت المشاركة عبر تطبيق جهازك.", "Shared using your device."));
                feedbackTimerRef.current = setTimeout(() => setStatus('idle'), 3000);
            }
        } catch (error) {
            setStatus('error');
            setFeedback(copy(error instanceof Error ? error.message : "تعذر تجهيز المستند.", "Could not prepare the document."));
            feedbackTimerRef.current = setTimeout(() => setStatus('idle'), 4000);
        }
    };

    // ======= Render =======
    const isLoading = status === 'loading';

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>

            {/* زر الإرسال الرئيسي */}
            <button
                onClick={() => !isLoading && setIsOpen(o => !o)}
                disabled={isLoading}
                aria-expanded={isOpen}
                title={copy("مشاركة المستند", "Share document")}
                className={`
          flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm shadow-lg transition-all duration-200
          ${isLoading
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : status === 'success'
                            ? 'bg-green-600 text-white'
                            : status === 'error'
                                ? 'bg-red-500 text-white'
                            : status === 'manual'
                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                : 'bg-[#25D366] hover:bg-[#1da851] active:scale-95 text-white'
                    }
        `}
            >
                {isLoading
                    ? <Loader2 size={16} className="animate-spin" />
                    : status === 'success'
                        ? <CheckCircle size={16} />
                        : status === 'error'
                            ? <AlertCircle size={16} />
                            : status === 'manual'
                                ? <AlertCircle size={16} />
                            : (
                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.528 5.858L0 24l6.335-1.658A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.017-1.376l-.36-.214-3.734.979.994-3.634-.235-.374A9.818 9.818 0 1112 21.818z" />
                                </svg>
                            )
                }
                <span>
                    {isLoading ? copy("جاري التحضير...", "Preparing…") : status === 'success' ? copy("تم ✓", "Done") : status === 'manual' ? copy("أرفق PDF", "Attach PDF") : status === 'error' ? copy("خطأ!", "Error") : copy("إرسال", "Share")}
                </span>
            </button>

            {feedback && status !== 'loading' && (
                <div role="status" className={`mt-2 max-w-80 rounded-xl p-3 text-xs font-bold shadow-sm ${status === 'error' ? 'bg-red-50 text-red-700' : status === 'manual' ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'}`}>
                    {feedback}
                    {status === 'manual' && whatsappLink && (
                        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="mt-2 block underline">{copy("فتح واتساب", "Open WhatsApp")}</a>
                    )}
                </div>
            )}

            {/* الدرابدون */}
            {isOpen && (
                <div className="fixed inset-x-4 top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 sm:end-0 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[9999] animate-in">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#25D366] to-[#128C7E] p-4 text-white">
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-black text-base flex items-center gap-2">
                                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.528 5.858L0 24l6.335-1.658A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.017-1.376l-.36-.214-3.734.979.994-3.634-.235-.374A9.818 9.818 0 1112 21.818z" />
                                </svg>
                                {copy("إرسال عبر واتساب", "Share via WhatsApp")}
                            </span>
                            <button title={copy("إغلاق نافذة المشاركة", "Close sharing options")} onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                        <p className="text-white/80 text-xs">{documentTitle || label}</p>
                    </div>

                    <div className="p-4 space-y-3">
                        {/* رقم الهاتف */}
                        <div>
                            <label className="text-[11px] font-black text-gray-700 mb-1 flex items-center gap-1">
                                <Phone size={11} /> {copy("رقم الواتساب (اختياري)", "WhatsApp number (optional)")}
                            </label>
                            <input
                                type="tel"
                                title={copy("رقم واتساب مع كود الدولة", "WhatsApp number with country code")}
                                placeholder="966501234567"
                                value={phone}
                                onChange={e => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 bg-white font-mono font-bold outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366] text-left placeholder-gray-400"
                                dir="ltr"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">{copy("بدون + أو 00 — مثال: 966501234567", "Omit + or 00. Example: 966501234567")}</p>
                        </div>

                        {/* الرسالة */}
                        <div>
                            <label className="text-[11px] font-black text-gray-700 mb-1 flex items-center gap-1">
                                <MessageCircle size={11} /> {copy("نص الرسالة", "Message")}
                            </label>
                            <textarea
                                title={copy("نص الرسالة المرفقة", "Message to send")}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                rows={4}
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs text-gray-900 bg-white font-bold outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366] resize-none leading-relaxed"
                            />
                        </div>

                        {/* أزرار الإجراءات */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                                title={copy("إرسال عبر واتساب", "Share via WhatsApp")}
                                onClick={() => handleShare('whatsapp')}
                                className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1da851] text-white py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 shadow-md"
                            >
                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.528 5.858L0 24l6.335-1.658A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.017-1.376l-.36-.214-3.734.979.994-3.634-.235-.374A9.818 9.818 0 1112 21.818z" />
                                </svg>
                                WhatsApp
                            </button>
                            <button
                                title={copy("تحميل المستند كملف PDF", "Download document as PDF")}
                                onClick={() => handleShare('download')}
                                className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-black text-white py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 shadow-md"
                            >
                                <Download size={15} />
                                {copy("تحميل PDF", "Download PDF")}
                            </button>
                        </div>

                        {/* ملاحظة طريقة العمل */}
                        <div className="bg-blue-50 rounded-xl p-3 text-[10px] text-blue-700 font-bold leading-relaxed">
                            {copy("على الهاتف، تفتح قائمة المشاركة. على الكمبيوتر، أرفق ملف PDF في واتساب بعد تنزيله.", "On a phone, the share menu opens. On a computer, attach the downloaded PDF in WhatsApp.")}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

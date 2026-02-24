import React, { useState, useRef, useEffect } from 'react';
import { Share2, Download, MessageCircle, X, Loader2, CheckCircle, AlertCircle, Phone } from 'lucide-react';
import { shareDocument, downloadPdf } from '../lib/pdfShareService';

interface ShareButtonProps {
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
        `🏢 *جيلكو للمصاعد*\n\nالسلام عليكم ${name ? `${name} ` : ''}☀️\n\nنُرفق لكم ${title} للمراجعة والاعتماد.\n\nنرحب بأي استفسار.\n\n📞 للتواصل: شركة جيلكو للمصاعد`,
    invoice: (name, title) =>
        `🏢 *جيلكو للمصاعد*\n\nالسلام عليكم ${name ? `${name} ` : ''}☀️\n\nمرفق ${title}.\n\nيُرجى الاطلاع عليها وإفادتنا بأي ملاحظة.\n\n📞 للتواصل: شركة جيلكو للمصاعد`,
    receipt: (name, title) =>
        `🏢 *جيلكو للمصاعد*\n\nالسلام عليكم ${name ? `${name} ` : ''}☀️\n\nمرفق ${title}.\n\nشكراً لثقتكم بنا 🙏\n\n📞 للتواصل: شركة جيلكو للمصاعد`,
    contract: (name, title) =>
        `🏢 *جيلكو للمصاعد*\n\nالسلام عليكم ${name ? `${name} ` : ''}☀️\n\nمرفق ${title}.\n\nيُرجى المراجعة والإفادة.\n\n📞 للتواصل: شركة جيلكو للمصاعد`,
};

export const ShareButton: React.FC<ShareButtonProps> = ({
    elementId,
    fileName,
    documentTitle,
    recipientPhone: defaultPhone = '',
    recipientName = '',
    documentType = 'invoice',
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [phone, setPhone] = useState(defaultPhone);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const label = DOC_LABELS[documentType] || 'المستند';
    const autoMessage = (DOC_MESSAGES[documentType] || DOC_MESSAGES.invoice)(
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
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleShare = async (type: 'whatsapp' | 'download') => {
        setStatus('loading');
        setIsOpen(false);

        try {
            if (type === 'download') {
                await downloadPdf(elementId, fileName);
                setStatus('success');
                setTimeout(() => setStatus('idle'), 3000);
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
                setTimeout(() => setStatus('idle'), 4000);
            } else {
                setStatus('success');
                setTimeout(() => setStatus('idle'), 3000);
            }
        } catch {
            setStatus('error');
            setTimeout(() => setStatus('idle'), 4000);
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
                title="مشاركة المستند"
                className={`
          flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm shadow-lg transition-all duration-200
          ${isLoading
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : status === 'success'
                            ? 'bg-green-600 text-white'
                            : status === 'error'
                                ? 'bg-red-500 text-white'
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
                            : (
                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.528 5.858L0 24l6.335-1.658A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.017-1.376l-.36-.214-3.734.979.994-3.634-.235-.374A9.818 9.818 0 1112 21.818z" />
                                </svg>
                            )
                }
                <span>
                    {isLoading ? 'جاري التحضير...' : status === 'success' ? 'تم ✓' : status === 'error' ? 'خطأ!' : 'إرسال'}
                </span>
            </button>

            {/* الدرابدون */}
            {isOpen && (
                <div className="absolute top-full mt-2 left-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden animate-in">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#25D366] to-[#128C7E] p-4 text-white">
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-black text-base flex items-center gap-2">
                                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.528 5.858L0 24l6.335-1.658A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.017-1.376l-.36-.214-3.734.979.994-3.634-.235-.374A9.818 9.818 0 1112 21.818z" />
                                </svg>
                                إرسال عبر واتساب
                            </span>
                            <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                        <p className="text-white/80 text-xs">{documentTitle || label}</p>
                    </div>

                    <div className="p-4 space-y-3">
                        {/* رقم الهاتف */}
                        <div>
                            <label className="text-[11px] font-black text-gray-500 mb-1 flex items-center gap-1">
                                <Phone size={11} /> رقم الواتساب (اختياري)
                            </label>
                            <input
                                type="tel"
                                title="رقم واتساب مع كود الدولة"
                                placeholder="966501234567"
                                value={phone}
                                onChange={e => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                                className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-mono font-bold outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] text-left"
                                dir="ltr"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">بدون + أو 00 — مثال: 966501234567</p>
                        </div>

                        {/* الرسالة */}
                        <div>
                            <label className="text-[11px] font-black text-gray-500 mb-1 flex items-center gap-1">
                                <MessageCircle size={11} /> نص الرسالة
                            </label>
                            <textarea
                                title="نص الرسالة المرفقة"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                rows={4}
                                className="w-full p-2.5 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] resize-none leading-relaxed"
                            />
                        </div>

                        {/* أزرار الإجراءات */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                                onClick={() => handleShare('whatsapp')}
                                className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1da851] text-white py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 shadow-md"
                            >
                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.528 5.858L0 24l6.335-1.658A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.017-1.376l-.36-.214-3.734.979.994-3.634-.235-.374A9.818 9.818 0 1112 21.818z" />
                                </svg>
                                واتساب
                            </button>
                            <button
                                onClick={() => handleShare('download')}
                                className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-black text-white py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 shadow-md"
                            >
                                <Download size={15} />
                                تحميل PDF
                            </button>
                        </div>

                        {/* ملاحظة طريقة العمل */}
                        <div className="bg-blue-50 rounded-xl p-3 text-[10px] text-blue-700 font-bold leading-relaxed">
                            📱 <strong>موبايل:</strong> تفتح قائمة المشاركة مباشرة<br />
                            💻 <strong>كمبيوتر:</strong> يُحمَّل PDF ويفتح واتساب ويب
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

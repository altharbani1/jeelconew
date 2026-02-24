
import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Upload, Trash2, Download, Eye, AlertTriangle, Calendar, Search, Filter, Plus, FileCheck, CheckCircle2, XCircle, Printer, X, Send } from 'lucide-react';
import { CompanyDocument, DocumentCategory, CompanyConfig } from '../types';
import { useData } from '../contexts/DataContext.tsx';
import { useProject } from '../contexts/ProjectContext.tsx';

const CATEGORIES: { id: DocumentCategory; label: string; color: string }[] = [
    { id: 'gov', label: 'حكومية وتراخيص', color: 'bg-blue-100 text-blue-700' },
    { id: 'contract', label: 'عقود واتفاقيات', color: 'bg-purple-100 text-purple-700' },
    { id: 'employee', label: 'وثائق موظفين', color: 'bg-green-100 text-green-700' },
    { id: 'project', label: 'مستندات مشاريع', color: 'bg-amber-100 text-amber-700' },
    { id: 'other', label: 'أخرى', color: 'bg-gray-100 text-gray-700' },
];

const INITIAL_CONFIG: CompanyConfig = {
    logo: null, stamp: null, headerTitle: 'جيلكو للمصاعد', headerSubtitle: '', footerText: '', contactPhone: '', contactEmail: '', bankAccounts: []
};

export const DocumentsModule: React.FC = () => {
    const { config: globalConfig } = useData();
    const { documents, saveProjectRecord, deleteProjectRecord } = useProject();

    const [viewMode, setViewMode] = useState<'list' | 'upload' | 'report'>('list');
    const [filterCategory, setFilterCategory] = useState<DocumentCategory | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [config, setConfig] = useState<CompanyConfig>(INITIAL_CONFIG);

    // Form State
    const [newDoc, setNewDoc] = useState<Partial<CompanyDocument>>({ category: 'gov' });

    // Preview State
    const [previewDoc, setPreviewDoc] = useState<CompanyDocument | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Load Config
    useEffect(() => {
        if (globalConfig) {
            setConfig(globalConfig);
        } else {
            const savedConfig = localStorage.getItem('jilco_quote_data');
            if (savedConfig) {
                try {
                    const parsed = JSON.parse(savedConfig);
                    if (parsed.config) setConfig(parsed.config);
                } catch (e) { }
            }
        }
    }, [globalConfig]);

    // Handle Blob URL generation for preview to fix "Not Showing" issues with Data URIs
    useEffect(() => {
        if (previewDoc && previewDoc.fileUrl) {
            try {
                // If it's a data URL, convert to Blob for better iframe compatibility
                if (previewDoc.fileUrl.startsWith('data:')) {
                    const byteString = atob(previewDoc.fileUrl.split(',')[1]);
                    const mimeString = previewDoc.fileUrl.split(',')[0].split(':')[1].split(';')[0];
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }
                    const blob = new Blob([ab], { type: mimeString });
                    const url = URL.createObjectURL(blob);
                    setPreviewUrl(url);
                    return () => URL.revokeObjectURL(url);
                } else {
                    setPreviewUrl(previewDoc.fileUrl);
                }
            } catch (e) {
                console.error("Preview generation error:", e);
                setPreviewUrl(previewDoc.fileUrl);
            }
        } else {
            setPreviewUrl(null);
        }
    }, [previewDoc]);

    // Helpers
    const getDaysRemaining = (expiryDate?: string) => {
        if (!expiryDate) return null;
        const today = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const getStatusColor = (expiryDate?: string) => {
        if (!expiryDate) return 'text-gray-500';
        const days = getDaysRemaining(expiryDate);
        if (days === null) return 'text-gray-500';
        if (days < 0) return 'text-red-600 bg-red-50 border-red-200';
        if (days < 30) return 'text-amber-600 bg-amber-50 border-amber-200';
        return 'text-green-600 bg-green-50 border-green-200';
    };

    const getStatusLabel = (expiryDate?: string) => {
        if (!expiryDate) return 'دائم';
        const days = getDaysRemaining(expiryDate);
        if (days === null) return '-';
        if (days < 0) return 'منتهي الصلاحية';
        if (days < 30) return `ينتهي خلال ${days} يوم`;
        return `ساري (${days} يوم)`;
    };

    // Actions
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Size Check (Limit to 2MB for localStorage safety to prevent crash)
            if (file.size > 2 * 1024 * 1024) {
                alert("حجم الملف كبير جداً. يرجى اختيار ملف أصغر من 2 ميجابايت لتجنب امتلاء الذاكرة.");
                return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setNewDoc({
                        ...newDoc,
                        fileName: file.name,
                        fileType: file.type.includes('image') ? 'image' : 'pdf',
                        fileUrl: ev.target.result as string
                    });
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const saveDocument = async () => {
        if (!newDoc.title || !newDoc.fileUrl) {
            alert('الرجاء إدخال عنوان الوثيقة ورفع الملف.');
            return;
        }

        const doc: CompanyDocument = {
            id: `DOC-${Date.now()}`,
            title: newDoc.title,
            category: newDoc.category as DocumentCategory,
            issueDate: newDoc.issueDate,
            expiryDate: newDoc.expiryDate,
            referenceNumber: newDoc.referenceNumber,
            fileUrl: newDoc.fileUrl,
            fileName: newDoc.fileName || 'file',
            fileType: newDoc.fileType || 'pdf',
            notes: newDoc.notes,
            createdAt: new Date().toISOString()
        };

        // Save to real-time and local DB
        await saveProjectRecord('jilco_documents', doc.id, doc);
        setNewDoc({ category: 'gov' });
        setViewMode('list');
    };

    const deleteDocument = async (id: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذه الوثيقة؟')) {
            await deleteProjectRecord('jilco_documents', id);
        }
    };

    const handleDownload = (doc: CompanyDocument) => {
        const link = document.createElement('a');
        link.href = doc.fileUrl;
        link.download = doc.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSend = (doc: CompanyDocument) => {
        alert(`تم إرسال المستند "${doc.title}" بنجاح.`);
        // In a real app, this would integrate with email API or WhatsApp
    };

    const filteredDocuments = useMemo(() => {
        return documents.filter(d => {
            const matchesSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase()) || d.referenceNumber?.includes(searchTerm);
            const matchesCat = filterCategory === 'all' || d.category === filterCategory;
            return matchesSearch && matchesCat;
        });
    }, [documents, searchTerm, filterCategory]);

    const stats = useMemo(() => {
        const total = documents.length;
        const expired = documents.filter(d => d.expiryDate && getDaysRemaining(d.expiryDate)! < 0).length;
        const expiringSoon = documents.filter(d => {
            const days = getDaysRemaining(d.expiryDate);
            return days !== null && days >= 0 && days <= 30;
        }).length;
        return { total, expired, expiringSoon };
    }, [documents]);

    // --- Renderers ---

    const renderPreviewModal = () => {
        if (!previewDoc || !previewUrl) return null;
        return (
            <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                            {previewDoc.fileType === 'image' ? <Eye size={20} /> : <FileText size={20} />}
                            {previewDoc.title}
                        </h3>
                        <button onClick={() => setPreviewDoc(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-600"><X size={20} /></button>
                    </div>
                    <div className="flex-1 bg-gray-100 overflow-auto p-4 flex justify-center items-center h-[600px]">
                        {previewDoc.fileType === 'image' ? (
                            <img src={previewUrl} alt={previewDoc.title} className="max-w-full max-h-full object-contain rounded shadow-lg" />
                        ) : (
                            <iframe
                                src={previewUrl}
                                className="w-full h-full border-none rounded shadow-lg bg-white"
                                title={previewDoc.title}
                            ></iframe>
                        )}
                    </div>
                    <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
                        <button onClick={() => handleSend(previewDoc)} className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 flex items-center gap-2">
                            <Send size={16} /> إرسال
                        </button>
                        <a href={previewDoc.fileUrl} download={previewDoc.fileName} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 flex items-center gap-2">
                            <Download size={16} /> تحميل الملف
                        </a>
                        <button onClick={() => setPreviewDoc(null)} className="px-4 py-2 bg-white border border-gray-300 rounded font-bold hover:bg-gray-100">إغلاق</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderUploadForm = () => (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-jilco-900 flex items-center gap-2">
                        <Upload size={20} className="text-gold-500" /> إضافة وثيقة جديدة
                    </h3>
                    <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-200 rounded-full"><XCircle size={20} /></button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-700 mb-1">عنوان الوثيقة <span className="text-red-500">*</span></label>
                            <input type="text" value={newDoc.title || ''} onChange={e => setNewDoc({ ...newDoc, title: e.target.value })} className="w-full p-2 border border-gray-400 rounded-lg text-sm focus:ring-2 focus:ring-jilco-500 outline-none text-black bg-white font-bold" placeholder="مثال: السجل التجاري" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">التصنيف</label>
                            <select value={newDoc.category} onChange={e => setNewDoc({ ...newDoc, category: e.target.value as DocumentCategory })} className="w-full p-2 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold">
                                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">رقم المرجع (اختياري)</label>
                            <input type="text" value={newDoc.referenceNumber || ''} onChange={e => setNewDoc({ ...newDoc, referenceNumber: e.target.value })} className="w-full p-2 border border-gray-400 rounded-lg text-sm text-black bg-white font-bold" placeholder="رقم الرخصة / العقد" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">تاريخ الإصدار</label>
                            <input type="date" value={newDoc.issueDate || ''} onChange={e => setNewDoc({ ...newDoc, issueDate: e.target.value })} className="w-full p-2 border border-gray-400 rounded-lg text-sm text-black bg-white font-bold" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">تاريخ الانتهاء (للتنبيهات)</label>
                            <input type="date" value={newDoc.expiryDate || ''} onChange={e => setNewDoc({ ...newDoc, expiryDate: e.target.value })} className="w-full p-2 border border-gray-400 rounded-lg text-sm text-black bg-white font-bold" />
                        </div>
                    </div>

                    <div className="border-2 border-dashed border-gray-400 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                        {newDoc.fileName ? (
                            <div className="flex items-center justify-center gap-2 text-green-600 font-black">
                                <FileCheck size={24} />
                                <span>{newDoc.fileName}</span>
                                <button onClick={() => setNewDoc({ ...newDoc, fileUrl: '', fileName: '' })} className="text-red-500 hover:text-red-700 text-xs underline mr-2 font-bold">إزالة</button>
                            </div>
                        ) : (
                            <label className="cursor-pointer block">
                                <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                                <span className="text-sm font-black text-gray-700">اضغط لرفع الملف (PDF أو صورة)</span>
                                <p className="text-[10px] text-gray-400 mt-1 font-bold">الحد الأقصى 2 ميجابايت</p>
                                <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />
                            </label>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات</label>
                        <textarea value={newDoc.notes || ''} onChange={e => setNewDoc({ ...newDoc, notes: e.target.value })} className="w-full p-2 border border-gray-400 rounded-lg text-sm h-20 resize-none text-black bg-white font-bold" placeholder="أي تفاصيل إضافية..." />
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                    <button onClick={() => setViewMode('list')} className="px-6 py-2 rounded-lg text-gray-600 font-bold hover:bg-gray-200">إلغاء</button>
                    <button onClick={saveDocument} className="px-6 py-2 rounded-lg bg-jilco-600 text-white font-bold hover:bg-jilco-700 flex items-center gap-2">
                        <CheckCircle2 size={18} /> حفظ الوثيقة
                    </button>
                </div>
            </div>
        </div>
    );

    const renderReportView = () => (
        <div className="flex-1 bg-gray-200 p-8 overflow-auto flex justify-center items-start print:p-0 print:bg-white print:overflow-visible print:block print:absolute print:top-0 print:left-0 print:w-full print:h-full print:z-[200]">
            <div className="bg-white shadow-xl w-[210mm] min-h-[297mm] p-0 relative flex flex-col print:shadow-none print:w-full">
                <div className="px-10 py-6 border-b-2 border-jilco-900 flex justify-between items-center">
                    <div className="w-1/3 text-right">
                        <h1 className="text-xl font-black text-jilco-900">{config.headerTitle}</h1>
                        <p className="text-xs font-bold text-gray-500">{config.headerSubtitle}</p>
                    </div>
                    <div className="w-1/3 text-center">
                        <h2 className="text-2xl font-black text-black border-2 border-black px-4 py-1 inline-block rounded-lg uppercase">سجل الوثائق</h2>
                    </div>
                    <div className="w-1/3 text-left">
                        <p className="text-xs font-bold text-gray-500">تاريخ الطباعة</p>
                        <p className="font-mono text-sm">{new Date().toLocaleDateString('ar-SA')}</p>
                    </div>
                </div>

                <div className="px-10 py-6 flex-1">
                    <table className="w-full text-sm border-collapse border border-gray-300">
                        <thead>
                            <tr className="bg-gray-100 text-gray-800 font-bold">
                                <th className="p-3 border border-gray-300 w-10 text-center">#</th>
                                <th className="p-3 border border-gray-300 text-right">عنوان الوثيقة</th>
                                <th className="p-3 border border-gray-300 text-center">التصنيف</th>
                                <th className="p-3 border border-gray-300 text-center">رقم المرجع</th>
                                <th className="p-3 border border-gray-300 text-center">الانتهاء</th>
                                <th className="p-3 border border-gray-300 text-center">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {documents.map((doc, idx) => {
                                const statusColor = getStatusColor(doc.expiryDate);
                                return (
                                    <tr key={doc.id} className="border border-gray-300">
                                        <td className="p-2 border border-gray-300 text-center font-bold">{idx + 1}</td>
                                        <td className="p-2 border border-gray-300 font-bold">{doc.title}</td>
                                        <td className="p-2 border border-gray-300 text-center font-bold">{CATEGORIES.find(c => c.id === doc.category)?.label}</td>
                                        <td className="p-2 border border-gray-300 text-center font-mono font-bold">{doc.referenceNumber || '-'}</td>
                                        <td className="p-2 border border-gray-300 text-center font-mono font-bold">{doc.expiryDate || 'دائم'}</td>
                                        <td className={`p-2 border border-gray-300 text-center font-black text-xs ${statusColor.split(' ')[0]}`}>
                                            {getStatusLabel(doc.expiryDate)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="mt-auto px-10 pb-6 print:block hidden">
                    <div className="border-t border-gray-300 pt-4 text-center text-xs text-gray-500 font-bold">
                        {config.footerText}
                    </div>
                </div>
            </div>

            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 print:hidden">
                <button onClick={() => window.print()} className="bg-jilco-900 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-black flex items-center gap-2">
                    <Printer size={18} /> طباعة
                </button>
                <button onClick={() => setViewMode('list')} className="bg-white text-gray-700 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-gray-50 flex items-center gap-2">
                    <XCircle size={18} /> إغلاق
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in relative">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                            <FileText className="text-gold-500" /> الوثائق والمستندات
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">أرشفة ومتابعة الوثائق الحكومية والعقود والملفات الإدارية</p>
                    </div>
                    <button onClick={() => { setNewDoc({ category: 'gov' }); setViewMode('upload'); }} className="bg-jilco-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md">
                        <Plus size={20} /> إضافة وثيقة
                    </button>
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-500 mb-1">إجمالي الوثائق</p>
                            <h3 className="text-2xl font-black text-jilco-900">{stats.total}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><FileText size={24} /></div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-amber-600 mb-1">تنتهي قريباً (30 يوم)</p>
                            <h3 className="text-2xl font-black text-amber-600">{stats.expiringSoon}</h3>
                        </div>
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><Calendar size={24} /></div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-red-600 mb-1">منتهية الصلاحية</p>
                            <h3 className="text-2xl font-black text-red-600">{stats.expired}</h3>
                        </div>
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg"><AlertTriangle size={24} /></div>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text" placeholder="بحث باسم الوثيقة..."
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black bg-white font-bold"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400" />
                        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)} className="p-2 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold outline-none">
                            <option value="all">جميع التصنيفات</option>
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                    </div>
                    <button onClick={() => setViewMode('report')} className="bg-gray-100 text-gray-700 border border-gray-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-200 flex items-center gap-2">
                        <Printer size={16} /> طباعة سجل
                    </button>
                </div>

                {/* Documents Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDocuments.map(doc => {
                        const statusClass = getStatusColor(doc.expiryDate);
                        const categoryLabel = CATEGORIES.find(c => c.id === doc.category)?.label;

                        return (
                            <div key={doc.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all relative group flex flex-col">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                                        {doc.fileType === 'image' ? <Eye className="text-blue-500" size={20} /> : <FileText className="text-red-500" size={20} />}
                                    </div>
                                    <span className={`text-[10px] px-2 py-1 rounded-full border font-bold ${statusClass}`}>
                                        {getStatusLabel(doc.expiryDate)}
                                    </span>
                                </div>

                                <h3 className="font-bold text-gray-900 text-base mb-1 truncate" title={doc.title}>{doc.title}</h3>
                                <p className="text-xs text-gray-500 mb-3 font-bold">{categoryLabel}</p>

                                {doc.referenceNumber && (
                                    <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200 text-xs font-mono text-black font-bold">
                                        Ref: {doc.referenceNumber}
                                    </div>
                                )}

                                <div className="flex gap-2 mt-auto pt-4 border-t border-gray-50">
                                    <button
                                        onClick={() => setPreviewDoc(doc)}
                                        className="flex-1 py-2 bg-jilco-50 text-jilco-700 text-xs font-bold rounded hover:bg-jilco-100 flex items-center justify-center gap-1 transition-colors"
                                        title="معاينة"
                                    >
                                        <Eye size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDownload(doc)}
                                        className="flex-1 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded hover:bg-blue-100 flex items-center justify-center gap-1 transition-colors"
                                        title="تحميل"
                                    >
                                        <Download size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleSend(doc)}
                                        className="flex-1 py-2 bg-green-50 text-green-700 text-xs font-bold rounded hover:bg-green-100 flex items-center justify-center gap-1 transition-colors"
                                        title="إرسال"
                                    >
                                        <Send size={14} />
                                    </button>
                                    <button onClick={() => deleteDocument(doc.id)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded" title="حذف">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredDocuments.length === 0 && (
                    <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                        <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 font-bold">لا توجد وثائق مضافة.</p>
                        <p className="text-gray-400 text-xs mt-1 font-bold">ابدأ بإضافة وثائق الشركة للعرض هنا.</p>
                    </div>
                )}
            </div>

            {viewMode === 'upload' && renderUploadForm()}
            {viewMode === 'report' && renderReportView()}
            {renderPreviewModal()}
        </div>
    );
};

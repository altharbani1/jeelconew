import React, { useState, useMemo } from 'react';
import { Users, FileText, CheckCircle2, DollarSign, Plus, Search, Edit, Trash2, Printer, ChevronDown, Wrench, Building2, UploadCloud, Paperclip, X } from 'lucide-react';
import { Subcontractor, Subcontract, SubcontractPayment, Project } from '../types';
import { useSubcontract } from '../contexts/SubcontractContext';
import { useProject } from '../contexts/ProjectContext';

export const SubcontractModule: React.FC = () => {
    const {
        subcontractors,
        subcontracts,
        addSubcontractor,
        updateSubcontractor,
        deleteSubcontractor,
        addSubcontract,
        updateSubcontract,
        deleteSubcontract,
        uploadSubcontractAttachment
    } = useSubcontract();

    const { projects, saveProjectRecord, expenses } = useProject();

    const [activeTab, setActiveTab] = useState<'dashboard' | 'subcontractors' | 'contracts'>('dashboard');
    const [statementSubcontractor, setStatementSubcontractor] = useState<Subcontractor | null>(null);
    const [printingPayment, setPrintingPayment] = useState<{ contract: Subcontract, payment: SubcontractPayment } | null>(null);

    // --- SEARCH / FILTERS ---
    const [searchTerm, setSearchTerm] = useState('');
    const [contractStatusFilter, setContractStatusFilter] = useState<'all' | 'active' | 'completed' | 'draft'>('all');

    // --- FORM STATES ---
    const [showSubcontractorForm, setShowSubcontractorForm] = useState(false);
    const [currentSubcontractor, setCurrentSubcontractor] = useState<Partial<Subcontractor>>({ status: 'active', rating: 3 });

    const [showSubcontractForm, setShowSubcontractForm] = useState(false);
    const [currentSubcontract, setCurrentSubcontract] = useState<Partial<Subcontract>>({
        status: 'draft',
        progressPercentage: 0,
        payments: [],
        date: new Date().toISOString().split('T')[0]
    });

    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [selectedContractId, setSelectedContractId] = useState<string>('');
    const [currentPayment, setCurrentPayment] = useState<Partial<SubcontractPayment>>({
        status: 'pending',
        dueDate: new Date().toISOString().split('T')[0]
    });

    // --- STATS ---
    const stats = useMemo(() => {
        const activeContracts = subcontracts.filter(c => c.status === 'active').length;
        const totalCommitted = subcontracts.reduce((sum, c) => sum + (c.totalAmount || 0), 0);

        let totalPaid = 0;
        let totalPending = 0;

        subcontracts.forEach(c => {
            c.payments?.forEach(p => {
                if (p.status === 'paid') totalPaid += p.amount;
                else totalPending += p.amount;
            });
        });

        return { activeContracts, totalCommitted, totalPaid, totalPending };
    }, [subcontracts]);

    // --- SUBCONTRACTOR ACTIONS ---
    const handleSaveSubcontractor = async () => {
        if (!currentSubcontractor.name || !currentSubcontractor.specialty) {
            return alert('الاسم والتخصص مطلوبان');
        }

        if (currentSubcontractor.id) {
            await updateSubcontractor(currentSubcontractor.id, currentSubcontractor as Partial<Subcontractor>);
        } else {
            await addSubcontractor(currentSubcontractor as Omit<Subcontractor, 'id' | 'createdAt'>);
        }

        setShowSubcontractorForm(false);
        setCurrentSubcontractor({ status: 'active', rating: 3 });
    };

    // --- CONTRACT ACTIONS ---
    const handleSaveSubcontract = async () => {
        if (!currentSubcontract.subcontractorId || !currentSubcontract.projectId || !currentSubcontract.totalAmount) {
            return alert('يجب اختيار المقاول، المشروع، وإدخال القيمة الإجمالية');
        }

        const subc = subcontractors.find(s => s.id === currentSubcontract.subcontractorId);
        const proj = projects.find(p => p.id === currentSubcontract.projectId);

        const newContractData = {
            ...currentSubcontract,
            subcontractorName: subc?.name || '',
            projectName: proj?.name || '',
            number: currentSubcontract.number || `SUB-${Date.now()}`
        } as Omit<Subcontract, 'id'> | Subcontract;

        if ((currentSubcontract as any).id) {
            await updateSubcontract((currentSubcontract as Subcontract).id, newContractData);
        } else {
            await addSubcontract(newContractData as Omit<Subcontract, 'id'>);
        }

        setShowSubcontractForm(false);
        setCurrentSubcontract({ status: 'draft', progressPercentage: 0, payments: [], date: new Date().toISOString().split('T')[0] });
    };

    // --- PAYMENT ACTIONS ---
    const handleSavePayment = async () => {
        if (!selectedContractId || !currentPayment.amount || !currentPayment.description) {
            return alert('وصف الدفعة والمبلغ مطلوبان');
        }

        const contract = subcontracts.find(c => c.id === selectedContractId);
        if (!contract) return;

        const payments = contract.payments || [];
        const newPayment: SubcontractPayment = {
            ...currentPayment,
            id: currentPayment.id || `PAY-${Date.now()}`,
            subcontractId: selectedContractId
        } as SubcontractPayment;

        let updatedPayments = [...payments];
        if (currentPayment.id) {
            updatedPayments = payments.map(p => p.id === currentPayment.id ? newPayment : p);
        } else {
            updatedPayments.push(newPayment);
        }

        await updateSubcontract(selectedContractId, { payments: updatedPayments });
        setShowPaymentForm(false);
        setCurrentPayment({ status: 'pending', dueDate: new Date().toISOString().split('T')[0] });
        setSelectedContractId('');
    };

    const updatePaymentStatus = async (contractId: string, paymentId: string, newStatus: SubcontractPayment['status']) => {
        const contract = subcontracts.find(c => c.id === contractId);
        if (!contract) return;
        const payment = contract.payments?.find(p => p.id === paymentId);
        if (!payment) return;

        const updatedPayments = (contract.payments || []).map(p => {
            if (p.id === paymentId) {
                return {
                    ...p,
                    status: newStatus,
                    paymentDate: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : p.paymentDate
                };
            }
            return p;
        });

        await updateSubcontract(contractId, { payments: updatedPayments });

        if (newStatus === 'paid' && payment.status !== 'paid') {
            const expenseId = `SUB-${payment.id}`;
            const subc = subcontractors.find(s => s.id === contract.subcontractorId);
            const expenseRecord = {
                id: expenseId,
                number: `PV-${new Date().getFullYear()}-${String(expenses.length + 1).padStart(3, '0')}`,
                date: new Date().toISOString().split('T')[0],
                categoryId: 'subcontract_payment',
                categoryName: 'عقود باطن',
                paidTo: subc ? subc.name : contract.subcontractorName,
                description: `دفعة مقاول باطن - ${contract.projectName} - ${payment.description}`,
                amount: payment.amount,
                paymentMethod: payment.paymentMethod || 'transfer',
                bankName: subc?.bankName || '',
                projectId: contract.projectId,
                projectName: contract.projectName,
                attachments: []
            };
            await saveProjectRecord('jilco_expenses_archive', expenseId, expenseRecord);
            alert('تم تحويل الدفعة إلى منصرف وإضافتها إلى قسم المصروفات.');
        }
    };


    // --- RENDER MODALS ---
    const renderSubcontractorForm = () => (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 animate-fade-in">
                <h3 className="font-bold text-lg mb-4 text-jilco-900 flex items-center gap-2">
                    <Building2 size={20} /> {currentSubcontractor.id ? 'تعديل بيانات مقاول' : 'تسجيل مقاول جديد'}
                </h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">اسم المؤسسة / الفرد</label>
                            <input title="الاسم" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontractor.name || ''}
                                onChange={e => setCurrentSubcontractor({ ...currentSubcontractor, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">التخصص</label>
                            <select title="التخصص" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontractor.specialty || ''}
                                onChange={e => setCurrentSubcontractor({ ...currentSubcontractor, specialty: e.target.value })}
                            >
                                <option value="">-- اختر --</option>
                                <option value="تركيب ميكانيكا">تركيب ميكانيكا</option>
                                <option value="تركيب كهرباء">تركيب كهرباء</option>
                                <option value="أعمال مدنية">أعمال مدنية</option>
                                <option value="صيانة">صيانة</option>
                                <option value="تطوير">تطوير</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">اسم المسؤول</label>
                            <input title="المسؤول" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontractor.contactPerson || ''}
                                onChange={e => setCurrentSubcontractor({ ...currentSubcontractor, contactPerson: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">الهاتف</label>
                            <input title="الهاتف" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontractor.phone || ''}
                                onChange={e => setCurrentSubcontractor({ ...currentSubcontractor, phone: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">اسم البنك</label>
                            <input title="البنك" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontractor.bankName || ''}
                                onChange={e => setCurrentSubcontractor({ ...currentSubcontractor, bankName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">رقم الحساب / الآيبان</label>
                            <input title="الحساب" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontractor.bankAccountNumber || ''}
                                onChange={e => setCurrentSubcontractor({ ...currentSubcontractor, bankAccountNumber: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">الرقم الضريبي / الهوية</label>
                            <input title="الرقم" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontractor.vatNumber || ''}
                                onChange={e => setCurrentSubcontractor({ ...currentSubcontractor, vatNumber: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">التقييم</label>
                            <select title="التقييم" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontractor.rating || 3}
                                onChange={e => setCurrentSubcontractor({ ...currentSubcontractor, rating: parseInt(e.target.value) as any })}
                            >
                                <option value={5}>ممتاز (5)</option>
                                <option value={4}>جيد جدا (4)</option>
                                <option value={3}>جيد (3)</option>
                                <option value={2}>مقبول (2)</option>
                                <option value={1}>ضعيف (1)</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">ملاحظات والتزامات</label>
                        <textarea title="ملاحظات" className="w-full p-2 border border-gray-400 rounded h-16 text-xs text-black bg-white font-bold"
                            value={currentSubcontractor.notes || ''}
                            onChange={e => setCurrentSubcontractor({ ...currentSubcontractor, notes: e.target.value })}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={() => setShowSubcontractorForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold text-sm">إلغاء</button>
                    <button onClick={handleSaveSubcontractor} className="px-6 py-2 bg-jilco-600 text-white rounded hover:bg-jilco-700 font-bold text-sm shadow-md">حفظ المقاول</button>
                </div>
            </div>
        </div>
    );

    const renderSubcontractForm = () => (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
                <h3 className="font-bold text-lg mb-4 text-jilco-900 flex items-center gap-2">
                    <FileText size={20} /> {(currentSubcontract as any).id ? 'تعديل عقد باطن' : 'إنشاء عقد باطن جديد'}
                </h3>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">المقاول</label>
                            <select title="المقاول" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontract.subcontractorId || ''}
                                onChange={e => setCurrentSubcontract({ ...currentSubcontract, subcontractorId: e.target.value })}
                            >
                                <option value="">-- اختر المقاول --</option>
                                {subcontractors.filter(s => s.status === 'active').map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.specialty})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">المشروع المرتبط</label>
                            <select title="المشروع" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontract.projectId || ''}
                                onChange={e => setCurrentSubcontract({ ...currentSubcontract, projectId: e.target.value })}
                            >
                                <option value="">-- اختر المشروع --</option>
                                {projects.filter(p => p.status !== 'completed').map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">رقم العقد</label>
                            <input title="رقم العقد" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontract.number || ''}
                                placeholder="يتم التوليد تلقائياً"
                                onChange={e => setCurrentSubcontract({ ...currentSubcontract, number: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">تاريخ العقد</label>
                            <input title="التاريخ" type="date" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontract.date || ''}
                                onChange={e => setCurrentSubcontract({ ...currentSubcontract, date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">القيمة الإجمالية (ر.س)</label>
                            <input title="القيمة" type="number" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontract.totalAmount || ''}
                                onChange={e => setCurrentSubcontract({ ...currentSubcontract, totalAmount: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">تاريخ البدء</label>
                            <input title="البدء" type="date" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontract.startDate || ''}
                                onChange={e => setCurrentSubcontract({ ...currentSubcontract, startDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">تاريخ الانتهاء المتوقع</label>
                            <input title="الانتهاء" type="date" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentSubcontract.endDate || ''}
                                onChange={e => setCurrentSubcontract({ ...currentSubcontract, endDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold mb-1">نطاق العمل (Scope of Work)</label>
                        <textarea title="نطاق العمل" className="w-full p-2 border border-gray-400 rounded h-24 text-sm text-black bg-white font-bold"
                            placeholder="تفاصيل الأعمال المطلوبة من المقاول..."
                            value={currentSubcontract.scopeOfWork || ''}
                            onChange={e => setCurrentSubcontract({ ...currentSubcontract, scopeOfWork: e.target.value })}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={() => setShowSubcontractForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold text-sm">إلغاء</button>
                    <button onClick={handleSaveSubcontract} className="px-6 py-2 bg-jilco-600 text-white rounded hover:bg-jilco-700 font-bold text-sm shadow-md">حفظ العقد</button>
                </div>
            </div>
        </div>
    );

    const renderPaymentForm = () => (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in">
                <h3 className="font-bold text-lg mb-4 text-jilco-900 flex items-center gap-2">
                    <DollarSign size={20} /> تسجيل دفعة باطن
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold mb-1">وصف الدفعة</label>
                        <input title="الوصف" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                            placeholder="مثال: دفعة مقدمة، أو إنجاز 50%"
                            value={currentPayment.description || ''}
                            onChange={e => setCurrentPayment({ ...currentPayment, description: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">المبلغ (ر.س)</label>
                            <input title="المبلغ" type="number" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentPayment.amount || ''}
                                onChange={e => setCurrentPayment({ ...currentPayment, amount: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">تاريخ الاستحقاق</label>
                            <input title="الاستحقاق" type="date" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentPayment.dueDate || ''}
                                onChange={e => setCurrentPayment({ ...currentPayment, dueDate: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">نسبة الإنجاز المقترنة % (اختياري)</label>
                            <input title="نسبة الإنجاز" type="number" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                value={currentPayment.progressPercentage || ''}
                                onChange={e => setCurrentPayment({ ...currentPayment, progressPercentage: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={() => setShowPaymentForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold text-sm">إلغاء</button>
                    <button onClick={handleSavePayment} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold text-sm shadow-md">حفظ الدفعة</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in text-right print:bg-white print:p-0 print:overflow-visible" dir="rtl">
            <div className={`max-w-6xl mx-auto transition-opacity ${statementSubcontractor || printingPayment ? 'print:hidden' : ''}`}>

                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                            <Users className="text-jilco-600" /> مقاولي الباطن
                        </h1>
                        <p className="text-gray-500 text-sm mt-1 font-bold">إدارة عقود الباطن، والدفعات، وتقييم المقاولين</p>
                    </div>
                    <div className="flex gap-2">
                        {activeTab === 'subcontractors' && (
                            <button onClick={() => { setCurrentSubcontractor({ status: 'active', rating: 3 }); setShowSubcontractorForm(true); }} className="bg-jilco-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-800 shadow-md text-sm">
                                <Plus size={18} /> مقاول جديد
                            </button>
                        )}
                        {activeTab === 'contracts' && (
                            <button onClick={() => { setCurrentSubcontract({ status: 'draft', date: new Date().toISOString().split('T')[0] }); setShowSubcontractForm(true); }} className="bg-jilco-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-800 shadow-md text-sm">
                                <Plus size={18} /> عقد جديد
                            </button>
                        )}
                    </div>
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-r-4 border-r-jilco-500">
                        <p className="text-xs font-bold text-gray-500 mb-1">عقود باطن نشطة</p>
                        <p className="text-2xl font-black text-jilco-900">{stats.activeContracts}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-r-4 border-r-blue-500">
                        <p className="text-xs font-bold text-gray-500 mb-1">إجمالي الالتزامات (ر.س)</p>
                        <p className="text-2xl font-black text-jilco-900 font-mono">{stats.totalCommitted.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-r-4 border-r-green-500">
                        <p className="text-xs font-bold text-gray-500 mb-1">إجمالي المستخلص المنصرف</p>
                        <p className="text-2xl font-black text-green-600 font-mono">{stats.totalPaid.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-r-4 border-r-amber-500">
                        <p className="text-xs font-bold text-gray-500 mb-1">دفعات قيد الانتظار</p>
                        <p className="text-2xl font-black text-amber-600 font-mono">{stats.totalPending.toLocaleString()}</p>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden w-full max-w-2xl">
                    <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'dashboard' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><FileText size={18} /> نظرة عامة</button>
                    <button onClick={() => setActiveTab('subcontractors')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'subcontractors' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><Building2 size={18} /> قائمة المقاولين</button>
                    <button onClick={() => setActiveTab('contracts')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'contracts' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><Wrench size={18} /> سجل العقود</button>
                </div>

                {/* Dashboard Tab Content */}
                {activeTab === 'dashboard' && (
                    <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Recent Contracts Content */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 p-4 border-b border-gray-200">
                                <h3 className="font-bold text-jilco-900 flex items-center gap-2"><FileText size={18} /> أحدث العقود النشطة</h3>
                            </div>
                            <div className="p-4 space-y-3">
                                {subcontracts.filter(c => c.status === 'active').slice(0, 5).map(contract => (
                                    <div key={contract.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                                        <div>
                                            <p className="font-bold text-sm text-jilco-900">{contract.projectName}</p>
                                            <p className="font-bold text-xs text-gray-500">{contract.subcontractorName}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono text-sm font-bold text-red-600">{contract.totalAmount.toLocaleString()} ر.س</p>
                                            <p className="font-mono text-xs font-bold text-blue-600">{contract.progressPercentage || 0}% إنجاز</p>
                                        </div>
                                    </div>
                                ))}
                                {subcontracts.filter(c => c.status === 'active').length === 0 && (
                                    <p className="text-center text-sm font-bold text-gray-400 py-4">لا توجد عقود نشطة حالياً</p>
                                )}
                            </div>
                        </div>

                        {/* Recent Payments Content */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 p-4 border-b border-gray-200">
                                <h3 className="font-bold text-jilco-900 flex items-center gap-2"><DollarSign size={18} /> آخر الدفعات</h3>
                            </div>
                            <div className="p-4 space-y-3">
                                {subcontracts.flatMap(c => c.payments?.map(p => ({ ...p, subcontractorName: c.subcontractorName, projectName: c.projectName })) || []).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).slice(0, 5).map(payment => (
                                    <div key={payment.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                                        <div>
                                            <p className="font-bold text-sm text-jilco-900">{payment.subcontractorName}</p>
                                            <p className="font-bold text-xs text-gray-500">{payment.description}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono text-sm font-bold text-green-600">{payment.amount.toLocaleString()} ر.س</p>
                                            <span className={`px-2 py-0.5 rounded text-[10px] ${payment.status === 'paid' ? 'bg-green-100 text-green-700' : payment.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {payment.status === 'paid' ? 'تم الصرف' : payment.status === 'approved' ? 'معتمد للصرف' : 'قيد الانتظار'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Subcontractors Tab */}
                {activeTab === 'subcontractors' && (
                    <div className="animate-fade-in bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                                <tr>
                                    <th className="p-4">اسم المقاول</th>
                                    <th className="p-4">التخصص</th>
                                    <th className="p-4">التواصل</th>
                                    <th className="p-4 text-center">التقييم</th>
                                    <th className="p-4 text-center">الحالة</th>
                                    <th className="p-4 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                                {subcontractors.map(sub => (
                                    <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4">
                                            <p className="text-jilco-900 border-r-2 border-jilco-500 pr-2">{sub.name}</p>
                                        </td>
                                        <td className="p-4">{sub.specialty}</td>
                                        <td className="p-4">
                                            <p className="text-xs">{sub.contactPerson}</p>
                                            <p className="font-mono text-xs mt-1" dir="ltr">{sub.phone}</p>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center text-amber-500">
                                                {[...Array(5)].map((_, i) => (
                                                    <span key={i} className={i < (sub.rating || 0) ? 'text-amber-500' : 'text-gray-300'}>★</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] ${sub.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {sub.status === 'active' ? 'نشط' : 'غير نشط'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button title="تعديل المقاول" onClick={() => { setCurrentSubcontractor(sub); setShowSubcontractorForm(true); }} className="text-blue-500 hover:text-blue-700 p-1 bg-blue-50 rounded"><Edit size={16} /></button>
                                                <button title="كشف حساب" onClick={() => setStatementSubcontractor(sub)} className="text-purple-500 hover:text-purple-700 p-1 bg-purple-50 rounded"><FileText size={16} /></button>
                                                <button title="حذف المقاول" onClick={() => deleteSubcontractor(sub.id)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {subcontractors.length === 0 && (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">لا يوجد بيانات لعرضها</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Contracts Tab */}
                {activeTab === 'contracts' && (
                    <div className="animate-fade-in space-y-4">
                        {subcontracts.map(contract => (
                            <div key={contract.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <h3 className="font-bold text-lg text-jilco-900 font-mono border-r-4 border-jilco-600 pr-3">{contract.number}</h3>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${contract.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                            contract.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                contract.status === 'draft' ? 'bg-gray-200 text-gray-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {contract.status === 'active' ? 'قيد التنفيذ' : contract.status === 'completed' ? 'مكتمل' : 'مسودة'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setCurrentSubcontract(contract); setShowSubcontractForm(true); }} className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-blue-100"><Edit size={14} /> تعديل</button>
                                        <button onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا العقد؟')) deleteSubcontract(contract.id); }} className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-red-100"><Trash2 size={14} /> حذف</button>
                                    </div>
                                </div>

                                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-3 font-bold text-sm">
                                        <div className="flex justify-between border-b pb-1">
                                            <span className="text-gray-500">المقاول المنفذ:</span>
                                            <span className="text-gray-900">{contract.subcontractorName}</span>
                                        </div>
                                        <div className="flex justify-between border-b pb-1">
                                            <span className="text-gray-500">مرتبط بمشروع:</span>
                                            <span className="text-jilco-700">{contract.projectName}</span>
                                        </div>
                                        <div className="flex justify-between border-b pb-1">
                                            <span className="text-gray-500">تاريخ العقد:</span>
                                            <span className="font-mono text-gray-900">{contract.date}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">نسبة الإنجاز:</span>
                                            <span className="font-mono text-blue-600">{contract.progressPercentage || 0}%</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 font-bold text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="flex justify-between mb-2">
                                            <span className="text-gray-500">إجمالي العقد:</span>
                                            <span className="font-mono text-lg text-jilco-900">{contract.totalAmount.toLocaleString()} ر.س</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500">المنصرف:</span>
                                            <span className="font-mono text-green-600">{(contract.payments || []).filter(p => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0).toLocaleString()} ر.س</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                                            <div className="bg-green-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, ((contract.payments || []).filter(p => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0) / contract.totalAmount) * 100)}%` }}></div>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold text-gray-500 mb-2">ملخص النطاق:</p>
                                        <p className="text-xs text-gray-700 bg-blue-50/50 p-2 rounded border border-blue-50 leading-relaxed font-bold h-24 overflow-y-auto">
                                            {contract.scopeOfWork || 'لا يوجد وصف'}
                                        </p>
                                    </div>
                                </div>

                                {/* Payments / المستخلصات */}
                                <div className="p-4 border-t border-gray-100 bg-white">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2"><DollarSign size={16} className="text-green-600" /> سجل الدفعات والمستخلصات</h4>
                                        <button onClick={() => { setSelectedContractId(contract.id); setCurrentPayment({ status: 'pending', dueDate: new Date().toISOString().split('T')[0] }); setShowPaymentForm(true); }} className="text-xs font-bold bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-100 flex items-center gap-1">
                                            <Plus size={14} /> إضافة دفعة مستحقة
                                        </button>
                                    </div>
                                    {(!contract.payments || contract.payments.length === 0) ? (
                                        <p className="text-xs text-center text-gray-400 font-bold py-4 bg-gray-50 rounded">لا توجد دفعات مسجلة</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs font-bold">
                                                <thead className="bg-gray-50 text-gray-500 text-right">
                                                    <tr>
                                                        <th className="p-2">الوصف</th>
                                                        <th className="p-2">تاريخ الاستحقاق</th>
                                                        <th className="p-2">نسبة معتمدة</th>
                                                        <th className="p-2">المبلغ (ر.س)</th>
                                                        <th className="p-2 text-center">الحالة</th>
                                                        <th className="p-2 text-center">إجراءات</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {contract.payments.map(payment => (
                                                        <tr key={payment.id}>
                                                            <td className="p-2 text-gray-800">{payment.description}</td>
                                                            <td className="p-2 font-mono">{payment.dueDate}</td>
                                                            <td className="p-2 font-mono text-jilco-600">{payment.progressPercentage ? `${payment.progressPercentage}%` : '-'}</td>
                                                            <td className="p-2 text-jilco-900 font-mono">{payment.amount.toLocaleString()}</td>
                                                            <td className="p-2 text-center">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] ${payment.status === 'paid' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                                    payment.status === 'approved' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                                                        'bg-amber-100 text-amber-700 border border-amber-200'
                                                                    }`}>
                                                                    {payment.status === 'paid' ? 'تم الصرف' : payment.status === 'approved' ? 'معتمد للصرف' : 'قيد الانتظار'}
                                                                </span>
                                                            </td>
                                                            <td className="p-2 text-center flex justify-center gap-1">
                                                                <button title="طباعة" onClick={() => { setPrintingPayment({ contract, payment }); setTimeout(() => window.print(), 300); }} className="bg-gray-50 text-gray-600 px-2 py-1 rounded hover:bg-gray-100 border border-gray-200"><Printer size={16} /></button>
                                                                {payment.status === 'pending' && (
                                                                    <button onClick={() => updatePaymentStatus(contract.id, payment.id, 'approved')} className="bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 border border-blue-100">اعتماد</button>
                                                                )}
                                                                {payment.status === 'approved' && (
                                                                    <button onClick={() => updatePaymentStatus(contract.id, payment.id, 'paid')} className="bg-green-50 text-green-600 px-2 py-1 rounded hover:bg-green-100 border border-green-100">تحويل كمنصرف</button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {subcontracts.length === 0 && (
                            <div className="bg-white p-12 text-center rounded-xl border border-gray-200 shadow-sm">
                                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                                <p className="text-gray-500 font-bold">لا توجد عقود باطن مسجلة حالياً</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showSubcontractorForm && renderSubcontractorForm()}
            {showSubcontractForm && renderSubcontractForm()}
            {showPaymentForm && renderPaymentForm()}

            {statementSubcontractor && (
                <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-start p-4 overflow-y-auto print:absolute print:inset-0 print:bg-white print:z-[200]">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-8 mt-10 relative print:w-[210mm] print:shadow-none print:m-0 print:break-inside-avoid animate-fade-in">
                        <div className="flex justify-between items-center mb-6 print:hidden border-b pb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-jilco-900"><FileText /> كشف حساب مقاول باطن</h2>
                            <div className="flex gap-2">
                                <button onClick={() => window.print()} className="bg-jilco-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-black"><Printer size={18} /> طباعة</button>
                                <button title="إغلاق" onClick={() => setStatementSubcontractor(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700"><X size={20} /></button>
                            </div>
                        </div>

                        <div className="hidden print:flex justify-between items-center border-b-2 border-jilco-900 pb-4 mb-6">
                            <div className="text-right">
                                <h1 className="text-2xl font-black text-jilco-900">جيلكو للمصاعد</h1>
                                <p className="text-xs font-bold text-gray-500">كشف حساب مقاول</p>
                            </div>
                            <div className="text-left font-mono text-sm font-bold">
                                تاريخ الطباعة: {new Date().toLocaleDateString('en-GB')}
                            </div>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-6 print:border-gray-400 print:bg-transparent">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm font-bold">
                                <div>
                                    <p className="text-gray-500 mb-1">اسم المقاول</p>
                                    <p className="text-lg text-jilco-900">{statementSubcontractor.name}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-1">إجمالي التزامات العقود</p>
                                    <p className="text-lg text-blue-700 font-mono">{subcontracts.filter(c => c.subcontractorId === statementSubcontractor.id).reduce((sum, c) => sum + c.totalAmount, 0).toLocaleString()} ر.س</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-1">إجمالي المنصرف</p>
                                    <p className="text-lg text-green-700 font-mono">{subcontracts.filter(c => c.subcontractorId === statementSubcontractor.id).flatMap(c => c.payments || []).filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0).toLocaleString()} ر.س</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-1">الرصيد المتبقي</p>
                                    <p className="text-lg text-red-700 font-mono">{(subcontracts.filter(c => c.subcontractorId === statementSubcontractor.id).reduce((sum, c) => sum + c.totalAmount, 0) - subcontracts.filter(c => c.subcontractorId === statementSubcontractor.id).flatMap(c => c.payments || []).filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)).toLocaleString()} ر.س</p>
                                </div>
                            </div>
                        </div>

                        <h3 className="font-bold text-lg mb-3 border-b pb-2">تفاصيل العقود النشطة والمكتملة</h3>
                        <table className="w-full text-sm mb-8">
                            <thead className="bg-jilco-50 text-jilco-900 font-bold border-b-2 border-jilco-200">
                                <tr>
                                    <th className="p-3 text-right border whitespace-nowrap">رقم العقد</th>
                                    <th className="p-3 text-right border w-full">المشروع</th>
                                    <th className="p-3 text-center border whitespace-nowrap">القيمة الإجمالية</th>
                                    <th className="p-3 text-center border whitespace-nowrap">المنصرف</th>
                                    <th className="p-3 text-center border whitespace-nowrap">المتبقي</th>
                                    <th className="p-3 text-center border whitespace-nowrap">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-bold">
                                {subcontracts.filter(c => c.subcontractorId === statementSubcontractor.id).map(c => {
                                    const cPaid = (c.payments || []).filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
                                    return (
                                        <tr key={c.id}>
                                            <td className="p-3 font-mono border">{c.number}</td>
                                            <td className="p-3 border text-jilco-800">{c.projectName}</td>
                                            <td className="p-3 text-center font-mono border">{c.totalAmount.toLocaleString()}</td>
                                            <td className="p-3 text-center text-green-600 font-mono border">{cPaid.toLocaleString()}</td>
                                            <td className="p-3 text-center text-red-600 font-mono border">{(c.totalAmount - cPaid).toLocaleString()}</td>
                                            <td className="p-3 text-center border">
                                                <span className={`px-2 py-1 rounded text-xs ${c.status === 'active' ? 'bg-blue-100 text-blue-700' : c.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                    {c.status === 'active' ? 'نشط' : c.status === 'completed' ? 'مكتمل' : c.status}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>

                        <h3 className="font-bold text-lg mb-3 border-b pb-2">سجل الدفعات والمطالبات</h3>
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 text-gray-700 font-bold border-b-2 border-gray-300">
                                <tr>
                                    <th className="p-3 text-right border whitespace-nowrap">التاريخ</th>
                                    <th className="p-3 text-right border whitespace-nowrap">العقد</th>
                                    <th className="p-3 text-right border w-full">البيان</th>
                                    <th className="p-3 text-center border whitespace-nowrap">المبلغ</th>
                                    <th className="p-3 text-center border whitespace-nowrap">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-bold">
                                {subcontracts.filter(c => c.subcontractorId === statementSubcontractor.id).flatMap(c => (c.payments || []).map(p => ({ ...p, contractNumber: c.number }))).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).map((p: any) => (
                                    <tr key={p.id}>
                                        <td className="p-3 font-mono border text-gray-600">{p.paymentDate || p.dueDate}</td>
                                        <td className="p-3 border font-mono">{p.contractNumber}</td>
                                        <td className="p-3 text-gray-800 border">{p.description}</td>
                                        <td className="p-3 text-center font-mono text-jilco-900 bg-gray-50 border">{p.amount.toLocaleString()}</td>
                                        <td className="p-3 text-center border">
                                            <span className={`px-2 py-1 rounded text-xs ${p.status === 'paid' ? 'bg-green-100 text-green-700' : p.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{p.status === 'paid' ? 'منصرف' : p.status === 'approved' ? 'معتمد' : 'معلق'}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {printingPayment && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-start overflow-y-auto print:absolute print:inset-0 print:bg-white print:z-[200]">
                    <div className="bg-white mx-auto mt-10 p-10 w-[210mm] min-h-[148mm] relative shadow-2xl print:shadow-none print:m-0 print:p-0 animate-fade-in">
                        <div className="absolute top-4 right-4 print:hidden z-50">
                            <button title="إغلاق" onClick={() => setPrintingPayment(null)} className="p-2 bg-gray-100 hover:bg-red-100 hover:text-red-600 rounded-full text-gray-700 transition-colors"><X size={20} /></button>
                        </div>

                        {/* Decorative Borders */}
                        <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
                        <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
                        <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

                        <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white h-full">
                            {/* Header */}
                            <div className="flex justify-between items-center mb-8 border-b-2 border-jilco-100 pb-4 px-8 pt-6">
                                <div className="text-right">
                                    <h1 className="text-2xl font-black text-jilco-900">جيلكو للمصاعد</h1>
                                    <p className="text-xs font-bold text-gray-500">قسم عقود الباطن</p>
                                </div>
                                <div className="text-left flex flex-col items-center">
                                    <h2 className="text-xl font-black text-red-700 uppercase tracking-widest bg-red-50 px-4 py-1 rounded border border-red-100">Payment Certificate</h2>
                                    <p className="text-sm font-bold text-gray-600 mt-1 text-center">شهادة دفع / مستخلص مقاول</p>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 space-y-6 px-8 relative z-10">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                                        <span className="font-bold text-gray-500 text-sm">رقم العقد:</span>
                                        <span className="font-mono font-black text-lg text-red-600">{printingPayment.contract.number}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-500 text-sm">التاريخ:</span>
                                        <span className="font-mono font-bold text-black border-b border-gray-300 px-4">
                                            {printingPayment.payment.paymentDate || new Date().toISOString().split('T')[0]}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 bg-red-50 p-6 rounded-xl border border-red-200 shadow-inner">
                                    <span className="font-bold text-red-900 text-sm w-24">المبلغ:</span>
                                    <div className="flex-1 flex justify-between items-center bg-white p-3 rounded border border-red-100">
                                        <span className="font-mono font-black text-3xl text-red-700">{printingPayment.payment.amount.toLocaleString()}</span>
                                        <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded text-red-800 border border-gray-200">ريال سعودي SAR</span>
                                    </div>
                                </div>

                                <div className="space-y-6 text-sm bg-gray-50 p-6 rounded-xl border border-gray-200">
                                    <div className="flex items-end gap-2">
                                        <span className="font-bold text-gray-600 w-28 shrink-0">يصرف إلى السادة:</span>
                                        <span className="flex-1 border-b-2 border-dotted border-gray-400 pb-1 font-black text-jilco-900 px-2 text-lg">{printingPayment.contract.subcontractorName}</span>
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <span className="font-bold text-gray-600 w-28 shrink-0">وذلك مقابل:</span>
                                        <span className="flex-1 border-b-2 border-dotted border-gray-400 pb-1 font-bold text-gray-800 px-2 leading-loose">
                                            مقاولات باطن لمشروع ({printingPayment.contract.projectName}) - {printingPayment.payment.description}
                                            {printingPayment.payment.progressPercentage ? ` بنسبة إنجاز (${printingPayment.payment.progressPercentage}%)` : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Signatures */}
                            <div className="mt-auto flex justify-between items-end px-8 pb-8 pt-12 text-center">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 mb-8 uppercase tracking-wider">مهندس المشروع / الاعتماد</p>
                                    <div className="w-40 border-b-2 border-gray-900 mx-auto"></div>
                                </div>
                                <div className="relative">
                                    <p className="text-xs font-bold text-gray-500 mb-8 uppercase tracking-wider">المالية / الصندوق</p>
                                    <div className="w-40 border-b-2 border-gray-900 mx-auto"></div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 mb-8 uppercase tracking-wider">توقيع المستلم (المقاول)</p>
                                    <div className="w-40 border-b-2 border-gray-900 mx-auto"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

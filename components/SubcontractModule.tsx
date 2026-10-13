import React, { useState, useMemo } from 'react';
import { Users, FileText, CheckCircle2, DollarSign, Plus, Search, Edit, Trash2, Printer, ChevronDown, Wrench, Building2, UploadCloud, Paperclip, X } from 'lucide-react';
import { Subcontractor, Subcontract, SubcontractPayment, Project } from '../types';
import { useSubcontract } from '../contexts/SubcontractContext';
import { useProject } from '../contexts/ProjectContext';
import { subcontractService } from '../services/subcontractService';
import { SubcontractDocumentsPanel } from './SubcontractDocumentsPanel';
import { SubcontractStatement } from './SubcontractStatement';
import { SubcontractRegister } from './SubcontractRegister';

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
        uploadSubcontractAttachment, savePayment, deletePayment, approvePayment, payPayment,
        busy, error, canManage, canEngineer, canFinance, refresh, syncStatus, setArchive, workOrders, receipts, vouchers
    } = useSubcontract();

    const { projects } = useProject();

    const [activeTab, setActiveTab] = useState<'dashboard' | 'subcontractors' | 'contracts' | 'documents'>('dashboard');
    const [expandedContractId, setExpandedContractId] = useState<string | null>(null);
    const [showArchivedContracts, setShowArchivedContracts] = useState(false);
    const [showArchivedPayments, setShowArchivedPayments] = useState(false);
    const [statementSubcontractor, setStatementSubcontractor] = useState<Subcontractor | null>(null);
    const [printingPayment, setPrintingPayment] = useState<{ contract: Subcontract, payment: SubcontractPayment } | null>(null);

    // --- SEARCH / FILTERS ---
    const [searchTerm, setSearchTerm] = useState('');
    const [contractStatusFilter, setContractStatusFilter] = useState<'all' | 'active' | 'completed' | 'draft' | 'cancelled'>('all');

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

    // UI Mod: Add state for the specific payment currently being paid (converted to expense)
    const [payingPayment, setPayingPayment] = useState<{ contractId: string, paymentId: string, amount: number, paymentMethod: 'cash' | 'transfer' | 'check', referenceNumber: string, paymentDate: string } | null>(null);


    // --- STATS ---
    const stats = useMemo(() => {
        const activeContracts = subcontracts.filter(c => c.status === 'active').length;
        const totalCommitted = subcontracts.filter(c => c.status === 'active' || c.status === 'completed').reduce((sum, c) => sum + (c.totalAmount || 0), 0);

        let totalPaid = 0;
        let totalPending = 0;

        subcontracts.forEach(c => {
            c.payments?.forEach(p => {
                if (p.status === 'paid') totalPaid += p.amount;
                else totalPending += p.amount;
            });
        });

        const payments = subcontracts.flatMap(c => c.payments || []);
        const pendingEngineering = payments.filter(p => p.status === 'pending' && !p.engineerApprovedAt).length;
        const pendingFinance = payments.filter(p => p.status === 'pending' && !!p.engineerApprovedAt && !p.financeApprovedAt).length;
        const overduePending = payments.filter(p => p.status !== 'paid' && new Date(`${p.dueDate}T23:59:59`).getTime() < Date.now()).length;
        return { activeContracts, totalCommitted, totalPaid, totalPending, pendingEngineering, pendingFinance, overduePending };
    }, [subcontracts]);

    const filteredContracts = useMemo(() => subcontracts.filter(c =>
        Boolean(c.archived) === showArchivedContracts &&
        (contractStatusFilter === 'all' || c.status === contractStatusFilter) &&
        [c.number, c.subcontractorName, c.projectName, c.scopeOfWork].some(v => v?.toLowerCase().includes(searchTerm.trim().toLowerCase()))
    ), [subcontracts, contractStatusFilter, searchTerm, showArchivedContracts]);
    const filteredSubcontractors = useMemo(() => subcontractors.filter(s =>
        [s.name, s.specialty, s.contactPerson].some(v => v?.toLowerCase().includes(searchTerm.trim().toLowerCase()))
    ), [subcontractors, searchTerm]);

    // --- SUBCONTRACTOR ACTIONS ---
    const handleSaveSubcontractor = async () => {
        if (!currentSubcontractor.name || !currentSubcontractor.specialty) {
            return alert('الاسم والتخصص مطلوبان');
        }

        if (currentSubcontractor.id) {
            if (!await updateSubcontractor(currentSubcontractor.id, currentSubcontractor as Partial<Subcontractor>)) return;
        } else {
            if (!await addSubcontractor(currentSubcontractor as Omit<Subcontractor, 'id' | 'createdAt'>)) return;
        }

        setShowSubcontractorForm(false);
        setCurrentSubcontractor({ status: 'active', rating: 3 });
    };

    // --- CONTRACT ACTIONS ---
    const handleSaveSubcontract = async () => {
        if (!currentSubcontract.subcontractorId || !currentSubcontract.projectId || !Number.isFinite(currentSubcontract.totalAmount) || currentSubcontract.totalAmount! <= 0) {
            return alert('يجب اختيار المقاول، المشروع، وإدخال القيمة الإجمالية');
        }

        if (!currentSubcontract.startDate || !currentSubcontract.endDate || currentSubcontract.endDate <= currentSubcontract.startDate) {
            alert('يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء'); return;
        }
        if (!currentSubcontract.scopeOfWork?.trim()) {
            alert('يرجى إدخال نطاق العمل قبل حفظ العقد'); return;
        }
        if (currentSubcontract.status === 'completed' && Number(currentSubcontract.progressPercentage || 0) !== 100) {
            alert('لا يمكن وضع العقد كمكتمل قبل تسجيل نسبة إنجاز 100٪. استخدم حالة «نشط» أثناء التنفيذ.');
            return;
        }
        const subc = subcontractors.find(s => s.id === currentSubcontract.subcontractorId);
        const proj = projects.find(p => p.id === currentSubcontract.projectId);

        const isNewContract = !(currentSubcontract as any).id;
        const newContractData = {
            ...currentSubcontract,
            // New contracts always start as drafts; completion is a later
            // lifecycle transition that requires 100% progress.
            status: isNewContract ? 'draft' : currentSubcontract.status,
            progressPercentage: Number(currentSubcontract.progressPercentage || 0),
            subcontractorName: subc?.name || '',
            projectName: proj?.name || '',
            number: currentSubcontract.number || `SUB-${Date.now()}`
        } as Omit<Subcontract, 'id'> | Subcontract;

        if ((currentSubcontract as any).id) {
            if (!await updateSubcontract((currentSubcontract as Subcontract).id, newContractData)) return;
        } else {
            if (!await addSubcontract(newContractData as Omit<Subcontract, 'id'>)) return;
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

        if (!Number.isFinite(currentPayment.amount) || currentPayment.amount! <= 0 || !currentPayment.dueDate) {
            alert('أدخل مبلغاً موجباً وتاريخ استحقاق صحيحاً'); return;
        }
        if (!await savePayment(selectedContractId, currentPayment)) return;
        setShowPaymentForm(false);
        setCurrentPayment({ status: 'pending', dueDate: new Date().toISOString().split('T')[0] });
        setSelectedContractId('');
    };

    const handleDeletePayment = async (contractId: string, paymentId: string) => {
        const contract = subcontracts.find(c => c.id === contractId);
        if (!contract) return;

        const payment = contract.payments?.find(p => p.id === paymentId);
        if (!payment) return;

        if (payment.archived) { await setArchive('certificate', paymentId, false); return; }
        const protectedPayment = payment.status !== 'pending' || !!payment.engineerApprovedAt;
        if (!window.confirm(protectedPayment ? 'إزالة الدفعة من القائمة وأرشفتها؟ ستبقى الحركة المالية في كشف الحساب ويمكن استعادتها.' : 'حذف مسودة الدفعة نهائيًا؟')) return;
        if (protectedPayment) await setArchive('certificate', paymentId, true);
        else await deletePayment(paymentId);
    };

    const handleRemoveContract = async (contract: Subcontract) => {
        if (contract.archived) { await setArchive('contract', contract.id, false); return; }
        const linked = contract.status !== 'draft' || !!contract.payments?.length || !!contract.attachments?.length || [...workOrders, ...receipts, ...vouchers].some(d => d.subcontractId === contract.id);
        if (!window.confirm(linked ? 'أرشفة العقد وإزالته من القائمة؟ ستبقى قيوده وكشف حسابه محفوظة ويمكن استعادته.' : 'حذف مسودة العقد غير المرتبطة نهائيًا؟')) return;
        const ok = linked ? await setArchive('contract', contract.id, true) : await deleteSubcontract(contract.id);
        if (ok) setExpandedContractId(null);
    };

    const updatePaymentStatus = async (contractId: string, paymentId: string, newStatus: SubcontractPayment['status'], extraData?: any) => {
        const payment = subcontracts.find(c => c.id === contractId)?.payments.find(p => p.id === paymentId);
        if (!payment) return false;
        return newStatus === 'paid' ? payPayment(payment, extraData) : approvePayment(payment);
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
                    <button disabled={busy || !canManage} onClick={handleSaveSubcontractor} className="px-6 py-2 bg-jilco-600 text-white rounded hover:bg-jilco-700 font-bold text-sm shadow-md">حفظ المقاول</button>
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
                            <label className="block text-xs font-bold mt-3 mb-1">حد الدفعة المقدمة المتفق عليها (ر.س)</label>
                            <input type="number" min="0" aria-label="حد الدفعة المقدمة" value={currentSubcontract.advancePaymentAmount || 0} onChange={e => setCurrentSubcontract({ ...currentSubcontract, advancePaymentAmount: Number(e.target.value) })} className="w-full p-2 border rounded" />
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

                    <div className="grid grid-cols-2 gap-4">
                        <label>حالة العقد
                            <select title="حالة العقد" className="w-full p-2 border rounded" value={currentSubcontract.status || 'draft'} onChange={e => { const status = e.target.value as Subcontract['status']; setCurrentSubcontract({ ...currentSubcontract, status, progressPercentage: status === 'completed' ? 100 : currentSubcontract.progressPercentage }); }}>
                                <option value="draft">مسودة</option><option value="active">نشط</option><option value="completed">مكتمل</option><option value="cancelled">ملغي</option>
                            </select>
                        </label>
                        <label>نسبة الإنجاز %
                            <input title="نسبة إنجاز العقد" className="w-full p-2 border rounded" type="number" min="0" max="100" value={currentSubcontract.progressPercentage ?? 0} onChange={e => setCurrentSubcontract({ ...currentSubcontract, progressPercentage: Number(e.target.value) })} />
                        </label>
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
                    <button disabled={busy || !canManage} onClick={handleSaveSubcontract} className="px-6 py-2 bg-jilco-600 text-white rounded hover:bg-jilco-700 font-bold text-sm shadow-md">حفظ العقد</button>
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
                    <button disabled={busy || !canManage} onClick={handleSavePayment} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold text-sm shadow-md">حفظ الدفعة</button>
                </div>
            </div>
        </div>
    );

    const renderPayPaymentForm = () => {
        if (!payingPayment) return null;
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in border-t-4 border-green-500">
                    <h3 className="font-bold text-lg mb-4 text-green-700 flex items-center gap-2">
                        <CheckCircle2 size={20} /> تحويل كمنصرف وإصدار سند
                    </h3>
                    <p className="text-xs text-gray-500 mb-4 font-bold border-b pb-2">
                        سيتم إنشاء سند صرف آلياً في قسم المصروفات وإدراجها ضمن تكاليف المشروع.
                    </p>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold mb-1">المبلغ</label>
                                <input title="المبلغ" type="number" disabled className="w-full p-2 border border-green-200 rounded text-green-800 bg-green-50 font-bold font-mono"
                                    value={payingPayment.amount} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1">تاريخ الصرف</label>
                                <input title="تاريخ الصرف" type="date" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                    value={payingPayment.paymentDate}
                                    onChange={e => setPayingPayment({ ...payingPayment, paymentDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold mb-1">طريقة الدفع</label>
                                <select title="طريقة الدفع" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                    value={payingPayment.paymentMethod}
                                    onChange={e => setPayingPayment({ ...payingPayment, paymentMethod: e.target.value as any })}
                                >
                                    <option value="transfer">حوالة بنكية</option>
                                    <option value="cash">نقدي</option>
                                    <option value="check">شيك</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1">رقم المرجع (اختياري)</label>
                                <input title="رقم المرجع" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold"
                                    placeholder="رقم الحوالة أو الشيك"
                                    value={payingPayment.referenceNumber}
                                    onChange={e => setPayingPayment({ ...payingPayment, referenceNumber: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                        <button onClick={() => setPayingPayment(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold text-sm">إلغاء</button>
                        <button disabled={busy || !canFinance} onClick={async () => {
                            const saved = await updatePaymentStatus(payingPayment.contractId, payingPayment.paymentId, 'paid', {
                                paymentMethod: payingPayment.paymentMethod,
                                referenceNumber: payingPayment.referenceNumber,
                                paymentDate: payingPayment.paymentDate
                            });
                            if (saved) setPayingPayment(null);
                        }} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold text-sm shadow-md">
                            تأكيد الدفع وإصدار السند
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-auto bg-slate-100 p-4 text-right sm:p-6 lg:p-8 print:block print:bg-white print:p-0 print:overflow-visible print:absolute print:inset-0 print:z-50 print:h-auto" dir="rtl">
            <div className={`print:hidden mb-5 max-w-7xl mx-auto flex flex-wrap items-center gap-3 ${activeTab === 'contracts' || activeTab === 'documents' ? 'hidden' : ''}`}>
                <div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute right-3 top-3 text-slate-400" /><input aria-label="بحث في عقود الباطن" placeholder="بحث بالاسم أو رقم العقد" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-3 text-sm font-bold outline-none focus:border-jilco-500 focus:ring-2 focus:ring-jilco-100" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                <select aria-label="تصفية حالة العقد" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-jilco-500" value={contractStatusFilter} onChange={e => setContractStatusFilter(e.target.value as any)}>
                    <option value="all">كل الحالات</option><option value="draft">مسودة</option><option value="active">نشط</option><option value="completed">مكتمل</option><option value="cancelled">ملغي</option>
                </select>
                <button onClick={() => { void refresh().catch(() => {}); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">تحديث</button>
                {busy && <span className="rounded-full bg-jilco-50 px-3 py-1.5 text-xs font-bold text-jilco-700">جارٍ الحفظ…</span>}
            </div>
            {error && <div role="alert" className="print:hidden fixed top-4 right-4 max-w-lg z-[10000] p-3 mb-4 bg-red-50 text-red-800 border border-red-300 rounded">{error}</div>}

            <div className={`max-w-7xl mx-auto transition-opacity ${statementSubcontractor || printingPayment ? 'print:hidden' : ''}`}>

                {/* Header */}
                <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="mb-2 text-xs text-slate-500">جيلكو للمصاعد / إدارة العقود</div>
                        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
                            <span className="rounded-xl bg-jilco-900 p-2 text-white shadow-sm"><Users size={21} /></span> مقاولو الباطن
                        </h1>
                        <p className="mt-2 text-sm text-slate-500">العقود والمستخلصات ومستندات التنفيذ</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs text-slate-500" role="status">{busy ? 'جارٍ الحفظ…' : syncStatus === 'syncing' ? 'جارٍ تحديث البيانات…' : syncStatus === 'error' ? 'تعذر تحديث البيانات' : 'البيانات محدثة'}</span>
                        <button onClick={() => void refresh().catch(() => {})} disabled={busy} className="border border-slate-200 bg-white rounded-lg px-4 py-2.5 text-sm text-slate-700 disabled:opacity-50">تحديث</button>
                        {activeTab === 'subcontractors' && (
                            <button disabled={!canManage || busy} onClick={() => { setCurrentSubcontractor({ status: 'active', rating: 3 }); setShowSubcontractorForm(true); }} className="flex items-center gap-2 rounded-xl bg-jilco-900 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:bg-jilco-800 disabled:cursor-not-allowed disabled:opacity-50">
                                <Plus size={18} /> مقاول جديد
                            </button>
                        )}
                        {activeTab === 'contracts' && (
                            <button disabled={!canManage || busy} onClick={() => { setCurrentSubcontract({ status: 'draft', progressPercentage: 0, payments: [], date: new Date().toISOString().split('T')[0] }); setShowSubcontractForm(true); }} className="flex items-center gap-2 rounded-xl bg-jilco-900 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:bg-jilco-800 disabled:cursor-not-allowed disabled:opacity-50">
                                <Plus size={18} /> عقد جديد
                            </button>
                        )}
                    </div>
                </div>

                {/* Dashboard Stats */}
                <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold text-gray-500 mb-1">عقود باطن نشطة</p>
                        <p className="text-2xl font-black text-jilco-900">{stats.activeContracts}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold text-gray-500 mb-1">إجمالي الالتزامات (ر.س)</p>
                        <p className="text-2xl font-black text-jilco-900 font-mono">{stats.totalCommitted.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold text-gray-500 mb-1">إجمالي المستخلص المنصرف</p>
                        <p className="text-2xl font-black text-green-600 font-mono">{stats.totalPaid.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold text-gray-500 mb-1">دفعات قيد الانتظار</p>
                        <p className="text-2xl font-black text-amber-600 font-mono">{stats.totalPending.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold text-gray-500 mb-1">بانتظار الاعتماد الهندسي</p>
                        <p className="text-2xl font-black text-purple-600 font-mono">{stats.pendingEngineering}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold text-gray-500 mb-1">بانتظار الاعتماد المالي</p>
                        <p className="text-2xl font-black text-orange-600 font-mono">{stats.pendingFinance}</p>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="mb-5 flex w-full overflow-x-auto rounded-xl border border-slate-200 bg-white [&>button]:min-w-[145px] [&>button]:whitespace-nowrap [&>button]:px-4">
                    <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'dashboard' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><FileText size={18} /> نظرة عامة</button>
                    <button onClick={() => setActiveTab('subcontractors')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'subcontractors' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><Building2 size={18} /> قائمة المقاولين</button>
                    <button onClick={() => setActiveTab('contracts')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'contracts' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><Wrench size={18} /> سجل العقود</button>
                    <button onClick={() => setActiveTab('documents')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'documents' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><Printer size={18} /> مستندات التنفيذ</button>
                </div>

                {activeTab === 'documents' && <SubcontractDocumentsPanel subcontracts={subcontracts} subcontractors={subcontractors} canManage={canManage} />}

                {activeTab === 'contracts' && <div className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-in">
                    <div className="p-4 md:p-5 border-b border-slate-100 text-slate-800 flex flex-wrap items-center justify-between gap-4">
                        <div><h2 className="text-lg font-semibold">سجل عقود مقاولي الباطن</h2><p className="text-xs text-slate-500 mt-1">متابعة العقود والإنجاز والمستخلصات</p></div>
                        <span className="text-xs border border-slate-200 rounded-md px-3 py-1.5">{filteredContracts.length} عقد ظاهر</span>
                    </div>
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-slate-100">
                        {[['all','كل العقود',subcontracts.length,'text-slate-700'],['active','قيد التنفيذ',subcontracts.filter(c => c.status === 'active').length,'text-blue-700'],['draft','مسودات',subcontracts.filter(c => c.status === 'draft').length,'text-amber-700'],['completed','مكتملة',subcontracts.filter(c => c.status === 'completed').length,'text-emerald-700']].map(([value,label,count,color]) => <button key={value} onClick={() => setContractStatusFilter(value as any)} className={`text-right p-3 rounded-xl border transition ${contractStatusFilter === value ? 'border-jilco-500 ring-2 ring-jilco-100 bg-jilco-50' : 'border-slate-200 hover:bg-slate-50'}`}><span className="block text-xs font-bold text-slate-500">{label}</span><strong className={`text-xl font-black ${color}`}>{count}</strong></button>)}
                    </div>
                    <div className="px-4 py-3 flex flex-wrap gap-3 items-center bg-slate-50/70">
                        <div className="relative flex-1 min-w-[220px]"><Search size={16} className="absolute right-3 top-3 text-slate-400" /><input aria-label="بحث متقدم في سجل العقود" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="ابحث برقم العقد أو المقاول أو المشروع" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-3 text-sm font-bold outline-none focus:border-jilco-500" /></div>
                        <button onClick={() => { setSearchTerm(''); setContractStatusFilter('all'); }} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-bold hover:bg-slate-100">إعادة ضبط</button>
                        <select aria-label="حالة العقد في السجل" value={contractStatusFilter} onChange={e => setContractStatusFilter(e.target.value as typeof contractStatusFilter)} className="border border-slate-200 bg-white rounded-lg px-3 py-2.5 text-sm"><option value="all">كل الحالات</option><option value="draft">مسودة</option><option value="active">قيد التنفيذ</option><option value="completed">مكتمل</option><option value="cancelled">ملغي</option></select>
                    </div>
                </div>}

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
                    <div className="animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-4"><div><h2 className="font-black text-slate-900">دليل المقاولين</h2><p className="mt-1 text-xs font-bold text-slate-500">بيانات التواصل والتخصص والتقييم والحالة</p></div><span className="rounded-full bg-jilco-50 px-3 py-1.5 text-xs font-black text-jilco-700">{filteredSubcontractors.length} مقاول</span></div>
                        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-4">اسم المقاول</th>
                                    <th className="p-4">التخصص</th>
                                    <th className="p-4">التواصل</th>
                                    <th className="p-4 text-center">العقود</th>
                                    <th className="p-4 text-center">التقييم</th>
                                    <th className="p-4 text-center">الحالة</th>
                                    <th className="p-4 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                {filteredSubcontractors.map(sub => (
                                    <tr key={sub.id} className="transition-colors hover:bg-jilco-50/40">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-jilco-50 font-black text-jilco-800">{sub.name?.trim().charAt(0) || 'م'}</span><p className="border-r-2 border-jilco-500 pr-2 text-jilco-900">{sub.name}</p></div>
                                        </td>
                                        <td className="p-4">{sub.specialty}</td>
                                        <td className="p-4">
                                            <p className="text-xs">{sub.contactPerson}</p>
                                            <p className="font-mono text-xs mt-1" dir="ltr">{sub.phone}</p>
                                        </td>
                                        <td className="p-4 text-center"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{subcontracts.filter(c => c.subcontractorId === sub.id).length}</span></td>
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
                                                <button disabled={busy || !canManage} title="حذف المقاول" onClick={() => deleteSubcontractor(sub.id)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredSubcontractors.length === 0 && (
                                    <tr><td colSpan={7} className="p-10 text-center text-slate-400">لا توجد نتائج مطابقة. جرّب تغيير البحث أو أضف مقاولًا جديدًا.</td></tr>
                                )}
                            </tbody>
                        </table></div>
                    </div>
                )}

                {/* Contracts Tab */}
                {activeTab === 'contracts' && (
                    <div className="animate-fade-in space-y-4">
                        <div className="flex flex-wrap gap-3 items-center text-sm"><label className="inline-flex gap-2 items-center"><input type="checkbox" checked={showArchivedContracts} onChange={e => { setShowArchivedContracts(e.target.checked); setExpandedContractId(null); }} /> العقود المؤرشفة ({subcontracts.filter(c => c.archived).length})</label><span className="text-xs text-slate-500">الأرشفة تخفي السجل وتحافظ على بياناته المالية.</span></div>
                        <SubcontractRegister contracts={filteredContracts} selectedId={expandedContractId} onSelect={setExpandedContractId} onRemove={c => void handleRemoveContract(c)} canManage={canManage} busy={busy} />
                        {filteredContracts.filter(c => c.id === expandedContractId).map(contract => (
                            <div id="subcontract-detail" key={contract.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-3 justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <h3 className="font-bold text-lg text-jilco-900 font-mono border-r-4 border-jilco-600 pr-3">{contract.number}</h3>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${contract.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                            contract.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                contract.status === 'draft' ? 'bg-gray-200 text-gray-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {contract.status === 'active' ? 'قيد التنفيذ' : contract.status === 'completed' ? 'مكتمل' : contract.status === 'cancelled' ? 'ملغي' : 'مسودة'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button aria-label="إغلاق تفاصيل العقد" onClick={() => setExpandedContractId(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
                                        {contract.status === 'draft' && <button disabled={busy || !canManage} onClick={() => void updateSubcontract(contract.id, { status: 'active' })} className="text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-emerald-100 disabled:opacity-50"><CheckCircle2 size={14} /> تفعيل العقد</button>}
                                        <button onClick={() => { setCurrentSubcontract(contract); setShowSubcontractForm(true); }} className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-blue-100"><Edit size={14} /> تعديل</button>
                                        <button disabled={busy || !canManage} onClick={() => void handleRemoveContract(contract)} className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-red-100"><Trash2 size={14} /> {contract.archived ? 'استعادة العقد' : 'حذف / أرشفة'}</button>
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

                                <div className="p-4 border-t print:hidden">
                                    <label className="font-bold">مرفقات العقد
                                        <input type="file" disabled={busy || !canManage} accept="application/pdf,image/png,image/jpeg,image/webp" onChange={async e => {
                                            const file = e.target.files?.[0]; if (file) await uploadSubcontractAttachment(contract.id, file, file.type === 'application/pdf' ? 'pdf' : 'image'); e.target.value = '';
                                        }} />
                                    </label>
                                    {contract.attachments?.map(a => <button key={a.id} className="m-2 text-blue-700 underline" onClick={async () => {
                                        try { if (a.storagePath) window.open(await subcontractService.attachmentUrl(a.storagePath), '_blank', 'noopener,noreferrer'); }
                                        catch (e: any) { alert(e.message); }
                                    }}>{a.name}</button>)}
                                </div>
                                {/* Payments / المستخلصات */}
                                <div className="p-4 border-t border-gray-100 bg-white">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2"><DollarSign size={16} className="text-green-600" /> سجل الدفعات والمستخلصات</h4>
                                        <button disabled={!canManage || busy || contract.status !== 'active'} title={contract.status !== 'active' ? 'فعّل العقد أولاً' : 'إضافة دفعة مستحقة'} onClick={() => { setSelectedContractId(contract.id); setCurrentPayment({ status: 'pending', dueDate: new Date().toISOString().split('T')[0] }); setShowPaymentForm(true); }} className="text-xs font-bold bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-100 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                                            <Plus size={14} /> إضافة دفعة مستحقة
                                        </button>
                                    </div>
                                    <label className="inline-flex gap-2 items-center text-xs mb-3"><input type="checkbox" checked={showArchivedPayments} onChange={e => setShowArchivedPayments(e.target.checked)} /> عرض الدفعات المؤرشفة</label>
                                    {(!contract.payments || contract.payments.filter(p => Boolean(p.archived) === showArchivedPayments).length === 0) ? (
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
                                                    {contract.payments.filter(p => Boolean(p.archived) === showArchivedPayments).map(payment => (
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
                                                                {!payment.archived && payment.status === 'pending' && (payment.engineerApprovedAt ? canFinance : canEngineer) && (
                                                                    <button title="اعتماد" onClick={() => updatePaymentStatus(contract.id, payment.id, 'approved')} className="bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 border border-blue-100">{payment.engineerApprovedAt ? 'اعتماد مالي' : 'اعتماد هندسي'}</button>
                                                                )}
                                                                {!payment.archived && payment.status === 'approved' && canFinance && (
                                                                    <button title="تحويل كمنصرف" onClick={() => setPayingPayment({
                                                                        contractId: contract.id,
                                                                        paymentId: payment.id,
                                                                        amount: payment.amount,
                                                                        paymentMethod: 'transfer',
                                                                        referenceNumber: '',
                                                                        paymentDate: new Date().toISOString().split('T')[0]
                                                                    })} className="bg-green-50 text-green-600 px-2 py-1 rounded hover:bg-green-100 border border-green-100">تحويل كمنصرف</button>
                                                                )}
                                                                <button disabled={busy || !canManage} title={payment.archived ? 'استعادة الدفعة' : 'حذف / أرشفة الدفعة'} onClick={() => handleDeletePayment(contract.id, payment.id)} className="bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100 border border-red-100">{payment.archived ? 'استعادة' : <Trash2 size={16} />}</button>
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
            {payingPayment && renderPayPaymentForm()}

            {statementSubcontractor && <SubcontractStatement contractor={statementSubcontractor} contracts={subcontracts} onClose={() => setStatementSubcontractor(null)} />}

            {printingPayment && (
                <div className="fixed inset-0 bg-white z-[9999] flex justify-center items-start overflow-y-auto print:!absolute print:!inset-0 print:!block print:!bg-white print:!z-[99999] print:!h-auto print:!overflow-visible">
                    <div className="bg-white mx-auto mt-10 p-10 w-[210mm] min-h-[148mm] relative print:!shadow-none print:!m-0 print:!p-0 print:!opacity-100 print:!visible animate-fade-in">
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

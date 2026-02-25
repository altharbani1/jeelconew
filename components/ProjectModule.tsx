
import React, { useState, useEffect } from 'react';
import { Project, ProjectPhase, ProjectStatus, PhaseStatus, Expense, PurchaseInvoice } from '../types';
import {
    Plus, LayoutDashboard, Search, Calendar,
    DollarSign, Briefcase, ArrowLeft, Trash2, Edit,
    Save, X, CheckCircle2, Clock, AlertCircle, PieChart, Printer, FileText, ShoppingBag, Wallet, PackageMinus
} from 'lucide-react';
import { useData } from '../contexts/DataContext.tsx';
import { useSales } from '../contexts/SalesContext.tsx';
import { useInventory } from '../contexts/InventoryContext.tsx';
import { useProject } from '../contexts/ProjectContext.tsx';
import { useHR } from '../contexts/HRContext.tsx';

// --- Default Phases Generator ---
const createDefaultPhases = (projectId: string): ProjectPhase[] => [
    { id: `PH-${Date.now()}-1`, projectId, name: '1. التجهيزات المدنية وتجهيز البئر', phaseIndex: 0, status: 'not_started', startDate: '', endDate: '', expectedCost: 0, actualCost: 0, progressPercentage: 0, assignedTo: '', assignedToName: '', notes: '' },
    { id: `PH-${Date.now()}-2`, projectId, name: '2. تركيب السكك والأبواب (الميكانيكا)', phaseIndex: 1, status: 'not_started', startDate: '', endDate: '', expectedCost: 0, actualCost: 0, progressPercentage: 0, assignedTo: '', assignedToName: '', notes: '' },
    { id: `PH-${Date.now()}-3`, projectId, name: '3. تركيب الماكينة والمحرك', phaseIndex: 2, status: 'not_started', startDate: '', endDate: '', expectedCost: 0, actualCost: 0, progressPercentage: 0, assignedTo: '', assignedToName: '', notes: '' },
    { id: `PH-${Date.now()}-4`, projectId, name: '4. الأعمال الكهربائية والكنترول', phaseIndex: 0, status: 'not_started', startDate: '', endDate: '', expectedCost: 0, actualCost: 0, progressPercentage: 0, assignedTo: '', assignedToName: '', notes: '' },
    { id: `PH-${Date.now()}-5`, projectId, name: '5. التشغيل التجريبي والتسليم', phaseIndex: 0, status: 'not_started', startDate: '', endDate: '', expectedCost: 0, actualCost: 0, progressPercentage: 0, assignedTo: '', assignedToName: '', notes: '' }
];

const StatusBadge = ({ status }: { status: ProjectStatus | PhaseStatus }) => {
    const styles = {
        not_started: 'bg-gray-100 text-gray-600',
        in_progress: 'bg-blue-100 text-blue-700',
        completed: 'bg-green-100 text-green-700',
        stopped: 'bg-red-100 text-red-700',
        late: 'bg-amber-100 text-amber-700'
    };
    const labels = {
        not_started: 'لم تبدأ',
        in_progress: 'قيد التنفيذ',
        completed: 'مكتملة',
        stopped: 'متوقف',
        late: 'متأخرة'
    };
    return <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border border-transparent ${styles[status] || styles.not_started}`}>{labels[status] || status}</span>;
};

export const ProjectModule: React.FC = () => {
    const {
        projects, phases, expenses: allExpenses,
        saveProjectRecord: saveRecord,
        deleteProjectRecord: deleteRecordLocallyAndCloud
    } = useProject();
    const { invoices: allInvoices } = useSales();
    const { supplierProducts, inventoryTransactions, saveInventoryRecord } = useInventory();
    const { hrEmployees: employees = [] } = useHR();

    const [viewMode, setViewMode] = useState<'dashboard' | 'list' | 'details' | 'statement'>('dashboard');

    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Material Issue State
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [issueProductId, setIssueProductId] = useState('');
    const [issueQuantity, setIssueQuantity] = useState<number>(1);
    const [issueNotes, setIssueNotes] = useState('');

    // Attachments State (Mock)
    const [showAttachmentModal, setShowAttachmentModal] = useState(false);

    // New Project Form State
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [newProject, setNewProject] = useState<Partial<Project>>({
        name: '', clientName: '', startDate: new Date().toISOString().split('T')[0], totalExpectedCost: 0, status: 'not_started'
    });

    // Load Data Action from Dashboard
    useEffect(() => {
        try {
            // Check for direct navigation request (from dashboard)
            const navId = localStorage.getItem('jilco_nav_project_id');
            if (navId) {
                setSelectedProjectId(navId);
                setViewMode('details');
                localStorage.removeItem('jilco_nav_project_id');
            }
        } catch (e) { console.error(e); }
    }, []);

    // --- Actions ---

    const handleCreateProject = async () => {
        if (!newProject.name || !newProject.clientName) return alert('يرجى تعبئة اسم المشروع والعميل');

        const projectId = `PRJ-${Date.now()}`;
        const projectData: Project = {
            ...newProject as Project,
            id: projectId,
            totalActualCost: 0,
            progress: 0,
            endDate: '',
            notes: '',
            type: 'residential'
        };

        const defaultPhases = createDefaultPhases(projectId);

        // Save Project
        await saveRecord('jilco_projects', projectId, projectData);

        // Save Phases
        for (const phase of defaultPhases) {
            await saveRecord('jilco_phases', phase.id, phase);
        }

        setShowNewProjectModal(false);
        setNewProject({ name: '', clientName: '', startDate: new Date().toISOString().split('T')[0], totalExpectedCost: 0, status: 'not_started' });

        // Auto open details
        setSelectedProjectId(projectId);
        setViewMode('details');
    };

    const handleDeleteProject = async (id: string) => {
        if (window.confirm('حذف المشروع سيحذف جميع مراحله وسجلاته. هل أنت متأكد؟')) {
            // Delete project
            await deleteRecordLocallyAndCloud('jilco_projects', id);

            // Delete associated phases
            const projectPhases = phases.filter(ph => ph.projectId === id);
            for (const phase of projectPhases) {
                await deleteRecordLocallyAndCloud('jilco_phases', phase.id);
            }

            if (selectedProjectId === id) {
                setViewMode('list');
                setSelectedProjectId(null);
            }
        }
    };

    const updatePhase = async (phaseId: string, updates: Partial<ProjectPhase>) => {
        const phaseToUpdate = phases.find(ph => ph.id === phaseId);
        if (!phaseToUpdate) return;

        const updatedPhase = { ...phaseToUpdate, ...updates };

        // Auto-calculate Late status
        if (updatedPhase.endDate && updatedPhase.status !== 'completed' && updatedPhase.status !== 'stopped') {
            const today = new Date().toISOString().split('T')[0];
            if (today > updatedPhase.endDate) {
                updatedPhase.status = 'late';
            } else if (updatedPhase.status === 'late') {
                // Remove late status if date is updated to future and it was previously late
                updatedPhase.status = 'in_progress';
            }
        }

        await saveRecord('jilco_phases', phaseId, updatedPhase);

        // Auto Update Project Progress & Cost based on phases ONLY
        if (selectedProjectId) {
            // get latest phases plus the updated one
            const projectPhases = phases.filter(p => p.projectId === selectedProjectId).map(p => p.id === phaseId ? updatedPhase : p);

            const totalProgress = projectPhases.reduce((sum, p) => sum + (p.progressPercentage || 0), 0);
            const avgProgress = projectPhases.length > 0 ? Math.round(totalProgress / projectPhases.length) : 0;

            const projToUpdate = projects.find(p => p.id === selectedProjectId);
            if (projToUpdate) {
                const updatedProj = { ...projToUpdate, progress: avgProgress };
                await saveRecord('jilco_projects', selectedProjectId, updatedProj);
            }
        }
    };

    // --- Financial Logic ---
    const getProjectFinancials = (projectId: string) => {
        const projectExpenses = allExpenses.filter(e => e.projectId === projectId);
        const projectInvoices = allInvoices.filter(i => i.projectId === projectId);
        const projectMaterials = inventoryTransactions.filter(t => t.type === 'out' && t.referenceSource === 'project' && t.referenceId === projectId);

        const totalExpenses = projectExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalInvoices = projectInvoices.reduce((sum, i) => sum + i.grandTotal, 0);

        // Calculate materials cost live based on current product prices
        const totalMaterialsCost = projectMaterials.reduce((sum, trx) => {
            const prod = supplierProducts.find(p => p.id === trx.productId);
            return sum + (trx.quantity * (prod?.purchasePrice || 0));
        }, 0);

        return {
            expenses: projectExpenses,
            invoices: projectInvoices,
            materials: projectMaterials,
            totalCost: totalExpenses + totalInvoices + totalMaterialsCost,
            totalExpenses,
            totalInvoices,
            totalMaterialsCost
        };
    };

    const handleIssueMaterial = async () => {
        if (!selectedProjectId || !issueProductId || issueQuantity <= 0) return;

        const product = supplierProducts.find(p => p.id === issueProductId);
        if (!product) return;

        if ((product.currentQuantity || 0) < issueQuantity) {
            return alert(`الكمية المتوفرة في المستودع (${product.currentQuantity || 0}) أقل من المطلوب (${issueQuantity})`);
        }

        const project = projects.find(p => p.id === selectedProjectId);

        const trx = {
            id: `INV-TRX-PRJ-${Date.now()}`,
            productId: product.id,
            productName: product.name,
            date: new Date().toISOString().split('T')[0],
            type: 'out' as const,
            quantity: issueQuantity,
            referenceSource: 'project' as const,
            referenceId: project?.id,
            referenceName: project?.name,
            notes: issueNotes || `صرف لمشروع ${project?.name}`
        };

        const updatedProduct = { ...product, currentQuantity: (product.currentQuantity || 0) - issueQuantity };

        await saveInventoryRecord('jilco_inventory_transactions', trx.id, trx);
        await saveInventoryRecord('jilco_supplier_products', updatedProduct.id, updatedProduct);

        setShowMaterialModal(false);
        setIssueProductId('');
        setIssueQuantity(1);
        setIssueNotes('');
    };

    // --- Renderers ---

    const renderNewProjectModal = () => (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-fade-in">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h3 className="text-xl font-bold text-jilco-900">تسجيل مشروع جديد</h3>
                    <button onClick={() => setShowNewProjectModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">اسم المشروع</label>
                        <input type="text" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} className="w-full p-3 border border-gray-400 rounded-lg text-black font-bold bg-white focus:ring-2 focus:ring-jilco-500 outline-none" placeholder="مثال: فيلا حي الملقا" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">اسم العميل</label>
                        <input type="text" value={newProject.clientName} onChange={e => setNewProject({ ...newProject, clientName: e.target.value })} className="w-full p-3 border border-gray-400 rounded-lg text-black font-bold bg-white focus:ring-2 focus:ring-jilco-500 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ البداية</label>
                            <input type="date" value={newProject.startDate} onChange={e => setNewProject({ ...newProject, startDate: e.target.value })} className="w-full p-3 border border-gray-400 rounded-lg text-black font-bold bg-white focus:ring-2 focus:ring-jilco-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">التكلفة التقديرية</label>
                            <input type="number" value={newProject.totalExpectedCost} onChange={e => setNewProject({ ...newProject, totalExpectedCost: parseFloat(e.target.value) })} className="w-full p-3 border border-gray-400 rounded-lg text-black font-bold bg-white focus:ring-2 focus:ring-jilco-500 outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">حالة المشروع</label>
                        <select value={newProject.status} onChange={e => setNewProject({ ...newProject, status: e.target.value as any })} className="w-full p-3 border border-gray-400 rounded-lg text-black font-bold bg-white focus:ring-2 focus:ring-jilco-500 outline-none">
                            <option value="not_started">لم يبدأ</option>
                            <option value="in_progress">قيد التنفيذ</option>
                        </select>
                    </div>
                </div>
                <div className="mt-8 flex justify-end gap-3">
                    <button onClick={() => setShowNewProjectModal(false)} className="px-6 py-2.5 text-gray-600 font-bold bg-gray-100 rounded-lg hover:bg-gray-200">إلغاء</button>
                    <button onClick={handleCreateProject} className="px-6 py-2.5 bg-jilco-900 text-white font-bold rounded-lg hover:bg-jilco-800 flex items-center gap-2">
                        <Save size={18} /> حفظ المشروع
                    </button>
                </div>
            </div>
        </div>
    );

    // --- Statement View ---
    const renderProjectStatement = () => {
        if (!selectedProjectId) return null;
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) return null;

        const { expenses, invoices, materials, totalCost, totalExpenses, totalInvoices, totalMaterialsCost } = getProjectFinancials(selectedProjectId);

        // Merge and sort transactions
        const transactions = [
            ...expenses.map(e => ({ date: e.date, type: 'expense', desc: e.description || e.paidTo, amount: e.amount, ref: e.number, cat: 'مصروفات' })),
            ...invoices.map(i => ({ date: i.date, type: 'invoice', desc: `فاتورة مورد: ${i.items?.[0]?.description || 'مواد'}`, amount: i.grandTotal, ref: i.number, cat: 'مشتريات' })),
            ...materials.map(m => {
                const prod = supplierProducts.find(p => p.id === m.productId);
                return { date: m.date, type: 'material', desc: `صرف من المستودع: ${m.productName} (${m.quantity} ${prod?.unit || 'حبة'})`, amount: m.quantity * (prod?.purchasePrice || 0), ref: m.id.slice(-6), cat: 'مواد مستودع' }
            })
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return (
            <div className="flex-1 bg-gray-200 p-8 overflow-auto flex justify-center items-start print:p-0 print:bg-white print:w-full print:block print:overflow-visible">
                <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-0 relative flex flex-col print:shadow-none print:w-full print:min-h-0 print:h-auto">
                    {/* Header */}
                    <div className="px-10 py-6 border-b-2 border-jilco-900 flex justify-between items-center">
                        <div className="w-1/3 text-right">
                            <h1 className="text-xl font-black text-jilco-900">جيلكو للمصاعد</h1>
                            <p className="text-xs font-bold text-gray-500">JILCO ELEVATORS</p>
                        </div>
                        <div className="w-1/3 text-center">
                            <h2 className="text-2xl font-black text-black border-2 border-black px-4 py-1 inline-block rounded-lg uppercase">كشف حساب مشروع</h2>
                        </div>
                        <div className="w-1/3 text-left">
                            <p className="text-xs font-bold text-gray-500">تاريخ التقرير</p>
                            <p className="font-mono text-sm">{new Date().toLocaleDateString('en-GB')}</p>
                        </div>
                    </div>

                    {/* Project Info */}
                    <div className="px-10 py-6 bg-gray-50 border-b border-gray-200">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs font-bold text-gray-500 mb-1">اسم المشروع</p>
                                <h3 className="text-lg font-black text-jilco-900">{project.name}</h3>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 mb-1">العميل</p>
                                <h3 className="text-lg font-black text-gray-800">{project.clientName}</h3>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 mb-1">تاريخ البداية</p>
                                <p className="font-mono font-bold text-black">{project.startDate}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 mb-1">الميزانية التقديرية</p>
                                <p className="font-mono font-bold text-black">{project.totalExpectedCost.toLocaleString()} SAR</p>
                            </div>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="px-10 py-6 grid grid-cols-4 gap-4">
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                            <p className="text-xs font-bold text-red-800 mb-1">مصروفات إدارية ونثرية</p>
                            <p className="text-xl font-black text-red-600 font-mono">{totalExpenses.toLocaleString()}</p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                            <p className="text-xs font-bold text-blue-800 mb-1">مشتريات للمشروع</p>
                            <p className="text-xl font-black text-blue-600 font-mono">{totalInvoices.toLocaleString()}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-center">
                            <p className="text-xs font-bold text-purple-800 mb-1">مسحوبات من المخزون</p>
                            <p className="text-xl font-black text-purple-600 font-mono">{totalMaterialsCost.toLocaleString()}</p>
                        </div>
                        <div className="bg-jilco-900 p-4 rounded-xl text-white text-center shadow-lg">
                            <p className="text-xs font-bold text-gray-300 mb-1">التكلفة الفعلية الشاملة</p>
                            <p className="text-2xl font-black text-gold-400 font-mono">{totalCost.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Transaction Table */}
                    <div className="px-10 py-4 flex-1">
                        <h4 className="font-bold text-sm text-gray-800 mb-4 border-b pb-2">سجل العمليات المالية (تفصيلي)</h4>
                        <table className="w-full text-xs text-right border-collapse">
                            <thead>
                                <tr className="bg-gray-100 text-gray-700">
                                    <th className="p-2 border border-gray-300 w-10 text-center">#</th>
                                    <th className="p-2 border border-gray-300 w-24">التاريخ</th>
                                    <th className="p-2 border border-gray-300 w-24">النوع</th>
                                    <th className="p-2 border border-gray-300 w-24">رقم المرجع</th>
                                    <th className="p-2 border border-gray-300">البيان / الوصف</th>
                                    <th className="p-2 border border-gray-300 w-24 text-center">المبلغ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-400 font-bold">لا توجد عمليات مالية مسجلة</td></tr>}
                                {transactions.map((tx, idx) => (
                                    <tr key={idx} className="border border-gray-300">
                                        <td className="p-2 border border-gray-300 text-center">{idx + 1}</td>
                                        <td className="p-2 border border-gray-300 font-mono">{tx.date}</td>
                                        <td className="p-2 border border-gray-300">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tx.type === 'expense' ? 'bg-red-100 text-red-700' : tx.type === 'material' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {tx.cat}
                                            </span>
                                        </td>
                                        <td className="p-2 border border-gray-300 font-mono font-bold">{tx.ref}</td>
                                        <td className="p-2 border border-gray-300 font-medium truncate max-w-[200px]">{tx.desc}</td>
                                        <td className="p-2 border border-gray-300 text-center font-mono font-bold">{tx.amount.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Actions (Hidden Print) */}
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 print:hidden">
                        <button onClick={() => window.print()} className="bg-jilco-900 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-black flex items-center gap-2" title="طباعة">
                            <Printer size={18} /> طباعة الكشف
                        </button>
                        <button onClick={() => setViewMode('details')} className="bg-white text-gray-700 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-gray-50 flex items-center gap-2 border border-gray-200" title="رجوع">
                            <ArrowLeft size={18} /> رجوع
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // --- Client Progress Report ---
    const renderClientReport = () => {
        if (!selectedProjectId) return null;
        const project = projects.find(p => p.id === selectedProjectId);
        const projPhases = phases.filter(p => p.projectId === selectedProjectId);
        if (!project) return null;

        return (
            <div className="flex-1 bg-gray-200 p-8 overflow-auto flex justify-center items-start print:p-0 print:bg-white print:w-full print:block print:overflow-visible">
                <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-0 relative flex flex-col print:shadow-none print:w-full print:min-h-0 print:h-auto">
                    {/* Header */}
                    <div className="px-10 py-8 border-b-2 border-jilco-900 flex justify-between items-center">
                        <div className="w-1/3 text-right">
                            <h1 className="text-xl font-black text-jilco-900">جيلكو للمصاعد</h1>
                            <p className="text-xs font-bold text-gray-500">JILCO ELEVATORS</p>
                        </div>
                        <div className="w-1/3 text-center">
                            <h2 className="text-2xl font-black text-jilco-900 tracking-wider">تقرير إنجاز مشروع</h2>
                        </div>
                        <div className="w-1/3 text-left">
                            <p className="text-xs font-bold text-gray-500">تاريخ التقرير</p>
                            <p className="font-mono text-sm">{new Date().toLocaleDateString('en-GB')}</p>
                        </div>
                    </div>

                    {/* Project Info */}
                    <div className="px-10 py-8 bg-gray-50 border-b border-gray-200">
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <p className="text-sm font-bold text-gray-500 mb-2">اسم المشروع</p>
                                <h3 className="text-2xl font-black text-jilco-900">{project.name}</h3>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-500 mb-2">اسم العميل</p>
                                <h3 className="text-2xl font-black text-gray-800">{project.clientName}</h3>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-500 mb-2">تاريخ بداية المشروع</p>
                                <p className="font-mono font-bold text-lg text-black">{project.startDate || 'غير محدد'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-500 mb-2">نسبة الإنجاز الكلية</p>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 bg-gray-300 rounded-full h-4">
                                        <div className="bg-jilco-600 h-4 rounded-full" style={{ width: `${project.progress}%` }}></div>
                                    </div>
                                    <span className="font-black text-xl text-jilco-900">{project.progress}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Phases Timeline */}
                    <div className="px-10 py-8 flex-1">
                        <h4 className="font-black text-lg text-gray-800 mb-8 pb-4 border-b-2 border-gray-200 text-center relative">
                            <span className="bg-white px-4 relative z-10">الجدول الزمني ومراحل الإنجاز</span>
                            <div className="absolute top-full left-1/2 w-32 h-1 bg-gold-400 -translate-x-1/2 -mt-1"></div>
                        </h4>

                        <div className="space-y-6 relative before:absolute before:inset-0 before:mr-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-1 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:to-transparent">
                            {projPhases.map((phase, idx) => {
                                const isCompleted = phase.status === 'completed';
                                const isInProgress = phase.status === 'in_progress';

                                return (
                                    <div key={phase.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active text-right">
                                        {/* Status Dot */}
                                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-md relative z-10 ${isCompleted ? 'bg-green-500' : isInProgress ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                            {isCompleted ? <CheckCircle2 className="text-white" size={20} /> : <div className="w-3 h-3 bg-white rounded-full"></div>}
                                        </div>

                                        {/* Card */}
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-4 rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow">
                                            <div className="flex items-center justify-between space-x-2 space-x-reverse mb-2">
                                                <div className="font-black text-jilco-900">{phase.name}</div>
                                            </div>
                                            <div className="text-sm text-gray-600 mb-3 grid grid-cols-2 gap-2">
                                                <div>
                                                    <span className="font-bold text-gray-400 text-xs">البداية:</span>
                                                    <br />{phase.startDate || 'غير محدد'}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-gray-400 text-xs">النهاية (المتوقعة):</span>
                                                    <br />{phase.endDate || 'غير محدد'}
                                                </div>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2">
                                                <div className={`h-2 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${phase.progressPercentage || 0}%` }}></div>
                                            </div>
                                            <div className="mt-1 text-left text-xs font-bold text-gray-500">{phase.progressPercentage || 0}%</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-auto px-10 py-6 border-t-4 border-jilco-900 text-center">
                        <p className="font-bold text-lg text-jilco-900">نلتزم بتقديم أعلى معايير الجودة والأمان.</p>
                        <p className="text-sm text-gray-500 mt-2">شكراً لاختياركم جيلكو للمصاعد.</p>
                    </div>

                    {/* Actions (Hidden Print) */}
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 print:hidden">
                        <button onClick={() => window.print()} className="bg-jilco-900 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-black flex items-center gap-2" title="طباعة">
                            <Printer size={18} /> طباعة التقرير للعميل
                        </button>
                        <button onClick={() => setViewMode('details')} className="bg-white text-gray-700 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-gray-50 flex items-center gap-2 border border-gray-200" title="رجوع">
                            <ArrowLeft size={18} /> رجوع
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- List View ---
    if (viewMode === 'list' || viewMode === 'dashboard') {
        const stats = {
            total: projects.length,
            active: projects.filter(p => p.status === 'in_progress').length,
            completed: projects.filter(p => p.status === 'completed').length
        };

        return (
            <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in relative">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                                <Briefcase className="text-gold-500" /> إدارة المشاريع
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">متابعة سير العمل، المراحل، والتكاليف</p>
                        </div>
                        <button onClick={() => setShowNewProjectModal(true)} className="bg-jilco-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md">
                            <Plus size={20} /> مشروع جديد
                        </button>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-6 mb-8">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-xs font-bold text-gray-500 mb-1">إجمالي المشاريع</p>
                            <p className="text-3xl font-black text-jilco-900">{stats.total}</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-xs font-bold text-gray-500 mb-1">مشاريع نشطة</p>
                            <p className="text-3xl font-black text-blue-600">{stats.active}</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-xs font-bold text-gray-500 mb-1">مشاريع مكتملة</p>
                            <p className="text-3xl font-black text-green-600">{stats.completed}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                            <div className="relative max-w-md">
                                <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                                <input
                                    type="text" placeholder="بحث باسم المشروع أو العميل..."
                                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pr-10 pl-4 py-2 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold focus:ring-2 focus:ring-jilco-500 outline-none"
                                />
                            </div>
                        </div>
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-50 text-gray-500 font-medium">
                                <tr>
                                    <th className="p-4">المشروع</th>
                                    <th className="p-4">العميل</th>
                                    <th className="p-4">تاريخ البداية</th>
                                    <th className="p-4">نسبة الإنجاز</th>
                                    <th className="p-4">الحالة</th>
                                    <th className="p-4 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {projects.filter(p => p.name.includes(searchTerm) || p.clientName.includes(searchTerm)).map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 group cursor-pointer" onClick={() => { setSelectedProjectId(p.id); setViewMode('details'); }}>
                                        <td className="p-4 font-bold text-jilco-900">{p.name}</td>
                                        <td className="p-4 font-bold text-gray-700">{p.clientName}</td>
                                        <td className="p-4 font-mono text-xs text-gray-500">{p.startDate}</td>
                                        <td className="p-4">
                                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                <div className="bg-jilco-600 h-2.5 rounded-full" style={{ width: `${p.progress}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-500 mt-1 block">{p.progress}%</span>
                                        </td>
                                        <td className="p-4"><StatusBadge status={p.status} /></td>
                                        <td className="p-4 flex justify-center gap-2" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => { setSelectedProjectId(p.id); setViewMode('details'); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit size={16} /></button>
                                            <button onClick={() => handleDeleteProject(p.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {projects.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-gray-400">لا توجد مشاريع مسجلة.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
                {showNewProjectModal && renderNewProjectModal()}
            </div>
        );
    }

    // --- Details View ---
    if (viewMode === 'statement') return renderProjectStatement();
    if (viewMode === 'client_report') return renderClientReport();

    const currentProject = projects.find(p => p.id === selectedProjectId);
    const projectPhases = phases.filter(p => p.projectId === selectedProjectId);

    if (!currentProject) return null;

    // Calculate live cost summary for detail view card
    const financials = getProjectFinancials(currentProject.id);

    return (
        <div className="flex-1 bg-gray-100 p-6 overflow-hidden h-full flex flex-col animate-fade-in">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-jilco-900 flex items-center gap-2">
                        <Briefcase className="text-gold-500" /> {currentProject.name}
                    </h2>
                    <p className="text-gray-500 text-sm font-bold mt-1">العميل: {currentProject.clientName}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowMaterialModal(true)}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-sm"
                    >
                        <PackageMinus size={18} /> صرف مواد من المخزون
                    </button>
                    <button
                        onClick={() => setViewMode('client_report')}
                        className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-black shadow-sm"
                        title="تقرير العميل"
                    >
                        <FileText size={18} /> تقرير إنجاز العميل
                    </button>
                    <button
                        onClick={() => setViewMode('statement')}
                        className="bg-jilco-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-800 shadow-sm"
                        title="كشف مالي"
                    >
                        <PieChart size={18} /> كشف حساب مالي
                    </button>
                    <button onClick={() => setViewMode('list')} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-50" title="رجوع">
                        <ArrowLeft size={18} /> رجوع
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-10">
                {/* Cost Summary Card */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6 flex justify-between items-center">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 rounded-lg text-red-600"><Wallet size={20} /></div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold">مصروفات نقدية</p>
                                <p className="text-lg font-black text-red-700 font-mono">{financials.totalExpenses.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 border-r pr-4 border-gray-200">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><ShoppingBag size={20} /></div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold">مشتريات الموردين</p>
                                <p className="text-lg font-black text-blue-700 font-mono">{financials.totalInvoices.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 border-r pr-4 border-gray-200">
                            <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><PackageMinus size={20} /></div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold">مواد من المخزون</p>
                                <p className="text-lg font-black text-purple-700 font-mono">{financials.totalMaterialsCost.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-left">
                        <p className="text-xs text-gray-500 font-bold mb-1">إجمالي التكلفة الفعلية</p>
                        <p className="text-2xl font-black text-jilco-900 font-mono">{financials.totalCost.toLocaleString()} SAR</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {projectPhases.map((phase, idx) => (
                        <div key={phase.id} className={`bg-white p-5 rounded-2xl border-t-4 shadow-sm border-gray-200 flex flex-col ${phase.status === 'completed' ? 'border-t-green-500' : phase.status === 'in_progress' ? 'border-t-blue-500' : phase.status === 'late' ? 'border-t-amber-500' : 'border-t-gray-300'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <h4 className="font-bold text-gray-800 text-base">{phase.name}</h4>
                                <StatusBadge status={phase.status} />
                            </div>

                            <div className="space-y-4 flex-1">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">تاريخ البداية (المتوقع)</label>
                                        <input
                                            type="date"
                                            value={phase.startDate || ''}
                                            onChange={e => updatePhase(phase.id, { startDate: e.target.value })}
                                            className="w-full p-2 border border-gray-400 rounded-lg text-xs font-bold bg-white text-black focus:ring-2 focus:ring-jilco-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">تاريخ النهاية (المستهدف)</label>
                                        <input
                                            type="date"
                                            value={phase.endDate || ''}
                                            onChange={e => updatePhase(phase.id, { endDate: e.target.value })}
                                            className={`w-full p-2 border rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-jilco-500 outline-none ${phase.status === 'late' ? 'border-red-500 text-red-600' : 'border-gray-400 text-black'}`}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">إسناد إلى مهندس / فني</label>
                                    <select
                                        value={phase.assignedTo || ''}
                                        onChange={e => {
                                            const emp = employees.find(emp => emp.id === e.target.value);
                                            updatePhase(phase.id, { assignedTo: e.target.value, assignedToName: emp ? emp.name : '' });
                                        }}
                                        className="w-full p-2 border border-gray-400 rounded-lg text-xs bg-white text-black font-bold focus:ring-2 focus:ring-jilco-500 outline-none"
                                    >
                                        <option value="">-- غير مسند لأحد --</option>
                                        {employees.filter(emp => emp.role === 'technician' || emp.role === 'manager').map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.role === 'technician' ? 'فني' : 'مهندس/مشرف'})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">حالة المرحلة</label>
                                        <select
                                            value={phase.status}
                                            onChange={e => updatePhase(phase.id, { status: e.target.value as any })}
                                            className={`w-full p-2 border rounded-lg text-xs font-bold focus:ring-2 focus:ring-jilco-500 outline-none ${phase.status === 'late' ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-black border-gray-400'}`}
                                        >
                                            <option value="not_started">لم تبدأ</option>
                                            <option value="in_progress">قيد التنفيذ</option>
                                            <option value="completed">مكتملة</option>
                                            <option value="stopped">متوقفة</option>
                                            <option value="late" disabled>متأخرة (تلقائي)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">نسبة الإنجاز %</label>
                                        <input
                                            type="number" min="0" max="100"
                                            value={phase.progressPercentage || 0}
                                            onChange={e => updatePhase(phase.id, { progressPercentage: parseInt(e.target.value) })}
                                            className="w-full p-2 border border-gray-400 rounded-lg text-xs text-center font-bold bg-white text-black"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">التكلفة التقديرية للمرحلة (للميزانية فقط)</label>
                                        <input
                                            type="number"
                                            value={phase.expectedCost || 0}
                                            onChange={e => updatePhase(phase.id, { expectedCost: parseFloat(e.target.value) })}
                                            className="w-full p-2 border border-gray-400 rounded-lg text-xs font-bold bg-white text-black"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">ملاحظات الفني / المهندس</label>
                                    <textarea
                                        value={phase.notes || ''}
                                        onChange={e => updatePhase(phase.id, { notes: e.target.value })}
                                        className="w-full p-2 border border-gray-400 rounded-lg text-xs h-16 bg-white text-black font-bold resize-none"
                                        placeholder="أضف ملاحظات..."
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Attachments UI Card representing Document upload (Visual Only based on prompt constraints) */}
                <div className="mt-8 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-jilco-900">
                            <FileText className="text-jilco-600" /> مرفقات ووثائق المشروع
                        </h3>
                        <button className="bg-jilco-100 text-jilco-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-jilco-200 transition-colors" title="إضافة ملف" onClick={() => setShowAttachmentModal(true)}>
                            <Plus size={16} /> رفع ملف جديد
                        </button>
                    </div>
                    {(!currentProject.attachments || currentProject.attachments.length === 0) ? (
                        <div className="text-center p-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <FileText className="mx-auto text-gray-300 mb-2" size={32} />
                            <p className="text-gray-500 font-bold">لا توجد ملفات مرفقة بهذا المشروع</p>
                            <p className="text-xs text-gray-400 mt-1">يمكنك رفع المخططات الهندسية، العقد الموقع، أو صور الموقع هنا.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* The actual loop for documents would go here, currently empty */}
                        </div>
                    )}
                </div>
            </div>

            {showMaterialModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100">
                        <div className="p-6 text-white bg-jilco-900 flex justify-between items-center">
                            <h2 className="text-xl font-black flex items-center gap-2">
                                <PackageMinus size={24} /> صرف مواد للمشروع
                            </h2>
                            <button onClick={() => setShowMaterialModal(false)}><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">اختر الصنف من المستودع</label>
                                <select
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold"
                                    value={issueProductId}
                                    onChange={e => setIssueProductId(e.target.value)}
                                >
                                    <option value="">-- اختر الصنف --</option>
                                    {supplierProducts.filter(p => (p.currentQuantity || 0) > 0).map(p => (
                                        <option key={p.id} value={p.id}>{p.name} (متوفر: {p.currentQuantity || 0})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">الكمية المسحوبة</label>
                                <input type="number" min="1" value={issueQuantity || ''} onChange={e => setIssueQuantity(parseFloat(e.target.value) || 0)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black text-center focus:ring-2 focus:ring-jilco-500 outline-none" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">ملاحظات / بيان المسحوب</label>
                                <input type="text" placeholder="مثال: لتركيب الكابينة..." value={issueNotes} onChange={e => setIssueNotes(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-jilco-500 outline-none" />
                            </div>

                            <button onClick={handleIssueMaterial} className="w-full px-4 py-3 mt-4 text-white font-black rounded-xl bg-jilco-600 hover:bg-jilco-700 transition-colors shadow-lg">
                                تأكيد الصرف وحفظ التكلفة
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

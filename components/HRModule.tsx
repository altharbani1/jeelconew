
import React, { useState, useEffect, useMemo } from 'react';
import { Users, Briefcase, DollarSign, Wrench, Plus, Search, Edit, Trash2, Save, UserPlus, CheckCircle2, XCircle, Printer, Filter, Calendar, Award, FileText, ChevronDown } from 'lucide-react';
import { Employee, Commission, EmployeeRole, EmployeeStatus, ContractData } from '../types';
import { useData } from '../contexts/DataContext.tsx';
import { useHR } from '../contexts/HRContext.tsx';
import { useProject } from '../contexts/ProjectContext.tsx';

const ROLES: Record<EmployeeRole, string> = {
    sales: 'مبيعات وتسويق',
    technician: 'فني تركيب وصيانة',
    admin: 'شؤون إدارية',
    manager: 'الإدارة العليا'
};

const STATUSES: Record<EmployeeStatus, { label: string, color: string }> = {
    active: { label: 'على رأس العمل', color: 'bg-green-100 text-green-700' },
    vacation: { label: 'إجازة', color: 'bg-amber-100 text-amber-700' },
    terminated: { label: 'منتهي خدماته', color: 'bg-red-100 text-red-700' }
};

const INITIAL_EMPLOYEES: Employee[] = [
    {
        id: 'E-001',
        name: 'محمد علي',
        role: 'sales',
        phone: '0500000001',
        nationalId: '1010101010',
        status: 'active',
        basicSalary: 4000,
        joinDate: '2023-01-01',
        custodyItems: ['Laptop Dell XPS', 'سيارة تويوتا يارس 2023', 'جوال عمل']
    }
];

export const HRModule: React.FC = () => {
    const { contracts } = useProject();
    const {
        hrEmployees: employees,
        hrCommissions: commissions,
        saveHRRecord, deleteHRRecord
    } = useHR();

    const [activeTab, setActiveTab] = useState<'employees' | 'commissions'>('employees');

    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<EmployeeRole | 'all'>('all');

    // Forms
    const [showEmployeeForm, setShowEmployeeForm] = useState(false);
    const [currentEmployee, setCurrentEmployee] = useState<Partial<Employee>>({ custodyItems: [], status: 'active' });

    const [showCommissionForm, setShowCommissionForm] = useState(false);
    const [currentCommission, setCurrentCommission] = useState<Partial<Commission>>({ status: 'pending', date: new Date().toISOString().split('T')[0] });

    // No local storage loading needed; data provided by context.

    // --- STATS ---
    const stats = useMemo(() => {
        const activeCount = employees.filter(e => e.status === 'active').length;
        const totalSalaries = employees.filter(e => e.status === 'active').reduce((sum, e) => sum + (e.basicSalary || 0), 0);
        const paidCommissions = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commissionAmount, 0);
        const pendingCommissions = commissions.filter(c => c.status === 'pending' || c.status === 'approved').reduce((sum, c) => sum + c.commissionAmount, 0);

        return { activeCount, totalSalaries, paidCommissions, pendingCommissions };
    }, [employees, commissions]);

    // --- ACTIONS ---

    const handleSaveEmployee = async () => {
        if (!currentEmployee.name || !currentEmployee.role) return alert('الاسم والوظيفة مطلوبان');

        const empData: Employee = {
            ...currentEmployee as Employee,
            id: currentEmployee.id || `E-${Date.now()}`,
            status: currentEmployee.status || 'active',
            custodyItems: currentEmployee.custodyItems || []
        };

        await saveHRRecord('jilco_hr_employees', empData.id, empData);

        setShowEmployeeForm(false);
        setCurrentEmployee({ custodyItems: [], status: 'active' });
    };

    const handleSaveCommission = async () => {
        if (!currentCommission.employeeId || !currentCommission.contractValue) return;

        const amount = (currentCommission.contractValue * (currentCommission.commissionPercentage || 0)) / 100;
        const emp = employees.find(e => e.id === currentCommission.employeeId);

        const commData: Commission = {
            ...currentCommission as Commission,
            id: currentCommission.id || `COM-${Date.now()}`,
            employeeName: emp?.name || '',
            commissionAmount: amount,
            status: currentCommission.status || 'pending'
        };

        await saveHRRecord('jilco_hr_commissions', commData.id, commData);

        setShowCommissionForm(false);
        setCurrentCommission({ status: 'pending', date: new Date().toISOString().split('T')[0] });
    };

    const updateCommissionStatus = async (id: string, newStatus: 'approved' | 'paid') => {
        const c = commissions.find(comm => comm.id === id);
        if (!c) return;

        const updates: Partial<Commission> = { status: newStatus };
        if (newStatus === 'approved') updates.approvalDate = new Date().toISOString().split('T')[0];
        if (newStatus === 'paid') updates.paymentDate = new Date().toISOString().split('T')[0];

        const updatedComm = { ...c, ...updates };
        await saveHRRecord('jilco_hr_commissions', id, updatedComm);
    };

    const handleContractSelect = (contractNumber: string) => {
        // Find contract based on contracts context shape
        const contract = contracts.find(c => c.id === contractNumber || c.data?.number === contractNumber);
        if (contract) {
            setCurrentCommission({
                ...currentCommission,
                contractNumber: contract.data?.number || contract.id,
                contractValue: contract.data?.totalValue || 0,
                commissionPercentage: 1 // Default percentage suggestion
            });
        }
    };

    // --- RENDERERS ---

    const renderEmployeeForm = () => (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 animate-fade-in">
                <h3 className="font-bold text-lg mb-4 text-jilco-900 flex items-center gap-2">
                    <UserPlus size={20} /> {currentEmployee.id ? 'تعديل ملف موظف' : 'تسجيل موظف جديد'}
                </h3>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">الاسم الكامل</label>
                            <input title="الاسم الكامل" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.name || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">المسمى الوظيفي</label>
                            <select title="المسمى الوظيفي" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.role || 'technician'} onChange={e => setCurrentEmployee({ ...currentEmployee, role: e.target.value as EmployeeRole })}>
                                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">رقم الهوية / الإقامة</label>
                            <input title="رقم الهوية / الإقامة" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.nationalId || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, nationalId: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">رقم الجوال</label>
                            <input title="رقم الجوال" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.phone || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, phone: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">الراتب الأساسي</label>
                            <input title="الراتب الأساسي" type="number" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.basicSalary || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, basicSalary: parseFloat(e.target.value) })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">تاريخ المباشرة</label>
                            <input title="تاريخ المباشرة" type="date" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.joinDate || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, joinDate: e.target.value })} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">الحالة الوظيفية</label>
                        <select title="الحالة الوظيفية" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.status || 'active'} onChange={e => setCurrentEmployee({ ...currentEmployee, status: e.target.value as EmployeeStatus })}>
                            {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Wrench size={12} /> العهد المستلمة (افصل بفاصلة)</label>
                        <textarea
                            title="العهد المستلمة"
                            className="w-full p-2 border border-gray-400 rounded h-20 text-sm text-black bg-white font-bold"
                            placeholder="مثال: سيارة رقم 123، لابتوب عهدة، جهاز قياس..."
                            value={currentEmployee.custodyItems?.join(', ') || ''}
                            onChange={e => setCurrentEmployee({ ...currentEmployee, custodyItems: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={() => setShowEmployeeForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold text-sm">إلغاء</button>
                    <button onClick={handleSaveEmployee} className="px-6 py-2 bg-jilco-600 text-white rounded hover:bg-jilco-700 font-bold text-sm shadow-md">حفظ البيانات</button>
                </div>
            </div>
        </div>
    );

    const renderCommissionForm = () => (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 animate-fade-in">
                <h3 className="font-bold text-lg mb-4 text-jilco-900 flex items-center gap-2">
                    <Award size={20} /> تسجيل استحقاق عمولة
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold mb-1">الموظف المستحق</label>
                        <select title="الموظف المستحق للعمولة" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentCommission.employeeId || ''} onChange={e => setCurrentCommission({ ...currentCommission, employeeId: e.target.value })}>
                            <option value="">-- اختر موظف --</option>
                            {employees.filter(e => e.role === 'sales' || e.role === 'manager').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">استيراد من عقد</label>
                            <input
                                title="استيراد من عقد"
                                type="text"
                                className="w-full p-2 border border-gray-400 rounded text-xs text-black bg-white font-bold"
                                list="contractsList"
                                placeholder="اختر رقم العقد..."
                                onChange={(e) => handleContractSelect(e.target.value)}
                            />
                            <datalist id="contractsList">
                                {contracts.map(c => (
                                    <option key={c.id} value={c.data?.number || c.id}>{c.data?.secondPartyName} - {c.data?.totalValue}</option>
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">رقم العقد المرجعي</label>
                            <input title="رقم العقد المرجعي" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentCommission.contractNumber || ''} onChange={e => setCurrentCommission({ ...currentCommission, contractNumber: e.target.value })} placeholder="CN-2024-..." />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">تاريخ الاستحقاق</label>
                        <input title="تاريخ الاستحقاق" type="date" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentCommission.date || ''} onChange={e => setCurrentCommission({ ...currentCommission, date: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">قيمة العقد (ر.س)</label>
                            <input title="قيمة العقد" type="number" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentCommission.contractValue || ''} onChange={e => setCurrentCommission({ ...currentCommission, contractValue: parseFloat(e.target.value) })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">نسبة العمولة (%)</label>
                            <input title="نسبة العمولة" type="number" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentCommission.commissionPercentage || ''} onChange={e => setCurrentCommission({ ...currentCommission, commissionPercentage: parseFloat(e.target.value) })} />
                        </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-center">
                        <p className="text-xs text-green-800 font-bold mb-1">صافي العمولة المستحقة</p>
                        <p className="text-2xl font-black text-green-700 font-mono">
                            {((currentCommission.contractValue || 0) * (currentCommission.commissionPercentage || 0) / 100).toLocaleString()} <span className="text-sm">SAR</span>
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold mb-1">ملاحظات</label>
                        <input title="ملاحظات" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentCommission.notes || ''} onChange={e => setCurrentCommission({ ...currentCommission, notes: e.target.value })} />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={() => setShowCommissionForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold text-sm">إلغاء</button>
                    <button onClick={handleSaveCommission} className="px-6 py-2 bg-jilco-600 text-white rounded hover:bg-jilco-700 font-bold text-sm shadow-md">حفظ المستند</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
            <div className="max-w-6xl mx-auto">
                {/* Header with Stats */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                                <Users className="text-gold-500" /> الموارد البشرية والعمولات
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">إدارة شؤون الموظفين، العهد، ومتابعة صرف العمولات</p>
                        </div>
                        <div className="flex gap-2">
                            {activeTab === 'employees' ? (
                                <button onClick={() => { setCurrentEmployee({ custodyItems: [], status: 'active' }); setShowEmployeeForm(true); }} className="bg-jilco-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-800 shadow-md text-sm">
                                    <UserPlus size={18} /> موظف جديد
                                </button>
                            ) : (
                                <button onClick={() => { setCurrentCommission({ status: 'pending', date: new Date().toISOString().split('T')[0] }); setShowCommissionForm(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 shadow-md text-sm">
                                    <Plus size={18} /> تسجيل عمولة
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-xs font-bold text-gray-500 mb-1">الموظفين (على رأس العمل)</p>
                            <p className="text-2xl font-black text-jilco-900">{stats.activeCount}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-xs font-bold text-gray-500 mb-1">إجمالي الرواتب الشهرية</p>
                            <p className="text-2xl font-black text-jilco-900 font-mono">{stats.totalSalaries.toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-xs font-bold text-gray-500 mb-1">عمولات مدفوعة</p>
                            <p className="text-2xl font-black text-green-600 font-mono">{stats.paidCommissions.toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-xs font-bold text-gray-500 mb-1">عمولات قيد الانتظار</p>
                            <p className="text-2xl font-black text-amber-600 font-mono">{stats.pendingCommissions.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden w-full max-w-md">
                    <button onClick={() => setActiveTab('employees')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'employees' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><Briefcase size={18} /> سجل الموظفين</button>
                    <button onClick={() => setActiveTab('commissions')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'commissions' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><DollarSign size={18} /> العمولات والحوافز</button>
                </div>

                {/* Employees View */}
                {activeTab === 'employees' && (
                    <div className="animate-fade-in space-y-6">
                        {/* Toolbar */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center">
                            <div className="relative max-w-md flex-1">
                                <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                                <input
                                    title="بحث بالاسم، الهوية، الجوال"
                                    type="text" placeholder="بحث بالاسم، الهوية، الجوال..."
                                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pr-10 pl-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm bg-white text-black font-bold"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter size={16} className="text-gray-400" />
                                <select
                                    title="تصفية الوظائف"
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value as any)}
                                    className="p-2 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold outline-none focus:ring-2 focus:ring-jilco-500"
                                >
                                    <option value="all">جميع الأقسام</option>
                                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {employees.filter(e =>
                                (roleFilter === 'all' || e.role === roleFilter) &&
                                (e.name.includes(searchTerm) || e.phone.includes(searchTerm))
                            ).map(emp => (
                                <div key={emp.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all group flex flex-col">
                                    <div className="p-5 flex items-start justify-between border-b border-gray-50">
                                        <div className="flex gap-3">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-sm ${emp.role === 'sales' ? 'bg-blue-500' : emp.role === 'technician' ? 'bg-orange-500' : 'bg-jilco-600'}`}>
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800">{emp.name}</h3>
                                                <p className="text-xs text-gray-500 font-bold">{ROLES[emp.role]}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${STATUSES[emp.status].color}`}>
                                            {STATUSES[emp.status].label}
                                        </span>
                                    </div>
                                    <div className="p-5 space-y-3 text-sm">
                                        <div className="flex justify-between items-center text-gray-600">
                                            <span className="text-xs font-bold">الراتب الأساسي</span>
                                            <span className="font-mono font-bold text-jilco-900">{emp.basicSalary.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-gray-600">
                                            <span className="text-xs font-bold">رقم الجوال</span>
                                            <span className="font-mono font-bold text-black" dir="ltr">{emp.phone}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-gray-600">
                                            <span className="text-xs font-bold">تاريخ المباشرة</span>
                                            <span className="font-mono font-bold text-black">{emp.joinDate}</span>
                                        </div>
                                    </div>
                                    {emp.custodyItems.length > 0 && (
                                        <div className="bg-gray-50 p-3 text-xs border-t border-gray-100">
                                            <p className="font-bold text-gray-500 mb-2 flex items-center gap-1 font-bold"><Wrench size={12} /> العهد المسلمة:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {emp.custodyItems.map((item, i) => (
                                                    <span key={i} className="bg-white border border-gray-300 px-2 py-1 rounded text-black font-bold shadow-sm">{item}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
                                        <button title="تعديل الموظف" onClick={() => { setCurrentEmployee(emp); setShowEmployeeForm(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"><Edit size={16} /></button>
                                        <button title="حذف الموظف" onClick={async () => await deleteHRRecord('jilco_hr_employees', emp.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Commissions View */}
                {activeTab === 'commissions' && (
                    <div className="animate-fade-in bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-50 text-gray-500 font-medium">
                                <tr>
                                    <th className="p-4">الموظف</th>
                                    <th className="p-4">تفاصيل العقد</th>
                                    <th className="p-4 text-center">النسبة</th>
                                    <th className="p-4 text-center">المبلغ المستحق</th>
                                    <th className="p-4">الحالة</th>
                                    <th className="p-4">التواريخ</th>
                                    <th className="p-4 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {commissions.map(comm => (
                                    <tr key={comm.id} className="hover:bg-gray-50 group">
                                        <td className="p-4 font-bold text-gray-800">{comm.employeeName}</td>
                                        <td className="p-4">
                                            <p className="font-mono font-bold text-xs text-jilco-900">{comm.contractNumber}</p>
                                            <p className="text-xs text-gray-500 mt-0.5 font-bold">قيمة العقد: {comm.contractValue.toLocaleString()}</p>
                                        </td>
                                        <td className="p-4 text-center font-mono font-bold">{comm.commissionPercentage}%</td>
                                        <td className="p-4 text-center font-black text-green-700 font-mono text-base">{comm.commissionAmount.toLocaleString()}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${comm.status === 'paid' ? 'bg-green-100 text-green-700 border-green-200' :
                                                comm.status === 'approved' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                    'bg-amber-100 text-amber-700 border-amber-200'
                                                }`}>
                                                {comm.status === 'paid' ? 'تم الصرف' : comm.status === 'approved' ? 'معتمد' : 'معلق'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-gray-500 font-mono font-bold">
                                            <div className="flex flex-col gap-1">
                                                <span>استحقاق: {comm.date}</span>
                                                {comm.paymentDate && <span className="text-green-600 font-bold">صرف: {comm.paymentDate}</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {comm.status === 'pending' && (
                                                    <button
                                                        onClick={() => updateCommissionStatus(comm.id, 'approved')}
                                                        className="bg-blue-50 text-blue-600 px-3 py-1 rounded text-xs font-bold border border-blue-200 hover:bg-blue-100"
                                                        title="اعتماد العمولة"
                                                    >
                                                        اعتماد
                                                    </button>
                                                )}
                                                {comm.status === 'approved' && (
                                                    <button
                                                        onClick={() => updateCommissionStatus(comm.id, 'paid')}
                                                        className="bg-green-50 text-green-600 px-3 py-1 rounded text-xs font-bold border border-green-200 hover:bg-green-100"
                                                        title="تأكيد الصرف"
                                                    >
                                                        صرف
                                                    </button>
                                                )}
                                                <button title="طباعة العمولة" onClick={() => window.print()} className="p-1.5 text-gray-400 hover:text-jilco-600 rounded"><Printer size={16} /></button>
                                                <button title="حذف العمولة" onClick={async () => await deleteHRRecord('jilco_hr_commissions', comm.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {commissions.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-gray-400 font-bold">لا توجد عمولات مسجلة.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showEmployeeForm && renderEmployeeForm()}
            {showCommissionForm && renderCommissionForm()}
        </div>
    );
};

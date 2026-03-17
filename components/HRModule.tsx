
import React, { useState, useEffect, useMemo } from 'react';
import { Users, Briefcase, DollarSign, Wrench, Plus, Search, Edit, Trash2, Save, UserPlus, CheckCircle2, XCircle, Printer, Filter, Calendar, Award, FileText, ChevronDown, Check, FileSpreadsheet, Eye } from 'lucide-react';
import { Employee, Commission, EmployeeRole, EmployeeStatus, ContractData, PayrollRecord, EmployeePayment, EmployeeLoan, AttendanceRecord, LeaveRequest } from '../types';
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
        nationalIdType: 'saudi',
        status: 'active',
        basicSalary: 4000,
        housingAllowance: 1000,
        transportAllowance: 500,
        annualLeaveBalance: 21,
        joinDate: '2023-01-01',
        custodyItems: ['Laptop Dell XPS', 'سيارة تويوتا يارس 2023', 'جوال عمل']
    }
];

const calculateEOS = (joinDate: string, totalSalary: number) => {
    if (!joinDate) return 0;
    const start = new Date(joinDate);
    const end = new Date();
    const diffTime = end.getTime() - start.getTime();
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    if (diffYears <= 0) return 0;
    
    if (diffYears <= 5) {
        return (totalSalary / 2) * diffYears;
    } else {
        const first5 = (totalSalary / 2) * 5;
        const rest = totalSalary * (diffYears - 5);
        return first5 + rest;
    }
};

export const HRModule: React.FC = () => {
    const { contracts } = useProject();
    const {
        hrEmployees: employees,
        hrCommissions: commissions,
        hrPayrolls: payrolls,
        hrEmployeePayments: employeePayments,
        hrLoans: loans,
        hrAttendance: attendance,
        hrLeaves: leaves,
        setHrPayrolls,
        setHrLoans, setHrAttendance, setHrLeaves,
        saveHRRecord, deleteHRRecord
    } = useHR();

    const [activeTab, setActiveTab] = useState<'employees' | 'commissions' | 'payrolls' | 'loans' | 'attendance' | 'leaves'>('employees');

    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<EmployeeRole | 'all'>('all');

    // Forms
    const [showEmployeeForm, setShowEmployeeForm] = useState(false);
    const [currentEmployee, setCurrentEmployee] = useState<Partial<Employee>>({ role: 'technician', custodyItems: [], status: 'active' });

    const [showCommissionForm, setShowCommissionForm] = useState(false);
    const [currentCommission, setCurrentCommission] = useState<Partial<Commission>>({ status: 'pending', date: new Date().toISOString().split('T')[0] });

    const [showLoanForm, setShowLoanForm] = useState(false);
    const [currentLoan, setCurrentLoan] = useState<Partial<EmployeeLoan>>({ status: 'active', startDate: new Date().toISOString().slice(0, 7) });

    const [showAttendanceForm, setShowAttendanceForm] = useState(false);
    const [currentAttendance, setCurrentAttendance] = useState<Partial<AttendanceRecord>>({ month: new Date().toISOString().slice(0, 7), absenceDays: 0, delayHours: 0 });

    const [showLeaveForm, setShowLeaveForm] = useState(false);
    const [currentLeave, setCurrentLeave] = useState<Partial<LeaveRequest>>({ status: 'pending', type: 'annual' });

    // Payroll State
    const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [generatedPayrolls, setGeneratedPayrolls] = useState<PayrollRecord[]>([]);

    // Employee Statement Modals
    const [viewStatementEmployeeId, setViewStatementEmployeeId] = useState<string | null>(null);

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
            role: currentEmployee.role || 'technician',
            status: currentEmployee.status || 'active',
            basicSalary: currentEmployee.basicSalary || 0,
            housingAllowance: currentEmployee.housingAllowance || 0,
            transportAllowance: currentEmployee.transportAllowance || 0,
            otherAllowances: currentEmployee.otherAllowances || 0,
            annualLeaveBalance: currentEmployee.annualLeaveBalance || 21,
            nationalIdType: currentEmployee.nationalIdType || 'saudi',
            phone: currentEmployee.phone || '',
            joinDate: currentEmployee.joinDate || new Date().toISOString().split('T')[0],
            custodyItems: currentEmployee.custodyItems || []
        };

        await saveHRRecord('jilco_hr_employees', empData.id, empData);

        setShowEmployeeForm(false);
        setCurrentEmployee({ role: 'technician', custodyItems: [], status: 'active', nationalIdType: 'saudi', annualLeaveBalance: 21 });
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

    const handleSaveLoan = async () => {
        if (!currentLoan.employeeId || !currentLoan.amount || !currentLoan.installmentsCount) return alert('أكمل بيانات السلفة');
        const loanData: EmployeeLoan = {
            ...currentLoan as EmployeeLoan,
            id: currentLoan.id || `LOAN-${Date.now()}`,
            monthlyInstallment: currentLoan.amount / currentLoan.installmentsCount,
            remainingAmount: currentLoan.amount,
            status: 'active'
        };
        await saveHRRecord('jilco_hr_loans', loanData.id, loanData);
        setShowLoanForm(false);
        setCurrentLoan({ status: 'active', startDate: new Date().toISOString().slice(0, 7) });
    };

    const handleSaveAttendance = async () => {
        if (!currentAttendance.employeeId || !currentAttendance.month) return alert('أكمل بيانات الحضور');
        const attData: AttendanceRecord = {
            ...currentAttendance as AttendanceRecord,
            id: currentAttendance.id || `ATT-${currentAttendance.employeeId}-${currentAttendance.month}`,
        };
        await saveHRRecord('jilco_hr_attendance', attData.id, attData);
        setShowAttendanceForm(false);
        setCurrentAttendance({ month: new Date().toISOString().slice(0, 7), absenceDays: 0, delayHours: 0 });
    };

    const handleSaveLeave = async () => {
        if (!currentLeave.employeeId || !currentLeave.startDate || !currentLeave.endDate) return alert('أكمل بيانات الإجازة');
        const leaveData: LeaveRequest = {
            ...currentLeave as LeaveRequest,
            id: currentLeave.id || `LEAVE-${Date.now()}`,
            status: 'pending' // Force pending initially
        };
        await saveHRRecord('jilco_hr_leaves', leaveData.id, leaveData);
        setShowLeaveForm(false);
        setCurrentLeave({ status: 'pending', type: 'annual' });
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

    // --- PAYROLL ACTIONS ---
    const handleGeneratePayroll = () => {
        // Find active employees and generate their payroll for the selected month
        const activeEmployees = employees.filter(e => e.status === 'active');
        const newPayrolls: PayrollRecord[] = activeEmployees.map(emp => {
            // Find existing if already generated but not paid
            const existing = payrolls.find(p => p.employeeId === emp.id && p.month === payrollMonth);
            if (existing) return existing;

            // Calculate unpaid commissions for this month
            const empCommissions = commissions
                .filter(c => c.employeeId === emp.id && c.status === 'approved' && c.approvalDate?.startsWith(payrollMonth))
                .reduce((sum, c) => sum + c.commissionAmount, 0);
            
            // GOSI Calc: 9.75% of (Basic + Housing) for Saudis
            const gosi = emp.nationalIdType === 'saudi' ? ((emp.basicSalary || 0) + (emp.housingAllowance || 0)) * 0.0975 : 0;

            // Calculate active loan deductions
            const activeLoans = loans.filter(l => l.employeeId === emp.id && l.status === 'active' && l.startDate <= payrollMonth && l.remainingAmount > 0);
            const loanDed = activeLoans.reduce((sum, l) => sum + Math.min(l.monthlyInstallment, l.remainingAmount), 0);
            
            // Calculate absence deductions
            const currentAtt = attendance.find(a => a.employeeId === emp.id && a.month === payrollMonth);
            const totalSalaryForAbsence = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.otherAllowances || 0);
            const dailyRate = totalSalaryForAbsence / 30;
            const hourlyRate = dailyRate / 8;
            const absDed = currentAtt ? (currentAtt.absenceDays * dailyRate) + (currentAtt.delayHours * hourlyRate) : 0;

            const totalAllowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.otherAllowances || 0);
            const totalAdditions = (emp.basicSalary || 0) + totalAllowances + empCommissions;
            const totalDeductions = gosi + loanDed + absDed;

            return {
                id: `PR-${Date.now()}-${emp.id}`,
                employeeId: emp.id,
                employeeName: emp.name,
                month: payrollMonth,
                basicSalary: emp.basicSalary || 0,
                housingAllowance: emp.housingAllowance || 0,
                transportAllowance: emp.transportAllowance || 0,
                otherAllowances: emp.otherAllowances || 0,
                commissions: empCommissions,
                gosiDeduction: gosi,
                loanDeduction: loanDed,
                absenceDeduction: absDed,
                otherDeductions: 0,
                bonuses: 0,
                netSalary: totalAdditions - totalDeductions,
                status: 'pending'
            };
        });
        setGeneratedPayrolls(newPayrolls);
    };

    const updateGeneratedPayroll = (index: number, field: keyof PayrollRecord, value: number) => {
        const updated = [...generatedPayrolls];
        const record = updated[index];
        (record as any)[field] = value;
        // Recalculate net
        const totalAdditions = record.basicSalary + record.housingAllowance + record.transportAllowance + record.otherAllowances + record.commissions + record.bonuses;
        const totalDeductions = record.gosiDeduction + record.loanDeduction + record.absenceDeduction + record.otherDeductions;
        record.netSalary = totalAdditions - totalDeductions;
        setGeneratedPayrolls(updated);
    };

    const handleApprovePayroll = async () => {
        if (generatedPayrolls.length === 0) return alert('No payroll to approve.');
        if (!window.confirm(`هل أنت متأكد من اعتماد رواتب شهر ${payrollMonth} وإصدار سندات الصرف تلقائياً؟`)) return;

        for (const record of generatedPayrolls) {
            if (record.status === 'pending') {
                const finalRecord = { ...record, status: 'paid' as const };
                // 1. Save Payroll Record
                await saveHRRecord('jilco_hr_payrolls', finalRecord.id, finalRecord);

                const totalDed = record.gosiDeduction + record.loanDeduction + record.absenceDeduction + record.otherDeductions;

                // 2. Create Employee Payment
                const payment: EmployeePayment = {
                    id: `EP-${Date.now()}-${record.employeeId}`,
                    employeeId: record.employeeId,
                    employeeName: record.employeeName,
                    date: new Date().toISOString().split('T')[0],
                    amount: finalRecord.netSalary,
                    paymentMethod: 'transfer', 
                    description: `راتب شهر ${record.month}` + (record.bonuses > 0 ? ' مكافأة' : '') + (totalDed > 0 ? ' استقطاع' : ''),
                    payrollId: finalRecord.id,
                    status: 'completed'
                };
                await saveHRRecord('jilco_hr_payments', payment.id, payment);
                
                // 3. Mark approved commissions as paid
                const empCommissions = commissions.filter(c => c.employeeId === record.employeeId && c.status === 'approved' && c.approvalDate?.startsWith(payrollMonth));
                for(const c of empCommissions) {
                  await updateCommissionStatus(c.id, 'paid');
                }

                // 4. Update loans remaining amount
                if (record.loanDeduction > 0) {
                    const activeLoans = loans.filter(l => l.employeeId === record.employeeId && l.status === 'active' && l.startDate <= record.month && l.remainingAmount > 0);
                    let toDeduct = record.loanDeduction;
                    for (const loan of activeLoans) {
                        if (toDeduct <= 0) break;
                        const deduction = Math.min(loan.monthlyInstallment, loan.remainingAmount, toDeduct);
                        const newRemaining = loan.remainingAmount - deduction;
                        const newStatus = newRemaining <= 0 ? 'paid' : 'active';
                        await saveHRRecord('jilco_hr_loans', loan.id, { ...loan, remainingAmount: newRemaining, status: newStatus as 'active' | 'paid' });
                        toDeduct -= deduction;
                    }
                }
            }
        }
        alert('تم اعتماد الرواتب وإنشاء سندات الصرف بنجاح.');
        setGeneratedPayrolls([]);
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
                            <label className="block text-xs font-bold mb-1">نوع الهوية</label>
                            <select title="نوع الهوية" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.nationalIdType || 'saudi'} onChange={e => setCurrentEmployee({ ...currentEmployee, nationalIdType: e.target.value as 'saudi' | 'non_saudi' })}>
                                <option value="saudi">مواطن (سعودي)</option>
                                <option value="non_saudi">مقيم (غير سعودي)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">رقم الهوية / الإقامة</label>
                            <input title="رقم الهوية / الإقامة" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.nationalId || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, nationalId: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">رقم الجوال</label>
                            <input title="رقم الجوال" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.phone || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, phone: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">تاريخ المباشرة</label>
                            <input title="تاريخ المباشرة" type="date" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.joinDate || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, joinDate: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-2 bg-gray-50 p-2 rounded border border-gray-200">
                        <div>
                            <label className="block text-xs font-bold mb-1">الراتب الأساسي</label>
                            <input title="الراتب الأساسي" type="number" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.basicSalary || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, basicSalary: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">بدل السكن</label>
                            <input title="بدل السكن" type="number" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.housingAllowance || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, housingAllowance: parseFloat(e.target.value) || 0 })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-2 bg-gray-50 p-2 rounded border border-gray-200">
                        <div>
                            <label className="block text-xs font-bold mb-1">بدل النقل</label>
                            <input title="بدل النقل" type="number" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.transportAllowance || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, transportAllowance: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">بدلات أخرى</label>
                            <input title="بدلات أخرى" type="number" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.otherAllowances || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, otherAllowances: parseFloat(e.target.value) || 0 })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">رصيد الإجازات السنوي (أيام)</label>
                            <input title="رصيد الإجازات السنوي" type="number" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.annualLeaveBalance || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, annualLeaveBalance: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">الحالة الوظيفية</label>
                            <select title="الحالة الوظيفية" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentEmployee.status || 'active'} onChange={e => setCurrentEmployee({ ...currentEmployee, status: e.target.value as EmployeeStatus })}>
                                {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
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

    const renderLoanForm = () => (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 animate-fade-in">
                <h3 className="font-bold text-lg mb-4 text-jilco-900 flex items-center gap-2">
                    <DollarSign size={20} /> تسجيل سلفة جديدة
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold mb-1">الموظف</label>
                        <select title="الموظف" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentLoan.employeeId || ''} onChange={e => setCurrentLoan({ ...currentLoan, employeeId: e.target.value })}>
                            <option value="">-- اختر الموظف --</option>
                            {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">مبلغ السلفة (ريال)</label>
                            <input title="المبلغ" type="number" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentLoan.amount || ''} onChange={e => setCurrentLoan({ ...currentLoan, amount: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">عدد الأقساط (أشهر)</label>
                            <input title="عدد الأقساط" type="number" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentLoan.installmentsCount || ''} onChange={e => setCurrentLoan({ ...currentLoan, installmentsCount: parseInt(e.target.value) || 1 })} />
                        </div>
                    </div>
                    {currentLoan.amount && currentLoan.installmentsCount ? (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-center">
                            <p className="text-xs text-blue-800 font-bold mb-1">القسط الشهري</p>
                            <p className="text-2xl font-black text-blue-700 font-mono">
                                {(currentLoan.amount / currentLoan.installmentsCount).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm">SAR</span>
                            </p>
                        </div>
                    ) : null}
                    <div>
                        <label className="block text-xs font-bold mb-1">شهر البداية</label>
                        <input title="شهر البداية" placeholder="YYYY-MM" type="month" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold h-[42px]" value={currentLoan.startDate || ''} onChange={e => setCurrentLoan({ ...currentLoan, startDate: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">ملاحظات / سبب السلفة</label>
                        <input title="ملاحظات" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentLoan.notes || ''} onChange={e => setCurrentLoan({ ...currentLoan, notes: e.target.value })} />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={() => setShowLoanForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold text-sm">إلغاء</button>
                    <button onClick={handleSaveLoan} className="px-6 py-2 bg-jilco-600 text-white rounded hover:bg-jilco-700 font-bold text-sm shadow-md">حفظ السلفة</button>
                </div>
            </div>
        </div>
    );

    const renderAttendanceForm = () => (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 animate-fade-in">
                <h3 className="font-bold text-lg mb-4 text-jilco-900 flex items-center gap-2">
                    <Calendar size={20} /> تسجيل حضور وغياب شهري
                </h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">الموظف</label>
                            <select title="الموظف" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentAttendance.employeeId || ''} onChange={e => setCurrentAttendance({ ...currentAttendance, employeeId: e.target.value })}>
                                <option value="">-- اختر --</option>
                                {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">شهر التقرير</label>
                            <input title="شهر التقرير" placeholder="YYYY-MM" type="month" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold h-[42px]" value={currentAttendance.month || ''} onChange={e => setCurrentAttendance({ ...currentAttendance, month: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1 text-red-600">أيام الغياب (بدون عذر)</label>
                            <input title="أيام الغياب" type="number" step="0.5" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold border-red-200 focus:ring-red-500" value={currentAttendance.absenceDays || ''} onChange={e => setCurrentAttendance({ ...currentAttendance, absenceDays: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 text-orange-600">ساعات التأخير</label>
                            <input title="ساعات التأخير" type="number" step="0.5" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold border-orange-200 focus:ring-orange-500" value={currentAttendance.delayHours || ''} onChange={e => setCurrentAttendance({ ...currentAttendance, delayHours: parseFloat(e.target.value) || 0 })} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">ملاحظات إضافية</label>
                        <input title="ملاحظات" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentAttendance.notes || ''} onChange={e => setCurrentAttendance({ ...currentAttendance, notes: e.target.value })} />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={() => setShowAttendanceForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold text-sm">إلغاء</button>
                    <button onClick={handleSaveAttendance} className="px-6 py-2 bg-jilco-600 text-white rounded hover:bg-jilco-700 font-bold text-sm shadow-md">حفظ السجل</button>
                </div>
            </div>
        </div>
    );

    const renderLeaveForm = () => (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 animate-fade-in">
                <h3 className="font-bold text-lg mb-4 text-jilco-900 flex items-center gap-2">
                    <Calendar size={20} /> رفع طلب إجازة
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold mb-1">الموظف</label>
                        <select title="الموظف" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentLeave.employeeId || ''} onChange={e => setCurrentLeave({ ...currentLeave, employeeId: e.target.value })}>
                            <option value="">-- اختر --</option>
                            {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">تاريخ البداية</label>
                            <input title="البداية" type="date" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentLeave.startDate || ''} onChange={e => setCurrentLeave({ ...currentLeave, startDate: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">تاريخ النهاية</label>
                            <input title="النهاية" type="date" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentLeave.endDate || ''} onChange={e => setCurrentLeave({ ...currentLeave, endDate: e.target.value })} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">نوع الإجازة</label>
                        <select title="النوع" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentLeave.type || 'annual'} onChange={e => setCurrentLeave({ ...currentLeave, type: e.target.value as any })}>
                            <option value="annual">سنوية مدفوعة (تخصم من الرصيد)</option>
                            <option value="sick">مرضية مدفوعة</option>
                            <option value="unpaid">بدون راتب (يخصم غياب)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">مبررات إضافية / عذر طبي</label>
                        <input title="ملاحظات" type="text" className="w-full p-2 border border-gray-400 rounded text-black bg-white font-bold" value={currentLeave.notes || ''} onChange={e => setCurrentLeave({ ...currentLeave, notes: e.target.value })} />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                    <button onClick={() => setShowLeaveForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold text-sm">إلغاء</button>
                    <button onClick={handleSaveLeave} className="px-6 py-2 bg-jilco-600 text-white rounded hover:bg-jilco-700 font-bold text-sm shadow-md">رفع الطلب</button>
                </div>
            </div>
        </div>
    );

    const renderEmployeeStatement = () => {
        if (!viewStatementEmployeeId) return null;
        const employee = employees.find(e => e.id === viewStatementEmployeeId);
        if (!employee) return null;

        const employeePayrolls = payrolls.filter(p => p.employeeId === employee.id && p.status === 'paid');
        const payments = employeePayments.filter(p => p.employeeId === employee.id);
        const empCommissions = commissions.filter(c => c.employeeId === employee.id && c.status === 'paid');

        // calculate totals
        const totalBasicSalaries = employeePayrolls.reduce((sum, p) => sum + p.basicSalary, 0);
        const totalBonuses = employeePayrolls.reduce((sum, p) => sum + p.bonuses, 0);
        const totalCommissions = employeePayrolls.reduce((sum, p) => sum + p.commissions, 0); // included in payroll
        const standaloneCommissions = empCommissions.filter(c => !employeePayrolls.some(p => p.month === c.approvalDate?.substring(0,7))).reduce((sum, c) => sum + c.commissionAmount, 0);
        const totalDeductions = employeePayrolls.reduce((sum, p) => sum + p.deductions, 0);

        const totalEntitlements = totalBasicSalaries + totalBonuses + totalCommissions + standaloneCommissions - totalDeductions;
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileSpreadsheet size={18} /> كشف حساب موظف: {employee.name}</h3>
                        <div className="flex gap-2">
                             <button onClick={() => window.print()} className="p-2 text-gray-600 hover:bg-gray-200 rounded-full print:hidden"><Printer size={18} /></button>
                             <button title="إغلاق" onClick={() => setViewStatementEmployeeId(null)} className="p-2 text-gray-600 hover:bg-gray-200 rounded-full print:hidden"><XCircle size={20} /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-white print:p-0">
                         {/* Statement Header */}
                         <div className="mb-6 flex justify-between items-end border-b pb-4">
                              <div>
                                  <h2 className="text-xl font-bold text-jilco-900">{employee.name}</h2>
                                  <p className="text-sm text-gray-500">{ROLES[employee.role as EmployeeRole]}</p>
                              </div>
                              <div className="text-left">
                                  <p className="text-xs text-gray-500 font-bold">رقم الهوية/الإقامة: {employee.nationalId}</p>
                                  <p className="text-xs text-gray-500 font-bold">تاريخ المباشرة: {employee.joinDate}</p>
                              </div>
                         </div>
                         
                         {/* Statement Summary */}
                         <div className="grid grid-cols-3 gap-4 mb-6 print:grid-cols-3">
                             <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-center">
                                 <p className="text-xs font-bold text-green-800 mb-1">إجمالي المستحقات</p>
                                 <p className="text-xl font-black text-green-700 font-mono">{totalEntitlements.toLocaleString()}</p>
                             </div>
                             <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-center">
                                 <p className="text-xs font-bold text-blue-800 mb-1">إجمالي المنصرف</p>
                                 <p className="text-xl font-black text-blue-700 font-mono">{totalPaid.toLocaleString()}</p>
                             </div>
                             <div className={`p-4 rounded-xl border text-center ${totalEntitlements - totalPaid > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                                 <p className={`text-xs font-bold mb-1 ${totalEntitlements - totalPaid > 0 ? 'text-red-800' : 'text-gray-800'}`}>الرصيد المتبقي</p>
                                 <p className={`text-xl font-black font-mono ${totalEntitlements - totalPaid > 0 ? 'text-red-700' : 'text-gray-700'}`}>{(totalEntitlements - totalPaid).toLocaleString()}</p>
                             </div>
                         </div>

                         {/* Ledger Table */}
                         <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">تفاصيل الحركات (Payrolls & Payments)</h4>
                         <table className="w-full text-sm text-right border-collapse">
                             <thead className="bg-gray-100 text-gray-600">
                                 <tr>
                                     <th className="p-2 border border-gray-200">التاريخ/الشهر</th>
                                     <th className="p-2 border border-gray-200">البيان</th>
                                     <th className="p-2 border border-gray-200 text-center text-green-700">دائن (مستحقات)</th>
                                     <th className="p-2 border border-gray-200 text-center text-red-700">مدين (مدفوعات)</th>
                                 </tr>
                             </thead>
                             <tbody>
                                  {/* Render Payrolls (Credits) */}
                                  {employeePayrolls.map(pr => (
                                      <tr key={pr.id} className="hover:bg-gray-50">
                                          <td className="p-2 border border-gray-200 font-mono text-xs">{pr.month}</td>
                                          <td className="p-2 border border-gray-200">
                                              رواتب شهر {pr.month} 
                                              {pr.commissions > 0 && <span className="text-xs text-blue-600 mr-2">(شامل عمولات: {pr.commissions})</span>}
                                          </td>
                                          <td className="p-2 border border-gray-200 text-center font-bold text-green-700 font-mono">{pr.netSalary.toLocaleString()}</td>
                                          <td className="p-2 border border-gray-200 text-center">-</td>
                                      </tr>
                                  ))}
                                  {/* Render Payments (Debits) */}
                                  {payments.map(pm => (
                                      <tr key={pm.id} className="hover:bg-gray-50 bg-red-50/20">
                                          <td className="p-2 border border-gray-200 font-mono text-xs">{pm.date}</td>
                                          <td className="p-2 border border-gray-200 font-bold">{pm.description} (سند صرف)</td>
                                          <td className="p-2 border border-gray-200 text-center">-</td>
                                          <td className="p-2 border border-gray-200 text-center font-bold text-red-700 font-mono">{pm.amount.toLocaleString()}</td>
                                      </tr>
                                  ))}
                                  {employeePayrolls.length === 0 && payments.length === 0 && (
                                      <tr><td colSpan={4} className="p-4 text-center text-gray-500">لا توجد حركات مالية مسجلة.</td></tr>
                                  )}
                             </tbody>
                         </table>
                    </div>
                </div>
            </div>
        )
    };

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
                                <button onClick={() => { setCurrentEmployee({ role: 'technician', custodyItems: [], status: 'active' }); setShowEmployeeForm(true); }} className="bg-jilco-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-800 shadow-md text-sm">
                                    <UserPlus size={18} /> موظف جديد
                                </button>
                            ) : activeTab === 'commissions' ? (
                                <button onClick={() => { setCurrentCommission({ status: 'pending', date: new Date().toISOString().split('T')[0] }); setShowCommissionForm(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 shadow-md text-sm">
                                    <Plus size={18} /> تسجيل عمولة
                                </button>
                            ) : null}
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
                <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden w-full overflow-x-auto">
                    <button onClick={() => setActiveTab('employees')} className={`whitespace-nowrap flex-1 px-4 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'employees' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><Briefcase size={18} /> الموظفين</button>
                    <button onClick={() => setActiveTab('payrolls')} className={`whitespace-nowrap flex-1 px-4 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'payrolls' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><FileSpreadsheet size={18} /> الرواتب</button>
                    <button onClick={() => setActiveTab('loans')} className={`whitespace-nowrap flex-1 px-4 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'loans' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><DollarSign size={18} /> السلف</button>
                    <button onClick={() => setActiveTab('attendance')} className={`whitespace-nowrap flex-1 px-4 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'attendance' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><Calendar size={18} /> الحضور</button>
                    <button onClick={() => setActiveTab('leaves')} className={`whitespace-nowrap flex-1 px-4 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'leaves' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><Calendar size={18} /> الإجازات</button>
                    <button onClick={() => setActiveTab('commissions')} className={`whitespace-nowrap flex-1 px-4 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === 'commissions' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><Award size={18} /> العمولات</button>
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
                                    <div className="p-5 space-y-3 text-sm flex-1">
                                        <div className="flex justify-between items-center text-gray-600">
                                            <span className="text-xs font-bold">إجمالي الراتب</span>
                                            <span className="font-mono font-bold text-jilco-900">
                                                {((emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.otherAllowances || 0)).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-gray-600">
                                            <span className="text-xs font-bold">الراتب الأساسي</span>
                                            <span className="font-mono font-bold text-gray-600">{emp.basicSalary.toLocaleString()}</span>
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
                                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center mt-auto flex-wrap gap-2">
                                        <button title="مكافأة نهاية الخدمة" onClick={() => {
                                            const total = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.otherAllowances || 0);
                                            const eos = calculateEOS(emp.joinDate, total);
                                            alert(`مكافأة نهاية الخدمة التقديرية للموظف ${emp.name}:\n\nتاريخ المباشرة: ${emp.joinDate}\nالراتب الإجمالي: ${total} ريال\n\nالمكافأة المستحقة: ${eos.toLocaleString(undefined, {maximumFractionDigits:2})} ريال`);
                                        }} className="px-3 py-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center justify-center gap-1 font-bold text-xs"><Award size={14} /> نهاية الخدمة</button>
                                        
                                        <button title="كشف حساب موظف" onClick={() => setViewStatementEmployeeId(emp.id)} className="px-3 py-1.5 text-jilco-700 bg-jilco-50 hover:bg-jilco-100 border border-jilco-200 rounded-lg flex items-center justify-center gap-1 font-bold text-xs"><FileSpreadsheet size={14} /> كشف الحساب</button>
                                        
                                        <div className="flex gap-1 ml-auto">
                                            <button title="تعديل الموظف" onClick={() => { setCurrentEmployee(emp); setShowEmployeeForm(true); }} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg"><Edit size={16} /></button>
                                            <button title="حذف الموظف" onClick={async () => await deleteHRRecord('jilco_hr_employees', emp.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 size={16} /></button>
                                        </div>
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

                {/* Payrolls View */}
                {activeTab === 'payrolls' && (
                    <div className="animate-fade-in space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-end justify-between">
                            <div>
                                <h3 className="font-bold text-gray-800 mb-1">إصدار مسير رواتب موظفين</h3>
                                <p className="text-sm text-gray-500">اختر الشهر واضغط توليد لاحتساب الرواتب والعمولات والخصومات</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">حدد الشهر (YYYY-MM)</label>
                                    <input 
                                        title="حدد الشهر"
                                        placeholder="YYYY-MM"
                                        type="month" 
                                        value={payrollMonth} 
                                        onChange={e => setPayrollMonth(e.target.value)}
                                        className="p-2 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold outline-none h-[42px]" 
                                    />
                                </div>
                                <button 
                                    onClick={handleGeneratePayroll}
                                    className="h-[42px] px-6 bg-jilco-600 text-white rounded-lg font-bold shadow hover:bg-jilco-700 flex items-center justify-center gap-2"
                                >
                                    <Calendar size={18} /> توليد المسير
                                </button>
                            </div>
                        </div>

                        {generatedPayrolls.length > 0 && (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                     <h3 className="font-bold text-jilco-900 flex items-center gap-2"><CheckCircle2 size={18} className="text-green-600"/> مسير شهر {payrollMonth} ({generatedPayrolls.length} موظف)</h3>
                                     <button 
                                        onClick={handleApprovePayroll}
                                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700 shadow flex items-center gap-2"
                                     >
                                         <Save size={16} /> اعتماد وصرف الرواتب آلياً
                                     </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-right">
                                        <thead className="bg-gray-100 text-gray-600 font-medium">
                                            <tr>
                                                <th className="p-3">الموظف</th>
                                                <th className="p-3">الأساسي</th>
                                                <th className="p-3">البدلات</th>
                                                <th className="p-3">التأمينات</th>
                                                <th className="p-3">عمولات معتمدة</th>
                                                <th className="p-3">مكافآت (إضافة)</th>
                                                <th className="p-3">رسوم / غياب</th>
                                                <th className="p-3">خصومات أخرى</th>
                                                <th className="p-3 text-center">الصافي للدفع</th>
                                                <th className="p-3 text-center">الحالة</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {generatedPayrolls.map((pr, idx) => (
                                                <tr key={pr.id} className="hover:bg-gray-50">
                                                    <td className="p-3 font-bold text-gray-800">{pr.employeeName}</td>
                                                    <td className="p-3 font-mono text-gray-600">{pr.basicSalary.toLocaleString()}</td>
                                                    <td className="p-3 font-mono text-gray-600">{(pr.housingAllowance + pr.transportAllowance + pr.otherAllowances).toLocaleString()}</td>
                                                    <td className="p-3 font-mono text-red-600">{(pr.gosiDeduction).toLocaleString()}</td>
                                                    <td className="p-3 font-mono text-blue-600 font-bold">{pr.commissions.toLocaleString()}</td>
                                                    <td className="p-3">
                                                        <input 
                                                            type="number" 
                                                            value={pr.bonuses || ''} 
                                                            onChange={e => updateGeneratedPayroll(idx, 'bonuses', parseFloat(e.target.value) || 0)}
                                                            className="w-20 p-1 border rounded text-xs outline-none bg-white text-black focus:ring-1 focus:ring-jilco-500"
                                                            disabled={pr.status === 'paid'}
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="p-3 font-mono text-red-600">{(pr.loanDeduction + pr.absenceDeduction).toLocaleString()}</td>
                                                    <td className="p-3">
                                                        <input 
                                                            type="number" 
                                                            value={pr.otherDeductions || ''} 
                                                            onChange={e => updateGeneratedPayroll(idx, 'otherDeductions', parseFloat(e.target.value) || 0)}
                                                            className="w-20 p-1 border rounded text-xs outline-none bg-white text-black focus:ring-1 focus:ring-red-500"
                                                            disabled={pr.status === 'paid'}
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center font-black text-green-700 font-mono text-base">{pr.netSalary.toLocaleString()}</td>
                                                    <td className="p-3 text-center">
                                                        {pr.status === 'paid' ? (
                                                            <span className="bg-green-100 text-green-700 px-2 py-1 flex items-center justify-center gap-1 rounded text-xs font-bold w-fit mx-auto"><Check size={12}/> معتمد</span>
                                                        ) : (
                                                            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold inline-block">قيد المراجعة</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {generatedPayrolls.length > 0 && (
                                                <tr className="bg-jilco-50 border-t-2 border-jilco-200">
                                                    <td colSpan={8} className="p-3 font-bold text-jilco-900 text-left">إجمالي مسير الرواتب:</td>
                                                    <td className="p-3 text-center font-black text-jilco-900 font-mono text-lg">{generatedPayrolls.reduce((sum, p) => sum + p.netSalary, 0).toLocaleString()}</td>
                                                    <td></td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Loans View */}
                {activeTab === 'loans' && (
                    <div className="animate-fade-in space-y-6">
                        <div className="flex justify-between items-end mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-jilco-900">سلف ومستحقات الموظفين</h2>
                            <button onClick={() => { setCurrentLoan({ status: 'active', startDate: new Date().toISOString().slice(0, 7) }); setShowLoanForm(true); }} className="bg-jilco-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow flex-shrink-0 text-sm">
                                <Plus size={16} /> تسجيل سلفة جديدة
                            </button>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">
                            <table className="w-full text-sm text-right min-w-[600px]">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="p-4">الموظف</th>
                                        <th className="p-4">المبلغ الكلي</th>
                                        <th className="p-4">عدد الأقساط</th>
                                        <th className="p-4">تاريخ البداية</th>
                                        <th className="p-4">القسط الشهري</th>
                                        <th className="p-4">المتبقي</th>
                                        <th className="p-4 text-center">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loans.map(loan => {
                                        const emp = employees.find(e => e.id === loan.employeeId);
                                        return (
                                            <tr key={loan.id} className="hover:bg-gray-50">
                                                <td className="p-4 font-bold">{emp?.name || 'غير معروف'}</td>
                                                <td className="p-4 font-mono font-bold text-jilco-700">{loan.amount.toLocaleString()}</td>
                                                <td className="p-4 font-mono">{loan.installmentsCount}</td>
                                                <td className="p-4 text-gray-600">{loan.startDate}</td>
                                                <td className="p-4 font-mono font-bold text-red-600">{loan.monthlyInstallment.toLocaleString()}</td>
                                                <td className="p-4 font-mono font-bold">{loan.remainingAmount.toLocaleString()}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${loan.status === 'active' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                        {loan.status === 'active' ? 'مستمرة' : 'منتهية'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {loans.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-500 font-bold">لا يوجد سلف مسجلة حالياً</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Attendance View */}
                {activeTab === 'attendance' && (
                    <div className="animate-fade-in space-y-6">
                        <div className="flex justify-between items-end mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-jilco-900">الحضور والانصراف الشهري</h2>
                            <button onClick={() => { setCurrentAttendance({ month: new Date().toISOString().slice(0, 7), absenceDays: 0, delayHours: 0 }); setShowAttendanceForm(true); }} className="bg-jilco-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow flex-shrink-0 text-sm">
                                <Plus size={16} /> تسجيل غياب/تأخير
                            </button>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">
                            <table className="w-full text-sm text-right min-w-[600px]">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="p-4">الموظف</th>
                                        <th className="p-4">الشهر</th>
                                        <th className="p-4">أيام الغياب</th>
                                        <th className="p-4">ساعات التأخير</th>
                                        <th className="p-4">ملاحظات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {attendance.map(att => {
                                        const emp = employees.find(e => e.id === att.employeeId);
                                        return (
                                            <tr key={att.id} className="hover:bg-gray-50">
                                                <td className="p-4 font-bold">{emp?.name || 'غير معروف'}</td>
                                                <td className="p-4 font-mono">{att.month}</td>
                                                <td className="p-4 font-mono font-bold text-red-600">{att.absenceDays > 0 ? att.absenceDays : '-'}</td>
                                                <td className="p-4 font-mono font-bold text-orange-600">{att.delayHours > 0 ? att.delayHours : '-'}</td>
                                                <td className="p-4 text-gray-600 text-xs">{att.notes || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                    {attendance.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500 font-bold">لا يوجد سجلات حضور مسجلة حالياً</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Leaves View */}
                {activeTab === 'leaves' && (
                    <div className="animate-fade-in space-y-6">
                        <div className="flex justify-between items-end mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-jilco-900">طلبات الإجازة</h2>
                            <button onClick={() => { setCurrentLeave({ status: 'pending', type: 'annual' }); setShowLeaveForm(true); }} className="bg-jilco-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow flex-shrink-0 text-sm">
                                <Plus size={16} /> طلب إجازة
                            </button>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">
                            <table className="w-full text-sm text-right min-w-[600px]">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="p-4">الموظف</th>
                                        <th className="p-4">النوع</th>
                                        <th className="p-4">المدة</th>
                                        <th className="p-4 text-center">الحالة</th>
                                        <th className="p-4">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {leaves.map(lv => {
                                        const emp = employees.find(e => e.id === lv.employeeId);
                                        const startDate = new Date(lv.startDate);
                                        const endDate = new Date(lv.endDate);
                                        const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                        return (
                                            <tr key={lv.id} className="hover:bg-gray-50">
                                                <td className="p-4 font-bold">{emp?.name || 'غير معروف'}</td>
                                                <td className="p-4">
                                                    {lv.type === 'annual' ? 'إجازة سنوية' : lv.type === 'sick' ? 'إجازة مرضية' : 'إجازة بدون راتب'}
                                                </td>
                                                <td className="p-4 text-xs font-mono">
                                                    من: {lv.startDate} إلي: {lv.endDate} <br />
                                                    <span className="font-bold text-jilco-700">({days} يوم)</span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${lv.status === 'approved' ? 'bg-green-100 text-green-700' : lv.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {lv.status === 'approved' ? 'معتمدة' : lv.status === 'rejected' ? 'مرفوضة' : 'قيد المراجعة'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    {lv.status === 'pending' && (
                                                        <div className="flex gap-2">
                                                            <button onClick={async () => {
                                                                await saveHRRecord('jilco_hr_leaves', lv.id, { ...lv, status: 'approved' });
                                                            }} className="p-1.5 text-green-600 hover:bg-green-100 rounded" title="قبول الطلب"><Check size={16} /></button>
                                                            <button onClick={async () => {
                                                                await saveHRRecord('jilco_hr_leaves', lv.id, { ...lv, status: 'rejected' });
                                                            }} className="p-1.5 text-red-600 hover:bg-red-100 rounded" title="رفض الطلب"><XCircle size={16} /></button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {leaves.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500 font-bold">لا يوجد طلبات إجازة الحالية</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showEmployeeForm && renderEmployeeForm()}
            {showCommissionForm && renderCommissionForm()}
            {showLoanForm && renderLoanForm()}
            {showAttendanceForm && renderAttendanceForm()}
            {showLeaveForm && renderLeaveForm()}
            {renderEmployeeStatement()}
        </div>
    );
};

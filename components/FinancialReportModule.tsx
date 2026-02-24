import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Printer, ChevronDown, ChevronUp, BarChart3, RefreshCw } from 'lucide-react';
import { useSales } from '../contexts/SalesContext';
import { usePurchase } from '../contexts/PurchaseContext';
import { useProject } from '../contexts/ProjectContext';
import { useHR } from '../contexts/HRContext';

type Period = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';

const fmt = (n: number) => n.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const StatCard: React.FC<{ label: string; value: number; sub?: string; color: string; icon: React.ReactNode; trend?: number }> = ({ label, value, sub, color, icon, trend }) => (
    <div className={`bg-white p-5 rounded-2xl border shadow-sm border-l-4 ${color}`}>
        <div className="flex justify-between items-start mb-3">
            <div className="p-2 rounded-xl bg-gray-50">{icon}</div>
            {trend !== undefined && (
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
                </span>
            )}
        </div>
        <p className="text-xs font-bold text-gray-500 mb-1">{label}</p>
        <p className="text-2xl font-black text-gray-900">{fmt(value)}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
);

export const FinancialReportModule: React.FC = () => {
    const { invoices: salesInvoices } = useSales();
    const { purchaseInvoices, supplierPayments } = usePurchase();
    const { expenses } = useProject();
    const { hrEmployees: employees } = useHR();

    const [period, setPeriod] = useState<Period>('this_month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [expandedSection, setExpandedSection] = useState<string | null>(null);

    // حساب نطاق التاريخ
    const { startDate, endDate } = useMemo(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();

        switch (period) {
            case 'this_month':
                return { startDate: new Date(y, m, 1), endDate: new Date(y, m + 1, 0) };
            case 'last_month':
                return { startDate: new Date(y, m - 1, 1), endDate: new Date(y, m, 0) };
            case 'this_quarter': {
                const q = Math.floor(m / 3);
                return { startDate: new Date(y, q * 3, 1), endDate: new Date(y, q * 3 + 3, 0) };
            }
            case 'this_year':
                return { startDate: new Date(y, 0, 1), endDate: new Date(y, 11, 31) };
            case 'custom':
                return {
                    startDate: customStart ? new Date(customStart) : new Date(y, 0, 1),
                    endDate: customEnd ? new Date(customEnd) : now,
                };
            default:
                return { startDate: new Date(y, m, 1), endDate: new Date(y, m + 1, 0) };
        }
    }, [period, customStart, customEnd]);

    const inRange = (dateStr: string) => {
        const d = new Date(dateStr);
        return d >= startDate && d <= endDate;
    };

    // 1. الإيرادات — فواتير العملاء المدفوعة أو المستحقة في الفترة
    const revenueInvoices = salesInvoices.filter((inv: any) => inRange(inv.date));
    const totalRevenue = revenueInvoices.reduce((s: number, inv: any) => {
        const subtotal = (inv.items || []).reduce((ss: number, item: any) => ss + (item.total || 0), 0);
        const taxRate = inv.taxRate ?? 0.15;
        const discount = inv.discountAmount || 0;
        return s + subtotal * (1 + taxRate) - discount;
    }, 0);

    // 2. تكلفة المشتريات — فواتير الشراء في الفترة
    const purchasesInPeriod = purchaseInvoices.filter((inv: any) => inRange(inv.date));
    const totalPurchases = purchasesInPeriod.reduce((s: number, inv: any) => s + (inv.grandTotal || 0), 0);

    // 3. مصروفات التشغيل — من وحدة المصروفات
    const expensesInPeriod = expenses.filter((e: any) => inRange(e.date));
    const totalExpenses = expensesInPeriod.reduce((s: number, e: any) => s + (e.amount || 0), 0);

    // 4. الرواتب — مجموع رواتب الموظفين النشطين × عدد الأشهر في الفترة
    const activeEmployees = employees.filter((e: any) => e.status === 'active');
    const monthsInPeriod = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (30 * 86400000)));
    // نحسب الرواتب من basicSalary مباشرة (لا يوجد جدول رواتب منفصل)
    const paidSalaries = activeEmployees.reduce((s: number, e: any) => s + (e.basicSalary || 0), 0) * monthsInPeriod;

    // المجاميع
    const totalCosts = totalPurchases + totalExpenses + paidSalaries;
    const grossProfit = totalRevenue - totalPurchases;
    const operatingProfit = grossProfit - totalExpenses;
    const netProfit = operatingProfit - paidSalaries;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const periodLabels: Record<Period, string> = {
        this_month: 'هذا الشهر',
        last_month: 'الشهر الماضي',
        this_quarter: 'هذا الربع',
        this_year: 'هذه السنة',
        custom: 'فترة مخصصة',
    };

    const toggle = (s: string) => setExpandedSection(prev => prev === s ? null : s);

    return (
        <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="flex justify-between items-center mb-8 print:hidden">
                    <div>
                        <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                            <BarChart3 className="text-gold-500" /> التقارير المالية
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">تقرير الأرباح والخسائر — {periodLabels[period]}</p>
                    </div>
                    <button onClick={() => window.print()} className="bg-jilco-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-800 shadow">
                        <Printer size={18} /> طباعة
                    </button>
                </div>

                {/* Period Selector */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-3 print:hidden shadow-sm">
                    <span className="text-xs font-bold text-gray-500 shrink-0">الفترة الزمنية:</span>
                    {(['this_month', 'last_month', 'this_quarter', 'this_year', 'custom'] as Period[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${period === p ? 'bg-jilco-900 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            {periodLabels[p]}
                        </button>
                    ))}
                    {period === 'custom' && (
                        <div className="flex items-center gap-2 mr-2">
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="p-2 border rounded-lg text-xs font-bold" title="تاريخ البداية" />
                            <span className="text-gray-400">—</span>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="p-2 border rounded-lg text-xs font-bold" title="تاريخ النهاية" />
                        </div>
                    )}
                </div>

                {/* ===== PRINTABLE REPORT ===== */}
                <div id="pl-report" className="space-y-6 print:space-y-4">

                    {/* Print Header */}
                    <div className="hidden print:flex justify-between items-center pb-4 border-b-2 border-jilco-900 mb-4">
                        <div>
                            <h1 className="text-xl font-black text-jilco-900">تقرير الأرباح والخسائر</h1>
                            <p className="text-xs text-gray-500">{periodLabels[period]} | طُبع: {new Date().toLocaleDateString('en-GB')}</p>
                        </div>
                        <div className="text-left">
                            <p className="text-xs font-bold text-gray-400">من {startDate.toLocaleDateString('en-GB')} إلى {endDate.toLocaleDateString('en-GB')}</p>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
                        <StatCard label="إجمالي الإيرادات" value={totalRevenue} sub="ريال سعودي" color="border-l-blue-500" icon={<TrendingUp size={20} className="text-blue-500" />} />
                        <StatCard label="إجمالي التكاليف" value={totalCosts} sub="ريال سعودي" color="border-l-red-500" icon={<TrendingDown size={20} className="text-red-500" />} />
                        <StatCard label="صافي الربح" value={netProfit} sub={`هامش الربح ${profitMargin.toFixed(1)}%`} color={netProfit >= 0 ? 'border-l-green-500' : 'border-l-red-600'} icon={<DollarSign size={20} className={netProfit >= 0 ? 'text-green-500' : 'text-red-600'} />} />
                        <StatCard label="الإيرادات من الفواتير" value={revenueInvoices.length} sub={`${revenueInvoices.length} فاتورة`} color="border-l-gold-500" icon={<RefreshCw size={20} className="text-gold-500" />} />
                    </div>

                    {/* P&L Statement Table */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden print:shadow-none print:border print:rounded-none">
                        <div className="px-6 py-4 bg-jilco-900 text-white flex justify-between items-center">
                            <h2 className="font-black text-lg">قائمة الأرباح والخسائر</h2>
                            <p className="text-xs text-gray-300">{startDate.toLocaleDateString('ar-SA')} — {endDate.toLocaleDateString('ar-SA')}</p>
                        </div>

                        <table className="w-full text-sm text-right">
                            <tbody className="divide-y divide-gray-100">

                                {/* الإيرادات */}
                                <tr className="bg-blue-50 cursor-pointer hover:bg-blue-100" onClick={() => toggle('revenue')}>
                                    <td className="p-4 font-black text-blue-900 flex items-center gap-2">
                                        {expandedSection === 'revenue' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        الإيرادات
                                    </td>
                                    <td className="p-4 text-center font-black text-blue-900 font-mono">{fmt(totalRevenue)}</td>
                                    <td className="p-4 text-center text-xs text-blue-700">{revenueInvoices.length} فاتورة</td>
                                </tr>
                                {expandedSection === 'revenue' && revenueInvoices.slice(0, 10).map((inv: any) => (
                                    <tr key={inv.id} className="bg-blue-50/30 text-xs">
                                        <td className="pr-12 py-2 text-gray-600">فاتورة {inv.number} — {inv.customerName}</td>
                                        <td className="p-2 text-center font-mono text-gray-700">
                                            {fmt((inv.items || []).reduce((s: number, i: any) => s + (i.total || 0), 0) * (1 + (inv.taxRate ?? 0.15)) - (inv.discountAmount || 0))}
                                        </td>
                                        <td className="p-2 text-center text-gray-400">{inv.date}</td>
                                    </tr>
                                ))}
                                {expandedSection === 'revenue' && revenueInvoices.length > 10 && (
                                    <tr className="bg-blue-50/20"><td colSpan={3} className="pr-12 py-1 text-xs text-gray-400 italic">... و {revenueInvoices.length - 10} فاتورة أخرى</td></tr>
                                )}

                                {/* إجمالي مكسب */}
                                <tr className="bg-green-50 font-bold">
                                    <td className="p-4 text-green-900 pr-8">مجمل الربح (بعد خصم المشتريات)</td>
                                    <td className="p-4 text-center text-green-900 font-mono font-black">{fmt(grossProfit)}</td>
                                    <td className="p-4 text-center text-xs text-green-700">{totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0}%</td>
                                </tr>

                                {/* المشتريات */}
                                <tr className="bg-orange-50/50 cursor-pointer hover:bg-orange-100/50" onClick={() => toggle('purchases')}>
                                    <td className="p-4 font-bold text-orange-900 flex items-center gap-2">
                                        {expandedSection === 'purchases' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        تكلفة المشتريات
                                    </td>
                                    <td className="p-4 text-center font-bold text-orange-900 font-mono">({fmt(totalPurchases)})</td>
                                    <td className="p-4 text-center text-xs text-orange-700">{purchasesInPeriod.length} فاتورة</td>
                                </tr>
                                {expandedSection === 'purchases' && purchasesInPeriod.slice(0, 10).map((inv: any) => (
                                    <tr key={inv.id} className="bg-orange-50/20 text-xs">
                                        <td className="pr-12 py-2 text-gray-600">فاتورة {inv.number}</td>
                                        <td className="p-2 text-center font-mono text-gray-700">({fmt(inv.grandTotal)})</td>
                                        <td className="p-2 text-center text-gray-400">{inv.date}</td>
                                    </tr>
                                ))}

                                {/* المصروفات التشغيلية */}
                                <tr className="bg-red-50/50 cursor-pointer hover:bg-red-100/50" onClick={() => toggle('expenses')}>
                                    <td className="p-4 font-bold text-red-900 flex items-center gap-2">
                                        {expandedSection === 'expenses' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        المصروفات التشغيلية
                                    </td>
                                    <td className="p-4 text-center font-bold text-red-900 font-mono">({fmt(totalExpenses)})</td>
                                    <td className="p-4 text-center text-xs text-red-700">{expensesInPeriod.length} مصروف</td>
                                </tr>
                                {expandedSection === 'expenses' && expensesInPeriod.slice(0, 10).map((e: any) => (
                                    <tr key={e.id} className="bg-red-50/20 text-xs">
                                        <td className="pr-12 py-2 text-gray-600">{e.categoryName} — {e.description}</td>
                                        <td className="p-2 text-center font-mono text-gray-700">({fmt(e.amount)})</td>
                                        <td className="p-2 text-center text-gray-400">{e.date}</td>
                                    </tr>
                                ))}

                                {/* الرواتب */}
                                <tr className="bg-purple-50/50 cursor-pointer hover:bg-purple-100/50" onClick={() => toggle('salaries')}>
                                    <td className="p-4 font-bold text-purple-900 flex items-center gap-2">
                                        {expandedSection === 'salaries' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        الرواتب والأجور
                                    </td>
                                    <td className="p-4 text-center font-bold text-purple-900 font-mono">({fmt(paidSalaries)})</td>
                                    <td className="p-4 text-center text-xs text-purple-700">{activeEmployees.length} موظف</td>
                                </tr>
                                {expandedSection === 'salaries' && activeEmployees.map((e: any) => (
                                    <tr key={e.id} className="bg-purple-50/20 text-xs">
                                        <td className="pr-12 py-2 text-gray-600">{e.name} — {e.role}</td>
                                        <td className="p-2 text-center font-mono text-gray-700">({fmt(e.basicSalary * monthsInPeriod)})</td>
                                        <td className="p-2 text-center text-gray-400">{e.basicSalary.toLocaleString()} / شهر</td>
                                    </tr>
                                ))}

                                {/* ربح التشغيل */}
                                <tr className="bg-teal-50 font-bold">
                                    <td className="p-4 text-teal-900 pr-8">ربح التشغيل (EBIT)</td>
                                    <td className={`p-4 text-center font-mono font-black ${operatingProfit >= 0 ? 'text-teal-900' : 'text-red-700'}`}>{operatingProfit < 0 ? '(' : ''}{fmt(Math.abs(operatingProfit))}{operatingProfit < 0 ? ')' : ''}</td>
                                    <td className="p-4 text-center text-xs text-teal-700">{totalRevenue > 0 ? ((operatingProfit / totalRevenue) * 100).toFixed(1) : 0}%</td>
                                </tr>

                                {/* صافي الربح */}
                                <tr className={`font-black text-base ${netProfit >= 0 ? 'bg-green-700' : 'bg-red-700'} text-white`}>
                                    <td className="p-5">صافي الربح / الخسارة</td>
                                    <td className="p-5 text-center font-mono text-xl">{netProfit < 0 ? '(' : ''}{fmt(Math.abs(netProfit))}{netProfit < 0 ? ')' : ''}</td>
                                    <td className="p-5 text-center text-sm opacity-80">هامش {profitMargin.toFixed(1)}%</td>
                                </tr>

                            </tbody>
                        </table>
                    </div>

                    {/* Summary bar */}
                    {totalRevenue > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm print:hidden">
                            <p className="text-xs font-bold text-gray-500 mb-3">توزيع التكاليف من الإيرادات</p>
                            <div className="flex rounded-full overflow-hidden h-6 text-xs font-bold">
                                <div style={{ width: `${(totalPurchases / totalRevenue) * 100}%` }} className="bg-orange-400 flex items-center justify-center text-white truncate px-1">مشتريات</div>
                                <div style={{ width: `${(totalExpenses / totalRevenue) * 100}%` }} className="bg-red-400 flex items-center justify-center text-white truncate px-1">مصروفات</div>
                                <div style={{ width: `${(paidSalaries / totalRevenue) * 100}%` }} className="bg-purple-400 flex items-center justify-center text-white truncate px-1">رواتب</div>
                                <div style={{ width: `${Math.max(0, (netProfit / totalRevenue) * 100)}%` }} className={`flex items-center justify-center text-white truncate px-1 ${netProfit >= 0 ? 'bg-green-500' : 'bg-gray-300'}`}>ربح</div>
                            </div>
                            <div className="flex gap-4 mt-2 flex-wrap">
                                <span className="text-xs text-gray-500 flex items-center gap-1"><span className="w-3 h-3 bg-orange-400 rounded-full inline-block"></span>مشتريات {fmt(totalPurchases)}</span>
                                <span className="text-xs text-gray-500 flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded-full inline-block"></span>مصروفات {fmt(totalExpenses)}</span>
                                <span className="text-xs text-gray-500 flex items-center gap-1"><span className="w-3 h-3 bg-purple-400 rounded-full inline-block"></span>رواتب {fmt(paidSalaries)}</span>
                                <span className={`text-xs flex items-center gap-1 font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}><span className={`w-3 h-3 rounded-full inline-block ${netProfit >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>صافي ربح {fmt(netProfit)}</span>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

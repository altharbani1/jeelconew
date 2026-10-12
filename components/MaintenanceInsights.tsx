import React, { useMemo, useState } from 'react';
import { BarChart3, Package, Plus, ShieldCheck, Timer } from 'lucide-react';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useInventory } from '../contexts/InventoryContext';
import { useAuth } from '../contexts/AuthContext';
import { MaintenancePartUsage } from '../types';

const daysBetween = (from?: string, to?: string) => {
    if (!from || !to) return 0;
    return Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / 86400000);
};

/** تقارير التشغيل وإثبات تكلفة قطع الغيار في سجل الصيانة السحابي. */
export const MaintenanceInsights: React.FC = () => {
    const { tickets, visits, partUsages, addPartUsage } = useMaintenance();
    const { supplierProducts } = useInventory();
    const { hasPermission } = useAuth();
    const [target, setTarget] = useState<'ticket' | 'visit'>('ticket');
    const [targetId, setTargetId] = useState('');
    const [productId, setProductId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [saving, setSaving] = useState(false);

    const metrics = useMemo(() => {
        const resolved = tickets.filter(ticket => ticket.resolvedDate || ticket.resolvedAt);
        const mttr = resolved.length
            ? resolved.reduce((sum, ticket) => sum + daysBetween(ticket.reportedDate, ticket.resolvedDate || ticket.resolvedAt), 0) / resolved.length
            : 0;
        const eligible = tickets.filter(ticket => ticket.status === 'resolved' || ticket.status === 'closed');
        const withinSla = eligible.filter(ticket => {
            const completed = ticket.resolvedDate || ticket.resolvedAt?.slice(0, 10);
            return completed && ticket.slaResolutionDueDate ? completed <= ticket.slaResolutionDueDate : !ticket.slaBreached;
        });
        const partsCost = partUsages.reduce((sum, part) => sum + Number(part.totalCost || 0), 0);
        const laborCost = tickets.reduce((sum, ticket) => sum + Number(ticket.laborCost || 0), 0)
            + visits.reduce((sum, visit) => sum + Number(visit.laborCost || 0), 0);
        return { mttr, sla: eligible.length ? (withinSla.length / eligible.length) * 100 : 100, partsCost, laborCost, totalCost: partsCost + laborCost };
    }, [tickets, visits, partUsages]);

    if (!hasPermission('view_maintenance_reports')) return null;

    const selectedProduct = supplierProducts.find(product => product.id === productId);
    const handlePartUsage = async () => {
        if (!hasPermission('manage_maintenance_parts') || !selectedProduct || !targetId || quantity <= 0) return;
        setSaving(true);
        try {
            const usage: MaintenancePartUsage = {
                id: `MPU-${Date.now()}`,
                productId: selectedProduct.id,
                productName: selectedProduct.name,
                quantity,
                unitCost: Number(selectedProduct.purchasePrice || 0),
                totalCost: quantity * Number(selectedProduct.purchasePrice || 0),
                recordedAt: new Date().toISOString(),
            };
            await addPartUsage(usage, target === 'ticket' ? { ticketId: targetId } : { visitId: targetId });
            setQuantity(1);
            setProductId('');
        } finally { setSaving(false); }
    };

    return <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Metric icon={<ShieldCheck size={20} />} label="التزام SLA" value={`${metrics.sla.toFixed(0)}%`} tone="green" />
            <Metric icon={<Timer size={20} />} label="MTTR (يوم)" value={metrics.mttr.toFixed(1)} tone="blue" />
            <Metric icon={<Package size={20} />} label="تكلفة القطع" value={`${metrics.partsCost.toLocaleString('ar-SA')} ر.س`} tone="amber" />
            <Metric icon={<BarChart3 size={20} />} label="تكلفة العمالة" value={`${metrics.laborCost.toLocaleString('ar-SA')} ر.س`} tone="purple" />
            <Metric icon={<BarChart3 size={20} />} label="إجمالي التكلفة" value={`${metrics.totalCost.toLocaleString('ar-SA')} ر.س`} tone="red" />
        </div>
        {hasPermission('manage_maintenance_parts') && <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4"><div><h2 className="font-black text-jilco-900 flex items-center gap-2"><Package size={19} /> تسجيل صرف قطعة غيار</h2><p className="text-xs text-gray-500 mt-1">يُحفظ السجل سحابيًا ويرتبط بتذكرة أو زيارة محددة.</p></div><Plus className="text-jilco-600" size={20} /></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select title="نوع أمر العمل" value={target} onChange={event => { setTarget(event.target.value as 'ticket' | 'visit'); setTargetId(''); }} className="p-3 border rounded-xl text-sm font-bold"><option value="ticket">تذكرة</option><option value="visit">زيارة</option></select>
                <select title="التذكرة أو الزيارة" value={targetId} onChange={event => setTargetId(event.target.value)} className="p-3 border rounded-xl text-sm"><option value="">اختر أمر العمل</option>{target === 'ticket' ? tickets.map(ticket => <option key={ticket.id} value={ticket.id}>{ticket.number}</option>) : visits.map(visit => <option key={visit.id} value={visit.id}>{visit.scheduledDate}</option>)}</select>
                <select title="قطعة الغيار" value={productId} onChange={event => setProductId(event.target.value)} className="p-3 border rounded-xl text-sm"><option value="">اختر قطعة الغيار</option>{supplierProducts.map(product => <option key={product.id} value={product.id}>{product.name} ({product.purchasePrice || 0} ر.س)</option>)}</select>
                <div className="flex gap-2"><input title="الكمية" min="1" type="number" value={quantity} onChange={event => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="w-24 p-3 border rounded-xl text-sm" /><button disabled={saving || !targetId || !productId} onClick={() => void handlePartUsage()} className="flex-1 bg-jilco-700 disabled:opacity-50 text-white rounded-xl font-bold">{saving ? 'جارٍ الحفظ...' : 'حفظ الصرف'}</button></div>
            </div>
        </section>}
    </div>;
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string | number; tone: string }> = ({ icon, label, value, tone }) => <div className={`bg-white border border-${tone}-100 rounded-2xl p-4 shadow-sm`}><div className={`text-${tone}-600 mb-2`}>{icon}</div><p className="text-xs font-bold text-gray-500">{label}</p><p className="text-xl font-black text-jilco-900 mt-1">{value}</p></div>;

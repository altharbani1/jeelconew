import { useMemo } from 'react';
import { useSales } from '../contexts/SalesContext';
import { usePurchase } from '../contexts/PurchaseContext';
import { useProject } from '../contexts/ProjectContext';

export interface AppNotification {
    id: string;
    type: 'overdue_invoice' | 'overdue_purchase' | 'warranty_expiring' | 'late_phase' | 'document_expiring';
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    date?: string;
    actionView?: string; // SystemView to navigate to
}

export const useNotifications = (): { notifications: AppNotification[]; count: number } => {
    const { invoices: salesInvoices } = useSales();
    const { purchaseInvoices, suppliers } = usePurchase();
    const { phases, projects, warranties } = useProject();

    const notifications = useMemo<AppNotification[]>(() => {
        const result: AppNotification[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. فواتير العملاء المتأخرة
        salesInvoices.forEach((inv: any) => {
            if (inv.status === 'overdue' || (inv.status === 'pending' && inv.dueDate && new Date(inv.dueDate) < today)) {
                const daysDiff = Math.floor((today.getTime() - new Date(inv.dueDate || inv.date).getTime()) / 86400000);
                result.push({
                    id: `oi-${inv.id}`,
                    type: 'overdue_invoice',
                    severity: daysDiff > 30 ? 'critical' : 'warning',
                    title: `فاتورة عميل متأخرة ${daysDiff} يوم`,
                    description: `${inv.customerName || 'عميل'} — فاتورة ${inv.number || ''}`,
                    date: inv.dueDate || inv.date,
                    actionView: 'invoices',
                });
            }
        });

        // 2. فواتير شراء غير مسددة +30 يوم
        purchaseInvoices.forEach((inv: any) => {
            if (inv.status !== 'paid') {
                const invDate = new Date(inv.date);
                const daysDiff = Math.floor((today.getTime() - invDate.getTime()) / 86400000);
                if (daysDiff > 30) {
                    const supplier = suppliers.find((s: any) => s.id === inv.supplierId);
                    result.push({
                        id: `op-${inv.id}`,
                        type: 'overdue_purchase',
                        severity: daysDiff > 60 ? 'critical' : 'warning',
                        title: `فاتورة شراء غير مسددة (${daysDiff} يوم)`,
                        description: `${supplier?.name || 'مورد'} — فاتورة ${inv.number}`,
                        date: inv.date,
                        actionView: 'purchases',
                    });
                }
            }
        });

        // 3. مراحل المشاريع المتأخرة
        phases.forEach((phase: any) => {
            if (phase.status === 'late' || (phase.endDate && new Date(phase.endDate) < today && phase.status !== 'completed')) {
                const project = projects.find((p: any) => p.id === phase.projectId);
                result.push({
                    id: `lp-${phase.id}`,
                    type: 'late_phase',
                    severity: 'warning',
                    title: `مرحلة مشروع متأخرة`,
                    description: `${project?.name || 'مشروع'} — ${phase.name}`,
                    date: phase.endDate,
                    actionView: 'projects',
                });
            }
        });

        // 4. ضمانات تنتهي خلال 60 يوم
        warranties.forEach((w: any) => {
            if (!w.warrantyEndDate) return;
            const endDate = new Date(w.warrantyEndDate);
            const daysLeft = Math.floor((endDate.getTime() - today.getTime()) / 86400000);
            if (daysLeft >= 0 && daysLeft <= 60) {
                result.push({
                    id: `wx-${w.id}`,
                    type: 'warranty_expiring',
                    severity: daysLeft <= 15 ? 'critical' : 'info',
                    title: `ضمان ينتهي خلال ${daysLeft} يوم`,
                    description: `${w.customerName || ''} — ${w.projectName || ''}`,
                    date: w.warrantyEndDate,
                    actionView: 'warranties',
                });
            }
        });

        // ترتيب: الحرجة أولاً
        return result.sort((a, b) => {
            const order = { critical: 0, warning: 1, info: 2 };
            return order[a.severity] - order[b.severity];
        });
    }, [salesInvoices, purchaseInvoices, suppliers, phases, projects, warranties]);

    return { notifications, count: notifications.length };
};

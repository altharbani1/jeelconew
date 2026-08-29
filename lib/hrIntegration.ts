import { Employee, PayrollRecord } from '../types';

const asFiniteAmount = (value: unknown): number => {
    const amount = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(amount) ? amount : 0;
};

/** Returns true when a payroll month overlaps the selected calendar range. */
export const isPayrollMonthInRange = (month: string, startDate: Date, endDate: Date): boolean => {
    if (!/^\d{4}-\d{2}$/.test(month) || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return false;
    }

    const [year, monthNumber] = month.split('-').map(Number);
    if (monthNumber < 1 || monthNumber > 12) return false;

    const monthStart = new Date(year, monthNumber - 1, 1);
    const monthEnd = new Date(year, monthNumber, 0, 23, 59, 59, 999);
    return monthStart <= endDate && monthEnd >= startDate;
};

/** Financial reports recognise salary cost only after the payroll is marked paid. */
export const getPaidPayrollsInRange = (
    payrolls: PayrollRecord[],
    startDate: Date,
    endDate: Date,
): PayrollRecord[] => payrolls.filter(
    payroll => payroll.status === 'paid' && isPayrollMonthInRange(payroll.month, startDate, endDate),
);

export const sumNetPayroll = (payrolls: PayrollRecord[]): number => payrolls.reduce(
    (total, payroll) => total + asFiniteAmount(payroll.netSalary),
    0,
);

/** Supports both the current role model and legacy department-based employee records. */
export const isMaintenanceTechnician = (employee: Employee): boolean => {
    if (employee.status !== 'active') return false;
    if (employee.role === 'technician') return true;

    const department = (employee.department || '').trim();
    return department.includes('الصيانة') || department.includes('التركيب');
};

export const isActiveProjectAssignee = (employee: Employee): boolean => employee.status === 'active'
    && (employee.role === 'technician' || employee.role === 'manager');

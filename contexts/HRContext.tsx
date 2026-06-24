import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useCloudSync } from '../lib/useCloudSync';
import { PayrollRecord, EmployeePayment, EmployeeLoan, AttendanceRecord, LeaveRequest } from '../types';

interface HRContextType {
    hrEmployees: any[];
    hrCommissions: any[];
    hrPayrolls: PayrollRecord[];
    hrEmployeePayments: EmployeePayment[];
    hrLoans: EmployeeLoan[];
    hrAttendance: AttendanceRecord[];
    hrLeaves: LeaveRequest[];
    
    setHrEmployees: React.Dispatch<React.SetStateAction<any[]>>;
    setHrCommissions: React.Dispatch<React.SetStateAction<any[]>>;
    setHrPayrolls: React.Dispatch<React.SetStateAction<PayrollRecord[]>>;
    setHrEmployeePayments: React.Dispatch<React.SetStateAction<EmployeePayment[]>>;
    setHrLoans: React.Dispatch<React.SetStateAction<EmployeeLoan[]>>;
    setHrAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
    setHrLeaves: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;
    
    saveHRRecord: (collection: string, id: string, data: any) => Promise<boolean>;
    deleteHRRecord: (collection: string, id: string) => Promise<boolean>;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

const HRContext = createContext<HRContextType | undefined>(undefined);

export const HRProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [hrEmployees, setHrEmployees] = useState<any[]>([]);
    const [hrCommissions, setHrCommissions] = useState<any[]>([]);
    const [hrPayrolls, setHrPayrolls] = useState<PayrollRecord[]>([]);
    const [hrEmployeePayments, setHrEmployeePayments] = useState<EmployeePayment[]>([]);
    const [hrLoans, setHrLoans] = useState<EmployeeLoan[]>([]);
    const [hrAttendance, setHrAttendance] = useState<AttendanceRecord[]>([]);
    const [hrLeaves, setHrLeaves] = useState<LeaveRequest[]>([]);

    const modules = [
        { collection: 'jilco_hr_employees', stateSetter: setHrEmployees },
        { collection: 'jilco_hr_commissions', stateSetter: setHrCommissions },
        { collection: 'jilco_hr_payrolls', stateSetter: setHrPayrolls },
        { collection: 'jilco_hr_payments', stateSetter: setHrEmployeePayments },
        { collection: 'jilco_hr_loans', stateSetter: setHrLoans },
        { collection: 'jilco_hr_attendance', stateSetter: setHrAttendance },
        { collection: 'jilco_hr_leaves', stateSetter: setHrLeaves }
    ];

    const { syncStatus, saveRecord, deleteRecord } = useCloudSync(modules);

    return (
        <HRContext.Provider value={{
            hrEmployees, hrCommissions, hrPayrolls, hrEmployeePayments, hrLoans, hrAttendance, hrLeaves,
            setHrEmployees, setHrCommissions, setHrPayrolls, setHrEmployeePayments, setHrLoans, setHrAttendance, setHrLeaves,
            saveHRRecord: saveRecord,
            deleteHRRecord: deleteRecord,
            syncStatus
        }}>
            {children}
        </HRContext.Provider>
    );
};

export const useHR = () => {
    const context = useContext(HRContext);
    if (context === undefined) throw new Error('useHR must be used within an HRProvider');
    return context;
};

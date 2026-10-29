
import React, { useState, useEffect, useRef } from 'react';
import { Printer, FileSignature, Building, User, ShieldCheck, FileText, Phone, Mail, Globe, MapPin, AlertCircle, ClipboardList, ChevronDown, ArrowLeft, Plus, Search, Edit, Trash2, Save, Send, Import, X, DollarSign, Cpu, Settings, Zap } from 'lucide-react';
import { ContractData, CompanyConfig, TechnicalSpecs, SpecsDatabase, Customer, QuoteItem, QuoteDetails } from '../types';
import { useData } from '../contexts/DataContext.tsx';
import { useSales } from '../contexts/SalesContext.tsx';
import { useProject } from '../contexts/ProjectContext.tsx';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import { useAuth } from '../contexts/AuthContext';
import { cloudService } from '../services/cloudService';
import { allocateContractPayments, validateContract, importQuoteIntoContract, contractDraftKey, readContractDraft, writeContractDraft } from '../lib/contractCalculations.mjs';

const localContractDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Interface for saved quotes structure in localStorage
interface SavedQuote {
    id: string;
    details: QuoteDetails;
    items: QuoteItem[];
    techSpecs: TechnicalSpecs;
    lastModified: string;
}

// Fallback Default Options if DB is empty
const DEFAULT_OPTIONS: SpecsDatabase = {
    elevatorType: ['مصعد ركاب (Passenger)', 'مصعد بضائع (Freight)', 'مصعد طعام (Dumbwaiter)', 'مصعد بانوراما (Panoramic)', 'مصعد منزلي (Home Lift)'],
    capacity: ['320 كجم - 4 أشخاص', '450 كجم - 6 أشخاص', '630 كجم - 8 أشخاص', '800 كجم - 10 أشخاص', '1000 كجم - 13 شخص', '1250 كجم - 16 شخص'],
    speed: ['0.5 متر/ثانية', '1.0 متر/ثانية', '1.6 متر/ثانية', '2.0 متر/ثانية'],
    stops: ['2 وقفات / 2 فتحات', '3 وقفات / 3 فتحات', '4 وقفات / 4 فتحات', '5 وقفات / 5 فتحات', '6 وقفات / 6 فتحات', '7 وقفات / 7 فتحات', '8 وقفات / 8 فتحات'],
    driveType: ['Gearless Machine (Montanari Italy)', 'Gearless Machine (Sicor Italy)', 'Geared Machine (Alberto Sassi)', 'Geared Machine (Torin Drive)', 'Hydraulic System', 'FUJI Gearless Machine'],
    controlSystem: ['Microprocessor Full Collective (VVVF)', 'Monarch Nice 3000+', 'Step Control System', 'INVT System'],
    powerSupply: ['3 Phase, 380V, 60Hz', '3 Phase, 220V, 60Hz', 'Single Phase, 220V, 60Hz'],
    cabin: ['ستانلس ستيل مع ديكورات ليزر ومرايا', 'ستانلس ستيل ذهبي (Ti-Gold)', 'بانوراما زجاجي كامل', 'تشطيب خشبي فاخر'],
    doors: ['أوتوماتيكية بالكامل (Center Opening)', 'أوتوماتيكية بالكامل (Telescopic)', 'نصف أوتوماتيك (Semi-Auto)', 'أبواب يدوية (Manual)'],
    machineRoom: ['غرفة ماكينة علوية (MR)', 'بدون غرفة ماكينة (MRL)', 'غرفة ماكينة جانبية'],
    rails: ['سكك مسحوبة على البارد (Marazzi Italy)', 'سكك مشغولة (Machined)'],
    ropes: ['حبال صلب (Drako German)', 'حبال صلب (Italian)'],
    safety: ['نظام باراشوت تدريجي (Progressive)', 'نظام باراشوت فوري', 'منظم سرعة (Overspeed Governor)'],
    emergency: ['نظام الطوارئ الأوتوماتيكي (ARD/UPS)', 'بطارية طوارئ للإضاءة والجرس', 'لا يوجد']
};

const INITIAL_CONFIG: CompanyConfig = {
  taxNumber: '',
    logo: null, stamp: null, headerTitle: 'جيلكو للمصاعد', headerSubtitle: 'JILCO ELEVATORS', footerText: 'الرياض - المملكة العربية السعودية', contactPhone: '', contactEmail: '', bankAccounts: []
};

const ACCESS_CONTROL_OPTIONS = [
    'بطاقة ذكية (Smart Card)',
    'بصمة إصبع (Fingerprint)',
    'رمز سري (PIN Code)',
    'التعرف على الوجه (Face Recognition)',
    'مفتاح تشغيل (Key Switch)',
    'تطبيق موبايل (Mobile App)',
    'بطاقة ذكية + رمز سري (Card + PIN)',
];

const DEFAULT_FIRST_PARTY = `توريد وتركيب وتشغيل المصاعد بحسب الموصفات الفنية المعتمدة وذلك بحسب المدة المتفق عليها.
فتح الفتحات اللازمة لعلب الطلبات الخارجية.
عمل الإختبارات المطلوبة بعد الانتهاء من التركيب والتشغيل للتأكد من سلامة المصاعد وتقديم شهادة بذلك.
تقديم شهادة الضمان للمصاعد بعد تشغيل المصاعد وإستلام الدفعة الأخيرة.
توفير طرف ثالث لفحص المصاعد بعد الإنتهاء من التركيب والتشغيل عند الطلب.`;

const DEFAULT_SECOND_PARTY = `تجهيز البئر بالكامل قبل البدء في التركيب بأسبوع على الأقل.
تركيب كابل ١٦ مم و قاطع ٦٠ أمبير بالدور الأخير للمصعد.
تحديد المنسوب النهائي للبلاط قبل تركيب الأبواب.
جميع أعمال التكسيير والتشطيب والتلييس والتقفيل على الأبواب وجوانبها وأعمال الجسور المعدنية داخل بئر المصعد.
تأمين مكان جاف لحفظ المواد طوال فترة التركيب.
تأمين السكن المناسب للفنيين ومهندس المشروع خلال فترة التركيب والتشغيل.`;

const DEFAULT_HANDOVER = `1. تقوم المؤسسة بإخطار العميل بإنتهاء أعمال التركيب والتشغيل للمصعد وأنه جاهز للإستخدام ويتم تسليم المصعد للعميل عن طريق كتاب خطي للتوقيع من الطرفين.

2. في حال عدم قيام العميل باستلام المصعد في مدة أقصاها ثلاثون يوماً (٣٠) يوم من تاريخ إخطار العميل سواء بالإتصال أو عن طريق رسالة واتس أب للجوال المدون في العقد حينها تعتبر المدة التي تليها من الصيانة المجانية ويعتبر المصعد قد سلم للعميل.

3. تخلي المؤسسة مسؤوليتها عن أي أضرار ناتجة عن عدم تمكين فريق الصيانة من عمل الصيانة الدورية للمصعد أو أي أضرار تنتج للمصعد.

4. مدة الضمان والصيانة المجانية (عامين) من تاريخ تسليم المصعد شاملاً قطع الغيار ضد عيوب الصنع بواقع زيارة كل شهرين.

5. مدة ضمان الماكينة (حسب المدة المحددة في جدول فترات الضمان) ضد عيوب الصنع من تاريخ تسليم المصعد بشرط أن تتم الصيانة للمصعد عن طريق المؤسسة بعد إنتهاء الفترة المجانية بعقود منفصلة.

6. عند عدم تجديد عقد الصيانة بمدة أقصاها ثلاثون يوماً (٣٠) يوم) من إنتهاء الفترة المجانية يسقط حق العميل في ضمان الماكينة ويتحمل العميل نفقات الإصلاح، يستمر الضمان عن طريق عقود سنوية يتفق عليها.

7. لا تضمن المؤسسة الأضرار التي يسببها الغير بشكل مقصود أو في حال وصول الماء لأجزاء المصعد أو في حال استخدام مواد كيمائية في التنظيف.`;

const DEFAULT_DURATION = '60 يوماً';

const DEFAULT_PAYMENT_TERMS = [
    { name: 'الدفعة الأولى (توقيع العقد)', percentage: 40 },
    { name: 'الدفعة الثانية (عند توريد السكك)', percentage: 30 },
    { name: 'الدفعة الثالثة (عند توريد الماكينة)', percentage: 20 },
    { name: 'الدفعة الرابعة (التسليم والتشغيل)', percentage: 10 }
];

const EMPTY_TECHNICAL_SPECS: TechnicalSpecs = {
    elevatorType: '', capacity: '', speed: '', stops: '', driveType: '', controlSystem: '',
    powerSupply: '', cabin: '', doors: '', externalDoors: '', machineRoom: '', rails: '',
    ropes: '', safety: '', emergency: ''
};

// --- Helper Components for Preview ---
const QuoteHeader: React.FC<{ config: CompanyConfig }> = ({ config }) => (
    <header className="contract-branding px-10 py-6 border-b-2 border-jilco-100 flex justify-between items-center min-h-[160px] gap-4 shrink-0">
        <div className="w-1/3 text-right">
            <h1 className="text-2xl font-black text-jilco-900 mb-0.5">{config.headerTitle}</h1>
            <p className="text-[10px] font-bold text-gray-500 mb-3">{config.headerSubtitle}</p>
            <div className="text-[9px] text-gray-400 font-bold border-r-2 border-gold-500 pr-2 leading-tight">
                {config.commercialRegistration?.trim() && <p>سجل تجاري: {config.commercialRegistration}</p>}
                {config.taxNumber?.trim() && <p>الرقم الضريبي: {config.taxNumber}</p>}
            </div>
        </div>
        <div className="w-1/3 flex justify-center">
            {config.logo ? (
                <img src={config.logo} alt="شعار الشركة" className="max-h-28 max-w-full w-auto object-contain" />
            ) : (
                <div className="h-24 w-24 bg-gray-50 border border-dashed border-gray-200 rounded-full flex items-center justify-center text-[8px] text-gray-300 uppercase">Logo</div>
            )}
        </div>
        <div className="w-1/3 text-left flex flex-col items-end" dir="ltr">
            <h2 className="text-lg font-black text-jilco-900 tracking-tighter break-words">{config.headerSubtitle}</h2>
            <div className="mt-3 space-y-1">
                {config.contactPhone?.trim() && <div className="flex items-center gap-2 text-[10px] font-black text-gray-700 bg-gray-50 px-2 py-1 rounded-l-full border-r-2 border-jilco-600">
                    <span>{config.contactPhone}</span>
                    <Phone size={10} className="text-jilco-600" />
                </div>}
                {config.contactEmail?.trim() && <div className="flex items-center gap-2 text-[10px] font-black text-gray-700 bg-gray-50 px-2 py-1 rounded-l-full border-r-2 border-gold-500 break-all">
                    <span>{config.contactEmail}</span>
                    <Mail size={10} className="text-gold-600" />
                </div>}
            </div>
        </div>
    </header>
);

const QuoteFooter: React.FC<{ config: CompanyConfig }> = ({ config }) => (
    <footer className="w-full bg-white shrink-0 mt-auto">
        <div className="bg-jilco-900 text-white py-3 px-10 flex justify-between items-center gap-3 text-[10px] font-bold min-h-[45px]">
            {config.footerText?.trim() && <div className="flex items-center gap-2">
                <MapPin size={12} className="text-gold-400" />
                <span>{config.footerText}</span>
            </div>}
            {config.website?.trim() && <div className="flex items-center gap-2 break-all" dir="ltr">
                <Globe size={12} className="text-gold-400" />
                <span>{config.website}</span>
            </div>}
        </div>
    </footer>
);

export const ContractModule: React.FC = () => {
    const { specsDb: globalSpecsDb, config: globalConfig } = useData();
    const { user: cloudUser } = useSupabaseAuth();
    const { hasPermission } = useAuth();
    const draftKey = contractDraftKey(cloudUser?.company_id, cloudUser?.id);
    const activeDraftKeyRef = useRef(draftKey);
    activeDraftKeyRef.current = draftKey;
    const [loadedDraftKey, setLoadedDraftKey] = useState(draftKey);
    const [restoredDraft] = useState(() => readContractDraft(localStorage, draftKey));
    const [currentContractId, setCurrentContractId] = useState<string | null>(restoredDraft?.id || null);
    const [hasDraft, setHasDraft] = useState(Boolean(restoredDraft));
    const draftBaselineRef = useRef<string | null>(null);
    const [draftError, setDraftError] = useState(false);
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const [creating, setCreating] = useState(false);
    const creatingRef = useRef(false);
    const {
        contracts,
        saveProjectRecord, deleteProjectRecord
    } = useProject();
    const {
        customers,
        quotes: savedQuotes
    } = useSales();

    const [viewMode, setViewMode] = useState<'list' | 'editor'>(restoredDraft ? 'editor' : 'list');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'details' | 'specs' | 'payments' | 'legal'>('details');
    const [config, setConfig] = useState<CompanyConfig>(INITIAL_CONFIG);

    // Specs Database State (fallback to default if context is empty)
    const specsDb = globalSpecsDb && Object.keys(globalSpecsDb).length > 0 ? globalSpecsDb : DEFAULT_OPTIONS;

    const [currentContract, setCurrentContract] = useState<ContractData>(restoredDraft?.data || {
        number: '', date: localContractDate(), firstPartyName: 'شركة جيلكو للمصاعد',
        secondPartyName: '', secondPartyId: '', location: '', totalValue: 0, elevatorType: '', stops: 2, durationMonths: 2, elevatorCount: 1, internalDoorsCount: 1, externalDoorsCount: 1, accessControl: '',
        paymentTerms: DEFAULT_PAYMENT_TERMS.map(term => ({ ...term })),
        firstPartyObligations: DEFAULT_FIRST_PARTY,
        secondPartyObligations: DEFAULT_SECOND_PARTY,
        handoverAndWarranty: DEFAULT_HANDOVER,
        worksDuration: DEFAULT_DURATION
    });

    const [currentSpecs, setCurrentSpecs] = useState<TechnicalSpecs>({ ...EMPTY_TECHNICAL_SPECS, ...(restoredDraft?.specs || {}) });

    // Load Config
    useEffect(() => {
        if (globalConfig) setConfig({ ...INITIAL_CONFIG, ...globalConfig });
    }, [globalConfig]);

    useEffect(() => {
        if (loadedDraftKey === draftKey) return;
        const draft = readContractDraft(localStorage, draftKey);
        draftBaselineRef.current = null;
        setCurrentContractId(draft?.id || null);
        setCurrentContract(draft?.data || {
            number: '', date: localContractDate(), firstPartyName: globalConfig?.headerTitle || 'شركة جيلكو للمصاعد',
            secondPartyName: '', secondPartyId: '', location: '', totalValue: 0, elevatorType: '', stops: 2, durationMonths: 2,
            elevatorCount: 1, internalDoorsCount: 1, externalDoorsCount: 1, accessControl: '',
            paymentTerms: DEFAULT_PAYMENT_TERMS.map(term => ({ ...term })),
            firstPartyObligations: DEFAULT_FIRST_PARTY, secondPartyObligations: DEFAULT_SECOND_PARTY,
            handoverAndWarranty: DEFAULT_HANDOVER, worksDuration: DEFAULT_DURATION
        });
        setCurrentSpecs({ ...EMPTY_TECHNICAL_SPECS, ...(draft?.specs || {}) });
        setHasDraft(Boolean(draft));
        setDraftError(false);
        setViewMode(draft ? 'editor' : 'list');
        setLoadedDraftKey(draftKey);
    }, [draftKey, loadedDraftKey, globalConfig]);

    useEffect(() => {
        // Wait for the new identity's state before writing under its storage key.
        if (loadedDraftKey !== draftKey) return;
        if (viewMode !== 'editor' || !currentContractId) return;
        const draft = { id: currentContractId, data: currentContract, specs: currentSpecs };
        if (JSON.stringify(draft) === draftBaselineRef.current) {
            try { if (draftKey) localStorage.removeItem(draftKey); } catch (error) { console.error('Failed to clear unchanged contract draft:', error); }
            setHasDraft(false);
            return;
        }
        const saved = writeContractDraft(localStorage, draftKey, draft);
        setDraftError(!saved);
        if (saved) setHasDraft(true);
    }, [viewMode, currentContractId, currentContract, currentSpecs, draftKey, loadedDraftKey]);

    // Actions
    const handleCreateNew = async () => {
        if (creatingRef.current || savingRef.current) return;
        if (!draftKey || loadedDraftKey !== draftKey) return alert('انتظر اكتمال تحميل حسابك قبل إنشاء العقد.');
        if (hasDraft && !window.confirm('توجد مسودة عقد محفوظة. هل تريد استبدالها بعقد جديد؟')) return;
        creatingRef.current = true;
        setCreating(true);
        try {
        const number = await cloudService.reserveContractNumber(new Date().getFullYear());
        if (activeDraftKeyRef.current !== draftKey) return;
        draftBaselineRef.current = null;
        setCurrentContractId(crypto.randomUUID());
        setCurrentContract({
            number,
            date: localContractDate(),
            firstPartyName: config.headerTitle || 'شركة جيلكو للمصاعد',
            secondPartyName: '', secondPartyId: '', location: '', totalValue: 0, elevatorType: '', stops: 2, durationMonths: 2, elevatorCount: 1, internalDoorsCount: 1, externalDoorsCount: 1, accessControl: '',
            paymentTerms: DEFAULT_PAYMENT_TERMS.map(term => ({ ...term })),
            firstPartyObligations: DEFAULT_FIRST_PARTY,
            secondPartyObligations: DEFAULT_SECOND_PARTY,
            handoverAndWarranty: DEFAULT_HANDOVER,
            worksDuration: DEFAULT_DURATION
        });
        setCurrentSpecs({ ...EMPTY_TECHNICAL_SPECS });
        setActiveTab('details');
        setViewMode('editor');
        } catch (error) {
            console.error('Contract number reservation failed:', error);
            alert('تعذر حجز رقم العقد من السحابة. تحقق من الاتصال ثم أعد المحاولة.');
        } finally {
            creatingRef.current = false;
            setCreating(false);
        }
    };

    const handleImportQuote = (quote: any) => { // Using explicit 'any' since SavedQuote type differed
        if (savingRef.current) return;
        if (window.confirm(`استيراد بيانات عرض السعر رقم ${quote.details?.number || quote.id}؟`)) {
            try {
                const imported = importQuoteIntoContract(currentContract, quote, customers);
                setCurrentContract(imported.contract);
                setCurrentSpecs({ ...EMPTY_TECHNICAL_SPECS, ...imported.specs });
                alert(`تم استيراد بيانات العرض وضريبته ومواصفاته. راجع عدد المصاعد يدوياً؛ كميات الملحقات لا تمثل مصاعد.${imported.customerNeedsSelection ? '\nيرجى اختيار العميل الصحيح من قائمة العملاء؛ لم يُربط العقد تلقائياً لعدم وجود تطابق فريد.' : ''}`);
            } catch (error) { alert(error instanceof Error ? error.message : 'تعذر استيراد بيانات عرض السعر.'); }
        }
    };

    const handleSave = async () => {
        if (savingRef.current) return;
        if (!draftKey || loadedDraftKey !== draftKey) return alert('انتظر اكتمال تحميل حسابك قبل حفظ العقد.');
        const validation = validateContract(currentContract);
        if (validation) return alert(validation);
        if (!currentContractId || !currentContract.number.trim()) return alert('تعذر تحديد هوية العقد. أنشئ عقداً جديداً لحجز رقمه.');
        const linkedCustomer = currentContract.secondPartyId ? customers.find(customer => customer.id === currentContract.secondPartyId) : null;
        if (currentContract.secondPartyId && (!linkedCustomer || linkedCustomer.fullName !== currentContract.secondPartyName)) return alert('اسم العميل لا يطابق العميل المرتبط. اختر العميل الصحيح من القائمة.');
        const recordId = currentContractId;
        const contractObj = {
            id: recordId,
            data: { ...currentContract, totalValue: Math.round((Number(currentContract.totalValue) + Number.EPSILON) * 100) / 100 },
            specs: currentSpecs
        };
        savingRef.current = true;
        setSaving(true);
        try {
        const saved = await saveProjectRecord('jilco_contracts_archive', recordId, contractObj);
        if (activeDraftKeyRef.current !== draftKey) return;
        if (!saved) return alert('تعذر حفظ العقد في السحابة. بقيت مسودتك في المحرر؛ أعد المحاولة بعد التحقق من الاتصال.');
        try { if (draftKey) localStorage.removeItem(draftKey); } catch (error) { console.error('Failed to clear contract draft:', error); }
        draftBaselineRef.current = JSON.stringify(contractObj);
        setHasDraft(false);
        setViewMode('list');
        } catch (error) {
            console.error('Contract save failed:', error);
            if (activeDraftKeyRef.current === draftKey) alert('تعذر حفظ العقد في السحابة. بقيت مسودتك في المحرر؛ أعد المحاولة بعد التحقق من الاتصال.');
        } finally { savingRef.current = false; setSaving(false); }
    };

    const openSavedContract = (saved: any, printAfterOpen = false) => {
        if (savingRef.current || creatingRef.current) return;
        const recordId = saved.id || saved.data?.id || saved.data?.number;
        if (hasDraft && !window.confirm('توجد مسودة عقد غير معتمدة. هل تريد استبدالها بالنسخة المحفوظة من هذا العقد؟')) return;
        const savedTerms = Array.isArray(saved.data?.paymentTerms) && saved.data.paymentTerms.length
            ? saved.data.paymentTerms
            : DEFAULT_PAYMENT_TERMS;
        const contractToOpen = {
            ...saved.data,
            paymentTerms: savedTerms.map((term: any) => ({ ...term }))
        };
        const specsToOpen = { ...EMPTY_TECHNICAL_SPECS, ...(saved.specs || {}) };
        draftBaselineRef.current = JSON.stringify({ id: recordId, data: contractToOpen, specs: specsToOpen });
        try { if (draftKey) localStorage.removeItem(draftKey); } catch (error) { console.error('Failed to clear replaced contract draft:', error); }
        setHasDraft(false);
        setCurrentContract(contractToOpen);
        setCurrentContractId(recordId);
        setCurrentSpecs(specsToOpen);
        setActiveTab('details');
        setViewMode('editor');
        if (printAfterOpen) {
            const validation = validateContract(contractToOpen);
            if (validation) alert(`يحتاج العقد إلى مراجعة قبل الطباعة: ${validation}`);
            else setTimeout(() => window.print(), 500);
        }
    };

    const handleDelete = async (saved: any) => {
        if (savingRef.current || creatingRef.current) return;
        if (!hasPermission('delete_records')) return alert('لا تملك صلاحية حذف العقود.');
        if (!window.confirm(`هل تريد حذف العقد رقم ${saved.data?.number || ''}؟ لا يمكن التراجع عن الحذف من هذه الشاشة.`)) return;
        const deleted = await deleteProjectRecord('jilco_contracts_archive', saved.id || saved.data?.id || saved.data?.number);
        if (activeDraftKeyRef.current !== draftKey) return;
        if (!deleted) alert('تعذر حذف العقد من السحابة. لم يُحذف من الأرشيف؛ تحقق من الاتصال والصلاحية.');
        else if ((saved.id || saved.data?.id || saved.data?.number) === currentContractId) {
            try { if (draftKey) localStorage.removeItem(draftKey); } catch (error) { console.error('Failed to clear deleted contract draft:', error); }
            setHasDraft(false);
            setCurrentContractId(null);
        }
    };

    const handleCustomerSelect = (customerId: string) => {
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            setCurrentContract(prev => ({
                ...prev,
                secondPartyName: customer.fullName,
                secondPartyId: customer.id,
                location: customer.address || prev.location
            }));
        }
    };

    const handlePrint = () => {
        const validation = validateContract(currentContract);
        if (validation) return alert(`راجع العقد قبل الطباعة: ${validation}`);
        window.print();
    };

    if (loadedDraftKey !== draftKey) return <div role="status" className="p-8">جارٍ تحميل عقود الحساب…</div>;

    if (viewMode === 'list') {
        return (
            <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                                <FileSignature className="text-gold-500" /> أرشيف العقود القانونية
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">إدارة ومتابعة عقود التوريد والتركيب</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {hasDraft && <button onClick={() => setViewMode('editor')} className="px-4 py-2.5 border border-jilco-600 text-jilco-700 rounded-lg font-bold">استكمال المسودة</button>}
                            <button onClick={async () => {
                                if(window.confirm('هل أنت متأكد من ترحيل العقود من قاعدة البيانات القديمة للجديدة؟')) {
                                    import('../services/cloudService').then(async m => {
                                        const result = await m.cloudService.migrateLegacyContracts();
                                        alert(result.failed ? `تم ترحيل ${result.migrated} عقد، وتعذر ترحيل ${result.failed}. راجع الأرقام والبيانات والصلاحيات ثم أعد المحاولة.` : `تم ترحيل ${result.migrated} عقد بنجاح. يرجى تحديث الصفحة.`);
                                    });
                                }
                            }} className="bg-orange-500 text-white px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-orange-600 shadow-sm text-sm">ترحيل البيانات للجدول الجديد</button>
                            <button onClick={handleCreateNew} disabled={creating} className="bg-jilco-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md disabled:opacity-60">
                                <Plus size={20} /> {creating ? 'جارٍ حجز الرقم…' : 'عقد جديد'}
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                                <input
                                    type="text" placeholder="بحث برقم العقد أو اسم الطرف الثاني..."
                                    className="w-full pr-10 pl-4 py-2 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold outline-none focus:ring-2 focus:ring-jilco-500"
                                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-50 text-gray-500">
                                <tr>
                                    <th className="p-4">رقم العقد</th>
                                    <th className="p-4">الطرف الثاني (العميل)</th>
                                    <th className="p-4">القيمة الإجمالية</th>
                                    <th className="p-4">التاريخ</th>
                                    <th className="p-4 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {contracts.filter(c => c.data.number.includes(searchTerm) || c.data.secondPartyName.includes(searchTerm)).map((c, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 group transition-colors">
                                        <td className="p-4 font-mono font-bold text-jilco-900">{c.data.number}</td>
                                        <td className="p-4 font-bold text-gray-800">{c.data.secondPartyName}</td>
                                        <td className="p-4 font-black text-green-700 font-mono">{c.data.totalValue.toLocaleString()}</td>
                                        <td className="p-4 font-mono text-gray-500 text-xs">{c.data.date}</td>
                                        <td className="p-4 flex justify-center gap-2">
                                            <button title="تعديل" onClick={() => openSavedContract(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit size={16} /></button>
                                            <button
                                                title="طباعة"
                                                onClick={() => {
                                                    openSavedContract(c, true);
                                                }}
                                                className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"
                                            >
                                                <Printer size={16} />
                                            </button>
                                            {hasPermission('delete_records') && <button title="حذف" onClick={() => handleDelete(c)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>}
                                        </td>
                                    </tr>
                                ))}
                                {contracts.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-gray-400">لا توجد عقود مسجلة.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row h-full bg-gray-100 print:h-auto print:block">
            {/* Editor Sidebar */}
            <div className="w-full lg:w-1/3 bg-white border-l border-gray-200 h-full overflow-y-auto no-print shadow-xl z-20 flex flex-col sidebar-container">
                <div className="p-6 bg-jilco-900 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold">محرر العقود</h2>
                        <p className="text-[10px] opacity-60">صياغة العقود القانونية للمؤسسة</p>
                    </div>
                    <div className="flex gap-2">
                        <button title="حفظ" onClick={handleSave} disabled={saving} className="bg-green-600 p-2.5 rounded-xl hover:bg-green-700 shadow-lg disabled:opacity-60"><Save size={18} />{saving && <span className="text-xs">جارٍ الحفظ…</span>}</button>
                        <button title="طباعة" onClick={handlePrint} className="bg-gold-500 p-2.5 rounded-xl hover:bg-gold-600 shadow-lg"><Printer size={18} /></button>
                        <button title="العودة" onClick={() => setViewMode('list')} className="bg-white/10 p-2.5 rounded-xl hover:bg-white/20"><ArrowLeft size={18} /></button>
                    </div>
                </div>

                <p role="status" className={`px-4 py-2 text-xs ${draftError ? 'text-red-700 bg-red-50' : 'text-gray-600 bg-gray-50'}`}>{draftError ? 'تعذر حفظ المسودة على هذا الجهاز. احفظ العقد قبل مغادرة الصفحة.' : 'تُحفظ مسودتك على هذا الجهاز. اضغط حفظ لاعتماد العقد في السحابة.'}</p>

                {/* Quick Import Quote Bar */}
                <div className="p-4 bg-amber-50 border-b border-amber-100">
                    <label className="block text-[10px] font-black text-amber-800 mb-2 uppercase flex items-center gap-1"><Import size={12} /> استيراد من عرض سعر</label>
                    <select title="استيراد من عرض سعر"
                        disabled={saving}
                        onChange={e => {
                            const q = savedQuotes.find(sq => sq.id === e.target.value);
                            if (q) handleImportQuote(q);
                        }}
                        className="w-full p-2 text-xs border border-amber-300 rounded-lg outline-none bg-white font-bold text-black"
                        defaultValue=""
                    >
                        <option value="" disabled>-- اختر عرض سعر لاستيراد بياناته --</option>
                        {savedQuotes.map((q: any) => <option key={q.id} value={q.id}>{q.details?.number || q.id} - {q.details?.customerName || 'عميل'}</option>)}
                    </select>
                </div>

                <div className="flex border-b border-gray-100 bg-gray-50 shrink-0 overflow-x-auto">
                    <button onClick={() => setActiveTab('details')} className={`flex-1 min-w-[100px] py-4 text-xs font-black transition-all ${activeTab === 'details' ? 'border-b-4 border-jilco-600 text-jilco-900 bg-white' : 'text-gray-400'}`}>البيانات الأساسية</button>
                    <button onClick={() => setActiveTab('specs')} className={`flex-1 min-w-[100px] py-4 text-xs font-black transition-all ${activeTab === 'specs' ? 'border-b-4 border-jilco-600 text-jilco-900 bg-white' : 'text-gray-400'}`}>المواصفات الفنية</button>
                    <button onClick={() => setActiveTab('payments')} className={`flex-1 min-w-[100px] py-4 text-xs font-black transition-all ${activeTab === 'payments' ? 'border-b-4 border-jilco-600 text-jilco-900 bg-white' : 'text-gray-400'}`}>الدفعات المالية</button>
                    <button onClick={() => setActiveTab('legal')} className={`flex-1 min-w-[100px] py-4 text-xs font-black transition-all ${activeTab === 'legal' ? 'border-b-4 border-jilco-600 text-jilco-900 bg-white' : 'text-gray-400'}`}>البنود القانونية</button>
                </div>

                <div inert={saving} className="p-6 space-y-6 overflow-y-auto flex-1 bg-gray-50/30">
                    {activeTab === 'details' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                                <label className="text-[10px] font-black text-blue-800 mb-1 flex items-center gap-1"><User size={12} /> ربط العقد بعميل مسجل</label>
                                <select title="اختر العميل" value={currentContract.secondPartyId || ''} onChange={e => handleCustomerSelect(e.target.value)} className="w-full p-2 text-xs border border-gray-400 rounded-lg outline-none bg-white text-black font-bold">
                                    <option value="" disabled>-- اختر العميل --</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                                </select>
                            </div>
                            <div><label className="block text-[10px] font-black text-gray-500 mb-1">رقم العقد</label><input title="رقم العقد محجوز من السحابة ولا يُعدّل يدوياً" placeholder="رقم العقد" type="text" value={currentContract.number} readOnly className="w-full p-2.5 border border-gray-400 rounded-lg font-mono text-sm bg-gray-100 text-black font-bold" /></div>
                            <div><label className="block text-[10px] font-black text-gray-500 mb-1">تاريخ العقد</label><input title="تاريخ العقد" type="date" value={currentContract.date} onChange={e => setCurrentContract({ ...currentContract, date: e.target.value })} className="w-full p-2.5 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold" /></div>
                            <div><label className="block text-[10px] font-black text-gray-500 mb-1">اسم العميل (الطرف الثاني)</label><input title="اسم العميل" placeholder="اسم العميل" type="text" value={currentContract.secondPartyName} onChange={e => setCurrentContract({ ...currentContract, secondPartyName: e.target.value })} className="w-full p-2.5 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold" /></div>
                            <div><label className="block text-[10px] font-black text-gray-500 mb-1">الموقع / المدينة</label><input title="الموقع" placeholder="الموقع" type="text" value={currentContract.location} onChange={e => setCurrentContract({ ...currentContract, location: e.target.value })} className="w-full p-2.5 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold" /></div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-gray-500 mb-1">قيمة العقد (شامل الضريبة)</label><input title="قيمة العقد" placeholder="قيمة العقد" type="number" min="0.01" step="0.01" value={currentContract.totalValue} onChange={e => setCurrentContract({ ...currentContract, totalValue: Number(e.target.value) })} className="w-full p-2.5 border border-gray-400 rounded-lg font-black text-green-700 bg-white" /></div>
                                <div><label className="block text-[10px] font-black text-gray-500 mb-1">عدد المصاعد</label><input title="عدد المصاعد" placeholder="عدد المصاعد" type="number" min="1" step="1" value={currentContract.elevatorCount} onChange={e => setCurrentContract({ ...currentContract, elevatorCount: Number(e.target.value) })} className="w-full p-2.5 border border-gray-400 rounded-lg font-black text-center bg-white text-black" /></div>
                            </div>

                            <div><label className="block text-[10px] font-black text-gray-500 mb-1">مدة التنفيذ التقديرية (أشهر)</label><input title="مدة التنفيذ" placeholder="مدة التنفيذ" type="number" min="1" step="1" value={currentContract.durationMonths} onChange={e => { const months = Number(e.target.value); setCurrentContract({ ...currentContract, durationMonths: months, worksDuration: months > 0 ? `${months} أشهر` : '' }); }} className="w-full p-2.5 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold" /><p className="text-[10px] text-gray-500 mt-1">يمكن تخصيص نص المدة النهائي ضمن البنود القانونية؛ وهو النص المعتمد في الطباعة.</p></div>
                        </div>
                    )}

                    {activeTab === 'specs' && (
                        <div className="space-y-4 animate-fade-in bg-white p-4 rounded-xl border border-gray-200">
                            {Object.entries(specsDb).map(([key, opts]) => (
                                <div key={key}>
                                    <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase">
                                        {key === 'doors' ? 'الأبواب الداخلية (Internal Doors)' : key === 'externalDoors' ? 'الأبواب الخارجية (External Doors)' : key}
                                    </label>
                                    <div className="flex gap-2 items-center">
                                        <select title={key}
                                            value={currentSpecs[key as keyof TechnicalSpecs] || ''}
                                            onChange={e => setCurrentSpecs({ ...currentSpecs, [key]: e.target.value })}
                                            className="flex-1 p-2.5 border border-gray-400 rounded-lg text-xs bg-white text-black font-bold"
                                        >
                                            <option value="">-- اختر --</option>
                                            {(opts as string[]).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                        </select>
                                        {key === 'doors' && (
                                            <div className="flex flex-col items-center gap-0.5 shrink-0">
                                                <span className="text-[8px] font-black text-gray-400">العدد</span>
                                                <input
                                                    title="عدد الأبواب الداخلية" type="number" min="1"
                                                    value={currentContract.internalDoorsCount || 1}
                                                    onChange={e => setCurrentContract({ ...currentContract, internalDoorsCount: parseInt(e.target.value) || 1 })}
                                                    className="w-14 p-2 border border-gray-400 rounded-lg text-xs bg-white text-black font-bold text-center"
                                                />
                                            </div>
                                        )}
                                        {key === 'externalDoors' && (
                                            <div className="flex flex-col items-center gap-0.5 shrink-0">
                                                <span className="text-[8px] font-black text-gray-400">العدد</span>
                                                <input
                                                    title="عدد الأبواب الخارجية" type="number" min="1"
                                                    value={currentContract.externalDoorsCount || 1}
                                                    onChange={e => setCurrentContract({ ...currentContract, externalDoorsCount: parseInt(e.target.value) || 1 })}
                                                    className="w-14 p-2 border border-gray-400 rounded-lg text-xs bg-white text-black font-bold text-center"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Access Control - اختياري */}
                            <div className="pt-3 border-t border-dashed border-purple-200 mt-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <input
                                        type="checkbox"
                                        id="accessControlToggle"
                                        checked={!!currentContract.accessControl}
                                        onChange={e => setCurrentContract({ ...currentContract, accessControl: e.target.checked ? ACCESS_CONTROL_OPTIONS[0] : '' })}
                                        className="w-4 h-4 accent-purple-600 cursor-pointer"
                                    />
                                    <label htmlFor="accessControlToggle" className="text-[10px] font-black text-purple-700 cursor-pointer flex items-center gap-1 uppercase">
                                        🔐 أكسس كنترول (Access Control) — اختياري
                                    </label>
                                </div>
                                {!!currentContract.accessControl && (
                                    <select
                                        title="نوع الأكسس كنترول"
                                        value={currentContract.accessControl}
                                        onChange={e => setCurrentContract({ ...currentContract, accessControl: e.target.value })}
                                        className="w-full p-2.5 border border-purple-300 rounded-lg text-xs bg-white text-black font-bold"
                                    >
                                        {ACCESS_CONTROL_OPTIONS.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                    </select>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'payments' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-xs font-black text-jilco-900 mb-3 flex items-center gap-2"><DollarSign size={16} /> جدول الدفعات المالية</h3>
                                <div className="space-y-2">
                                    {(currentContract.paymentTerms || []).map((term, idx) => (
                                        <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded border border-gray-200">
                                            <input title="اسم الدفعة" placeholder="اسم الدفعة" type="text" value={term.name} onChange={e => {
                                                const newTerms = [...(currentContract.paymentTerms || [])];
                                                newTerms[idx].name = e.target.value;
                                                setCurrentContract({ ...currentContract, paymentTerms: newTerms });
                                            }} className="flex-1 p-1.5 text-xs border border-gray-400 rounded bg-white text-black font-bold" />
                                            <div className="relative w-16">
                                                <input title="نسبة الدفعة" placeholder="نسبة" type="number" value={term.percentage} onChange={e => {
                                                    const newTerms = [...(currentContract.paymentTerms || [])];
                                                    newTerms[idx].percentage = parseFloat(e.target.value) || 0;
                                                    setCurrentContract({ ...currentContract, paymentTerms: newTerms });
                                                }} className="w-full p-1.5 text-xs border border-gray-400 rounded text-center bg-white text-black font-bold" />
                                                <span className="absolute left-1 top-1.5 text-[9px] text-gray-400 pointer-events-none">%</span>
                                            </div>
                                            <button title="حذف الدفعة" onClick={() => setCurrentContract({ ...currentContract, paymentTerms: (currentContract.paymentTerms || []).filter((_, i) => i !== idx) })} className="text-red-300 hover:text-red-500"><X size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setCurrentContract({ ...currentContract, paymentTerms: [...(currentContract.paymentTerms || []), { name: 'دفعة جديدة', percentage: 0 }] })} className="mt-4 w-full py-2 bg-gray-100 text-xs font-bold rounded border border-dashed border-gray-300">+ إضافة دفعة</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'legal' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-sm font-black text-jilco-900 mb-4 border-b pb-2">التزامات الطرف الأول (المؤسسة)</h3>
                                <textarea
                                    title="التزامات الطرف الأول"
                                    value={currentContract.firstPartyObligations}
                                    onChange={e => setCurrentContract({ ...currentContract, firstPartyObligations: e.target.value })}
                                    className="w-full h-32 p-3 text-xs border border-gray-300 rounded-lg outline-none bg-gray-50 text-black leading-relaxed"
                                />
                            </div>
                            
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-sm font-black text-jilco-900 mb-4 border-b pb-2">التزامات الطرف الثاني (العميل)</h3>
                                <textarea
                                    title="التزامات الطرف الثاني"
                                    value={currentContract.secondPartyObligations}
                                    onChange={e => setCurrentContract({ ...currentContract, secondPartyObligations: e.target.value })}
                                    className="w-full h-32 p-3 text-xs border border-gray-300 rounded-lg outline-none bg-gray-50 text-black leading-relaxed"
                                />
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-sm font-black text-jilco-900 mb-4 border-b pb-2">التسليم والضمان والصيانة</h3>
                                <textarea
                                    title="شروط التسليم والضمان"
                                    value={currentContract.handoverAndWarranty}
                                    onChange={e => setCurrentContract({ ...currentContract, handoverAndWarranty: e.target.value })}
                                    className="w-full h-48 p-3 text-xs border border-gray-300 rounded-lg outline-none bg-gray-50 text-black leading-relaxed"
                                />
                            </div>
                            
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-sm font-black text-jilco-900 mb-4 border-b pb-2">مدة الأعمال والتنفيذ</h3>
                                <input
                                    type="text"
                                    title="مدة تنفيذ الأعمال"
                                    value={currentContract.worksDuration}
                                    onChange={e => setCurrentContract({ ...currentContract, worksDuration: e.target.value })}
                                    className="w-full p-2.5 text-xs border border-gray-300 rounded-lg outline-none bg-gray-50 text-black font-bold"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Preview Area (Container for A4 Pages) */}
            <div className="flex-1 bg-gray-200 p-8 overflow-auto flex justify-center items-start print:p-0 print:m-0 print:bg-white print:overflow-visible print:block">
                <div id="printable-area" className="contracts-print-document flex flex-col items-center gap-10 print:block print:gap-0 print:w-full" dir="rtl">

                    {/* PAGE 1: CONTRACT DETAILS - USING a4-page CLASS */}
                    <div className="a4-page bg-white shadow-2xl mb-10 print:mb-0 mx-auto flex flex-col relative">

                        {/* Royal Frame Borders */}
                        <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
                        <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
                        <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

                        <div className="contract-page-inner relative z-10 flex flex-col flex-1 m-[28px] bg-white">
                            <QuoteHeader config={config} />

                            {/* Contract Number Badge - يسار أسفل الترويسة */}
                            <div className="px-10 py-1.5 bg-gray-50/60 border-b border-gray-100 flex justify-start shrink-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-black text-gray-800 uppercase tracking-widest">Contract No.</span>
                                    <span className="font-mono font-black text-gray-900 text-[11px] bg-white border border-gray-300 px-2.5 py-0.5 rounded-md tracking-wide">{currentContract.number || '---'}</span>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="contract-page-body px-12 py-6 flex-1 text-xs leading-loose relative">
                                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0"><h1 className="text-[140px] font-bold rotate-[-15deg]">CONTRACT</h1></div>
                                <div className="relative z-10">
                                    <div className="text-center mb-8 border-b-2 border-jilco-900 pb-2"><h2 className="text-2xl font-black text-jilco-900">عقد توريد وتركيب مصعد</h2></div>
                                    <p className="mb-4">إنه في يوم <span className="font-bold">{currentContract.date}</span> تم الاتفاق بين كل من:</p>
                                    <div className="space-y-4">
                                        <p><span className="font-bold underline">الطرف الأول (المقاول):</span> {currentContract.firstPartyName} - ويمثلها في هذا العقد الإدارة المختصة.</p>
                                        <p><span className="font-bold underline">الطرف الثاني (العميل):</span> {currentContract.secondPartyName} - ومقره في {currentContract.location}.</p>
                                        <p className="font-bold border-r-4 border-gold-500 pr-3 bg-gray-50 p-2 mt-6">موضوع العقد:</p>
                                        <p>اتفق الطرفان على قيام الطرف الأول بتوريد وتركيب عدد (<span className="font-bold px-1">{currentContract.elevatorCount || 1}</span>) مصعد ({currentSpecs.elevatorType || 'محدد بالمواصفات'}) للطرف الثاني بقيمة إجمالية قدرها <span className="font-black text-jilco-900 text-sm">{Number(currentContract.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</span> شاملة الضريبة، وذلك وفقاً لمدة التنفيذ والمواصفات المرفقة.</p>
                                        <div className="contract-duration border-r-4 border-jilco-700 bg-jilco-50 p-3">
                                            <span className="font-bold">مدة تنفيذ الأعمال: </span>
                                            <span className="whitespace-pre-line">{currentContract.worksDuration?.trim() || (currentContract.durationMonths > 0 ? `${currentContract.durationMonths} أشهر` : 'يحددها الطرفان قبل توقيع العقد')}</span>
                                        </div>

                                        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-2">
                                            <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">نوع الماكينة:</span> <span className="font-bold">{currentSpecs.driveType || '...'}</span></div>
                                            <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">الحمولة:</span> <span className="font-bold">{currentSpecs.capacity || '...'}</span></div>
                                            <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">عدد الوقفات:</span> <span className="font-bold">{currentSpecs.stops || '...'}</span></div>
                                            <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">الأبواب الداخلية:</span> <span className="font-bold">{currentSpecs.doors ? `${currentSpecs.doors} (عدد: ${currentContract.internalDoorsCount || 1} باب)` : '...'}</span></div>
                                            <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">الأبواب الخارجية:</span> <span className="font-bold">{currentSpecs.externalDoors ? `${currentSpecs.externalDoors} (عدد: ${currentContract.externalDoorsCount || 1} باب)` : '...'}</span></div>
                                            {currentContract.accessControl && (
                                                <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">أكسس كنترول:</span> <span className="font-bold text-purple-700">{currentContract.accessControl}</span></div>
                                            )}
                                        </div>

                                        <p className="font-bold border-r-4 border-gold-500 pr-3 bg-gray-50 p-2 mt-6">جدول الدفعات:</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            {allocateContractPayments(currentContract.totalValue, currentContract.paymentTerms || []).map((t: any, i: number) => (
                                                <div key={i} className="contract-payment-row flex justify-between items-center gap-2 p-2 border border-gray-100 rounded">
                                                    <span className="text-[10px] text-gray-500">{t.name}</span>
                                                    <span className="font-bold whitespace-nowrap" dir="ltr">{t.percentage}% — {Number(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</span>
                                                </div>
                                            ))}
                                        </div>
                                        {allocateContractPayments(currentContract.totalValue, currentContract.paymentTerms || []).length === 0 && <p className="text-amber-800 border border-amber-400 p-2">جدول الدفعات غير مكتمل. يجب أن يكون مجموع النسب 100% قبل اعتماد العقد.</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Signatures */}
                            <div className="contract-signatures px-12 py-10 grid grid-cols-2 gap-16 shrink-0 relative">
                                <div className="text-center relative">
                                    <p className="font-bold text-sm mb-12">توقيع الطرف الأول</p>
                                    <div className="w-40 border-b-2 border-jilco-900 mx-auto"></div>
                                    {config.stamp && <img src={config.stamp} alt="ختم الشركة" className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 max-h-28 object-contain opacity-90 mix-blend-multiply" />}
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-sm mb-12">توقيع الطرف الثاني (العميل)</p>
                                    <div className="w-40 border-b-2 border-gray-300 mx-auto"></div>
                                </div>
                            </div>

                            <QuoteFooter config={config} />
                        </div>
                    </div>

                    {/* PAGE 2: TECHNICAL SPECIFICATIONS - USING a4-page CLASS */}
                    <div className="a4-page bg-white shadow-2xl mb-10 print:mb-0 mx-auto flex flex-col relative">

                        <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
                        <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
                        <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

                        <div className="contract-page-inner relative z-10 flex flex-col flex-1 m-[28px] bg-white">
                            <QuoteHeader config={config} />

                            <div className="contract-page-body px-10 py-6 flex-1 flex flex-col">
                                <div className="flex items-center justify-between border-b-2 border-jilco-900 pb-4 mb-6">
                                    <h3 className="text-xl font-black text-jilco-900 flex items-center gap-3 uppercase tracking-tighter">
                                        <div className="w-10 h-10 bg-jilco-900 text-gold-500 flex items-center justify-center rounded-xl shadow-lg"><Zap size={20} /></div>
                                        جدول المواصفات الفنية المعتمدة
                                    </h3>
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Technical Data</span>
                                </div>

                                <div className="grid grid-cols-1 border border-gray-200 rounded-2xl shadow-sm mb-8">
                                    {[
                                        { label: 'نوع المصعد (Elevator Type)', value: currentSpecs.elevatorType },
                                        { label: 'الحمولة (Capacity)', value: currentSpecs.capacity },
                                        { label: 'السرعة (Speed)', value: currentSpecs.speed },
                                        { label: 'الوقفات / الفتحات (Stops)', value: currentSpecs.stops },
                                        { label: 'نظام الحركة (Drive System)', value: currentSpecs.driveType },
                                        { label: 'لوحة التحكم (Control System)', value: currentSpecs.controlSystem },
                                        { label: 'مصدر الكهرباء (Power Supply)', value: currentSpecs.powerSupply },
                                        { label: 'تشطيب الكابينة (Cabin Finish)', value: currentSpecs.cabin },
                                        { label: 'نظام الأبواب الداخلية (Internal Door System)', value: currentSpecs.doors ? `${currentSpecs.doors} — عدد: ${currentContract.internalDoorsCount || 1} باب` : '' },
                                        { label: 'نظام الأبواب الخارجية (External Door System)', value: currentSpecs.externalDoors ? `${currentSpecs.externalDoors} — عدد: ${currentContract.externalDoorsCount || 1} باب` : '' },
                                        { label: 'غرفة الماكينة (Machine Room)', value: currentSpecs.machineRoom },
                                        { label: 'السكك والمسارات (Rails)', value: currentSpecs.rails },
                                        { label: 'الحبال والأسلاك (Ropes)', value: currentSpecs.ropes },
                                        { label: 'أنظمة الأمان (Safety)', value: currentSpecs.safety },
                                        { label: 'جهاز الطوارئ (Emergency)', value: currentSpecs.emergency },
                                        ...(currentContract.accessControl ? [{ label: 'نظام التحكم بالوصول (Access Control)', value: currentContract.accessControl }] : []),
                                    ].map((row, i) => (
                                        <div key={i} className={`contract-spec-row flex border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}`}>
                                            <div className="w-1/3 p-2.5 font-black text-[10px] text-jilco-700 bg-gray-100/30 border-l border-gray-100 uppercase tracking-tighter flex items-center">{row.label}</div>
                                            <div className="w-2/3 p-2.5 text-[11px] font-black text-black uppercase flex items-center">{row.value || 'سيتم التحديد لاحقاً'}</div>
                                        </div>
                                    ))}
                                </div>

                            </div>
                            <QuoteFooter config={config} />
                        </div>
                    </div>

                    {/* PAGE 3: LEGAL ANNEX - USING a4-page CLASS */}
                    <div className="a4-page bg-white shadow-2xl mb-10 print:mb-0 mx-auto flex flex-col relative">

                        <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
                        <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
                        <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

                        <div className="contract-page-inner relative z-10 flex flex-col flex-1 m-[28px] bg-white">
                            <QuoteHeader config={config} />

                            <div className="contract-page-body px-10 py-6 flex-1 flex flex-col relative">
                                <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none z-0"><h1 className="text-[120px] font-bold rotate-[-15deg]">LEGAL ANNEX</h1></div>
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between border-b-2 border-jilco-900 pb-4 mb-6">
                                        <h3 className="text-xl font-black text-jilco-900 flex items-center gap-3 uppercase tracking-tighter">
                                            <div className="w-10 h-10 bg-jilco-900 text-gold-500 flex items-center justify-center rounded-xl shadow-lg"><ShieldCheck size={20} /></div>
                                            الملحق القانوني (الشروط والضمان)
                                        </h3>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Legal Terms</span>
                                    </div>

                                    <div className="space-y-6 text-xs leading-relaxed">
                                        <div>
                                            <h4 className="font-bold border-r-4 border-gold-500 pr-3 bg-gray-50 p-2 text-jilco-900">التزامات الطرف الأول (المقاول):</h4>
                                            <div className="contract-legal-text whitespace-pre-line pr-4 mt-2">{currentContract.firstPartyObligations}</div>
                                        </div>

                                        <div>
                                            <h4 className="font-bold border-r-4 border-gold-500 pr-3 bg-gray-50 p-2 text-jilco-900">التزامات الطرف الثاني (العميل):</h4>
                                            <div className="contract-legal-text whitespace-pre-line pr-4 mt-2">{currentContract.secondPartyObligations}</div>
                                        </div>

                                        <div>
                                            <h4 className="font-bold border-r-4 border-gold-500 pr-3 bg-gray-50 p-2 text-jilco-900">شروط التسليم والضمان والصيانة:</h4>
                                            <div className="contract-legal-text whitespace-pre-line pr-4 mt-2">{currentContract.handoverAndWarranty}</div>
                                        </div>

                                        <div className="contract-signatures mt-8 border-t border-gray-200 pt-6 grid grid-cols-2 gap-16">
                                            <div className="text-center">
                                                <p className="font-bold text-sm mb-12">توقيع الطرف الأول</p>
                                                <div className="w-40 border-b-2 border-gray-300 mx-auto"></div>
                                            </div>
                                            <div className="text-center">
                                                <p className="font-bold text-sm mb-12">توقيع الطرف الثاني</p>
                                                <div className="w-40 border-b-2 border-gray-300 mx-auto"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <QuoteFooter config={config} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

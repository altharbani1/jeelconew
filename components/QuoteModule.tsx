
import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar.tsx';
import { QuotePreview } from './QuotePreview.tsx';
import { QuoteItem, QuoteDetails, CompanyConfig, TechnicalSpecs } from '../types.ts';
import { ArrowLeft, Plus, Search, Trash2, Edit, Copy, Calculator, Printer, Save, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useSales } from '../contexts/SalesContext.tsx';
import { loggerService } from '../services/loggerService.ts';

interface SavedQuote {
    id: string;
    details: QuoteDetails;
    items: QuoteItem[];
    techSpecs: TechnicalSpecs;
    lastModified: string;
}

const DEFAULT_TERMS = `1. مدة صلاحية هذا العرض (15) يوماً من تاريخه.
2. الضمان:
   - يشمل الضمان استبدال القطع المعيبة مصنعياً مجاناً خلال فترة الضمان.
   - لا يشمل الضمان الأعطال الناتجة عن سوء الاستخدام، تذبذب التيار الكهربائي، أو الكوارث الطبيعية.
   - يسقط الضمان في حال قيام طرف ثالث بأي أعمال صيانة أو تعديل على المصعد.
3. الملكية:
   - تظل المواد ملكاً للمؤسسة حتى سداد كامل قيمة العقد، ولا يحق للعميل التصرف بها قبل ذلك.`;

const DEFAULT_HANDOVER = `1. تقوم المؤسسة بإخطار العميل بإنتهاء أعمال التركيب والتشغيل للمصعد وأنه جاهز للإستخدام ويتم تسليم المصعد للعميل عن طريق كتاب خطي للتوقيع من الطرفين.

2. في حال عدم قيام العميل باستلام المصعد في مدة أقصاها ثلاثون يوماً (٣٠) يوم من تاريخ إخطار العميل سواء بالإتصال أو عن طريق رسالة واتس أب للجوال المدون في العقد حينها تعتبر المدة التي تليها من الصيانة المجانية ويعتبر المصعد قد سلم للعميل.

3. تخلي المؤسسة مسؤوليتها عن أي أضرار ناتجة عن عدم تمكين فريق الصيانة من عمل الصيانة الدورية للمصعد أو أي أضرار تنتج للمصعد.

4. مدة الضمان والصيانة المجانية (عامين) من تاريخ تسليم المصعد شاملاً قطع الغيار ضد عيوب الصنع بواقع زيارة كل شهرين.

5. مدة ضمان الماكينة (حسب المدة المحددة في جدول فترات الضمان) ضد عيوب الصنع من تاريخ تسليم المصعد بشرط أن تتم الصيانة للمصعد عن طريق المؤسسة بعد إنتهاء الفترة المجانية بعقود منفصلة.

6. عند عدم تجديد عقد الصيانة بمدة أقصاها ثلاثون يوماً (٣٠) يوم) من إنتهاء الفترة المجانية يسقط حق العميل في ضمان الماكينة ويتحمل العميل نفقات الإصلاح، يستمر الضمان عن طريق عقود سنوية يتفق عليها.

7. لا تضمن المؤسسة الأضرار التي يسببها الغير بشكل مقصود أو في حال وصول الماء لأجزاء المصعد أو في حال استخدام مواد كيمائية في التنظيف.`;

const DEFAULT_FEATURES = [
    "نظام تحكم وتشغيل ذكي للمصعد مع إتصال إنتركوم.",
    "جهاز الوقاية من الحمولة الزائدة وتوقف المصعد مع إشارة ضوئية (OPD).",
    "إضاءة طوارئ تعمل داخل العربة عند انقطاع التيار الكهربائي.",
    "جرس إشعار (Gong) عند وصول الصاعدة للدور المطلوب.",
    "أزرار فتح وإغلاق الباب.",
    "مسند (درابزين) على جدار عربة المصعد.",
    "جدران عربة المصعد مكسية بخامات الإستانلس ستيل المقاوم للصدأ.",
    "إمكانية الربط بجهاز الإنذار والحريق في المبنى (BMS).",
    "درابزين حماية فوق العربة (Car Top Safety Guard).",
    "جرس إنذار للطوارئ.",
    "توقيت زمني لفصل المروحة والإضاءة أوتوماتيكياً عند عدم الإستعمال.",
    "توقف المصعد بالدور الأرضي (الدور الرئيسي) أوتوماتيكياً.",
    "أجهزة حماية الموتور عند إنعكاس أحد أوجه التيار أو زيادته.",
    "مبينات لبيان حركة وموقع الصاعدة لجميع الأدوار.",
    "مروحة تهوية ذات قوة دفع بكفاءة عالية.",
    "إعادة تسوية المصعد بمستوى الدور عند توفر الطاقة.",
    "تشخيص أوتوماتيكي لحساس الباب يمنع فتح أي دور عند عدم وجود العربة.",
    "الهبوط بأمان (Safe Landing).",
    "محكم سرعة (Governor) مع جير الأمان التدريجي.",
    "محكم السرعة الزائدة يعمل أوتوماتيكياً في حال زيادة السرعة.",
    "سوستة امتصاص الصدمات (Buffers) داخل الحفرة للعربة والوزن.",
    "باب أوتوماتيكي بالكامل يعمل بنظام (VVVF).",
    "حساس للباب بأشعة متعددة (MBS) لإعادة فتح الأبواب عند إعتراضها.",
    "بطارية طوارئ (ARD) لإنزال المصعد لأقرب وقفة في حال انقطاع التيار.",
    "محرك (Gearless) عالي الكفاءة وموفر للطاقة.",
    "مشغل مصعد (Drive) بنظام VVVF يعطي كفاءة عالية ونعومة في الحركة.",
    "الوزن المعاكس مع ثقل من الحديد الزهر المتين.",
    "سكك (T-section) مع أحذية توجيه ذات جودة عالية.",
    "حبال جر فولاذية مصنوعة خصيصاً للمصاعد.",
    "مفاتيح نهاية المشوار في الأعلى والأسفل لمنع تجاوز الأدوار.",
    "لوحات تشغيل بالعربة (هاتف طوارئ، مفتاح إنارة ومروحة، كاميرات)."
];

// --- NEW DEFAULTS FOR OBLIGATIONS PAGE ---
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

const DEFAULT_DURATION = `60 يوماً`;

export const QuoteModule: React.FC = () => {
    const { currentUser } = useAuth();
    const { quotes, saveQuote, deleteQuote } = useSales();
    const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(null);
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [details, setDetails] = useState<QuoteDetails>({
        number: '', date: '', customerName: '', customerAddress: '', projectName: '', validity: '', taxRate: 15, warrantyInstallation: '2', warrantyMotor: '5',
        paymentTerms: [],
        termsAndConditions: DEFAULT_TERMS,
        features: DEFAULT_FEATURES,
        handoverAndWarranty: DEFAULT_HANDOVER,
        firstPartyObligations: DEFAULT_FIRST_PARTY,
        secondPartyObligations: DEFAULT_SECOND_PARTY,
        worksDuration: DEFAULT_DURATION
    });
    const [techSpecs, setTechSpecs] = useState<TechnicalSpecs>({
        elevatorType: '', capacity: '', speed: '', stops: '', driveType: '', controlSystem: '', powerSupply: '', cabin: '', doors: '', machineRoom: '', rails: '', ropes: '', safety: '', emergency: ''
    });
    const [config, setConfig] = useState<CompanyConfig>({
        logo: null, stamp: null, headerTitle: 'جيلكو للمصاعد', headerSubtitle: 'JILCO ELEVATORS', footerText: '', contactPhone: '', contactEmail: '', bankAccounts: []
    });

    useEffect(() => {
        const savedGlobal = localStorage.getItem('jilco_quote_data');
        if (savedGlobal) {
            try {
                const parsed = JSON.parse(savedGlobal);
                if (parsed.config) setConfig(parsed.config);
            } catch (e) { }
        }
    }, []);

    const handleCreateNew = () => {
        setItems([]);
        setDetails({
            number: `Q-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(3, '0')}`,
            date: new Date().toISOString().split('T')[0],
            customerName: '',
            customerAddress: '',
            projectName: '',
            validity: '15 يوماً',
            taxRate: 15,
            warrantyInstallation: '2',
            warrantyMotor: '5',
            paymentTerms: [
                { name: 'الدفعة الأولى (عند توقيع العقد)', percentage: 40 },
                { name: 'الدفعة الثانية (عند تركيب السكك والأبواب)', percentage: 30 },
                { name: 'الدفعة الثالثة (قبل تركيب الكهرباء والمحرك)', percentage: 20 },
                { name: 'الدفعة الرابعة (عند التسليم والتشغيل)', percentage: 10 }
            ],
            termsAndConditions: DEFAULT_TERMS,
            features: DEFAULT_FEATURES,
            handoverAndWarranty: DEFAULT_HANDOVER,
            firstPartyObligations: DEFAULT_FIRST_PARTY,
            secondPartyObligations: DEFAULT_SECOND_PARTY,
            worksDuration: DEFAULT_DURATION
        });
        setCurrentQuoteId(null);
        setViewMode('editor');
    };

    const handleEdit = (quote: SavedQuote) => {
        setCurrentQuoteId(quote.id);
        setItems(quote.items);
        setDetails({
            ...quote.details,
            termsAndConditions: quote.details.termsAndConditions || DEFAULT_TERMS,
            features: quote.details.features || DEFAULT_FEATURES,
            handoverAndWarranty: quote.details.handoverAndWarranty || DEFAULT_HANDOVER,
            firstPartyObligations: quote.details.firstPartyObligations || DEFAULT_FIRST_PARTY,
            secondPartyObligations: quote.details.secondPartyObligations || DEFAULT_SECOND_PARTY,
            worksDuration: quote.details.worksDuration || DEFAULT_DURATION,
            paymentTerms: quote.details.paymentTerms && quote.details.paymentTerms.length > 0
                ? quote.details.paymentTerms
                : [
                    { name: 'الدفعة الأولى (عند توقيع العقد)', percentage: 40 },
                    { name: 'الدفعة الثانية (عند تركيب السكك والأبواب)', percentage: 30 },
                    { name: 'الدفعة الثالثة (قبل تركيب الكهرباء والمحرك)', percentage: 20 },
                    { name: 'الدفعة الرابعة (عند التسليم والتشغيل)', percentage: 10 }
                ]
        });
        setTechSpecs(quote.techSpecs);
        setViewMode('editor');
    };

    const handleSaveCurrentQuote = async () => {
        const quoteId = currentQuoteId || Date.now().toString();
        const quoteObj: SavedQuote = {
            id: quoteId,
            details,
            items,
            techSpecs,
            lastModified: new Date().toISOString().split('T')[0]
        };

        const success = await saveQuote(quoteId, quoteObj);

        if (success) {
            if (currentQuoteId) {
                loggerService.addLog(currentUser, 'تعديل عرض سعر', `رقم العرض: ${quoteObj.details.number}`, 'عروض الأسعار');
            } else {
                setCurrentQuoteId(quoteId);
                loggerService.addLog(currentUser, 'إنشاء عرض سعر', `رقم العرض: ${quoteObj.details.number}`, 'عروض الأسعار');
            }
            alert('تم حفظ العرض بنجاح عبر السحابة!');
        } else {
            alert('حدث خطأ أثناء رفع العرض للسحابة. تأكد من اتصالك بالإنترنت وسيتم المزامنة لاحقاً.');
        }
    };

    if (viewMode === 'list') {
        return (
            <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-jilco-900">أرشيف عروض الأسعار</h1>
                            <p className="text-gray-500 text-sm">إدارة كافة عروض الأسعار الصادرة</p>
                        </div>
                        <button onClick={handleCreateNew} className="bg-jilco-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md">
                            <Plus size={20} /> عرض سعر جديد
                        </button>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-50 text-gray-500">
                                <tr>
                                    <th className="p-4">رقم العرض</th>
                                    <th className="p-4">العميل</th>
                                    <th className="p-4">التاريخ</th>
                                    <th className="p-4">الإجمالي</th>
                                    <th className="p-4 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {quotes.map(quote => (
                                    <tr key={quote.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-bold">{quote.details.number}</td>
                                        <td className="p-4">{quote.details.customerName || 'عميل نقدي'}</td>
                                        <td className="p-4 font-mono text-xs">{quote.details.date}</td>
                                        <td className="p-4 font-bold text-green-700">{(quote.items.reduce((s: number, i: any) => s + i.total, 0) * (1 + quote.details.taxRate / 100)).toLocaleString()}</td>
                                        <td className="p-4 flex justify-center gap-2">
                                            <button onClick={() => handleEdit(quote)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full" title="تعديل"><Edit size={16} /></button>
                                            <button onClick={() => { handleEdit(quote); setTimeout(() => window.print(), 500); }} className="p-2 text-gray-600 hover:bg-gray-50 rounded-full" title="طباعة"><Printer size={16} /></button>
                                            <button onClick={() => deleteQuote(quote.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full" title="حذف"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {quotes.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">لا توجد عروض محفوظة</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden print:block">
            <Sidebar
                items={items} setItems={setItems}
                details={details} setDetails={setDetails}
                techSpecs={techSpecs} setTechSpecs={setTechSpecs}
                config={config} setConfig={setConfig}
                onPrint={() => window.print()}
                onSave={handleSaveCurrentQuote}
            />
            <QuotePreview items={items} details={details} techSpecs={techSpecs} config={config} />
        </div>
    );
};

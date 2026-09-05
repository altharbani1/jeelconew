import React, { useState, useEffect } from 'react';
import { FileText, Printer, ArrowLeft, CheckSquare, AlertTriangle, CheckCircle2, Truck, Phone, Mail, MapPin, Globe } from 'lucide-react';
import { CompanyConfig } from '../types';

const INITIAL_CONFIG: CompanyConfig = {
    logo: null,
    stamp: null,
    headerTitle: 'جيلكو للمصاعد',
    headerSubtitle: 'Jilco Elevators Co.',
    footerText: '',
    contactPhone: '',
    contactEmail: '',
    bankAccounts: []
};

export const FormsModule: React.FC = () => {
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [config, setConfig] = useState<CompanyConfig>(INITIAL_CONFIG);

  useEffect(() => {
    const savedConfig = localStorage.getItem('jilco_quote_data');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (parsed.config) setConfig(parsed.config);
      } catch (e) {}
    }
  }, []);

  const handlePrint = () => window.print();

  const forms = [
    { id: 'handover', title: 'محضر استلام وتشغيل (Handover Certificate)', icon: CheckCircle2 },
    { id: 'readiness', title: 'نموذج جاهزية الموقع (Site Readiness)', icon: CheckSquare },
    { id: 'maintenance', title: 'نموذج طلب صيانة (Maintenance Request)', icon: AlertTriangle },
    { id: 'delivery', title: 'سند تسليم مواد (Delivery Note)', icon: Truck },
  ];

  // --- Shared Header & Footer Components ---
  const FormHeader = ({ title }: { title: string }) => (
    <>
      <div className="flex justify-between items-center border-b-2 border-jilco-100 pb-4 mb-4 h-[140px] shrink-0">
        <div className="w-1/3 text-right">
          <h1 className="text-2xl font-black text-jilco-900 mb-0.5">{config.headerTitle || 'جيلكو للمصاعد'}</h1>
          <p className="text-[10px] font-bold text-gray-500 mb-3">{config.headerSubtitle || 'للمصاعد والسلالم الكهربائية'}</p>
          <div className="text-[9px] text-gray-400 font-bold border-r-2 border-gold-500 pr-2 leading-tight">
            <p>سجل تجاري: ١٠١٠٧٢٤٥٨٢</p>
            <p>الرقم الضريبي: ٣١٠٢٤٥٦٧٨٩٠٠٠٠٣</p>
          </div>
        </div>
        <div className="w-1/3 flex justify-center">
          {config.logo ? (
            <img src={config.logo} alt="Logo" className="h-28 w-auto object-contain" />
          ) : (
            <div className="h-24 w-24 bg-gray-50 border border-dashed border-gray-200 rounded-full flex items-center justify-center text-[8px] text-gray-300 uppercase">Logo</div>
          )}
        </div>
        <div className="w-1/3 text-left flex flex-col items-end" dir="ltr">
          <h2 className="text-lg font-black text-jilco-900 tracking-tighter">JILCO ELEVATORS</h2>
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-700 bg-gray-50 px-2 py-1 rounded-l-full border-r-2 border-jilco-600">
                <span>{config.contactPhone}</span>
                <Phone size={10} className="text-jilco-600"/>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-700 bg-gray-50 px-2 py-1 rounded-l-full border-r-2 border-gold-500">
                <span>{config.contactEmail}</span>
                <Mail size={10} className="text-gold-600"/>
            </div>
          </div>
        </div>
      </div>
      
      <div className="text-center mb-6 relative shrink-0">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div>
          <h2 className="relative inline-block px-6 bg-white text-lg font-black text-black border-2 border-black py-1 rounded-lg z-10 shadow-sm">
              {title}
          </h2>
      </div>
    </>
  );

  const FormFooter = () => (
    <footer className="w-full mt-auto pt-4 shrink-0">
        <div className="bg-jilco-900 text-white py-2 px-6 flex justify-between items-center text-[10px] font-bold h-[40px] rounded-lg">
            <div className="flex items-center gap-2">
                <MapPin size={12} className="text-gold-400"/>
                <span>{config.footerText || 'المملكة العربية السعودية - الرياض'}</span>
            </div>
            <div className="flex items-center gap-2" dir="ltr">
                <Globe size={12} className="text-gold-400"/>
                <span>www.jilco-elevators.com</span>
            </div>
        </div>
    </footer>
  );

  const renderHandoverForm = () => (
    <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] mx-auto p-8 relative flex flex-col border-2 border-black print:shadow-none print:w-[210mm] print:h-[296mm] print:m-0 print:overflow-hidden">
        <FormHeader title="محضر استلام وتشغيل (Handover Certificate)" />

        <div className="border border-black rounded-lg p-5 space-y-5 flex-1 flex flex-col">
            {/* Project Details Grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 shrink-0">
                <div>
                    <label className="block text-xs font-bold text-black mb-1">اسم العميل</label>
                    <input type="text" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-black mb-1">المشروع / الموقع</label>
                    <input type="text" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-black mb-1">نوع المصعد</label>
                    <input type="text" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-black mb-1">عدد الوقفات</label>
                    <input type="text" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-black mb-1">تاريخ التشغيل</label>
                    <input type="date" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-black mb-1">حمولة المصعد</label>
                    <input type="text" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
            </div>

            {/* Checklist Table */}
            <div className="mt-6 flex-1">
                <h3 className="font-bold text-sm mb-3 border-b-2 border-black pb-2 text-black">قائمة الفحص والتسليم</h3>
                <div className="space-y-3">
                    {['غرفة الماكينة (الماكينة، اللوحة، المنظم)', 'الكابينة (الأزرار، الإضاءة، الباب، الإنتركوم)', 'بئر المصعد (الأبواب، السكك، الحبال)', 'التشغيل (الحركة، التوقف، النعومة)'].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between border-b border-gray-200 pb-2">
                            <span className="text-sm font-bold text-black flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-black rounded-full"></div> {item}
                            </span>
                            <div className="flex gap-6">
                                <label className="flex items-center gap-2 text-xs cursor-pointer font-bold"><input type="checkbox" className="w-4 h-4 accent-black" /> سليم</label>
                                <label className="flex items-center gap-2 text-xs cursor-pointer font-bold"><input type="checkbox" className="w-4 h-4 accent-black" /> ملاحظات</label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Warranty & Handover Statement */}
            <div className="bg-gray-50 p-4 rounded-lg border border-black text-[10px] leading-loose text-justify mt-4 shadow-sm shrink-0">
                <p className="font-bold mb-1 text-black underline">إقرار الاستلام:</p>
                <p className="text-black font-medium">أقر أنا الموقع أدناه بصفتي (المالك / ممثل المالك) بأنني استلمت المصعد المذكور أعلاه وهو بحالة تشغيلية ممتازة، وتم استلام مفاتيح التشغيل وغرفة الماكينة، وتم تدريبي على كيفية استخدام المصعد في الحالات العادية والطارئة. يبدأ سريان فترة الضمان من تاريخ هذا المحضر.</p>
            </div>
        </div>

        {/* Signatures */}
        <div className="mt-6 grid grid-cols-3 gap-8 shrink-0 mb-4">
            <div className="text-center">
                <p className="font-bold mb-6 text-black text-xs">مهندس التركيب</p>
                <input type="text" className="w-2/3 mx-auto border-b border-black text-center outline-none bg-transparent" placeholder="التوقيع" />
            </div>
            <div className="text-center">
                <p className="font-bold mb-6 text-black text-xs">مدير المشاريع</p>
                <input type="text" className="w-2/3 mx-auto border-b border-black text-center outline-none bg-transparent" placeholder="التوقيع" />
            </div>
            <div className="text-center">
                <p className="font-bold mb-6 text-black text-xs">توقيع العميل</p>
                <input type="text" className="w-2/3 mx-auto border-b border-black text-center outline-none bg-transparent" placeholder="التوقيع" />
            </div>
        </div>

        <FormFooter />
    </div>
  );

  const renderDeliveryForm = () => (
    <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] mx-auto p-8 relative flex flex-col border-2 border-black print:shadow-none print:w-[210mm] print:h-[296mm] print:m-0 print:overflow-hidden">
        <FormHeader title="سند تسليم مواد (Delivery Note)" />

        <div className="border border-black rounded-lg p-5 space-y-5 flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 shrink-0">
                <div>
                    <label className="block text-xs font-bold text-black mb-1">اسم العميل</label>
                    <input type="text" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-black mb-1">الموقع</label>
                    <input type="text" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-black mb-1">التاريخ</label>
                    <input type="date" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-black mb-1">رقم السند</label>
                    <input type="text" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
            </div>

            <div className="mt-4 flex-1">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-black text-white">
                            <th className="p-2 border border-black w-10 text-center rounded-tr-lg">#</th>
                            <th className="p-2 border border-black text-right">وصف المادة (Description)</th>
                            <th className="p-2 border border-black w-20 text-center">العدد</th>
                            <th className="p-2 border border-black w-20 text-center">الوحدة</th>
                            <th className="p-2 border border-black w-1/3 text-right rounded-tl-lg">ملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[1,2,3,4,5,6,7,8,9,10].map(i => (
                            <tr key={i} className="h-10 border-b border-gray-300">
                                <td className="border-l border-r border-gray-300 p-2 text-center bg-gray-50 text-gray-500">{i}</td>
                                <td className="border-l border-r border-gray-300 p-0"><input type="text" className="w-full h-full p-2 outline-none bg-transparent" /></td>
                                <td className="border-l border-r border-gray-300 p-0"><input type="text" className="w-full h-full p-2 outline-none text-center bg-transparent" /></td>
                                <td className="border-l border-r border-gray-300 p-0"><input type="text" className="w-full h-full p-2 outline-none text-center bg-transparent" /></td>
                                <td className="border-l border-r border-gray-300 p-0"><input type="text" className="w-full h-full p-2 outline-none bg-transparent" /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="bg-amber-50 p-3 rounded border border-black text-xs text-black shadow-sm mt-auto shrink-0">
                <p className="font-bold flex items-center gap-2 mb-1"><AlertTriangle size={14}/> تنبيه هام:</p>
                <p>يقر المستلم باستلام المواد المذكورة أعلاه بحالة جيدة وكاملة، وتصبح في عهدته ومسؤوليته من لحظة التوقيع.</p>
            </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-8 shrink-0 mb-4">
            <div className="text-center">
                <p className="font-bold mb-6 text-black text-xs">أمين المستودع</p>
                <input type="text" className="w-2/3 mx-auto border-b border-black text-center outline-none bg-transparent" placeholder="التوقيع" />
            </div>
            <div className="text-center">
                <p className="font-bold mb-6 text-black text-xs">الناقل / السائق</p>
                <input type="text" className="w-2/3 mx-auto border-b border-black text-center outline-none bg-transparent" placeholder="التوقيع" />
            </div>
            <div className="text-center">
                <p className="font-bold mb-6 text-black text-xs">استلام العميل</p>
                <input type="text" className="w-2/3 mx-auto border-b border-black text-center outline-none bg-transparent" placeholder="التوقيع" />
            </div>
        </div>

        <FormFooter />
    </div>
  );

  const renderReadinessForm = () => (
    <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] mx-auto p-8 relative flex flex-col border-2 border-black print:shadow-none print:w-[210mm] print:h-[296mm] print:m-0 print:overflow-hidden">
        <FormHeader title="قائمة التحقق من جاهزية الموقع (Site Readiness Checklist)" />

        <div className="bg-gray-100 p-4 rounded-lg border border-black mb-4 text-xs shadow-inner shrink-0">
            <p className="font-bold text-black mb-2 flex items-center gap-2"><AlertTriangle size={14}/> تنبيه هام للعميل:</p>
            <p className="leading-relaxed text-black font-medium">لضمان سير أعمال التركيب في الموعد المحدد وبدون تأخير، يرجى التأكد من استيفاء جميع المتطلبات التالية. عدم جاهزية الموقع قد تؤدي إلى تأجيل موعد التركيب وحساب تكاليف إضافية.</p>
        </div>

        <div className="space-y-4 text-sm flex-1">
            <div className="border-2 border-black rounded-xl overflow-hidden">
                <div className="bg-black text-white p-2 font-bold text-xs flex justify-between items-center">
                    <span>1. الأعمال المدنية (Civil Works)</span>
                    <CheckSquare size={14}/>
                </div>
                <div className="p-4 space-y-3">
                    <label className="flex items-start gap-3 p-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 accent-black mt-0.5" />
                        <span className="font-bold text-black">نظافة بئر المصعد من المخلفات والخشب ومواد البناء.</span>
                    </label>
                    <label className="flex items-start gap-3 p-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 accent-black mt-0.5" />
                        <span className="font-bold text-black">لياسة بئر المصعد من الداخل (إذا كان خرسانة/بلك) وسد الفتحات بشكل كامل.</span>
                    </label>
                    <label className="flex items-start gap-3 p-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 accent-black mt-0.5" />
                        <span className="font-bold text-black">تجهيز السقالات (Scaffolding) داخل البئر حسب المواصفات المطلوبة للتركيب.</span>
                    </label>
                    <label className="flex items-start gap-3 p-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 accent-black mt-0.5" />
                        <span className="font-bold text-black">توفير غرفة ماكينة (للمصاعد العلوية) مع تهوية وإضاءة وباب محكم الإغلاق.</span>
                    </label>
                </div>
            </div>

            <div className="border-2 border-black rounded-xl overflow-hidden">
                <div className="bg-black text-white p-2 font-bold text-xs flex justify-between items-center">
                    <span>2. الأعمال الكهربائية (Electrical Works)</span>
                    <CheckSquare size={14}/>
                </div>
                <div className="p-4 space-y-3">
                    <label className="flex items-start gap-3 p-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 accent-black mt-0.5" />
                        <span className="font-bold text-black">توفير مصدر تيار كهربائي (3 Phase) واصل لغرفة الماكينة/أعلى البئر.</span>
                    </label>
                    <label className="flex items-start gap-3 p-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 accent-black mt-0.5" />
                        <span className="font-bold text-black">تركيب القاطع الرئيسي (Circuit Breaker) بالمواصفات المطلوبة (63A/40A).</span>
                    </label>
                    <label className="flex items-start gap-3 p-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 accent-black mt-0.5" />
                        <span className="font-bold text-black">توفير إضاءة مؤقتة داخل البئر للعمل بأمان.</span>
                    </label>
                </div>
            </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-16 shrink-0 mb-4">
            <div className="text-center">
                <p className="font-bold mb-6 text-black text-xs">مهندس الموقع (جيلكو)</p>
                <input type="text" className="w-full mx-auto border-b border-black text-center outline-none bg-transparent" placeholder="التوقيع" />
            </div>
            <div className="text-center">
                <p className="font-bold mb-6 text-black text-xs">إقرار العميل بالجاهزية</p>
                <input type="text" className="w-full mx-auto border-b border-black text-center outline-none bg-transparent" placeholder="التوقيع" />
            </div>
        </div>

        <FormFooter />
    </div>
  );

  const renderMaintenanceForm = () => (
      <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] mx-auto p-8 relative flex flex-col border-2 border-black print:shadow-none print:w-[210mm] print:h-[296mm] print:m-0 print:overflow-hidden">
        <FormHeader title="نموذج طلب صيانة (Maintenance Request)" />

        <div className="border border-black rounded-lg p-5 space-y-5 flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 shrink-0">
                <div>
                    <label className="block text-xs font-bold text-black mb-1">اسم العميل</label>
                    <input type="text" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-black mb-1">رقم العقد / المشروع</label>
                    <input type="text" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-black mb-1">الموقع</label>
                    <input type="text" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-black mb-1">رقم التواصل</label>
                    <input type="text" className="w-full border-b border-gray-400 py-1 bg-transparent outline-none focus:border-black transition-colors text-sm font-bold text-black" />
                </div>
            </div>

            <div className="shrink-0">
                <label className="block text-xs font-bold text-black mb-2">وصف العطل / المشكلة</label>
                <textarea className="w-full border border-black rounded h-24 p-3 bg-transparent outline-none text-sm font-medium resize-none" placeholder="اكتب وصف المشكلة هنا..."></textarea>
            </div>

            <div className="shrink-0">
                <label className="block text-xs font-bold text-black mb-2">نوع الصيانة المطلوبة</label>
                <div className="flex gap-8 p-3 bg-gray-50 border border-black rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-black" /> <span className="text-sm font-bold text-black">دورية (Periodic)</span></label>
                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-black" /> <span className="text-sm font-bold text-black">طارئة (Emergency)</span></label>
                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-black" /> <span className="text-sm font-bold text-black">قطع غيار (Spare Parts)</span></label>
                </div>
            </div>
            
            <div className="mt-4 border border-black rounded-lg p-4 bg-white shadow-sm flex-1">
                <h3 className="font-bold text-sm mb-4 border-b border-gray-300 pb-2 text-black flex items-center gap-2">
                    <FileText size={16}/> تقرير الفني (للاستخدام الداخلي)
                </h3>
                <div className="space-y-4">
                    <div className="flex gap-6">
                        <div className="flex-1"><label className="text-xs text-gray-500 font-bold">تاريخ الزيارة:</label> <input type="date" className="w-full border-b border-gray-400 py-1 outline-none" /></div>
                        <div className="flex-1"><label className="text-xs text-gray-500 font-bold">وقت الوصول:</label> <input type="time" className="w-full border-b border-gray-400 py-1 outline-none" /></div>
                        <div className="flex-1"><label className="text-xs text-gray-500 font-bold">وقت المغادرة:</label> <input type="time" className="w-full border-b border-gray-400 py-1 outline-none" /></div>
                    </div>
                    <div><label className="text-xs text-gray-500 font-bold">الإجراء المتخذ:</label> <input type="text" className="w-full border-b border-gray-400 py-1 outline-none mb-2" /><input type="text" className="w-full border-b border-gray-400 py-1 outline-none" /></div>
                    <div><label className="text-xs text-gray-500 font-bold">قطع الغيار المستخدمة:</label> <input type="text" className="w-full border-b border-gray-400 py-1 outline-none" /></div>
                </div>
            </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-16 shrink-0 mb-4">
            <div className="text-center">
                <p className="font-bold mb-6 text-black text-xs">توقيع الفني</p>
                <input type="text" className="w-2/3 mx-auto border-b border-black text-center outline-none bg-transparent" placeholder="التوقيع" />
            </div>
            <div className="text-center">
                <p className="font-bold mb-6 text-black text-xs">مصادقة العميل على الإنجاز</p>
                <input type="text" className="w-2/3 mx-auto border-b border-black text-center outline-none bg-transparent" placeholder="التوقيع" />
            </div>
        </div>

        <FormFooter />
      </div>
  );

  return (
    <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in print:p-0 print:bg-white print:overflow-visible">
        {!selectedForm ? (
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                            <FileText className="text-gold-500" /> النماذج والمستندات
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">طباعة نماذج العمل الجاهزة (PDF)</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {forms.map(form => (
                        <button 
                            key={form.id}
                            onClick={() => setSelectedForm(form.id)}
                            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all text-right group"
                        >
                            <div className="w-12 h-12 bg-jilco-50 text-jilco-700 rounded-lg flex items-center justify-center mb-4 group-hover:bg-jilco-900 group-hover:text-white transition-colors">
                                <form.icon size={24} />
                            </div>
                            <h3 className="font-bold text-gray-800 group-hover:text-jilco-900">{form.title}</h3>
                            <p className="text-xs text-gray-500 mt-2">اضغط للعرض والطباعة</p>
                        </button>
                    ))}
                </div>
            </div>
        ) : (
            <div className="max-w-[210mm] mx-auto print:w-full print:max-w-none">
                <div className="flex justify-between items-center mb-6 print:hidden">
                    <button onClick={() => setSelectedForm(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-bold bg-white px-4 py-2 rounded-lg shadow-sm">
                        <ArrowLeft size={18} /> رجوع للقائمة
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-jilco-900 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-jilco-800">
                        <Printer size={18} /> طباعة النموذج
                    </button>
                </div>
                
                <div id="printable-area" className="print:w-full">
                    {selectedForm === 'readiness' && renderReadinessForm()}
                    {selectedForm === 'maintenance' && renderMaintenanceForm()}
                    {selectedForm === 'handover' && renderHandoverForm()}
                    {selectedForm === 'delivery' && renderDeliveryForm()}
                </div>
            </div>
        )}
    </div>
  );
};

import React from 'react';
import { QuoteItem, QuoteDetails, CompanyConfig, TechnicalSpecs } from '../types.ts';
import { Phone, Mail, MapPin, ShieldCheck, Zap, CreditCard, Award, FileText, CheckCircle2, Star, Briefcase, Clock, Scale, ImageIcon } from 'lucide-react';

interface QuotePreviewProps {
  items: QuoteItem[];
  details: QuoteDetails;
  techSpecs: TechnicalSpecs;
  config: CompanyConfig;
}

// --- SHARED HEADER COMPONENT ---
const QuoteHeader: React.FC<{ config: CompanyConfig }> = ({ config }) => (
  <header className="px-10 py-6 border-b-2 border-jilco-100 flex justify-between items-center bg-white h-[160px] relative overflow-hidden shrink-0">
    <div className="w-1/3 text-right">
      <h1 className="text-2xl font-black text-jilco-900 mb-0.5">{config.headerTitle || 'جيلكو للمصاعد'}</h1>
      <p className="text-[10px] font-bold text-gray-500 mb-3">{config.headerSubtitle || 'للمصاعد والسلالم الكهربائية'}</p>
      <div className="text-[9px] text-gray-400 font-bold border-r-2 border-gold-500 pr-2 leading-tight">
        <p>سجل تجاري: ١٠١٠٧٢٤٥٨٢</p>
        {config.vatNumber ? (
          <p>الرقم الضريبي: {config.vatNumber}</p>
        ) : (
          <p>الرقم الضريبي: ٣١٠٢٤٥٦٧٨٩٠٠٠٠٣</p>
        )}
      </div>
    </div>
    <div className="w-1/3 flex justify-center">
      {config.logo ? (
        <img src={config.logo} alt="Logo" className="h-32 w-auto object-contain" />
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
  </header>
);

// --- SHARED FOOTER COMPONENT ---
const QuoteFooter: React.FC<{ config: CompanyConfig }> = ({ config }) => (
  <footer className="w-full bg-white shrink-0 mt-auto">
      <div className="bg-jilco-900 text-white py-3 px-10 flex justify-between items-center text-[10px] font-bold h-[45px]">
          <div className="flex items-center gap-2">
              <MapPin size={12} className="text-gold-400"/>
              <span>{config.footerText || 'المملكة العربية السعودية - الرياض'}</span>
          </div>
          <div className="flex items-center gap-2" dir="ltr">
             <FileText size={12} className="text-gold-400"/>
             <span>www.jilco-elevators.com</span>
          </div>
      </div>
  </footer>
);

export const QuotePreview: React.FC<QuotePreviewProps> = ({ items, details, techSpecs, config }) => {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (details.taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  // Use dynamic features list or fallback to empty array if undefined
  const featuresList = details.features && details.features.length > 0 
    ? details.features.filter(f => f.trim() !== '') 
    : ["لا توجد مزايا إضافية مسجلة."];

  return (
    <div className="flex-1 bg-gray-200 p-8 overflow-auto flex flex-col items-center print:bg-white print:p-0 print:block">
      
      <div id="printable-area" className="print:w-full">
        
        {/* PAGE 1: FINANCIAL QUOTE WITH ROYAL FRAME */}
        <div className="a4-page bg-white shadow-2xl mb-10 print:mb-0 mx-auto flex flex-col relative">
          
          <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
          <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
          <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

          <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
            <QuoteHeader config={config} />
            
            <div className="px-10 py-6 flex-1 flex flex-col relative">
                <div className="text-center mb-6">
                    <h2 className="text-xl font-black text-white bg-jilco-900 py-2.5 px-12 rounded-lg inline-block shadow-md border-b-4 border-gold-500 uppercase tracking-tighter">عرض سعر توريد وتركيب مصعد</h2>
                </div>

                {/* Client Section */}
                <div className="grid grid-cols-2 gap-6 mb-6 bg-gray-50/80 p-5 rounded-xl border border-gray-100">
                    <div className="text-right">
                        <p className="text-[9px] font-black text-gray-400 mb-1 uppercase tracking-widest">اسم العميل / Customer Name</p>
                        <p className="font-black text-xl text-black mb-1 underline decoration-gold-500 decoration-4 underline-offset-8">
                          السادة / {details.customerName || 'المحترمين'}
                        </p>
                        <p className="text-xs font-bold text-gray-600 flex items-center gap-2 mt-3"><MapPin size={14} className="text-gold-600"/> {details.projectName}</p>
                    </div>
                    {/* Date/Ref shifted left with ml-auto and specific layout */}
                    <div className="text-left font-mono text-xs flex flex-col items-end justify-center" dir="ltr">
                        <div className="space-y-1.5 w-full flex flex-col items-start pr-12">
                            <p className="bg-white px-4 py-1.5 rounded-lg shadow-sm border border-gray-200 min-w-[160px] flex justify-between gap-4">
                                <span className="text-gray-400 font-sans font-black text-[9px] uppercase">Date:</span> 
                                <span className="font-black text-jilco-900">{details.date}</span>
                            </p>
                            <p className="bg-white px-4 py-1.5 rounded-lg shadow-sm border border-gray-200 min-w-[160px] flex justify-between gap-4">
                                <span className="text-gray-400 font-sans font-black text-[9px] uppercase">Ref:</span> 
                                <span className="font-black text-jilco-900">{details.number}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1">
                    <table className="w-full border-collapse">
                        <thead>
                        <tr className="bg-jilco-900 text-white text-[11px] font-black uppercase">
                            <th className="p-3 text-center w-10 border-l border-white/10 rounded-tr-lg">#</th>
                            <th className="p-3 text-right border-l border-white/10">اسم البند / التفاصيل الفنية</th>
                            <th className="p-3 text-center w-20 border-l border-white/10">الكمية</th>
                            <th className="p-3 text-center w-36 rounded-tl-lg">الإجمالي (SAR)</th>
                        </tr>
                        </thead>
                        <tbody>
                        {items.map((item, idx) => (
                            <tr key={item.id} className="border-b border-gray-100 group">
                            <td className="p-3 text-center font-black text-black align-top bg-gray-50/30">{idx + 1}</td>
                            <td className="p-3">
                                <p className="font-black text-black text-base mb-2 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-gold-500 rounded-full"></div>
                                {item.description}
                                </p>
                                <div className="bg-gray-100 p-4 rounded-xl text-[13px] font-black text-black whitespace-pre-line leading-relaxed shadow-inner border border-gray-200">
                                {item.details}
                                </div>
                            </td>
                            <td className="p-3 text-center font-black text-base text-black align-top bg-gray-50/30">{item.quantity}</td>
                            <td className="p-3 text-center font-black text-lg text-black align-top">{item.total.toLocaleString()}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {/* Financials Totals */}
                <div className="flex justify-end mt-6 mb-4">
                    <div className="w-72 bg-white p-5 rounded-2xl border-4 border-jilco-900 shadow-xl space-y-3 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-full h-1.5 bg-gold-500"></div>
                        <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase">
                            <span>Subtotal:</span>
                            <span className="font-mono text-black font-black">{subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase">
                            <span>VAT 15%:</span>
                            <span className="font-mono text-red-600 font-black">{taxAmount.toLocaleString()}</span>
                        </div>
                        <div className="border-t-2 border-gray-100 pt-3 flex justify-between items-center">
                            <span className="font-black text-jilco-900 text-xs uppercase tracking-tighter">Grand Total:</span>
                            <div className="text-left">
                                <span className="font-black text-black text-2xl font-mono">{grandTotal.toLocaleString()}</span>
                                <p className="text-[8px] text-gold-600 font-black text-center">SAR ريال سعودي</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Signature & Stamp Section */}
                <div className="grid grid-cols-2 gap-16 px-6 mt-auto pb-6 relative">
                    <div className="text-center relative">
                        <p className="font-black text-[9px] mb-12 text-gray-400 uppercase tracking-[0.2em]">Authorized Signature</p>
                        <div className="border-b-2 border-jilco-900 mx-auto w-48 mb-2"></div>
                        <p className="font-black text-jilco-900 text-xs uppercase">شركة جيلكو للمصاعد</p>
                        {config.stamp && (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-[30px] z-50 pointer-events-none">
                            <img src={config.stamp} alt="stamp" className="h-56 w-56 mx-auto mix-blend-multiply opacity-95 brightness-90" />
                        </div>
                        )}
                    </div>
                    <div className="text-center">
                        <p className="font-black text-[9px] mb-12 text-gray-400 uppercase tracking-[0.2em]">Customer Approval</p>
                        <div className="border-b-2 border-gray-200 mx-auto w-48 mb-2"></div>
                        <p className="font-black text-gray-400 text-xs uppercase">موافقة وتوقيع العميل</p>
                    </div>
                </div>
                <QuoteFooter config={config} />
            </div>
          </div>
        </div>

        {/* PAGE 2: TECHNICAL SPECIFICATIONS WITH ROYAL FRAME */}
        <div className="a4-page bg-white shadow-2xl mb-10 print:mb-0 mx-auto flex flex-col relative">
          
          <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
          <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
          <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

          <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
            <QuoteHeader config={config} />
            
            <div className="px-10 py-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b-2 border-jilco-900 pb-4 mb-6">
                    <h3 className="text-xl font-black text-jilco-900 flex items-center gap-3 uppercase tracking-tighter">
                        <div className="w-10 h-10 bg-jilco-900 text-gold-500 flex items-center justify-center rounded-xl shadow-lg"><Zap size={20}/></div>
                        جدول المواصفات الفنية المعتمدة
                    </h3>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Technical Data</span>
                </div>
                
                <div className="grid grid-cols-1 border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-8">
                {[
                    { label: 'نوع المصعد (Elevator Type)', value: techSpecs.elevatorType },
                    { label: 'الحمولة (Capacity)', value: techSpecs.capacity },
                    { label: 'السرعة (Speed)', value: techSpecs.speed },
                    { label: 'الوقفات / الفتحات (Stops)', value: techSpecs.stops },
                    { label: 'نظام الحركة (Drive System)', value: techSpecs.driveType },
                    { label: 'لوحة التحكم (Control System)', value: techSpecs.controlSystem },
                    { label: 'مصدر الكهرباء (Power Supply)', value: techSpecs.powerSupply },
                    { label: 'تشطيب الكابينة (Cabin Finish)', value: techSpecs.cabin },
                    { label: 'نظام الأبواب (Door System)', value: techSpecs.doors },
                    { label: 'غرفة الماكينة (Machine Room)', value: techSpecs.machineRoom },
                    { label: 'السكك والمسارات (Rails)', value: techSpecs.rails },
                    { label: 'الحبال والأسلاك (Ropes)', value: techSpecs.ropes },
                    { label: 'أنظمة الأمان (Safety)', value: techSpecs.safety },
                    { label: 'جهاز الطوارئ (Emergency)', value: techSpecs.emergency },
                ].map((row, i) => (
                    <div key={i} className={`flex border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}`}>
                        <div className="w-1/3 p-3.5 font-black text-[11px] text-jilco-700 bg-gray-100/30 border-l border-gray-100 uppercase tracking-tighter">{row.label}</div>
                        <div className="w-2/3 p-3.5 text-[13px] font-black text-black uppercase">{row.value || 'سيتم التحديد لاحقاً'}</div>
                    </div>
                ))}
                </div>

                <QuoteFooter config={config} />
            </div>
          </div>
        </div>

        {/* PAGE 3: FEATURES PAGE (DYNAMIC) */}
        <div className="a4-page bg-white shadow-2xl mb-10 print:mb-0 mx-auto flex flex-col relative">
          
          <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
          <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
          <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

          <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
            <QuoteHeader config={config} />
            
            <div className="px-10 py-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b-2 border-jilco-900 pb-4 mb-6">
                    <h3 className="text-xl font-black text-jilco-900 flex items-center gap-3 uppercase tracking-tighter">
                        <div className="w-10 h-10 bg-jilco-900 text-gold-500 flex items-center justify-center rounded-xl shadow-lg"><Star size={20}/></div>
                        مزايا المصعد الإضافية
                    </h3>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Other Features</span>
                </div>

                <div className="flex-1 overflow-hidden">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-0 text-sm">
                        {featuresList.map((feature, idx) => (
                            <div key={idx} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0 break-inside-avoid">
                                <div className="mt-1 text-gold-500 shrink-0"><CheckCircle2 size={14} /></div>
                                <span className="font-bold text-gray-700 text-[11px] leading-relaxed">{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <QuoteFooter config={config} />
            </div>
          </div>
        </div>

        {/* PAGE 4: OBLIGATIONS AND PAYMENT (OPTIMIZED SPACING) */}
        <div className="a4-page bg-white shadow-2xl mb-10 print:mb-0 mx-auto flex flex-col relative">
          
          <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
          <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
          <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

          <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
            <QuoteHeader config={config} />
            
            <div className="px-10 py-4 flex-1 flex flex-col space-y-4">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-jilco-900 pb-3">
                    <h3 className="text-xl font-black text-jilco-900 flex items-center gap-3 uppercase tracking-tighter">
                        <div className="w-10 h-10 bg-jilco-900 text-gold-500 flex items-center justify-center rounded-xl shadow-lg"><Scale size={20}/></div>
                        الالتزامات وطريقة الدفع
                    </h3>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Obligations & Payment</span>
                </div>

                {/* Section 1: Payment Schedule Table */}
                <div>
                    <h4 className="text-sm font-black text-jilco-800 mb-2 flex items-center gap-2 border-b border-gray-100 pb-1">
                        <CreditCard size={14}/> جدول الدفعات المالية (Payment Schedule)
                    </h4>
                    <table className="w-full text-sm border-collapse border border-gray-200">
                        <thead>
                            <tr className="bg-jilco-50 text-jilco-900">
                                <th className="border border-gray-200 p-1.5 text-center w-12">#</th>
                                <th className="border border-gray-200 p-1.5 text-right">البيان (المرحلة)</th>
                                <th className="border border-gray-200 p-1.5 text-center w-20">النسبة</th>
                                <th className="border border-gray-200 p-1.5 text-center w-32">المبلغ (ر.س)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {details.paymentTerms.map((term, idx) => (
                                <tr key={idx}>
                                    <td className="border border-gray-200 p-1.5 text-center font-bold">{idx + 1}</td>
                                    <td className="border border-gray-200 p-1.5 font-bold text-gray-700">{term.name}</td>
                                    <td className="border border-gray-200 p-1.5 text-center font-mono">{term.percentage}%</td>
                                    <td className="border border-gray-200 p-1.5 text-center font-mono font-bold text-jilco-900">
                                        {(grandTotal * (term.percentage / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold">
                            <tr>
                                <td colSpan={2} className="border border-gray-200 p-1.5 text-left pl-4">الإجمالي (شامل الضريبة)</td>
                                <td className="border border-gray-200 p-1.5 text-center dir-ltr">{details.paymentTerms.reduce((s,t)=>s+t.percentage,0)}%</td>
                                <td className="border border-gray-200 p-1.5 text-center font-mono">{grandTotal.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Section 2: First Party Obligations */}
                <div>
                    <h4 className="text-sm font-black text-jilco-800 mb-1.5 flex items-center gap-2 border-b border-gray-100 pb-1">
                        <Briefcase size={14}/> إلتزامات الطرف الأول (First Party Obligations)
                    </h4>
                    <div className="text-[11px] font-bold text-gray-600 leading-loose whitespace-pre-wrap pr-2">
                        {details.firstPartyObligations}
                    </div>
                </div>

                {/* Section 3: Second Party Obligations */}
                <div>
                    <h4 className="text-sm font-black text-jilco-800 mb-1.5 flex items-center gap-2 border-b border-gray-100 pb-1">
                        <Award size={14}/> إلتزامات الطرف الثاني (Second Party Obligations)
                    </h4>
                    <div className="text-[11px] font-bold text-gray-600 leading-loose whitespace-pre-wrap pr-2">
                        {details.secondPartyObligations}
                    </div>
                </div>

                {/* Section 4: Duration */}
                <div className="mt-auto bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <h4 className="text-sm font-black text-jilco-800 mb-1 flex items-center gap-2">
                        <Clock size={14}/> مدة تنفيذ الأعمال (Works Duration)
                    </h4>
                    <div className="text-xs font-bold text-gray-700 leading-relaxed">
                        {details.worksDuration}
                    </div>
                </div>

                <QuoteFooter config={config} />
            </div>
          </div>
        </div>

        {/* PAGE 5: HANDOVER AND WARRANTY PAGE */}
        <div className="a4-page bg-white shadow-2xl mb-10 print:mb-0 mx-auto flex flex-col relative">
          
          <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
          <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
          <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

          <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
            <QuoteHeader config={config} />
            
            <div className="px-10 py-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b-2 border-jilco-900 pb-4 mb-6">
                    <h3 className="text-xl font-black text-jilco-900 flex items-center gap-3 uppercase tracking-tighter">
                        <div className="w-10 h-10 bg-jilco-900 text-gold-500 flex items-center justify-center rounded-xl shadow-lg"><ShieldCheck size={20}/></div>
                        التسليم والضمان
                    </h3>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Warranty & Handover</span>
                </div>

                <div className="flex-1 text-sm leading-8 text-justify font-medium text-gray-700 whitespace-pre-wrap px-4">
                    {details.handoverAndWarranty || 'لا توجد تفاصيل إضافية.'}
                </div>

                <QuoteFooter config={config} />
            </div>
          </div>
        </div>

        {/* PAGE 6: TERMS AND CONDITIONS WITH ROYAL FRAME */}
        <div className="a4-page bg-white shadow-2xl mb-10 print:mb-0 mx-auto flex flex-col relative">
          
          <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
          <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
          <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

          <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
            <QuoteHeader config={config} />
            
            <div className="px-10 py-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b-2 border-jilco-900 pb-4 mb-6">
                    <h3 className="text-xl font-black text-jilco-900 flex items-center gap-3 uppercase tracking-tighter">
                        <div className="w-10 h-10 bg-jilco-900 text-gold-500 flex items-center justify-center rounded-xl shadow-lg"><FileText size={20}/></div>
                        الشروط والأحكام العامة
                    </h3>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Terms & Conditions</span>
                </div>

                <div className="flex-1 text-sm leading-8 text-justify font-medium text-gray-700 whitespace-pre-wrap px-4">
                    {details.termsAndConditions || 'لا توجد شروط إضافية.'}
                </div>

                {/* Bottom Warranty & Bank Box */}
                <div className="grid grid-cols-2 gap-8 mt-6 mb-2 border-t border-gray-100 pt-6">
                    <div className="bg-white border-2 border-jilco-900 rounded-2xl p-6 shadow-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-jilco-900 text-gold-500 flex items-center justify-center rounded-bl-2xl">
                            <ShieldCheck size={24}/>
                        </div>
                        <h4 className="font-black text-jilco-900 text-sm mb-5 border-b-2 border-gold-50 pb-2 uppercase">فترات الضمان المعتمدة</h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs font-black">
                                <span className="text-gray-500 uppercase tracking-tighter">ضمان الأعمال والتركيب:</span>
                                <span className="text-black bg-gray-100 px-3 py-1 rounded-lg border border-gray-200">{details.warrantyInstallation} سنوات</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-black">
                                <span className="text-gray-500 uppercase tracking-tighter">ضمان الماكينة:</span>
                                <span className="text-black bg-gray-100 px-3 py-1 rounded-lg border border-gray-200">{details.warrantyMotor} سنوات</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border-2 border-gold-500 rounded-2xl p-6 shadow-md relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-12 h-12 bg-gold-500 text-white flex items-center justify-center rounded-br-2xl">
                            <CreditCard size={24}/>
                        </div>
                        <h4 className="font-black text-gold-700 text-sm mb-5 border-b-2 border-gold-50 pb-2 text-left uppercase" dir="ltr">Bank Information</h4>
                        <div className="space-y-3" dir="ltr">
                            {config.bankAccounts && config.bankAccounts.length > 0 ? (
                                config.bankAccounts.slice(0, 2).map((bank, idx) => (
                                    <div key={idx} className="text-left bg-gold-50/50 p-2.5 rounded-xl border border-gold-100">
                                        <p className="text-[10px] font-black text-jilco-900 mb-0.5">{bank.bankName}</p>
                                        <p className="text-[12px] font-mono font-black text-black tracking-tighter">IBAN: {bank.iban}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-gray-400 italic py-4">Banking details available upon official request.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-8 pb-4">
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
                        <p className="text-xs text-gray-500 font-bold mb-2">بموجب التوقيع أدناه، يقر العميل بالموافقة على كافة المواصفات المالية والفنية والشروط المذكورة أعلاه.</p>
                        <div className="flex justify-center gap-16 mt-8">
                            <div className="text-center w-48">
                                <div className="border-b-2 border-gray-300 mb-2 h-12"></div>
                                <p className="text-[10px] font-black text-jilco-900 uppercase">توقيع العميل</p>
                            </div>
                            <div className="text-center w-48">
                                <div className="border-b-2 border-gray-300 mb-2 h-12"></div>
                                <p className="text-[10px] font-black text-jilco-900 uppercase">الختم والتصديق</p>
                            </div>
                        </div>
                    </div>
                </div>

                <QuoteFooter config={config} />
            </div>
          </div>
        </div>

        {/* PAGE 7: OPTIONAL GALLERY PAGE WITH ROYAL FRAME */}
        {details.showGallery && (
          <div className="a4-page bg-white shadow-2xl print:shadow-none mx-auto flex flex-col relative">
            <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
            <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
            <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

            <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
              <QuoteHeader config={config} />
              
              <div className="px-10 py-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between border-b-2 border-jilco-900 pb-4 mb-6">
                      <h3 className="text-xl font-black text-jilco-900 flex items-center gap-3 uppercase tracking-tighter">
                          <div className="w-10 h-10 bg-jilco-900 text-gold-500 flex items-center justify-center rounded-xl shadow-lg"><ImageIcon size={20}/></div>
                          صور توضيحية للمواصفات المختارة
                      </h3>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Product Gallery</span>
                  </div>

                  <div className="flex-1 space-y-6">
                      <div className="grid grid-cols-1 gap-6">
                          {/* Cabin Section */}
                          <div className="space-y-2">
                              <h4 className="text-sm font-black text-jilco-800 border-r-4 border-gold-500 pr-3">تشطيب الكبينة الداخلي (Cabin Design)</h4>
                              <div className="h-64 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center">
                                  {details.galleryImages?.cabin ? (
                                      <img src={details.galleryImages.cabin} className="w-full h-full object-contain" alt="Cabin Design" />
                                  ) : (
                                      <p className="text-gray-300 text-xs font-bold">لم يتم رفع صورة</p>
                                  )}
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                              {/* Buttons Section */}
                              <div className="space-y-2">
                                  <h4 className="text-sm font-black text-jilco-800 border-r-4 border-gold-500 pr-3">أزرار الطلبات (Buttons)</h4>
                                  <div className="h-64 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center">
                                      {details.galleryImages?.buttons ? (
                                          <img src={details.galleryImages.buttons} className="w-full h-full object-contain" alt="Buttons" />
                                      ) : (
                                          <p className="text-gray-300 text-xs font-bold">لم يتم رفع صورة</p>
                                      )}
                                  </div>
                              </div>

                              {/* Doors Section */}
                              <div className="space-y-2">
                                  <h4 className="text-sm font-black text-jilco-800 border-r-4 border-gold-500 pr-3">الأبواب والديكور (Doors)</h4>
                                  <div className="h-64 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center">
                                      {details.galleryImages?.doors ? (
                                          <img src={details.galleryImages.doors} className="w-full h-full object-contain" alt="Doors Design" />
                                      ) : (
                                          <p className="text-gray-300 text-xs font-bold">لم يتم رفع صورة</p>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </div>
                      <p className="text-[10px] text-gray-400 text-center font-bold mt-10">* الصور المرفقة هي صور تقريبية للمواصفات المختارة وقد تختلف قليلاً في الواقع.</p>
                  </div>

                  <QuoteFooter config={config} />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

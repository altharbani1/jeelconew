import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, Info, Printer, Settings, Zap, DollarSign, Box, Cpu, AlertTriangle, X, Save, ArrowLeft, Plus, CheckCircle2, ChevronDown, Rocket } from 'lucide-react';
import { useInventory } from '../contexts/InventoryContext';
import { useSales } from '../contexts/SalesContext';
import { QuoteDetails, QuoteItem, TechnicalSpecs } from '../types';

// --- Default Base Labor & Kit (can still be configurable) ---
interface BaseConfig {
    installationBase: number;
    installationPerStop: number;
    kitBasePrice: number; // For small minor brackets etc.
    profitMarginPercent: number;
    capacityMultipliers: Record<string, number>;
    railMetersPerStop: number;
    cableMetersPerStop: number;
    carDoorMultiplier: number;
}

const DEFAULT_BASE_CONFIG: BaseConfig = {
    installationBase: 6000,
    installationPerStop: 800,
    kitBasePrice: 2500,
    profitMarginPercent: 25,
    railMetersPerStop: 3.5,
    cableMetersPerStop: 1.5,
    carDoorMultiplier: 1.5,
    capacityMultipliers: {
        '4 Persons (320kg)': 1.0,
        '6 Persons (450kg)': 1.1,
        '8 Persons (630kg)': 1.25,
        '10 Persons (800kg)': 1.4,
        '13 Persons (1000kg)': 1.6
    }
};

export const CostCalculatorModule: React.FC = () => {
    const { supplierProducts } = useInventory();
    const { quotes, saveQuote } = useSales();

    const [config, setConfig] = useState<BaseConfig>(DEFAULT_BASE_CONFIG);
    const [showSettings, setShowSettings] = useState(false);

    // Specifications
    const [elevatorCount, setElevatorCount] = useState(1);
    const [stops, setStops] = useState(4);
    const [capacity, setCapacity] = useState('6 Persons (450kg)');

    // Selected Inventory Items IDs
    const [selectedMachineId, setSelectedMachineId] = useState<string>('');
    const [machineQty, setMachineQty] = useState<number | ''>('');

    const [selectedControlId, setSelectedControlId] = useState<string>('');
    const [controlQty, setControlQty] = useState<number | ''>('');

    const [selectedCabinId, setSelectedCabinId] = useState<string>('');
    const [cabinQty, setCabinQty] = useState<number | ''>('');

    const [selectedDoorId, setSelectedDoorId] = useState<string>('');
    const [doorQty, setDoorQty] = useState<number | ''>('');

    const [selectedRailId, setSelectedRailId] = useState<string>('');
    const [railQty, setRailQty] = useState<number | ''>('');

    const [selectedCableId, setSelectedCableId] = useState<string>('');
    const [cableQty, setCableQty] = useState<number | ''>('');

    useEffect(() => {
        // Auto-select first available items if empty to provide a baseline
        if (supplierProducts.length > 0) {
            if (!selectedMachineId) setSelectedMachineId(supplierProducts.find(p => p.name.includes('ماكينة') || p.name.includes('Machine'))?.id || supplierProducts[0]?.id || '');
            if (!selectedControlId) setSelectedControlId(supplierProducts.find(p => p.name.includes('كنترول') || p.name.includes('لوحة'))?.id || '');
            if (!selectedCabinId) setSelectedCabinId(supplierProducts.find(p => p.name.includes('كابينة') || p.name.includes('Cabin'))?.id || '');
            if (!selectedDoorId) setSelectedDoorId(supplierProducts.find(p => p.name.includes('باب') || p.name.includes('Door'))?.id || '');
            if (!selectedRailId) setSelectedRailId(supplierProducts.find(p => p.name.includes('سكك') || p.name.includes('Rail'))?.id || '');
            if (!selectedCableId) setSelectedCableId(supplierProducts.find(p => p.name.includes('كيبل') || p.name.includes('كابل'))?.id || '');
        }
    }, [supplierProducts]);

    // Calculations
    const breakdown = useMemo(() => {
        const list: any[] = [];
        const capacityMult = config.capacityMultipliers[capacity] || 1.0;

        const findPrice = (id: string) => supplierProducts.find(p => p.id === id)?.purchasePrice || 0;
        const findName = (id: string, def: string) => supplierProducts.find(p => p.id === id)?.name || def;

        // 1. Basic Kit
        list.push({
            id: 'kit', name: 'الملحقات الأساسية', category: 'material',
            unitPrice: config.kitBasePrice, qty: elevatorCount, total: config.kitBasePrice * elevatorCount
        });

        // 2. Machine
        const machinePrice = findPrice(selectedMachineId) * capacityMult;
        if (selectedMachineId) list.push({
            id: 'machine', name: `ماكينة: ${findName(selectedMachineId, '')}`, category: 'material',
            unitPrice: machinePrice, qty: elevatorCount, total: machinePrice * elevatorCount
        });

        // 3. Control
        const controlPrice = findPrice(selectedControlId);
        if (selectedControlId) list.push({
            id: 'control', name: `لوحة تحكم: ${findName(selectedControlId, '')}`, category: 'material',
            unitPrice: controlPrice, qty: elevatorCount, total: controlPrice * elevatorCount
        });

        // 4. Cabin
        const cabinPrice = findPrice(selectedCabinId) * capacityMult;
        if (selectedCabinId) list.push({
            id: 'cabin', name: `كابينة: ${findName(selectedCabinId, '')}`, category: 'material',
            unitPrice: cabinPrice, qty: elevatorCount, total: cabinPrice * elevatorCount
        });

        // 5. Doors (Stops * Landing door + 1 Car Door approx)
        const doorPrice = findPrice(selectedDoorId);
        const doorsPerElevator = (stops * doorPrice) + (doorPrice * 1.5); // 1.5 multiplier for car door mechanisms
        if (selectedDoorId) list.push({
            id: 'doors', name: `نظام الأبواب: ${findName(selectedDoorId, '')}`, category: 'material',
            unitPrice: doorsPerElevator, qty: elevatorCount, total: doorsPerElevator * elevatorCount
        });

        // 6. Rails & Cables (Quantity based on stops)
        const travelMeters = stops * 3.5;
        const railPrice = findPrice(selectedRailId);
        const railTotalUnit = travelMeters * 2 * railPrice * capacityMult;
        if (selectedRailId) list.push({
            id: 'rails', name: `سكك توجيه: ${findName(selectedRailId, '')}`, category: 'material',
            unitPrice: railTotalUnit, qty: elevatorCount, total: railTotalUnit * elevatorCount
        });

        const cablePrice = findPrice(selectedCableId);
        const cableTotalUnit = travelMeters * 1.5 * cablePrice;
        if (selectedCableId) list.push({
            id: 'cables', name: `كابلات مرنة: ${findName(selectedCableId, '')}`, category: 'material',
            unitPrice: cableTotalUnit, qty: elevatorCount, total: cableTotalUnit * elevatorCount
        });

        // 7. Labor
        const laborPerElevator = config.installationBase + (stops * config.installationPerStop);
        list.push({
            id: 'labor', name: 'أجور التركيب والتشغيل', category: 'labor',
            unitPrice: laborPerElevator, qty: elevatorCount, total: laborPerElevator * elevatorCount
        });

        return list;
    }, [elevatorCount, stops, capacity, selectedMachineId, machineQty, selectedControlId, controlQty, selectedCabinId, cabinQty, selectedDoorId, doorQty, selectedRailId, railQty, selectedCableId, cableQty, config, supplierProducts]);

    const totalCost = breakdown.reduce((sum, item) => sum + item.total, 0);
    const profitAmount = totalCost * (config.profitMarginPercent / 100);
    const totalBeforeTax = totalCost + profitAmount;
    const taxAmount = totalBeforeTax * 0.15;
    const grandTotal = totalBeforeTax + taxAmount;

    const handleGenerateQuote = async () => {
        const quoteId = `Q-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(3, '0')}`;

        // Convert breakdown to QuoteItems (adding Margin to each unit proportionally)
        const items: QuoteItem[] = breakdown.map(b => {
            // Calculate selling price by adding margin proportionally
            const sellUnitPrice = b.unitPrice * (1 + (config.profitMarginPercent / 100));
            return {
                id: b.id + Date.now().toString(),
                description: b.name,
                details: b.category === 'labor' ? 'شامل الفحص والتشغيل والتسليم.' : 'توريد حسب المواصفات والمقاييس.',
                quantity: b.qty,
                unitPrice: sellUnitPrice,
                total: sellUnitPrice * b.qty
            };
        });

        const newQuote = {
            id: quoteId,
            lastModified: new Date().toISOString(),
            details: {
                number: quoteId, date: new Date().toISOString().split('T')[0], customerName: 'عميل جديد (تم إنشاءه من الحاسبة)', customerAddress: '', projectName: '', validity: '15 يوماً', taxRate: 15, warrantyInstallation: '1', warrantyMotor: '3',
                paymentTerms: [
                    { name: 'الدفعة الأولى (عند توقيع العقد)', percentage: 40 },
                    { name: 'الدفعة الثانية (عند تركيب السكك والأبواب)', percentage: 30 },
                    { name: 'الدفعة الثالثة (قبل تركيب الكهرباء والمحرك)', percentage: 20 },
                    { name: 'الدفعة الرابعة (عند التسليم والتشغيل)', percentage: 10 }
                ],
            },
            items,
            techSpecs: { elevatorType: 'مصعد ركاب (Passenger)', capacity, stops: stops.toString(), driveType: '', controlSystem: '', powerSupply: '3 Phase, 380V', cabin: '', doors: '', machineRoom: '', rails: '', ropes: '', safety: '', emergency: '' }
        };

        const success = await saveQuote(quoteId, newQuote);
        if (success) {
            alert(`تم إنشاء عرض السعر ${quoteId} بنجاح! يمكنك الذهاب لشاشة العروض العروض مراجعته وطباعته.`);
        } else {
            alert('خطأ أثناء حفظ عرض السعر. تأكد من الاتصال.');
        }
    };

    const renderDropdown = (label: string, value: string, setValue: (s: string) => void, qtyValue: number | '', setQty: (n: number | '') => void, filterStr?: string) => {
        const filtered = filterStr ? supplierProducts.filter(p => p.name.toLowerCase().includes(filterStr.toLowerCase()) || p.partNumber?.toLowerCase().includes(filterStr.toLowerCase())) : supplierProducts;
        return (
            <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 block">{label}</label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <select title={label} value={value} onChange={e => setValue(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-jilco-500 appearance-none pr-10">
                            <option value="">-- لم يتم الاختيار --</option>
                            {filtered.map(p => <option key={p.id} value={p.id}>{p.name} - {p.purchasePrice} SR</option>)}
                        </select>
                        <ChevronDown className="absolute left-3 top-3 text-gray-400" size={16} />
                    </div>
                    <div className="w-20 shrink-0">
                        <input
                            type="number"
                            placeholder="تلقائي"
                            value={qtyValue}
                            onChange={e => setQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-jilco-500 text-center"
                            title="تحديد الكمية يدوياً (اتركه فارغ للحساب التلقائي)"
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 bg-gray-50 p-8 overflow-auto h-full animate-fade-in relative z-0">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <h1 className="text-3xl font-black text-jilco-900 flex items-center gap-3">
                            <Rocket className="text-jilco-600" size={32} />
                            محرك التسعير المتقدم
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">حاسبة السعر بناءً على تكاليف المخزون الفعلية وهامش الربح.</p>
                    </div>
                    <button onClick={() => setShowSettings(!showSettings)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50">
                        <Settings size={18} /> إعدادات التسعير
                    </button>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-jilco-200 shadow-sm animate-fade-in mb-6">
                    <h3 className="font-black text-jilco-900 mb-4 border-b pb-2">ثوابت التسعير والعمالة والمقاييس</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">هامش الربح الإجمالي (%)</label>
                            <input type="number" value={config.profitMarginPercent} onChange={e => setConfig({ ...config, profitMarginPercent: parseFloat(e.target.value) })} className="w-full p-2 border rounded-lg bg-gray-50 font-bold txt-center" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">أمتار السكك لكل دور</label>
                            <input type="number" step="0.5" value={config.railMetersPerStop} onChange={e => setConfig({ ...config, railMetersPerStop: parseFloat(e.target.value) })} className="w-full p-2 border rounded-lg bg-gray-50 font-bold" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">أمتار الكابلات لكل دور</label>
                            <input type="number" step="0.5" value={config.cableMetersPerStop} onChange={e => setConfig({ ...config, cableMetersPerStop: parseFloat(e.target.value) })} className="w-full p-2 border rounded-lg bg-gray-50 font-bold" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">مُعامل أبواب الكابينة الداخلية</label>
                            <input type="number" step="0.5" value={config.carDoorMultiplier} onChange={e => setConfig({ ...config, carDoorMultiplier: parseFloat(e.target.value) })} className="w-full p-2 border rounded-lg bg-gray-50 font-bold" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">أجور التركيب الأساسية</label>
                            <input type="number" value={config.installationBase} onChange={e => setConfig({ ...config, installationBase: parseFloat(e.target.value) })} className="w-full p-2 border rounded-lg bg-gray-50 font-bold" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">إضافة عمالة لكل دور</label>
                            <input type="number" value={config.installationPerStop} onChange={e => setConfig({ ...config, installationPerStop: parseFloat(e.target.value) })} className="w-full p-2 border rounded-lg bg-gray-50 font-bold" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">مقطوعية ملحقات أساسية</label>
                            <input type="number" value={config.kitBasePrice} onChange={e => setConfig({ ...config, kitBasePrice: parseFloat(e.target.value) })} className="w-full p-2 border rounded-lg bg-gray-50 font-bold" />
                        </div>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT: Inputs & Components */}
                    <div className="lg:col-span-7 space-y-6">

                        {/* Project Scope */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
                            <h3 className="font-black text-sm text-gray-800 mb-4 flex items-center gap-2"><Box size={18} className="text-jilco-600" /> حجم ونوع المشروع</h3>
                            <div className="grid grid-cols-3 gap-6">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-2 block">عدد المصاعد</label>
                                    <div className="flex border border-gray-200 rounded-xl overflow-hidden h-11">
                                        <button onClick={() => setElevatorCount(Math.max(1, elevatorCount - 1))} className="px-4 bg-gray-50 hover:bg-gray-100 font-bold">-</button>
                                        <div className="flex-1 flex items-center justify-center font-black text-lg bg-white">{elevatorCount}</div>
                                        <button onClick={() => setElevatorCount(elevatorCount + 1)} className="px-4 bg-gray-50 hover:bg-gray-100 font-bold">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-2 block">الوقفات ({stops})</label>
                                    <input type="range" min="2" max="30" value={stops} onChange={e => setStops(parseInt(e.target.value))} className="w-full h-2 mt-4 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-jilco-600" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-2 block">الحمولة / عدد الأشخاص</label>
                                    <select title="Capacity" value={capacity} onChange={e => setCapacity(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold bg-white outline-none">
                                        {Object.keys(config.capacityMultipliers).map(k => <option key={k} value={k}>{k}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-black text-sm text-gray-800 flex items-center gap-2"><Cpu size={18} className="text-jilco-600" /> اختيار وحساب المكونات المادية</h3>
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded font-bold">يمكنك تحديد الكمية يدوياً أو تركها فارغة للحساب الآلي</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                {renderDropdown('ماكينة الجر (Machine)', selectedMachineId, setSelectedMachineId, machineQty, setMachineQty)}
                                {renderDropdown('نظام التحكم (Control)', selectedControlId, setSelectedControlId, controlQty, setControlQty)}
                                {renderDropdown('نظام الأبواب (Doors)', selectedDoorId, setSelectedDoorId, doorQty, setDoorQty)}
                                {renderDropdown('الكابينة (Cabin)', selectedCabinId, setSelectedCabinId, cabinQty, setCabinQty)}
                                {renderDropdown('السكك (Rails)', selectedRailId, setSelectedRailId, railQty, setRailQty)}
                                {renderDropdown('الكابلات (Cables)', selectedCableId, setSelectedCableId, cableQty, setCableQty)}
                            </div>
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2 text-blue-800 text-xs font-bold">
                                <Info size={16} className="shrink-0 mt-0.5" />
                                <p>يتم ضرب السعر الأساسي للقطعة في معاملات بناءً على عدد الأدوار والمصاعد والحمولة إن لم يتم تحديد كمية يدوية.</p>
                            </div>
                        </div>

                    </div>

                    {/* RIGHT: Cost Breakdown & Output */}
                    <div className="lg:col-span-5 flex flex-col space-y-6">

                        {/* Dashboard Results Ribbon */}
                        <div className="bg-jilco-900 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                            <p className="text-gold-400 font-bold text-xs mb-2 uppercase tracking-widest text-center">الإجمالي الشامل المتوقع</p>
                            <h2 className="text-5xl font-black font-mono tracking-tighter text-center mb-6">{grandTotal.toLocaleString()} SAR</h2>

                            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10 grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-[10px] text-gray-400 block mb-1">التكلفة الفعلية (مواد وعمالة)</span>
                                    <span className="font-mono text-lg font-bold">{totalCost.toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-green-300 block mb-1">الربح المستهدف ({config.profitMarginPercent}%)</span>
                                    <span className="font-mono text-lg font-bold text-green-400">{profitAmount.toLocaleString()}</span>
                                </div>
                                <div className="col-span-2 pt-2 border-t border-white/10">
                                    <span className="text-[10px] text-gray-400 block mb-1">الضريبة المضافة (15%)</span>
                                    <span className="font-mono text-lg font-bold text-gold-400">{taxAmount.toLocaleString()}</span>
                                </div>
                            </div>

                            <button onClick={handleGenerateQuote} className="mt-6 w-full py-4 bg-gold-500 hover:bg-gold-600 text-jilco-900 font-black rounded-xl text-lg shadow-lg flex items-center justify-center gap-2 transition-all">
                                <CheckCircle2 size={24} /> اعتماد وتحويل لعرض سعر
                            </button>
                        </div>

                        {/* Detailed Breakdown List */}
                        <div className="bg-white border border-gray-200 rounded-3xl flex-1 p-6 shadow-sm overflow-hidden flex flex-col">
                            <h3 className="font-black text-sm text-gray-800 mb-4 pb-2 border-b border-gray-100 flex justify-between items-center">
                                <span>تفاصيل التكلفة المحسوبة</span>
                                <span className="text-xs font-bold text-jilco-600 bg-jilco-50 px-2 py-1 rounded">التسعير بالحد الأدنى</span>
                            </h3>
                            <div className="flex-1 overflow-auto pr-2 space-y-3">
                                {breakdown.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-gray-900 truncate pr-2 w-48">{item.name}</p>
                                            <p className="text-[10px] text-gray-500 mt-1">الكمية المقدرة: <span className="font-mono bg-white px-1.5 py-0.5 border rounded text-jilco-600">{item.qty}</span> {item.category === 'labor' ? 'مقطوعية' : 'وحدة'}</p>
                                        </div>
                                        <div className="text-left font-mono">
                                            <p className="text-sm font-black text-jilco-700">{item.total.toLocaleString()}</p>
                                            <p className="text-[9px] text-gray-400">سعر الوحدة: {item.unitPrice.toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
};

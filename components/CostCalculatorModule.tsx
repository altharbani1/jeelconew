import React, { useState, useMemo } from 'react';
import { Calculator, Info, Printer, Settings, Zap, DollarSign, Box, Cpu, AlertTriangle, X, Save, ArrowLeft, Plus, CheckCircle2, ChevronDown, Rocket, Trash2, Edit3, ShoppingCart } from 'lucide-react';
import { useInventory } from '../contexts/InventoryContext';
import { useSales } from '../contexts/SalesContext';
import { QuoteItem } from '../types';

interface CalculatorItem {
    id: string;
    name: string;
    category: 'material' | 'labor' | 'other';
    unitPrice: number;
    qty: number;
}

export const CostCalculatorModule: React.FC = () => {
    const { supplierProducts } = useInventory();
    const { quotes, saveQuote } = useSales();

    // Settings & Global
    const [profitMarginPercent, setProfitMarginPercent] = useState<number>(25);

    // Quote Metadata Setup
    const [elevatorCount, setElevatorCount] = useState(1);
    const [stops, setStops] = useState(4);
    const [capacity, setCapacity] = useState('6 Persons (450kg)');

    // Dynamic Builder State
    const [items, setItems] = useState<CalculatorItem[]>([]);

    // Item Addition Modals
    const [showInventorySelector, setShowInventorySelector] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // --- Calculations ---
    const totalCost = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
    const profitAmount = totalCost * (profitMarginPercent / 100);
    const totalBeforeTax = totalCost + profitAmount;
    const taxAmount = totalBeforeTax * 0.15;
    const grandTotal = totalBeforeTax + taxAmount;

    // --- Handlers ---
    const handleAddCustomItem = (category: 'material' | 'labor' | 'other' = 'material') => {
        const newItem: CalculatorItem = {
            id: `custom_${Date.now()}`,
            name: category === 'labor' ? 'أجور تركيب' : 'بند مخصص',
            category,
            unitPrice: 0,
            qty: 1
        };
        setItems([...items, newItem]);
    };

    const handleAddFromInventory = (product: any) => {
        const newItem: CalculatorItem = {
            id: `inv_${product.id}_${Date.now()}`,
            name: product.name,
            category: 'material',
            unitPrice: product.purchasePrice || 0,
            qty: 1
        };
        setItems([...items, newItem]);
        setShowInventorySelector(false);
        setSearchQuery('');
    };

    const updateItem = (id: string, field: keyof CalculatorItem, value: any) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleGenerateQuote = async () => {
        if (items.length === 0) {
            alert('الرجاء إضافة بنود للتسعيرة أولاً.');
            return;
        }

        const quoteId = `Q-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(3, '0')}`;

        // Convert calculation items to QuoteItems (adding Margin to each unit proportionally)
        const quoteItems: QuoteItem[] = items.map(item => {
            // Calculate selling price by adding margin proportionally
            const sellUnitPrice = item.unitPrice * (1 + (profitMarginPercent / 100));
            return {
                id: item.id + Date.now().toString(),
                description: item.name,
                details: item.category === 'labor' ? 'شامل الفحص والتشغيل والتسليم.' : 'توريد حسب المواصفات والمقاييس.',
                quantity: item.qty,
                unitPrice: sellUnitPrice,
                total: sellUnitPrice * item.qty
            };
        });

        const newQuote = {
            id: quoteId,
            lastModified: new Date().toISOString(),
            details: {
                number: quoteId, date: new Date().toISOString().split('T')[0], customerName: 'عميل جديد (تكوين يدوي)', customerAddress: '', projectName: '', validity: '15 يوماً', taxRate: 15, warrantyInstallation: '1', warrantyMotor: '3',
                paymentTerms: [
                    { name: 'الدفعة الأولى (عند توقيع العقد)', percentage: 40 },
                    { name: 'الدفعة الثانية (عند تركيب السكك والأبواب)', percentage: 30 },
                    { name: 'الدفعة الثالثة (قبل تركيب الكهرباء والمحرك)', percentage: 20 },
                    { name: 'الدفعة الرابعة (عند التسليم والتشغيل)', percentage: 10 }
                ],
            },
            items: quoteItems,
            techSpecs: { elevatorType: 'مصعد ركاب (Passenger)', capacity, stops: stops.toString(), driveType: '', controlSystem: '', powerSupply: '3 Phase, 380V', cabin: '', doors: '', externalDoors: '', machineRoom: '', rails: '', ropes: '', safety: '', emergency: '' }
        };

        const success = await saveQuote(quoteId, newQuote);
        if (success) {
            alert(`تم إنشاء عرض السعر ${quoteId} بنجاح! يمكنك الذهاب لشاشة العروض العروض مراجعته وطباعته.`);
        } else {
            alert('خطأ أثناء حفظ عرض السعر. تأكد من الاتصال.');
        }
    };

    const filteredInventory = supplierProducts.filter(p => p.name.includes(searchQuery) || (p.partNumber && p.partNumber.includes(searchQuery)));

    return (
        <div className="flex-1 bg-gray-50 p-8 overflow-auto h-full animate-fade-in relative z-0">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <h1 className="text-3xl font-black text-jilco-900 flex items-center gap-3">
                            <Calculator className="text-jilco-600" size={32} />
                            بناء وتسعير العروض (الوضع اليدوي)
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">تكوين التكلفة باندراج البنود يدوياً من المخزون أو إضافات مخصصة مع تحكم كامل بالأسعار والكميات.</p>
                    </div>
                </div>

                {/* Top: Metadata for Quote Generation Only */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
                    <h3 className="font-black text-sm text-gray-800 mb-4 flex items-center gap-2">
                        <Info size={18} className="text-jilco-600" /> المواصفات المرجعية (ستظهر في عرض السعر فقط ولن تؤثر على الحسابات)
                    </h3>
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
                            <label className="text-xs font-bold text-gray-500 mb-2 block">الوقفات</label>
                            <input type="number" title="Stops" placeholder="عدد الوقفات" min="2" value={stops} onChange={e => setStops(parseInt(e.target.value) || 2)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-jilco-500 text-center text-lg" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-2 block">الحمولة / عدد الأشخاص</label>
                            <select title="Capacity" value={capacity} onChange={e => setCapacity(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold bg-white outline-none">
                                <option value="4 Persons (320kg)">4 أشخاص (320 كجم)</option>
                                <option value="6 Persons (450kg)">6 أشخاص (450 كجم)</option>
                                <option value="8 Persons (630kg)">8 أشخاص (630 كجم)</option>
                                <option value="10 Persons (800kg)">10 أشخاص (800 كجم)</option>
                                <option value="13 Persons (1000kg)">13 شخص (1000 كجم)</option>
                                <option value="Other">حمولة مخصصة (بضائع/مستشفيات)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Main Interface */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT: Dynamic Builder */}
                    <div className="lg:col-span-8 flex flex-col space-y-4">

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 flex flex-col">
                            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                                <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
                                    <Box size={20} className="text-jilco-600" /> بنود التكلفة (مواد وعمالة)
                                </h3>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowInventorySelector(true)} className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold flex items-center gap-1.5 text-sm transition-colors">
                                        <ShoppingCart size={16} /> إدراج من المخزون
                                    </button>
                                    <button onClick={() => handleAddCustomItem('material')} className="px-3 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-xl font-bold flex items-center gap-1.5 text-sm border border-gray-200 transition-colors">
                                        <Plus size={16} /> بند مواد مخصص
                                    </button>
                                    <button onClick={() => handleAddCustomItem('labor')} className="px-3 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-xl font-bold flex items-center gap-1.5 text-sm border border-gray-200 transition-colors">
                                        <Plus size={16} /> بند عمالة أو أخرى
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-x-auto min-h-[400px]">
                                {items.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                                        <Calculator size={48} className="mb-4 opacity-20" />
                                        <p className="font-bold">لا توجد بنود حالياً. ابدأ بإضافة البنود لحساب التكلفة.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-right">
                                        <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3 font-black rounded-tr-xl">اسم البند أو المادة</th>
                                                <th className="p-3 font-black text-center w-24">النوع</th>
                                                <th className="p-3 font-black text-center w-32">سعر التكلفة (SR)</th>
                                                <th className="p-3 font-black text-center w-24">الكمية</th>
                                                <th className="p-3 font-black text-center w-32">الإجمالي (SR)</th>
                                                <th className="p-3 font-black text-center w-12 rounded-tl-xl"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {items.map(item => (
                                                <tr key={item.id} className="hover:bg-blue-50/20 group">
                                                    <td className="p-2">
                                                        <input
                                                            type="text"
                                                            value={item.name}
                                                            onChange={e => updateItem(item.id, 'name', e.target.value)}
                                                            className="w-full p-2 bg-transparent border-b border-transparent focus:border-jilco-500 hover:bg-white text-sm font-bold text-gray-900 outline-none transition-all"
                                                            placeholder="وصف البند..."
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <select
                                                            title="Category"
                                                            value={item.category}
                                                            onChange={e => updateItem(item.id, 'category', e.target.value)}
                                                            className="w-full p-2 bg-transparent border-b border-transparent focus:border-jilco-500 text-xs font-bold text-gray-600 outline-none cursor-pointer"
                                                        >
                                                            <option value="material">مادة</option>
                                                            <option value="labor">أجور</option>
                                                            <option value="other">أخرى</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-2">
                                                        <input
                                                            type="number"
                                                            title="Unit Price"
                                                            placeholder="السعر"
                                                            value={item.unitPrice || ''}
                                                            onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                            className="w-full p-2 bg-transparent border-b border-transparent focus:border-jilco-500 hover:bg-white text-sm font-mono font-bold text-center text-gray-900 outline-none transition-all"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <input
                                                            type="number"
                                                            title="Quantity"
                                                            placeholder="الكمية"
                                                            value={item.qty || ''}
                                                            onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                                                            className="w-full p-2 bg-transparent border-b border-transparent focus:border-jilco-500 hover:bg-white text-sm font-mono font-black text-center text-jilco-700 outline-none transition-all"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-center text-sm font-mono font-black text-jilco-900 bg-gray-50/50 rounded-lg">
                                                        {(item.unitPrice * item.qty).toLocaleString()}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <button title="Remove Item" onClick={() => removeItem(item.id)} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            {/* Add Button Inside Table Area */}
                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center pb-2">
                                <button onClick={() => setShowInventorySelector(true)} className="px-6 py-2.5 bg-jilco-50 hover:bg-jilco-100 text-jilco-700 font-bold rounded-full flex items-center gap-2 text-sm transition-all border border-jilco-200 shadow-sm">
                                    <Plus size={18} /> إضافة بند جديد للتسعيرة
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* RIGHT: Cost Breakdown & Output */}
                    <div className="lg:col-span-4 flex flex-col space-y-6">

                        {/* Margin Controls */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
                            <h3 className="font-black text-sm text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                                <DollarSign size={18} className="text-jilco-600" /> إعدادات الربح
                            </h3>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-gray-500 block">هامش الربح الإجمالي (%)</label>
                                    <span className="font-mono font-black bg-jilco-100 text-jilco-800 px-2 py-0.5 rounded text-sm">{profitMarginPercent}%</span>
                                </div>
                                <input title="Profit Margin" placeholder="هامش الربح" type="range" min="0" max="100" value={profitMarginPercent} onChange={e => setProfitMarginPercent(parseInt(e.target.value))} className="w-full h-2.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-jilco-600" />
                                <p className="text-[10px] text-gray-400 mt-3 flex gap-1"><Info size={12} /> سيتم تطبيق هذا الهامش على إجمالي التكلفة الفعلية عند استخراج العرض النهائي.</p>
                            </div>
                        </div>

                        {/* Dashboard Results Ribbon */}
                        <div className="bg-jilco-900 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden flex-1 flex flex-col justify-between">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                            <div>
                                <p className="text-gold-400 font-bold text-xs mb-2 uppercase tracking-widest text-center">المقترح للإجمالي الشامل</p>
                                <h2 className="text-4xl font-black font-mono tracking-tighter text-center mb-8">{grandTotal.toLocaleString()} SR</h2>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                        <span className="text-[11px] text-gray-400 font-bold">إجمالي التكلفة الفعلية</span>
                                        <span className="font-mono text-base font-bold text-white">{totalCost.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                        <span className="text-[11px] text-green-300 font-bold">قيمة الربح المستهدف</span>
                                        <span className="font-mono text-base font-bold text-green-400">+{profitAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2">
                                        <span className="text-[11px] text-gray-400 font-bold">ضريبة القيمة المضافة (15%)</span>
                                        <span className="font-mono text-base font-bold text-gold-400">+{taxAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleGenerateQuote} disabled={items.length === 0} className={`mt-8 w-full py-4 font-black rounded-xl text-lg shadow-lg flex items-center justify-center gap-2 transition-all ${items.length > 0 ? 'bg-gold-500 hover:bg-gold-600 text-jilco-900' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}>
                                <CheckCircle2 size={24} /> اعتماد وتحويل لعرض سعر
                            </button>
                        </div>

                    </div>
                </div>

            </div>

            {/* Inventory Item Selector Modal */}
            {showInventorySelector && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-xl font-black text-jilco-900 flex items-center gap-2">
                                <ShoppingCart className="text-jilco-600" />
                                إدراج صنف من المخزون
                            </h2>
                            <button title="إغلاق" onClick={() => setShowInventorySelector(false)} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-white rounded-xl">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-4 border-b border-gray-100 bg-white">
                            <input
                                type="text"
                                placeholder="ابحث بالاسم أو رقم القطعة..."
                                className="w-full p-3 bg-gray-50 border border-gray-200 outline-none focus:ring-2 focus:ring-jilco-500 rounded-xl text-sm font-bold"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="overflow-auto flex-1 bg-gray-50">
                            {filteredInventory.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 font-bold">لا يوجد أصناف في المخزون مطابقة لبحثك.</div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {filteredInventory.map(product => (
                                        <div key={product.id} className="flex justify-between items-center p-4 hover:bg-white transition-colors group cursor-pointer" onClick={() => handleAddFromInventory(product)}>
                                            <div>
                                                <p className="font-black text-gray-900 text-sm">{product.name}</p>
                                                <p className="text-[10px] text-gray-500 mt-1 font-mono">P/N: {product.partNumber || '-'} | الرصيد الحالي: {product.currentQuantity || 0}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <p className="font-mono text-jilco-700 font-black text-sm bg-jilco-50 px-3 py-1.5 rounded-lg border border-jilco-100">
                                                    {product.purchasePrice.toLocaleString()} SR
                                                </p>
                                                <button className="text-xs font-bold bg-white border border-gray-200 px-4 py-2 rounded-lg group-hover:bg-jilco-600 group-hover:text-white group-hover:border-jilco-600 transition-all shadow-sm">
                                                    اختيار
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

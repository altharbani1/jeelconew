import React, { useState } from 'react';
import { useData } from '../contexts/DataContext.tsx';
import { Package, Search, ArrowUpRight, ArrowDownRight, AlertTriangle, Plus, Minus, History } from 'lucide-react';
import { InventoryTransaction, SupplierProduct } from '../types.ts';

export const InventoryModule: React.FC = () => {
    const { supplierProducts, inventoryTransactions, saveRecord, deleteRecordLocallyAndCloud, currentUser } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'stock' | 'transactions'>('stock');

    // Filter products
    const filteredProducts = supplierProducts.filter(p => p.name.includes(searchTerm) || (p.partNumber && p.partNumber.includes(searchTerm)));

    // Calculate low stock metrics
    const lowStockItems = supplierProducts.filter(p => (p.currentQuantity || 0) <= 5);

    // Manual Stock Adjustment UI State
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [adjustProduct, setAdjustProduct] = useState<SupplierProduct | null>(null);
    const [adjustType, setAdjustType] = useState<'in' | 'out'>('in');
    const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
    const [adjustNotes, setAdjustNotes] = useState('');

    const handleAdjustStock = async () => {
        if (!adjustProduct || adjustQuantity <= 0) return;

        const transaction: InventoryTransaction = {
            id: `INV-TRX-${Date.now()}`,
            productId: adjustProduct.id,
            productName: adjustProduct.name,
            date: new Date().toISOString().split('T')[0],
            type: adjustType,
            quantity: adjustQuantity,
            referenceSource: 'manual',
            notes: adjustNotes || 'تعديل يدوي للمخزون'
        };

        // Update Product Quantity
        const newQuantity = adjustType === 'in'
            ? (adjustProduct.currentQuantity || 0) + adjustQuantity
            : Math.max(0, (adjustProduct.currentQuantity || 0) - adjustQuantity);

        const updatedProduct = { ...adjustProduct, currentQuantity: newQuantity };

        // Save
        await saveRecord('jilco_inventory_transactions', transaction.id, transaction);
        await saveRecord('jilco_supplier_products', updatedProduct.id, updatedProduct);

        setIsAdjusting(false);
        setAdjustProduct(null);
        setAdjustQuantity(0);
        setAdjustNotes('');
    };

    return (
        <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in relative z-0 pl-32">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-jilco-900 flex items-center gap-3">
                            <Package className="text-jilco-600" size={32} />
                            إدارة المخزون
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">تتبع مستويات المخزون، صرف المواد للمشاريع، وتنظيم المستودع.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-gray-500 mb-1">إجمالي الأصناف</p>
                            <h3 className="text-3xl font-black text-jilco-900">{supplierProducts.length}</h3>
                        </div>
                        <div className="bg-blue-50 text-blue-600 p-4 rounded-xl">
                            <Package size={24} />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-gray-500 mb-1">إجمالي الحركات (إدخال وإخراج)</p>
                            <h3 className="text-3xl font-black text-jilco-900">{inventoryTransactions.length}</h3>
                        </div>
                        <div className="bg-purple-50 text-purple-600 p-4 rounded-xl">
                            <History size={24} />
                        </div>
                    </div>
                    <div className="bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm flex items-center justify-between md:col-span-2">
                        <div>
                            <p className="text-sm font-bold text-red-700 mb-1">أصناف قاربت على النفاذ (أقل من 5)</p>
                            <div className="flex items-center gap-2">
                                <h3 className="text-3xl font-black text-red-900">{lowStockItems.length}</h3>
                                <span className="text-xs font-bold bg-white text-red-600 px-2 py-1 rounded">صنف يحتاج لإعادة طلب</span>
                            </div>
                        </div>
                        <div className="bg-red-100 text-red-600 p-4 rounded-xl">
                            <AlertTriangle size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                    <div className="border-b border-gray-100 flex items-center p-2 bg-gray-50/50">
                        <button onClick={() => setActiveTab('stock')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-colors ${activeTab === 'stock' ? 'bg-white text-jilco-900 shadow-sm' : 'text-gray-500 hover:text-jilco-700'}`}>
                            <Package size={18} /> المستودع (الأرصدة)
                        </button>
                        <button onClick={() => setActiveTab('transactions')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-colors ${activeTab === 'transactions' ? 'bg-white text-jilco-900 shadow-sm' : 'text-gray-500 hover:text-jilco-700'}`}>
                            <History size={18} /> سجل الحركات
                        </button>
                    </div>

                    <div className="p-4 border-b border-gray-100 bg-white">
                        <div className="relative max-w-md">
                            <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                            <input type="text" placeholder="ابحث عن صنف بالاسم أو رقم القطعة..." className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-jilco-500 outline-none font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto bg-gray-50/20">
                        {activeTab === 'stock' ? (
                            <table className="w-full text-right text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 font-black">الصنف</th>
                                        <th className="p-4 font-black">رقم القطعة (P/N)</th>
                                        <th className="p-4 font-black text-center">الوحدة</th>
                                        <th className="p-4 font-black text-center">الرصيد الحالي</th>
                                        <th className="p-4 font-black text-center">تعديل يدوي</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {filteredProducts.map(product => (
                                        <tr key={product.id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="p-4 font-bold text-jilco-900">{product.name}</td>
                                            <td className="p-4 font-mono text-gray-500">{product.partNumber || '-'}</td>
                                            <td className="p-4 text-center text-gray-400 font-bold">{product.unit || 'حبة'}</td>
                                            <td className="p-4 text-center">
                                                <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg font-black text-sm ${(product.currentQuantity || 0) <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {product.currentQuantity || 0}
                                                </span>
                                            </td>
                                            <td className="p-4 flex justify-center gap-2">
                                                <button onClick={() => { setIsAdjusting(true); setAdjustType('in'); setAdjustProduct(product); }} title="إضافة رصيد (تسوية)" className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors"><Plus size={16} /></button>
                                                <button onClick={() => { setIsAdjusting(true); setAdjustType('out'); setAdjustProduct(product); }} title="سحب رصيد (تسوية)" className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 transition-colors"><Minus size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-gray-400 font-bold">لا توجد أصناف تطابق البحث. قم بإضافة أصناف من شاشة (المشتريات إلى المنتجات).</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-right text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 font-black">الصنف</th>
                                        <th className="p-4 font-black">التاريخ</th>
                                        <th className="p-4 font-black">الحركة</th>
                                        <th className="p-4 font-black text-center">الكمية</th>
                                        <th className="p-4 font-black">المصدر / الملاحظات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {inventoryTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).filter(t => t.productName.includes(searchTerm)).map(trx => (
                                        <tr key={trx.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-bold text-jilco-900">{trx.productName}</td>
                                            <td className="p-4 font-mono text-gray-500 text-xs">{trx.date}</td>
                                            <td className="p-4">
                                                {trx.type === 'in' ? (
                                                    <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit text-xs font-black">
                                                        <ArrowDownRight size={14} /> إدخال (مشتريات/تسوية)
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-1 rounded w-fit text-xs font-black">
                                                        <ArrowUpRight size={14} /> صرف (استهلاك/مشروع)
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center font-black font-mono">
                                                {trx.type === 'in' ? '+' : '-'}{trx.quantity}
                                            </td>
                                            <td className="p-4">
                                                <p className="font-bold text-gray-800">{trx.referenceSource === 'purchase' ? 'فاتورة مشتريات' : trx.referenceSource === 'project' ? 'صرف لمشروع' : 'تعديل يدوي'}</p>
                                                <p className="text-[10px] text-gray-400">{trx.referenceName || trx.referenceId || trx.notes}</p>
                                            </td>
                                        </tr>
                                    ))}
                                    {inventoryTransactions.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-gray-400 font-bold">لا توجد حركات مخزنية مسجلة.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Adjust Stock Modal */}
            {isAdjusting && adjustProduct && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 transform transition-all">
                        <div className={`p-6 text-white ${adjustType === 'in' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                            <h2 className="text-xl font-black flex items-center gap-2">
                                {adjustType === 'in' ? <Plus size={24} /> : <Minus size={24} />}
                                {adjustType === 'in' ? 'إضافة رصيد (إدخال تسوية)' : 'سحب رصيد (صرف تسوية)'}
                            </h2>
                            <p className="text-sm font-medium mt-1 opacity-80">الصنف: {adjustProduct.name}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center border border-gray-100">
                                <span className="text-sm font-bold text-gray-500">الرصيد الحالي:</span>
                                <span className="font-black text-xl text-jilco-900">{adjustProduct.currentQuantity || 0}</span>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">الكمية المراد {adjustType === 'in' ? 'إضافتها' : 'سحبها'}</label>
                                <input type="number" min="1" value={adjustQuantity || ''} onChange={e => setAdjustQuantity(parseFloat(e.target.value) || 0)} className="w-full p-4 bg-gray-50 border-gray-200 rounded-xl font-black text-xl text-center focus:ring-2 focus:ring-jilco-500 outline-none" autoFocus />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">السبب / الملاحظات (اختياري)</label>
                                <input type="text" placeholder="مثال: تلف، جرد، تسوية..." value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} className="w-full p-3 bg-gray-50 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-jilco-500 outline-none" />
                            </div>

                            {adjustQuantity > 0 && (
                                <div className="text-center pt-2">
                                    <p className="text-xs font-bold text-gray-500">الرصيد بعد العملية سيكون:</p>
                                    <p className={`font-black text-2xl ${adjustType === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {adjustType === 'in' ? (adjustProduct.currentQuantity || 0) + adjustQuantity : Math.max(0, (adjustProduct.currentQuantity || 0) - adjustQuantity)}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button onClick={() => setIsAdjusting(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                                <button onClick={handleAdjustStock} className={`flex-1 px-4 py-3 text-white font-black rounded-xl transition-colors ${adjustType === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                                    تأكيد العملية
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

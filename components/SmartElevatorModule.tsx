
import React, { useState, useEffect } from 'react';
import { QrCode, Plus, Search, Edit, Trash2, Printer, Smartphone, Calendar, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { SmartElevator, Project } from '../types';
import { useData } from '../contexts/DataContext.tsx';

// Using QR Server API for generation
const generateQRUrl = (data: string) => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;

export const SmartElevatorModule: React.FC = () => {
    const { elevators, projects, saveRecord, deleteRecordLocallyAndCloud } = useData();

    const [viewMode, setViewMode] = useState<'list' | 'qr_view' | 'simulation'>('list');
    const [currentElevator, setCurrentElevator] = useState<SmartElevator | null>(null);

    // Forms
    const [showAddModal, setShowAddModal] = useState(false);
    const [newElevator, setNewElevator] = useState<Partial<SmartElevator>>({
        status: 'active',
        installationDate: new Date().toISOString().split('T')[0]
    });



    const handleAddElevator = async () => {
        if (!newElevator.projectName) return;

        const id = `EV-${Date.now()}`;
        const elevatorData: SmartElevator = {
            ...newElevator as SmartElevator,
            id,
            qrCodeId: `https://jilco-elevators.com/track/${id}`, // Simulated URL
            nextMaintenance: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
        };

        await saveRecord('jilco_smart_elevators', elevatorData.id, elevatorData);
        setShowAddModal(false);
        setNewElevator({ status: 'active', installationDate: new Date().toISOString().split('T')[0] });
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('حذف هذا المصعد؟')) {
            await deleteRecordLocallyAndCloud('jilco_smart_elevators', id);
        }
    };

    // --- Views ---

    const renderSimulation = () => {
        if (!currentElevator) return null;
        return (
            <div className="flex-1 bg-gray-900 flex justify-center items-center p-4 animate-fade-in">
                <div className="w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl border-8 border-gray-800 relative h-[800px] flex flex-col">
                    {/* Phone Notch */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl z-20"></div>

                    {/* Mobile App Header */}
                    <div className="bg-jilco-900 text-white p-6 pt-10 text-center">
                        <h3 className="font-bold text-lg">جيلكو للمصاعد</h3>
                        <p className="text-xs opacity-70">المصعد الذكي</p>
                    </div>

                    {/* Mobile App Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4 text-center">
                            <div className={`inline-block p-2 rounded-full mb-2 ${currentElevator.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {currentElevator.status === 'active' ? <CheckCircle2 size={32} /> : <AlertTriangle size={32} />}
                            </div>
                            <h2 className="font-bold text-xl text-gray-800">{currentElevator.projectName}</h2>
                            <p className="text-sm text-gray-500">{currentElevator.location}</p>
                            <div className="mt-2 inline-block px-3 py-1 bg-gray-100 rounded text-xs font-mono">{currentElevator.id}</div>
                        </div>

                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4 space-y-3">
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500">آخر صيانة</span>
                                <span className="font-bold text-gray-800">{currentElevator.lastMaintenance || 'جديد'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500">الصيانة القادمة</span>
                                <span className="font-bold text-green-600">{currentElevator.nextMaintenance}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">الضمان ينتهي</span>
                                <span className="font-bold text-gray-800">{currentElevator.warrantyEndDate || '-'}</span>
                            </div>
                        </div>

                        <button className="w-full bg-red-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-200 mb-3 active:scale-95 transition-transform">
                            طلب صيانة طارئة 🚨
                        </button>
                        <button className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold shadow-sm active:scale-95 transition-transform">
                            تحديث سجل الصيانة
                        </button>
                    </div>

                    {/* Close Simulation Button */}
                    <button onClick={() => setViewMode('list')} className="absolute top-4 right-4 bg-white/20 p-2 rounded-full text-white z-30">
                        <X size={20} />
                    </button>
                </div>
            </div>
        );
    };

    const renderQRView = () => {
        if (!currentElevator) return null;
        const qrUrl = generateQRUrl(currentElevator.qrCodeId);

        return (
            <div className="flex-1 bg-gray-100 flex flex-col justify-center items-center p-8 animate-fade-in">
                <div className="bg-white p-12 rounded-3xl shadow-2xl text-center max-w-md w-full border border-gray-200 relative print:shadow-none print:w-full print:max-w-none print:border-none">
                    <button onClick={() => setViewMode('list')} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full print:hidden"><X /></button>

                    <h2 className="text-2xl font-black text-jilco-900 mb-2">جيلكو للمصاعد</h2>
                    <p className="text-sm text-gray-500 mb-8">امسح الكود لطلب الصيانة أو عرض السجل</p>

                    <div className="border-4 border-jilco-900 p-4 rounded-xl inline-block mb-6 relative">
                        <div className="absolute -inset-1 border-2 border-dashed border-gold-500 rounded-xl pointer-events-none"></div>
                        <img src={qrUrl} alt="Elevator QR" className="w-64 h-64 object-contain" />
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl text-sm font-bold text-gray-700">
                        <p className="mb-1">{currentElevator.projectName}</p>
                        <p className="font-mono text-jilco-600">{currentElevator.id}</p>
                    </div>

                    <button onClick={() => window.print()} className="mt-8 bg-jilco-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-jilco-800 print:hidden flex items-center justify-center gap-2 w-full">
                        <Printer size={18} /> طباعة الملصق
                    </button>
                </div>
            </div>
        );
    };

    if (viewMode === 'list') {
        return (
            <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                                <QrCode className="text-gold-500" /> المصعد الذكي (QR System)
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">توليد رموز QR للمصاعد لتسهيل الصيانة والمتابعة</p>
                        </div>
                        <button onClick={() => setShowAddModal(true)} className="bg-jilco-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md">
                            <Plus size={20} /> إضافة مصعد
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {elevators.map(elev => (
                            <div key={elev.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all relative group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-jilco-50 p-3 rounded-xl text-jilco-700 font-bold font-mono text-xs border border-jilco-100">
                                        {elev.id}
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs font-bold ${elev.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {elev.status === 'active' ? 'نشط' : 'متوقف'}
                                    </div>
                                </div>

                                <h3 className="font-bold text-gray-800 text-lg mb-1">{elev.projectName}</h3>
                                <p className="text-xs text-gray-500 mb-4 flex items-center gap-1"><Calendar size={12} /> آخر صيانة: {elev.lastMaintenance || 'غير مسجل'}</p>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setCurrentElevator(elev); setViewMode('qr_view'); }}
                                        className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-black"
                                    >
                                        <QrCode size={14} /> عرض QR
                                    </button>
                                    <button
                                        onClick={() => { setCurrentElevator(elev); setViewMode('simulation'); }}
                                        className="flex-1 bg-blue-50 text-blue-600 border border-blue-200 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-100"
                                    >
                                        <Smartphone size={14} /> محاكاة
                                    </button>
                                </div>

                                <button onClick={() => handleDelete(elev.id)} className="absolute top-4 left-4 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                            <h3 className="font-bold text-lg mb-4 text-jilco-900">إضافة مصعد ذكي جديد</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold mb-1">اسم المشروع / العميل</label>
                                    <input type="text" className="w-full p-2 border rounded" value={newElevator.projectName || ''} onChange={e => setNewElevator({ ...newElevator, projectName: e.target.value })} placeholder="برج التحرير - المصعد أ" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1">الموقع</label>
                                    <input type="text" className="w-full p-2 border rounded" value={newElevator.location || ''} onChange={e => setNewElevator({ ...newElevator, location: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1">نوع المصعد</label>
                                    <input type="text" className="w-full p-2 border rounded" value={newElevator.type || ''} onChange={e => setNewElevator({ ...newElevator, type: e.target.value })} placeholder="ركاب - 630 كجم" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1">تاريخ التركيب</label>
                                    <input type="date" className="w-full p-2 border rounded" value={newElevator.installationDate || ''} onChange={e => setNewElevator({ ...newElevator, installationDate: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">إلغاء</button>
                                <button onClick={handleAddElevator} className="px-4 py-2 bg-jilco-600 text-white rounded hover:bg-jilco-700">إنشاء</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (viewMode === 'qr_view') return renderQRView();
    if (viewMode === 'simulation') return renderSimulation();

    return null;
};

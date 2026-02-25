
import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, Save, RefreshCw, CheckCircle2 } from 'lucide-react';
import { TechnicalSpecs, SpecsDatabase } from '../types';
import { useData } from '../contexts/DataContext.tsx';

const DEFAULT_SPECS_DB: SpecsDatabase = {
  elevatorType: ['مصعد ركاب (Passenger)', 'مصعد بضائع (Freight)', 'مصعد طعام (Dumbwaiter)', 'مصعد بانوراما (Panoramic)', 'مصعد منزلي (Home Lift)'],
  capacity: ['320 كجم - 4 أشخاص', '450 كجم - 6 أشخاص', '630 كجم - 8 أشخاص', '800 كجم - 10 أشخاص', '1000 كجم - 13 شخص', '1250 كجم - 16 شخص'],
  speed: ['0.5 متر/ثانية', '1.0 متر/ثانية', '1.6 متر/ثانية', '2.0 متر/ثانية', '2.5 متر/ثانية'],
  stops: ['محطة واحدة', '2 وقفات / 2 فتحات', '3 وقفات / 3 فتحات', '4 وقفات / 4 فتحات', '5 وقفات / 5 فتحات', '6 وقفات / 6 فتحات', '7 وقفات / 7 فتحات', '8 وقفات / 8 فتحات'],
  driveType: ['Gearless Machine (Montanari Italy)', 'Gearless Machine (Sicor Italy)', 'Geared Machine (Alberto Sassi)', 'Geared Machine (Torin Drive)', 'Hydraulic System'],
  controlSystem: ['Microprocessor Full Collective (VVVF Close Loop)', 'Simplex Collective', 'Duplex Group Control', 'Monarch Nice 3000+', 'Step Control System'],
  powerSupply: ['3 Phase, 380V, 60Hz', '3 Phase, 220V, 60Hz', 'Single Phase, 220V, 60Hz'],
  cabin: ['ستانلس ستيل مع ديكورات ليزر ومرايا', 'ستانلس ستيل ذهبي (Ti-Gold)', 'بانوراما زجاجي كامل', 'تشطيب خشبي فاخر'],
  doors: ['أوتوماتيكية بالكامل (Center Opening)', 'أوتوماتيكية بالكامل (Telescopic)', 'نصف أوتوماتيك (Semi-Auto)', 'أبواب يدوية (Manual)'],
  machineRoom: ['غرفة ماكينة علوية (MR)', 'بدون غرفة ماكينة (MRL)', 'غرفة ماكينة جانبية'],
  rails: ['سكك مسحوبة على البارد (Marazzi Italy)', 'سكك مشغولة (Machined)', 'سكك T70/T50', 'سكك T90/T75'],
  ropes: ['حبال صلب (Drako German)', 'حبال صلب (Italian)', 'حبال صلب (Chinese High Quality)'],
  safety: ['نظام باراشوت تدريجي (Progressive Safety Gear)', 'نظام باراشوت فوري (Instantaneous)', 'منظم سرعة (Overspeed Governor)'],
  emergency: ['نظام الطوارئ الأوتوماتيكي (ARD/UPS)', 'بطارية طوارئ للإضاءة والجرس', 'لا يوجد']
};

const LABELS: Record<keyof TechnicalSpecs, string> = {
  elevatorType: 'نوع المصعد',
  capacity: 'الحمولة',
  speed: 'السرعة',
  stops: 'الوقفات',
  driveType: 'الماكينة (Drive)',
  controlSystem: 'الكنترول',
  powerSupply: 'الكهرباء',
  cabin: 'الكابينة',
  doors: 'الأبواب',
  machineRoom: 'غرفة الماكينة',
  rails: 'السكك (Guide Rails)',
  ropes: 'الحبال (Ropes)',
  safety: 'الأمان (Safety)',
  emergency: 'الطوارئ (Emergency)'
};

export const SpecsManagerModule: React.FC = () => {
  const { specsDb, saveSpecsDb } = useData();

  const [db, setDb] = useState<SpecsDatabase>(DEFAULT_SPECS_DB);
  const [selectedCategory, setSelectedCategory] = useState<keyof TechnicalSpecs>('elevatorType');
  const [newItem, setNewItem] = useState('');
  const [showSaved, setShowSaved] = useState(false);

  // Sync with context
  useEffect(() => {
    if (specsDb && Object.keys(specsDb).length > 0) {
      setDb({ ...DEFAULT_SPECS_DB, ...specsDb });
    } else {
      setDb({ ...DEFAULT_SPECS_DB });
    }
  }, [specsDb]);

  // Save
  const handleSave = async () => {
    await saveSpecsDb(db);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    setDb(prev => ({
      ...prev,
      [selectedCategory]: [...(prev[selectedCategory] || []), newItem.trim()]
    }));
    setNewItem('');
  };

  const deleteItem = (index: number) => {
    setDb(prev => {
      const newList = [...prev[selectedCategory]];
      newList.splice(index, 1);
      return { ...prev, [selectedCategory]: newList };
    });
  };

  const resetToDefaults = async () => {
    if (window.confirm('هل أنت متأكد من استعادة البيانات الافتراضية؟ سيتم حذف التعديلات.')) {
      setDb(DEFAULT_SPECS_DB);
      await saveSpecsDb(DEFAULT_SPECS_DB);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    }
  };

  return (
    <div className="flex-1 bg-gray-100 h-full overflow-y-auto animate-fade-in p-8">
      <div className="max-w-6xl mx-auto h-full flex flex-col">

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
              <Database className="text-gold-500" /> قاعدة بيانات المواصفات
            </h1>
            <p className="text-gray-500 text-sm mt-1">إدارة القوائم المنسدلة للمواصفات الفنية</p>
          </div>
          <div className="flex gap-2">
            <button title="استعادة الإعدادات الافتراضية" onClick={resetToDefaults} className="px-4 py-2 rounded text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 text-xs font-bold flex items-center gap-2">
              <RefreshCw size={14} /> استعادة الافتراضي
            </button>
            <button
              title="حفظ التغييرات"
              onClick={handleSave}
              className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all text-white ${showSaved ? 'bg-green-600' : 'bg-jilco-900 hover:bg-jilco-800'}`}
            >
              {showSaved ? <CheckCircle2 size={18} /> : <Save size={18} />}
              {showSaved ? 'تم الحفظ' : 'حفظ التغييرات'}
            </button>
          </div>
        </div>

        <div className="flex-1 flex gap-6 overflow-hidden">

          {/* Categories Sidebar */}
          <div className="w-64 bg-white rounded-xl border border-gray-200 shadow-sm overflow-y-auto">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-700 text-sm">التصنيفات</h3>
            </div>
            <div>
              {(Object.keys(LABELS) as Array<keyof TechnicalSpecs>).map(key => (
                <button
                  title={`تحديد تصنيف ${LABELS[key]}`}
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`w-full text-right px-4 py-3 text-sm font-medium border-b border-gray-50 transition-colors flex justify-between items-center ${selectedCategory === key ? 'bg-jilco-50 text-jilco-800 border-r-4 border-r-jilco-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {LABELS[key]}
                  <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                    {db[key]?.length || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Items Editor */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-jilco-900">{LABELS[selectedCategory]}</h3>
              <span className="text-xs text-gray-500">قم بإضافة أو حذف الخيارات التي ستظهر في القوائم المنسدلة</span>
            </div>

            <div className="p-6 border-b border-gray-100 bg-white">
              <div className="flex gap-2">
                <input
                  title={`إضافة خيار جديد لـ ${LABELS[selectedCategory]}`}
                  type="text"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem()}
                  placeholder={`إضافة خيار جديد لـ ${LABELS[selectedCategory]}...`}
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none"
                />
                <button
                  title="إضافة الخيار"
                  onClick={addItem}
                  disabled={!newItem.trim()}
                  className="bg-green-600 text-white px-6 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Plus size={18} /> إضافة
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
              <div className="space-y-2">
                {db[selectedCategory]?.length === 0 && (
                  <div className="text-center py-10 text-gray-400">لا توجد خيارات مضافة.</div>
                )}
                {db[selectedCategory]?.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded shadow-sm group hover:border-jilco-300">
                    <span className="text-gray-800 font-medium">{item}</span>
                    <button
                      title="حذف الخيار"
                      onClick={() => deleteItem(index)}
                      className="text-red-400 hover:bg-red-50 p-2 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
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

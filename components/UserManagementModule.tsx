
import React, { useState, useEffect } from 'react'; // UserManagementModule
import { useAuth } from '../contexts/AuthContext.tsx';
import { User, UserRole, ROLE_PERMISSIONS, Permission, ALL_PERMISSIONS } from '../types';
import { Users, Plus, Edit, Trash2, ShieldCheck, Check, X, Lock, Eye, Key, CheckSquare, Square, CheckCircle2 } from 'lucide-react';

const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'مدير النظام (Admin)',
    sales: 'مبيعات (Sales)',
    accountant: 'محاسب (Accountant)',
    technician: 'فني / مشاريع',
    manager: 'مدير (Manager)'
};

const PermissionBadge: React.FC<{ permission: Permission }> = ({ permission }) => {
    const label = ALL_PERMISSIONS.find(p => p.id === permission)?.label || permission;
    return (
        <span className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 rounded-full border border-gray-200">
            {label}
        </span>
    );
};

export const UserManagementModule: React.FC = () => {
    const { users, addUser, updateUser, deleteUser, currentUser } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<User>>({});

    // Local state for permissions checklist
    const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);

    // When opening form or changing role, load initial permissions
    useEffect(() => {
        if (showForm && editingUser.role) {
            if (editingUser.customPermissions && editingUser.customPermissions.length > 0) {
                setSelectedPermissions(editingUser.customPermissions);
            } else {
                // Load default from role if no custom permissions are set
                const defaultPerms = ROLE_PERMISSIONS[editingUser.role] || [];
                setSelectedPermissions(defaultPerms);
            }
        }
    }, [showForm, editingUser.role, editingUser.customPermissions]);

    const handleSave = () => {
        if (!editingUser.username || !editingUser.name || !editingUser.role) {
            alert('يرجى ملء كافة الحقول المطلوبة');
            return;
        }

        // Check if permissions differ from default role permissions
        const defaultPerms = ROLE_PERMISSIONS[editingUser.role] || [];
        const isCustom = JSON.stringify(selectedPermissions.sort()) !== JSON.stringify(defaultPerms.sort());

        const userToSave: User = {
            ...editingUser as User,
            name: editingUser.name?.trim() || '',
            username: editingUser.username?.trim() || '',
            password: editingUser.password?.trim() || '',
            customPermissions: isCustom ? selectedPermissions : undefined // Only save if custom
        };

        if (editingUser.id) {
            updateUser(userToSave);
        } else {
            if (!editingUser.password) {
                alert('يرجى تحديد كلمة مرور');
                return;
            }
            const newUser: User = {
                ...userToSave,
                id: `USR-${Date.now()}`,
                status: editingUser.status || 'active'
            };
            addUser(newUser);
        }
        setShowForm(false);
        setEditingUser({});
    };

    const handleDelete = (id: string) => {
        if (id === currentUser?.id) {
            alert('لا يمكنك حذف حسابك الحالي!');
            return;
        }
        if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
            deleteUser(id);
        }
    };

    const togglePermission = (perm: Permission) => {
        setSelectedPermissions(prev =>
            prev.includes(perm)
                ? prev.filter(p => p !== perm)
                : [...prev, perm]
        );
    };

    const viewPermissions = ALL_PERMISSIONS.filter(p => p.type === 'view');
    const actionPermissions = ALL_PERMISSIONS.filter(p => p.type === 'action');

    return (
        <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
            <div className="max-w-7xl mx-auto">

                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                            <ShieldCheck className="text-gold-500" /> إدارة المستخدمين والصلاحيات
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">إضافة موظفين للنظام وتحديد صلاحيات الوصول بدقة</p>
                    </div>
                    <button
                        title="إضافة مستخدم جديد"
                        onClick={() => { setEditingUser({ role: 'sales', status: 'active' }); setShowForm(true); }}
                        className="bg-jilco-900 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-800 shadow-md text-sm"
                    >
                        <Plus size={18} /> مستخدم جديد
                    </button>
                </div>

                {/* Users List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {users.map(user => (
                        <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all group flex flex-col">
                            <div className="p-5 flex justify-between items-start">
                                <div className="flex gap-3">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-md ${user.role === 'admin' ? 'bg-red-600' :
                                        user.role === 'accountant' ? 'bg-green-600' :
                                            user.role === 'sales' ? 'bg-blue-600' : 'bg-gray-600'
                                        }`}>
                                        {user.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">{user.name}</h3>
                                        <p className="text-xs text-gray-500 font-mono">@{user.username}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {user.status === 'active' ? 'نشط' : 'متوقف'}
                                </span>
                            </div>

                            <div className="px-5 py-3 border-t border-gray-50 bg-gray-50 flex justify-between items-center text-xs">
                                <span className="font-bold text-jilco-800 flex items-center gap-1"><Key size={12} /> {ROLE_LABELS[user.role]}</span>
                                <span className="text-gray-400">{user.lastLogin ? `دخول: ${new Date(user.lastLogin).toLocaleDateString('en-GB')}` : 'لم يسجل دخول'}</span>
                            </div>

                            {/* Permissions Hint */}
                            <div className="px-5 py-3 bg-white border-t border-gray-50 text-[10px] text-gray-500 flex-1">
                                {user.role === 'admin' ? (
                                    <span className="text-red-500 font-bold flex items-center gap-1"><ShieldCheck size={12} /> جميع الصلاحيات (Super Admin)</span>
                                ) : (
                                    <div className="flex flex-wrap gap-1">
                                        {user.customPermissions ? (
                                            <span className="text-amber-600 font-bold w-full mb-1">تم تخصيص الصلاحيات يدوياً ({user.customPermissions.length})</span>
                                        ) : (
                                            <span className="text-gray-400 w-full mb-1">صلاحيات الدور الافتراضية ({(ROLE_PERMISSIONS[user.role] || []).length})</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="p-3 border-t border-gray-100 flex gap-2 bg-gray-50/50">
                                <button title="تعديل المستخدم" onClick={() => { setEditingUser(user); setShowForm(true); }} className="flex-1 py-2 bg-white border border-gray-200 rounded text-blue-600 text-xs font-bold hover:bg-blue-50 flex items-center justify-center gap-1 transition-colors">
                                    <Edit size={14} /> تعديل
                                </button>
                                <button title="حذف المستخدم" onClick={() => handleDelete(user.id)} className="flex-1 py-2 bg-white border border-gray-200 rounded text-red-600 text-xs font-bold hover:bg-red-50 flex items-center justify-center gap-1 transition-colors">
                                    <Trash2 size={14} /> حذف
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Modal Form */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in overflow-hidden">

                            {/* Header */}
                            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-bold text-lg text-jilco-900 flex items-center gap-2">
                                    {editingUser.id ? <Edit size={20} /> : <Plus size={20} />}
                                    {editingUser.id ? 'تعديل بيانات وصلاحيات المستخدم' : 'إضافة مستخدم جديد'}
                                </h3>
                                <button title="إغلاق النافذة" onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Left Side: Basic Info */}
                                    <div className="lg:col-span-1 space-y-5">
                                        <h4 className="font-bold text-gray-800 text-sm border-b pb-2 mb-4">البيانات الأساسية</h4>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">الاسم الكامل</label>
                                            <input title="الاسم الكامل" type="text" value={editingUser.name || ''} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-jilco-500 outline-none" />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">اسم الدخول (Username)</label>
                                            <input title="اسم الدخول" type="text" value={editingUser.username || ''} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} className="w-full p-2.5 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-jilco-500 outline-none" dir="ltr" />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">كلمة المرور</label>
                                            <input title="كلمة المرور" type="text" value={editingUser.password || ''} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} placeholder={editingUser.id ? 'ترك فارغاً للإبقاء' : '••••••'} className="w-full p-2.5 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-jilco-500 outline-none" dir="ltr" />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">الصلاحية / الدور (Role)</label>
                                            <select
                                                title="دور المستخدم"
                                                value={editingUser.role || 'sales'}
                                                onChange={e => {
                                                    const newRole = e.target.value as UserRole;
                                                    setEditingUser({ ...editingUser, role: newRole, customPermissions: undefined }); // Reset custom on role change
                                                    setSelectedPermissions(ROLE_PERMISSIONS[newRole] || []); // Reset UI checks
                                                }}
                                                className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-jilco-500 outline-none"
                                            >
                                                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                            </select>
                                            <p className="text-[10px] text-gray-400 mt-1">تغيير الدور سيقوم بإعادة ضبط الصلاحيات للافتراضي.</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">حالة الحساب</label>
                                            <select title="حالة الحساب" value={editingUser.status || 'active'} onChange={e => setEditingUser({ ...editingUser, status: e.target.value as any })} className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-jilco-500 outline-none">
                                                <option value="active">نشط (يمكنه الدخول)</option>
                                                <option value="inactive">موقوف (ممنوع من الدخول)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Right Side: Permissions Grid */}
                                    <div className="lg:col-span-2">
                                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                                            <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                                <Key size={16} className="text-jilco-600" /> التحكم في الصلاحيات
                                            </h4>
                                            <div className="text-xs">
                                                {editingUser.role === 'admin' ? (
                                                    <span className="text-red-500 font-bold">المسؤول لديه كافة الصلاحيات تلقائياً</span>
                                                ) : (
                                                    <span className="text-gray-500">
                                                        تم تحديد <span className="font-bold text-jilco-600">{selectedPermissions.length}</span> صلاحية
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {editingUser.role === 'admin' ? (
                                            <div className="bg-red-50 p-8 rounded-xl border border-red-100 text-center">
                                                <ShieldCheck size={48} className="text-red-300 mx-auto mb-3" />
                                                <p className="font-bold text-red-700">حساب المدير العام (Admin)</p>
                                                <p className="text-sm text-red-500 mt-2">لا يمكن تقييد صلاحيات هذا الحساب. يمتلك وصولاً كاملاً للنظام.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {/* View Permissions */}
                                                <div>
                                                    <h5 className="text-xs font-bold text-gray-500 uppercase mb-3 bg-gray-100 p-1.5 rounded inline-block">صلاحيات العرض والوصول (Pages)</h5>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                        {viewPermissions.map(perm => (
                                                            <label key={perm.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${selectedPermissions.includes(perm.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedPermissions.includes(perm.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                                                    {selectedPermissions.includes(perm.id) && <Check size={12} className="text-white" />}
                                                                </div>
                                                                <input title={`صلاحية الوصول: ${perm.label}`} type="checkbox" className="hidden" checked={selectedPermissions.includes(perm.id)} onChange={() => togglePermission(perm.id)} />
                                                                <span className={`text-xs font-bold ${selectedPermissions.includes(perm.id) ? 'text-blue-800' : 'text-gray-600'}`}>{perm.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Action Permissions */}
                                                <div>
                                                    <h5 className="text-xs font-bold text-gray-500 uppercase mb-3 bg-gray-100 p-1.5 rounded inline-block">صلاحيات إدارية (Actions)</h5>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                        {actionPermissions.map(perm => (
                                                            <label key={perm.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${selectedPermissions.includes(perm.id) ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedPermissions.includes(perm.id) ? 'bg-amber-600 border-amber-600' : 'bg-white border-gray-300'}`}>
                                                                    {selectedPermissions.includes(perm.id) && <Check size={12} className="text-white" />}
                                                                </div>
                                                                <input title={`صلاحية إدارية: ${perm.label}`} type="checkbox" className="hidden" checked={selectedPermissions.includes(perm.id)} onChange={() => togglePermission(perm.id)} />
                                                                <span className={`text-xs font-bold ${selectedPermissions.includes(perm.id) ? 'text-amber-800' : 'text-gray-600'}`}>{perm.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50">
                                <button title="إلغاء النافذة" onClick={() => setShowForm(false)} className="px-6 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg font-bold text-sm transition-colors">إلغاء</button>
                                <button title="حفظ المستحدم" onClick={handleSave} className="px-8 py-2.5 bg-jilco-900 text-white rounded-lg hover:bg-jilco-800 font-bold text-sm shadow-lg flex items-center gap-2 transition-colors">
                                    <CheckCircle2 size={18} /> حفظ التغييرات
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

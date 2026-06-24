
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Lock, User as UserIcon, AlertCircle } from 'lucide-react';

export const LoginScreen: React.FC = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const success = await login(username.trim(), password.trim());
            if (!success) {
                setError('اسم المستخدم أو كلمة المرور غير صحيحة.');
            }
        } catch (e: any) {
            setError(e?.message || 'حدث خطأ أثناء تسجيل الدخول.');
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 relative overflow-hidden" dir="rtl">

            {/* Animated Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-jilco-900 rounded-full blur-[120px] opacity-20 animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-gold-600 rounded-full blur-[120px] opacity-10 animate-pulse delay-1000"></div>
            </div>

            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative z-10 mx-4">

                {/* Header */}
                <div className="bg-jilco-900 p-8 text-center relative overflow-hidden">
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black text-white mb-2 tracking-tighter">JILCO</h1>
                        <p className="text-blue-100 text-xs font-bold uppercase tracking-[0.3em]">Elevators System</p>
                    </div>
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400"></div>
                </div>

                {/* Form */}
                <div className="p-8">
                    <div className="mb-6 text-center">
                        <h2 className="text-xl font-bold text-gray-800">تسجيل الدخول</h2>
                        <p className="text-sm text-gray-500 mt-1">أدخل بياناتك للوصول للنظام</p>
                    </div>

                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in leading-relaxed">
                            <AlertCircle size={16} className="shrink-0" /> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-2">اسم المستخدم</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    className="w-full pl-4 pr-10 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none transition-all text-base font-bold text-black bg-white"
                                    placeholder="اسم المستخدم"
                                    autoComplete="username"
                                />
                                <UserIcon size={18} className="absolute right-3 top-3.5 text-gray-500" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-2">كلمة المرور</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full pl-4 pr-10 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none transition-all text-base font-bold text-black bg-white"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                                <Lock size={18} className="absolute right-3 top-3.5 text-gray-500" />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-jilco-900 text-white font-bold py-3.5 rounded-lg shadow-lg hover:bg-jilco-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                        >
                            <LogIn size={20} />
                            {isLoading ? 'جاري التحقق...' : 'تسجيل الدخول'}
                        </button>
                    </form>

                    <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <p className="text-[10px] text-blue-800 text-center font-bold">
                            البيانات الافتراضية: admin / 123456
                        </p>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">جميع الحقوق محفوظة © {new Date().getFullYear()} جيلكو للمصاعد</p>
                </div>
            </div>
        </div>
    );
};

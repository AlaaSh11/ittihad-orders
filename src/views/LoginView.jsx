import { useState } from 'react';
import { login } from '../lib/auth';

/**
 * Login screen — Section 2.1 visual spec.
 * Dark navy background, centered glass card, red button.
 *
 * Props:
 *   onLogin {fn}  Called with user object on successful login
 */
export default function LoginView({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    setLoading(false);

    if (result.ok) {
      onLogin(result.user);
    } else {
      setError(result.error);
      setPassword('');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/50 font-cairo"
      dir="rtl"
    >
      <div className="w-full max-w-sm rounded-3xl p-8 sm:p-10 text-center bg-white border border-slate-200 shadow-2xl">
        {/* Brand Icon Badge */}
        <div className="w-16 h-16 mx-auto mb-3 bg-red-50 rounded-2xl flex items-center justify-center text-3xl border border-red-100 shadow-sm select-none">
          🎂
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black text-[#1a1a2e] mb-1 font-cairo tracking-tight">
          الاتحاد للحلويات والكيك
        </h1>
        <p className="text-xs font-bold text-gray-500 mb-6 font-cairo">تسجيل الدخول لمنظومة الطلبات</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
          {/* Username */}
          <div className="text-right">
            <label className="block text-[11px] font-bold text-gray-600 mb-1">اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="أدخل اسم المستخدم (مثال: jawad)"
              autoComplete="username"
              required
              dir="ltr"
              className="w-full rounded-xl px-4 py-2.5 text-sm font-cairo text-gray-800 placeholder-gray-400 outline-none transition-all bg-slate-50 border-2 border-gray-200 focus:border-[#e2495c] focus:bg-white focus:ring-2 focus:ring-[#e2495c]/20"
            />
          </div>

          {/* Password */}
          <div className="text-right">
            <label className="block text-[11px] font-bold text-gray-600 mb-1">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              dir="ltr"
              className="w-full rounded-xl px-4 py-2.5 text-sm font-cairo text-gray-800 placeholder-gray-400 outline-none transition-all bg-slate-50 border-2 border-gray-200 focus:border-[#e2495c] focus:bg-white focus:ring-2 focus:ring-[#e2495c]/20"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-[#e2495c] text-xs font-bold font-cairo text-center animate-fade-in bg-red-50 border border-red-200 rounded-lg p-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 mt-2 text-white font-extrabold font-cairo text-base tracking-wide transition-all hover:opacity-95 hover:shadow-lg active:scale-[0.98] disabled:opacity-60 bg-gradient-to-r from-[#e0405a] to-[#c92a42] shadow-[0_4px_16px_rgba(224,64,90,0.30)] cursor-pointer"
          >
            {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
}

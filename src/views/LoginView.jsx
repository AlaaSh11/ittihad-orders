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
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(170deg, #0f1a2e 0%, #111d33 60%, #0d1628 100%)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-10 text-center"
        style={{
          background: 'rgba(27,39,64,0.85)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(18px)',
        }}
      >
        {/* Icon */}
        <div className="text-5xl mb-3 select-none">🎂</div>

        {/* Title */}
        <h1 className="text-2xl font-extrabold text-white mb-1 font-cairo tracking-tight">
          طلبية قالب كايك
        </h1>
        <p className="text-sm text-white/40 mb-7 font-cairo">تسجيل الدخول للمتابعة</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          {/* Username */}
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="اسم المستخدم"
            autoComplete="username"
            required
            dir="rtl"
            className="w-full rounded-xl px-4 py-3 text-sm font-cairo text-white placeholder-white/30 outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1.5px solid rgba(255,255,255,0.13)',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#e5556b')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.13)')}
          />

          {/* Password */}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            autoComplete="current-password"
            required
            dir="rtl"
            className="w-full rounded-xl px-4 py-3 text-sm font-cairo text-white placeholder-white/30 outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1.5px solid rgba(255,255,255,0.13)',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#e5556b')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.13)')}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
          />

          {/* Error */}
          {error && (
            <p className="text-[#e5556b] text-xs font-bold font-cairo text-center animate-fade-in">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 mt-1 text-white font-bold font-cairo text-base tracking-wide transition-all active:scale-[0.98] disabled:opacity-70"
            style={{
              background: 'linear-gradient(135deg, #e0405a, #e63950)',
              boxShadow: '0 4px 18px rgba(224,64,90,0.35)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
          >
            {loading ? 'جاري التحقق...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}

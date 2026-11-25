import { useState, useEffect } from 'react';
import { EXCHANGE_RATE, toUSD } from '../../constants/currency';

/**
 * Cashier enters what the customer actually handed over: dollars, lira or both.
 *
 * Props:
 *   isOpen, title, onCancel
 *   expectedUSD  {number}  amount due, in USD (pre-filled in the $ field)
 *   onConfirm    {fn}      ({ usd, lbp }) => void
 */
export default function PaymentModal({ isOpen, title, expectedUSD = 0, onConfirm, onCancel }) {
  const [usd, setUsd] = useState('');
  const [lbp, setLbp] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUsd(expectedUSD > 0 ? String(expectedUSD) : '');
      setLbp('');
      setError('');
    }
  }, [isOpen, expectedUSD]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const usdNum = parseFloat(usd) || 0;
  const lbpNum = parseInt(String(lbp).replace(/[^\d]/g, ''), 10) || 0;
  const totalUSD = toUSD(usdNum, lbpNum);
  const diff = Math.round((totalUSD - expectedUSD) * 100) / 100;

  const fillRestInLBP = () => {
    const rest = Math.max(0, expectedUSD - usdNum);
    setLbp(Math.round(rest * EXCHANGE_RATE).toLocaleString('en-US'));
  };

  const submit = (e) => {
    e.preventDefault();
    if (usdNum < 0 || lbpNum < 0 || usdNum + lbpNum <= 0) {
      setError('يرجى إدخال المبلغ المستلم بالدولار أو بالليرة أو بكليهما.');
      return;
    }
    onConfirm?.({ usd: usdNum, lbp: lbpNum });
  };

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-cairo"
      dir="rtl"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 flex flex-col"
      >
        <div className="px-5 py-4 bg-slate-50 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-[#1a1a2e]">{title}</h3>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 rounded-full w-7 h-7 flex items-center justify-center hover:bg-gray-200">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm font-semibold text-gray-700">
            المبلغ المطلوب: <span className="font-extrabold text-indigo-800" dir="ltr">${expectedUSD.toLocaleString('en-US')}</span>
            <span className="text-xs text-gray-500"> (≈ {Math.round(expectedUSD * EXCHANGE_RATE).toLocaleString('en-US')} L.L)</span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-bold text-[#1a1a2e]">
              المستلم بالدولار
              <div className="flex items-center border-2 border-emerald-500 rounded-lg overflow-hidden" dir="ltr">
                <span className="px-2 text-sm font-bold text-emerald-700 bg-emerald-50 self-stretch flex items-center">$</span>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={usd}
                  onChange={(e) => setUsd(e.target.value.replace(/[^\d.]/g, ''))}
                  className="w-full px-2 py-2 text-sm font-bold focus:outline-none"
                  aria-label="USD"
                />
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-[#1a1a2e]">
              المستلم بالليرة
              <div className="flex items-center border-2 border-[#e2495c] rounded-lg overflow-hidden" dir="ltr">
                <input
                  inputMode="numeric"
                  value={lbp}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setLbp(digits ? Number(digits).toLocaleString('en-US') : '');
                  }}
                  className="w-full px-2 py-2 text-sm font-bold focus:outline-none text-right"
                  aria-label="LBP"
                />
                <span className="px-2 text-xs font-bold text-[#e2495c] bg-rose-50 self-stretch flex items-center">L.L</span>
              </div>
            </label>
          </div>

          <button type="button" onClick={fillRestInLBP} className="self-start text-xs font-bold text-indigo-700 underline">
            الباقي بالليرة
          </button>

          <div className={`text-xs font-bold rounded-lg px-3 py-2 border ${
            diff === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            المجموع ≈ <span dir="ltr">${(Math.round(totalUSD * 100) / 100).toLocaleString('en-US')}</span>
            {diff > 0 && <> · زيادة <span dir="ltr">${diff}</span></>}
            {diff < 0 && <> · ناقص <span dir="ltr">${-diff}</span></>}
          </div>

          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100">إلغاء</button>
            <button type="submit" className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm active:scale-95">
              تأكيد الاستلام
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

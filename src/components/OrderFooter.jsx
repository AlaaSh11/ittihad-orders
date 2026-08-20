import { useEffect } from 'react';
import TextField from './ui/TextField';
import CheckboxField from './ui/CheckboxField';

/**
 * Order footer — price, down payment (deposit), remaining balance for cashier collection.
 *
 * Props:
 *   data     {Object}  { price, depositPaid, depositAmount, remaining }
 *   onChange {fn}      (field, value) => void
 *   variant  {'showroom'|'factory'}
 *             showroom → normal fields with values
 *             factory  → blank bordered box same height, no labels/values (sketch space)
 */
export default function OrderFooter({ data, onChange, variant = 'showroom', priceReadOnly = false, priceReadOnlyNote = null }) {
  // Auto-calculate remaining = price - depositAmount when both are present
  useEffect(() => {
    const price = parseFloat(data.price) || 0;
    const deposit = parseFloat(data.depositAmount) || 0;
    if (price > 0 || deposit > 0) {
      const remaining = price - deposit;
      onChange('remaining', remaining >= 0 ? String(remaining) : '0');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.price, data.depositAmount]);

  if (variant === 'factory') {
    // Blank bordered box — same height as showroom footer, no content.
    // Intentionally empty: staff sketch space on the physical printout.
    return (
      <div
        className="mt-3 border-2 border-dashed border-gray-400 rounded"
        style={{ minHeight: '72px' }}
        aria-label="مساحة رسم للمصنع"
      />
    );
  }

  const priceVal = parseFloat(data.price) || 0;
  const remainingVal = parseFloat(data.remaining) || 0;
  const depositVal = parseFloat(data.depositAmount) || 0;

  return (
    <div className="mt-3 pt-2 border-t border-gray-200">
      <div className="grid items-end gap-3" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
        {/* السعر الإجمالي */}
        {priceReadOnly ? (
          <div className="flex flex-col gap-0.5">
            <label className="text-xs font-bold text-[#1a1a2e] text-center font-cairo">السعر الإجمالي</label>
            <div
              dir="ltr"
              className="w-full bg-emerald-50 border-2 border-emerald-400 rounded px-2 py-1.5 text-sm font-bold font-cairo text-emerald-800 text-center select-none"
            >
              {Number(data.price || 0).toLocaleString()}
            </div>
            {priceReadOnlyNote && (
              <span className="text-[10px] text-center text-emerald-600 font-cairo">✅ {priceReadOnlyNote}</span>
            )}
          </div>
        ) : (
          <TextField
            label="السعر الإجمالي"
            id="price"
            type="text"
            dir="ltr"
            value={data.price || ''}
            onChange={(v) => onChange('price', v)}
          />
        )}

        {/* يُطلب عربون — checkbox + deposit amount */}
        <div className="flex flex-col items-center gap-1 pb-1">
          <CheckboxField
            label="عربون"
            id="depositPaid"
            checked={data.depositPaid || false}
            onChange={(v) => onChange('depositPaid', v)}
          />
          {data.depositPaid && (
            <input
              type="text"
              dir="ltr"
              value={data.depositAmount || ''}
              onChange={(e) => onChange('depositAmount', e.target.value)}
              placeholder="العربون"
              className="w-24 bg-[#eceafa] border-2 border-indigo-600 rounded px-2 py-1 text-xs font-bold font-cairo text-center text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          )}
        </div>

        {/* المتبقي للكاشير */}
        <TextField
          label="المتبقي للكاشير"
          id="remaining"
          type="text"
          dir="ltr"
          value={data.remaining || ''}
          onChange={(v) => onChange('remaining', v)}
        />
      </div>

      {/* Staff guidance note for down payment */}
      {data.depositPaid && depositVal > 0 && (
        <div className="mt-2.5 px-3 py-2 rounded-lg text-xs font-cairo flex items-center gap-2 border bg-amber-50 border-amber-200 text-amber-900">
          <span className="text-base">ℹ️</span>
          <p className="font-semibold leading-relaxed">
            {remainingVal > 0 ? (
              <>
                عربون: <span className="font-bold underline">{depositVal}</span> | المتبقي عند التسليم: <span className="font-bold underline">{remainingVal}</span>. (يرجى الدفع عند الكاشير)
              </>
            ) : (
              <>
                العربون يغطي كامل السعر. سيتم تحصيل <span className="font-bold underline">{depositVal}</span> عند الكاشير.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

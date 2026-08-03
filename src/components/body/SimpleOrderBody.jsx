import SelectField from '../ui/SelectField';
import TextField from '../ui/TextField';
import TextareaField from '../ui/TextareaField';
import { CHOCOLATE_NAMES } from '../../constants/chocolateOrderFields';
import { CHOCOLATE_PIECES_PER_KILO } from '../../constants/chocolateLookup';

/**
 * Body fields for Simple orders — Tab 4.
 *
 * Changes vs original:
 *   - Added "اسم الشوكولا" dropdown (uses CHOCOLATE_NAMES from chocolateOrderFields)
 *   - Split الكمية into:
 *       عدد الحبات — numeric stepper (+/- buttons), defaults to 1
 *       الوزن بالكيلو — read-only, auto-calculated from lookup table
 *
 * Weight calculation:
 *   الوزن (kg) = عدد الحبات / CHOCOLATE_PIECES_PER_KILO[اسم الشوكولا]
 *   Rounds to 3 decimal places. Shows '—' if no ratio found for selected chocolate.
 *
 * To update ratios: edit src/constants/chocolateLookup.js only.
 */
export default function SimpleOrderBody({ data, onChange }) {
  const pieces = parseInt(data.pieces, 10) || 0;
  const chocolateName = data.chocolateName || '';

  // Lookup pieces-per-kilo ratio; undefined if not found
  const ratio = CHOCOLATE_PIECES_PER_KILO[chocolateName];

  // Auto-calculate weight (read-only display)
  const weightDisplay =
    pieces > 0 && ratio
      ? (pieces / ratio).toFixed(3) + ' كغ'
      : '—';

  const handleStepperChange = (delta) => {
    const next = Math.max(1, pieces + delta);
    onChange('pieces', String(next));
  };

  return (
    <div className="grid grid-cols-2 gap-2">

      {/* اسم الصنف */}
      <div className="col-span-2">
        <TextField
          label="اسم الصنف"
          id="itemName"
          value={data.itemName || ''}
          onChange={(v) => onChange('itemName', v)}
        />
      </div>

      {/* اسم الشوكولا — dropdown linked to weight lookup */}
      <div className="col-span-2">
        <SelectField
          label="اسم الشوكولا"
          id="chocolateName"
          options={CHOCOLATE_NAMES}
          value={chocolateName}
          onChange={(v) => {
            onChange('chocolateName', v);
            // Clear pieces on chocolate change so user re-enters intentionally
            onChange('pieces', '1');
          }}
          withOther
          placeholder="اختر نوع الشوكولا"
        />
      </div>

      {/* عدد الحبات — numeric stepper */}
      <div className="flex flex-col gap-1">
        <label htmlFor="pieces" className="text-xs font-bold text-[#1a1a2e] text-center">
          عدد الحبات
        </label>
        <div className="flex items-center border-2 border-[#e2495c] rounded overflow-hidden bg-[#eceafa]">
          <button
            type="button"
            onClick={() => handleStepperChange(-1)}
            className="px-3 py-1.5 text-[#e2495c] font-bold text-lg leading-none hover:bg-[#e2495c]/10 transition-colors active:scale-90 select-none"
            aria-label="تقليل"
          >
            −
          </button>
          <input
            id="pieces"
            type="number"
            min="1"
            dir="ltr"
            value={data.pieces || '1'}
            onChange={(e) => onChange('pieces', e.target.value)}
            className="flex-1 bg-transparent text-center text-sm font-cairo text-[#222] focus:outline-none py-1.5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => handleStepperChange(1)}
            className="px-3 py-1.5 text-[#e2495c] font-bold text-lg leading-none hover:bg-[#e2495c]/10 transition-colors active:scale-90 select-none"
            aria-label="زيادة"
          >
            +
          </button>
        </div>
      </div>

      {/* الوزن بالكيلو — read-only, auto-calculated */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-[#1a1a2e] text-center">
          الوزن بالكيلو
          <span className="mr-1 text-[10px] font-normal text-gray-400">(تلقائي)</span>
        </label>
        <div className="w-full bg-[#f0eff8] border-2 border-[#e2495c] rounded px-2 py-1.5 text-sm font-cairo text-[#555] text-center">
          {weightDisplay}
        </div>
        {chocolateName && !ratio && (
          <p className="text-[10px] text-center text-amber-600 font-cairo">
            نسبة التحويل غير محددة — راجع جدول البحث
          </p>
        )}
      </div>

      {/* ملاحظات */}
      <TextareaField
        label="ملاحظات"
        id="notes"
        value={data.notes || ''}
        onChange={(v) => onChange('notes', v)}
        rows={3}
      />
    </div>
  );
}

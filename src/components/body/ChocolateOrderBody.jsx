import SelectField from '../ui/SelectField';
import TextField from '../ui/TextField';
import TextareaField from '../ui/TextareaField';
import {
  CHOCOLATE_TYPES,
  CHOCOLATE_NAMES,
  CHOCOLATE_FILLING_MAP,
  CHOCOLATE_UNIT_MAP,
  CHOCOLATE_FILLING_UNIT_MAP,
  DEFAULT_CHOCOLATE_UNIT,
} from '../../constants/chocolateOrderFields';

/**
 * Body fields for Chocolate orders — Tab 3.
 *
 * Changes vs original:
 *   - نوع الشوكولا: added بلجيكي and وطني options (via updated constant)
 *   - "نوع الحشو" → "اسم الشوكولا" (label rename; field id 'fillingType' preserved)
 *   - "طريقة التغليف" field label → "لون الورق" (field id 'wrappingMethod' preserved)
 *   - الكمية: conditional unit label derived from selected نوع الشوكولا and اسم الشوكولا
 */
export default function ChocolateOrderBody({ data, onChange }) {
  // Derive unit label from selected chocolate filling (priority) or type
  const quantityUnit = CHOCOLATE_FILLING_UNIT_MAP[data.fillingType] || CHOCOLATE_UNIT_MAP[data.chocolateType] || DEFAULT_CHOCOLATE_UNIT;

  // Dynamically load options based on selected type, fallback to all names
  const fillingOptions = data.chocolateType && CHOCOLATE_FILLING_MAP[data.chocolateType]
    ? CHOCOLATE_FILLING_MAP[data.chocolateType]
    : CHOCOLATE_NAMES;

  return (
    <div className="grid grid-cols-2 gap-2">

      {/* نوع الشوكولا — now includes بلجيكي and وطني */}
      <SelectField
        label="نوع الشوكولا"
        id="chocolateType"
        options={CHOCOLATE_TYPES}
        value={data.chocolateType || ''}
        onChange={(v) => onChange('chocolateType', v)}
        withOther
        placeholder="اختر"
      />

      {/* لون الورق — was "طريقة التغليف"; label replaced, field id 'wrappingMethod' preserved */}
      <SelectField
        label="لون الورق"
        id="wrappingMethod"
        options={['أبيض', 'ذهبي', 'فضي', 'أحمر', 'أسود', 'وردي', 'أزرق']}
        value={data.wrappingMethod || ''}
        onChange={(v) => onChange('wrappingMethod', v)}
        withOther
        placeholder="اختر"
      />

      {/* اسم الشوكولا — was "نوع الحشو"; label renamed, field id 'fillingType' preserved */}
      <SelectField
        label="اسم الشوكولا"
        id="fillingType"
        options={fillingOptions}
        value={data.fillingType || ''}
        onChange={(v) => onChange('fillingType', v)}
        withOther
        placeholder="اختر"
      />

      {/* الكمية — unit label driven by نوع الشوكولا */}
      <div className="flex flex-col gap-1">
        <label htmlFor="chocolateQuantity" className="text-xs font-bold text-[#1a1a2e] text-center">
          الكمية
          {quantityUnit && (
            <span className="mr-1 text-[10px] font-normal text-[#e2495c]">
              ({quantityUnit})
            </span>
          )}
        </label>
        <input
          id="chocolateQuantity"
          type="number"
          dir="ltr"
          value={data.quantity || ''}
          onChange={(e) => onChange('quantity', e.target.value)}
          className="w-full bg-[#eceafa] border-2 border-[#e2495c] rounded px-2 py-1.5 text-sm font-cairo text-[#222] focus:outline-none focus:border-[#b01c2e] focus:ring-1 focus:ring-[#e2495c]/30"
        />
      </div>

      {/* المواصفات */}
      <TextareaField
        label="المواصفات"
        id="specifications"
        value={data.specifications || ''}
        onChange={(v) => onChange('specifications', v)}
        rows={2}
      />

      {/* ملاحظات */}
      <TextareaField
        label="ملاحظات"
        id="notes"
        value={data.notes || ''}
        onChange={(v) => onChange('notes', v)}
        rows={2}
      />
    </div>
  );
}

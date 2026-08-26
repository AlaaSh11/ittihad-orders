import SelectField from '../ui/SelectField';
import TextField from '../ui/TextField';
import TextareaField from '../ui/TextareaField';
import {
  CHOCOLATE_TYPES,
  CHOCOLATE_UNIT_MAP,
  DEFAULT_CHOCOLATE_UNIT,
  CHOCOLATE_PAPER_COLORS,
} from '../../constants/chocolateOrderFields';

/**
 * Body fields for Chocolate orders — Tab 3.
 */
export default function ChocolateOrderBody({ data, onChange }) {
  // Derive unit label from selected chocolate type
  const quantityUnit = CHOCOLATE_UNIT_MAP[data.chocolateType] || DEFAULT_CHOCOLATE_UNIT;

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

      {/* لون ورق اللف — was "طريقة التغليف"; label replaced, field id 'wrappingMethod' preserved */}
      <SelectField
        label="لون ورق اللف"
        id="wrappingMethod"
        options={CHOCOLATE_PAPER_COLORS}
        value={data.wrappingMethod || ''}
        onChange={(v) => onChange('wrappingMethod', v)}
        withOther
        placeholder="اختر"
      />

      {/* الكمية — unit label driven by نوع الشوكولا */}
      <div className="flex flex-col gap-1 col-span-full">
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

import SelectField from '../ui/SelectField';
import TextField from '../ui/TextField';
import TextareaField from '../ui/TextareaField';
import {
  HOSPITALITY_TYPES,
  OCCASION_WRAPPING_COLORS,
  OCCASION_WRAPPING_METHODS,
  OCCASION_BASKET_COUNTS,
} from '../../constants/occasionCatalog';

/**
 * Body fields for Occasion orders — Tab 2.
 *
 * Changes vs original:
 *   - hospitalityType: free text → SelectField with typed HOSPITALITY_TYPES list
 *   - الكمية: unit label switches automatically based on selected hospitalityType
 *   - basketCount: single-select → MultiSelectField (value is now an array)
 *   - لون ورق اللف: removed entirely
 *   - "عدد النوابيس" label → "عدد الوايبس"
 */
export default function OccasionOrderBody({ data, onChange }) {
  // Derive the unit label for الكمية from the selected نوع الضيافة
  const hospitalityEntry = HOSPITALITY_TYPES.find(
    (t) => t.label === data.hospitalityType
  );
  const quantityUnit = hospitalityEntry?.unit || '';

  return (
    <div className="grid grid-cols-2 gap-2">
      {/* نوع الضيافة — now a dropdown with typed options */}
      <SelectField
        label="نوع الضيافة"
        id="hospitalityType"
        options={HOSPITALITY_TYPES.map((t) => t.label)}
        value={data.hospitalityType || ''}
        onChange={(v) => onChange('hospitalityType', v)}
        withOther
        placeholder="اختر"
      />

      {/* الكمية — unit label derived from نوع الضيافة */}
      <div className="flex flex-col gap-1">
        <label htmlFor="quantity" className="text-xs font-bold text-[#1a1a2e] text-center">
          الكمية
          {quantityUnit && (
            <span className="mr-1 text-[10px] font-normal text-[#e2495c]">
              ({quantityUnit})
            </span>
          )}
        </label>
        <input
          id="quantity"
          type="number"
          dir="ltr"
          value={data.quantity || ''}
          onChange={(e) => onChange('quantity', e.target.value)}
          className="w-full bg-[#eceafa] border-2 border-[#e2495c] rounded px-2 py-1.5 text-sm font-cairo text-[#222] focus:outline-none focus:border-[#b01c2e] focus:ring-1 focus:ring-[#e2495c]/30"
        />
      </div>

      {/* طريقة اللف */}
      <SelectField
        label="طريقة اللف"
        id="wrappingMethod"
        options={OCCASION_WRAPPING_METHODS}
        value={data.wrappingMethod || ''}
        onChange={(v) => onChange('wrappingMethod', v)}
        withOther
        placeholder="اختر"
      />

      {/* لون التغليف */}
      <SelectField
        label="لون التغليف"
        id="wrappingColor"
        options={OCCASION_WRAPPING_COLORS}
        value={data.wrappingColor || ''}
        onChange={(v) => onChange('wrappingColor', v)}
        withOther
        placeholder="اختر"
      />

      {/* لون الوردة */}
      <TextField
        label="لون الوردة"
        id="flowerColor"
        value={data.flowerColor || ''}
        onChange={(v) => onChange('flowerColor', v)}
        placeholder="لون الوردة"
      />

      {/* عدد المحارم */}
      <TextField
        label="عدد المحارم"
        id="tissueCount"
        type="number"
        dir="ltr"
        value={data.tissueCount || ''}
        onChange={(v) => onChange('tissueCount', v)}
      />

      {/* عدد الوايبس — relabeled from "عدد النوابيس" / "عدد اللوابيس"; field id unchanged */}
      <TextField
        label="عدد الوايبس"
        id="napkinHolderCount"
        type="number"
        dir="ltr"
        value={data.napkinHolderCount || ''}
        onChange={(v) => onChange('napkinHolderCount', v)}
      />

      {/* عدد السلال — now single-select */}
      <SelectField
        label="عدد السلال/صواني"
        id="basketCount"
        options={OCCASION_BASKET_COUNTS}
        value={data.basketCount || ''}
        onChange={(v) => onChange('basketCount', v)}
      />

      {/* لون ورق اللف — REMOVED per spec */}

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

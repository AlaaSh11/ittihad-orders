import SelectField from '../ui/SelectField';
import TextField from '../ui/TextField';
import TextareaField from '../ui/TextareaField';
import {
  HOSPITALITY_TYPES,
  OCCASION_WRAPPING_COLORS,
  OCCASION_WRAPPING_METHODS,
  OCCASION_BASKET_COUNTS,
  OCCASION_WRAPPING_PAPER_COLORS,
} from '../../constants/occasionCatalog';
import {
  CHOCOLATE_TYPES,
  CHOCOLATE_NAMES,
  CHOCOLATE_FILLING_MAP,
  CHOCOLATE_UNIT_MAP,
  CHOCOLATE_FILLING_UNIT_MAP,
  DEFAULT_CHOCOLATE_UNIT,
} from '../../constants/chocolateOrderFields';

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

  // Derive unit label from selected chocolate filling (priority) or type
  const chocolateQuantityUnit = data.chocolateType || data.chocolateFilling 
    ? (CHOCOLATE_FILLING_UNIT_MAP[data.chocolateFilling] || CHOCOLATE_UNIT_MAP[data.chocolateType] || DEFAULT_CHOCOLATE_UNIT) 
    : '';

  // Dynamically load chocolate filling options based on selected type
  const chocolateFillingOptions = data.chocolateType && CHOCOLATE_FILLING_MAP[data.chocolateType]
    ? CHOCOLATE_FILLING_MAP[data.chocolateType]
    : CHOCOLATE_NAMES;

  return (
    <div className="grid grid-cols-2 gap-2">
      {/* نوع الضيافة */}
      <SelectField
        label="نوع الضيافة"
        id="hospitalityType"
        options={HOSPITALITY_TYPES.map((t) => t.label)}
        value={data.hospitalityType || ''}
        onChange={(v) => onChange('hospitalityType', v)}
        withOther
        placeholder="اختر"
      />

      {/* الكمية */}
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

      {/* عدد السلال */}
      <SelectField
        label="عدد السلال"
        id="basketCount"
        options={OCCASION_BASKET_COUNTS}
        value={data.basketCount || ''}
        onChange={(v) => onChange('basketCount', v)}
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

      {/* عدد الوايبس */}
      <TextField
        label="عدد الوايبس"
        id="napkinHolderCount"
        type="number"
        dir="ltr"
        value={data.napkinHolderCount || ''}
        onChange={(v) => onChange('napkinHolderCount', v)}
      />

      {/* ── Chocolate Section (Added per Excel spec) ── */}
      
      {/* نوع الشوكولا */}
      <SelectField
        label="نوع الشوكولا"
        id="chocolateType"
        options={CHOCOLATE_TYPES}
        value={data.chocolateType || ''}
        onChange={(v) => onChange('chocolateType', v)}
        withOther
        placeholder="اختر"
      />

      {/* الحشوة */}
      <SelectField
        label="الحشوة"
        id="chocolateFilling"
        options={chocolateFillingOptions}
        value={data.chocolateFilling || ''}
        onChange={(v) => onChange('chocolateFilling', v)}
        withOther
        placeholder="اختر"
      />

      {/* كمية الشوكولا */}
      <div className="flex flex-col gap-1">
        <label htmlFor="chocolateQuantity" className="text-xs font-bold text-[#1a1a2e] text-center">
          كمية الشوكولا
          {chocolateQuantityUnit && (
            <span className="mr-1 text-[10px] font-normal text-[#e2495c]">
              ({chocolateQuantityUnit})
            </span>
          )}
        </label>
        <input
          id="chocolateQuantity"
          type="number"
          dir="ltr"
          value={data.chocolateQuantity || ''}
          onChange={(e) => onChange('chocolateQuantity', e.target.value)}
          className="w-full bg-[#eceafa] border-2 border-[#e2495c] rounded px-2 py-1.5 text-sm font-cairo text-[#222] focus:outline-none focus:border-[#b01c2e] focus:ring-1 focus:ring-[#e2495c]/30"
        />
      </div>

      {/* مصدر الشوكولا */}
      <TextField
        label="مصدر الشوكولا"
        id="chocolateSource"
        value={data.chocolateSource || ''}
        onChange={(v) => onChange('chocolateSource', v)}
        placeholder="مصدر الشوكولا"
      />

      {/* عدد الصواني */}
      <TextField
        label="عدد الصواني"
        id="trayCount"
        type="number"
        dir="ltr"
        value={data.trayCount || ''}
        onChange={(v) => onChange('trayCount', v)}
      />

      {/* لون ورق اللف */}
      <SelectField
        label="لون ورق اللف"
        id="wrappingPaperColor"
        options={OCCASION_WRAPPING_PAPER_COLORS}
        value={data.wrappingPaperColor || ''}
        onChange={(v) => onChange('wrappingPaperColor', v)}
        withOther
        placeholder="اختر"
      />

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

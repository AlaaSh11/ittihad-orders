import SelectField from '../ui/SelectField';
import TextField from '../ui/TextField';
import TextareaField from '../ui/TextareaField';
import {
  OCCASION_WRAPPING_PAPER_COLORS,
  OCCASION_WRAPPING_COLORS,
  OCCASION_WRAPPING_METHODS,
  OCCASION_BASKET_COUNTS,
} from '../../constants/occasionCatalog';

/**
 * Body fields for Occasion orders — Section 5.3 of the build spec.
 */
export default function OccasionOrderBody({ data, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {/* نوع الضيافة */}
      <TextField
        label="نوع الضيافة"
        id="hospitalityType"
        value={data.hospitalityType || ''}
        onChange={(v) => onChange('hospitalityType', v)}
        placeholder="نوع الضيافة"
      />

      {/* الكمية */}
      <TextField
        label="الكمية"
        id="quantity"
        type="number"
        dir="ltr"
        value={data.quantity || ''}
        onChange={(v) => onChange('quantity', v)}
      />

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
        withOther
        placeholder="اختر"
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

      {/* عدد النوابيس */}
      <TextField
        label="عدد النوابيس"
        id="napkinHolderCount"
        type="number"
        dir="ltr"
        value={data.napkinHolderCount || ''}
        onChange={(v) => onChange('napkinHolderCount', v)}
      />

      {/* لون ورق اللف */}
      <div className="col-span-2">
        <SelectField
          label="لون ورق اللف"
          id="wrappingPaperColor"
          options={OCCASION_WRAPPING_PAPER_COLORS}
          value={data.wrappingPaperColor || ''}
          onChange={(v) => onChange('wrappingPaperColor', v)}
          withOther
          placeholder="اختر"
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

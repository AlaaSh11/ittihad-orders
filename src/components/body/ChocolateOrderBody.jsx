// ⚠️ UNCONFIRMED: All field names and option values in this component are placeholder guesses.
// No chocolate order data was found in the existing codebase. Verify with shop before use.

import SelectField from '../ui/SelectField';
import TextField from '../ui/TextField';
import TextareaField from '../ui/TextareaField';
import {
  CHOCOLATE_TYPES,
  CHOCOLATE_WRAPPING_METHODS,
  CHOCOLATE_FILLING_TYPES,
} from '../../constants/chocolateOrderFields';

/**
 * Body fields for Chocolate orders — Section 5.2 of the build spec.
 * ⚠️ UNCONFIRMED PLACEHOLDER — verify all fields/options with shop.
 */
export default function ChocolateOrderBody({ data, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">

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

      {/* طريقة التغليف */}
      <SelectField
        label="طريقة التغليف"
        id="wrappingMethod"
        options={CHOCOLATE_WRAPPING_METHODS}
        value={data.wrappingMethod || ''}
        onChange={(v) => onChange('wrappingMethod', v)}
        withOther
        placeholder="اختر"
      />

      {/* نوع الحشو */}
      <SelectField
        label="نوع الحشو"
        id="fillingType"
        options={CHOCOLATE_FILLING_TYPES}
        value={data.fillingType || ''}
        onChange={(v) => onChange('fillingType', v)}
        withOther
        placeholder="اختر"
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

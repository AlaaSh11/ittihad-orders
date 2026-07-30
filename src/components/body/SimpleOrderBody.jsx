// ⚠️ UNCONFIRMED: No simple order data found in existing codebase.
// Minimal field set from master build prompt Section 5.4 — verify with shop.

import TextField from '../ui/TextField';
import TextareaField from '../ui/TextareaField';

/**
 * Body fields for Simple orders — Section 5.4 of the build spec.
 * ⚠️ UNCONFIRMED PLACEHOLDER — verify fields with shop before use.
 */
export default function SimpleOrderBody({ data, onChange }) {
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

      {/* الكمية */}
      <div className="col-span-2">
        <TextField
          label="الكمية"
          id="quantity"
          type="number"
          dir="ltr"
          value={data.quantity || ''}
          onChange={(v) => onChange('quantity', v)}
        />
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

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
  // Backwards compatibility or initialize array
  const items = Array.isArray(data.items) && data.items.length > 0
    ? data.items
    : [{ itemName: data.itemName || '', pieces: data.pieces || '', weight: data.weight || '', notes: data.notes || '' }];

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange('items', newItems);
  };

  const handleAddItem = () => {
    onChange('items', [...items, { itemName: '', pieces: '', weight: '', notes: '' }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    onChange('items', newItems);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Dynamic Item Rows */}
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm relative">
          <div className="flex items-end gap-2">
            <div className="grid grid-cols-4 gap-2 flex-1">
              <div className="col-span-2">
                <TextField
                  label={index === 0 ? "الصنف" : undefined}
                  id={`itemName-${index}`}
                  value={item.itemName || ''}
                  onChange={(v) => handleItemChange(index, 'itemName', v)}
                />
              </div>
              <TextField
                label={index === 0 ? "حبة" : undefined}
                id={`pieces-${index}`}
                type="number"
                min="1"
                dir="ltr"
                value={item.pieces || ''}
                onChange={(v) => handleItemChange(index, 'pieces', v)}
              />
              <TextField
                label={index === 0 ? "كيلو" : undefined}
                id={`weight-${index}`}
                dir="ltr"
                value={item.weight || ''}
                onChange={(v) => handleItemChange(index, 'weight', v)}
              />
            </div>
            
            {/* Remove Button for extra rows */}
            {items.length > 1 ? (
              <button 
                type="button"
                onClick={() => handleRemoveItem(index)}
                className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded px-2 py-1.5 font-bold mb-0.5 border border-transparent transition-colors"
                title="حذف الصنف"
              >
                ✕
              </button>
            ) : (
              <div className="w-8"></div> // Spacer
            )}
          </div>

          {/* Item Specific Notes */}
          <div className="pr-1">
            <TextField
              id={`notes-${index}`}
              placeholder="ملاحظات خاصة بهذا الصنف..."
              value={item.notes || ''}
              onChange={(v) => handleItemChange(index, 'notes', v)}
            />
          </div>
        </div>
      ))}

      {/* Add Item Button */}
      <div className="flex justify-start mt-1">
        <button 
          type="button"
          onClick={handleAddItem}
          className="flex items-center gap-1.5 text-indigo-700 font-bold text-sm font-cairo px-3 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 transition-colors border border-indigo-200 shadow-sm active:scale-[0.98]"
        >
          <span className="text-lg leading-none">➕</span> 
          إضافة صنف إضافي
        </button>
      </div>
    </div>
  );
}

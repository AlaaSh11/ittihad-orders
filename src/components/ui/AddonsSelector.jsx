/**
 * AddonsSelector — Multi-select chip component for cake add-ons.
 *
 * Props:
 *   options   {Array<{id, label, price}>}  Full list of available add-ons
 *   selected  {string[]}                   Array of selected addon IDs
 *   onChange  {fn}                         Called with updated array of IDs
 */
export default function AddonsSelector({ options = [], selected = [], onChange }) {
  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    onChange(next);
  };

  const totalAddonsPrice = options
    .filter((o) => selected.includes(o.id))
    .reduce((sum, o) => sum + (o.price || 0), 0);

  return (
    <div className="flex flex-col gap-2 col-span-full">
      <label className="text-xs font-bold text-[#1a1a2e] text-center">
        إضافات / اكسسوارات
      </label>

      <div className="flex flex-wrap gap-2 justify-center">
        {options.map((addon) => {
          const isSelected = selected.includes(addon.id);
          return (
            <button
              key={addon.id}
              type="button"
              onClick={() => toggle(addon.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-cairo font-bold
                border-2 transition-all duration-150 active:scale-95 select-none
                ${isSelected
                  ? 'bg-[#e2495c] border-[#b01c2e] text-white shadow-sm'
                  : 'bg-[#eceafa] border-[#e2495c] text-[#1a1a2e] hover:bg-[#ddd8f0]'
                }
              `}
            >
              {isSelected && <span className="text-xs">✓</span>}
              {addon.label}
              {addon.price > 0 && (
                <span className={`text-[10px] font-normal ${isSelected ? 'text-white/80' : 'text-[#666]'}`}>
                  +{addon.price}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected.length === 0 && (
        <p className="text-center text-[10px] text-gray-400 font-cairo">
          اضغط على الإضافة لتحديدها
        </p>
      )}

      {totalAddonsPrice > 0 && (
        <p className="text-center text-xs font-bold text-[#e2495c] font-cairo">
          إجمالي الإضافات: {totalAddonsPrice}
        </p>
      )}
    </div>
  );
}

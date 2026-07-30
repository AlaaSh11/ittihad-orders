const ORDER_TYPES = [
  { id: 'cake',      label: 'طلب كيك' },
  { id: 'chocolate', label: 'طلب شوكولا' },
  { id: 'occasion',  label: 'طلب مناسبة' },
  { id: 'simple',    label: 'طلب بسيط' },
];

/**
 * Segmented tab control for selecting order type.
 * Swaps only the body — header and footer stay mounted.
 *
 * Props:
 *   value    {string}  Active order type id
 *   onChange {fn}      Called with the new type id
 */
export default function OrderTypeSelector({ value, onChange }) {
  return (
    <div className="flex rounded-lg overflow-hidden border-2 border-[#e2495c] mb-3 print:hidden">
      {ORDER_TYPES.map((type) => (
        <button
          key={type.id}
          type="button"
          onClick={() => onChange(type.id)}
          className={`flex-1 py-2 text-sm font-bold font-cairo transition-colors
            ${value === type.id
              ? 'bg-[#e2495c] text-white'
              : 'bg-white text-[#e2495c] hover:bg-[#fdf0f2]'
            }`}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}

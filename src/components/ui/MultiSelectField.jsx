/**
 * MultiSelectField — Labeled native multi-select with brand styling.
 *
 * Props:
 *   label     {string}    Arabic field label
 *   id        {string}    HTML id
 *   options   {string[]}  Dropdown option strings
 *   value     {string[]}  Controlled array of selected values
 *                         (backward-compat: if a string is passed, wraps it in [])
 *   onChange  {fn}        Called with updated string[]
 *   rows      {number}    Visible rows in the select box (default 4)
 *   className {string}
 */
export default function MultiSelectField({
  label,
  id,
  options = [],
  value = [],
  onChange,
  rows = 4,
  className = '',
}) {
  // Backward-compat: old string data from before multi-select
  const safeValue = Array.isArray(value) ? value : (value ? [value] : []);

  const handleChange = (e) => {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
    onChange(selected);
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs font-bold text-[#1a1a2e] text-center">
          {label}
        </label>
      )}
      <select
        id={id}
        multiple
        size={rows}
        value={safeValue}
        onChange={handleChange}
        className="w-full bg-[#eceafa] border-2 border-[#e2495c] rounded px-2 py-1 text-sm font-cairo text-[#222] focus:outline-none focus:border-[#b01c2e] focus:ring-1 focus:ring-[#e2495c]/30"
        dir="rtl"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {safeValue.length > 0 && (
        <p className="text-[10px] text-center text-[#666] font-cairo">
          تم اختيار: {safeValue.join('، ')}
        </p>
      )}
      <p className="text-[10px] text-center text-gray-400 font-cairo">
        اضغط مع Ctrl لاختيار أكثر من قيمة
      </p>
    </div>
  );
}

/**
 * Full-width labeled textarea with the brand red border.
 *
 * Props:
 *   label     {string}
 *   id        {string}
 *   value     {string}
 *   onChange  {fn}
 *   rows      {number}  Default 4
 *   placeholder {string}
 *   className {string}
 */
export default function TextareaField({
  label,
  id,
  value = '',
  onChange,
  rows = 4,
  placeholder = '',
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-1 col-span-full ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs font-bold text-[#1a1a2e] text-center">
          {label}
        </label>
      )}
      <textarea
        id={id}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        rows={rows}
        placeholder={placeholder}
        dir="rtl"
        className="w-full bg-[#eceafa] border-2 border-[#e2495c] rounded px-2 py-1.5 text-sm font-cairo text-[#222] focus:outline-none focus:border-[#b01c2e] focus:ring-1 focus:ring-[#e2495c]/30 resize-y text-center"
      />
    </div>
  );
}

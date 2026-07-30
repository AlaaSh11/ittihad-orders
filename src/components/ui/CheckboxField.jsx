/**
 * Labeled checkbox with the brand red accent.
 *
 * Props:
 *   label     {string}
 *   id        {string}
 *   checked   {boolean}
 *   onChange  {fn}  Called with boolean
 *   className {string}
 */
export default function CheckboxField({ label, id, checked = false, onChange, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-end pb-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs font-bold text-[#1a1a2e] text-center mb-1">
          {label}
        </label>
      )}
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="w-5 h-5 accent-[#e2495c] cursor-pointer"
      />
    </div>
  );
}

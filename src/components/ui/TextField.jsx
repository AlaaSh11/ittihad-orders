/**
 * Labeled text/number/tel/date input with the brand red border.
 *
 * Props:
 *   label       {string}
 *   id          {string}
 *   type        {string}   Default 'text'
 *   value       {string|number}
 *   onChange    {fn}
 *   placeholder {string}
 *   readOnly    {boolean}
 *   disabled    {boolean}
 *   dir         {'rtl'|'ltr'}  Default 'rtl'. Use 'ltr' for phone/price/numeric.
 *   className   {string}
 *   inputClassName {string}
 */
export default function TextField({
  label,
  id,
  type = 'text',
  value = '',
  onChange,
  placeholder = '',
  readOnly = false,
  disabled = false,
  dir = 'rtl',
  className = '',
  inputClassName = '',
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs font-bold text-[#1a1a2e] text-center">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        dir={dir}
        className={`w-full bg-[#eceafa] border-2 border-[#e2495c] rounded px-2 py-1.5 text-sm font-cairo text-[#222] focus:outline-none focus:border-[#b01c2e] focus:ring-1 focus:ring-[#e2495c]/30 read-only:bg-[#f0eff8] disabled:opacity-60 disabled:cursor-not-allowed ${inputClassName}`}
      />
    </div>
  );
}

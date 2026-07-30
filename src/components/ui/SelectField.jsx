import { useState } from 'react';

/**
 * Labeled <select> with optional "أخرى" free-text fallback.
 *
 * Props:
 *   label        {string}    Arabic field label
 *   id           {string}    HTML id (also used to generate the custom input id)
 *   options      {string[]}  Dropdown option strings
 *   value        {string}    Controlled value
 *   onChange     {fn}        Called with the resolved string value (including custom text)
 *   withOther    {boolean}   Whether to append an "أخرى" option + custom text input
 *   disabled     {boolean}
 *   required     {boolean}
 *   placeholder  {string}    First disabled placeholder option text
 *   className    {string}    Extra wrapper classes
 */
export default function SelectField({
  label,
  id,
  options = [],
  value = '',
  onChange,
  withOther = false,
  disabled = false,
  required = false,
  placeholder = 'اختر',
  className = '',
}) {
  const OTHER = 'أخرى';
  const isOther = withOther && value === OTHER;
  const [customText, setCustomText] = useState('');

  const handleSelect = (e) => {
    const v = e.target.value;
    if (v === OTHER) {
      setCustomText('');
      onChange(OTHER);
    } else {
      onChange(v);
    }
  };

  const handleCustom = (e) => {
    setCustomText(e.target.value);
    onChange(e.target.value); // Pass the typed text directly up
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
        value={isOther ? OTHER : value}
        onChange={handleSelect}
        disabled={disabled}
        required={required}
        className="w-full bg-[#eceafa] border-2 border-[#e2495c] rounded px-2 py-1.5 text-sm font-cairo text-[#222] focus:outline-none focus:border-[#b01c2e] focus:ring-1 focus:ring-[#e2495c]/30 disabled:opacity-60 disabled:cursor-not-allowed appearance-auto"
        dir="rtl"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        {withOther && <option value={OTHER}>{OTHER}</option>}
      </select>

      {isOther && (
        <input
          id={`${id}_custom`}
          type="text"
          value={customText}
          onChange={handleCustom}
          placeholder="اكتب هنا..."
          autoFocus
          className="w-full bg-[#fff8f8] border-2 border-dashed border-[#e2495c] rounded px-2 py-1.5 text-sm font-cairo text-[#222] focus:outline-none focus:border-[#b01c2e] animate-fade-in"
          dir="rtl"
        />
      )}
    </div>
  );
}

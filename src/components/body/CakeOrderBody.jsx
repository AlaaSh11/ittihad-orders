import { useEffect } from 'react';
import SelectField from '../ui/SelectField';
import TextField from '../ui/TextField';
import TextareaField from '../ui/TextareaField';
import {
  CAKE_SHAPES, DEFAULT_CAKE_SHAPE,
  CAKE_TYPES, DEFAULT_CAKE_TYPE,
  CAKE_FLAVORS,
  CAKE_FILLINGS,
  CAKE_COLORS,
  WRITE_ON_OPTIONS,
  INSCRIPTION_PRESETS,
  PHOTO_SIZES, DEFAULT_PHOTO_SIZE,
  PHOTO_SOURCES, DEFAULT_PHOTO_SOURCE,
} from '../../constants/cakeOrderFields';
import { CAKE_SIZE_CHART } from '../../constants/cakeSizeChart';

/**
 * Body fields for Cake orders — Section 5.1 of the build spec.
 *
 * Props:
 *   data     {Object}  Controlled body state
 *   onChange {fn}      (field, value) => void
 */
export default function CakeOrderBody({ data, onChange }) {
  // Auto-fill cakeSize when serves changes
  useEffect(() => {
    const entry = CAKE_SIZE_CHART.find((e) => String(e.serves) === String(data.serves));
    if (entry) {
      onChange('cakeSize', entry.size);
    }
    // Note: field stays editable after auto-fill
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.serves]);

  return (
    <div className="grid grid-cols-2 gap-2">
      {/* الشكل */}
      <SelectField
        label="الشكل"
        id="cakeShape"
        options={CAKE_SHAPES}
        value={data.cakeShape || DEFAULT_CAKE_SHAPE}
        onChange={(v) => onChange('cakeShape', v)}
        withOther
      />

      {/* نوع القالب */}
      <SelectField
        label="نوع القالب"
        id="cakeType"
        options={CAKE_TYPES}
        value={data.cakeType || DEFAULT_CAKE_TYPE}
        onChange={(v) => onChange('cakeType', v)}
        withOther
      />

      {/* النكهة */}
      <SelectField
        label="النكهة"
        id="cakeFlavor"
        options={CAKE_FLAVORS}
        value={data.cakeFlavor || ''}
        onChange={(v) => onChange('cakeFlavor', v)}
        withOther
        placeholder="اختر"
      />

      {/* الحشوة */}
      <SelectField
        label="الحشوة"
        id="cakeFilling"
        options={CAKE_FILLINGS}
        value={data.cakeFilling || ''}
        onChange={(v) => onChange('cakeFilling', v)}
        withOther
        placeholder="اختر"
      />

      {/* القياس — auto-filled from serves */}
      <TextField
        label="القياس"
        id="cakeSize"
        dir="ltr"
        value={data.cakeSize || ''}
        onChange={(v) => onChange('cakeSize', v)}
        placeholder="القياس"
      />

      {/* عدد الأشخاص — triggers auto-fill */}
      <SelectField
        label="عدد الأشخاص"
        id="serves"
        options={[...CAKE_SIZE_CHART].sort((a, b) => a.serves - b.serves).map((e) => String(e.serves))}
        value={data.serves ? String(data.serves) : ''}
        onChange={(v) => onChange('serves', v)}
        withOther
        placeholder="اختر"
      />

      {/* لون القالب */}
      <SelectField
        label="لون القالب"
        id="cakeColor"
        options={CAKE_COLORS}
        value={data.cakeColor || ''}
        onChange={(v) => onChange('cakeColor', v)}
        withOther
        placeholder="اختر"
      />


      {/* الكتابة على */}
      <SelectField
        label="الكتابة على"
        id="writeOn"
        options={WRITE_ON_OPTIONS}
        value={data.writeOn || ''}
        onChange={(v) => onChange('writeOn', v)}
        withOther
        placeholder="اختر"
      />

      {/* حجم الصورة */}
      <SelectField
        label="حجم الصورة"
        id="photoSize"
        options={PHOTO_SIZES}
        value={data.photoSize || DEFAULT_PHOTO_SIZE}
        onChange={(v) => onChange('photoSize', v)}
        withOther
      />

      {/* مصدر الصورة */}
      <SelectField
        label="مصدر الصورة"
        id="photoSource"
        options={PHOTO_SOURCES}
        value={data.photoSource || DEFAULT_PHOTO_SOURCE}
        onChange={(v) => onChange('photoSource', v)}
        withOther
      />

      {/* الكتابة — free text with datalist presets */}
      <div className="flex flex-col gap-1 col-span-2">
        <label htmlFor="inscription" className="text-xs font-bold text-[#1a1a2e] text-center">
          الكتابة
        </label>
        <input
          id="inscription"
          list="inscriptionList"
          type="text"
          value={data.inscription || ''}
          onChange={(e) => onChange('inscription', e.target.value)}
          placeholder="اختر أو اكتب..."
          dir="rtl"
          className="w-full bg-[#eceafa] border-2 border-[#e2495c] rounded px-2 py-1.5 text-sm font-cairo text-[#222] text-center focus:outline-none focus:border-[#b01c2e] focus:ring-1 focus:ring-[#e2495c]/30"
        />
        <datalist id="inscriptionList">
          {INSCRIPTION_PRESETS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>

      {/* ملاحظات — full width */}
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

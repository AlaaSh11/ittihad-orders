import { useEffect } from 'react';
import SelectField from '../ui/SelectField';
import TextField from '../ui/TextField';
import AddonsSelector from '../ui/AddonsSelector';
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
  SHAPE_SERVES_MAP,
  CAKE_ADDONS,
} from '../../constants/cakeOrderFields';
import { CAKE_SIZE_CHART } from '../../constants/cakeSizeChart';

/**
 * Body fields for Cake orders — Tab 1.
 *
 * Dependency chains:
 *   الشكل → عدد الأشخاص  (shape filters which serve counts are available)
 *   عدد الأشخاص → القياس  (serves auto-fills the size field from CAKE_SIZE_CHART)
 *
 * Props:
 *   data     {Object}  Controlled body state
 *   onChange {fn}      (field, value) => void
 */
export default function CakeOrderBody({ data, onChange }) {
  const shape = data.cakeShape || DEFAULT_CAKE_SHAPE;

  // Derive the allowed serve options for the currently selected shape.
  // Falls back to all sizes if the shape isn't in the map.
  const allowedServes = SHAPE_SERVES_MAP[shape]
    || CAKE_SIZE_CHART.map((e) => e.serves);

  const serveOptions = [...CAKE_SIZE_CHART]
    .filter((e) => allowedServes.includes(e.serves))
    .sort((a, b) => a.serves - b.serves)
    .map((e) => String(e.serves));

  // When shape changes, reset serves + size if current serves is no longer valid
  useEffect(() => {
    const currentServes = Number(data.serves);
    if (data.serves && !allowedServes.includes(currentServes)) {
      onChange('serves', '');
      onChange('cakeSize', '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape]);

  // Auto-fill cakeSize when serves changes (People → Size chain)
  useEffect(() => {
    const entry = CAKE_SIZE_CHART.find((e) => String(e.serves) === String(data.serves));
    if (entry) {
      onChange('cakeSize', entry.size);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.serves]);

  return (
    <div className="grid grid-cols-2 gap-2">
      {/* الشكل — triggers serve filter */}
      <SelectField
        label="الشكل"
        id="cakeShape"
        options={CAKE_SHAPES}
        value={shape}
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

      {/* عدد الأشخاص — filtered by shape; triggers size auto-fill */}
      <SelectField
        label="عدد الأشخاص"
        id="serves"
        options={serveOptions}
        value={data.serves ? String(data.serves) : ''}
        onChange={(v) => onChange('serves', v)}
        withOther
        placeholder="اختر"
      />

      {/* القياس — auto-filled from عدد الأشخاص; still manually editable */}
      <TextField
        label="القياس"
        id="cakeSize"
        dir="ltr"
        value={data.cakeSize || ''}
        onChange={(v) => onChange('cakeSize', v)}
        placeholder="يتعبأ تلقائياً"
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

      {/* حجم الصورة — includes "بلا صورة" option */}
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

      {/* إضافات / اكسسوارات — chip multi-select (replaces ملاحظات textarea) */}
      <AddonsSelector
        options={CAKE_ADDONS}
        selected={Array.isArray(data.addons) ? data.addons : []}
        onChange={(ids) => onChange('addons', ids)}
      />

      {/* ── Reference Photo Attachment ── */}
      <div className="col-span-2 mt-2 bg-purple-50/60 border border-purple-200 rounded-xl p-3">
        <label className="text-xs font-bold text-[#1a1a2e] block mb-2 text-center font-cairo">
          صورة مرجعية (اختياري)
        </label>
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
          {data.referencePhoto ? (
            <div className="relative border border-purple-300 rounded-lg p-2 bg-white flex items-center gap-3 w-full justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <img src={data.referencePhoto} alt="صورة المرجع" className="w-16 h-16 object-cover rounded border border-gray-200 shadow-inner" />
                <div className="flex flex-col font-cairo text-right">
                  <span className="text-xs font-bold text-green-700">✓ تم الإرفاق</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange('referencePhoto', null)}
                className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-1.5 rounded-lg text-xs hover:bg-red-100 transition-colors font-bold font-cairo shrink-0"
              >
                حذف
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-center">
              <label className="cursor-pointer bg-white hover:bg-purple-50 text-purple-800 border border-purple-300 text-xs font-bold px-4 py-2.5 rounded-lg transition-all font-cairo flex items-center justify-center gap-2 w-full text-center shadow-sm active:scale-[0.98]">
                <span>➕ إضافة صورة</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const maxDim = 400;
                        let w = img.width;
                        let h = img.height;
                        if (w > maxDim || h > maxDim) {
                          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                          else { w = Math.round((w * maxDim) / h); h = maxDim; }
                        }
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
                        onChange('referencePhoto', dataUrl);
                      };
                      img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

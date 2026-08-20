import TextField from './ui/TextField';
import SelectField from './ui/SelectField';
import { TIME_SLOTS, DEFAULT_TIME } from '../constants/timeSlots';
import { DELIVERY_OPTIONS } from '../constants/deliveryOptions';
import { RECEIVER_OPTIONS } from '../constants/receiverOptions';

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function formatOrderDate(isoDate) {
  const d = isoDate ? new Date(isoDate) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const dd = String(validDate.getDate()).padStart(2, '0');
  const mm = String(validDate.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${validDate.getFullYear()}`;
}

/**
 * Order header — collected once per customer session.
 *
 * Props:
 *   data         {Object}   Controlled header state
 *   onChange     {fn}       (field, value) => void
 *   locked       {boolean}  When true, all fields are read-only (same-customer new order)
 *   orderId      {string}   e.g. "CAKE-1218"
 *   currentUser  {Object}   Logged-in user object
 *   createdAt    {string}   ISO creation date for existing orders
 */
export default function OrderHeader({ data, onChange, locked = false, orderId, currentUser, createdAt }) {
  const isAdmin = currentUser?.role === 'admin';

  // Auto-fill Arabic day name when delivery date changes
  const handleDeliveryDate = (val) => {
    onChange('deliveryDate', val);
    if (val) {
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        onChange('dayName', ARABIC_DAYS[date.getDay()]);
      }
    } else {
      onChange('dayName', '');
    }
  };

  return (
    <div className="mb-3">
      {/* ── Title row ── */}
      <div className="grid grid-cols-3 items-start mb-2 gap-2">
        {/* Order date — auto, left */}
        <div className="flex flex-col">
          <label className="text-xs font-bold text-[#1a1a2e] text-center mb-1">التاريخ</label>
          <input
            readOnly
            value={formatOrderDate(createdAt)}
            dir="ltr"
            className="bg-[#eceafa] border-2 border-[#e2495c] rounded px-2 py-1.5 text-sm font-cairo text-center text-[#222] w-full focus:outline-none"
          />
        </div>

        {/* Form title — center */}
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-[#2857a4] leading-tight">طلبية قالب كايك</h1>
          <div className="text-sm font-mono font-bold text-[#333] tracking-widest mt-0.5 text-left" dir="ltr">
            {orderId}
          </div>
        </div>

        {/* Recipient / Employee Name — right (RTL left) */}
        <div className="flex flex-col items-end pt-1">
          <label className="text-[10px] font-bold text-gray-400 font-cairo mb-0.5">الموظف (المستلم)</label>
          <div className="text-sm font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg font-cairo shadow-sm truncate max-w-[120px]" title={data.recipient || currentUser?.name || 'غير محدد'}>
            {data.recipient || currentUser?.name || 'غير محدد'}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {/* رقم الزبون مع أيقونة واتساب */}
        <div className="flex flex-col gap-1">
          <label htmlFor="customerPhone" className="text-xs font-bold text-[#1a1a2e] text-center">
            رقم الزبون
          </label>
          <div className="relative flex items-stretch">
            {/* WhatsApp Badge */}
            <div className="flex items-center justify-center bg-[#25D366] text-white rounded-r border-2 border-l-0 border-[#e2495c] px-2" title="واتساب">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </div>
            <div className={`flex items-center bg-[#eceafa] border-2 border-r-0 border-[#e2495c] rounded-l flex-1 px-2 ${locked ? 'bg-[#f0eff8] opacity-60' : ''}`}>
              <input
                id="customerPhone"
                type="tel"
                dir="ltr"
                value={data.customerPhone || ''}
                onChange={(e) => {
                  // Convert Eastern Arabic numerals to standard Arabic numerals for backend compatibility,
                  // but we let the user type them.
                  const englishNumber = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
                  onChange('customerPhone', englishNumber);
                }}
                readOnly={locked}
                className="bg-transparent w-full py-1.5 text-sm font-bold font-cairo text-[#222] focus:outline-none"
              />
            </div>
          </div>
        </div>
        {/* اسم الزبون */}
        <TextField
          label="اسم الزبون"
          id="customerName"
          dir="rtl"
          value={data.customerName}
          onChange={(v) => onChange('customerName', v)}
          readOnly={locked}
        />
      </div>

      {/* ── Delivery row ── */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {/* اليوم — auto-filled */}
        <TextField
          label="اليوم"
          id="dayName"
          value={data.dayName}
          readOnly
        />
        {/* تاريخ التسليم */}
        <TextField
          label="تاريخ التسليم"
          id="deliveryDate"
          type="date"
          dir="ltr"
          value={data.deliveryDate}
          onChange={locked ? undefined : handleDeliveryDate}
          readOnly={locked}
        />
        {/* الوقت */}
        <SelectField
          label="الوقت"
          id="orderTime"
          options={TIME_SLOTS}
          value={data.deliveryTime || DEFAULT_TIME}
          onChange={(v) => onChange('deliveryTime', v)}
          disabled={locked}
          placeholder=""
        />
      </div>

      {/* ── Branch & Delivery ── */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {/* التسليم */}
        <SelectField
          label="التسليم"
          id="deliveryMethod"
          options={DELIVERY_OPTIONS}
          value={data.deliveryMethod}
          onChange={(v) => onChange('deliveryMethod', v)}
          disabled={locked}
          withOther
        />

        {/* ── Delivery Address — dynamically shown ── */}
        {data.deliveryMethod && (data.deliveryMethod === 'توصيل فان براد' || data.deliveryMethod.includes('توصيل')) ? (
          <TextField
            label="العنوان"
            id="deliveryAddress"
            value={data.deliveryAddress || ''}
            onChange={(v) => onChange('deliveryAddress', v)}
            readOnly={locked}
            placeholder="المنطقة، الشارع، البناية..."
          />
        ) : (
          <div /> // Spacer if address not needed
        )}
      </div>
    </div>
  );
}

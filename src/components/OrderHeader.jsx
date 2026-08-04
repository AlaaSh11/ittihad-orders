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

        {/* Spacer right */}
        <div />
      </div>

      {/* ── Customer fields ── */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {/* رقم الزبون */}
        <TextField
          label="رقم الزبون"
          id="customerPhone"
          type="tel"
          dir="ltr"
          value={data.customerPhone}
          onChange={(v) => onChange('customerPhone', v)}
          readOnly={locked}
        />
        {/* اسم الزبون */}
        <TextField
          label="اسم الزبون"
          id="customerName"
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
        {/* تاريخ تسليم الطلبية */}
        <TextField
          label="تاريخ تسليم الطلبية"
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

      {/* ── Branch & Receiver ── */}
      <div className="grid grid-cols-2 gap-2">
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
        {/* مستلم الطلبية — locked + auto-set for non-admin */}
        <SelectField
          label="مستلم الطلبية"
          id="recipient"
          options={RECEIVER_OPTIONS}
          value={data.recipient}
          onChange={(v) => onChange('recipient', v)}
          disabled={locked || !isAdmin}
        />
      </div>

      {/* ── Delivery Address — shown only when a delivery method is chosen ── */}
      {data.deliveryMethod && data.deliveryMethod.includes('توصيل') && (
        <div className="mt-2">
          <TextField
            label="عنوان التوصيل"
            id="deliveryAddress"
            value={data.deliveryAddress || ''}
            onChange={(v) => onChange('deliveryAddress', v)}
            readOnly={locked}
            placeholder="المنطقة، الشارع، البناية..."
          />
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { listOrdersPaginated, searchOrders, updateOrder, collectDeposit, undoDeposit, updateProductionStatus, cancelOrder, uncancelOrder, normalizeArabic } from '../lib/ordersStore';
import { buildWhatsAppUrl } from '../lib/whatsapp';
import { ENABLE_FACTORY_SYSTEM } from '../constants/featureFlags';
import { buildSameDayCustomerOrdersMap, getSameDayCustomerInfo } from '../lib/orderGrouping';
import Modal from '../components/ui/Modal';

// ── Arabic labels and color mappings ────────────────────────────────────────────
const ORDER_TYPE_LABELS = {
  cake:      'طلب كيك',
  chocolate: 'طلب شوكولا',
  occasion:  'طلب مناسبة',
  simple:    'طلب بسيط',
};

const ORDER_TYPE_COLORS = {
  cake:      { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  chocolate: { bg: '#fce7f3', text: '#9d174d', border: '#ec4899' },
  occasion:  { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
  simple:    { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
};

const TYPE_ICONS = {
  cake:      '🎂',
  chocolate: '🍫',
  occasion:  '🎁',
  simple:    '🛒',
};

const FILTER_TABS = [
  { key: 'all',       label: 'كل الأصناف' },
  { key: 'cake',      label: 'كيك' },
  { key: 'chocolate', label: 'شوكولا' },
  { key: 'occasion',  label: 'مناسبة' },
  { key: 'simple',    label: 'بسيط' },
];

const PAYMENT_TABS = [
  { key: 'unpaid',          label: '⏳ غير المدفوعة (بانتظار التحصيل)' },
  { key: 'deposit_pending', label: '⏳ بانتظار استلام العربون' },
  { key: 'paid',            label: '✅ تم السداد بالكامل' },
  { key: 'all',             label: '🌐 كل حالات الدفع' },
];

const PRODUCTION_TABS = [
  { key: 'all',         label: '🌐 كل مراحل المصنع' },
  { key: 'received',    label: '📥 مستلمة (بانتظار التحضير)' },
  { key: 'in_progress', label: '👨‍🍳 قيد التنفيذ بالمصنع' },
  { key: 'ready',       label: '✅ جاهزة للتسليم' },
  { key: 'delivered',   label: '🚚 تم التسليم' },
];

const DATE_TABS = [
  { key: 'all',      label: '🗓️ كل التواريخ' },
  { key: 'today',    label: '⏰ موعد التسليم اليوم' },
  { key: 'tomorrow', label: '🌅 موعد التسليم غداً' },
];

const PRODUCTION_STATUS_LABELS = {
  received:    '📥 مستلمة بالمحل',
  in_progress: '👨‍🍳 قيد التنفيذ بالمصنع',
  ready:       '✅ جاهزة للتسليم',
  delivered:   '🚚 تم التسليم للزبون',
};

const PRODUCTION_STATUS_COLORS = {
  received:    'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-amber-100 text-amber-800 border-amber-400 animate-pulse',
  ready:       'bg-emerald-100 text-emerald-800 border-emerald-400 font-extrabold',
  delivered:   'bg-purple-100 text-purple-800 border-purple-300',
};

/**
 * Format ISO date to DD/MM/YYYY.
 */
function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

/**
 * Builds a concise body summary line for an order card.
 */
function bodySummary(orderType, body) {
  if (!body) return '';
  if (orderType === 'cake') {
    return [
      body.cakeShape,
      body.cakeType,
      body.cakeFlavor ? `نكهة: ${body.cakeFlavor}` : null,
      body.cakeSize ? `حجم: ${body.cakeSize}` : null,
      body.serves ? `${body.serves} شخص` : null,
      body.notes ? `ملاحظات: ${body.notes}` : null,
    ].filter(Boolean).join(' · ');
  }
  if (orderType === 'chocolate') {
    return [
      body.chocolateType ? `شوكولا ${body.chocolateType}` : null,
      body.fillingType ? `حشوة ${body.fillingType}` : null,
      body.quantity ? `${body.quantity} قطعة` : null,
      body.wrappingMethod ? `تغليف: ${body.wrappingMethod}` : null,
      body.specifications,
      body.notes,
    ].filter(Boolean).join(' · ');
  }
  if (orderType === 'occasion') {
    return [
      body.hospitalityType,
      body.wrappingMethod ? `تغليف: ${body.wrappingMethod}` : null,
      body.quantity ? `${body.quantity} قطعة/ستاند` : null,
      body.notes,
    ].filter(Boolean).join(' · ');
  }
  if (orderType === 'simple') {
    if (Array.isArray(body.items) && body.items.length > 0) {
      return body.items.map(si => {
        const parts = [
          si.itemName,
          si.pieces ? `${si.pieces} حبة` : null,
          si.weight ? `${si.weight} كغ` : null,
          si.notes ? `(${si.notes})` : null,
        ].filter(Boolean);
        return parts.join(' ');
      }).join(' + ');
    }
    return [
      body.itemName,
      body.chocolateName,
      body.pieces ? `${body.pieces} حبة` : null,
      body.weight ? `${body.weight} كغ` : null,
      body.notes,
    ].filter(Boolean).join(' · ');
  }
  return '';
}

function fullOrderSummary(order) {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items
      .map((item) => `[${ORDER_TYPE_LABELS[item.orderType]}] ${bodySummary(item.orderType, item.body)}`)
      .join(' | ');
  }
  return bodySummary(order.orderType, order.body) || '—';
}

// ── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onEdit,
  onWhatsApp,
  onMarkPaid,
  onUndoPaid,
  onCollectDeposit,
  onUndoDeposit,
  onUpdateDeposit,
  onUpdatePrice,
  onUpdateProduction,
  onCancel,
  onUncancel,
  isUpdating,
  sameDayOrdersMap,
  isBundled = false,
}) {
  const isMultiItem = Array.isArray(order.items) && order.items.length > 0;
  // Use the color of the first item, or cake if none
  const mainType = isMultiItem ? order.items[0].orderType : order.orderType;
  const colors = ORDER_TYPE_COLORS[mainType] || ORDER_TYPE_COLORS.cake;
  const isPaid = order.isPaid === true;
  const isCancelled = order.isCancelled === true;
  const requiresDeposit = order.footer?.depositPaid === true;
  const depositCollected = order.depositCollected === true;

  const depositVal = order.footer?.depositAmount || '0';
  const priceVal = order.footer?.price || '0';
  const remainingVal = (order.footer?.remaining !== undefined && order.footer?.remaining !== '')
    ? order.footer.remaining
    : String(Math.max(0, parseFloat(priceVal) - parseFloat(depositVal)));

  const currentProdStatus = order.productionStatus || 'received';

  const sameDay = useMemo(() => {
    return getSameDayCustomerInfo(order, sameDayOrdersMap);
  }, [order, sameDayOrdersMap]);

  const [isEditingDeposit, setIsEditingDeposit] = useState(false);
  const [editDepositValue, setEditDepositValue] = useState(depositVal);

  const handleSaveEditDeposit = () => {
    if (onUpdateDeposit) {
      onUpdateDeposit(order, editDepositValue);
    }
    setIsEditingDeposit(false);
  };

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editPriceValue, setEditPriceValue] = useState(priceVal);

  const handleSaveEditPrice = () => {
    if (onUpdatePrice) {
      onUpdatePrice(order, editPriceValue);
    }
    setIsEditingPrice(false);
  };

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`bg-white rounded-2xl border transition-all shadow-sm overflow-hidden hover:shadow-md ${
        isCancelled
          ? 'border-red-300 bg-red-50/20 opacity-90'
          : isBundled
          ? 'border-indigo-200 hover:border-indigo-400 bg-white'
          : sameDay
          ? 'border-indigo-300 border-r-4 border-r-indigo-600 hover:border-indigo-400'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      style={{ animation: 'cardIn 0.25s ease' }}
    >
      {/* Top color bar */}
      <div style={{ height: '5px', background: isCancelled ? '#ef4444' : isPaid ? '#10b981' : requiresDeposit && !depositCollected ? '#f59e0b' : colors.border }} />

      <div className="p-4">
        {/* Clickable Header Area */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="cursor-pointer group flex flex-col gap-2"
        >
          {/* Cancelled Banner if applicable */}
          {isCancelled && (
            <div className="bg-red-600 text-white font-cairo font-bold text-xs px-3 py-1.5 rounded-lg mb-1 flex items-center justify-between shadow-sm">
              <span>🚫 هذه الطلبية ملغية ({order.cancelledReason || 'تم الإلغاء بواسطة الموظف/الإدارة'})</span>
              <span className="text-[11px] bg-red-800 px-2 py-0.5 rounded">بواسطة: {order.cancelledBy || 'الموظف'}</span>
            </div>
          )}

          {/* Row 1: ID + badges + date */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold font-cairo" dir="ltr" style={{ color: '#1a1a2e', fontFamily: "'Courier New', monospace", letterSpacing: '0.5px' }}>
                {order.id}
              </span>

              {/* Multi-order same day badge */}
              {sameDay && (
                <span
                  className="bg-indigo-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full font-cairo flex items-center gap-1 shadow-2xs"
                  title={`هذا الزبون لديه ${sameDay.count} طلبيات في نفس تاريخ التسليم: ${sameDay.allOrders.map(o => o.id).join(' + ')}`}
                >
                  <span>🔗</span>
                  <span>طلب {sameDay.orderNum} من {sameDay.count} لنفس الزبون اليوم</span>
                </span>
              )}
              
              {/* Product Badges with Icons */}
              {isMultiItem ? (
                order.items.map((item, idx) => {
                  const c = ORDER_TYPE_COLORS[item.orderType] || ORDER_TYPE_COLORS.cake;
                  return (
                    <span
                      key={idx}
                      className="text-[11px] font-bold px-2.5 py-0.5 rounded-full font-cairo flex items-center gap-1"
                      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                    >
                      <span>{TYPE_ICONS[item.orderType] || '🎂'}</span>
                      <span>{ORDER_TYPE_LABELS[item.orderType] || item.orderType}</span>
                    </span>
                  );
                })
              ) : (
                <span
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full font-cairo flex items-center gap-1"
                  style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  <span>{TYPE_ICONS[order.orderType] || '🎂'}</span>
                  <span>{ORDER_TYPE_LABELS[order.orderType] || order.orderType}</span>
                </span>
              )}

              {/* Dynamic Payment & Status Badges */}
              {!isCancelled && (
                isPaid ? (
                  <span className="bg-green-100 text-green-800 border border-green-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full font-cairo flex items-center gap-1">
                    ✓ تم السداد بالكامل ({order.paidBy || 'الصندوق'})
                  </span>
                ) : requiresDeposit ? (
                  depositCollected ? (
                    <span className="bg-blue-100 text-blue-800 border border-blue-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full font-cairo flex items-center gap-1">
                      ✓ عربون مُحَصَّل (${depositVal}) · باقي عند التسليم: ${remainingVal}
                    </span>
                  ) : (
                    <span className="bg-amber-100 text-amber-800 border border-amber-400 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full font-cairo flex items-center gap-1 animate-pulse">
                      ⏳ بانتظار تحصيل عربون: ${depositVal}
                    </span>
                  )
                ) : (
                  <span className="bg-slate-100 text-slate-800 border border-slate-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full font-cairo flex items-center gap-1">
                    ⏳ بانتظار تحصيل المبلغ الكامل عند التسليم (${priceVal})
                  </span>
                )
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-bold font-cairo" dir="ltr">
                {order.header?.deliveryDate || fmtDate(order.createdAt)}
              </span>
              <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
            </div>
          </div>

          {/* Row 2: Customer info + Product Avatar */}
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-sm border transition-transform group-hover:scale-105"
              style={{
                background: colors.bg,
                borderColor: colors.border,
                color: colors.text,
              }}
              title={ORDER_TYPE_LABELS[mainType] || mainType}
            >
              {TYPE_ICONS[mainType] || '🎂'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-bold text-gray-800 font-cairo truncate">
                  {order.header?.customerName || '—'}
                </p>
                <span
                  className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center text-white shrink-0"
                  style={{ background: isCancelled ? '#ef4444' : isPaid ? '#10b981' : requiresDeposit && !depositCollected ? '#f59e0b' : '#3b82f6' }}
                >
                  {(order.header?.customerName || '?')[0]}
                </span>
                {sameDay && (
                  <span className="text-[10px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full">
                    👥 {sameDay.count} طلبيات لنفس اليوم
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-cairo" dir="ltr">
                {order.header?.customerPhone || ''}
              </p>
              {sameDay && (
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span>🔗 الطلبيات:</span>
                    <strong className="font-mono font-black text-indigo-950">
                      {sameDay.allOrders.map(o => o.id).join(' · ')}
                    </strong>
                  </span>
                  {sameDay.combinedRemaining > 0 && (
                    <span className="text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                      إجمالي المتبقي للطلبيتين: ${sameDay.combinedRemaining}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Quick Content & Delivery Time Strip directly on card */}
          <div className="mt-1 pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs font-cairo bg-slate-50/70 p-2 rounded-xl">
            <div className="flex items-center gap-1.5 text-slate-700 min-w-0 flex-1">
              <span className="font-black text-slate-500 shrink-0">📦 المحتوى:</span>
              <span className="font-bold text-slate-900 truncate" title={fullOrderSummary(order)}>
                {fullOrderSummary(order)}
              </span>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {order.header?.deliveryMethod && (
                <span className="bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-bold text-[11px] flex items-center gap-1 shadow-2xs">
                  <span>🚚</span>
                  <span>{order.header.deliveryMethod}</span>
                </span>
              )}
              {order.header?.deliveryTime && (
                <span className="bg-amber-100/90 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-black text-[11px] flex items-center gap-1 shadow-2xs">
                  <span>⏰</span>
                  <span>{order.header.deliveryTime}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 animate-fadeIn">

        {/* Multi-order same day connected banner */}
        {sameDay && (
          <div className="bg-gradient-to-l from-indigo-50 via-purple-50/60 to-white border border-indigo-200 rounded-xl p-3 mb-3 text-xs font-cairo shadow-2xs">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div className="flex items-center gap-1.5 font-black text-indigo-950 text-xs">
                <span className="text-base">👥</span>
                <span>تنبيه: هذا الزبون لديه {sameDay.count} طلبيات في نفس تاريخ التسليم ({sameDay.deliveryDate})</span>
              </div>
              {sameDay.combinedRemaining > 0 ? (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs px-2.5 py-0.5 rounded-lg shadow-2xs">
                  المبلغ الإجمالي المتبقي لكافة الطلبيات: ${sameDay.combinedRemaining}
                </span>
              ) : (
                <span className="bg-green-100 text-green-900 border border-green-300 font-black text-xs px-2.5 py-0.5 rounded-lg">
                  ✓ تم سداد كافة الطلبيات
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {sameDay.allOrders.map((sib, i) => {
                const isCurrent = sib.id === order.id;
                const typeStr = (Array.isArray(sib.items) && sib.items.length > 0)
                  ? sib.items.map(it => ORDER_TYPE_LABELS[it.orderType] || it.orderType).join(' + ')
                  : ORDER_TYPE_LABELS[sib.orderType] || sib.orderType || 'طلب';
                const rem = parseFloat(sib.footer?.remaining) || 0;
                const price = parseFloat(sib.footer?.price) || 0;
                const dueText = sib.isPaid ? '✓ مسدد' : rem > 0 ? `متبقي: $${rem}` : price > 0 ? `مطلوب: $${price}` : 'غير محدد';
                return (
                  <div
                    key={sib.id}
                    className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 transition-all ${
                      isCurrent
                        ? 'bg-indigo-700 text-white border-indigo-800 font-black shadow-xs'
                        : 'bg-white text-indigo-950 border-indigo-300 font-bold hover:border-indigo-500'
                    }`}
                  >
                    <span>{isCurrent ? `📍 هذا الطلب (طلب ${i + 1}):` : `🔗 الطلب الآخر (طلب ${i + 1}):`}</span>
                    <span className="font-mono font-black">{sib.id}</span>
                    <span className={`text-[10px] ${isCurrent ? 'text-indigo-200' : 'text-indigo-700'}`}>({typeStr})</span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isCurrent ? 'bg-indigo-800 text-amber-300' : 'bg-indigo-100 text-indigo-900'}`}>
                      {dueText}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 3: Body summary & Delivery specs */}
        <div className="bg-gray-50 rounded-lg p-2.5 mb-3 border border-gray-100">
          <p className="text-xs text-gray-600 font-cairo leading-relaxed">
            <span className="font-bold text-gray-800">التفاصيل: </span>
            {fullOrderSummary(order)}
          </p>
          {order.header?.deliveryDate && (
            <p className="text-xs text-gray-500 font-cairo mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              <span>
                <span className="font-bold text-indigo-900">📅 التسليم: </span>
                {fmtDate(`${order.header.deliveryDate}T00:00:00`)} {order.header.dayName ? `(${order.header.dayName})` : ''} · {order.header.deliveryTime || '—'}
              </span>
              {order.header?.deliveryMethod && (
                <span>
                  <span className="font-bold text-indigo-900">📍 طريقة التسليم: </span>
                  {order.header.deliveryMethod}
                </span>
              )}
            </p>
          )}
          {order.header?.deliveryAddress && (
            <p className="text-xs text-purple-900 bg-purple-50 p-1.5 rounded mt-1.5 font-cairo border border-purple-200">
              <span className="font-extrabold">📍 عنوان التوصيل: </span>
              {order.header.deliveryAddress}
            </p>
          )}

          {/* Reference photo display for kitchen & showroom */}
          {(!isMultiItem && order.body?.referencePhoto) && (
            <div className="mt-2 pt-2 border-t border-gray-200/80 flex items-center gap-2">
              <img src={order.body.referencePhoto} alt="صورة المرجع" className="w-14 h-14 object-cover rounded border border-gray-300 shadow-sm bg-white" />
              <div className="text-xs font-cairo">
                <p className="font-bold text-gray-800">📸 يوجد صورة مرجعية للتصميم مرفقة في الطلب</p>
                <p className="text-gray-500 text-[11px]">تظهر الصورة مطبوعة على نسختي المعرض والمصنع</p>
              </div>
            </div>
          )}
          {isMultiItem && order.items.some(item => item.body?.referencePhoto) && (
            <div className="mt-2 pt-2 border-t border-gray-200/80 flex items-center gap-2 flex-wrap">
              {order.items.map((item, idx) => item.body?.referencePhoto && (
                <img key={idx} src={item.body.referencePhoto} alt={`مرجع ${idx}`} className="w-14 h-14 object-cover rounded border border-gray-300 shadow-sm bg-white" />
              ))}
              <div className="text-xs font-cairo">
                <p className="font-bold text-gray-800">📸 يوجد صور مرجعية للتصاميم مرفقة في هذا الطلب</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Row 3.5: Production Status Workflow (خاص بمراحل العمل والمصنع) ── */}
        {!isCancelled && ENABLE_FACTORY_SYSTEM && (
          <div className="bg-gradient-to-r from-slate-50 to-indigo-50/50 rounded-xl p-3 mb-3.5 border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-[#1a1a2e] font-cairo">🏭 مرحلة التحضير بالمصنع:</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border font-cairo ${PRODUCTION_STATUS_COLORS[currentProdStatus]}`}>
                  {PRODUCTION_STATUS_LABELS[currentProdStatus] || currentProdStatus}
                </span>
              </div>

              {/* Step-by-step advance buttons for kitchen/staff */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {currentProdStatus === 'received' && (
                  <button
                    onClick={() => onUpdateProduction(order, 'in_progress')}
                    disabled={isUpdating}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg shadow-sm font-cairo transition-transform active:scale-95 flex items-center gap-1 disabled:opacity-50"
                  >
                    👨‍🍳 البدء بالتحضير (نقل لقيد التنفيذ)
                  </button>
                )}
                {currentProdStatus === 'in_progress' && (
                  <>
                    <button
                      onClick={() => onUpdateProduction(order, 'ready')}
                      disabled={isUpdating}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg shadow-sm font-cairo transition-transform active:scale-95 flex items-center gap-1 disabled:opacity-50"
                    >
                      ✅ تحديد كجاهزة للتسليم
                    </button>
                    <button
                      onClick={() => onUpdateProduction(order, 'received')}
                      disabled={isUpdating}
                      className="text-xs font-bold text-gray-600 bg-white hover:bg-gray-100 border px-2 py-1.5 rounded-lg font-cairo"
                      title="إعادة إلى مستلمة بالمحل"
                    >
                      ↩️ تراجع
                    </button>
                  </>
                )}
                {currentProdStatus === 'ready' && (
                  <>
                    <button
                      onClick={() => onUpdateProduction(order, 'delivered')}
                      disabled={isUpdating}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg shadow-sm font-cairo transition-transform active:scale-95 flex items-center gap-1 disabled:opacity-50"
                    >
                      🚚 تأكيد التسليم للزبون
                    </button>
                    <button
                      onClick={() => onUpdateProduction(order, 'in_progress')}
                      disabled={isUpdating}
                      className="text-xs font-bold text-gray-600 bg-white hover:bg-gray-100 border px-2 py-1.5 rounded-lg font-cairo"
                      title="إعادة لقيد التنفيذ"
                    >
                      ↩️ تراجع
                    </button>
                  </>
                )}
                {currentProdStatus === 'delivered' && (
                  <button
                    onClick={() => onUpdateProduction(order, 'ready')}
                    disabled={isUpdating}
                    className="text-xs font-bold text-gray-500 bg-white hover:bg-gray-100 border px-2 py-1.5 rounded-lg font-cairo"
                    title="إعادة إلى جاهزة للتسليم"
                  >
                    ↩️ تراجع عن التسليم
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Row 4: Financial balance box (Tailored for Cashier verification) */}
        {!isCancelled && (
          <div className="text-xs font-cairo mb-3.5 p-3 rounded-xl border bg-slate-50 border-slate-200 shadow-inner">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-500 font-bold">السعر الإجمالي للطلب:</span>
              <div className="flex items-center gap-2">
                {isEditingPrice ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      dir="ltr"
                      className="w-20 px-2 py-0.5 text-xs border border-indigo-400 rounded focus:outline-none"
                      value={editPriceValue}
                      onChange={(e) => setEditPriceValue(e.target.value)}
                    />
                    <button
                      onClick={handleSaveEditPrice}
                      disabled={isUpdating}
                      className="bg-indigo-600 text-white px-2 py-0.5 rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                    >
                      حفظ
                    </button>
                    <button
                      onClick={() => setIsEditingPrice(false)}
                      className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs hover:bg-gray-300"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-base" dir="ltr">${priceVal}</span>
                    {(!isPaid && onUpdatePrice) && (
                      <button 
                        onClick={() => {
                          setEditPriceValue(priceVal);
                          setIsEditingPrice(true);
                        }}
                        className="hover:scale-110 transition-transform bg-gray-200 hover:bg-gray-300 rounded px-1.5 py-0.5 text-[10px]"
                        title="تعديل السعر الإجمالي"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(requiresDeposit || (!isPaid && onUpdateDeposit)) && (
              <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-200">
                <span className="text-indigo-900 font-semibold">
                  قيمة العربون المقرر في الطلب:
                </span>
                
                <div className="flex items-center gap-2">
                  {isEditingDeposit ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        dir="ltr"
                        className="w-20 px-2 py-0.5 text-xs border border-indigo-400 rounded focus:outline-none"
                        value={editDepositValue}
                        onChange={(e) => setEditDepositValue(e.target.value)}
                      />
                      <button
                        onClick={handleSaveEditDeposit}
                        disabled={isUpdating}
                        className="bg-indigo-600 text-white px-2 py-0.5 rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                      >
                        حفظ
                      </button>
                      <button
                        onClick={() => setIsEditingDeposit(false)}
                        className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs hover:bg-gray-300"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <span className={`flex items-center gap-2 font-bold px-2 py-0.5 rounded ${depositCollected ? 'bg-green-100 text-green-800 border border-green-300' : (!requiresDeposit && depositVal === '0' ? 'bg-gray-100 text-gray-600 border border-gray-300' : 'bg-amber-100 text-amber-900 border border-amber-300')}`}>
                      {depositCollected 
                        ? `✓ تم استلام العربون ($${depositVal})` 
                        : (!requiresDeposit && depositVal === '0' 
                          ? `بدون عربون ($0)` 
                          : `⏳ لم يتم تحصيل العربون بعد ($${depositVal})`)}
                      {(!isPaid && onUpdateDeposit) && (
                        <button 
                          onClick={() => {
                            setEditDepositValue(depositVal);
                            setIsEditingDeposit(true);
                          }}
                          className="hover:scale-110 transition-transform bg-white/50 rounded px-1 text-[10px]"
                          title="تعديل قيمة العربون"
                        >
                          ✏️
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </div>
            )}

            {!isPaid && (
              <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-slate-200 text-red-700">
                <span className="font-extrabold">المتبقي المطلوب للتحصيل عند التسليم:</span>
                <span className="font-extrabold bg-red-100 border border-red-300 px-2.5 py-0.5 rounded text-sm" dir="ltr">
                  ${remainingVal}
                </span>
              </div>
            )}

            {isPaid && (
              <div className="mt-2 text-green-700 font-bold text-center bg-green-100 py-1 rounded border border-green-200">
                ✓ تم تسليم الطلبية وسداد إجمالي المستحقات الماليّة
              </div>
            )}
          </div>
        )}

        {/* Row 5: Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-gray-100">
          
          {/* STEP 1: Collect Deposit Button (When deposit required and not collected yet) */}
          {!isCancelled && !isPaid && requiresDeposit && !depositCollected && (
            <button
              onClick={() => onCollectDeposit(order)}
              disabled={isUpdating}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold py-2.5 px-3 rounded-lg shadow transition-all font-cairo active:scale-[0.97] flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              💵 تأكيد تحصيل العربون (${depositVal})
            </button>
          )}

          {/* STEP 2 / Full Payment: Mark remaining balance as collected upon pickup */}
          {!isCancelled && !isPaid && (
            <button
              onClick={() => onMarkPaid(order)}
              disabled={isUpdating}
              className="bg-green-600 hover:bg-green-700 text-white text-xs font-extrabold py-2.5 px-3 rounded-lg shadow transition-all font-cairo active:scale-[0.97] flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {requiresDeposit && !depositCollected
                ? `💵 تسديد إجمالي السعر (${priceVal}) فوري`
                : requiresDeposit
                ? `💵 تأكيد تحصيل المتبقي (${remainingVal}) عند التسليم`
                : `💵 تأكيد استلام المبلغ بالكامل (${priceVal})`}
            </button>
          )}

          {/* UNDO DEPOSIT ACTION */}
          {!isCancelled && !isPaid && requiresDeposit && depositCollected && (
            <button
              onClick={() => onUndoDeposit(order)}
              disabled={isUpdating}
              title="إلغاء تسجيل تحصيل العربون"
              className="bg-slate-100 hover:bg-amber-50 border border-slate-300 hover:border-amber-300 text-slate-700 hover:text-amber-800 text-xs font-bold py-2 px-3 rounded-lg transition-colors font-cairo active:scale-[0.97] flex items-center justify-center gap-1 disabled:opacity-50"
            >
              ↩️ إلغاء تحصيل العربون
            </button>
          )}

          {/* UNDO FULL PAYMENT ACTION */}
          {!isCancelled && isPaid && (
            <button
              onClick={() => onUndoPaid(order)}
              disabled={isUpdating}
              className="bg-gray-100 hover:bg-amber-50 border border-gray-300 hover:border-amber-300 text-gray-700 hover:text-amber-800 text-xs font-bold py-2 px-3 rounded-lg transition-colors font-cairo active:scale-[0.97] flex items-center justify-center gap-1 disabled:opacity-50"
            >
              ↩️ إلغاء تأكيد الدفع الكامل
            </button>
          )}

          {/* Edit button — ONLY rendered for admin / ordinary staff (HIDDEN for Cashiers!) */}
          {!isCancelled && onEdit && (
            <button
              onClick={() => onEdit(order)}
              className="border-2 border-[#1a1a2e] text-[#1a1a2e] hover:bg-[#1a1a2e] hover:text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors font-cairo active:scale-[0.97] flex items-center justify-center gap-1"
            >
              ✏️ تعديل تفاصيل الطلبية
            </button>
          )}

          {/* Cancel Order Action */}
          {!isCancelled && onCancel && (
            <button
              onClick={() => onCancel(order)}
              disabled={isUpdating || isPaid || order.paymentMethod === 'Cash' || order.paymentMethod === 'كاش'}
              className="border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 text-xs font-bold py-2 px-3 rounded-lg transition-colors font-cairo active:scale-[0.97] flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              title={(isPaid || order.paymentMethod === 'Cash' || order.paymentMethod === 'كاش') ? "لا يمكن إلغاء طلب مدفوع نقداً" : "إلغاء الطلبية"}
            >
              🚫 طلب إلغاء الطلب
            </button>
          )}

          {/* Uncancel Action if cancelled */}
          {isCancelled && (
            <button
              onClick={() => onUncancel(order)}
              disabled={isUpdating}
              className="bg-gray-700 hover:bg-gray-800 text-white text-xs font-bold py-2.5 px-3 rounded-lg transition-colors font-cairo active:scale-[0.97] flex items-center justify-center gap-1 disabled:opacity-50 col-span-2"
            >
              ↩️ استعادة الطلبية الملغية (تفعيل مجدد)
            </button>
          )}

          {/* WhatsApp communication */}
          <button
            onClick={() => onWhatsApp(order)}
            className="border border-green-600 text-green-700 hover:bg-green-50 text-xs font-bold py-2 px-3 rounded-lg transition-colors font-cairo active:scale-[0.97] flex items-center justify-center gap-1"
          >
            💬 إرسال واتساب للزبون
          </button>
        </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ── Customer Multi-Order Bundle Card ───────────────────────────────────────

function CustomerBundleCard({
  group,
  sameDayOrdersMap,
  isCashier,
  onEditOrder,
  handleWhatsApp,
  handleMarkPaid,
  handleUndoPaid,
  handleCollectDeposit,
  handleUndoDeposit,
  handleUpdateDeposit,
  handleUpdatePrice,
  handleUpdateProduction,
  handleCancelOrder,
  handleUncancelOrder,
  updatingId,
}) {
  const [isBundleExpanded, setIsBundleExpanded] = useState(true);

  return (
    <div className="bg-gradient-to-br from-indigo-50/95 via-purple-50/40 to-slate-50 border-2 border-indigo-400 rounded-3xl p-3 sm:p-4 shadow-sm space-y-3">
      {/* Bundle Master Header */}
      <div 
        onClick={() => setIsBundleExpanded(!isBundleExpanded)}
        className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-indigo-200/80 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-sm">
            👥
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-slate-900 text-lg font-cairo">{group.customerName}</span>
              <span className="bg-indigo-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-2xs">
                {group.orders.length} طلبات متصلة لنفس موعد التسليم
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold mt-0.5 flex-wrap">
              <span dir="ltr" className="font-mono text-slate-800 font-bold">{group.customerPhone || 'بدون هاتف'}</span>
              <span>·</span>
              <span>📅 موعد التسليم: <strong className="text-indigo-950 font-black">{group.deliveryDate}</strong></span>
            </div>
          </div>
        </div>

        {/* Combined Financial Settlement Summary */}
        <div className="flex items-center gap-3">
          <div className="bg-white border border-indigo-200 rounded-2xl px-4 py-2 shadow-2xs flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block font-bold leading-tight">إجمالي الحساب:</span>
              <span className="text-base font-black text-slate-900">${group.totalPrice}</span>
            </div>
            <div className="border-r border-indigo-100 pr-4 text-right">
              <span className="text-[10px] text-slate-500 block font-bold leading-tight">المتبقي للتحصيل:</span>
              <span className={`text-base font-black ${group.totalRemaining > 0 ? 'text-amber-700 font-black' : 'text-green-700'}`}>
                {group.totalRemaining > 0 ? `$${group.totalRemaining}` : '✓ مسدد بالكامل'}
              </span>
            </div>
          </div>
          <span className={`text-indigo-500 font-black text-base transition-transform ${isBundleExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {/* Orders Nested Inside Bundle */}
      {isBundleExpanded && (
        <div className="space-y-3 pt-1">
          {group.orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              sameDayOrdersMap={sameDayOrdersMap}
              isBundled={true}
              onEdit={!isCashier ? () => onEditOrder?.(order) : null}
              onWhatsApp={handleWhatsApp}
              onMarkPaid={handleMarkPaid}
              onUndoPaid={handleUndoPaid}
              onCollectDeposit={handleCollectDeposit}
              onUndoDeposit={handleUndoDeposit}
              onUpdateDeposit={handleUpdateDeposit}
              onUpdatePrice={handleUpdatePrice}
              onUpdateProduction={handleUpdateProduction}
              onCancel={!isCashier ? handleCancelOrder : null}
              onUncancel={!isCashier ? handleUncancelOrder : null}
              isUpdating={updatingId === order.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasSearch, paymentFilter, showCancelledOnly }) {
  if (showCancelledOnly) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">🙌</div>
        <p className="text-gray-700 text-base font-bold font-cairo mb-1">لا توجد أي طلبات ملغية في النظام!</p>
        <p className="text-gray-400 text-xs font-cairo mt-1">القائمة نظيفة، ويمكنك العودة لباقي التبويبات لعرض الطلبات النشطة.</p>
      </div>
    );
  }

  const labelMap = {
    unpaid: 'لا توجد طلبات معلقة بانتظار التحصيل! 🎉',
    deposit_pending: 'لا توجد طلبات بانتظار تحصيل عربون حالياً.',
    paid: 'لا توجد طلبات مسددة بالكامل في القائمة بعد.',
    all: 'لا توجد طلبات مطابقة لاختيارات التصنيف الحالية.',
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">{hasSearch ? '🔍' : paymentFilter === 'unpaid' ? '✨' : '📋'}</div>
      <p className="text-gray-700 text-base font-bold font-cairo mb-1">
        {hasSearch ? 'لم يتم العثور على طلبات مطابقة للبحث أو التواريخ' : (labelMap[paymentFilter] || labelMap.all)}
      </p>
      <p className="text-gray-400 text-xs font-cairo mt-1">
        {hasSearch ? 'جرب البحث بكلمة، أو تغيير تصنيف التاريخ ومرحلة المصنع' : 'يمكنك تبديل التصفية لعرض باقي قائمة الطلبات'}
      </p>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function OrderHistoryView({ currentUser, onLogout, onNewOrder, onEditOrder, onFactory }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDocSnap, setLastDocSnap] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [modalConfig, setModalConfig] = useState(null);

  // Filter States
  const [paymentFilter, setPaymentFilter] = useState('unpaid'); 
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [productionFilter, setProductionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [showCancelledOnly, setShowCancelledOnly] = useState(false);

  const isCashier = currentUser?.role === 'cashier';

  // ── Fetch initial paginated batch ──
  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listOrdersPaginated({ pageSize: 50, lastDocSnap: null });
      setOrders(res.orders);
      setLastDocSnap(res.lastDocSnap);
      setHasMore(res.hasMore);
      const now = new Date();
      setLastRefreshed(now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setError('تعذر تحميل الطلبات من السحابة. تأكد من اتصالك بالإنترنت.');
      console.error('Fetch orders error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Load next page ──
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !lastDocSnap) return;
    setLoadingMore(true);
    try {
      const res = await listOrdersPaginated({ pageSize: 50, lastDocSnap });
      setOrders(prev => [...prev, ...res.orders]);
      setLastDocSnap(res.lastDocSnap);
      setHasMore(res.hasMore);
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Handle server-side search with 300ms debounce ──
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (!val.trim()) {
      fetchOrders();
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        try {
          const searchResults = await searchOrders(searchQuery.trim());
          if (searchResults && searchResults.length > 0) {
            setOrders(searchResults);
          }
        } catch (err) {
          console.warn('Search query error:', err);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => { fetchOrders(); }, []);

  // ── STEP 1: Mark deposit as collected by Cashier ──
  const handleCollectDeposit = async (order) => {
    setUpdatingId(order.id);
    const cashierName = currentUser?.arabicName || currentUser?.username || 'الكاشير';
    try {
      const updated = await collectDeposit(order.id, cashierName);
      const patch = updated || { depositCollected: true, depositCollectedAt: new Date().toISOString(), depositCollectedBy: cashierName };
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...patch } : o));
    } catch {
      setModalConfig({
        isOpen: true,
        title: 'خطأ',
        message: 'فشل في تسجيل استلام العربون. تحقق من الاتصال بالإنترنت.',
        type: 'alert',
        onConfirm: () => setModalConfig(null),
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // ── UNDO Deposit collection ──
  const handleUndoDeposit = (order) => {
    setModalConfig({
      isOpen: true,
      title: 'إلغاء استلام العربون',
      message: 'هل أنت متأكد من رغبتك في إلغاء تسجيل استلام العربون لهذا الطلب؟',
      isDanger: true,
      confirmText: 'نعم، إلغاء العربون',
      onConfirm: async () => {
        setModalConfig(null);
        setUpdatingId(order.id);
        try {
          const updated = await undoDeposit(order.id);
          const patch = updated || { depositCollected: false, depositCollectedAt: null, depositCollectedBy: null };
          setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...patch } : o));
        } catch {
          setModalConfig({
            isOpen: true,
            title: 'خطأ',
            message: 'فشل في تحديث حالة العربون. تحقق من الإنترنت.',
            type: 'alert',
            onConfirm: () => setModalConfig(null),
          });
        } finally {
          setUpdatingId(null);
        }
      }
    });
  };

  // ── STEP 2 / Full Payment: Mark order as fully paid in database ──
  const handleMarkPaid = (order) => {
    const depositCollected = order.depositCollected === true;
    const requiresDeposit = order.footer?.depositPaid === true;
    const amountToCollect = requiresDeposit && !depositCollected
      ? (order.footer?.price || '0')
      : requiresDeposit
      ? (order.footer?.remaining || '0')
      : (order.footer?.price || '0');

    setModalConfig({
      isOpen: true,
      title: '💰 تأكيد السداد الكامل',
      message: `هل أنت متأكد من تحصيل المبلغ المطلوب ($${amountToCollect}) وتحديد الطلبية كمُسدّدة بالكامل؟`,
      confirmText: 'تأكيد السداد بالكامل',
      onConfirm: async () => {
        setModalConfig(null);
        setUpdatingId(order.id);
        const cashierName = currentUser?.arabicName || currentUser?.username || 'الكاشير';
        const patch = {
          isPaid: true,
          paidAt: new Date().toISOString(),
          paidBy: cashierName,
          depositCollected: true,
          depositCollectedBy: order.depositCollectedBy || cashierName,
        };
        try {
          await updateOrder(order.id, patch);
          setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...patch } : o));
        } catch {
          setModalConfig({
            isOpen: true,
            title: 'خطأ',
            message: 'فشل في تحديث حالة الدفع الكامل. تحقق من الإنترنت.',
            type: 'alert',
            onConfirm: () => setModalConfig(null),
          });
        } finally {
          setUpdatingId(null);
        }
      }
    });
  };

  // ── Update Deposit Amount ──
  const handleUpdateDeposit = async (order, newDepositAmount) => {
    setUpdatingId(order.id);
    const pNum = parseFloat(order.footer?.price) || 0;
    const dNum = parseFloat(newDepositAmount) || 0;
    const rem = Math.max(0, pNum - dNum);
    const patch = {
      footer: {
        ...order.footer,
        depositAmount: String(dNum),
        remaining: String(rem)
      }
    };
    try {
      await updateOrder(order.id, patch);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, footer: patch.footer } : o));
    } catch {
      setModalConfig({
        isOpen: true,
        title: 'خطأ',
        message: 'فشل في تحديث قيمة العربون. تحقق من الإنترنت.',
        type: 'alert',
        onConfirm: () => setModalConfig(null),
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Update Overall Price ──
  const handleUpdatePrice = async (order, newPriceAmount) => {
    setUpdatingId(order.id);
    const pNum = parseFloat(newPriceAmount) || 0;
    const dNum = parseFloat(order.footer?.depositAmount) || 0;
    const rem = Math.max(0, pNum - dNum);
    const patch = {
      footer: {
        ...order.footer,
        price: String(pNum),
        remaining: String(rem)
      }
    };
    try {
      await updateOrder(order.id, patch);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, footer: patch.footer } : o));
    } catch {
      setModalConfig({
        isOpen: true,
        title: 'خطأ',
        message: 'فشل في تحديث السعر الإجمالي. تحقق من الإنترنت.',
        type: 'alert',
        onConfirm: () => setModalConfig(null),
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Undo full paid marking ──
  const handleUndoPaid = (order) => {
    setModalConfig({
      isOpen: true,
      title: 'إلغاء تأكيد السداد',
      message: 'هل أنت متأكد من رغبتك في إلغاء تأكيد الدفع الكامل وإعادة الطلب إلى قائمة (غير مدفوعة)؟',
      isDanger: true,
      confirmText: 'نعم، إعادة كغير مدفوع',
      onConfirm: async () => {
        setModalConfig(null);
        setUpdatingId(order.id);
        const patch = {
          isPaid: false,
          paidAt: null,
          paidBy: null,
        };
        try {
          await updateOrder(order.id, patch);
          setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...patch } : o));
        } catch {
          setModalConfig({
            isOpen: true,
            title: 'خطأ',
            message: 'فشل في تحديث حالة الدفع.',
            type: 'alert',
            onConfirm: () => setModalConfig(null),
          });
        } finally {
          setUpdatingId(null);
        }
      }
    });
  };

  // ── Production Status updates ──
  const handleUpdateProduction = async (order, newStatus) => {
    setUpdatingId(order.id);
    const staffName = currentUser?.arabicName || currentUser?.username || 'طاقم المصنع';
    try {
      await updateProductionStatus(order.id, newStatus, staffName);
      setOrders(prev => prev.map(o => o.id === order.id ? {
        ...o,
        productionStatus: newStatus,
        productionStatusUpdatedAt: new Date().toISOString(),
        productionStatusUpdatedBy: staffName
      } : o));
    } catch {
      setModalConfig({
        isOpen: true,
        title: 'خطأ في المصنع',
        message: 'تعذر تحديث حالة التحضير بالمصنع. تأكد من الإنترنت.',
        type: 'alert',
        onConfirm: () => setModalConfig(null),
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Order Cancellation ──
  const handleCancelOrder = (order) => {
    setModalConfig({
      isOpen: true,
      title: 'إلغاء الطلبية',
      message: 'يرجى كتابة سبب إلغاء هذه الطلبية:',
      type: 'prompt',
      defaultValue: 'إلغاء بناءً على طلب الزبون / تعديل موعد',
      placeholder: 'سبب الإلغاء...',
      confirmText: 'تأكيد الإلغاء',
      isDanger: true,
      onConfirm: async (reason) => {
        setModalConfig(null);
        setUpdatingId(order.id);
        const staffName = currentUser?.arabicName || currentUser?.username || 'الموظف';
        try {
          await cancelOrder(order.id, reason, staffName);
          setOrders(prev => prev.map(o => o.id === order.id ? {
            ...o,
            isCancelled: true,
            cancelledReason: reason || 'إلغاء بناءً على طلب الزبون',
            cancelledBy: staffName,
            cancelledAt: new Date().toISOString()
          } : o));
        } catch {
          setModalConfig({
            isOpen: true,
            title: 'خطأ',
            message: 'حدث خطأ أثناء محاولة إلغاء الطلب.',
            type: 'alert',
            onConfirm: () => setModalConfig(null),
          });
        } finally {
          setUpdatingId(null);
        }
      }
    });
  };

  // ── Uncancel Order ──
  const handleUncancelOrder = (order) => {
    setModalConfig({
      isOpen: true,
      title: 'استعادة الطلبية',
      message: 'هل تريد استعادة هذه الطلبية الملغية وإعادتها لقائمة الطلبات النشطة؟',
      confirmText: 'استعادة الطلب',
      onConfirm: async () => {
        setModalConfig(null);
        setUpdatingId(order.id);
        try {
          await uncancelOrder(order.id);
          setOrders(prev => prev.map(o => o.id === order.id ? {
            ...o,
            isCancelled: false,
            cancelledReason: null,
            cancelledBy: null,
            cancelledAt: null
          } : o));
        } catch {
          setModalConfig({
            isOpen: true,
            title: 'خطأ',
            message: 'حدث خطأ أثناء استعادة الطلب.',
            type: 'alert',
            onConfirm: () => setModalConfig(null),
          });
        } finally {
          setUpdatingId(null);
        }
      }
    });
  };

  // ── Filter + search logic ──
  const filteredOrders = useMemo(() => {
    let result = orders;

    // 0. Cancelled view toggle
    if (showCancelledOnly) {
      return result.filter(o => o.isCancelled === true);
    } else {
      result = result.filter(o => o.isCancelled !== true);
    }

    // 1. Payment status filter
    if (paymentFilter === 'unpaid') {
      result = result.filter(o => !o.isPaid);
    } else if (paymentFilter === 'deposit_pending') {
      result = result.filter(o => o.footer?.depositPaid === true && !o.depositCollected && !o.isPaid);
    } else if (paymentFilter === 'paid') {
      result = result.filter(o => o.isPaid === true);
    }

    // 2. Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(o => 
        o.orderType === categoryFilter || 
        (Array.isArray(o.items) && o.items.some(i => i.orderType === categoryFilter))
      );
    }

    // 3. Production status filter
    if (productionFilter !== 'all') {
      result = result.filter(o => (o.productionStatus || 'received') === productionFilter);
    }

    // 4. Delivery Date filter (Due Today / Tomorrow)
    if (dateFilter !== 'all') {
      const todayStr = new Date().toISOString().split('T')[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      if (dateFilter === 'today') {
        // Includes orders due today AND past-due uncompleted/unpaid orders!
        result = result.filter(o => o.header?.deliveryDate === todayStr || (o.header?.deliveryDate && o.header?.deliveryDate < todayStr && o.productionStatus !== 'delivered' && !o.isPaid));
      } else if (dateFilter === 'tomorrow') {
        result = result.filter(o => o.header?.deliveryDate === tomorrowStr);
      }
    }

    // 5. Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const normQ = normalizeArabic(searchQuery);
      result = result.filter(o => {
        const id = (o.id || '').toLowerCase();
        const rawName = (o.header?.customerName || '').toLowerCase();
        const normName = normalizeArabic(o.header?.customerName || '');
        const phone = (o.header?.customerPhone || '').toLowerCase();
        return id.includes(q) || rawName.includes(q) || normName.includes(normQ) || phone.includes(q);
      });
    }

    return result;
  }, [orders, paymentFilter, categoryFilter, productionFilter, dateFilter, showCancelledOnly, searchQuery]);

  // Count orders due today for quick dashboard hint
  const dueTodayCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return orders.filter(o => !o.isCancelled && (o.header?.deliveryDate === todayStr || (o.header?.deliveryDate < todayStr && o.productionStatus !== 'delivered' && !o.isPaid))).length;
  }, [orders]);

  const cancelledCount = useMemo(() => {
    return orders.filter(o => o.isCancelled === true).length;
  }, [orders]);

  // Group orders for the same customer on the same delivery date
  const sameDayOrdersMap = useMemo(() => {
    return buildSameDayCustomerOrdersMap(orders);
  }, [orders]);

  // Group same-day customer orders into bundles if 2 or more appear in the filtered list
  const displayGroups = useMemo(() => {
    const groups = [];
    const processedOrderIds = new Set();

    for (const order of filteredOrders) {
      if (processedOrderIds.has(order.id)) continue;

      const sameDay = getSameDayCustomerInfo(order, sameDayOrdersMap);
      const matchingInFiltered = sameDay 
        ? filteredOrders.filter(o => sameDay.allOrders.some(so => so.id === o.id))
        : [order];

      if (matchingInFiltered.length > 1) {
        matchingInFiltered.forEach(o => processedOrderIds.add(o.id));

        const totalPrice = matchingInFiltered.reduce((sum, o) => {
          const p = parseFloat(o.footer?.price);
          return !isNaN(p) && p > 0 ? sum + p : sum;
        }, 0);

        const totalRemaining = matchingInFiltered.reduce((sum, o) => {
          if (o.isPaid) return sum;
          const rem = parseFloat(o.footer?.remaining);
          if (!isNaN(rem) && rem > 0) return sum + rem;
          const p = parseFloat(o.footer?.price);
          return !isNaN(p) && p > 0 ? sum + p : sum;
        }, 0);

        groups.push({
          type: 'bundle',
          key: `bundle_${order.id}_${matchingInFiltered.length}`,
          customerName: order.header?.customerName || 'زبون',
          customerPhone: order.header?.customerPhone || '',
          deliveryDate: order.header?.deliveryDate || '',
          orders: matchingInFiltered,
          totalPrice,
          totalRemaining,
        });
      } else {
        processedOrderIds.add(order.id);
        groups.push({
          type: 'single',
          key: order.id,
          order,
        });
      }
    }

    return groups;
  }, [filteredOrders, sameDayOrdersMap]);

  // ── Actions ──
  const handleWhatsApp = (order) => {
    const url = buildWhatsAppUrl(order);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#eaeaf2]" dir="rtl">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between max-w-[850px] mx-auto px-4 py-2.5">
        <div className="flex items-center gap-2">
          {/* User badge */}
          <div className={`text-white text-sm font-bold px-4 py-1.5 rounded-full font-cairo flex items-center gap-1.5 ${isCashier ? 'bg-indigo-800 shadow' : 'bg-[#1b2740]'}`}>
            <span>{isCashier ? '💵' : '👤'}</span>
            <span>{currentUser?.arabicName || currentUser?.username?.toUpperCase()}</span>
            {isCashier && <span className="bg-indigo-950 text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full ml-1">حساب صندوق (الكاشير)</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onNewOrder && !isCashier && (
            <button
              onClick={onNewOrder}
              className="bg-[#1a1a2e] text-white text-sm font-bold px-3.5 py-1.5 rounded-lg font-cairo hover:bg-[#2d2d4a] transition-colors shadow-sm"
            >
              + طلب جديد
            </button>
          )}
          {onFactory && !isCashier && ENABLE_FACTORY_SYSTEM && (
            <button
              onClick={onFactory}
              className="bg-amber-600 text-white text-sm font-extrabold px-3.5 py-1.5 rounded-lg font-cairo hover:bg-amber-700 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>👨‍🍳</span>
              <span>شاشة المصنع</span>
            </button>
          )}
          <button
            onClick={onLogout}
            className="border border-[#1a1a2e] text-[#1a1a2e] text-sm font-bold px-3 py-1.5 rounded-lg font-cairo hover:bg-[#1a1a2e] hover:text-white transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>

      {/* ── Main content card ── */}
      <div className="max-w-[850px] mx-auto px-4 pb-12">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

          {/* Page title & Refresh */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-gray-100 pb-3">
            <div>
              <h1 className="text-xl font-extrabold text-[#1a1a2e] font-cairo flex items-center gap-2">
                <span>📋</span>
                <span>{isCashier ? 'إدارة التحصيل المالي واستلام العربون' : 'سجل الطلبات ومتابعة التحضير بالمصنع'}</span>
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {lastRefreshed && (
                <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-200 font-cairo shadow-inner">
                  🕒 آخر تحديث: {lastRefreshed}
                </span>
              )}
              <button
                onClick={fetchOrders}
                disabled={loading}
                className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3.5 py-2 hover:bg-indigo-100 transition-colors font-cairo disabled:opacity-50 flex items-center gap-1 shadow-sm active:scale-95"
              >
                {loading ? '⏳ تحديث...' : '🔄 تحديث من السحابة'}
              </button>
            </div>
          </div>

          {/* 1. Delivery Date Quick Filter Bar */}
          <div className="mb-3.5 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {DATE_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { setDateFilter(tab.key); setShowCancelledOnly(false); }}
                    className={`text-xs font-bold px-3.5 py-1.5 rounded-lg font-cairo transition-all ${
                      dateFilter === tab.key && !showCancelledOnly
                        ? 'bg-indigo-700 text-white shadow font-extrabold'
                        : 'bg-white text-indigo-900 hover:bg-indigo-100 border border-indigo-200/60'
                    }`}
                  >
                    {tab.label} {tab.key === 'today' && dueTodayCount > 0 && `(${dueTodayCount})`}
                  </button>
                ))}
              </div>

              {/* Cancelled View Button */}
              <button
                onClick={() => setShowCancelledOnly(!showCancelledOnly)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg font-cairo transition-all border flex items-center gap-1 ${
                  showCancelledOnly
                    ? 'bg-red-600 text-white border-red-700 shadow font-extrabold'
                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                }`}
              >
                <span>🚫 الطلبات الملغية</span>
                <span className="bg-white text-red-800 rounded-full px-1.5 text-[10px] font-extrabold border border-red-200">{cancelledCount}</span>
              </button>
            </div>
          </div>

          {/* 2. Production Status Filter Bar (For Kitchen / Staff) */}
          {!showCancelledOnly && ENABLE_FACTORY_SYSTEM && (
            <div className="mb-3.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200/80">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {PRODUCTION_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setProductionFilter(tab.key)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-cairo transition-all text-center leading-snug ${
                      productionFilter === tab.key
                        ? 'bg-[#1a1a2e] text-white font-extrabold shadow-sm'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 font-bold'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Payment Status Segmented Filter Bar */}
          {!showCancelledOnly && (
            <div className="mb-3.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
                {PAYMENT_TABS.map(tab => {
                  const isActive = paymentFilter === tab.key;
                  const activeColorMap = {
                    unpaid: 'bg-amber-500 text-white shadow-md border-amber-600 font-extrabold',
                    deposit_pending: 'bg-indigo-600 text-white shadow-md border-indigo-700 font-extrabold',
                    paid: 'bg-green-600 text-white shadow-md border-green-700 font-extrabold',
                    all: 'bg-slate-800 text-white shadow-md border-slate-900 font-extrabold',
                  };
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setPaymentFilter(tab.key)}
                      className={`py-2 px-2 rounded-lg text-xs font-cairo transition-all text-center leading-snug ${
                        isActive ? activeColorMap[tab.key] : 'text-gray-600 hover:bg-slate-200 font-semibold'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Search bar */}
          <div className="relative mb-3.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="🔍 بحث باسم الزبون، أو رقم الهاتف، أو رقم الطلب CAKE-1218..."
              className="w-full text-sm font-cairo border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all bg-gray-50/50"
              dir="rtl"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 bg-gray-200 w-6 h-6 rounded-full text-sm font-bold flex items-center justify-center leading-none"
              >
                ✕
              </button>
            )}
          </div>

          {/* 5. Category tabs & Result Count */}
          <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1 border-b border-gray-100 pt-1">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setCategoryFilter(tab.key)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full font-cairo whitespace-nowrap transition-all ${
                  categoryFilter === tab.key
                    ? 'bg-indigo-700 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <span className="text-xs text-gray-600 font-bold font-cairo mr-auto bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
              عدد الطلبات المعروضة: {filteredOrders.length}
            </span>
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
              <span>⚠️</span>
              <p className="text-xs text-red-700 font-bold font-cairo">{error}</p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-bold text-gray-500 font-cairo">جاري التزامن وجلب أحدث بيانات التحصيل والمصنع من السحابة...</p>
            </div>
          )}

          {/* Orders grid */}
          {!loading && filteredOrders.length === 0 && (
            <EmptyState
              hasSearch={!!searchQuery.trim() || categoryFilter !== 'all' || dateFilter !== 'all' || productionFilter !== 'all'}
              paymentFilter={paymentFilter}
              showCancelledOnly={showCancelledOnly}
            />
          )}

          {!loading && filteredOrders.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {displayGroups.map((group) => {
                if (group.type === 'bundle') {
                  return (
                    <CustomerBundleCard
                      key={group.key}
                      group={group}
                      sameDayOrdersMap={sameDayOrdersMap}
                      isCashier={isCashier}
                      onEditOrder={onEditOrder}
                      handleWhatsApp={handleWhatsApp}
                      handleMarkPaid={handleMarkPaid}
                      handleUndoPaid={handleUndoPaid}
                      handleCollectDeposit={handleCollectDeposit}
                      handleUndoDeposit={handleUndoDeposit}
                      handleUpdateDeposit={handleUpdateDeposit}
                      handleUpdatePrice={handleUpdatePrice}
                      handleUpdateProduction={handleUpdateProduction}
                      handleCancelOrder={handleCancelOrder}
                      handleUncancelOrder={handleUncancelOrder}
                      updatingId={updatingId}
                    />
                  );
                }
                return (
                  <OrderCard
                    key={group.order.id}
                    order={group.order}
                    sameDayOrdersMap={sameDayOrdersMap}
                    onEdit={!isCashier ? () => onEditOrder?.(group.order) : null}
                    onWhatsApp={handleWhatsApp}
                    onMarkPaid={handleMarkPaid}
                    onUndoPaid={handleUndoPaid}
                    onCollectDeposit={handleCollectDeposit}
                    onUndoDeposit={handleUndoDeposit}
                    onUpdateDeposit={handleUpdateDeposit}
                    onUpdatePrice={handleUpdatePrice}
                    onUpdateProduction={handleUpdateProduction}
                    onCancel={!isCashier ? handleCancelOrder : null}
                    onUncancel={!isCashier ? handleUncancelOrder : null}
                    isUpdating={updatingId === group.order.id}
                  />
                );
              })}
            </div>
          )}

          {/* Load More Button for Pagination */}
          {hasMore && !searchQuery && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 font-cairo flex items-center gap-2"
              >
                {loadingMore ? '⏳ جاري تحميل المزيد...' : '📥 تحميل المزيد من الطلبات الأقدم'}
              </button>
            </div>
          )}

        </div>
      </div>

      {modalConfig && (
        <Modal
          {...modalConfig}
          onCancel={() => setModalConfig(null)}
        />
      )}

      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

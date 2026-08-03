import { useState, useEffect, useMemo } from 'react';
import { listOrders, updateOrder, collectDeposit, undoDeposit } from '../lib/ordersStore';
import { buildWhatsAppUrl } from '../lib/whatsapp';

// ── Arabic labels for order types ────────────────────────────────────────────
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

const FILTER_TABS = [
  { key: 'all',       label: 'كل الأصناف' },
  { key: 'cake',      label: 'كيك' },
  { key: 'chocolate', label: 'شوكولا' },
  { key: 'occasion',  label: 'مناسبة' },
  { key: 'simple',    label: 'بسيط' },
];

const PAYMENT_TABS = [
  { key: 'unpaid',          label: '⏳ كل غير المدفوعة (بانتظار التحصيل)' },
  { key: 'deposit_pending', label: '⏳ بانتظار استلام العربون' },
  { key: 'paid',            label: '✅ تم السداد بالكامل' },
  { key: 'all',             label: '🌐 كل الطلبات' },
];

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
    return [body.cakeShape, body.cakeType, body.cakeFlavor, body.cakeSize, body.serves ? `${body.serves} شخص` : null].filter(Boolean).join(' · ');
  }
  if (orderType === 'chocolate') {
    return [body.chocolateType, body.fillingType, body.quantity].filter(Boolean).join(' · ');
  }
  if (orderType === 'occasion') {
    return [body.hospitalityType, body.wrappingMethod, body.quantity].filter(Boolean).join(' · ');
  }
  if (orderType === 'simple') {
    return [body.itemName, body.chocolateName, body.pieces ? `${body.pieces} حبة` : null].filter(Boolean).join(' · ');
  }
  return '';
}

// ── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, onEdit, onWhatsApp, onMarkPaid, onUndoPaid, onCollectDeposit, onUndoDeposit, isUpdating, currentUser }) {
  const colors = ORDER_TYPE_COLORS[order.orderType] || ORDER_TYPE_COLORS.cake;
  const isPaid = order.isPaid === true;
  const requiresDeposit = order.footer?.depositPaid === true;
  const depositCollected = order.depositCollected === true;

  const depositVal = order.footer?.depositAmount || '0';
  const priceVal = order.footer?.price || '0';
  const remainingVal = (order.footer?.remaining !== undefined && order.footer?.remaining !== '')
    ? order.footer.remaining
    : String(Math.max(0, parseFloat(priceVal) - parseFloat(depositVal)));

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-gray-300"
      style={{ animation: 'cardIn 0.25s ease' }}
    >
      {/* Top color bar */}
      <div style={{ height: '4px', background: isPaid ? '#10b981' : requiresDeposit && !depositCollected ? '#f59e0b' : '#3b82f6' }} />

      <div className="p-4">
        {/* Row 1: ID + badges + date */}
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold font-cairo" dir="ltr" style={{ color: '#1a1a2e', fontFamily: "'Courier New', monospace", letterSpacing: '0.5px' }}>
              {order.id}
            </span>
            <span
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full font-cairo"
              style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
            >
              {ORDER_TYPE_LABELS[order.orderType] || order.orderType}
            </span>

            {/* Dynamic Status Badges */}
            {isPaid ? (
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
            )}
          </div>
          <span className="text-xs text-gray-400 font-cairo" dir="ltr">
            {fmtDate(order.createdAt)}
          </span>
        </div>

        {/* Row 2: Customer info */}
        <div className="flex items-center gap-3 mb-2.5">
          {/* Avatar circle */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm" style={{ background: isPaid ? '#10b981' : requiresDeposit && !depositCollected ? '#f59e0b' : '#3b82f6' }}>
            {(order.header?.customerName || '?')[0]}
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-800 font-cairo truncate">
              {order.header?.customerName || '—'}
            </p>
            <p className="text-xs text-gray-500 font-cairo" dir="ltr">
              {order.header?.customerPhone || ''}
            </p>
          </div>
        </div>

        {/* Row 3: Body summary & Delivery specs */}
        <div className="bg-gray-50 rounded-lg p-2.5 mb-3 border border-gray-100">
          <p className="text-xs text-gray-600 font-cairo leading-relaxed">
            <span className="font-bold text-gray-800">التفاصيل: </span>
            {bodySummary(order.orderType, order.body) || '—'}
          </p>
          {order.header?.deliveryDate && (
            <p className="text-xs text-gray-500 font-cairo mt-1">
              <span className="font-bold text-indigo-900">📅 التسليم: </span>
              {fmtDate(`${order.header.deliveryDate}T00:00:00`)} {order.header.dayName ? `(${order.header.dayName})` : ''} · {order.header.deliveryTime || '—'}
            </p>
          )}
        </div>

        {/* Row 4: Financial balance box (Tailored for Cashier verification) */}
        <div className="text-xs font-cairo mb-3.5 p-3 rounded-xl border bg-slate-50 border-slate-200 shadow-inner">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-500 font-bold">السعر الإجمالي للطلب:</span>
            <span className="font-extrabold text-slate-900 text-base" dir="ltr">${priceVal}</span>
          </div>

          {requiresDeposit && (
            <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-200">
              <span className="text-indigo-900 font-semibold">
                قيمة العربون المقرر في الطلب:
              </span>
              <span className={`font-bold px-2 py-0.5 rounded ${depositCollected ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-amber-100 text-amber-900 border border-amber-300'}`}>
                {depositCollected ? `✓ تم استلام العربون ($${depositVal})` : `⏳ لم يتم تحصيل العربون بعد ($${depositVal})`}
              </span>
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

        {/* Row 5: Action buttons (Dynamic Cashier Workflow) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-gray-100">
          
          {/* STEP 1: Collect Deposit Button (When deposit required and not collected yet) */}
          {!isPaid && requiresDeposit && !depositCollected && (
            <button
              onClick={() => onCollectDeposit(order)}
              disabled={isUpdating}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold py-2.5 px-3 rounded-lg shadow transition-all font-cairo active:scale-[0.97] flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              💵 تأكيد تحصيل العربون (${depositVal})
            </button>
          )}

          {/* STEP 2 / Full Payment: Mark remaining balance as collected upon pickup */}
          {!isPaid && (
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

          {/* UNDO DEPOSIT ACTION (If cashier collected deposit by mistake) */}
          {!isPaid && requiresDeposit && depositCollected && (
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
          {isPaid && (
            <button
              onClick={() => onUndoPaid(order)}
              disabled={isUpdating}
              className="bg-gray-100 hover:bg-amber-50 border border-gray-300 hover:border-amber-300 text-gray-700 hover:text-amber-800 text-xs font-bold py-2 px-3 rounded-lg transition-colors font-cairo active:scale-[0.97] flex items-center justify-center gap-1 disabled:opacity-50"
            >
              ↩️ إلغاء تأكيد الدفع الكامل
            </button>
          )}

          {/* Edit button — ONLY rendered for admin / ordinary staff (HIDDEN for Cashiers!) */}
          {onEdit && (
            <button
              onClick={() => onEdit(order)}
              className="border-2 border-[#1a1a2e] text-[#1a1a2e] hover:bg-[#1a1a2e] hover:text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors font-cairo active:scale-[0.97] flex items-center justify-center gap-1"
            >
              ✏️ تعديل تفاصيل الطلبية
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
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasSearch, paymentFilter }) {
  const labelMap = {
    unpaid: 'لا توجد طلبات معلقة بانتظار التحصيل! 🎉',
    deposit_pending: 'لا توجد طلبات بانتظار تحصيل عربون حالياً.',
    paid: 'لا توجد طلبات مسددة بالكامل في القائمة بعد.',
    all: 'لا توجد طلبات مسجلة حتى الآن.',
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">{hasSearch ? '🔍' : paymentFilter === 'unpaid' ? '✨' : '📋'}</div>
      <p className="text-gray-700 text-base font-bold font-cairo mb-1">
        {hasSearch ? 'لم يتم العثور على طلبات مطابقة للبحث' : (labelMap[paymentFilter] || labelMap.all)}
      </p>
      <p className="text-gray-400 text-xs font-cairo mt-1">
        {hasSearch ? 'جرب البحث بكلمة أو رقم هاتف مختلف' : 'يمكنك تبديل التصفية لعرض باقي قائمة الطلبات'}
      </p>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * OrderHistoryView — Browse, search, and manage past orders from Firestore.
 * Cashier role gets a tailored two-step down payment verification interface without creation/editing rights.
 */
export default function OrderHistoryView({ currentUser, onLogout, onNewOrder, onEditOrder }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Default to 'unpaid' filter so cashier instantly sees active awaiting collections
  const [paymentFilter, setPaymentFilter] = useState('unpaid'); 
  const [categoryFilter, setCategoryFilter] = useState('all');

  const isCashier = currentUser?.role === 'cashier';

  // ── Fetch orders from Firestore on mount ──
  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listOrders(200);
      setOrders(data);
      const now = new Date();
      setLastRefreshed(now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setError('تعذر تحميل الطلبات من السحابة. تأكد من اتصالك بالإنترنت.');
      console.error('Fetch orders error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  // ── STEP 1: Mark deposit as collected by Cashier ──
  const handleCollectDeposit = async (order) => {
    setUpdatingId(order.id);
    const cashierName = currentUser?.arabicName || currentUser?.username || 'الكاشير';
    try {
      const updated = await collectDeposit(order.id, cashierName);
      const patch = updated || { depositCollected: true, depositCollectedAt: new Date().toISOString(), depositCollectedBy: cashierName };
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...patch } : o));
    } catch (e) {
      alert('فشل في تسجيل استلام العربون. تحقق من الإنترنت.');
    } finally {
      setUpdatingId(null);
    }
  };

  // ── UNDO Deposit collection ──
  const handleUndoDeposit = async (order) => {
    if (!window.confirm('هل أنت متأكد من إلغاء استلام العربون لهذا الطلب؟')) return;
    setUpdatingId(order.id);
    try {
      const updated = await undoDeposit(order.id);
      const patch = updated || { depositCollected: false, depositCollectedAt: null, depositCollectedBy: null };
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...patch } : o));
    } catch (e) {
      alert('فشل في تحديث حالة العربون.');
    } finally {
      setUpdatingId(null);
    }
  };

  // ── STEP 2 / Full Payment: Mark order as fully paid in database ──
  const handleMarkPaid = async (order) => {
    const depositCollected = order.depositCollected === true;
    const requiresDeposit = order.footer?.depositPaid === true;
    const amountToCollect = requiresDeposit && !depositCollected
      ? (order.footer?.price || '0')
      : requiresDeposit
      ? (order.footer?.remaining || '0')
      : (order.footer?.price || '0');

    if (!window.confirm(`💰 تأكيد التحصيل: هل أنت متأكد من تحصيل المبلغ المطلوب ($${amountToCollect}) وتحديد الطلبية كمُسدّدة بالكامل؟`)) {
      return;
    }

    setUpdatingId(order.id);
    const cashierName = currentUser?.arabicName || currentUser?.username || 'الكاشير';
    const patch = {
      isPaid: true,
      paidAt: new Date().toISOString(),
      paidBy: cashierName,
      // Ensure deposit is also marked collected if paying entirely
      depositCollected: true,
      depositCollectedBy: order.depositCollectedBy || cashierName,
    };
    try {
      await updateOrder(order.id, patch);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...patch } : o));
    } catch (e) {
      alert('فشل في تحديث حالة الدفع الكامل. تحقق من الإنترنت.');
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Undo full paid marking ──
  const handleUndoPaid = async (order) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء تأكيد الدفع الكامل وإعادة الطلب إلى قائمة (غير مدفوعة)؟')) return;
    setUpdatingId(order.id);
    const patch = {
      isPaid: false,
      paidAt: null,
      paidBy: null,
    };
    try {
      await updateOrder(order.id, patch);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...patch } : o));
    } catch (e) {
      alert('فشل في تحديث حالة الدفع.');
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Filter + search logic ──
  const filteredOrders = useMemo(() => {
    let result = orders;

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
      result = result.filter(o => o.orderType === categoryFilter);
    }

    // 3. Search — match against ID, customer name, or phone
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(o => {
        const id = (o.id || '').toLowerCase();
        const name = (o.header?.customerName || '').toLowerCase();
        const phone = (o.header?.customerPhone || '').toLowerCase();
        return id.includes(q) || name.includes(q) || phone.includes(q);
      });
    }

    return result;
  }, [orders, paymentFilter, categoryFilter, searchQuery]);

  // ── Actions ──
  const handleWhatsApp = (order) => {
    const url = buildWhatsAppUrl(order);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#eaeaf2]" dir="rtl">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between max-w-[800px] mx-auto px-4 py-2.5">
        <div className="flex items-center gap-2">
          {/* User badge */}
          <div className={`text-white text-sm font-bold px-4 py-1.5 rounded-full font-cairo flex items-center gap-1.5 ${isCashier ? 'bg-indigo-800 shadow' : 'bg-[#1b2740]'}`}>
            <span>{isCashier ? '💵' : '👤'}</span>
            <span>{currentUser?.arabicName || currentUser?.username?.toUpperCase()}</span>
            {isCashier && <span className="bg-indigo-950 text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full ml-1">حساب صندوق (الكاشير)</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* + New Order button (HIDDEN for Cashier role!) */}
          {onNewOrder && !isCashier && (
            <button
              onClick={onNewOrder}
              className="bg-[#1a1a2e] text-white text-sm font-bold px-3.5 py-1 rounded-lg font-cairo hover:bg-[#2d2d4a] transition-colors shadow-sm"
            >
              + طلب جديد
            </button>
          )}
          <button
            onClick={onLogout}
            className="border border-[#1a1a2e] text-[#1a1a2e] text-sm font-bold px-3 py-1 rounded-lg font-cairo hover:bg-[#1a1a2e] hover:text-white transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>

      {/* ── Main content card ── */}
      <div className="max-w-[800px] mx-auto px-4 pb-12">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

          {/* Page title & Refresh */}
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
            <div>
              <h1 className="text-xl font-extrabold text-[#1a1a2e] font-cairo flex items-center gap-2">
                <span>📋</span>
                <span>{isCashier ? 'إدارة التحصيل المالي واستلام العربون' : 'سجل الطلبات والمتابعة'}</span>
              </h1>
              <p className="text-xs text-gray-500 font-cairo mt-0.5">
                {isCashier ? 'قم بتسجيل استلام العربون المقدم أولاً، وتأكيد استلام المتبقي عند التسليم النهائي' : 'ابحث، تابع حالات الدفع، وعَدّل على أي طلب بسهولة'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
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

          {/* 1. Payment Status Segmented Filter Bar */}
          <div className="mb-4">
            <span className="text-xs font-bold text-gray-700 font-cairo mb-1.5 block">تصنيف حسب حالة التحصيل المالي:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
              {PAYMENT_TABS.map(tab => {
                const isActive = paymentFilter === tab.key;
                const activeColorMap = {
                  unpaid: 'bg-amber-500 text-white shadow-md border-amber-600 font-extrabold',
                  deposit_pending: 'bg-indigo-600 text-white shadow-md border-indigo-700 font-extrabold',
                  paid: 'bg-green-600 text-white shadow-md border-green-700 font-extrabold',
                  all: 'bg-[#1a1a2e] text-white shadow-md border-[#1a1a2e] font-extrabold',
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

          {/* 2. Search bar */}
          <div className="relative mb-3.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 بحث باسم الزبون، أو رقم الهاتف، أو رقم الطلب CAKE-1218..."
              className="w-full text-sm font-cairo border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all bg-gray-50/50"
              dir="rtl"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 bg-gray-200 w-6 h-6 rounded-full text-sm font-bold flex items-center justify-center leading-none"
              >
                ✕
              </button>
            )}
          </div>

          {/* 3. Category tabs & Result Count */}
          <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1 border-b border-gray-100 pt-1">
            <span className="text-xs text-gray-400 font-cairo font-bold ml-1">الصنف:</span>
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
            {/* Results count badge */}
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
              <p className="text-sm font-bold text-gray-500 font-cairo">جاري التزامن وجلب أحدث بيانات التحصيل من السحابة...</p>
            </div>
          )}

          {/* Orders grid */}
          {!loading && filteredOrders.length === 0 && (
            <EmptyState
              hasSearch={!!searchQuery.trim() || categoryFilter !== 'all'}
              paymentFilter={paymentFilter}
            />
          )}

          {!loading && filteredOrders.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onEdit={!isCashier && onEditOrder ? onEditOrder : null}
                  onWhatsApp={handleWhatsApp}
                  onMarkPaid={handleMarkPaid}
                  onUndoPaid={handleUndoPaid}
                  onCollectDeposit={handleCollectDeposit}
                  onUndoDeposit={handleUndoDeposit}
                  isUpdating={updatingId === order.id}
                  currentUser={currentUser}
                />
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Card entrance animation */}
      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

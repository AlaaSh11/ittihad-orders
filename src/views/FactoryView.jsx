import { useState, useEffect, useMemo } from 'react';
import { listOrders, updateProductionStatus } from '../lib/ordersStore';
import { CAKE_ADDONS } from '../constants/cakeOrderFields';
import { compareDeliveryTimes } from '../constants/timeSlots';
import { buildSameDayCustomerOrdersMap, getSameDayCustomerInfo } from '../lib/orderGrouping';
import Modal from '../components/ui/Modal';

// ── Status metadata and color mapping for KDS ──────────────────────────────────
const STATUS_BADGES = {
  received:    { label: '📥 بانتظار البدء', color: 'bg-blue-50 text-blue-800 border-blue-200', border: 'border-blue-300', cardBg: 'bg-white' },
  in_progress: { label: '👨‍🍳 قيد التحضير', color: 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse', border: 'border-amber-400', cardBg: 'bg-amber-50/20' },
  ready:       { label: '✅ جاهز للتسليم', color: 'bg-emerald-50 text-emerald-800 border-emerald-300', border: 'border-emerald-400', cardBg: 'bg-emerald-50/20' },
  delivered:   { label: '🚚 تم التسليم', color: 'bg-slate-100 text-slate-700 border-slate-200', border: 'border-slate-300', cardBg: 'bg-slate-50/60 opacity-80' },
};

const TAB_FILTERS = [
  { key: 'active',      label: '⚡ الأوامر النشطة بالمطبخ', icon: '🔥' },
  { key: 'received',    label: '📥 أوامر جديدة (بانتظار البدء)', icon: '📝' },
  { key: 'in_progress', label: '👨‍🍳 قيد التنفيذ الآن', icon: '🍳' },
  { key: 'ready',       label: '✅ المنجزة اليوم (جاهز للتسليم)', icon: '📦' },
  { key: 'all',         label: '🌐 كافة الأوامر', icon: '📋' },
];

const TYPE_ICONS = { cake: '🎂', chocolate: '🍫', occasion: '🎁', simple: '🛒' };
const TYPE_LABELS = { cake: 'كيك', chocolate: 'شوكولا', occasion: 'مناسبة', simple: 'بسيط' };

/**
 * Helper to resolve add-on IDs to readable Arabic names
 */
function resolveAddons(addonIds) {
  if (!Array.isArray(addonIds) || addonIds.length === 0) return null;
  return addonIds
    .map(id => {
      const found = CAKE_ADDONS.find(a => a.id === id);
      return found ? found.label : id;
    })
    .filter(Boolean);
}

/**
 * Format date for kitchen staff view
 */
function formatKitchenDate(dateStr, timeStr, dayName) {
  if (!dateStr) return 'موعد غير محدد';
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  let prefix = dateStr;
  if (dateStr === todayStr) prefix = 'اليوم 🔴';
  else if (dateStr === tomorrowStr) prefix = 'غداً 🟡';
  else if (dayName) prefix = `${dayName} (${dateStr})`;

  return `${prefix} ${timeStr ? ` · الساعة: ${timeStr}` : ''}`;
}

/**
 * Build a concise one-line summary for minimal card view
 */
function buildQuickSummary(order) {
  const isMultiItem = Array.isArray(order.items) && order.items.length > 0;
  const items = isMultiItem
    ? order.items
    : (order.orderType && order.body ? [{ orderType: order.orderType, body: order.body }] : []);

  if (items.length === 0) return 'طلب بدون تفاصيل';

  const snippets = [];
  items.forEach(it => {
    const { orderType, body } = it;
    if (!body) return;
    if (orderType === 'cake') {
      const parts = [
        body.cakeShape && body.cakeType ? `${body.cakeShape} · ${body.cakeType}` : (body.cakeType || body.cakeShape),
        body.serves ? `${body.serves} شخص` : null,
      ].filter(Boolean);
      snippets.push(parts.join(' - ') || 'كيك');
    } else if (orderType === 'chocolate') {
      const parts = [body.chocolateType, body.quantity ? `${body.quantity}` : null].filter(Boolean);
      snippets.push(parts.join(' - ') || 'شوكولا');
    } else if (orderType === 'occasion') {
      const parts = [body.hospitalityType, body.quantity ? `${body.quantity}` : null].filter(Boolean);
      snippets.push(parts.join(' - ') || 'مناسبة');
    } else if (orderType === 'simple') {
      if (Array.isArray(body.items) && body.items.length > 0) {
        snippets.push(body.items.map(si => si.itemName).filter(Boolean).join('، ') || 'طلب بسيط');
      } else {
        snippets.push(body.itemName || 'طلب بسيط');
      }
    }
  });

  return snippets.join(' | ');
}

export default function FactoryView({ currentUser, onLogout, onSwitchToHistory }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [selectedOrder, setSelectedOrder] = useState(null); // Active order for full details modal
  const [zoomedPhoto, setZoomedPhoto] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [filterType, setFilterType] = useState('all_types'); // 'all_types', 'cake', 'chocolate', 'occasion'
  const [kdsError, setKdsError] = useState('');

  const staffName = currentUser?.arabicName || currentUser?.username || 'طاقم المصنع';

  // Fetch orders from Firestore
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await listOrders(300);
      const activeData = data.filter(o => !o.isCancelled);
      setOrders(activeData);
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('KDS Fetch error:', err);
      setKdsError('تعذر تحديث شاشة المطبخ من السحابة. تحقق من الاتصال بالإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh KDS every 45 seconds to catch new incoming orders immediately
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      fetchOrders();
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  // Update production status handler
  const handleStageChange = async (order, newStatus) => {
    setUpdatingId(order.id);
    try {
      await updateProductionStatus(order.id, newStatus, staffName);
      setOrders(prev => prev.map(o => o.id === order.id ? {
        ...o,
        productionStatus: newStatus,
        productionStatusUpdatedAt: new Date().toISOString(),
        productionStatusUpdatedBy: staffName
      } : o));

      // Also update selectedOrder in modal if open
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder(prev => ({
          ...prev,
          productionStatus: newStatus,
          productionStatusUpdatedAt: new Date().toISOString(),
          productionStatusUpdatedBy: staffName
        }));
      }
    } catch {
      setKdsError('فشل في تحديث حالة الطلب. تحقق من اتصالك بالإنترنت.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter orders by tab & type
  const filteredOrders = useMemo(() => {
    let list = orders;

    // Filter by product type
    if (filterType !== 'all_types') {
      list = list.filter(o => {
        if (Array.isArray(o.items) && o.items.length > 0) {
          return o.items.some(i => i.orderType === filterType);
        }
        return o.orderType === filterType;
      });
    }

    // Filter by KDS stage tab
    let result = list;
    if (activeTab === 'active') {
      result = list.filter(o => !o.productionStatus || o.productionStatus === 'received' || o.productionStatus === 'in_progress');
    } else if (activeTab !== 'all') {
      result = list.filter(o => (o.productionStatus || 'received') === activeTab);
    }

    // Sort chronologically by delivery date then delivery time
    return [...result].sort((a, b) => {
      const dateA = a.header?.deliveryDate || '9999-99-99';
      const dateB = b.header?.deliveryDate || '9999-99-99';
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      return compareDeliveryTimes(a.header?.deliveryTime, b.header?.deliveryTime);
    });
  }, [orders, activeTab, filterType]);

  // Group same-day customer orders for kitchen awareness
  const sameDayOrdersMap = useMemo(() => {
    return buildSameDayCustomerOrdersMap(orders);
  }, [orders]);

  // Counts for quick summary badges
  const stats = useMemo(() => {
    let received = 0, inProgress = 0, ready = 0;
    orders.forEach(o => {
      const st = o.productionStatus || 'received';
      if (st === 'received') received++;
      if (st === 'in_progress') inProgress++;
      if (st === 'ready') ready++;
    });
    return { received, inProgress, ready };
  }, [orders]);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 font-cairo" dir="rtl">
      
      {/* ── KDS Header Bar ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Brand & Title */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2">
              <span className="text-3xl bg-amber-50 p-2 rounded-xl border border-amber-200">👨‍🍳</span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  شاشة المطبخ والمصنع
                </h1>
              </div>
            </div>

            {/* Logout button mobile */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={fetchOrders}
                disabled={loading}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg text-xs font-bold border border-slate-300"
                title="تحديث قائمة الأوامر"
              >
                🔄
              </button>
              <button
                onClick={onLogout}
                className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold px-3 py-1.5 rounded-lg"
              >
                خروج
              </button>
            </div>
          </div>

          {/* Quick stats indicators */}
          <div className="flex items-center gap-2 flex-wrap justify-center w-full md:w-auto">
            <div className="bg-white border border-blue-200 px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span className="text-xs text-slate-600 font-bold">جديد:</span>
              <span className="text-sm font-black text-slate-900">{stats.received}</span>
            </div>
            <div className="bg-white border border-amber-300 px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
              <span className="text-xs text-slate-600 font-bold">قيد التحضير:</span>
              <span className="text-sm font-black text-amber-700">{stats.inProgress}</span>
            </div>
            <div className="bg-white border border-emerald-300 px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs text-slate-600 font-bold">منجز اليوم:</span>
              <span className="text-sm font-black text-emerald-700">{stats.ready}</span>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-2 ml-2 border-r border-slate-200 pr-3">
              {onSwitchToHistory && (
                <button
                  onClick={onSwitchToHistory}
                  className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-extrabold px-3.5 py-2 rounded-xl transition-colors"
                >
                  📋 العودة لسجل الإدارة
                </button>
              )}
              <button
                onClick={fetchOrders}
                disabled={loading}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                <span>🔄</span>
                <span>{loading ? 'تزامن...' : 'تحديث'}</span>
              </button>
              <button
                onClick={onLogout}
                className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-xl transition-colors"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>

        {/* ── KDS Stage Tabs Bar ── */}
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Main stage filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {TAB_FILTERS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`text-xs sm:text-sm font-black px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 scale-[1.02]'
                      : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Type filters & Last updated */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 text-xs">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-white border border-slate-300 font-bold text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 shadow-xs"
            >
              <option value="all_types">🍰 كافة أصناف المخبوزات</option>
              <option value="cake">🎂 طلبات الكيك فقط</option>
              <option value="chocolate">🍫 طلبات الشوكولا</option>
              <option value="occasion">🎁 طلبات المناسبات</option>
            </select>
            {lastUpdated && (
              <span className="text-slate-500 font-semibold bg-slate-100 px-2 py-1 rounded border border-slate-200" dir="ltr">
                🕒 {lastUpdated}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Main KDS Grid ── */}
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        
        {loading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-base font-extrabold text-slate-600">جاري تحميل بطاقات العمل من غرفة الأوامر السحابية...</p>
          </div>
        )}

        {!loading && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm font-bold text-slate-400">لا توجد طلبات</p>
          </div>
        )}

        {/* Minimal Compact Tickets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.map((order) => {
            const st = order.productionStatus || 'received';
            const badge = STATUS_BADGES[st] || STATUS_BADGES.received;
            const isUpdatingThis = updatingId === order.id;
            const dueToday = order.header?.deliveryDate === new Date().toISOString().split('T')[0];

            // Normalize items
            const isMultiItem = Array.isArray(order.items) && order.items.length > 0;
            const items = isMultiItem
              ? order.items
              : (order.orderType && order.body ? [{ orderType: order.orderType, body: order.body }] : []);

            const typeBadgeText = isMultiItem
              ? [...new Set(order.items.map(i => i.orderType))].map(t => `${TYPE_ICONS[t] || '📦'} ${TYPE_LABELS[t] || t}`).join(' + ')
              : `${TYPE_ICONS[order.orderType] || '📦'} ${TYPE_LABELS[order.orderType] || order.orderType || 'طلب'}`;

            const summary = buildQuickSummary(order);
            const sameDay = getSameDayCustomerInfo(order, sameDayOrdersMap);

            // Check if there is inscription
            const cakeItem = items.find(i => i.orderType === 'cake');
            const inscription = cakeItem?.body?.inscription;

            return (
              <div
                key={order.id}
                className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-xs ${
                  sameDay ? 'border-r-4 border-r-indigo-600' : ''
                } ${badge.border} ${badge.cardBg} hover:border-amber-400 hover:shadow-lg hover:scale-[1.01]`}
              >
                {/* Clickable Header & Summary for Full Details */}
                <div
                  onClick={() => setSelectedOrder(order)}
                  className="p-3.5 space-y-2.5 cursor-pointer flex-1"
                >
                  {/* Top Bar: ID + Status + Type */}
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {order.id}
                      </span>
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <span className="text-[11px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {typeBadgeText}
                    </span>
                  </div>

                  {/* Multi-order same day notification for kitchen */}
                  {sameDay && (
                    <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl px-2.5 py-1 text-[11px] font-black flex items-center justify-between gap-1 shadow-2xs">
                      <span className="flex items-center gap-1.5">
                        <span>🔗</span>
                        <span>طلب {sameDay.orderNum} من {sameDay.count} لنفس الزبون اليوم</span>
                      </span>
                      <span className="font-mono text-indigo-700 text-[10px] font-bold">
                        مع: {sameDay.siblingIds.join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Delivery Schedule & Branch Banner */}
                  <div className={`p-2 rounded-xl text-xs font-black flex items-center justify-between gap-1.5 ${
                    dueToday ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}>
                    <span className="truncate">⏰ {formatKitchenDate(order.header?.deliveryDate, order.header?.deliveryTime, order.header?.dayName)}</span>
                    {order.header?.deliveryMethod && (
                      <span className="bg-white text-indigo-700 px-2 py-0.5 rounded text-[11px] shrink-0 border border-indigo-200 shadow-xs">
                        📍 {order.header.deliveryMethod}
                      </span>
                    )}
                  </div>

                  {/* Quick Item Summary */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
                    <p className="text-xs font-black text-slate-900 line-clamp-2 leading-relaxed">
                      {summary}
                    </p>
                    {inscription && (
                      <p className="text-[11px] font-black text-purple-700 truncate">
                        ✍️ نص: « {inscription} »
                      </p>
                    )}
                  </div>

                  {/* Customer name & details hint */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold pt-1">
                    <span className="truncate">🏷️ {order.header?.customerName || 'زبون'}</span>
                    <span className="text-indigo-600 font-black text-[11px] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 hover:bg-indigo-100 shrink-0">
                      تفاصيل كاملة 🔍
                    </span>
                  </div>
                </div>

                {/* Bottom KDS Action Buttons */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-200 mt-auto">
                  {st === 'received' && (
                    <button
                      onClick={() => handleStageChange(order, 'in_progress')}
                      disabled={isUpdatingThis}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs py-2.5 px-3 rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <span>👨‍🍳</span>
                      <span>البدء بالتحضير والتجهيز</span>
                    </button>
                  )}

                  {st === 'in_progress' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStageChange(order, 'ready')}
                        disabled={isUpdatingThis}
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-black text-xs py-2.5 px-3 rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <span>✅</span>
                        <span>إتمام التجهيز</span>
                      </button>
                      <button
                        onClick={() => handleStageChange(order, 'received')}
                        disabled={isUpdatingThis}
                        title="تراجع عن التحضير"
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-2.5 rounded-xl transition-colors shrink-0 font-extrabold text-xs cursor-pointer shadow-xs"
                      >
                        ↩️
                      </button>
                    </div>
                  )}

                  {st === 'ready' && (
                    <div className="flex items-center justify-between gap-1.5 bg-emerald-50 border border-emerald-200 p-2 rounded-xl">
                      <span className="text-[11px] font-black text-emerald-800">✅ تم التجهيز بالكامل</span>
                      <button
                        onClick={() => handleStageChange(order, 'in_progress')}
                        disabled={isUpdatingThis}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-2 py-1 rounded-lg text-[10px] font-extrabold transition-colors cursor-pointer shadow-xs"
                      >
                        ↩️ تراجع
                      </button>
                    </div>
                  )}

                  {st === 'delivered' && (
                    <div className="text-center text-[11px] font-extrabold text-purple-800 bg-purple-50 border border-purple-200 py-1.5 rounded-xl">
                      🚚 تم التسليم
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ── Order Full Specs Details Modal (Popup) ── */}
      {selectedOrder && (
        <div
          onClick={() => setSelectedOrder(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
          dir="rtl"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white border-2 border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl text-slate-800 flex flex-col justify-between"
          >
            {/* Modal Header */}
            <div className="bg-slate-50 p-4 border-b border-slate-200 sticky top-0 z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl font-black font-mono text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200">
                  {selectedOrder.id}
                </span>
                <span className={`text-xs font-black px-3 py-1 rounded-full border ${STATUS_BADGES[selectedOrder.productionStatus || 'received']?.color}`}>
                  {STATUS_BADGES[selectedOrder.productionStatus || 'received']?.label}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-white hover:bg-red-50 hover:text-red-600 text-slate-600 font-black text-xs px-3 py-1.5 rounded-xl border border-slate-300 transition-colors cursor-pointer"
              >
                ✕ إغلاق
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4">
              
              {/* Delivery & Customer Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500">اسم صاحب الطلب:</span>
                  <strong className="text-base text-slate-900 font-black">{selectedOrder.header?.customerName || 'زبون'}</strong>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-500">⏰ موعد التسليم:</span>
                  <strong className="text-xs text-amber-800 font-black">
                    {formatKitchenDate(selectedOrder.header?.deliveryDate, selectedOrder.header?.deliveryTime, selectedOrder.header?.dayName)}
                  </strong>
                </div>
                {selectedOrder.header?.deliveryMethod && (
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500">📍 طريقة الاستلام والفرع:</span>
                    <strong className="text-xs text-indigo-700 font-bold">{selectedOrder.header.deliveryMethod}</strong>
                  </div>
                )}
              </div>

              {/* Multi-order connection banner in modal */}
              {(() => {
                const modalSameDay = getSameDayCustomerInfo(selectedOrder, sameDayOrdersMap);
                if (!modalSameDay) return null;
                return (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 text-xs font-cairo shadow-2xs">
                    <div className="flex items-center gap-1.5 font-black text-indigo-950 mb-1.5">
                      <span>👥</span>
                      <span>تنبيه المطبخ: هذا الزبون لديه {modalSameDay.count} طلبيات لنفس موعد التسليم ({modalSameDay.deliveryDate})</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {modalSameDay.allOrders.map((sib, i) => {
                        const isCurrent = sib.id === selectedOrder.id;
                        return (
                          <div
                            key={sib.id}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black border flex items-center gap-2 transition-all ${
                              isCurrent
                                ? 'bg-indigo-700 text-white border-indigo-800 shadow-xs'
                                : 'bg-white text-indigo-900 border-indigo-300'
                            }`}
                          >
                            <span>{isCurrent ? `📍 هذا الطلب (${i + 1}):` : `🔗 طلب آخر (${i + 1}):`}</span>
                            <span className="font-mono">{sib.id}</span>
                            <span className={`text-[10px] ${isCurrent ? 'text-indigo-200' : 'text-indigo-700'}`}>
                              ({(Array.isArray(sib.items) && sib.items.length > 0)
                                ? sib.items.map(it => TYPE_LABELS[it.orderType] || it.orderType).join('+')
                                : TYPE_LABELS[sib.orderType] || sib.orderType})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Items Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  📋 المواصفات التفصيلية للتحضير والتزيين:
                </h3>

                {(Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0
                  ? selectedOrder.items
                  : (selectedOrder.orderType && selectedOrder.body ? [{ orderType: selectedOrder.orderType, body: selectedOrder.body }] : [])
                ).map((item, itemIdx) => {
                  const { orderType, body } = item;
                  const itemAddons = resolveAddons(body?.addons);

                  return (
                    <div key={itemIdx} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                        <span className="text-base">{TYPE_ICONS[orderType] || '📦'}</span>
                        <span className="text-xs font-black text-slate-800">
                          الصنف {itemIdx + 1}: {TYPE_LABELS[orderType] || orderType}
                        </span>
                      </div>

                      {/* ── CAKE ── */}
                      {orderType === 'cake' && body && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-xs font-semibold bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div>
                              <span className="text-slate-500 block text-[11px]">الشكل والقالب:</span>
                              <span className="text-sm font-black text-slate-900">{body.cakeShape || '—'} · {body.cakeType || '—'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">القياس والأشخاص:</span>
                              <span className="text-sm font-black text-amber-800" dir="ltr">{body.cakeSize || '—'} · ({body.serves || '؟'} شخص)</span>
                            </div>
                            <div className="pt-2 border-t border-slate-200 col-span-2 flex flex-wrap justify-between gap-2">
                              <div><span className="text-slate-500 text-[11px]">النكهة: </span><span className="font-extrabold text-slate-900">{body.cakeFlavor || '—'}</span></div>
                              <div><span className="text-slate-500 text-[11px]">الحشوة: </span><span className="font-extrabold text-indigo-700">{body.cakeFilling || '—'}</span></div>
                              <div><span className="text-slate-500 text-[11px]">لون القالب: </span><span className="font-extrabold text-pink-700">{body.cakeColor || '—'}</span></div>
                            </div>
                          </div>

                          {(body.inscription || body.writeOn) && (
                            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 shadow-inner">
                              <span className="text-[11px] font-extrabold text-purple-800 block mb-1">
                                ✍️ النص على القالب {body.writeOn ? `(المكان: ${body.writeOn})` : ''}:
                              </span>
                              <p className="text-base font-black text-purple-950 bg-white p-2.5 rounded-lg border border-purple-200 text-center select-all">
                                {body.inscription ? `« ${body.inscription} »` : '— بدون كتابة —'}
                              </p>
                            </div>
                          )}

                          {(body.photoSize && body.photoSize !== 'بلا صورة') && (
                            <div className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-200 flex justify-between">
                              <span>🖼️ الطباعة: <strong className="text-slate-900">{body.photoSize}</strong></span>
                              {body.photoSource && <span>المصدر: <strong className="text-slate-700">{body.photoSource}</strong></span>}
                            </div>
                          )}

                          {itemAddons && itemAddons.length > 0 && (
                            <div>
                              <span className="text-xs font-bold text-slate-500 block mb-1.5">🌟 إضافات واكسسوارات:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {itemAddons.map((label, idx) => (
                                  <span key={idx} className="bg-amber-50 border border-amber-300 text-amber-800 font-black text-xs px-2.5 py-1 rounded-lg">✓ {label}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {body.referencePhoto && (
                            <div>
                              <span className="text-xs font-black text-slate-700 block mb-1">📸 صورة التصميم المرجعية:</span>
                              <div
                                onClick={() => setZoomedPhoto(body.referencePhoto)}
                                className="relative cursor-pointer group rounded-xl overflow-hidden border-2 border-slate-300 bg-slate-100 h-44 flex items-center justify-center"
                              >
                                <img src={body.referencePhoto} alt="مرجع التصميم" className="max-h-full max-w-full object-contain" />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="bg-white/95 text-slate-900 font-black text-xs px-3 py-1.5 rounded-full border border-slate-300 shadow-md">🔍 اضغط لتكبير الصورة</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── CHOCOLATE ── */}
                      {orderType === 'chocolate' && body && (
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-sm space-y-2 font-bold text-slate-800">
                          <p>🍫 نوع الشوكولا: <span className="text-amber-800">{body.chocolateType || '—'}</span></p>
                          <p>🎨 لون الورق: <span className="text-indigo-700">{body.wrappingMethod || '—'}</span></p>
                          <p>🥟 اسم الشوكولا: <span className="text-indigo-700">{body.fillingType || '—'}</span></p>
                          <p>⚖️ الكمية: <span className="text-slate-900 font-black">{body.quantity || '—'}</span></p>
                          {body.specifications && <p>📋 المواصفات: <span className="text-slate-600">{body.specifications}</span></p>}
                          {body.notes && <p>📝 ملاحظات: <span className="text-slate-600">{body.notes}</span></p>}
                        </div>
                      )}

                      {/* ── OCCASION ── */}
                      {orderType === 'occasion' && body && (
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-sm space-y-2 font-bold text-slate-800">
                          <p>🎁 نوع الضيافة: <span className="text-amber-800">{body.hospitalityType || '—'}</span></p>
                          <p>🔢 الكمية: <span className="text-slate-900 font-black">{body.quantity || '—'}</span></p>
                          <p>🎀 طريقة اللف: <span className="text-indigo-700">{body.wrappingMethod || '—'}</span></p>
                          <p>🎨 لون التغليف: <span className="text-slate-600">{body.wrappingColor || '—'}</span></p>
                          {body.flowerColor && <p>🌸 لون الوردة: <span className="text-pink-700">{body.flowerColor}</span></p>}
                          {body.basketCount && <p>🧺 عدد السلال: <span className="text-slate-600">{body.basketCount}</span></p>}
                          {body.tissueCount && <p>🧻 عدد المحارم: <span className="text-slate-600">{body.tissueCount}</span></p>}
                          {body.napkinHolderCount && <p>📦 عدد الوايبس: <span className="text-slate-600">{body.napkinHolderCount}</span></p>}
                          {body.trayCount && <p>🥧 عدد الصواني: <span className="text-slate-600">{body.trayCount}</span></p>}
                          {body.chocolateType && <p>🍫 شوكولا: <span className="text-amber-800">{body.chocolateType}{body.chocolateFilling ? ` · ${body.chocolateFilling}` : ''}</span></p>}
                        </div>
                      )}

                      {/* ── SIMPLE ── */}
                      {orderType === 'simple' && body && (
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-sm space-y-2 font-bold text-slate-800">
                          {Array.isArray(body.items) && body.items.length > 0 ? (
                            body.items.map((subItem, si) => (
                              <div key={si} className={`${body.items.length > 1 ? 'border-b border-slate-200 pb-2 last:border-0 last:pb-0' : ''}`}>
                                {body.items.length > 1 && <p className="text-[11px] text-slate-500 font-black mb-1">طلب فرعي {si + 1}:</p>}
                                {subItem.itemName && <p>🛒 الصنف: <span className="text-amber-800">{subItem.itemName}</span></p>}
                                {subItem.pieces && <p>📦 حبة: <span className="text-slate-900 font-black">{subItem.pieces}</span></p>}
                                {subItem.weight && <p>⚖️ كيلو: <span className="text-slate-900 font-black">{subItem.weight}</span></p>}
                                {subItem.notes && <p>📝 ملاحظات: <span className="text-slate-600">{subItem.notes}</span></p>}
                              </div>
                            ))
                          ) : (
                            <>
                              {body.itemName && <p>🛒 الصنف: <span className="text-amber-800">{body.itemName}</span></p>}
                              {body.chocolateName && <p>🍫 نوع الشوكولا: <span className="text-indigo-700">{body.chocolateName}</span></p>}
                              {body.pieces && <p>📦 عدد الحبات: <span className="text-slate-900 font-black">{body.pieces} حبة</span></p>}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer with Action Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 sticky bottom-0 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-300 cursor-pointer shadow-xs"
              >
                إغلاق النافذة
              </button>

              <div className="flex items-center gap-2">
                {selectedOrder.productionStatus === 'received' && (
                  <button
                    onClick={() => handleStageChange(selectedOrder, 'in_progress')}
                    disabled={updatingId === selectedOrder.id}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-xs cursor-pointer"
                  >
                    👨‍🍳 البدء بالتحضير
                  </button>
                )}
                {selectedOrder.productionStatus === 'in_progress' && (
                  <button
                    onClick={() => handleStageChange(selectedOrder, 'ready')}
                    disabled={updatingId === selectedOrder.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-xs cursor-pointer"
                  >
                    ✅ إتمام التجهيز
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox / Photo Zoom Modal ── */}
      {zoomedPhoto && (
        <div
          onClick={() => setZoomedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out animate-fadeIn"
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button
              onClick={() => setZoomedPhoto(null)}
              className="absolute -top-12 right-0 bg-white hover:bg-red-600 hover:text-white text-slate-800 font-black text-sm px-4 py-2 rounded-xl transition-colors border border-slate-300 shadow-lg cursor-pointer"
            >
              ✕ إغلاق التكبير
            </button>
            <img src={zoomedPhoto} alt="صورة مكبرة" className="max-h-[82vh] max-w-full rounded-2xl border-4 border-white shadow-2xl bg-white object-contain" />
            <p className="text-slate-700 text-xs font-extrabold mt-3 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-md">
              📸 صورة التصميم المرجعية لضمان الدقة أثناء التزيين والتحضير
            </p>
          </div>
        </div>
      )}

      {kdsError && (
        <Modal
          isOpen={Boolean(kdsError)}
          type="alert"
          title="تنبيه شاشة المطبخ"
          message={kdsError}
          confirmText="حسناً"
          onConfirm={() => setKdsError('')}
          onCancel={() => setKdsError('')}
        />
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

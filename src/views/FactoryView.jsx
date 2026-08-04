import { useState, useEffect, useMemo } from 'react';
import { listOrders, updateProductionStatus } from '../lib/ordersStore';
import { CAKE_ADDONS } from '../constants/cakeOrderFields';

// ── Status metadata and color mapping for KDS ──────────────────────────────────
const STATUS_BADGES = {
  received:    { label: '📥 بانتظار البدء', color: 'bg-blue-600/20 text-blue-300 border-blue-500/40', border: 'border-blue-500/60', cardBg: 'bg-slate-800/90' },
  in_progress: { label: '👨‍🍳 قيد التحضير والتزيين', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse', border: 'border-amber-500', cardBg: 'bg-gradient-to-b from-slate-800 to-amber-950/20' },
  ready:       { label: '✅ جاهز للتسليم (مُنتج)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', border: 'border-emerald-500/60', cardBg: 'bg-slate-800/60 opacity-85' },
  delivered:   { label: '🚚 تم التسليم', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40', border: 'border-purple-500/40', cardBg: 'bg-slate-900/40 opacity-60' },
};

const TAB_FILTERS = [
  { key: 'active',      label: '⚡ الأوامر النشطة بالمطبخ', icon: '🔥' },
  { key: 'received',    label: '📥 أوامر جديدة (بانتظار البدء)', icon: '📝' },
  { key: 'in_progress', label: '👨‍🍳 قيد التنفيذ الآن', icon: '🍳' },
  { key: 'ready',       label: '✅ المنجزة اليوم (جاهز للتسليم)', icon: '📦' },
  { key: 'all',         label: '🌐 كافة الأوامر', icon: '📋' },
];

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

export default function FactoryView({ currentUser, onLogout, onSwitchToHistory }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [zoomedPhoto, setZoomedPhoto] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [filterType, setFilterType] = useState('all_types'); // 'all_types', 'cake', 'chocolate', 'occasion'

  const staffName = currentUser?.arabicName || currentUser?.username || 'طاقم المصنع';

  // Fetch orders from Firestore
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await listOrders(100);
      // We exclude cancelled orders completely from KDS so chefs aren't distracted
      const activeData = data.filter(o => !o.isCancelled);
      setOrders(activeData);
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('KDS Fetch error:', err);
      alert('تعذر تحديث شاشة المطبخ من السحابة. تحقق من الإنترنت.');
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
    } catch (e) {
      alert('فشل في نقل حالة الطلب. تحقق من اتصالك بالإنترنت.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter orders by tab & type
  const filteredOrders = useMemo(() => {
    let list = orders;

    // Filter by product type if requested
    if (filterType !== 'all_types') {
      list = list.filter(o => o.orderType === filterType);
    }

    // Filter by KDS stage tab
    if (activeTab === 'active') {
      // Shows anything Received or In Progress
      return list.filter(o => !o.productionStatus || o.productionStatus === 'received' || o.productionStatus === 'in_progress');
    }
    if (activeTab === 'all') {
      return list;
    }
    return list.filter(o => (o.productionStatus || 'received') === activeTab);
  }, [orders, activeTab, filterType]);

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
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-cairo" dir="rtl">
      
      {/* ── KDS Header Bar ── */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-xl px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Brand & Title */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2">
              <span className="text-3xl bg-amber-500/20 p-2 rounded-xl border border-amber-500/30">👨‍🍳</span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>شاشة المطبخ والمصنع (KDS)</span>
                  <span className="text-xs bg-red-600 text-white font-black px-2.5 py-0.5 rounded-full animate-pulse">مباشر LIVE</span>
                </h1>
                <p className="text-xs text-slate-400 font-bold">
                  مرحباً يا <span className="text-amber-400">{staffName}</span> · ركّز على تفاصيل التحضير والإنجاز الفوري
                </p>
              </div>
            </div>

            {/* Logout button mobile */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={fetchOrders}
                disabled={loading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg text-xs font-bold border border-slate-700"
                title="تحديث قائمة الأوامر"
              >
                🔄
              </button>
              <button
                onClick={onLogout}
                className="bg-red-950/80 hover:bg-red-900 border border-red-800/60 text-red-200 text-xs font-bold px-3 py-1.5 rounded-lg"
              >
                خروج
              </button>
            </div>
          </div>

          {/* Quick stats indicators */}
          <div className="flex items-center gap-2 flex-wrap justify-center w-full md:w-auto">
            <div className="bg-slate-800/80 border border-blue-500/40 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span className="text-xs text-slate-300 font-bold">جديد:</span>
              <span className="text-sm font-black text-white">{stats.received}</span>
            </div>
            <div className="bg-slate-800/80 border border-amber-500/40 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
              <span className="text-xs text-slate-300 font-bold">قيد التحضير:</span>
              <span className="text-sm font-black text-amber-400">{stats.inProgress}</span>
            </div>
            <div className="bg-slate-800/80 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs text-slate-300 font-bold">منجز اليوم:</span>
              <span className="text-sm font-black text-emerald-400">{stats.ready}</span>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-2 ml-2 border-r border-slate-800 pr-3">
              {onSwitchToHistory && (
                <button
                  onClick={onSwitchToHistory}
                  className="bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 text-xs font-extrabold px-3.5 py-2 rounded-xl transition-colors"
                >
                  📋 العودة لسجل الإدارة
                </button>
              )}
              <button
                onClick={fetchOrders}
                disabled={loading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <span>🔄</span>
                <span>{loading ? 'تزامن...' : 'تحديث'}</span>
              </button>
              <button
                onClick={onLogout}
                className="bg-red-950/80 hover:bg-red-900 border border-red-800/60 text-red-200 text-xs font-bold px-3 py-2 rounded-xl transition-colors"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>

        {/* ── KDS Stage Tabs Bar ── */}
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Main stage filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {TAB_FILTERS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`text-xs sm:text-sm font-black px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-[1.02]'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
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
              className="bg-slate-800 border border-slate-700 font-bold text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
            >
              <option value="all_types">🍰 كافة أصناف المخبوزات</option>
              <option value="cake">🎂 طلبات الكيك فقط</option>
              <option value="chocolate">🍫 طلبات الشوكولا</option>
              <option value="occasion">🎁 طلبات المناسبات</option>
            </select>
            {lastUpdated && (
              <span className="text-slate-500 font-semibold bg-slate-900 px-2 py-1 rounded border border-slate-800" dir="ltr">
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
            <p className="text-base font-extrabold text-slate-300">جاري تحميل بطاقات العمل من غرفة الأوامر السحابية...</p>
          </div>
        )}

        {!loading && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-slate-800/30 border border-slate-800/80 rounded-3xl p-8 max-w-lg mx-auto">
            <div className="text-6xl mb-4">🙌</div>
            <h3 className="text-xl font-black text-white mb-1">المطبخ نظيف ولا توجد طلبات معلقة!</h3>
            <p className="text-sm text-slate-400 font-semibold leading-relaxed">
              جميع أوامر الطهي والتزيين في هذا التبويب مكتملة حتى الآن. يمكنك تفقد باقي التبويبات أو انتظار وصول طلبات جديدة من المعرض.
            </p>
          </div>
        )}

        {/* Tickets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map((order) => {
            const st = order.productionStatus || 'received';
            const badge = STATUS_BADGES[st] || STATUS_BADGES.received;
            const isUpdatingThis = updatingId === order.id;
            const addons = resolveAddons(order.body?.addons);
            const dueToday = order.header?.deliveryDate === new Date().toISOString().split('T')[0];
            
            return (
              <div
                key={order.id}
                className={`rounded-2xl border-2 transition-all overflow-hidden flex flex-col justify-between shadow-lg ${badge.border} ${badge.cardBg} hover:border-slate-400/80`}
                style={{ animation: 'fadeIn 0.3s ease' }}
              >
                {/* Ticket Top Banner */}
                <div>
                  <div className="bg-slate-900/80 p-3.5 border-b border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black font-mono text-amber-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                        {order.id}
                      </span>
                      <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    <span className="text-xs font-black text-slate-300 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                      {order.orderType === 'cake' ? '🎂 طلب كيك' : order.orderType === 'chocolate' ? '🍫 شوكولا' : '🎁 مناسبة'}
                    </span>
                  </div>

                  {/* Delivery Schedule Warning Banner */}
                  <div className={`px-3.5 py-2 border-b text-xs font-black flex items-center justify-between ${
                    dueToday ? 'bg-red-950/90 text-red-200 border-red-800/80' : 'bg-slate-800/60 text-slate-300 border-slate-700/40'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <span>⏰ موعد التسليم:</span>
                      <span className="underline decoration-wavy">{formatKitchenDate(order.header?.deliveryDate, order.header?.deliveryTime, order.header?.dayName)}</span>
                    </span>
                    {order.header?.deliveryMethod && (
                      <span className="bg-slate-900 px-2 py-0.5 rounded text-indigo-300">
                        📍 {order.header.deliveryMethod}
                      </span>
                    )}
                  </div>

                  {/* Body Content - Pure Culinary Specs (No Financials) */}
                  <div className="p-4 space-y-3.5">
                    
                    {/* Cake Order Specific Display */}
                    {order.orderType === 'cake' && order.body && (
                      <>
                        {/* Highlights Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs font-semibold bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                          <div>
                            <span className="text-slate-400 block text-[11px]">الشكل والقالب:</span>
                            <span className="text-sm font-black text-white">{order.body.cakeShape || '—'} · {order.body.cakeType || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">القياس والأشخاص:</span>
                            <span className="text-sm font-black text-amber-300" dir="ltr">{order.body.cakeSize || '—'} · ({order.body.serves || '؟'} شخص)</span>
                          </div>
                          <div className="pt-2 border-t border-slate-800 col-span-2 flex flex-wrap justify-between gap-2">
                            <div>
                              <span className="text-slate-400 text-[11px]">النكهة: </span>
                              <span className="font-extrabold text-white">{order.body.cakeFlavor || '—'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[11px]">الحشوة: </span>
                              <span className="font-extrabold text-indigo-300">{order.body.cakeFilling || '—'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[11px]">لون القالب: </span>
                              <span className="font-extrabold text-pink-300">{order.body.cakeColor || '—'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Inscription / Text on Cake (CRITICAL) */}
                        {(order.body.inscription || order.body.writeOn) && (
                          <div className="bg-purple-950/40 border border-purple-800/60 rounded-xl p-3 shadow-inner">
                            <span className="text-[11px] font-extrabold text-purple-300 block mb-1">
                              ✍️ النص المطلوب كتابته على القالب {order.body.writeOn ? `(المكان: ${order.body.writeOn})` : ''}:
                            </span>
                            <p className="text-base font-black text-white bg-slate-950/80 p-2.5 rounded-lg border border-purple-500/30 text-center select-all">
                              {order.body.inscription ? `« ${order.body.inscription} »` : '— بدون كتابة —'}
                            </p>
                          </div>
                        )}

                        {/* Photo size and source if any */}
                        {(order.body.photoSize && order.body.photoSize !== 'بلا صورة') && (
                          <div className="text-xs bg-slate-800/80 p-2 rounded-lg border border-slate-700 flex justify-between">
                            <span>🖼️ الطباعة على القالب: <strong className="text-white">{order.body.photoSize}</strong></span>
                            {order.body.photoSource && <span>المصدر: <strong className="text-slate-300">{order.body.photoSource}</strong></span>}
                          </div>
                        )}

                        {/* Add-ons / Accessories */}
                        {addons && addons.length > 0 && (
                          <div>
                            <span className="text-xs font-bold text-slate-400 block mb-1.5">🌟 إضافات واكسسوارات التزيين:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {addons.map((label, idx) => (
                                <span key={idx} className="bg-amber-500/10 border border-amber-500/30 text-amber-300 font-black text-xs px-2.5 py-1 rounded-lg shadow-sm">
                                  ✓ {label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Reference Design Photo Thumbnail */}
                        {order.body.referencePhoto && (
                          <div className="mt-2">
                            <span className="text-xs font-black text-slate-300 block mb-1">📸 صورة التصميم المرجعية للتطبيق:</span>
                            <div
                              onClick={() => setZoomedPhoto(order.body.referencePhoto)}
                              className="relative cursor-pointer group rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-950 h-40 flex items-center justify-center"
                            >
                              <img src={order.body.referencePhoto} alt="مرجع التصميم" className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105" />
                              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="bg-slate-900/90 text-white font-black text-xs px-3 py-1.5 rounded-full border border-slate-600 shadow">
                                  🔍 اضغط لتكبير الصورة
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Non-cake Orders Display */}
                    {order.orderType !== 'cake' && order.body && (
                      <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 text-sm space-y-2 font-bold">
                        {order.orderType === 'chocolate' && (
                          <>
                            <p>🍫 نوع الشوكولا: <span className="text-amber-300">{order.body.chocolateType || '—'}</span></p>
                            <p>🥟 نوع الحشوة: <span className="text-indigo-300">{order.body.fillingType || '—'}</span></p>
                            <p>⚖️ الكمية المطلوبة: <span className="text-white font-black">{order.body.quantity || '—'}</span></p>
                          </>
                        )}
                        {order.orderType === 'occasion' && (
                          <>
                            <p>🎁 نوع الضيافة: <span className="text-amber-300">{order.body.hospitalityType || '—'}</span></p>
                            <p>🎀 طريقة التغليف: <span className="text-indigo-300">{order.body.wrappingMethod || '—'}</span></p>
                            <p>🔢 الكمية / الصينية: <span className="text-white font-black">{order.body.quantity || '—'}</span></p>
                          </>
                        )}
                        {order.orderType === 'simple' && (
                          <>
                            <p>🍰 الصنف المطلوب: <span className="text-amber-300">{order.body.itemName || '—'}</span></p>
                            <p>🍫 نوع الشوكولا: <span className="text-indigo-300">{order.body.chocolateName || '—'}</span></p>
                            <p>📦 عدد الحبات: <span className="text-white font-black">{order.body.pieces || '—'} حبة</span></p>
                          </>
                        )}
                      </div>
                    )}

                    {/* Customer Name only for labeling tag on box */}
                    <div className="text-[11px] text-slate-500 flex justify-between pt-1">
                      <span>🏷️ اسم صاحب الطلب (للبطاقة): <strong className="text-slate-300">{order.header?.customerName || 'زبون'}</strong></span>
                      <span>تاريخ الطلب: {order.createdAt ? order.createdAt.split('T')[0] : ''}</span>
                    </div>
                  </div>
                </div>

                {/* Ticket Bottom Massive KDS Action Buttons */}
                <div className="p-3.5 bg-slate-900/95 border-t border-slate-800 mt-auto">
                  {st === 'received' && (
                    <button
                      onClick={() => handleStageChange(order, 'in_progress')}
                      disabled={isUpdatingThis}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span>👨‍🍳</span>
                      <span>البدء بالتحضير والتجهيز (نقل إلى قيد التنفيذ)</span>
                    </button>
                  )}

                  {st === 'in_progress' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStageChange(order, 'ready')}
                        disabled={isUpdatingThis}
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-sm py-3 px-3 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <span>✅</span>
                        <span>إتمام التجهيز (تحديد كجاهز للتسليم)</span>
                      </button>
                      <button
                        onClick={() => handleStageChange(order, 'received')}
                        disabled={isUpdatingThis}
                        title="تراجع عن التحضير"
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 p-3 rounded-xl transition-colors shrink-0 font-extrabold text-xs"
                      >
                        ↩️ تراجع
                      </button>
                    </div>
                  )}

                  {st === 'ready' && (
                    <div className="flex items-center justify-between gap-2 bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl">
                      <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                        <span>✅ تم التجهيز بالكامل والطلب بانتظار التسليم للزبون</span>
                      </span>
                      <button
                        onClick={() => handleStageChange(order, 'in_progress')}
                        disabled={isUpdatingThis}
                        className="bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-600 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-colors"
                      >
                        ↩️ تراجع للتحضير
                      </button>
                    </div>
                  )}

                  {st === 'delivered' && (
                    <div className="text-center text-xs font-extrabold text-purple-300 bg-purple-950/30 border border-purple-500/20 py-2 rounded-xl">
                      🚚 الطلب مسجل كمستلَم من قبل الزبون أو مندوب التوصيل
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ── Lightbox / Photo Zoom Modal ── */}
      {zoomedPhoto && (
        <div
          onClick={() => setZoomedPhoto(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fadeIn"
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button
              onClick={() => setZoomedPhoto(null)}
              className="absolute -top-12 right-0 bg-slate-800 hover:bg-red-600 text-white font-black text-sm px-4 py-2 rounded-xl transition-colors border border-slate-700"
            >
              ✕ إغلاق التكبير
            </button>
            <img src={zoomedPhoto} alt="صورة مكبرة" className="max-h-[82vh] max-w-full rounded-2xl border-4 border-slate-700 shadow-2xl bg-white object-contain" />
            <p className="text-slate-300 text-xs font-extrabold mt-3 bg-slate-900 px-4 py-2 rounded-full border border-slate-800">
              📸 صورة التصميم المرجعية لضمان الدقة أثناء التزيين والتحضير
            </p>
          </div>
        </div>
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

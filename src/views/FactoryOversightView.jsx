import { useState, useEffect, useMemo } from "react";
import { listOrders } from "../lib/ordersStore";
import { CAKE_ADDONS } from "../constants/cakeOrderFields";
import { compareDeliveryTimes } from "../constants/timeSlots";

const TYPE_ICON  = { cake: "🎂", chocolate: "🍫", occasion: "🎁", simple: "🛒" };
const TYPE_LABEL = { cake: "كيك", chocolate: "شوكولا", occasion: "مناسبة", simple: "بسيط" };

const STATUS_BADGES = {
  received:    { label: "📥 بانتظار البدء", color: "bg-blue-50 text-blue-800 border-blue-200", done: false },
  in_progress: { label: "👨‍🍳 قيد التحضير والتزيين", color: "bg-amber-50 text-amber-800 border-amber-300 animate-pulse", done: false },
  ready:       { label: "✅ جاهز للتسليم", color: "bg-emerald-50 text-emerald-800 border-emerald-300", done: true  },
  delivered:   { label: "🚚 تم التسليم", color: "bg-slate-100 text-slate-700 border-slate-200", done: true  },
};

function resolveAddons(addonIds) {
  if (!Array.isArray(addonIds) || addonIds.length === 0) return null;
  return addonIds.map(id => {
    const found = CAKE_ADDONS.find(a => a.id === id);
    return found ? found.label : id;
  }).filter(Boolean);
}

function isDone(order) {
  const st = order.productionStatus || "received";
  return st === "ready" || st === "delivered";
}

function getOrderTypes(order) {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return [...new Set(order.items.map(i => i.orderType).filter(Boolean))];
  }
  return order.orderType ? [order.orderType] : [];
}

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fmtDeliveryTime(order) {
  const t = order.header?.deliveryTime;
  return t ? `الساعة ${t}` : "وقت غير محدد";
}

function buildOrderSummary(order) {
  const parts = [];
  if (Array.isArray(order.items) && order.items.length > 0) {
    order.items.forEach(item => {
      const b = item.body || {};
      switch (item.orderType) {
        case "cake":
          parts.push([b.cakeShape, b.cakeType, b.serves ? b.serves + " شخص" : null].filter(Boolean).join(" · ") || "كيك");
          break;
        case "chocolate":
          parts.push([b.chocolateType, b.quantity].filter(Boolean).join(" · ") || "شوكولا");
          break;
        case "occasion":
          parts.push([b.hospitalityType, b.quantity].filter(Boolean).join(" · ") || "مناسبة");
          break;
        case "simple":
          if (Array.isArray(b.items) && b.items.length > 0) {
            b.items.forEach(si => si.itemName && parts.push(si.itemName));
          } else if (b.itemName) {
            parts.push(b.itemName);
          }
          break;
        default: break;
      }
    });
  } else if (order.body) {
    const b = order.body;
    switch (order.orderType) {
      case "cake":
        parts.push([b.cakeShape, b.cakeType, b.serves ? b.serves + " شخص" : null].filter(Boolean).join(" · ") || "كيك");
        break;
      case "chocolate":
        parts.push([b.chocolateType, b.quantity].filter(Boolean).join(" · ") || "شوكولا");
        break;
      case "occasion":
        parts.push([b.hospitalityType, b.quantity].filter(Boolean).join(" · ") || "مناسبة");
        break;
      case "simple":
        if (b.itemName) parts.push(b.itemName);
        break;
      default: break;
    }
  }
  const types = getOrderTypes(order);
  return parts.length > 0 ? parts.join("  ·  ") : types.map(t => TYPE_LABEL[t] || t).join(" + ");
}

/** Read-only status badge */
function StatusBadge({ order }) {
  const st = order.productionStatus || "received";
  const badge = STATUS_BADGES[st] || STATUS_BADGES.received;
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black select-none pointer-events-none ${badge.color}`}>
      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
        badge.done ? "bg-emerald-500 border-emerald-400 text-white" : "bg-slate-100 border-slate-300"
      }`}>
        {badge.done && <span className="text-[9px] font-black leading-none">✓</span>}
      </span>
      <span>{badge.label}</span>
    </div>
  );
}

/** Order card component */
function OrderCard({ order, onClick }) {
  const types = getOrderTypes(order);
  const summary = buildOrderSummary(order);
  const done = isDone(order);
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border-2 p-4 space-y-3 cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
        order.isCancelled
          ? "border-red-200 bg-red-50/50 opacity-60"
          : done
          ? "border-emerald-300 bg-emerald-50/30 shadow-sm"
          : "border-slate-200 bg-white shadow-sm hover:border-amber-400 hover:shadow"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
            {order.id}
          </span>
          {types.map(t => (
            <span key={t} className="text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full">
              {TYPE_ICON[t] || "📦"} {TYPE_LABEL[t] || t}
            </span>
          ))}
          {order.isCancelled && (
            <span className="text-xs font-bold bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full">
              🚫 ملغى
            </span>
          )}
        </div>
        {!order.isCancelled && <StatusBadge order={order} />}
      </div>

      {summary && (
        <div className="text-xs text-slate-600 font-medium truncate" title={summary}>
          📝 {summary}
        </div>
      )}

      <div className="text-xs text-slate-500 font-semibold flex items-center justify-between gap-3 flex-wrap border-t border-slate-100 pt-2">
        <span className="flex items-center gap-1.5">
          <span>⏰ الوقت:</span>
          <span className="text-amber-800 font-bold">{fmtDeliveryTime(order)}</span>
        </span>
        {order.header?.deliveryMethod && (
          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold">
            📍 {order.header.deliveryMethod}
          </span>
        )}
      </div>
    </div>
  );
}

/** Rich Specs Modal */
function OrderSpecsModal({ order, onClose }) {
  const [zoomedPhoto, setZoomedPhoto] = useState(null);
  if (!order) return null;

  const itemsToRender = Array.isArray(order.items) && order.items.length > 0
    ? order.items
    : (order.orderType && order.body ? [{ orderType: order.orderType, body: order.body }] : []);

  const st = order.productionStatus || "received";
  const badge = STATUS_BADGES[st] || STATUS_BADGES.received;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      dir="rtl"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl text-slate-800 flex flex-col justify-between"
      >
        {/* Header */}
        <div className="bg-slate-50/95 p-4 border-b border-slate-200 sticky top-0 z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-black font-mono text-amber-700 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200">
              {order.id}
            </span>
            <span className={`text-xs font-black px-3 py-1 rounded-full border ${badge.color}`}>
              {badge.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-200 transition-colors"
          >
            ✕ إغلاق
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <span className="text-slate-500">اسم صاحب الطلب:</span>
              <strong className="text-base text-slate-900 font-black">{order.header?.customerName || "—"}</strong>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-500">رقم الهاتف:</span>
              <strong className="text-sm text-amber-700 font-mono" dir="ltr">{order.header?.customerPhone || "—"}</strong>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-500">⏰ موعد التسليم:</span>
              <strong className="text-xs text-slate-700">{order.header?.deliveryDate || "غير محدد"} · {fmtDeliveryTime(order)}</strong>
            </div>
            {order.header?.deliveryMethod && (
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-500">📍 طريقة الاستلام:</span>
                <strong className="text-xs text-indigo-700">{order.header.deliveryMethod}</strong>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black text-amber-800 uppercase tracking-wider">
              📋 المواصفات التفصيلية للطلب ({itemsToRender.length} صنف):
            </h3>

            {itemsToRender.map((item, idx) => {
              const { orderType, body } = item;
              const addons = resolveAddons(body?.addons);

              return (
                <div key={idx} className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="text-base">{TYPE_ICON[orderType] || "📦"}</span>
                    <span className="text-xs font-black text-slate-800">
                      الصنف {itemsToRender.length > 1 ? idx + 1 : ""}: {TYPE_LABEL[orderType] || orderType}
                    </span>
                  </div>

                  {orderType === "cake" && body && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs font-semibold bg-white p-3 rounded-xl border border-slate-200">
                        <div>
                          <span className="text-slate-500 block text-[11px]">الشكل والقالب:</span>
                          <span className="text-sm font-black text-slate-900">{body.cakeShape || "—"} · {body.cakeType || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">القياس والأشخاص:</span>
                          <span className="text-sm font-black text-amber-700" dir="ltr">{body.cakeSize || "—"} · ({body.serves || "؟"} شخص)</span>
                        </div>
                        <div className="pt-2 border-t border-slate-100 col-span-2 flex flex-wrap justify-between gap-2">
                          <div><span className="text-slate-500 text-[11px]">النكهة: </span><span className="font-extrabold text-slate-900">{body.cakeFlavor || "—"}</span></div>
                          <div><span className="text-slate-500 text-[11px]">الحشوة: </span><span className="font-extrabold text-indigo-700">{body.cakeFilling || "—"}</span></div>
                          <div><span className="text-slate-500 text-[11px]">لون القالب: </span><span className="font-extrabold text-pink-700">{body.cakeColor || "—"}</span></div>
                        </div>
                      </div>

                      {(body.inscription || body.writeOn) && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 shadow-inner">
                          <span className="text-[11px] font-extrabold text-purple-800 block mb-1">
                            ✍️ النص المطلوب كتابته {body.writeOn ? `(المكان: ${body.writeOn})` : ""}:
                          </span>
                          <p className="text-base font-black text-slate-900 bg-white p-2.5 rounded-lg border border-purple-200 text-center select-all">
                            {body.inscription ? `« ${body.inscription} »` : "— بدون كتابة —"}
                          </p>
                        </div>
                      )}

                      {(body.photoSize && body.photoSize !== "بلا صورة") && (
                        <div className="text-xs bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between">
                          <span>🖼️ الطباعة: <strong className="text-slate-900">{body.photoSize}</strong></span>
                          {body.photoSource && <span>المصدر: <strong className="text-slate-600">{body.photoSource}</strong></span>}
                        </div>
                      )}

                      {addons && addons.length > 0 && (
                        <div>
                          <span className="text-xs font-bold text-slate-500 block mb-1.5">🌟 الإضافات:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {addons.map((label, i) => (
                              <span key={i} className="bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs px-2.5 py-1 rounded-lg">
                                ✓ {label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {body.referencePhoto && (
                        <div>
                          <span className="text-xs font-black text-slate-700 block mb-1">📸 صورة التصميم:</span>
                          <div
                            onClick={() => setZoomedPhoto(body.referencePhoto)}
                            className="relative cursor-pointer group rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-100 h-44 flex items-center justify-center"
                          >
                            <img src={body.referencePhoto} alt="مرجع التصميم" className="max-h-full max-w-full object-contain" />
                            <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="bg-white text-slate-900 font-black text-xs px-3 py-1.5 rounded-full border border-slate-200 shadow">
                                🔍 تكبير الصورة
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {orderType === "chocolate" && body && (
                    <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2 font-bold">
                      <p>🍫 نوع الشوكولا: <span className="text-amber-800">{body.chocolateType || "—"}</span></p>
                      <p>🥟 الحشوة: <span className="text-indigo-700">{body.fillingType || "—"}</span></p>
                      <p>⚖️ الكمية: <span className="text-slate-900 font-black">{body.quantity || "—"}</span></p>
                    </div>
                  )}

                  {orderType === "occasion" && body && (
                    <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2 font-bold">
                      <p>🎁 الضيافة: <span className="text-amber-800">{body.hospitalityType || "—"}</span></p>
                      <p>🎀 التغليف: <span className="text-indigo-700">{body.wrappingMethod || "—"}</span></p>
                      <p>🔢 الكمية: <span className="text-slate-900 font-black">{body.quantity || "—"}</span></p>
                    </div>
                  )}

                  {orderType === "simple" && body && (
                    <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2 font-bold">
                      {Array.isArray(body.items) && body.items.length > 0 ? (
                        body.items.map((sub, si) => (
                          <div key={si} className="border-b border-slate-100 last:border-0 pb-1.5 mb-1.5 last:pb-0 last:mb-0">
                            {sub.itemName && <p>🛒 الصنف: <span className="text-amber-800">{sub.itemName}</span></p>}
                            {sub.pieces && <p>📦 حبة: <span className="text-slate-900 font-black">{sub.pieces}</span></p>}
                            {sub.weight && <p>⚖️ كيلو: <span className="text-slate-900 font-black">{sub.weight}</span></p>}
                          </div>
                        ))
                      ) : (
                        <>
                          {body.itemName && <p>🛒 الصنف: <span className="text-amber-800">{body.itemName}</span></p>}
                          {body.pieces && <p>📦 الحبات: <span className="text-slate-900 font-black">{body.pieces}</span></p>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50/95 border-t border-slate-200 sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-black py-2.5 rounded-xl border border-slate-300 transition-colors text-xs"
          >
            إغلاق النافذة
          </button>
        </div>

        {zoomedPhoto && (
          <div
            onClick={() => setZoomedPhoto(null)}
            className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          >
            <div className="relative max-w-3xl w-full max-h-[85vh] flex flex-col items-center">
              <button
                onClick={() => setZoomedPhoto(null)}
                className="absolute -top-10 right-0 bg-white text-slate-800 font-black text-xs px-3 py-1.5 rounded-xl border border-slate-300 shadow"
              >
                ✕ إغلاق
              </button>
              <img src={zoomedPhoto} alt="صورة مكبرة" className="max-h-[80vh] max-w-full rounded-2xl border-4 border-slate-200 bg-white object-contain shadow-2xl" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FactoryOversightView({ currentUser, onLogout }) {
  const todayStr = useMemo(() => getTodayString(), []);
  const tomorrowStr = useMemo(() => getTomorrowString(), []);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr); // Defaults to TODAY
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [activeSpecsOrder, setActiveSpecsOrder] = useState(null);
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const staffName = currentUser?.arabicName || "المراقب";

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await listOrders(200);
      setOrders(data);
      setLastUpdated(new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.error("Oversight fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const iv = setInterval(fetchOrders, 45000);
    return () => clearInterval(iv);
  }, []);

  // Filter active orders by selected delivery date (unless 'all' is selected)
  const dateFilteredOrders = useMemo(() => {
    let list = orders.filter(o => !o.isCancelled);
    if (selectedDate !== "all") {
      list = list.filter(o => o.header?.deliveryDate === selectedDate);
    }
    return list;
  }, [orders, selectedDate]);

  // Group orders for the selected date by Customer Phone
  const clientGroups = useMemo(() => {
    const map = {};
    dateFilteredOrders.forEach(order => {
      const rawPhone = order.header?.customerPhone?.trim();
      const phoneKey = rawPhone || `no_phone_${order.id}`;
      const phone = rawPhone || "—";
      const name  = order.header?.customerName?.trim()  || "زبون";
      if (!map[phoneKey]) map[phoneKey] = { phone, name, orders: [] };
      map[phoneKey].orders.push(order);
    });

    return Object.values(map).map(client => {
      client.orders.sort((a, b) => compareDeliveryTimes(a.header?.deliveryTime, b.header?.deliveryTime));
      const doneCount  = client.orders.filter(isDone).length;
      const totalCount = client.orders.length;
      const allDone    = totalCount > 0 && doneCount === totalCount;
      const refId      = client.orders[0]?.id || "—";
      return { ...client, doneCount, totalCount, allDone, refId };
    }).sort((a, b) => {
      // Pending first, then done
      if (a.allDone !== b.allDone) return a.allDone ? 1 : -1;
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [dateFilteredOrders]);

  // Search filter
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clientGroups;
    const q = search.trim().toLowerCase();
    return clientGroups.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.refId.toLowerCase().includes(q)
    );
  }, [clientGroups, search]);

  const selectedClient = useMemo(() =>
    selectedPhone ? clientGroups.find(c => c.phone === selectedPhone) || null : null,
  [selectedPhone, clientGroups]);

  // Stats for the selected date
  const dayStats = useMemo(() => {
    const totalOrders = dateFilteredOrders.length;
    const readyOrders = dateFilteredOrders.filter(isDone).length;
    const pendingOrders = totalOrders - readyOrders;
    return { totalOrders, readyOrders, pendingOrders };
  }, [dateFilteredOrders]);

  return (
    <div className="min-h-screen bg-[#f1f5f9] font-cairo text-slate-800" dir="rtl">
      
      {/* KDS Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {selectedClient ? (
              <button
                onClick={() => setSelectedPhone(null)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3.5 py-2 rounded-xl transition-colors shadow-sm"
              >
                ← العودة لزبائن التاريخ المحدد
              </button>
            ) : (
              <div className="flex items-center gap-2.5">
                <span className="text-2xl bg-amber-50 p-1.5 rounded-xl border border-amber-200">👁️</span>
                <div>
                  <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">متابعة طلبيات اليوم والمصنع</h1>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    مرحباً يا <span className="text-amber-700 font-bold">{staffName}</span>
                    {lastUpdated && <> · آخر تحديث <span dir="ltr">{lastUpdated}</span></>}
                  </p>
                </div>
              </div>
            )}

            {selectedClient && (
              <div className="border-r border-slate-200 pr-3">
                <p className="text-base font-black text-slate-900 leading-tight">{selectedClient.name}</p>
                <p className="text-[11px] text-amber-700 font-mono font-bold" dir="ltr">{selectedClient.phone}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 rounded-xl transition-colors disabled:opacity-40 shadow-sm"
            >
              🔄 {loading ? "تزامن..." : "تحديث"}
            </button>
            <button
              onClick={onLogout}
              className="text-xs font-bold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-2 rounded-xl transition-colors"
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4 pb-12">

        {/* ── DATE FILTER BAR (CRITICAL) ── */}
        {!selectedClient && (
          <div className="bg-white border border-slate-200 p-3 rounded-2xl space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span>📅 اختر تاريخ التسليم المطلوب:</span>
              </span>

              {/* Date Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setSelectedDate(todayStr)}
                  className={`text-xs font-bold px-3.5 py-1.5 rounded-xl border transition-all ${
                    selectedDate === todayStr
                      ? "bg-amber-500 text-white border-amber-600 shadow-sm font-black scale-105"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  🔴 طلبيات اليوم ({todayStr})
                </button>

                <button
                  onClick={() => setSelectedDate(tomorrowStr)}
                  className={`text-xs font-bold px-3.5 py-1.5 rounded-xl border transition-all ${
                    selectedDate === tomorrowStr
                      ? "bg-amber-500 text-white border-amber-600 shadow-sm font-black scale-105"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  🟡 غداً ({tomorrowStr})
                </button>

                <button
                  onClick={() => setSelectedDate("all")}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                    selectedDate === "all"
                      ? "bg-amber-500 text-white border-amber-600 shadow-sm font-black"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  🌐 كافة التواريخ
                </button>

                {/* Custom Date Picker */}
                <input
                  type="date"
                  value={selectedDate === "all" ? "" : selectedDate}
                  onChange={e => e.target.value && setSelectedDate(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-800 text-xs font-mono font-bold px-2.5 py-1 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Day Summary Indicator */}
            <div className="flex items-center gap-3 text-xs font-bold text-slate-600 pt-2 border-t border-slate-100 flex-wrap">
              <span>زبائن هذا اليوم: <strong className="text-slate-900">{clientGroups.length}</strong></span>
              <span>·</span>
              <span>إجمالي الأوامر: <strong className="text-slate-900">{dayStats.totalOrders}</strong></span>
              <span>·</span>
              <span className="text-amber-700">قيد التحضير/الانتظار: <strong>{dayStats.pendingOrders}</strong></span>
              <span>·</span>
              <span className="text-emerald-700">جاهزة للتسليم: <strong>{dayStats.readyOrders}</strong></span>
            </div>
          </div>
        )}

        {/* ── CLIENT LIST FOR SELECTED DATE ── */}
        {!selectedClient && (
          <>
            {/* Search Input */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 ابحث باسم الزبون أو رقم الهاتف..."
              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:border-amber-500 placeholder:text-slate-400 shadow-sm"
            />

            {loading && orders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-xs font-bold text-slate-500">جاري تحميل طلبيات التاريخ المحدد...</p>
              </div>
            )}

            {!loading && filteredClients.length === 0 && (
              <div className="text-center py-16 text-slate-500 text-sm font-semibold bg-white rounded-2xl border border-slate-200 shadow-sm">
                🙌 لا توجد طلبيات مسجلة لـ {selectedDate === todayStr ? "اليوم" : selectedDate === tomorrowStr ? "غداً" : selectedDate}
              </div>
            )}

            {/* Client Cards Grid */}
            <div className="space-y-3">
              {filteredClients.map(client => (
                <div
                  key={client.phone}
                  onClick={() => setSelectedPhone(client.phone)}
                  className={`w-full text-right rounded-2xl border-2 p-4 transition-all duration-200 cursor-pointer flex items-center justify-between gap-4 group ${
                    client.allDone && client.totalCount > 0
                      ? "bg-emerald-50/40 border-emerald-300 hover:border-emerald-400 shadow-sm"
                      : "bg-white border-slate-200 hover:border-amber-400 shadow-sm"
                  }`}
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900 text-base leading-tight group-hover:text-amber-700 transition-colors">
                        {client.name}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {client.refId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono font-semibold" dir="ltr">{client.phone}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className={`px-3.5 py-1.5 rounded-xl border font-black text-xs ${
                      client.allDone
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                        : client.doneCount > 0
                        ? "bg-amber-50 border-amber-300 text-amber-800"
                        : "bg-blue-50 border-blue-200 text-blue-800"
                    }`}>
                      {client.doneCount} / {client.totalCount} جاهز
                    </div>
                    <span className="text-slate-400 group-hover:text-amber-600 transition-colors text-xl font-black">›</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── CLIENT DETAIL VIEW FOR SELECTED DATE ── */}
        {selectedClient && (
          <>
            {/* Progress Banner */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>جاهزية طلبيات {selectedClient.name}:</span>
                <span className={selectedClient.allDone ? "text-emerald-700" : "text-amber-700"}>
                  {selectedClient.doneCount} من أصل {selectedClient.totalCount} جاهزة للتسليم
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${selectedClient.allDone ? "bg-emerald-500" : "bg-amber-500"}`}
                  style={{
                    width: selectedClient.totalCount > 0
                      ? (selectedClient.doneCount / selectedClient.totalCount * 100) + "%"
                      : "0%"
                  }}
                />
              </div>
            </div>

            {/* List of Orders */}
            <div className="space-y-3">
              {selectedClient.orders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onClick={() => setActiveSpecsOrder(order)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Specs Popup Modal */}
      {activeSpecsOrder && (
        <OrderSpecsModal
          order={activeSpecsOrder}
          onClose={() => setActiveSpecsOrder(null)}
        />
      )}
    </div>
  );
}

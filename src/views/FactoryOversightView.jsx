import { useState, useEffect, useMemo } from "react";
import { listOrders } from "../lib/ordersStore";
import { CAKE_ADDONS } from "../constants/cakeOrderFields";

const TYPE_ICON  = { cake: "🎂", chocolate: "🍫", occasion: "🎁", simple: "🛒" };
const TYPE_LABEL = { cake: "كيك", chocolate: "شوكولا", occasion: "مناسبة", simple: "بسيط" };

const STATUS_BADGES = {
  received:    { label: "📥 بانتظار البدء", color: "bg-blue-600/20 text-blue-300 border-blue-500/40", done: false },
  in_progress: { label: "👨‍🍳 قيد التحضير والتزيين", color: "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse", done: false },
  ready:       { label: "✅ جاهز للتسليم", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", done: true  },
  delivered:   { label: "🚚 تم التسليم", color: "bg-purple-500/20 text-purple-300 border-purple-500/40", done: true  },
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
        badge.done ? "bg-emerald-500 border-emerald-400" : "bg-slate-800 border-slate-600"
      }`}>
        {badge.done && <span className="text-slate-950 text-[9px] font-black leading-none">✓</span>}
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
          ? "border-red-800/60 bg-red-950/30 opacity-60"
          : done
          ? "border-emerald-500/50 bg-slate-800/90 shadow-md"
          : "border-slate-700 bg-slate-800/90 shadow-lg hover:border-amber-500/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-black text-amber-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
            {order.id}
          </span>
          {types.map(t => (
            <span key={t} className="text-xs font-black bg-slate-900 text-slate-200 border border-slate-700 px-2.5 py-0.5 rounded-full">
              {TYPE_ICON[t] || "📦"} {TYPE_LABEL[t] || t}
            </span>
          ))}
          {order.isCancelled && (
            <span className="text-xs font-black bg-red-900/60 text-red-200 border border-red-700 px-2.5 py-0.5 rounded-full">
              🚫 ملغى
            </span>
          )}
        </div>
        {!order.isCancelled && <StatusBadge order={order} />}
      </div>

      <div className="text-xs text-slate-300 font-semibold flex items-center justify-between gap-3 flex-wrap border-t border-slate-700/60 pt-2">
        <span className="flex items-center gap-1.5">
          <span>⏰ الوقت:</span>
          <span className="text-amber-300 font-bold">{fmtDeliveryTime(order)}</span>
        </span>
        {order.header?.deliveryMethod && (
          <span className="bg-slate-900 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-bold">
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
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      dir="rtl"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl text-slate-100 flex flex-col justify-between"
      >
        {/* Header */}
        <div className="bg-slate-950/90 p-4 border-b border-slate-800 sticky top-0 z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-black font-mono text-amber-400 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
              {order.id}
            </span>
            <span className={`text-xs font-black px-3 py-1 rounded-full border ${badge.color}`}>
              {badge.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-red-600 text-white font-black text-xs px-3 py-1.5 rounded-xl border border-slate-700 transition-colors"
          >
            ✕ إغلاق
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-2 text-xs">
            <div className="flex justify-between items-center border-b border-slate-700/80 pb-2">
              <span className="text-slate-400">اسم صاحب الطلب:</span>
              <strong className="text-base text-white font-black">{order.header?.customerName || "—"}</strong>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-400">رقم الهاتف:</span>
              <strong className="text-sm text-amber-300 font-mono" dir="ltr">{order.header?.customerPhone || "—"}</strong>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-400">⏰ موعد التسليم:</span>
              <strong className="text-xs text-slate-200">{order.header?.deliveryDate || "غير محدد"} · {fmtDeliveryTime(order)}</strong>
            </div>
            {order.header?.deliveryMethod && (
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-400">📍 طريقة الاستلام:</span>
                <strong className="text-xs text-indigo-300">{order.header.deliveryMethod}</strong>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">
              📋 المواصفات التفصيلية للطلب ({itemsToRender.length} صنف):
            </h3>

            {itemsToRender.map((item, idx) => {
              const { orderType, body } = item;
              const addons = resolveAddons(body?.addons);

              return (
                <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <span className="text-base">{TYPE_ICON[orderType] || "📦"}</span>
                    <span className="text-xs font-black text-slate-200">
                      الصنف {itemsToRender.length > 1 ? idx + 1 : ""}: {TYPE_LABEL[orderType] || orderType}
                    </span>
                  </div>

                  {orderType === "cake" && body && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs font-semibold bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-slate-400 block text-[11px]">الشكل والقالب:</span>
                          <span className="text-sm font-black text-white">{body.cakeShape || "—"} · {body.cakeType || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">القياس والأشخاص:</span>
                          <span className="text-sm font-black text-amber-300" dir="ltr">{body.cakeSize || "—"} · ({body.serves || "؟"} شخص)</span>
                        </div>
                        <div className="pt-2 border-t border-slate-800 col-span-2 flex flex-wrap justify-between gap-2">
                          <div><span className="text-slate-400 text-[11px]">النكهة: </span><span className="font-extrabold text-white">{body.cakeFlavor || "—"}</span></div>
                          <div><span className="text-slate-400 text-[11px]">الحشوة: </span><span className="font-extrabold text-indigo-300">{body.cakeFilling || "—"}</span></div>
                          <div><span className="text-slate-400 text-[11px]">لون القالب: </span><span className="font-extrabold text-pink-300">{body.cakeColor || "—"}</span></div>
                        </div>
                      </div>

                      {(body.inscription || body.writeOn) && (
                        <div className="bg-purple-950/40 border border-purple-800/60 rounded-xl p-3 shadow-inner">
                          <span className="text-[11px] font-extrabold text-purple-300 block mb-1">
                            ✍️ النص المطلوب كتابته {body.writeOn ? `(المكان: ${body.writeOn})` : ""}:
                          </span>
                          <p className="text-base font-black text-white bg-slate-950 p-2.5 rounded-lg border border-purple-500/30 text-center select-all">
                            {body.inscription ? `« ${body.inscription} »` : "— بدون كتابة —"}
                          </p>
                        </div>
                      )}

                      {(body.photoSize && body.photoSize !== "بلا صورة") && (
                        <div className="text-xs bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex justify-between">
                          <span>🖼️ الطباعة: <strong className="text-white">{body.photoSize}</strong></span>
                          {body.photoSource && <span>المصدر: <strong className="text-slate-300">{body.photoSource}</strong></span>}
                        </div>
                      )}

                      {addons && addons.length > 0 && (
                        <div>
                          <span className="text-xs font-bold text-slate-400 block mb-1.5">🌟 الإضافات:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {addons.map((label, i) => (
                              <span key={i} className="bg-amber-500/10 border border-amber-500/30 text-amber-300 font-black text-xs px-2.5 py-1 rounded-lg">
                                ✓ {label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {body.referencePhoto && (
                        <div>
                          <span className="text-xs font-black text-slate-300 block mb-1">📸 صورة التصميم:</span>
                          <div
                            onClick={() => setZoomedPhoto(body.referencePhoto)}
                            className="relative cursor-pointer group rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-950 h-44 flex items-center justify-center"
                          >
                            <img src={body.referencePhoto} alt="مرجع التصميم" className="max-h-full max-w-full object-contain" />
                            <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="bg-slate-900 text-white font-black text-xs px-3 py-1.5 rounded-full border border-slate-600">
                                🔍 تكبير الصورة
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {orderType === "chocolate" && body && (
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs space-y-2 font-bold">
                      <p>🍫 نوع الشوكولا: <span className="text-amber-300">{body.chocolateType || "—"}</span></p>
                      <p>🥟 الحشوة: <span className="text-indigo-300">{body.fillingType || "—"}</span></p>
                      <p>⚖️ الكمية: <span className="text-white font-black">{body.quantity || "—"}</span></p>
                    </div>
                  )}

                  {orderType === "occasion" && body && (
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs space-y-2 font-bold">
                      <p>🎁 الضيافة: <span className="text-amber-300">{body.hospitalityType || "—"}</span></p>
                      <p>🎀 التغليف: <span className="text-indigo-300">{body.wrappingMethod || "—"}</span></p>
                      <p>🔢 الكمية: <span className="text-white font-black">{body.quantity || "—"}</span></p>
                    </div>
                  )}

                  {orderType === "simple" && body && (
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs space-y-2 font-bold">
                      {Array.isArray(body.items) && body.items.length > 0 ? (
                        body.items.map((sub, si) => (
                          <div key={si} className="border-b border-slate-800 last:border-0 pb-1.5 mb-1.5 last:pb-0 last:mb-0">
                            {sub.itemName && <p>🛒 الصنف: <span className="text-amber-300">{sub.itemName}</span></p>}
                            {sub.pieces && <p>📦 حبة: <span className="text-white font-black">{sub.pieces}</span></p>}
                            {sub.weight && <p>⚖️ كيلو: <span className="text-white font-black">{sub.weight}</span></p>}
                          </div>
                        ))
                      ) : (
                        <>
                          {body.itemName && <p>🛒 الصنف: <span className="text-amber-300">{body.itemName}</span></p>}
                          {body.pieces && <p>📦 الحبات: <span className="text-white font-black">{body.pieces}</span></p>}
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
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-2.5 rounded-xl border border-slate-700 transition-colors text-xs"
          >
            إغلاق النافذة
          </button>
        </div>

        {zoomedPhoto && (
          <div
            onClick={() => setZoomedPhoto(null)}
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          >
            <div className="relative max-w-3xl w-full max-h-[85vh] flex flex-col items-center">
              <button
                onClick={() => setZoomedPhoto(null)}
                className="absolute -top-10 right-0 bg-slate-800 text-white font-black text-xs px-3 py-1.5 rounded-xl"
              >
                ✕ إغلاق
              </button>
              <img src={zoomedPhoto} alt="صورة مكبرة" className="max-h-[80vh] max-w-full rounded-2xl border-4 border-slate-700 bg-white object-contain" />
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
      const phone = order.header?.customerPhone?.trim() || "—";
      const name  = order.header?.customerName?.trim()  || "زبون";
      if (!map[phone]) map[phone] = { phone, name, orders: [] };
      map[phone].orders.push(order);
    });

    return Object.values(map).map(client => {
      client.orders.sort((a, b) => (a.header?.deliveryTime || "").localeCompare(b.header?.deliveryTime || ""));
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
    <div className="min-h-screen bg-[#0f172a] font-cairo text-slate-100" dir="rtl">
      
      {/* KDS Dark Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-xl px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {selectedClient ? (
              <button
                onClick={() => setSelectedPhone(null)}
                className="flex items-center gap-1.5 text-xs font-black text-amber-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 rounded-xl transition-colors shadow-sm"
              >
                ← العودة لزبائن التاريخ المحدد
              </button>
            ) : (
              <div className="flex items-center gap-2.5">
                <span className="text-2xl bg-amber-500/20 p-1.5 rounded-xl border border-amber-500/30">👁️</span>
                <div>
                  <h1 className="text-base sm:text-lg font-black text-white leading-tight">متابعة طلبيات اليوم والمصنع</h1>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    مرحباً يا <span className="text-amber-400">{staffName}</span>
                    {lastUpdated && <> · آخر تحديث <span dir="ltr">{lastUpdated}</span></>}
                  </p>
                </div>
              </div>
            )}

            {selectedClient && (
              <div className="border-r border-slate-800 pr-3">
                <p className="text-base font-black text-white leading-tight">{selectedClient.name}</p>
                <p className="text-[11px] text-amber-400 font-mono font-bold" dir="ltr">{selectedClient.phone}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-xl transition-colors disabled:opacity-40 shadow-sm"
            >
              🔄 {loading ? "تزامن..." : "تحديث"}
            </button>
            <button
              onClick={onLogout}
              className="text-xs font-bold text-red-200 hover:text-white bg-red-950/80 hover:bg-red-900 border border-red-800/60 px-3 py-2 rounded-xl transition-colors"
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4 pb-12">

        {/* ── DATE FILTER BAR (CRITICAL) ── */}
        {!selectedClient && (
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                <span>📅 اختر تاريخ التسليم المطلوب:</span>
              </span>

              {/* Date Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setSelectedDate(todayStr)}
                  className={`text-xs font-black px-3.5 py-1.5 rounded-xl border transition-all ${
                    selectedDate === todayStr
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 font-black scale-105"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  🔴 طلبيات اليوم ({todayStr})
                </button>

                <button
                  onClick={() => setSelectedDate(tomorrowStr)}
                  className={`text-xs font-black px-3.5 py-1.5 rounded-xl border transition-all ${
                    selectedDate === tomorrowStr
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 font-black scale-105"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  🟡 غداً ({tomorrowStr})
                </button>

                <button
                  onClick={() => setSelectedDate("all")}
                  className={`text-xs font-black px-3 py-1.5 rounded-xl border transition-all ${
                    selectedDate === "all"
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg font-black"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  🌐 كافة التواريخ
                </button>

                {/* Custom Date Picker */}
                <input
                  type="date"
                  value={selectedDate === "all" ? "" : selectedDate}
                  onChange={e => e.target.value && setSelectedDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2.5 py-1 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Day Summary Indicator */}
            <div className="flex items-center gap-3 text-xs font-bold text-slate-300 pt-2 border-t border-slate-800/80 flex-wrap">
              <span>زبائن هذا اليوم: <strong className="text-white">{clientGroups.length}</strong></span>
              <span>·</span>
              <span>إجمالي الأوامر: <strong className="text-white">{dayStats.totalOrders}</strong></span>
              <span>·</span>
              <span className="text-amber-400">قيد التحضير/الانتظار: <strong>{dayStats.pendingOrders}</strong></span>
              <span>·</span>
              <span className="text-emerald-400">جاهزة للتسليم: <strong>{dayStats.readyOrders}</strong></span>
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
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-100 focus:outline-none focus:border-amber-500 placeholder:text-slate-500 shadow-inner"
            />

            {loading && orders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-xs font-bold text-slate-400">جاري تحميل طلبيات التاريخ المحدد...</p>
              </div>
            )}

            {!loading && filteredClients.length === 0 && (
              <div className="text-center py-16 text-slate-400 text-sm font-semibold bg-slate-900/40 rounded-2xl border border-slate-800">
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
                      ? "bg-slate-900/60 border-emerald-500/40 hover:border-emerald-400"
                      : "bg-slate-900/90 border-slate-800 hover:border-amber-500/60 shadow-lg"
                  }`}
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-white text-base leading-tight group-hover:text-amber-300 transition-colors">
                        {client.name}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {client.refId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono font-semibold" dir="ltr">{client.phone}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className={`px-3.5 py-1.5 rounded-xl border font-black text-xs ${
                      client.allDone
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : client.doneCount > 0
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                        : "bg-blue-600/20 border-blue-500/40 text-blue-300"
                    }`}>
                      {client.doneCount} / {client.totalCount} جاهز
                    </div>
                    <span className="text-slate-500 group-hover:text-amber-400 transition-colors text-xl font-black">›</span>
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>جاهزية طلبيات {selectedClient.name}:</span>
                <span className={selectedClient.allDone ? "text-emerald-400" : "text-amber-400"}>
                  {selectedClient.doneCount} من أصل {selectedClient.totalCount} جاهزة للتسليم
                </span>
              </div>
              <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
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

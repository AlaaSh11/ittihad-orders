import { useEffect, useMemo, useState } from 'react';
import { getDailyReportData, localDateString } from '../lib/ordersStore';
import { formatMixed, toUSD } from '../constants/currency';
import { ACTION_LABELS, formatHistoryTime } from '../constants/historyLabels';

const KIND_LABELS = { deposit: 'عربون', final: 'سداد كامل', void: 'إلغاء / استرجاع' };

// Changes the owner should look at: money reversed, prices changed after saving, cancellations.
const WATCH_ACTIONS = new Set(['undo_payment', 'undo_deposit', 'price', 'deposit_amount', 'cancel', 'uncancel']);

function round2(n) { return Math.round(n * 100) / 100; }

function money(n) { return `$${round2(n).toLocaleString('en-US')}`; }

/** Amount still owed on an unpaid order, in USD. */
function owed(order) {
  const price = parseFloat(order.footer?.price) || 0;
  if (order.depositCollected) {
    const rem = parseFloat(order.footer?.remaining);
    return isNaN(rem) ? price : rem;
  }
  return price;
}

function Stat({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'bg-white border-slate-200 text-slate-900',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    rose: 'bg-rose-50 border-rose-200 text-rose-900',
  };
  return (
    <div className={`border rounded-xl px-4 py-3 ${tones[tone]}`}>
      <div className="text-xs font-bold opacity-75">{label}</div>
      <div className="text-xl font-black mt-0.5" dir="ltr">{value}</div>
      {sub && <div className="text-[11px] font-semibold opacity-75 mt-0.5" dir="ltr">{sub}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <h2 className="text-sm font-extrabold text-[#1a1a2e] mb-3">{title}</h2>
      {children}
    </section>
  );
}

/** Admin-only daily report: cash collected, orders taken, money owed, changes to watch. */
export default function DailyReportView({ onBack, onLogout }) {
  const [day, setDay] = useState(() => localDateString());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (d) => {
    setLoading(true);
    setError('');
    try {
      setData(await getDailyReportData(d));
    } catch (e) {
      console.error('Report load error:', e);
      setError('تعذر تحميل التقرير. تحقق من الإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(day); }, [day]);

  const report = useMemo(() => {
    if (!data) return null;
    const { payments, createdOrders, changes, unpaidOrders } = data;

    const cash = { usd: 0, lbp: 0 };
    const byKind = {};
    const byCashier = {};
    for (const p of payments) {
      cash.usd += p.usd || 0;
      cash.lbp += p.lbp || 0;
      byKind[p.kind] = byKind[p.kind] || { usd: 0, lbp: 0, count: 0 };
      byKind[p.kind].usd += p.usd || 0;
      byKind[p.kind].lbp += p.lbp || 0;
      byKind[p.kind].count += 1;
      const who = p.by || '—';
      byCashier[who] = byCashier[who] || { usd: 0, lbp: 0, count: 0 };
      byCashier[who].usd += p.usd || 0;
      byCashier[who].lbp += p.lbp || 0;
      byCashier[who].count += 1;
    }

    const active = createdOrders.filter((o) => !o.isCancelled);
    const sales = active.reduce((s, o) => s + (parseFloat(o.footer?.price) || 0), 0);
    const byEmployee = {};
    for (const c of changes.filter((x) => x.action === 'create')) {
      const who = c.by || '—';
      byEmployee[who] = (byEmployee[who] || 0) + 1;
    }

    const owedTotal = unpaidOrders.reduce((s, o) => s + owed(o), 0);
    const overdue = unpaidOrders.filter((o) => o.header?.deliveryDate && o.header.deliveryDate < day);

    const watch = changes
      .filter((c) => WATCH_ACTIONS.has(c.action)
        || (c.action === 'edit' && (c.changes || []).some((x) => x.f === 'footer.price')))
      .sort((a, b) => (a.clientAt || '').localeCompare(b.clientAt || ''));

    const paymentRows = [...payments].sort((a, b) => (a.clientAt || '').localeCompare(b.clientAt || ''));

    return {
      cash, byKind, byCashier, createdCount: createdOrders.length, activeCount: active.length,
      cancelledCount: createdOrders.length - active.length, sales, byEmployee,
      unpaidCount: unpaidOrders.length, owedTotal, overdue, watch, paymentRows,
    };
  }, [data, day]);

  return (
    <div className="min-h-screen bg-slate-100 font-cairo" dir="rtl">
      <header className="bg-[#1b2740] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-10 shadow">
        <h1 className="text-base sm:text-lg font-black">📊 التقرير اليومي</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={day}
            max={localDateString()}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            className="text-sm font-bold text-[#1a1a2e] bg-white rounded-lg px-2 py-1"
            dir="ltr"
            aria-label="اليوم"
          />
          <button onClick={() => load(day)} className="bg-white/15 hover:bg-white/25 text-sm font-bold px-3 py-1.5 rounded-lg">🔄</button>
          <button onClick={onBack} className="bg-white text-[#1b2740] text-sm font-extrabold px-3 py-1.5 rounded-lg">📋 الطلبات</button>
          <button onClick={onLogout} className="bg-rose-600 hover:bg-rose-700 text-sm font-bold px-3 py-1.5 rounded-lg">خروج</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 flex flex-col gap-4">
        {loading && <p className="text-sm font-bold text-slate-600">⏳ جارِ تحميل التقرير...</p>}
        {error && <p className="text-sm font-bold text-rose-600">{error}</p>}

        {report && !loading && (
          <>
            <Section title="💵 المبالغ المستلمة في الصندوق">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <Stat label="بالدولار" value={`$${round2(report.cash.usd).toLocaleString('en-US')}`} tone="green" />
                <Stat label="بالليرة" value={`${Math.round(report.cash.lbp).toLocaleString('en-US')} L.L`} tone="green" />
                <Stat label="المجموع (تقريباً بالدولار)" value={money(toUSD(report.cash.usd, report.cash.lbp))} sub="حسب سعر الصرف المعتمد" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-500 text-right"><th className="py-1">النوع</th><th>العدد</th><th>المبلغ</th></tr></thead>
                  <tbody>
                    {Object.entries(report.byKind).map(([k, v]) => (
                      <tr key={k} className="border-t border-slate-100">
                        <td className="py-1.5 font-bold">{KIND_LABELS[k] || k}</td>
                        <td>{v.count}</td>
                        <td dir="ltr" className="text-right">{formatMixed(round2(v.usd), Math.round(v.lbp))}</td>
                      </tr>
                    ))}
                    {Object.keys(report.byKind).length === 0 && (
                      <tr><td colSpan={3} className="py-2 text-slate-500">لا توجد مبالغ مسجّلة في هذا اليوم.</td></tr>
                    )}
                  </tbody>
                </table>

                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-500 text-right"><th className="py-1">الكاشير</th><th>العمليات</th><th>الصافي</th></tr></thead>
                  <tbody>
                    {Object.entries(report.byCashier).map(([who, v]) => (
                      <tr key={who} className="border-t border-slate-100">
                        <td className="py-1.5 font-bold">{who}</td>
                        <td>{v.count}</td>
                        <td dir="ltr" className="text-right">{formatMixed(round2(v.usd), Math.round(v.lbp))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="🧾 الطلبات المسجّلة في هذا اليوم">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <Stat label="عدد الطلبات" value={report.activeCount} />
                <Stat label="قيمة المبيعات" value={money(report.sales)} tone="green" />
                <Stat label="ملغاة" value={report.cancelledCount} tone={report.cancelledCount ? 'rose' : 'slate'} />
                <Stat label="مجموع ما تم إدخاله" value={report.createdCount} />
              </div>
              {Object.keys(report.byEmployee).length > 0 && (
                <p className="text-xs text-slate-600 font-semibold">
                  حسب الموظف: {Object.entries(report.byEmployee).map(([w, n]) => `${w} (${n})`).join(' · ')}
                </p>
              )}
            </Section>

            <Section title="⏳ المبالغ المستحقة على الزبائن (حتى الآن)">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                <Stat label="طلبات غير مدفوعة" value={report.unpaidCount} tone="amber" />
                <Stat label="المبلغ المستحق" value={money(report.owedTotal)} tone="amber" />
                <Stat label="متأخرة عن موعد التسليم" value={report.overdue.length} tone={report.overdue.length ? 'rose' : 'slate'} />
              </div>
              {report.overdue.length > 0 && (
                <ul className="text-xs text-slate-700 flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {report.overdue.map((o) => (
                    <li key={o.id} className="flex flex-wrap gap-2">
                      <span className="font-bold" dir="ltr">{o.id}</span>
                      <span>{o.header?.customerName}</span>
                      <span className="text-slate-500" dir="ltr">{o.header?.deliveryDate}</span>
                      <span className="font-bold text-rose-700" dir="ltr">{money(owed(o))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="👀 تعديلات تستحق المراجعة">
              {report.watch.length === 0 ? (
                <p className="text-sm text-slate-500">لا توجد إلغاءات أو تعديلات أسعار في هذا اليوم.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {report.watch.map((c) => {
                    const price = (c.changes || []).find((x) => x.f === 'footer.price');
                    return (
                      <li key={c.id} className="text-xs border border-slate-200 rounded-lg px-3 py-2 flex flex-wrap gap-x-3 gap-y-1">
                        <span className="font-extrabold" dir="ltr">{c.orderId}</span>
                        <span className="font-bold text-indigo-800">{ACTION_LABELS[c.action] || c.action}</span>
                        <span>👤 {c.by || '—'}</span>
                        <span className="text-slate-500" dir="ltr">{formatHistoryTime(c)}</span>
                        {price && (
                          <span>
                            السعر: <span className="line-through text-rose-600" dir="ltr">${price.from || 0}</span>
                            {' ← '}
                            <span className="font-bold text-emerald-700" dir="ltr">${price.to || 0}</span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title="📃 تفاصيل المبالغ المستلمة">
              {report.paymentRows.length === 0 ? (
                <p className="text-sm text-slate-500">لا يوجد.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[520px]">
                    <thead>
                      <tr className="text-slate-500 text-right [&>th]:px-2">
                        <th className="py-1">الوقت</th><th>الطلبية</th><th>الزبون</th><th>النوع</th><th>الكاشير</th><th>المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.paymentRows.map((p) => (
                        <tr key={p.id} className={`border-t border-slate-100 [&>td]:px-2 ${p.kind === 'void' ? 'text-rose-700' : ''}`}>
                          <td className="py-1.5" dir="ltr">{formatHistoryTime(p).split(' ')[1]}</td>
                          <td dir="ltr" className="font-bold">{p.orderId}</td>
                          <td>{p.customerName}</td>
                          <td>{KIND_LABELS[p.kind] || p.kind}</td>
                          <td>{p.by}</td>
                          <td dir="ltr" className="text-right font-bold">{formatMixed(p.usd, p.lbp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <p className="text-[11px] text-slate-500">
              يشمل التقرير فقط المبالغ المسجّلة بعد تفعيل هذه الميزة. المبالغ بالليرة محوّلة للدولار تقريبياً حسب سعر الصرف المعتمد.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

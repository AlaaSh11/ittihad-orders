import { useEffect, useState } from 'react';
import { getOrderHistory } from '../lib/ordersStore';
import {
  ACTION_LABELS, FIELD_LABELS, HIDDEN_FIELDS, formatHistoryValue, formatHistoryTime,
} from '../constants/historyLabels';

/** Admin-only: who changed what on one order, oldest first. */
export default function OrderHistoryModal({ order, onClose }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getOrderHistory(order.id)
      .then((list) => alive && setEntries(list))
      .catch(() => alive && setError('تعذر تحميل سجل التعديلات. تحقق من الإنترنت.'));
    return () => { alive = false; };
  }, [order.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-cairo" dir="rtl">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden border border-gray-100 flex flex-col">
        <div className="px-5 py-4 bg-slate-50 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-[#1a1a2e]">
            🕘 سجل التعديلات — <span dir="ltr">{order.id}</span>
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full w-7 h-7 flex items-center justify-center hover:bg-gray-200">✕</button>
        </div>

        <div className="p-4 overflow-y-auto flex flex-col gap-3">
          {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
          {!error && entries === null && <p className="text-sm text-gray-500">⏳ جارِ التحميل...</p>}
          {entries && entries.length === 0 && (
            <p className="text-sm text-gray-500">
              لا يوجد سجل لهذه الطلبية. التعديلات التي تمت قبل تفعيل السجل غير مسجّلة.
            </p>
          )}
          {entries && entries.map((e) => {
            const changes = (e.changes || []).filter((c) => !HIDDEN_FIELDS.has(c.f));
            return (
              <div key={e.id} className="border border-gray-200 rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-extrabold text-[#1a1a2e]">{ACTION_LABELS[e.action] || e.action}</span>
                  <span className="text-xs text-gray-500" dir="ltr">{formatHistoryTime(e)}</span>
                </div>
                <div className="text-xs font-bold text-indigo-800 mb-1">👤 {e.by || '—'}</div>
                {changes.length > 0 && (
                  <ul className="text-xs text-gray-700 flex flex-col gap-0.5">
                    {changes.map((c, i) => (
                      <li key={i}>
                        <span className="font-bold">{FIELD_LABELS[c.f] || c.f}:</span>{' '}
                        <span className="line-through text-rose-600">{formatHistoryValue(c.f, c.from)}</span>
                        {' ← '}
                        <span className="text-emerald-700 font-bold">{formatHistoryValue(c.f, c.to)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

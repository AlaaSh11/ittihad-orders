import { useState, useEffect, useCallback } from 'react';
import { logout } from '../lib/auth';
import { createOrder, updateOrder, getNextOrderId, peekCurrentOrderId, syncCounterFromCloud } from '../lib/ordersStore';
import { buildWhatsAppUrl } from '../lib/whatsapp';
import { RECEIVER_OPTIONS } from '../constants/receiverOptions';
import { DEFAULT_TIME } from '../constants/timeSlots';

import OrderHeader from '../components/OrderHeader';
import OrderTypeSelector from '../components/OrderTypeSelector';
import OrderFooter from '../components/OrderFooter';
import PrintLayout from '../components/PrintLayout';
import CakeOrderBody from '../components/body/CakeOrderBody';
import ChocolateOrderBody from '../components/body/ChocolateOrderBody';
import OccasionOrderBody from '../components/body/OccasionOrderBody';
import SimpleOrderBody from '../components/body/SimpleOrderBody';

const BODY_COMPONENTS = {
  cake: CakeOrderBody,
  chocolate: ChocolateOrderBody,
  occasion: OccasionOrderBody,
  simple: SimpleOrderBody,
};

function makeEmptyHeader(user) {
  return {
    customerPhone: '+961 ',
    customerName: '',
    deliveryDate: '',
    dayName: '',
    deliveryTime: DEFAULT_TIME,
    deliveryMethod: '',
    deliveryAddress: '',
    recipient: user?.role !== 'admin' ? (user?.arabicName || '') : RECEIVER_OPTIONS[0],
  };
}

function makeEmptyBody() { return {}; }
function makeEmptyFooter() {
  return { price: '', depositPaid: false, depositAmount: '', remaining: '' };
}

/**
 * Main order form view — Section 2.2 visual spec.
 *
 * Props:
 *   currentUser  {Object}       Logged-in user from auth.js
 *   onLogout     {fn}
 *   onHistory    {fn}           Navigate to Order History view
 *   editingOrder {Object|null}  If set, pre-fill form for editing this order
 *   onCancelEdit {fn}           Cancel edit mode and return to blank form
 */
export default function OrderFormView({ currentUser, onLogout, onHistory, editingOrder, onCancelEdit }) {
  // ── Determine if we're in edit mode ──
  const isEditMode = !!editingOrder;

  // ── customerVisitId: generated once per session, reused for same-customer orders ──
  const [customerVisitId] = useState(() => crypto.randomUUID());

  const [orderId, setOrderId] = useState(() =>
    editingOrder ? editingOrder.id : 'CAKE-...'
  );
  const [headerData, setHeaderData] = useState(() =>
    editingOrder ? { ...makeEmptyHeader(currentUser), ...editingOrder.header } : makeEmptyHeader(currentUser)
  );
  const [headerLocked, setHeaderLocked] = useState(false);
  const [orderType, setOrderType] = useState(() =>
    editingOrder ? editingOrder.orderType : 'cake'
  );
  const [bodyData, setBodyData] = useState(() =>
    editingOrder ? { ...editingOrder.body } : makeEmptyBody()
  );
  const [footerData, setFooterData] = useState(() =>
    editingOrder ? { ...makeEmptyFooter(), ...editingOrder.footer } : makeEmptyFooter()
  );
  const [isSaved, setIsSaved] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Re-populate form when editingOrder changes ──
  useEffect(() => {
    if (editingOrder) {
      setOrderId(editingOrder.id);
      setHeaderData({ ...makeEmptyHeader(currentUser), ...editingOrder.header });
      setOrderType(editingOrder.orderType || 'cake');
      setBodyData({ ...editingOrder.body });
      setFooterData({ ...makeEmptyFooter(), ...editingOrder.footer });
      setIsSaved(false);
      setSavedOrder(null);
      setHeaderLocked(false);
      setSaveError('');
    }
  }, [editingOrder, currentUser]);

  // Keep recipient locked + set for non-admin
  useEffect(() => {
    if (currentUser?.role !== 'admin' && !isEditMode) {
      setHeaderData((prev) => ({ ...prev, recipient: currentUser?.arabicName || '' }));
    }
  }, [currentUser, isEditMode]);

  // Sync latest order serial from Cloud Firestore on mount (only in new-order mode)
  useEffect(() => {
    if (!isEditMode) {
      syncCounterFromCloud().then(() => setOrderId(peekCurrentOrderId()));
    }
  }, [isEditMode]);

  // Mark unsaved on any form change
  const handleHeaderChange = useCallback((field, value) => {
    setHeaderData((prev) => ({ ...prev, [field]: value }));
    setIsSaved(false);
  }, []);

  const handleBodyChange = useCallback((field, value) => {
    setBodyData((prev) => ({ ...prev, [field]: value }));
    setIsSaved(false);
  }, []);

  const handleFooterChange = useCallback((field, value) => {
    setFooterData((prev) => ({ ...prev, [field]: value }));
    setIsSaved(false);
  }, []);

  const handleOrderTypeChange = (type) => {
    setOrderType(type);
    setBodyData(makeEmptyBody());
    setIsSaved(false);
  };

  // ── Save action ──────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      if (!headerData?.deliveryDate) {
        setSaveError('⚠️ يرجى اختيار تاريخ تسليم الطلبية قبل إتمام الحفظ.');
        setSaving(false);
        return;
      }

      const priceVal = parseFloat(footerData.price) || 0;
      const remainingVal = parseFloat(footerData.remaining) || 0;
      // Note: Even if deposit equals price, staff does not take cash! 
      // All cash (deposits and final settlements) is collected exclusively by the cashier.
      const hasZeroPrice = priceVal === 0 && remainingVal === 0;

      if (isEditMode) {
        // ── UPDATE existing order (preserve ID & existing cashier payment records) ──
        const patch = {
          header: { ...headerData },
          orderType,
          body: { ...bodyData },
          footer: { ...footerData },
          // Keep whatever payment/deposit states were already recorded by the cashier
          isPaid: editingOrder.isPaid || false,
          depositCollected: editingOrder.depositCollected || false,
        };
        const updated = await updateOrder(editingOrder.id, patch);
        const fullOrder = updated || { ...editingOrder, ...patch, updatedAt: new Date().toISOString() };
        setSavedOrder(fullOrder);
        setOrderId(editingOrder.id);
        setIsSaved(true);
      } else {
        // ── CREATE new order ──
        const newId = await getNextOrderId();
        const order = {
          id: newId,
          customerVisitId,
          createdAt: new Date().toISOString(),
          header: { ...headerData },
          orderType,
          body: { ...bodyData },
          footer: { ...footerData },
          // All newly created orders start unpaid and awaiting cashier processing
          isPaid: hasZeroPrice ? true : false,
          depositCollected: false,
          depositCollectedAt: null,
          depositCollectedBy: null,
          paidAt: null,
          paidBy: null,
          productionStatus: 'received',
          isCancelled: false,
        };
        const saved = await createOrder(order);
        setSavedOrder(saved);
        setOrderId(saved.id);
        setIsSaved(true);
        setHeaderLocked(true);
      }
    } catch (err) {
      setSaveError('حدث خطأ أثناء الحفظ. حاول مرة أخرى.');
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Print action — gated behind isSaved ─────────────────────
  const handlePrint = () => {
    if (!isSaved) return;
    window.print();
  };

  // ── WhatsApp action ──────────────────────────────────────────
  const handleWhatsApp = () => {
    if (!isSaved && !window.confirm('⚠️ تنبيه: لم تقم بحفظ هذه الطلبية بعد، وقد يتغير رقم الطلب التنازلي عند الحفظ النهائي. هل تريد الاستمرار في إرسال رسالة واتساب على أي حال؟')) {
      return;
    }
    const order = savedOrder || {
      id: orderId,
      header: headerData,
      orderType,
      body: bodyData,
      footer: footerData,
    };
    const url = buildWhatsAppUrl(order);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ── New order, same customer ─────────────────────────────────
  const handleNewSameCustomer = () => {
    setOrderType('cake');
    setBodyData(makeEmptyBody());
    setFooterData(makeEmptyFooter());
    setIsSaved(false);
    setSavedOrder(null);
    setOrderId(peekCurrentOrderId());
    syncCounterFromCloud().then(() => setOrderId(peekCurrentOrderId()));
    // Header stays locked with same data; visitId stays the same
  };

  // ── Full form reset — completely blank new order ──────────────
  const handleFullReset = () => {
    setOrderType('cake');
    setBodyData(makeEmptyBody());
    setFooterData(makeEmptyFooter());
    setHeaderData(makeEmptyHeader(currentUser));
    setHeaderLocked(false);
    setIsSaved(false);
    setSavedOrder(null);
    setSaveError('');
    setOrderId(peekCurrentOrderId());
    syncCounterFromCloud().then(() => setOrderId(peekCurrentOrderId()));
  };

  // ── Logout — clears session ──────────────────────────────────
  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const BodyComponent = BODY_COMPONENTS[orderType] || CakeOrderBody;

  return (
    <div className="min-h-screen bg-[#eaeaf2] print:bg-white" dir="rtl">

      {/* ── Print layout (hidden on screen, shown on print) ── */}
      <PrintLayout order={savedOrder} currentUser={currentUser} />

      {/* ── Top bar (hidden on print) ── */}
      <div className="print:hidden flex items-center justify-between max-w-[700px] mx-auto px-4 py-2">
        <div className="flex items-center gap-2">
          {/* User badge */}
          <div className="bg-[#1b2740] text-white text-sm font-bold px-4 py-1 rounded-full font-cairo">
            {currentUser?.arabicName || currentUser?.username?.toUpperCase()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* History button */}
          {onHistory && (
            <button
              onClick={onHistory}
              className="bg-white text-[#1a1a2e] text-sm font-bold px-3 py-1 rounded border border-[#1a1a2e] font-cairo hover:bg-[#1a1a2e] hover:text-white transition-colors"
            >
              📋 سجل الطلبات
            </button>
          )}
          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="border border-[#1a1a2e] text-[#1a1a2e] text-sm font-bold px-3 py-1 rounded font-cairo hover:bg-[#1a1a2e] hover:text-white transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>

      {/* ── Edit mode banner ── */}
      {isEditMode && (
        <div className="print:hidden max-w-[700px] mx-auto px-4 mb-2">
          <div className="flex items-center justify-between bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">✏️</span>
              <span className="text-sm font-bold text-amber-800 font-cairo">
                وضع التعديل: جاري التعديل على الطلب
              </span>
              <span className="text-sm font-bold text-amber-900 font-cairo" dir="ltr" style={{ fontFamily: "'Courier New', monospace" }}>
                {editingOrder.id}
              </span>
            </div>
            <button
              onClick={onCancelEdit}
              className="text-xs font-bold text-amber-700 border border-amber-400 rounded px-2 py-1 hover:bg-amber-100 transition-colors font-cairo"
            >
              ❌ إلغاء التعديل
            </button>
          </div>
        </div>
      )}

      {/* ── Main form card ── */}
      <div className="print:hidden max-w-[700px] mx-auto px-4 pb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

          {/* Header */}
          <OrderHeader
            data={headerData}
            onChange={handleHeaderChange}
            locked={headerLocked && !isEditMode}
            orderId={orderId}
            currentUser={currentUser}
            createdAt={editingOrder?.createdAt || savedOrder?.createdAt}
          />

          {/* Divider */}
          <hr className="border-gray-200 my-3" />

          {/* Same-customer action — shown after first save (only in new-order mode) */}
          {headerLocked && !isEditMode && (
            <div className="flex items-center justify-between mb-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <span className="text-xs text-blue-700 font-bold font-cairo">
                معلومات الزبون محفوظة لهذه الجلسة
              </span>
              <button
                onClick={handleNewSameCustomer}
                className="text-xs font-bold text-blue-700 border border-blue-400 rounded px-2 py-0.5 hover:bg-blue-100 transition-colors font-cairo"
              >
                طلب جديد لنفس الزبون
              </button>
            </div>
          )}

          {/* Order type tabs */}
          <OrderTypeSelector value={orderType} onChange={handleOrderTypeChange} />

          {/* Body */}
          <BodyComponent data={bodyData} onChange={handleBodyChange} />

          {/* Footer — showroom variant on screen */}
          <OrderFooter
            data={footerData}
            onChange={handleFooterChange}
            variant="showroom"
          />

          {/* Save error */}
          {saveError && (
            <p className="text-[#e2495c] text-xs font-bold text-center mt-2 font-cairo">{saveError}</p>
          )}

          {/* ── Action buttons ── */}
          <div className="mt-4 pt-3 border-t border-gray-200 grid grid-cols-3 gap-3">

            {/* send whatsapp */}
            <button
              onClick={handleWhatsApp}
              className="border-2 border-green-700 text-green-800 hover:bg-green-50 text-sm font-bold py-2.5 rounded-lg transition-colors font-cairo active:scale-[0.97] flex items-center justify-center gap-1.5"
            >
              💬 إرسال واتساب
            </button>

            {/* Save / New Order / Update — primary — morphs after save */}
            <button
              onClick={isSaved && !isEditMode ? handleFullReset : handleSave}
              disabled={saving}
              className={`text-white text-sm font-bold py-2.5 rounded-lg transition-all duration-200 font-cairo active:scale-[0.97] disabled:opacity-70 ${
                isSaved && !isEditMode
                  ? 'bg-green-700 hover:bg-green-800 shadow-md'
                  : isEditMode
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-[#1a1a2e] hover:bg-[#2d2d4a]'
              }`}
            >
              {saving
                ? '⏳ جاري الحفظ...'
                : isSaved && !isEditMode
                  ? '📝 طلب جديد — مسح الاستمارة'
                  : isEditMode
                    ? '💾 حفظ التعديلات'
                    : 'حفظ طلب جديد'
              }
            </button>

            {/* print order — disabled until saved */}
            <button
              onClick={handlePrint}
              disabled={!isSaved}
              title={!isSaved ? 'احفظ الطلب أولاً قبل الطباعة' : 'طباعة'}
              className="border-2 border-[#1a1a2e] text-[#1a1a2e] text-sm font-bold py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-cairo active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              🖨️ طباعة الطلب
            </button>
          </div>

          {/* Saved confirmation */}
          {isSaved && (
            <p className={`text-xs font-bold text-center mt-2 font-cairo ${isEditMode ? 'text-amber-700' : 'text-green-700'}`}>
              {isEditMode
                ? `✓ تم تحديث الطلب — ${savedOrder?.id}`
                : `✓ تم الحفظ — ${savedOrder?.id}`
              }
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

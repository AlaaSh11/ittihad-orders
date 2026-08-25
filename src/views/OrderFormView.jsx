import { useState, useEffect, useCallback } from 'react';
import { logout } from '../lib/auth';
import { createOrder, updateOrder, getNextOrderId, peekCurrentOrderId, syncCounterFromCloud } from '../lib/ordersStore';
import { buildWhatsAppUrl } from '../lib/whatsapp';
import { RECEIVER_OPTIONS } from '../constants/receiverOptions';
import { DEFAULT_TIME } from '../constants/timeSlots';
import { ENABLE_FACTORY_SYSTEM } from '../constants/featureFlags';

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

const ORDER_TYPE_LABELS = {
  cake: 'طلب كيك',
  chocolate: 'طلب شوكولا',
  occasion: 'طلب مناسبة',
  simple: 'طلب بسيط',
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

export default function OrderFormView({ currentUser, onLogout, onHistory, onFactory, editingOrder, onCancelEdit }) {
  const isEditMode = !!editingOrder;
  const [customerVisitId] = useState(() => crypto.randomUUID());

  const [orderId, setOrderId] = useState(() => editingOrder ? editingOrder.id : 'CAKE-...');
  const [headerData, setHeaderData] = useState(() => editingOrder ? { ...makeEmptyHeader(currentUser), ...editingOrder.header } : makeEmptyHeader(currentUser));
  const [footerData, setFooterData] = useState(() => editingOrder ? { ...makeEmptyFooter(), ...editingOrder.footer } : makeEmptyFooter());
  
  // Cart Items
  const [cartItems, setCartItems] = useState([]);
  
  // Draft Item
  const [draftType, setDraftType] = useState('cake');
  const [draftBody, setDraftBody] = useState(makeEmptyBody());

  // Wizard Step: 1 (Header), 2 (Cart Builder), 3 (Footer/Review)
  const [step, setStep] = useState(1);

  const [isSaved, setIsSaved] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingOrder) {
      setOrderId(editingOrder.id);
      setHeaderData({ ...makeEmptyHeader(currentUser), ...editingOrder.header });
      
      if (Array.isArray(editingOrder.items) && editingOrder.items.length > 0) {
        setCartItems(editingOrder.items);
      } else if (editingOrder.body) {
        setCartItems([{ id: crypto.randomUUID(), orderType: editingOrder.orderType, body: { ...editingOrder.body } }]);
      } else {
        setCartItems([]);
      }

      setFooterData({ ...makeEmptyFooter(), ...editingOrder.footer });
      setIsSaved(false);
      setSavedOrder(null);
      setSaveError('');
      setStep(3); // Go straight to review when editing
    }
  }, [editingOrder, currentUser]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' && !isEditMode) {
      setHeaderData((prev) => ({ ...prev, recipient: currentUser?.arabicName || '' }));
    }
  }, [currentUser, isEditMode]);

  useEffect(() => {
    if (!isEditMode) {
      syncCounterFromCloud().then(() => setOrderId(peekCurrentOrderId()));
    }
  }, [isEditMode]);

  const handleHeaderChange = useCallback((field, value) => {
    setHeaderData((prev) => ({ ...prev, [field]: value }));
    setIsSaved(false);
  }, []);

  const handleDraftBodyChange = useCallback((field, value) => {
    setDraftBody((prev) => ({ ...prev, [field]: value }));
    setIsSaved(false);
  }, []);

  const handleFooterChange = useCallback((field, value) => {
    setFooterData((prev) => ({ ...prev, [field]: value }));
    setIsSaved(false);
  }, []);

  const [draftPrice, setDraftPrice] = useState('');
  const [draftCurrency, setDraftCurrency] = useState('USD');
  const [priceError, setPriceError] = useState('');
  const [editingItemId, setEditingItemId] = useState(null); // ID of item being edited

  const handleDraftTypeChange = (type) => {
    setDraftType(type);
    setDraftBody(makeEmptyBody());
  };

  const validatePrice = (priceStr, currency) => {
    if (!priceStr) return '';
    const raw = parseFloat(String(priceStr).replace(/,/g, ''));
    if (isNaN(raw)) return '';
    if (currency === 'LBP' && raw < 100000) return '⚠️ السعر بالليرة يجب أن يكون 100,000 أو أكثر';
    if (currency === 'USD' && raw > 10000) return '⚠️ السعر بالدولار يجب ألا يتجاوز 10,000';
    return '';
  };

  const handleCurrencyChange = (e) => {
    const newCurr = e.target.value;
    setDraftCurrency(newCurr);
    let raw = String(draftPrice).replace(/,/g, '');
    if (!raw) {
      setPriceError('');
      return;
    }
    
    let formatted = raw;
    if (newCurr === 'LBP') {
      raw = raw.split('.')[0];
      const num = parseInt(raw, 10);
      if (!isNaN(num)) formatted = num.toLocaleString('en-US');
      setDraftPrice(formatted);
    } else {
      setDraftPrice(formatted);
    }
    
    setPriceError(validatePrice(formatted, newCurr));
  };

  const handlePriceChange = (e) => {
    let val = e.target.value;
    if (draftCurrency === 'LBP') {
      val = val.replace(/[^\d]/g, '');
      if (!val) {
        setDraftPrice('');
        setPriceError('');
        return;
      }
      const num = parseInt(val, 10);
      const formatted = num.toLocaleString('en-US');
      setDraftPrice(formatted);
      setPriceError(validatePrice(formatted, 'LBP'));
    } else {
      val = val.replace(/[^\d.]/g, '');
      const parts = val.split('.');
      if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
      setDraftPrice(val);
      setPriceError(validatePrice(val, 'USD'));
    }
  };

  // Load an existing cart item into the draft form for editing
  const handleEditItem = (item) => {
    setEditingItemId(item.id);
    setDraftType(item.orderType);
    setDraftBody({ ...item.body });
    setPriceError('');
    
    if (item.priceLBP && !item.priceUSD) {
      setDraftPrice(Number(item.priceLBP).toLocaleString('en-US'));
      setDraftCurrency('LBP');
    } else if (item.priceUSD && !item.priceLBP) {
      setDraftPrice(item.priceUSD);
      setDraftCurrency('USD');
    } else if (item.priceUSD || item.priceLBP) {
      setDraftPrice(item.priceUSD ? item.priceUSD : Number(item.priceLBP).toLocaleString('en-US'));
      setDraftCurrency(item.priceUSD ? 'USD' : 'LBP');
    } else {
      setDraftPrice('');
      setDraftCurrency('USD');
    }
    
    setTimeout(() => document.getElementById('draftPriceInput')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setDraftType('cake');
    setDraftBody(makeEmptyBody());
    setDraftPrice('');
    setDraftCurrency('USD');
    setPriceError('');
  };

  const handleSaveEdit = () => {
    const err = validatePrice(draftPrice, draftCurrency);
    if (err) { setPriceError(err); return; }

    const rawVal = draftPrice ? String(draftPrice).replace(/,/g, '') : '';
    const finalPriceLBP = draftCurrency === 'LBP' ? rawVal : '';
    const finalPriceUSD = draftCurrency === 'USD' ? rawVal : '';

    setCartItems(prev => prev.map(item =>
      item.id === editingItemId
        ? { ...item, orderType: draftType, body: { ...draftBody }, priceLBP: finalPriceLBP, priceUSD: finalPriceUSD }
        : item
    ));
    setEditingItemId(null);
    setDraftType('cake');
    setDraftBody(makeEmptyBody());
    setDraftPrice('');
    setDraftCurrency('USD');
    setSaveError('');
    setPriceError('');
    setIsSaved(false);
  };

  const handleAddToCart = () => {
    const err = validatePrice(draftPrice, draftCurrency);
    if (err) { setPriceError(err); return; }

    const rawVal = draftPrice ? String(draftPrice).replace(/,/g, '') : '';
    const finalPriceLBP = draftCurrency === 'LBP' ? rawVal : '';
    const finalPriceUSD = draftCurrency === 'USD' ? rawVal : '';

    setCartItems(prev => [...prev, { id: crypto.randomUUID(), orderType: draftType, body: { ...draftBody }, priceLBP: finalPriceLBP, priceUSD: finalPriceUSD }]);
    setDraftType('cake');
    setDraftBody(makeEmptyBody());
    setDraftPrice('');
    setDraftCurrency('USD');
    setSaveError('');
    setPriceError('');
    setIsSaved(false);
  };

  const handleRemoveItem = (id) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
    if (editingItemId === id) handleCancelEdit();
    setIsSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      if (!headerData?.deliveryDate) {
        setSaveError('⚠️ يرجى اختيار تاريخ تسليم الطلبية قبل إتمام الحفظ.');
        setSaving(false);
        return;
      }
      if (cartItems.length === 0) {
        setSaveError('⚠️ السلة فارغة. يرجى إضافة صنف واحد على الأقل.');
        setSaving(false);
        return;
      }

      // Auto-compute totals from cart items
      const autoTotalLBP = cartItems.reduce((sum, item) => sum + (parseFloat(item.priceLBP) || 0), 0);
      const autoTotalUSD = cartItems.reduce((sum, item) => sum + (parseFloat(item.priceUSD) || 0), 0);
      const hasItemPrices = cartItems.some(i => i.priceLBP || i.priceUSD);
      const priceVal = parseFloat(footerData.price) || autoTotalLBP;
      const remainingVal = parseFloat(footerData.remaining) || 0;
      const hasZeroPrice = priceVal === 0 && remainingVal === 0 && autoTotalUSD === 0;

      if (isEditMode) {
        const patch = {
          header: { ...headerData },
          items: cartItems,
          // Remove old schema fields to prevent confusion
          orderType: null,
          body: null,
          footer: { ...footerData },
          isPaid: editingOrder.isPaid || false,
          depositCollected: editingOrder.depositCollected || false,
        };
        const updated = await updateOrder(editingOrder.id, patch);
        const fullOrder = updated || { ...editingOrder, ...patch, updatedAt: new Date().toISOString() };
        setSavedOrder(fullOrder);
        setOrderId(editingOrder.id);
        setIsSaved(true);
      } else {
        const newId = await getNextOrderId();
        const order = {
          id: newId,
          customerVisitId,
          createdAt: new Date().toISOString(),
          header: { ...headerData },
          items: cartItems,
          footer: { ...footerData },
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
      }
    } catch (err) {
      setSaveError('حدث خطأ أثناء الحفظ. حاول مرة أخرى.');
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!isSaved) return;
    window.print();
  };

  const handleWhatsApp = () => {
    if (!isSaved && !window.confirm('⚠️ تنبيه: لم تقم بحفظ هذه الطلبية بعد. هل تريد الاستمرار؟')) {
      return;
    }
    const order = savedOrder || {
      id: orderId,
      header: headerData,
      items: cartItems,
      footer: footerData,
    };
    const url = buildWhatsAppUrl(order);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleNewSameCustomer = () => {
    setCartItems([]);
    setDraftType('cake');
    setDraftBody(makeEmptyBody());
    setFooterData(makeEmptyFooter());
    setIsSaved(false);
    setSavedOrder(null);
    setOrderId(peekCurrentOrderId());
    setStep(2); // Jump straight to cart builder since header is kept
    syncCounterFromCloud().then(() => setOrderId(peekCurrentOrderId()));
  };

  const handleFullReset = () => {
    setCartItems([]);
    setDraftType('cake');
    setDraftBody(makeEmptyBody());
    setFooterData(makeEmptyFooter());
    setHeaderData(makeEmptyHeader(currentUser));
    setIsSaved(false);
    setSavedOrder(null);
    setSaveError('');
    setStep(1);
    setOrderId(peekCurrentOrderId());
    syncCounterFromCloud().then(() => setOrderId(peekCurrentOrderId()));
  };

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const BodyComponent = BODY_COMPONENTS[draftType] || CakeOrderBody;

  const getConvertedPrice = () => {
    if (!draftPrice) return null;
    const raw = parseFloat(String(draftPrice).replace(/,/g, ''));
    if (isNaN(raw)) return null;
    
    const EXCHANGE_RATE = 90000;
    if (draftCurrency === 'USD') {
      const lbp = raw * EXCHANGE_RATE;
      return `~ ${lbp.toLocaleString('en-US')} LBP`;
    } else {
      const usd = raw / EXCHANGE_RATE;
      const formattedUsd = usd % 1 === 0 ? usd : usd.toFixed(2);
      return `~ $${formattedUsd} USD`;
    }
  };

  return (
    <div className="min-h-screen bg-[#eaeaf2] print:bg-white" dir="rtl">
      <PrintLayout order={savedOrder} currentUser={currentUser} />

      <div className="print:hidden flex items-center justify-between max-w-[700px] mx-auto px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="bg-[#1b2740] text-white text-sm font-bold px-4 py-1 rounded-full font-cairo">
            {currentUser?.arabicName || currentUser?.username?.toUpperCase()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onHistory && (
            <button
              onClick={onHistory}
              className="bg-white text-[#1a1a2e] text-sm font-bold px-3 py-1 rounded border border-[#1a1a2e] font-cairo hover:bg-[#1a1a2e] hover:text-white transition-colors"
            >
              📋 سجل الطلبات
            </button>
          )}
          {onFactory && ENABLE_FACTORY_SYSTEM && (
            <button
              onClick={onFactory}
              className="bg-amber-600 text-white text-sm font-extrabold px-3 py-1 rounded border border-amber-700 font-cairo hover:bg-amber-700 transition-colors flex items-center gap-1 shadow-sm"
            >
              <span>👨‍🍳</span>
              <span className="hidden sm:inline">شاشة المصنع (KDS)</span>
            </button>
          )}
          <button
            onClick={handleLogout}
            className="border border-[#1a1a2e] text-[#1a1a2e] text-sm font-bold px-3 py-1 rounded font-cairo hover:bg-[#1a1a2e] hover:text-white transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>

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

      {/* ── Wizard Progress Bar ── */}
      <div className="print:hidden max-w-[700px] mx-auto px-4 mb-4">
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-2 shadow-sm font-cairo text-sm">
          <button onClick={() => setStep(1)} className={`flex-1 text-center py-2 rounded-lg font-bold transition-all ${step === 1 ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}>1. بيانات الزبون</button>
          <div className="w-4 text-center text-gray-300">❯</div>
          <button onClick={() => { if(headerData.deliveryDate) setStep(2); }} className={`flex-1 text-center py-2 rounded-lg font-bold transition-all ${step === 2 ? 'bg-indigo-600 text-white shadow' : step > 2 ? 'text-indigo-600 hover:bg-indigo-50' : 'text-gray-500 hover:bg-gray-100'} ${!headerData.deliveryDate && !isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}>2. الأصناف</button>
          <div className="w-4 text-center text-gray-300">❯</div>
          <button onClick={() => { if(cartItems.length > 0) setStep(3); }} className={`flex-1 text-center py-2 rounded-lg font-bold transition-all ${step === 3 ? 'bg-indigo-600 text-white shadow' : step > 3 ? 'text-indigo-600 hover:bg-indigo-50' : 'text-gray-500 hover:bg-gray-100'} ${cartItems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>3. الدفع والحفظ</button>
        </div>
      </div>

      {/* ── Main form card ── */}
      <div className="print:hidden max-w-[700px] mx-auto px-4 pb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

          {/* STEP 1: Header */}
          {step === 1 && (
            <div className="animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-extrabold text-[#1a1a2e] font-cairo">1. بيانات الزبون وموعد التسليم</h2>
                <div className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200" dir="ltr" style={{ fontFamily: "'Courier New', monospace" }}>{orderId}</div>
              </div>
              <OrderHeader
                data={headerData}
                onChange={handleHeaderChange}
                locked={false}
                orderId={orderId}
                currentUser={currentUser}
                createdAt={editingOrder?.createdAt || savedOrder?.createdAt}
                hideOrderId={true} // hidden because we showed it above
              />
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    if (!headerData.deliveryDate) {
                      setSaveError('⚠️ يرجى تحديد تاريخ التسليم للمتابعة.');
                      return;
                    }
                    setSaveError('');
                    setStep(2);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg shadow font-cairo active:scale-[0.97]"
                >
                  التالي ❯
                </button>
              </div>
              {saveError && <p className="text-[#e2495c] text-xs font-bold text-left mt-2 font-cairo">{saveError}</p>}
            </div>
          )}

          {/* STEP 2: Cart Builder */}
          {step === 2 && (
            <div className="animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-extrabold text-[#1a1a2e] font-cairo">2. سلة الطلبات</h2>
                <button onClick={() => setStep(1)} className="text-xs text-gray-500 underline font-cairo">تعديل بيانات الزبون</button>
              </div>

              {/* Cart List */}
              {cartItems.length > 0 && (
                <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-inner">
                  <h3 className="text-sm font-bold text-slate-800 mb-2 font-cairo">الأصناف ({cartItems.length}):</h3>
                  <div className="flex flex-col gap-2">
                    {cartItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`flex justify-between items-center bg-white border p-2.5 rounded-lg shadow-sm transition-all ${
                          editingItemId === item.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 rounded text-xs font-bold font-cairo">{ORDER_TYPE_LABELS[item.orderType]}</span>
                          <span className="text-xs text-gray-500">صنف {idx + 1}</span>
                          {item.priceLBP && (
                            <span className="text-xs font-bold text-[#e2495c] bg-red-50 border border-red-200 px-2 py-0.5 rounded" dir="ltr">
                              {Number(item.priceLBP).toLocaleString()} LBP
                            </span>
                          )}
                          {item.priceUSD && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded" dir="ltr">
                              ${Number(item.priceUSD).toLocaleString()} USD
                            </span>
                          )}
                          {editingItemId === item.id && (
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full font-cairo animate-pulse">↓ قيد التعديل</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {editingItemId !== item.id && (
                            <button
                              onClick={() => handleEditItem(item)}
                              className="text-indigo-600 hover:bg-indigo-50 border border-indigo-200 p-1.5 rounded text-xs font-bold font-cairo"
                            >
                              ✏️ تعديل
                            </button>
                          )}
                          <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded text-xs font-bold font-cairo">❌</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Running total */}
                  {cartItems.some(i => i.priceLBP || i.priceUSD) && (
                    <div className="mt-2 flex flex-col items-end gap-1">
                      {cartItems.some(i => i.priceLBP) && (
                        <span className="text-sm font-extrabold text-slate-800 font-cairo bg-white border border-slate-300 px-3 py-1 rounded-lg" dir="ltr">
                          المجموع LBP: {cartItems.reduce((s, i) => s + (parseFloat(i.priceLBP) || 0), 0).toLocaleString()}
                        </span>
                      )}
                      {cartItems.some(i => i.priceUSD) && (
                        <span className="text-sm font-extrabold text-slate-800 font-cairo bg-white border border-slate-300 px-3 py-1 rounded-lg" dir="ltr">
                          المجموع USD: ${cartItems.reduce((s, i) => s + (parseFloat(i.priceUSD) || 0), 0).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-3 text-left">
                    <button onClick={() => setStep(3)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg shadow font-cairo text-sm">التالي ❯</button>
                  </div>
                </div>
              )}

              {/* Add New Item Form / Edit Item Form */}
              <div className={`border-t-2 pt-4 mt-2 ${
                editingItemId ? 'border-indigo-400 bg-indigo-50/40 rounded-xl p-4' : 'border-dashed border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-bold font-cairo ${
                    editingItemId ? 'text-indigo-700' : 'text-indigo-700'
                  }`}>
                    {editingItemId ? 'تعديل الصنف:' : 'إضافة صنف:'}
                  </h3>
                  {editingItemId && (
                    <button
                      onClick={handleCancelEdit}
                      className="text-xs font-bold text-gray-500 border border-gray-300 rounded px-2 py-1 hover:bg-gray-100 font-cairo"
                    >
                      ✕ إلغاء
                    </button>
                  )}
                </div>
                <OrderTypeSelector value={draftType} onChange={handleDraftTypeChange} />
                <BodyComponent data={draftBody} onChange={handleDraftBodyChange} />

                {/* Per-item price — Single currency toggle */}
                <div className="mt-4 max-w-sm mx-auto">
                  <label className="text-xs font-bold text-[#1a1a2e] font-cairo block text-center mb-1.5">
                    سعر الصنف <span className="text-[10px] font-normal text-gray-400">(اختياري)</span>
                  </label>
                  <div className={`flex bg-[#eceafa] border-2 rounded overflow-hidden focus-within:ring-1 transition-colors ${
                    priceError 
                      ? 'border-red-500 focus-within:border-red-600 focus-within:ring-red-500/30' 
                      : 'border-[#e2495c] focus-within:border-[#b01c2e] focus-within:ring-[#e2495c]/30'
                  }`}>
                    <select
                      value={draftCurrency}
                      onChange={handleCurrencyChange}
                      className={`border-none outline-none px-2 py-1.5 text-sm font-bold text-center cursor-pointer font-cairo focus:ring-0 ${
                        priceError ? 'bg-red-50 text-red-600' : 'bg-[#fcf8f9] text-[#e2495c]'
                      }`}
                      dir="ltr"
                    >
                      <option value="USD">USD $</option>
                      <option value="LBP">LBP</option>
                    </select>
                    <div className={`w-0.5 my-1 ${priceError ? 'bg-red-500/20' : 'bg-[#e2495c]/20'}`}></div>
                    <input
                      id="draftPriceInput"
                      type="text"
                      dir="ltr"
                      value={draftPrice}
                      onChange={handlePriceChange}
                      placeholder="0"
                      className={`bg-transparent border-none w-full px-3 py-1.5 text-sm font-bold font-cairo focus:outline-none focus:ring-0 ${
                        priceError ? 'text-red-700' : 'text-[#222]'
                      }`}
                    />
                  </div>
                  {priceError ? (
                    <p className="text-red-600 text-[10px] font-bold font-cairo text-center mt-1.5 animate-fadeIn">
                      {priceError}
                    </p>
                  ) : getConvertedPrice() ? (
                    <p className="text-indigo-600 text-[11px] font-bold font-cairo text-center mt-1.5 animate-fadeIn" dir="ltr">
                      {getConvertedPrice()}
                    </p>
                  ) : null}
                </div>
                <div className="mt-4 flex justify-center gap-3">
                  {editingItemId ? (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-lg shadow font-cairo active:scale-[0.97]"
                      >
                        حفظ التعديلات
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold py-2.5 px-4 rounded-lg font-cairo active:scale-[0.97] text-sm"
                      >
                        إلغاء
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleAddToCart}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-lg shadow font-cairo active:scale-[0.97]"
                    >
                      ➕ إضافة للسلة
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Review & Payment */}
          {step === 3 && (
            <div className="animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-extrabold text-[#1a1a2e] font-cairo">3. الدفع والحفظ</h2>
                <button onClick={() => setStep(2)} className="text-xs text-gray-500 underline font-cairo">إضافة أصناف أخرى</button>
              </div>

              {/* Cart Summary */}
              {(() => {
                const autoTotalLBP = cartItems.reduce((s, i) => s + (parseFloat(i.priceLBP) || 0), 0);
                const autoTotalUSD = cartItems.reduce((s, i) => s + (parseFloat(i.priceUSD) || 0), 0);
                const hasItemPrices = cartItems.some(i => i.priceLBP || i.priceUSD);
                const displayPrice = autoTotalLBP > 0 ? String(autoTotalLBP) : (footerData.price || '');
                return (
                  <>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4">
                      <h3 className="text-sm font-bold text-indigo-900 mb-1 font-cairo">ملخص الطلبية:</h3>
                      <p className="text-xs text-indigo-800 font-cairo mb-1">الزبون: {headerData.customerName} ({headerData.customerPhone})</p>
                      <div className="flex flex-col gap-1.5 mt-2">
                        {cartItems.map((item, idx) => (
                          <div key={item.id} className="flex items-center justify-between bg-white border border-indigo-100 rounded-lg px-2.5 py-1.5">
                            <span className="text-[11px] font-bold text-indigo-700 font-cairo">{idx + 1}. {ORDER_TYPE_LABELS[item.orderType]}</span>
                            <div className="flex items-center gap-1.5">
                              {item.priceLBP
                                ? <span className="text-[11px] font-bold text-[#e2495c]" dir="ltr">{Number(item.priceLBP).toLocaleString()} LBP</span>
                                : null
                              }
                              {item.priceUSD
                                ? <span className="text-[11px] font-bold text-emerald-700" dir="ltr">${Number(item.priceUSD).toLocaleString()} USD</span>
                                : null
                              }
                              {!item.priceLBP && !item.priceUSD && (
                                <span className="text-[10px] text-gray-400 font-cairo">بلا تسعير</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {hasItemPrices && (
                        <div className="mt-3 pt-2 border-t border-indigo-200 grid grid-cols-2 gap-2">
                          {autoTotalLBP > 0 && (
                            <div className="flex flex-col items-center bg-white border border-red-200 rounded-lg py-1.5 px-2">
                              <span className="text-[10px] text-gray-500 font-cairo">مجموع LBP</span>
                              <span className="text-sm font-extrabold text-[#e2495c]" dir="ltr">{autoTotalLBP.toLocaleString()}</span>
                            </div>
                          )}
                          {autoTotalUSD > 0 && (
                            <div className="flex flex-col items-center bg-white border border-emerald-200 rounded-lg py-1.5 px-2">
                              <span className="text-[10px] text-gray-500 font-cairo">مجموع USD</span>
                              <span className="text-sm font-extrabold text-emerald-700" dir="ltr">${autoTotalUSD.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* OrderFooter with auto-total */}
                    <OrderFooter
                      data={{ ...footerData, price: displayPrice }}
                      onChange={(field, value) => {
                        if (field === 'price' && autoTotalLBP > 0) return;
                        handleFooterChange(field, value);
                      }}
                      variant="showroom"
                      priceReadOnly={autoTotalLBP > 0}
                      priceReadOnlyNote={autoTotalLBP > 0 ? `مجموع LBP محتسب تلقائياً` : null}
                    />
                  </>
                );
              })()}

              {saveError && (
                <p className="text-[#e2495c] text-xs font-bold text-center mt-2 font-cairo">{saveError}</p>
              )}

              <div className="mt-4 pt-3 border-t border-gray-200 grid grid-cols-3 gap-3">
                <button
                  onClick={handleWhatsApp}
                  className="border-2 border-green-700 text-green-800 hover:bg-green-50 text-sm font-bold py-2.5 rounded-lg transition-colors font-cairo active:scale-[0.97] flex items-center justify-center gap-1.5"
                >
                  💬 واتساب
                </button>

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
                  {saving ? '⏳ الحفظ...' : isSaved && !isEditMode ? '📝 طلب جديد' : isEditMode ? '💾 حفظ التعديلات' : 'حفظ الطلبية الإجمالية'}
                </button>

                <button
                  onClick={handlePrint}
                  disabled={!isSaved}
                  className="border-2 border-[#1a1a2e] text-[#1a1a2e] text-sm font-bold py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-cairo active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  🖨️ طباعة
                </button>
              </div>

              {isSaved && (
                <div className="mt-4 flex justify-center">
                  <button onClick={handleNewSameCustomer} className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-400 rounded-lg px-4 py-2 hover:bg-blue-100 transition-colors font-cairo">
                    ➕ طلب جديد لنفس الزبون
                  </button>
                </div>
              )}

              {isSaved && (
                <p className={`text-xs font-bold text-center mt-3 font-cairo ${isEditMode ? 'text-amber-700' : 'text-green-700'}`}>
                  {isEditMode ? `✓ تم تحديث الطلبية — ${savedOrder?.id}` : `✓ تم حفظ الطلبية بنجاح — ${savedOrder?.id}`}
                </p>
              )}
            </div>
          )}

        </div>
      </div>
      
      <style>{`
        .animate-fadeIn {
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

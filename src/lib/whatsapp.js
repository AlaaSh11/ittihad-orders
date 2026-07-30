// ============================================================
// whatsapp.js — WhatsApp message builder
//
// Called from the "send whatsapp" button handler in OrderFormView.
// All message composition lives here so it can be tested/updated
// independently of the UI.
// ============================================================

/**
 * Format a date string (YYYY-MM-DD) to a readable Arabic format.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

/**
 * Build an order-type-specific body summary for the WhatsApp message.
 * @param {string} orderType
 * @param {Object} body
 * @returns {string}
 */
function buildBodySummary(orderType, body) {
  if (!body) return '';
  const lines = [];

  if (orderType === 'cake') {
    if (body.cakeShape)   lines.push(`الشكل: ${body.cakeShape}`);
    if (body.cakeType)    lines.push(`نوع القالب: ${body.cakeType}`);
    if (body.cakeFlavor)  lines.push(`النكهة: ${body.cakeFlavor}`);
    if (body.cakeFilling) lines.push(`الحشوة: ${body.cakeFilling}`);
    if (body.cakeSize)    lines.push(`القياس: ${body.cakeSize}`);
    if (body.serves)      lines.push(`عدد الأشخاص: ${body.serves}`);
    if (body.cakeColor)   lines.push(`لون القالب: ${body.cakeColor}`);
    if (body.inscription) lines.push(`الكتابة: ${body.inscription}`);
    if (body.photoSize)   lines.push(`حجم الصورة: ${body.photoSize}`);
    if (body.photoSource) lines.push(`مصدر الصورة: ${body.photoSource}`);
    if (body.notes)       lines.push(`ملاحظات: ${body.notes}`);
  } else if (orderType === 'chocolate') {
    if (body.chocolateType)    lines.push(`نوع الشوكولا: ${body.chocolateType}`);
    if (body.wrappingMethod)   lines.push(`طريقة التغليف: ${body.wrappingMethod}`);
    if (body.fillingType)      lines.push(`نوع الحشو: ${body.fillingType}`);
    if (body.quantity)         lines.push(`الكمية: ${body.quantity}`);
    if (body.specifications)   lines.push(`المواصفات: ${body.specifications}`);
    if (body.notes)            lines.push(`ملاحظات: ${body.notes}`);
  } else if (orderType === 'occasion') {
    if (body.hospitalityType)    lines.push(`نوع الضيافة: ${body.hospitalityType}`);
    if (body.quantity)           lines.push(`الكمية: ${body.quantity}`);
    if (body.wrappingMethod)     lines.push(`طريقة اللف: ${body.wrappingMethod}`);
    if (body.wrappingColor)      lines.push(`لون التغليف: ${body.wrappingColor}`);
    if (body.flowerColor)        lines.push(`لون الوردة: ${body.flowerColor}`);
    if (body.basketCount)        lines.push(`عدد السلال: ${body.basketCount}`);
    if (body.tissueCount)        lines.push(`عدد المحارم: ${body.tissueCount}`);
    if (body.napkinHolderCount)  lines.push(`عدد النوابيس: ${body.napkinHolderCount}`);
    if (body.wrappingPaperColor) lines.push(`لون ورق اللف: ${body.wrappingPaperColor}`);
    if (body.specifications)     lines.push(`المواصفات: ${body.specifications}`);
    if (body.notes)              lines.push(`ملاحظات: ${body.notes}`);
  } else if (orderType === 'simple') {
    if (body.itemName)  lines.push(`اسم الصنف: ${body.itemName}`);
    if (body.quantity)  lines.push(`الكمية: ${body.quantity}`);
    if (body.notes)     lines.push(`ملاحظات: ${body.notes}`);
  }

  return lines.join('\n');
}

/**
 * Build a wa.me URL with a pre-filled, URL-encoded order summary.
 *
 * @param {Object} order  Full order object per the data model (Section 8)
 * @returns {string}  Complete wa.me URL ready to open in a new tab
 */
export function buildWhatsAppUrl(order) {
  const { id, header, orderType, body, footer } = order;

  // Strip phone to digits only (wa.me requires no +, spaces, or dashes)
  const rawPhone = (header?.customerPhone ?? '').replace(/\D/g, '');

  const orderTypeLabel = {
    cake:      'طلب كيك',
    chocolate: 'طلب شوكولا',
    occasion:  'طلب مناسبة',
    simple:    'طلب بسيط',
  }[orderType] ?? orderType;

  const bodySummary = buildBodySummary(orderType, body);

  const lines = [
    `🎂 *تأكيد طلبية — ${orderTypeLabel}*`,
    '━━━━━━━━━━━━━━━━━',
    `📋 رقم الطلبية: ${id}`,
    `👤 اسم الزبون: ${header?.customerName || '—'}`,
    bodySummary,
    '━━━━━━━━━━━━━━━━━',
    `📅 تاريخ التسليم: ${formatDate(header?.deliveryDate)}`,
    `🕐 الوقت: ${header?.deliveryTime || '—'}`,
    `📍 التسليم: ${header?.deliveryMethod || '—'}`,
    `💰 السعر الإجمالي: $${footer?.price || '—'}`,
    footer?.depositPaid ? `💵 عربون مطلوب (يُدفع للصندوق): $${footer?.depositAmount || '0'}` : null,
    footer?.depositPaid ? `📋 المتبقي عند تسليم الطلبية: $${footer?.remaining || '0'}` : null,
    '━━━━━━━━━━━━━━━━━',
    'شكراً لطلبكم! 🙏',
  ];

  const message = lines.filter(Boolean).join('\n');
  const encoded = encodeURIComponent(message);

  if (rawPhone && rawPhone.length >= 6) {
    return `https://wa.me/${rawPhone}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

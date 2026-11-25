// Arabic labels for change-history entries (orders/{id}/history).

export const ACTION_LABELS = {
  create: 'إنشاء الطلبية',
  edit: 'تعديل الطلبية',
  update: 'تعديل',
  payment: 'تسجيل السداد الكامل',
  undo_payment: 'إلغاء تأكيد السداد',
  deposit: 'استلام العربون',
  undo_deposit: 'إلغاء استلام العربون',
  deposit_amount: 'تعديل قيمة العربون',
  price: 'تعديل السعر',
  cancel: 'إلغاء الطلبية',
  uncancel: 'استعادة الطلبية',
  production: 'تحديث حالة التحضير',
};

export const FIELD_LABELS = {
  'header.customerName': 'اسم الزبون',
  'header.customerPhone': 'رقم الزبون',
  'header.deliveryDate': 'تاريخ التسليم',
  'header.dayName': 'اليوم',
  'header.deliveryTime': 'الوقت',
  'header.deliveryMethod': 'التسليم',
  'header.deliveryAddress': 'العنوان',
  'header.recipient': 'المستلم',
  'footer.price': 'السعر',
  'footer.depositPaid': 'عربون مطلوب',
  'footer.depositAmount': 'قيمة العربون',
  'footer.remaining': 'المتبقي',
  items: 'عدد الأصناف',
  isPaid: 'مدفوعة',
  paidAt: 'وقت السداد',
  paidBy: 'سدّد لدى',
  finalPayment: 'المبلغ المستلم',
  depositCollected: 'العربون مُحصّل',
  depositCollectedAt: 'وقت استلام العربون',
  depositCollectedBy: 'استلم العربون',
  depositPayment: 'العربون المستلم',
  productionStatus: 'حالة التحضير',
  productionStatusUpdatedAt: 'وقت تحديث الحالة',
  productionStatusUpdatedBy: 'حدّث الحالة',
  isCancelled: 'ملغاة',
  cancelledReason: 'سبب الإلغاء',
  cancelledAt: 'وقت الإلغاء',
  cancelledBy: 'ألغاها',
  orderType: 'نوع الطلب (قديم)',
  body: 'تفاصيل (قديم)',
};

// Fields that only add noise when shown (timestamps / who, already in the entry itself).
export const HIDDEN_FIELDS = new Set([
  'paidAt', 'paidBy', 'depositCollectedAt', 'depositCollectedBy',
  'productionStatusUpdatedAt', 'productionStatusUpdatedBy', 'cancelledAt', 'cancelledBy',
]);

const VALUE_LABELS = {
  true: 'نعم',
  false: 'لا',
  received: 'مستلمة',
  in_progress: 'قيد التنفيذ',
  ready: 'جاهزة',
  delivered: 'تم التسليم',
};

/** Make a stored history value readable. */
export function formatHistoryValue(field, value) {
  if (value === '' || value === undefined || value === null) return '—';
  if (VALUE_LABELS[value]) return VALUE_LABELS[value];
  if (field === 'finalPayment' || field === 'depositPayment') {
    try {
      const p = JSON.parse(value);
      const parts = [];
      if (p.usd) parts.push(`$${Number(p.usd).toLocaleString('en-US')}`);
      if (p.lbp) parts.push(`${Number(p.lbp).toLocaleString('en-US')} L.L`);
      return parts.join(' + ') || '—';
    } catch {
      return value;
    }
  }
  return value;
}

/** "25/11/2026 14:20" from a history entry (server time, else device time). */
export function formatHistoryTime(entry) {
  const d = entry.at?.toDate ? entry.at.toDate() : new Date(entry.clientAt);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

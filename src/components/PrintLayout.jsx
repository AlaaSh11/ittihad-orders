/**
 * PrintLayout — A5 compact print output
 *
 * Architecture: This component renders its own self-contained compact DOM
 * using inline mm-based styles. It does NOT reuse the screen components
 * (OrderHeader, CakeOrderBody, etc.) because:
 *   1. Those components use Tailwind gap/padding sized for touch targets.
 *   2. @media print CSS overrides on flex/grid layouts behave
 *      inconsistently across iOS Safari and Android Chrome print dialogs.
 *   3. Absolute mm values on print elements are honoured by all major
 *      mobile browser print implementations.
 *
 * Two pages rendered sequentially:
 *   Page 1: Showroom copy — all fields including price/deposit/remaining
 *   Page 2: Factory copy — all fields EXCEPT footer (replaced with a
 *            blank dashed box of identical dimensions for handwritten sketches)
 *
 * Page size: A5 (148mm × 210mm), margin: 8mm → usable 132mm × 194mm
 */

// ── Helper: render a single compact field box ─────────────────────────────────

function PField({ label, value = '', dir = 'rtl', isTextarea = false }) {
  const cls = isTextarea ? 'pf-textarea' : 'pf-input';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span className="pf-label">{label}</span>
      {isTextarea ? (
        <div
          className={cls}
          dir={dir}
          style={{ overflow: 'hidden', wordBreak: 'break-word' }}
        >
          {value}
        </div>
      ) : (
        <div className={cls} dir={dir}>{value}</div>
      )}
    </div>
  );
}

// ── Helper: 2-column field row ───────────────────────────────────────────────

function Row2({ left, right }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2mm', marginBottom: '1.5mm' }}>
      {left}
      {right}
    </div>
  );
}

// ── Helper: 3-column field row ───────────────────────────────────────────────

function Row3({ cols }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2mm', marginBottom: '1.5mm' }}>
      {cols.map((c, i) => <div key={i}>{c}</div>)}
    </div>
  );
}

// ── Compact header section ───────────────────────────────────────────────────

function PrintHeader({ id, header, createdAt }) {
  const displayDate = (() => {
    const d = createdAt ? new Date(createdAt) : new Date();
    const validDate = isNaN(d.getTime()) ? new Date() : d;
    return `${String(validDate.getDate()).padStart(2,'0')}/${String(validDate.getMonth()+1).padStart(2,'0')}/${validDate.getFullYear()}`;
  })();

  return (
    <div style={{ marginBottom: '2mm' }}>
      {/* Title row */}
      <div style={{ display: 'grid', gridTemplateColumns: '28mm 1fr 28mm', gap: '2mm', alignItems: 'flex-start', marginBottom: '1.5mm' }}>
        {/* Date — left */}
        <div>
          <span className="pf-label">التاريخ</span>
          <div className="pf-input" dir="ltr">{displayDate}</div>
        </div>
        {/* Title + order ID — center */}
        <div style={{ textAlign: 'center' }}>
          <div className="pf-main-title">طلبية قالب كايك</div>
          <div className="pf-order-id">{id}</div>
        </div>
        {/* Spacer right */}
        <div />
      </div>

      {/* Customer: phone + name */}
      <Row2
        left={<PField label="رقم الزبون" value={header?.customerPhone} dir="ltr" />}
        right={<PField label="اسم الزبون" value={header?.customerName} />}
      />

      {/* Delivery: day + date + time */}
      <Row3
        cols={[
          <PField label="اليوم" value={header?.dayName} />,
          <PField label="تاريخ تسليم الطلبية" value={header?.deliveryDate} dir="ltr" />,
          <PField label="الوقت" value={header?.deliveryTime} />,
        ]}
      />

      {/* Branch + Recipient */}
      <Row2
        left={<PField label="التسليم" value={header?.deliveryMethod} />}
        right={<PField label="مستلم الطلبية" value={header?.recipient} />}
      />
    </div>
  );
}

// ── Compact body: Cake ───────────────────────────────────────────────────────

function PrintCakeBody({ body }) {
  return (
    <div style={{ marginBottom: '1mm' }}>
      <Row2
        left={<PField label="الشكل" value={body?.cakeShape} />}
        right={<PField label="نوع القالب" value={body?.cakeType} />}
      />
      <Row2
        left={<PField label="النكهة" value={body?.cakeFlavor} />}
        right={<PField label="الحشوة" value={body?.cakeFilling} />}
      />
      <Row2
        left={<PField label="القياس" value={body?.cakeSize} dir="ltr" />}
        right={<PField label="عدد الأشخاص" value={body?.serves} dir="ltr" />}
      />
      <Row2
        left={<PField label="لون القالب" value={body?.cakeColor} />}
        right={<PField label="الكتابة على" value={body?.writeOn} />}
      />
      <Row2
        left={<PField label="حجم الصورة" value={body?.photoSize} />}
        right={<PField label="مصدر الصورة" value={body?.photoSource} />}
      />
      {/* Inscription — full width */}
      <div style={{ marginBottom: '1.5mm' }}>
        <PField label="الكتابة" value={body?.inscription} />
      </div>
      {/* Notes — textarea */}
      <div style={{ marginBottom: '1.5mm' }}>
        <PField label="ملاحظات" value={body?.notes} isTextarea />
      </div>
    </div>
  );
}

// ── Compact body: Chocolate (UNCONFIRMED) ────────────────────────────────────

function PrintChocolateBody({ body }) {
  return (
    <div style={{ marginBottom: '1mm' }}>
      <Row2
        left={<PField label="نوع الشوكولا" value={body?.chocolateType} />}
        right={<PField label="طريقة التغليف" value={body?.wrappingMethod} />}
      />
      <Row2
        left={<PField label="نوع الحشو" value={body?.fillingType} />}
        right={<PField label="الكمية" value={body?.quantity} dir="ltr" />}
      />
      <div style={{ marginBottom: '1.5mm' }}>
        <PField label="المواصفات" value={body?.specifications} isTextarea />
      </div>
      <div style={{ marginBottom: '1.5mm' }}>
        <PField label="ملاحظات" value={body?.notes} isTextarea />
      </div>
    </div>
  );
}

// ── Compact body: Occasion (UNCONFIRMED) ─────────────────────────────────────

function PrintOccasionBody({ body }) {
  return (
    <div style={{ marginBottom: '1mm' }}>
      <Row2
        left={<PField label="نوع الضيافة" value={body?.hospitalityType} />}
        right={<PField label="الكمية" value={body?.quantity} dir="ltr" />}
      />
      <Row2
        left={<PField label="طريقة اللف" value={body?.wrappingMethod} />}
        right={<PField label="لون التغليف" value={body?.wrappingColor} />}
      />
      <Row2
        left={<PField label="لون الوردة" value={body?.flowerColor} />}
        right={<PField label="عدد السلال" value={body?.basketCount} />}
      />
      <Row2
        left={<PField label="عدد المحارم" value={body?.tissueCount} dir="ltr" />}
        right={<PField label="عدد النوابيس" value={body?.napkinHolderCount} dir="ltr" />}
      />
      <div style={{ marginBottom: '1.5mm' }}>
        <PField label="لون ورق اللف" value={body?.wrappingPaperColor} />
      </div>
      <div style={{ marginBottom: '1.5mm' }}>
        <PField label="المواصفات" value={body?.specifications} isTextarea />
      </div>
      <div style={{ marginBottom: '1.5mm' }}>
        <PField label="ملاحظات" value={body?.notes} isTextarea />
      </div>
    </div>
  );
}

// ── Compact body: Simple (UNCONFIRMED) ──────────────────────────────────────

function PrintSimpleBody({ body }) {
  return (
    <div style={{ marginBottom: '1mm' }}>
      <div style={{ marginBottom: '1.5mm' }}>
        <PField label="اسم الصنف" value={body?.itemName} />
      </div>
      <div style={{ marginBottom: '1.5mm' }}>
        <PField label="الكمية" value={body?.quantity} dir="ltr" />
      </div>
      <div style={{ marginBottom: '1.5mm' }}>
        <PField label="ملاحظات" value={body?.notes} isTextarea />
      </div>
    </div>
  );
}

// ── Compact footer: showroom ─────────────────────────────────────────────────

function PrintFooterShowroom({ footer }) {
  const depositLabel = footer?.depositPaid
    ? `✓ عربون مطلوب — ${footer?.depositAmount || ''}`
    : '☐ عربون مطلوب';

  return (
    <div style={{ borderTop: '1px solid #ccc', paddingTop: '2mm', marginTop: '1mm' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '3mm', alignItems: 'flex-end' }}>
        <PField label="السعر الإجمالي" value={footer?.price} dir="ltr" />
        {/* Deposit checkbox display */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '1mm' }}>
          <span className="pf-label" style={{ fontWeight: 'bold' }}>{depositLabel}</span>
          {footer?.depositPaid && footer?.depositAmount && (
            <div className="pf-input" dir="ltr" style={{ width: '22mm', textAlign: 'center', fontWeight: 'bold' }}>
              ${footer.depositAmount}
            </div>
          )}
        </div>
        <div>
          <PField label="المتبقي (عند التسليم لدى الكاشير)" value={footer?.remaining} dir="ltr" />
        </div>
      </div>
      {footer?.depositPaid && (
        <div style={{ marginTop: '2mm', padding: '1.5mm', border: '1px solid #d97706', backgroundColor: '#fffbeb', borderRadius: '4px', fontSize: '7.5pt', color: '#78350f', textAlign: 'center', fontWeight: 'bold' }}>
          ℹ️ تنويه: يرجى التوجه إلى الصندوق (الكاشير) لتسديد العربون المُقَرَّر (${footer?.depositAmount || '0'}) وتأكيد تثبيت الطلبية. المبلغ المتبقي عند التسليم النهائي: ${footer?.remaining || '0'}.
        </div>
      )}
    </div>
  );
}

// ── Compact footer: factory (blank sketch box) ───────────────────────────────

function PrintFooterFactory() {
  return (
    <div style={{ borderTop: '1px solid #ccc', paddingTop: '2mm', marginTop: '1mm' }}>
      {/* Blank dashed box — same height as showroom footer, for handwritten sketches */}
      <div className="pf-factory-box" aria-label="مساحة رسم للمصنع" />
    </div>
  );
}

// ── Body component map ────────────────────────────────────────────────────────

const PRINT_BODY_MAP = {
  cake:      PrintCakeBody,
  chocolate: PrintChocolateBody,
  occasion:  PrintOccasionBody,
  simple:    PrintSimpleBody,
};

const ORDER_TYPE_LABELS = {
  cake:      'طلب كيك',
  chocolate: 'طلب شوكولا',
  occasion:  'طلب مناسبة',
  simple:    'طلب بسيط',
};

// ── Single print page ────────────────────────────────────────────────────────

function PrintPage({ order, variant }) {
  const { id, header, orderType, body, footer } = order;
  const PrintBody = PRINT_BODY_MAP[orderType] || PrintCakeBody;
  const isFactory = variant === 'factory';

  return (
    <section
      className={`print-page ${isFactory ? 'print-page-break' : ''}`}
      dir="rtl"
      style={{
        /* Explicit A5 usable dimensions — guarantees correct sizing on
           iOS Safari and Android Chrome which may not apply @page to
           the element layout in the same way as desktop browsers.
           132mm wide (148 - 2×8mm margins), auto height → fills page. */
        width: '132mm',
        minHeight: '194mm',
        background: '#fff',
        fontFamily: "'Cairo', Arial, sans-serif",
        fontSize: '8pt',
        color: '#000',
        padding: 0,
        margin: '0 auto',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Copy watermark */}
      <div className="pf-copy-label">
        {isFactory ? '[ نسخة المصنع ]' : '[ نسخة الشوروم ]'}
      </div>

      {/* Header */}
      <PrintHeader id={id} header={header} createdAt={order?.createdAt} />

      {/* Divider */}
      <div style={{ borderTop: '0.5px solid #ccc', marginBottom: '1.5mm' }} />

      {/* Order type label */}
      <div className="pf-section-title">{ORDER_TYPE_LABELS[orderType]}</div>

      {/* Body */}
      <PrintBody body={body} />

      {/* Footer */}
      {isFactory
        ? <PrintFooterFactory />
        : <PrintFooterShowroom footer={footer} />
      }
    </section>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * PrintLayout renders two A5 pages when window.print() is triggered.
 * Hidden on screen; shown only via @media print.
 *
 * Props:
 *   order       {Object|null}  Saved order object — null = render nothing
 *   currentUser {Object}       Not used in print DOM (kept for API consistency)
 */
export default function PrintLayout({ order }) {
  if (!order) return null;

  return (
    <div className="print-container" style={{ display: 'none' }}>
      <PrintPage order={order} variant="showroom" />
      <PrintPage order={order} variant="factory" />
    </div>
  );
}

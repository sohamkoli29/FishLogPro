import * as Print   from 'expo-print';
import * as Sharing from 'expo-sharing';

// ── Types ──────────────────────────────────────────────────────
export interface BillItem {
  fishName:     string;
  quantity:     number;
  unit:         string;
  pricePerUnit: number;
  totalPrice:   number;
}

export interface SingleBillPage {
  billNumber:   string;
  date:         string;
  items:        BillItem[];
  totalAmount:  number;
  totalPaid:    number;
  balance:      number;
  payments:     { date: string; amount: number; mode: string }[];
}

export interface PurchaseBillData {
  type:          'purchase';
  businessName:  string;
  fishermanName: string;
  boatName:      string;
  phone?:        string;
  pages:         SingleBillPage[];   // one page per entry
}

export interface SalesBillData {
  type:         'sales';
  businessName: string;
  buyerName:    string;
  buyerType:    string;
  phone?:       string;
  pages:        SingleBillPage[];    // one page per order
}

export type BillData = PurchaseBillData | SalesBillData;

// ── Format helpers ─────────────────────────────────────────────
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${dd} ${months[parseInt(mm) - 1]} ${yyyy}`;
}

function fmt(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits:  2,
    maximumFractionDigits:  2,
  })}`;
}

// ── CSS shared across all pages ────────────────────────────────
function getCSS(accentColor: string): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      background: #ffffff;
      color: #1b1c19;
      font-size: 13px;
      line-height: 1.5;
    }

    /* Each .page is one physical page */
    .page {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      padding: 36px 40px 40px 40px;
      page-break-after: always;
      page-break-inside: avoid;
      min-height: 100vh;
      position: relative;
    }
    .page:last-child {
      page-break-after: auto;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 2.5px solid ${accentColor};
    }
    .brand-name {
      font-size: 20px;
      font-weight: 800;
      color: ${accentColor};
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 10px;
      color: #737874;
      letter-spacing: 0.5px;
      margin-top: 2px;
      text-transform: uppercase;
    }
    .bill-meta { text-align: right; }
    .bill-type {
      font-size: 16px;
      font-weight: 800;
      color: #1b1c19;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .bill-number {
      font-size: 12px;
      color: #737874;
      margin-top: 2px;
    }
    .bill-date {
      font-size: 13px;
      font-weight: 600;
      color: #1b1c19;
      margin-top: 4px;
    }

    /* Party */
    .party-section {
      background: #f5f3ee;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .party-left {}
    .party-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #737874;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .party-name {
      font-size: 16px;
      font-weight: 700;
      color: #1b1c19;
    }
    .party-sub {
      font-size: 12px;
      color: #737874;
      margin-top: 2px;
    }
    .page-badge {
      background: ${accentColor};
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 99px;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    /* Section title */
    .section-title {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #737874;
      margin-bottom: 6px;
      text-transform: uppercase;
    }

    /* Items table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    thead tr { background: ${accentColor}; }
    th {
      color: #ffffff;
      padding: 9px 10px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .th-left   { text-align: left;   }
    .th-center { text-align: center; }
    .th-right  { text-align: right;  }
    td { padding: 9px 10px; font-size: 13px; }
    .td-left   { text-align: left;   }
    .td-center { text-align: center; }
    .td-right  { text-align: right;  }
    .row-even  { background: #ffffff; }
    .row-odd   { background: #f9f8f5; }
    .row-total {
      background: #f0eee9;
      font-weight: 700;
    }
    .bold  { font-weight: 700; }
    .green { color: #16a34a; font-weight: 700; }
    .red   { color: #ba1a1a; font-weight: 700; }
    .muted { color: #737874; font-style: italic; }

    /* Totals box */
    .totals-box {
      background: #f5f3ee;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 16px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }
    .totals-label  { font-size: 13px; color: #737874; }
    .totals-value  { font-size: 13px; font-weight: 600; color: #1b1c19; }
    .totals-divider {
      border: none;
      border-top: 1px solid #c2c8c2;
      margin: 8px 0;
    }
    .totals-grand-label {
      font-size: 15px;
      font-weight: 700;
      color: #1b1c19;
    }
    .totals-grand-value {
      font-size: 17px;
      font-weight: 800;
    }

    /* Footer */
    .footer {
      position: absolute;
      bottom: 24px;
      left: 40px;
      right: 40px;
      border-top: 1px solid #e4e2dd;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left {
      font-size: 10px;
      color: #737874;
    }
    .footer-brand {
      font-size: 10px;
      font-weight: 700;
      color: ${accentColor};
    }

    @media print {
      .page { page-break-after: always; min-height: auto; }
      .page:last-child { page-break-after: auto; }
    }
  `;
}

// ── Single page HTML ───────────────────────────────────────────
function renderPage(
  data:        BillData,
  page:        SingleBillPage,
  pageIndex:   number,
  totalPages:  number,
  accentColor: string
): string {
  const isPurchase = data.type === 'purchase';

  // Party header
  const partyHTML = isPurchase
    ? `
      <div class="party-left">
        <p class="party-label">Fisherman</p>
        <p class="party-name">${(data as PurchaseBillData).fishermanName}</p>
        <p class="party-sub">⛵ ${(data as PurchaseBillData).boatName}</p>
        ${data.phone ? `<p class="party-sub">📞 ${data.phone}</p>` : ''}
      </div>`
    : `
      <div class="party-left">
        <p class="party-label">Buyer</p>
        <p class="party-name">${(data as SalesBillData).buyerName}</p>
        <p class="party-sub">${(data as SalesBillData).buyerType.charAt(0).toUpperCase() + (data as SalesBillData).buyerType.slice(1)}</p>
        ${data.phone ? `<p class="party-sub">📞 ${data.phone}</p>` : ''}
      </div>`;

  // Items
  const itemRowsHTML = page.items.map((item, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td class="td-left">${item.fishName}</td>
      <td class="td-center">${item.quantity}</td>
      <td class="td-center">${item.unit}</td>
      <td class="td-right">${fmt(item.pricePerUnit)}</td>
      <td class="td-right bold">${fmt(item.totalPrice)}</td>
    </tr>`
  ).join('');

  // Total row in items table
  const totalRowHTML = `
    <tr class="row-total">
      <td class="td-left bold" colspan="4">Total</td>
      <td class="td-right bold">${fmt(page.totalAmount)}</td>
    </tr>`;

  // Payments
  const paymentRowsHTML = page.payments.length > 0
    ? page.payments.map((p) => `
      <tr class="row-even">
        <td class="td-left">${formatDate(p.date)}</td>
        <td class="td-center">${p.mode.charAt(0).toUpperCase() + p.mode.slice(1)}</td>
        <td class="td-right green">+${fmt(p.amount)}</td>
      </tr>`
    ).join('')
    : `<tr><td colspan="3" class="td-center muted" style="padding:12px">No payments recorded</td></tr>`;

  const balanceColor  = page.balance <= 0 ? '#16a34a' : '#ba1a1a';
  const balanceText   = page.balance <= 0
    ? '✓ FULLY CLEARED'
    : fmt(page.balance);

  return `
  <div class="page">

    <!-- Header -->
    <div class="header">
      <div>
        <div class="brand-name">${data.businessName}</div>
        <div class="brand-sub">FishLog Pro • Verified Document</div>
      </div>
      <div class="bill-meta">
        <div class="bill-type">${isPurchase ? 'Purchase Bill' : 'Sales Invoice'}</div>
        <div class="bill-number">#${page.billNumber}</div>
        <div class="bill-date">${formatDate(page.date)}</div>
      </div>
    </div>

    <!-- Party + Page badge -->
    <div class="party-section">
      ${partyHTML}
      <div>
        <span class="page-badge">
          ${isPurchase ? 'Entry' : 'Order'} ${pageIndex + 1} of ${totalPages}
        </span>
      </div>
    </div>

    <!-- Items table -->
    <p class="section-title">Catch / Items</p>
    <table>
      <thead>
        <tr>
          <th class="th-left">Species</th>
          <th class="th-center">Qty</th>
          <th class="th-center">Unit</th>
          <th class="th-right">Rate</th>
          <th class="th-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRowsHTML}
        ${totalRowHTML}
      </tbody>
    </table>

    <!-- Totals box -->
    <div class="totals-box">
      <div class="totals-row">
        <span class="totals-label">Gross Amount</span>
        <span class="totals-value">${fmt(page.totalAmount)}</span>
      </div>
      <div class="totals-row">
        <span class="totals-label">${isPurchase ? 'Amount Paid' : 'Amount Received'}</span>
        <span class="totals-value green">${fmt(page.totalPaid)}</span>
      </div>
      <hr class="totals-divider"/>
      <div class="totals-row">
        <span class="totals-grand-label">Balance Due</span>
        <span class="totals-grand-value" style="color:${balanceColor}">
          ${balanceText}
        </span>
      </div>
    </div>

    <!-- Payment history -->
    <p class="section-title">Payment History</p>
    <table>
      <thead>
        <tr>
          <th class="th-left">Date</th>
          <th class="th-center">Mode</th>
          <th class="th-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRowsHTML}
      </tbody>
    </table>

    <!-- Footer -->
    <div class="footer">
      <span class="footer-left">
        Generated ${new Date().toLocaleString('en-IN')}
        &nbsp;•&nbsp; Page ${pageIndex + 1} of ${totalPages}
      </span>
      <span class="footer-brand">FishLog Pro</span>
    </div>

  </div>`;
}

// ── Build full multi-page HTML ─────────────────────────────────
function generateHTML(data: BillData): string {
  const isPurchase  = data.type === 'purchase';
  const accentColor = isPurchase ? '#4d6055' : '#4e6073';
  const totalPages  = data.pages.length;

  const pagesHTML = data.pages
    .map((page, i) => renderPage(data, page, i, totalPages, accentColor))
    .join('\n');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>${getCSS(accentColor)}</style>
</head>
<body>
  ${pagesHTML}
</body>
</html>`;
}

// ── Generate + Share PDF ───────────────────────────────────────
export async function generateAndShareBill(data: BillData): Promise<void> {
  if (data.pages.length === 0) {
    throw new Error('No entries selected to generate a bill.');
  }

  const html = generateHTML(data);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  const party = data.type === 'purchase'
    ? (data as PurchaseBillData).fishermanName
    : (data as SalesBillData).buyerName;

  await Sharing.shareAsync(uri, {
    mimeType:    'application/pdf',
    dialogTitle: `${data.type === 'purchase' ? 'Purchase Bill' : 'Sales Invoice'} — ${party}`,
    UTI:         'com.adobe.pdf',
  });
}

// ── Print directly ─────────────────────────────────────────────
export async function printBill(data: BillData): Promise<void> {
  if (data.pages.length === 0) {
    throw new Error('No entries selected to print.');
  }
  const html = generateHTML(data);
  await Print.printAsync({ html });
}
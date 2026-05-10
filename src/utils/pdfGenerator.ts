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

export interface PurchaseBillData {
  type:          'purchase';
  billNumber:    string;
  date:          string;
  businessName:  string;
  fishermanName: string;
  boatName:      string;
  phone?:        string;
  items:         BillItem[];
  totalAmount:   number;
  totalPaid:     number;
  balance:       number;
  payments:      { date: string; amount: number; mode: string }[];
}

export interface SalesBillData {
  type:         'sales';
  billNumber:   string;
  date:         string;
  businessName: string;
  buyerName:    string;
  buyerType:    string;
  phone?:       string;
  status:       string;
  items:        BillItem[];
  totalAmount:  number;
  totalPaid:    number;
  balance:      number;
  payments:     { date: string; amount: number; mode: string }[];
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── HTML Bill Template ─────────────────────────────────────────
function generateHTML(data: BillData): string {
  const isPurchase = data.type === 'purchase';

  const partySection = isPurchase
    ? `
      <div class="party">
        <p class="party-label">FISHERMAN</p>
        <p class="party-name">${(data as PurchaseBillData).fishermanName}</p>
        <p class="party-sub">⛵ ${(data as PurchaseBillData).boatName}</p>
        ${data.phone ? `<p class="party-sub">📞 ${data.phone}</p>` : ''}
      </div>`
    : `
      <div class="party">
        <p class="party-label">BUYER</p>
        <p class="party-name">${(data as SalesBillData).buyerName}</p>
        <p class="party-sub">${(data as SalesBillData).buyerType.charAt(0).toUpperCase() + (data as SalesBillData).buyerType.slice(1)}</p>
        ${data.phone ? `<p class="party-sub">📞 ${data.phone}</p>` : ''}
      </div>`;

  const itemRows = data.items.map((item, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td class="td-left">${item.fishName}</td>
      <td class="td-center">${item.quantity} ${item.unit}</td>
      <td class="td-right">${fmt(item.pricePerUnit)}</td>
      <td class="td-right bold">${fmt(item.totalPrice)}</td>
    </tr>`
  ).join('');

  const paymentRows = data.payments.length > 0
    ? data.payments.map((p) => `
      <tr>
        <td class="td-left">${formatDate(p.date)}</td>
        <td class="td-center">${p.mode.charAt(0).toUpperCase() + p.mode.slice(1)}</td>
        <td class="td-right green">${fmt(p.amount)}</td>
      </tr>`
    ).join('')
    : '<tr><td colspan="3" class="td-center muted">No payments recorded</td></tr>';

  const accentColor = isPurchase ? '#4d6055' : '#4e6073';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      background: #fbf9f4;
      color: #1b1c19;
      font-size: 13px;
      line-height: 1.5;
    }
    .page {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      min-height: 100vh;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 2px solid ${accentColor};
    }
    .brand-name {
      font-size: 22px;
      font-weight: 800;
      color: ${accentColor};
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 11px;
      color: #737874;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .bill-meta {
      text-align: right;
    }
    .bill-type {
      font-size: 18px;
      font-weight: 700;
      color: #1b1c19;
    }
    .bill-number {
      font-size: 12px;
      color: #737874;
      margin-top: 2px;
    }
    .bill-date {
      font-size: 12px;
      color: #737874;
    }

    /* Party */
    .party-section {
      background: #f5f3ee;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .party-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #737874;
      margin-bottom: 6px;
    }
    .party-name {
      font-size: 17px;
      font-weight: 700;
      color: #1b1c19;
    }
    .party-sub {
      font-size: 12px;
      color: #737874;
      margin-top: 2px;
    }

    /* Table */
    .section-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #737874;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    thead tr {
      background: ${accentColor};
      color: #ffffff;
    }
    th {
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .th-left   { text-align: left;   }
    .th-center { text-align: center; }
    .th-right  { text-align: right;  }
    td { padding: 10px 12px; }
    .td-left   { text-align: left;   }
    .td-center { text-align: center; }
    .td-right  { text-align: right;  }
    .row-even  { background: #ffffff; }
    .row-odd   { background: #f9f8f5; }
    .bold      { font-weight: 700;    }
    .green     { color: #16a34a; font-weight: 700; }
    .muted     { color: #737874; }

    /* Total box */
    .totals {
      background: #f5f3ee;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
    }
    .total-label { font-size: 13px; color: #737874; }
    .total-value { font-size: 13px; font-weight: 600; }
    .divider {
      border: none;
      border-top: 1px solid #c2c8c2;
      margin: 8px 0;
    }
    .grand-total-label {
      font-size: 15px;
      font-weight: 700;
      color: #1b1c19;
    }
    .grand-total-value {
      font-size: 18px;
      font-weight: 800;
      color: ${accentColor};
    }
    .balance-value {
      font-size: 15px;
      font-weight: 700;
      color: ${data.balance > 0 ? '#ba1a1a' : '#16a34a'};
    }

    /* Status badge */
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      background: #d2e8da;
      color: #0d1f17;
      margin-bottom: 24px;
    }

    /* Footer */
    .footer {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #c2c8c2;
      text-align: center;
      color: #737874;
      font-size: 11px;
    }
    .footer-brand {
      font-weight: 700;
      color: ${accentColor};
      font-size: 13px;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand-name">${data.businessName}</div>
      <div class="brand-sub">FISHLOG PRO • VERIFIED DOCUMENT</div>
    </div>
    <div class="bill-meta">
      <div class="bill-type">${isPurchase ? 'PURCHASE BILL' : 'SALES INVOICE'}</div>
      <div class="bill-number">#${data.billNumber}</div>
      <div class="bill-date">${formatDate(data.date)}</div>
    </div>
  </div>

  <!-- Party -->
  <p class="section-title">${isPurchase ? 'Fisherman Details' : 'Buyer Details'}</p>
  ${partySection}

  <!-- Items table -->
  <p class="section-title">Items</p>
  <table>
    <thead>
      <tr>
        <th class="th-left">Species</th>
        <th class="th-center">Qty</th>
        <th class="th-right">Rate</th>
        <th class="th-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="total-row">
      <span class="total-label">Subtotal</span>
      <span class="total-value">${fmt(data.totalAmount)}</span>
    </div>
    <div class="total-row">
      <span class="total-label">${isPurchase ? 'Amount Paid' : 'Amount Received'}</span>
      <span class="total-value green">${fmt(data.totalPaid)}</span>
    </div>
    <hr class="divider"/>
    <div class="total-row">
      <span class="grand-total-label">Balance Due</span>
      <span class="balance-value">
        ${data.balance <= 0 ? '✓ CLEARED' : fmt(data.balance)}
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
      ${paymentRows}
    </tbody>
  </table>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-brand">FishLog Pro</div>
    <div>This is a computer-generated document.</div>
    <div>Generated on ${new Date().toLocaleString('en-IN')}</div>
  </div>

</div>
</body>
</html>`;
}

// ── Generate and share PDF ─────────────────────────────────────
export async function generateAndShareBill(data: BillData): Promise<void> {
  const html = generateHTML(data);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  const fileName = `${data.type === 'purchase' ? 'purchase-bill' : 'sales-invoice'}-${data.billNumber}.pdf`;

  await Sharing.shareAsync(uri, {
    mimeType:    'application/pdf',
    dialogTitle: `Share ${data.type === 'purchase' ? 'Purchase Bill' : 'Sales Invoice'}`,
    UTI:         'com.adobe.pdf',
  });
}

// ── Print directly ─────────────────────────────────────────────
export async function printBill(data: BillData): Promise<void> {
  const html = generateHTML(data);
  await Print.printAsync({ html });
}
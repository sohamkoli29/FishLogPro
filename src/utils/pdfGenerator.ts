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
  pages:         SingleBillPage[];
}

export interface SalesBillData {
  type:         'sales';
  businessName: string;
  buyerName:    string;
  buyerType:    string;
  phone?:       string;
  pages:        SingleBillPage[];
}

// Multi-party: array of purchase bills
export interface MultiPurchaseBillData {
  type:         'multi-purchase';
  businessName: string;
  parties:      PurchaseBillData[];
}

// Multi-party: array of sales bills
export interface MultiSalesBillData {
  type:         'multi-sales';
  businessName: string;
  parties:      SalesBillData[];
}

// Combined register report: mix of purchase + sales per entity
export interface RegisterReportParty {
  entityType:   'fisherman' | 'buyer';
  name:         string;
  subLabel:     string;  // boat name or buyer type
  phone?:       string;
  purchasePages?: SingleBillPage[];
  salesPages?:    SingleBillPage[];
}

export interface RegisterReportData {
  type:         'register';
  businessName: string;
  reportType:   'purchase' | 'sales' | 'both';
  parties:      RegisterReportParty[];
}

export type BillData =
  | PurchaseBillData
  | SalesBillData
  | MultiPurchaseBillData
  | MultiSalesBillData
  | RegisterReportData;

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

// ── CSS ────────────────────────────────────────────────────────
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
    .page:last-child { page-break-after: auto; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 2.5px solid ${accentColor};
    }
    .brand-name { font-size: 20px; font-weight: 800; color: ${accentColor}; letter-spacing: -0.5px; }
    .brand-sub { font-size: 10px; color: #737874; letter-spacing: 0.5px; margin-top: 2px; text-transform: uppercase; }
    .bill-meta { text-align: right; }
    .bill-type { font-size: 16px; font-weight: 800; color: #1b1c19; text-transform: uppercase; letter-spacing: 0.5px; }
    .bill-number { font-size: 12px; color: #737874; margin-top: 2px; }
    .bill-date { font-size: 13px; font-weight: 600; color: #1b1c19; margin-top: 4px; }
    .party-section {
      background: #f5f3ee;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .party-label { font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #737874; margin-bottom: 4px; text-transform: uppercase; }
    .party-name { font-size: 16px; font-weight: 700; color: #1b1c19; }
    .party-sub { font-size: 12px; color: #737874; margin-top: 2px; }
    .page-badge { background: ${accentColor}; color: #ffffff; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 99px; letter-spacing: 0.5px; white-space: nowrap; }
    .section-title { font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #737874; margin-bottom: 6px; text-transform: uppercase; }
    .section-divider { border: none; border-top: 2px solid ${accentColor}; margin: 28px 0 20px; opacity: 0.2; }
    .party-heading { font-size: 15px; font-weight: 800; color: ${accentColor}; margin-bottom: 4px; }
    .party-heading-sub { font-size: 12px; color: #737874; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead tr { background: ${accentColor}; }
    th { color: #ffffff; padding: 9px 10px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
    .th-left { text-align: left; } .th-center { text-align: center; } .th-right { text-align: right; }
    td { padding: 9px 10px; font-size: 13px; }
    .td-left { text-align: left; } .td-center { text-align: center; } .td-right { text-align: right; }
    .row-even { background: #ffffff; } .row-odd { background: #f9f8f5; }
    .row-total { background: #f0eee9; font-weight: 700; }
    .bold { font-weight: 700; } .green { color: #16a34a; font-weight: 700; } .red { color: #ba1a1a; font-weight: 700; } .muted { color: #737874; font-style: italic; }
    .totals-box { background: #f5f3ee; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; }
    .totals-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
    .totals-label { font-size: 13px; color: #737874; }
    .totals-value { font-size: 13px; font-weight: 600; color: #1b1c19; }
    .totals-divider { border: none; border-top: 1px solid #c2c8c2; margin: 8px 0; }
    .totals-grand-label { font-size: 15px; font-weight: 700; color: #1b1c19; }
    .totals-grand-value { font-size: 17px; font-weight: 800; }
    .summary-box { background: ${accentColor}; color: #fff; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; }
    .summary-box .row { display: flex; justify-content: space-between; margin-top: 6px; }
    .summary-box .lbl { font-size: 10px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-box .val { font-size: 15px; font-weight: 800; }
    .footer { position: absolute; bottom: 24px; left: 40px; right: 40px; border-top: 1px solid #e4e2dd; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; }
    .footer-left { font-size: 10px; color: #737874; }
    .footer-brand { font-size: 10px; font-weight: 700; color: ${accentColor}; }
    @media print { .page { page-break-after: always; min-height: auto; } .page:last-child { page-break-after: auto; } }
  `;
}

// ── Single page renderer (reused for all bill types) ──────────
function renderPage(
  data:        PurchaseBillData | SalesBillData,
  page:        SingleBillPage,
  pageIndex:   number,
  totalPages:  number,
  accentColor: string,
  overrideParty?: { label: string; name: string; sub: string; phone?: string }
): string {
  const isPurchase = data.type === 'purchase';

  const party = overrideParty ?? (isPurchase
    ? { label: 'Fisherman', name: (data as PurchaseBillData).fishermanName, sub: `⛵ ${(data as PurchaseBillData).boatName}`, phone: data.phone }
    : { label: 'Buyer', name: (data as SalesBillData).buyerName, sub: (data as SalesBillData).buyerType.charAt(0).toUpperCase() + (data as SalesBillData).buyerType.slice(1), phone: data.phone });

  const partyHTML = `
    <div>
      <p class="party-label">${party.label}</p>
      <p class="party-name">${party.name}</p>
      <p class="party-sub">${party.sub}</p>
      ${party.phone ? `<p class="party-sub">📞 ${party.phone}</p>` : ''}
    </div>`;

  const itemRowsHTML = page.items.map((item, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td class="td-left">${item.fishName}</td>
      <td class="td-center">${item.quantity}</td>
      <td class="td-center">${item.unit}</td>
      <td class="td-right">${fmt(item.pricePerUnit)}</td>
      <td class="td-right bold">${fmt(item.totalPrice)}</td>
    </tr>`).join('');

  const totalRowHTML = `<tr class="row-total"><td class="td-left bold" colspan="4">Total</td><td class="td-right bold">${fmt(page.totalAmount)}</td></tr>`;

  const paymentRowsHTML = page.payments.length > 0
    ? page.payments.map(p => `
      <tr class="row-even">
        <td class="td-left">${formatDate(p.date)}</td>
        <td class="td-center">${p.mode.charAt(0).toUpperCase() + p.mode.slice(1)}</td>
        <td class="td-right green">+${fmt(p.amount)}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" class="td-center muted" style="padding:12px">No payments recorded</td></tr>`;

  const balanceColor = page.balance <= 0 ? '#16a34a' : '#ba1a1a';
  const balanceText  = page.balance <= 0 ? '✓ FULLY CLEARED' : fmt(page.balance);

  return `
  <div class="page">
    <div class="header">
      <div>
        <div class="brand-name">${data.businessName}</div>
        <div class="brand-sub">FishLog Pro · Verified Document</div>
      </div>
      <div class="bill-meta">
        <div class="bill-type">${isPurchase ? 'Purchase Bill' : 'Sales Invoice'}</div>
        <div class="bill-number">#${page.billNumber}</div>
        <div class="bill-date">${formatDate(page.date)}</div>
      </div>
    </div>
    <div class="party-section">
      ${partyHTML}
      <div><span class="page-badge">${isPurchase ? 'Entry' : 'Order'} ${pageIndex + 1} of ${totalPages}</span></div>
    </div>
    <p class="section-title">Catch / Items</p>
    <table>
      <thead><tr>
        <th class="th-left">Species</th><th class="th-center">Qty</th>
        <th class="th-center">Unit</th><th class="th-right">Rate</th><th class="th-right">Amount</th>
      </tr></thead>
      <tbody>${itemRowsHTML}${totalRowHTML}</tbody>
    </table>
    <div class="totals-box">
      <div class="totals-row"><span class="totals-label">Gross Amount</span><span class="totals-value">${fmt(page.totalAmount)}</span></div>
      <div class="totals-row"><span class="totals-label">${isPurchase ? 'Amount Paid' : 'Amount Received'}</span><span class="totals-value green">${fmt(page.totalPaid)}</span></div>
      <hr class="totals-divider"/>
      <div class="totals-row"><span class="totals-grand-label">Balance Due</span><span class="totals-grand-value" style="color:${balanceColor}">${balanceText}</span></div>
    </div>
    <p class="section-title">Payment History</p>
    <table>
      <thead><tr><th class="th-left">Date</th><th class="th-center">Mode</th><th class="th-right">Amount</th></tr></thead>
      <tbody>${paymentRowsHTML}</tbody>
    </table>
    <div class="footer">
      <span class="footer-left">Generated ${new Date().toLocaleString('en-IN')} · Page ${pageIndex + 1} of ${totalPages}</span>
      <span class="footer-brand">FishLog Pro</span>
    </div>
  </div>`;
}

// ── Cover page for multi-party PDFs ───────────────────────────
function renderCoverPage(
  businessName: string,
  title:        string,
  subtitle:     string,
  accentColor:  string,
  stats:        { label: string; value: string }[]
): string {
  const statsHTML = stats.map(s => `
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.15);">
      <span style="font-size:13px;opacity:0.8;">${s.label}</span>
      <span style="font-size:14px;font-weight:800;">${s.value}</span>
    </div>`).join('');

  return `
  <div class="page">
    <div style="height:100%;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:40px 0;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#737874;text-transform:uppercase;margin-bottom:12px;">FishLog Pro · ${businessName}</div>
      <div style="font-size:36px;font-weight:800;color:${accentColor};letter-spacing:-1px;line-height:1.2;margin-bottom:8px;">${title}</div>
      <div style="font-size:15px;color:#737874;margin-bottom:48px;">${subtitle}</div>
      <div style="background:${accentColor};border-radius:14px;padding:20px 24px;width:100%;color:#fff;">
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;opacity:0.7;margin-bottom:8px;text-transform:uppercase;">Report Summary</div>
        ${statsHTML}
      </div>
      <div style="margin-top:auto;padding-top:48px;font-size:11px;color:#aaa;">Generated ${new Date().toLocaleString('en-IN')}</div>
    </div>
    <div class="footer">
      <span class="footer-left">Cover page</span>
      <span class="footer-brand">FishLog Pro</span>
    </div>
  </div>`;
}

// ── Build full HTML ────────────────────────────────────────────
function generateHTML(data: BillData): string {
  // Single purchase or sales bill (existing flow)
  if (data.type === 'purchase' || data.type === 'sales') {
    const isPurchase  = data.type === 'purchase';
    const accentColor = isPurchase ? '#4d6055' : '#4e6073';
    const pagesHTML   = data.pages.map((page, i) =>
      renderPage(data, page, i, data.pages.length, accentColor)
    ).join('\n');
    return wrapHTML(accentColor, pagesHTML);
  }

  // Multi purchase
  if (data.type === 'multi-purchase') {
    const accentColor = '#4d6055';
    const totalEntries = data.parties.reduce((s, p) => s + p.pages.length, 0);
    const totalAmount  = data.parties.reduce((s, p) =>
      s + p.pages.reduce((ss, pp) => ss + pp.totalAmount, 0), 0);
    const totalBalance = data.parties.reduce((s, p) =>
      s + p.pages.reduce((ss, pp) => ss + pp.balance, 0), 0);

    const cover = renderCoverPage(
      data.businessName,
      'Purchase Bills',
      `${data.parties.length} fisherman${data.parties.length !== 1 ? 'en' : ''} · ${totalEntries} entr${totalEntries !== 1 ? 'ies' : 'y'}`,
      accentColor,
      [
        { label: 'Total fishermen', value: String(data.parties.length) },
        { label: 'Total entries',   value: String(totalEntries) },
        { label: 'Total amount',    value: fmt(totalAmount) },
        { label: 'Total balance due', value: totalBalance <= 0 ? '✓ All cleared' : fmt(totalBalance) },
      ]
    );

    const pagesHTML = data.parties.map(party =>
      party.pages.map((page, i) =>
        renderPage(party, page, i, party.pages.length, accentColor)
      ).join('\n')
    ).join('\n');

    return wrapHTML(accentColor, cover + pagesHTML);
  }

  // Multi sales
  if (data.type === 'multi-sales') {
    const accentColor = '#4e6073';
    const totalOrders = data.parties.reduce((s, p) => s + p.pages.length, 0);
    const totalAmount = data.parties.reduce((s, p) =>
      s + p.pages.reduce((ss, pp) => ss + pp.totalAmount, 0), 0);
    const totalBalance = data.parties.reduce((s, p) =>
      s + p.pages.reduce((ss, pp) => ss + pp.balance, 0), 0);

    const cover = renderCoverPage(
      data.businessName,
      'Sales Invoices',
      `${data.parties.length} buyer${data.parties.length !== 1 ? 's' : ''} · ${totalOrders} order${totalOrders !== 1 ? 's' : ''}`,
      accentColor,
      [
        { label: 'Total buyers',      value: String(data.parties.length) },
        { label: 'Total orders',      value: String(totalOrders) },
        { label: 'Total amount',      value: fmt(totalAmount) },
        { label: 'Total outstanding', value: totalBalance <= 0 ? '✓ All cleared' : fmt(totalBalance) },
      ]
    );

    const pagesHTML = data.parties.map(party =>
      party.pages.map((page, i) =>
        renderPage(party, page, i, party.pages.length, accentColor)
      ).join('\n')
    ).join('\n');

    return wrapHTML(accentColor, cover + pagesHTML);
  }

  // Register report
  if (data.type === 'register') {
    const accentColor = '#4d6055';
    const reportLabel = data.reportType === 'purchase' ? 'Purchase Report'
                      : data.reportType === 'sales'    ? 'Sales Report'
                      :                                  'Combined Register Report';

    const totalPurchase = data.parties.reduce((s, p) =>
      s + (p.purchasePages ?? []).reduce((ss, pp) => ss + pp.totalAmount, 0), 0);
    const totalSales = data.parties.reduce((s, p) =>
      s + (p.salesPages ?? []).reduce((ss, pp) => ss + pp.totalAmount, 0), 0);
    const totalPurchaseBalance = data.parties.reduce((s, p) =>
      s + (p.purchasePages ?? []).reduce((ss, pp) => ss + pp.balance, 0), 0);
    const totalSalesBalance = data.parties.reduce((s, p) =>
      s + (p.salesPages ?? []).reduce((ss, pp) => ss + pp.balance, 0), 0);

    const coverStats: { label: string; value: string }[] = [
      { label: 'Total entities', value: String(data.parties.length) },
    ];
    if (data.reportType !== 'sales') {
      coverStats.push({ label: 'Total purchases', value: fmt(totalPurchase) });
      coverStats.push({ label: 'Purchase balance due', value: totalPurchaseBalance <= 0 ? '✓ Cleared' : fmt(totalPurchaseBalance) });
    }
    if (data.reportType !== 'purchase') {
      coverStats.push({ label: 'Total sales', value: fmt(totalSales) });
      coverStats.push({ label: 'Sales outstanding', value: totalSalesBalance <= 0 ? '✓ Cleared' : fmt(totalSalesBalance) });
    }
    if (data.reportType === 'both') {
      coverStats.push({ label: 'Net profit', value: fmt(totalSales - totalPurchase) });
    }

    const cover = renderCoverPage(
      data.businessName,
      reportLabel,
      `${data.parties.length} entit${data.parties.length !== 1 ? 'ies' : 'y'} · ${new Date().toLocaleDateString('en-IN')}`,
      accentColor,
      coverStats
    );

    const pagesHTML = data.parties.map(party => {
      const isPurchaseParty = party.entityType === 'fisherman';
      const partyColor      = isPurchaseParty ? '#4d6055' : '#4e6073';
      let html = '';

      if (party.purchasePages && party.purchasePages.length > 0) {
        const fakeData: PurchaseBillData = {
          type:          'purchase',
          businessName:  data.businessName,
          fishermanName: party.name,
          boatName:      party.subLabel,
          phone:         party.phone,
          pages:         party.purchasePages,
        };
        html += party.purchasePages.map((page, i) =>
          renderPage(fakeData, page, i, party.purchasePages!.length, '#4d6055')
        ).join('\n');
      }

      if (party.salesPages && party.salesPages.length > 0) {
        const fakeData: SalesBillData = {
          type:         'sales',
          businessName: data.businessName,
          buyerName:    party.name,
          buyerType:    party.subLabel,
          phone:        party.phone,
          pages:        party.salesPages,
        };
        html += party.salesPages.map((page, i) =>
          renderPage(fakeData, page, i, party.salesPages!.length, '#4e6073')
        ).join('\n');
      }

      return html;
    }).join('\n');

    return wrapHTML(accentColor, cover + pagesHTML);
  }

  return wrapHTML('#4d6055', '<div class="page"><p>No data</p></div>');
}

function wrapHTML(accentColor: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>${getCSS(accentColor)}</style>
</head>
<body>${body}</body>
</html>`;
}

// ── Public API ─────────────────────────────────────────────────
export async function generateAndShareBill(data: BillData): Promise<void> {
  const isEmpty =
    (data.type === 'purchase' || data.type === 'sales') ? data.pages.length === 0
    : (data.type === 'multi-purchase' || data.type === 'multi-sales') ? data.parties.every(p => p.pages.length === 0)
    : data.parties.every(p => (p.purchasePages?.length ?? 0) + (p.salesPages?.length ?? 0) === 0);

  if (isEmpty) throw new Error('No entries selected to generate a bill.');

  const html = generateHTML(data);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');

  const dialogTitle =
    data.type === 'purchase'       ? `Purchase Bill — ${(data as PurchaseBillData).fishermanName}`
    : data.type === 'sales'        ? `Sales Invoice — ${(data as SalesBillData).buyerName}`
    : data.type === 'multi-purchase' ? 'Purchase Bills'
    : data.type === 'multi-sales'  ? 'Sales Invoices'
    :                                'Register Report';

  await Sharing.shareAsync(uri, {
    mimeType:    'application/pdf',
    dialogTitle,
    UTI:         'com.adobe.pdf',
  });
}

export async function printBill(data: BillData): Promise<void> {
  const html = generateHTML(data);
  await Print.printAsync({ html });
}
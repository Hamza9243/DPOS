// Thermal receipt printer (80mm default — e.g. Black Copper BC-99AC).
// Prints via a hidden iframe so no extra popup window appears, and sets the
// page size so the printer cuts at the receipt length instead of feeding a
// full A4 page. Text is bold + pure black for dark, non-faded thermal output.

export function printThermalReceipt({
  businessName = "DPOS",
  receiptNo = "",
  date = "",
  time = "",
  customer = "",
  payment = "",
  items = [],
  total = 0,
  width = 80, // mm — 80 for BC-99AC, 58 for mini printers
}) {
  const rows = items
    .map(
      (i) =>
        `<tr><td class="name">${escapeHtml(i.name)}</td><td class="qty">${i.qty}</td><td class="amt">Rs.${i.price * i.qty}</td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(receiptNo)}</title>
  <style>
    @page { margin: 0; }
    * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    html, body { width:${width}mm; background:#fff; }
    body { font-family:'Courier New', monospace; color:#000; font-weight:700; padding:1.5mm 1.5mm 0; }
    .center { text-align:center; }
    .biz { font-size:15px; font-weight:800; letter-spacing:0.5px; }
    .sub { font-size:9px; font-weight:700; }
    .meta { font-size:10px; font-weight:700; line-height:1.4; margin:1.5mm 0; }
    .divider { border-top:1px dashed #000; margin:1.5mm 0; }
    table { width:100%; border-collapse:collapse; }
    td { font-size:11px; font-weight:700; padding:0.6mm 0; vertical-align:top; }
    .name { width:52%; word-break:break-word; }
    .qty { width:18%; text-align:center; }
    .amt { width:30%; text-align:right; }
    .thead td { font-size:9px; font-weight:700; border-bottom:1px solid #000; padding-bottom:0.8mm; }
    .total td { font-size:13px; font-weight:800; padding-top:1.5mm; }
    .foot { font-size:9px; font-weight:700; margin-top:2mm; line-height:1.4; }
  </style></head><body>
    <div class="center"><div class="biz">${escapeHtml(businessName)}</div><div class="sub">Point of Sale System</div></div>
    <div class="divider"></div>
    <div class="meta">
      <div>Receipt: ${escapeHtml(receiptNo)}</div>
      <div>Date: ${escapeHtml(date)}${time ? " " + escapeHtml(time) : ""}</div>
      ${customer ? `<div>Customer: ${escapeHtml(customer)}</div>` : ""}
      ${payment ? `<div>Payment: ${escapeHtml(payment)}</div>` : ""}
    </div>
    <div class="divider"></div>
    <table>
      <tr class="thead"><td>ITEM</td><td class="qty">QTY</td><td class="amt">AMOUNT</td></tr>
      ${rows}
    </table>
    <div class="divider"></div>
    <table><tr class="total"><td>TOTAL</td><td class="qty"></td><td class="amt">Rs. ${total}</td></tr></table>
    <div class="divider"></div>
    <div class="center foot"><div>Thank you for your purchase!</div><div>Powered by Devorions</div></div>
  </body></html>`;

  // Remove any leftover frame from a previous print.
  const old = document.getElementById("thermal-print-frame");
  if (old) old.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "thermal-print-frame";
  iframe.setAttribute("aria-hidden", "true");
  // Off-screen but with a REAL width so the content lays out at the true paper
  // width and scrollHeight is accurate. A 0-size frame gives wrong heights.
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}mm;height:1000px;border:0;`;
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  let fired = false;
  const fire = () => {
    if (fired) return; // onload + timeout fallback must not both print
    fired = true;
    try {
      const win = iframe.contentWindow;
      // Measure the actual rendered height and pin @page to exactly that, so the
      // page starts at the very top (no top gap) and the printer cuts right
      // after the content (no bottom gap / no centering on a long page).
      const doc2 = win.document;
      // body shrinks to its content, so body.scrollHeight is the true receipt
      // height. (documentElement.scrollHeight would wrongly return the iframe
      // viewport height and re-introduce a huge blank page.)
      const contentPx = doc2.body.scrollHeight;
      // Keep height >= width so the page never becomes wider than tall — otherwise
      // the driver rotates the short receipt to landscape. Extra space (if any)
      // falls at the bottom, which is fine.
      const heightMm = Math.max(Math.ceil((contentPx * 25.4) / 96) + 1, width + 2);
      const pageStyle = doc2.createElement("style");
      pageStyle.textContent = `@page { size: ${width}mm ${heightMm}mm; margin: 0; }`;
      doc2.head.appendChild(pageStyle);

      win.focus();
      win.print();
    } catch (e) {
      console.error("Print failed", e);
    }
    // Give the print dialog time to grab the document before cleanup.
    setTimeout(() => iframe.remove(), 1500);
  };

  // doc.write content renders synchronously; a short delay lets layout settle
  // so the printable area is correct before the dialog opens.
  iframe.onload = fire;
  setTimeout(fire, 400);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

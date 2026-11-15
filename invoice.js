const form = document.getElementById('invoice-form');
const itemsEl = document.getElementById('items');
const rowTpl = document.getElementById('item-row');
const $ = id => document.getElementById(id);
const field = name => form.elements[name];

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const round2 = n => Math.round(n * 100) / 100;

function totals(items, taxPct) {
  const subtotal = round2(items.reduce((sum, i) => sum + i.qty * i.price, 0));
  const tax = round2(subtotal * taxPct / 100);
  return { subtotal, tax, total: round2(subtotal + tax) };
}
console.assert(
  JSON.stringify(totals([{ qty: 2, price: 1500 }, { qty: 1, price: 999.5 }], 18)) ===
  JSON.stringify({ subtotal: 3999.5, tax: 719.91, total: 4719.41 }),
  'invoice totals'
);

// ---------- service rows ----------
function addRow() {
  const row = rowTpl.content.firstElementChild.cloneNode(true);
  row.querySelector('.remove').addEventListener('click', () => {
    if (itemsEl.children.length > 1) row.remove();
    else row.querySelectorAll('input').forEach(i => (i.value = i.name === 'qty' ? '1' : ''));
  });
  itemsEl.append(row);
  return row;
}
$('add-item').addEventListener('click', () => addRow().querySelector('input').focus());
addRow();

field('date').value = new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

// ---------- validation ----------
function readForm() {
  const errors = [];
  const flag = (input, bad, message) => {
    input.setAttribute('aria-invalid', bad);
    if (bad) errors.push(message);
  };

  const client = field('client').value.trim();
  const email = field('email').value.trim();
  flag(field('client'), !client, "Enter the client's full name.");
  flag(field('email'), !email || !field('email').checkValidity(), 'Enter a valid email address, like name@example.com.');
  flag(field('date'), !field('date').value, 'Choose the invoice date.');

  const items = [];
  for (const row of itemsEl.children) {
    const [desc, qty, price] = ['desc', 'qty', 'price'].map(n => row.querySelector(`[name="${n}"]`));
    const d = desc.value.trim();
    if (!d && !price.value) { [desc, qty, price].forEach(i => i.setAttribute('aria-invalid', false)); continue; } // empty row: skip
    const q = Number(qty.value);
    const p = Number(price.value);
    flag(desc, !d, 'Every service needs a description.');
    flag(qty, !Number.isInteger(q) || q < 1, 'Quantity must be a whole number of 1 or more.');
    flag(price, price.value === '' || !(p >= 0), 'Enter a price of 0 or more for every service.');
    items.push({ desc: d, qty: q, price: round2(p) });
  }
  if (!items.length) errors.push('Add at least one service.');

  const tax = field('tax').value === '' ? 0 : Number(field('tax').value);
  flag(field('tax'), !(tax >= 0 && tax <= 100), 'Tax must be between 0 and 100%.');

  return {
    errors,
    data: {
      client, email, items, tax,
      phone: field('phone').value.trim(),
      address: field('address').value.trim(),
      notes: field('notes').value.trim(),
      date: field('date').value,
    },
  };
}

// ---------- invoice rendering (textContent only: user input is never parsed as HTML) ----------
let invoiceNo = '';

function setText(id, text) {
  const el = $(id);
  el.textContent = text;
  el.hidden = !text;
}

function render(d) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  invoiceNo = `INV-${d.date.replaceAll('-', '')}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  setText('inv-no', invoiceNo);
  setText('inv-date', new Date(d.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
  setText('inv-client', d.client);
  setText('inv-address', d.address);
  setText('inv-email', d.email);
  setText('inv-phone', d.phone);
  setText('inv-notes', d.notes);

  const tbody = $('inv-rows');
  tbody.replaceChildren(...d.items.map(item => {
    const tr = document.createElement('tr');
    [item.desc, item.qty, money.format(item.price), money.format(round2(item.qty * item.price))].forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.append(td);
    });
    return tr;
  }));

  const t = totals(d.items, d.tax);
  $('inv-sub').textContent = money.format(t.subtotal);
  $('inv-tax-label').textContent = `Tax (${d.tax}%)`;
  $('inv-tax').textContent = money.format(t.tax);
  $('inv-tax-row').hidden = !d.tax;
  $('inv-total').textContent = money.format(t.total);
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const { errors, data } = readForm();
  $('error').textContent = errors[0] || '';
  if (errors.length) {
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  render(data);
  $('output').hidden = false;
  $('output-title').focus();
  $('output').scrollIntoView();
});

// ---------- PDF ----------
$('download').addEventListener('click', () => {
  // shortcut: if the PDF library can't load (offline), fall back to the browser's print dialog, where "Save as PDF" works
  if (!window.html2pdf) return window.print();
  html2pdf()
    .set({
      margin: 10,
      filename: `${invoiceNo}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff', scrollY: 0 }, // scrollY: 0, or the PDF is blank when the page is scrolled
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from($('invoice'))
    .save();
});

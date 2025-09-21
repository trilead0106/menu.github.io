// 簡單靜態點餐系統（無後端）
// 會把訂單轉成 mailto: 並打開使用者預設郵件程式以發送訂單
// 可修改 HTML head meta[name="merchant-email"] 來改接單信箱

const MERCHANT_EMAIL = (() => {
  const m = document.querySelector('meta[name="merchant-email"]');
  return m ? m.content.trim() : 'orders@yourrestaurant.com';
})();

const menuEl = document.getElementById('menu');
const cartListEl = document.getElementById('cart-list');
const totalEl = document.getElementById('total');
const clearBtn = document.getElementById('clear-cart');
const checkoutBtn = document.getElementById('checkout');

let MENU = [];
let CART = {}; // key: itemId -> {item, qty}

const CURRENCY = 'NT$';

// load menu.json
fetch('menu.json')
  .then(r => r.json())
  .then(data => {
    MENU = data.items || [];
    renderMenu();
    loadCartFromStorage();
    renderCart();
  })
  .catch(err => {
    menuEl.innerHTML = `<div class="card">載入菜單失敗：${err}</div>`;
  });

function renderMenu(){
  if(!MENU.length){
    menuEl.innerHTML = '<div class="card">目前沒有菜單項目</div>';
    return;
  }
  menuEl.innerHTML = '';
  MENU.forEach(it => {
    const card = document.createElement('div');
    card.className = 'card menu-item';
    card.innerHTML = `
      <img src="${it.image || ''}" alt="${escapeHtml(it.name)}" onerror="this.style.display='none'"/>
      <div class="item-meta">
        <div>
          <div class="item-name">${escapeHtml(it.name)}</div>
          <small class="muted">${escapeHtml(it.description || '')}</small>
        </div>
        <div class="item-price">${CURRENCY}${formatPrice(it.price)}</div>
      </div>
      <div class="qty-controls">
        <button class="btn" data-action="dec" data-id="${it.id}">−</button>
        <div class="qty-display" id="qty-${it.id}">0</div>
        <button class="btn" data-action="inc" data-id="${it.id}">＋</button>
        <button class="btn primary" data-action="add" data-id="${it.id}">加入</button>
      </div>
    `;
    menuEl.appendChild(card);
  });

  // bind buttons
  menuEl.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', e => {
      const act = b.getAttribute('data-action');
      const id = b.getAttribute('data-id');
      if(act === 'inc') changeQtyPreview(id, 1);
      if(act === 'dec') changeQtyPreview(id, -1);
      if(act === 'add') {
        const qty = Number(document.getElementById(`qty-${id}`).textContent) || 0;
        addToCart(id, qty || 1);
        document.getElementById(`qty-${id}`).textContent = 0;
      }
    });
  });
}

function changeQtyPreview(id, delta){
  const el = document.getElementById(`qty-${id}`);
  if(!el) return;
  let v = parseInt(el.textContent || '0', 10);
  v = Math.max(0, v + delta);
  el.textContent = v;
}

function addToCart(id, qty){
  const item = MENU.find(x => x.id === id);
  if(!item) return;
  if(!CART[id]) CART[id] = { item, qty: 0 };
  CART[id].qty += qty;
  if(CART[id].qty <= 0) delete CART[id];
  saveCartToStorage();
  renderCart();
}

function renderCart(){
  const keys = Object.keys(CART);
  if(!keys.length){
    cartListEl.innerHTML = '（尚無選購）';
    totalEl.textContent = `${CURRENCY}0`;
    return;
  }
  cartListEl.innerHTML = '';
  let total = 0;
  keys.forEach(k => {
    const row = document.createElement('div');
    row.className = 'cart-row';
    const { item, qty } = CART[k];
    const subtotal = item.price * qty;
    total += subtotal;
    row.innerHTML = `
      <div>
        <div style="font-weight:600">${escapeHtml(item.name)}</div>
        <small>${CURRENCY}${formatPrice(item.price)} x ${qty} = ${CURRENCY}${formatPrice(subtotal)}</small>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div>
          <button class="btn" data-action="dec" data-id="${item.id}">−</button>
          <button class="btn" data-action="inc" data-id="${item.id}">＋</button>
          <button class="btn" data-action="remove" data-id="${item.id}">移除</button>
        </div>
      </div>
    `;
    cartListEl.appendChild(row);
  });
  totalEl.textContent = `${CURRENCY}${formatPrice(total)}`;

  // bind cart buttons
  cartListEl.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      const act = b.getAttribute('data-action');
      const id = b.getAttribute('data-id');
      if(act === 'inc') { addToCart(id, 1); }
      if(act === 'dec') { addToCart(id, -1); }
      if(act === 'remove') { delete CART[id]; saveCartToStorage(); renderCart(); }
    });
  });
}

clearBtn.addEventListener('click', () => {
  if(!confirm('確定要清空購物車嗎？')) return;
  CART = {};
  saveCartToStorage();
  renderCart();
});

checkoutBtn.addEventListener('click', () => {
  const keys = Object.keys(CART);
  if(!keys.length){ alert('購物車為空'); return; }

  // 構造訂單內容
  let body = `訂單時間: ${new Date().toLocaleString()}\n\n`;
  let total = 0;
  keys.forEach(k => {
    const { item, qty } = CART[k];
    const subtotal = item.price * qty;
    total += subtotal;
    body += `${item.name}  x ${qty}  = ${CURRENCY}${formatPrice(subtotal)}\n`;
  });
  body += `\n總計：${CURRENCY}${formatPrice(total)}\n\n`;
  body += `備註：\n(請在此填寫取餐時間/桌號/聯絡電話)\n`;

  const subject = encodeURIComponent('新訂單來自 QR 點餐');
  const mailto = `mailto:${encodeURIComponent(MERCHANT_EMAIL)}?subject=${subject}&body=${encodeURIComponent(body)}`;

  // 打開使用者預設郵件應用程式
  window.location.href = mailto;
});

// localStorage
function saveCartToStorage(){
  try{ localStorage.setItem('qr_cart_v1', JSON.stringify(CART)); }catch(e){}
}
function loadCartFromStorage(){
  try{
    const raw = localStorage.getItem('qr_cart_v1');
    if(raw) CART = JSON.parse(raw);
  }catch(e){ CART = {}; }
}

function formatPrice(n){
  // 簡單格式化整數（不處理小數）
  return Number(n).toLocaleString();
}
function escapeHtml(s){
  if(!s) return '';
  return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

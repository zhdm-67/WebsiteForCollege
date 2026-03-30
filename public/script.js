// Универсальный скрипт для всех страниц: данные меню, фильтр, корзина (localStorage), модал, тема
const items = [
  {
    id: 1,
    name: "Латте",
    cat: "coffee",
    price: 5.69,
    desc: "Молоко, эспрессо, бархатная пена",
    img: "img/coffee.jpg",
  },
  {
    id: 2,
    name: "Капучино",
    cat: "coffee",
    price: 5.99,
    desc: "Классический капучино с корицей",
    img: "img/coffee.jpg",
  },
  {
    id: 3,
    name: "Круассан",
    cat: "bakery",
    price: 4.2,
    desc: "С маслом, хрустящий",
    img: "img/croissant.jpg",
  },
  {
    id: 4,
    name: "Булочка с корицей",
    cat: "bakery",
    price: 6.7,
    desc: "Нежная и ароматная",
    img: "img/cinnamon.jpg",
  },
  {
    id: 5,
    name: "Лимонад",
    cat: "cold",
    price: 4.99,
    desc: "Освежающий домашний лимонад",
    img: "img/lemonade.jpg",
  },
  {
    id: 6,
    name: "Холодный кофе",
    cat: "cold",
    price: 5.49,
    desc: "Айс латте с ванилью",
    img: "img/coffee.jpg",
  },
];

const storageKey = "cafe_cart_v1";
let cart = JSON.parse(localStorage.getItem(storageKey) || "{}");

function saveCart() {
  localStorage.setItem(storageKey, JSON.stringify(cart));
}

function findMenuContainer() {
  return document.getElementById("menuList") || null;
}

function renderMenu(filter = "all") {
  const container = findMenuContainer();
  if (!container) return;
  container.innerHTML = "";
  const filtered = items.filter((i) =>
    filter === "all" ? true : i.cat === filter,
  );
  filtered.forEach((it) => {
    const card = document.createElement("article");
    card.className = "card";

    const imgHtml = it.img
      ? `<div class="thumb"><img src="${it.img}" alt="${it.name}" loading="lazy" width="84" height="84"></div>`
      : `<div class="thumb" aria-hidden="true">${it.name.charAt(0)}</div>`;

    card.innerHTML = `
      ${imgHtml}
      <div class="meta">
        <h3>${it.name} <span class="price">${it.price} ₽</span></h3>
        <p class="muted">${it.desc}</p>
      </div>
      <div class="actions">
        <button class="btn add" data-id="${it.id}">Добавить</button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function loadItemsFromServer() {
  try {
    const res = await fetch(`/api/items`);
    if (!res.ok) throw new Error("Ошибка загрузки меню");
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      window.items = data;
      renderMenu();
      updateCartUI();
    }
  } catch (err) {
    console.warn("Menu load failed:", err);
  }
}

function getCustomerFromForm(suffix = "") {
  const form =
    document.getElementById(`checkoutForm${suffix}`) ||
    document.getElementById("checkoutForm");
  if (!form) return null;
  const fd = new FormData(form);
  return {
    name: (fd.get("name") || "").trim(),
    phone: (fd.get("phone") || "").trim(),
    address: (fd.get("address") || "").trim(),
    note: (fd.get("note") || "").trim(),
    _formEl: form,
  };
}

function markFieldInvalid(form, name, invalid = true) {
  try {
    const el = form.querySelector(`[name="${name}"]`);
    if (!el) return;
    const wrap = el.closest(".field") || el.parentElement;
    if (invalid) wrap?.classList.add("invalid");
    else wrap?.classList.remove("invalid");
  } catch (e) {}
}

function validateCustomer(customer) {
  if (!customer) return false;
  const form = customer._formEl;
  let ok = true;

  // name: required, 2..120 chars
  if (
    !customer.name ||
    customer.name.length < 2 ||
    customer.name.length > 120
  ) {
    markFieldInvalid(form, "name", true);
    ok = false;
  } else {
    markFieldInvalid(form, "name", false);
  }

  // phone: required, digits + allowed chars, 6..20 chars
  const phoneRe = /^[\d+\-\s()]{6,20}$/;
  if (!customer.phone || !phoneRe.test(customer.phone)) {
    markFieldInvalid(form, "phone", true);
    ok = false;
  } else {
    markFieldInvalid(form, "phone", false);
  }

  // address: required, 5..300 chars
  if (
    !customer.address ||
    customer.address.length < 5 ||
    customer.address.length > 300
  ) {
    markFieldInvalid(form, "address", true);
    ok = false;
  } else {
    markFieldInvalid(form, "address", false);
  }

  return ok;
}

// Remove invalid state on input
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el || !el.closest) return;
  if (el.closest("#checkoutForm") || el.closest("#checkoutForm2")) {
    const wrap = el.closest(".field") || el.parentElement;
    wrap?.classList.remove("invalid");
  }
});

async function submitOrderToServer(customer = null) {
  const payload = { cart, customer };
  const checkoutBtns = document.querySelectorAll('[id^="checkout"]');
  try {
    checkoutBtns.forEach((b) => (b.disabled = true));
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Order failed");
    cart = {};
    saveCart();
    updateAllCartCounts();
    alert(`Заказ принят. №${json.orderId || ""} Сумма: ${json.total || ""}`);
  } catch (err) {
    console.error(err);
    alert("Не удалось отправить заказ: " + (err.message || err));
  } finally {
    checkoutBtns.forEach((b) => (b.disabled = false));
  }
}

// Cart UI per page (supports multiple ids)
function getCartElements(suffix = "") {
  return {
    cartBtn:
      document.getElementById(`cartBtn${suffix}`) ||
      document.getElementById("cartBtn"),
    cartCount:
      document.getElementById(`cartCount${suffix}`) ||
      document.getElementById("cartCount"),
    modalBackdrop:
      document.getElementById(`modalBackdrop${suffix}`) ||
      document.getElementById("modalBackdrop"),
    cartList:
      document.getElementById(`cartList${suffix}`) ||
      document.getElementById("cartList"),
    cartTotal:
      document.getElementById(`cartTotal${suffix}`) ||
      document.getElementById("cartTotal"),
    closeModal:
      document.getElementById(`closeModal${suffix}`) ||
      document.getElementById("closeModal"),
    clearCart:
      document.getElementById(`clearCart${suffix}`) ||
      document.getElementById("clearCart"),
    checkout:
      document.getElementById(`checkout${suffix}`) ||
      document.getElementById("checkout"),
  };
}

function updateCartUI(suffix = "") {
  const els = getCartElements(suffix);
  if (!els.cartCount) return;
  const keys = Object.keys(cart);
  const totalCount = keys.reduce((s, k) => s + cart[k], 0);
  els.cartCount.textContent = totalCount.toFixed(2);
  if (!els.cartList) return;
  if (keys.length === 0) {
    els.cartList.innerHTML = '<div class="muted">Корзина пуста</div>';
    if (els.cartTotal) els.cartTotal.textContent = `0 ₽`;
    return;
  }
  els.cartList.innerHTML = "";
  let sum = 0;
  keys.forEach((k) => {
    const it = items.find((x) => x.id == k);
    if (!it) return;
    const qty = cart[k];
    sum += it.price * qty;
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.padding = "8px 0";
    row.innerHTML = `<div><strong>${it.name}</strong> <div class="muted" style="font-size:13px">${it.price} ₽ × ${qty}</div></div>
    <div style="display:flex;gap:6px;align-items:center">
      <button class="btn small dec" data-id="${it.id}">−</button>
      <button class="btn small inc" data-id="${it.id}">+</button>
    </div>`;
    els.cartList.appendChild(row);
  });
  if (els.cartTotal) els.cartTotal.textContent = `${sum} ₽`;

  Array.from(els.cartList.querySelectorAll(".inc")).forEach((b) => {
    b.addEventListener("click", (e) => {
      const id = e.target.dataset.id;
      cart[id] = (cart[id] || 0) + 1;
      saveCart();
      updateAllCartCounts();
    });
  });
  Array.from(els.cartList.querySelectorAll(".dec")).forEach((b) => {
    b.addEventListener("click", (e) => {
      const id = e.target.dataset.id;
      cart[id] = Math.max(0, (cart[id] || 0) - 1);
      if (cart[id] === 0) delete cart[id];
      saveCart();
      updateAllCartCounts();
    });
  });
}

function updateAllCartCounts() {
  // find all cartCount elements on page and update them
  document.querySelectorAll(".cart-count").forEach((el) => {
    const total = Object.values(cart).reduce((s, v) => s + v, 0);
    el.textContent = total.toFixed(2);
  });
  // refresh any open modal lists
  updateCartUI("");
  updateCartUI("2");
}

const THEME_KEY = "cafe_theme_v1";

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.style.setProperty("--bg-start", "#061220");
    document.documentElement.style.setProperty("--bg", "#0f1720");
    document.documentElement.style.setProperty("--form-bg-start", "#0b1218");
    document.documentElement.style.setProperty("--form-bg", "#071018");
    document.documentElement.style.setProperty("--card", "#07121a");
    document.documentElement.style.setProperty("--muted", "#9fb0c4");
    document.documentElement.style.setProperty("--accent", "#ff7a50");
    document.documentElement.style.setProperty("--accent-2", "#ffb76a");
    document.documentElement.style.setProperty("--text", "#e6eef8");
    document.documentElement.style.setProperty("--radius", "12px");
    document.documentElement.style.setProperty(
      "--shadow",
      "0 8px 28px rgba(2,6,12,0.6)",
    );
  } else {
    document.documentElement.style.removeProperty("--bg-start");
    document.documentElement.style.removeProperty("--bg");
    document.documentElement.style.removeProperty("--form-bg-start");
    document.documentElement.style.removeProperty("--form-bg");
    document.documentElement.style.removeProperty("--card");
    document.documentElement.style.removeProperty("--muted");
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--accent-2");
    document.documentElement.style.removeProperty("--text");
    document.documentElement.style.removeProperty("--radius");
    document.documentElement.style.removeProperty("--shadow");
  }
}

async function submitOrderToServer(customer = null) {
  const payload = { cart, customer };
  const checkoutBtns = document.querySelectorAll('[id^="checkout"]');
  try {
    checkoutBtns.forEach((b) => (b.disabled = true));
    const res = await fetch(`/api/orders`, {
      // относительный путь
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Order failed");
    cart = {};
    saveCart();
    updateAllCartCounts();
    alert(`Заказ принят. №${json.orderId || ""} Сумма: ${json.total || ""}`);
  } catch (err) {
    console.error(err);
    alert("Не удалось отправить заказ: " + (err.message || err));
    throw err;
  } finally {
    checkoutBtns.forEach((b) => (b.disabled = false));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadItemsFromServer();

  const checkoutForm = document.getElementById("checkoutForm");
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (Object.keys(cart).length === 0) {
        alert("Корзина пуста");
        return;
      }
      const customer = getCustomerFromForm();
      if (!validateCustomer(customer)) {
        // небольшая анимация ошибки
        checkoutForm.animate(
          [
            { transform: "translateY(0)" },
            { transform: "translateY(-6px)" },
            { transform: "translateY(0)" },
          ],
          { duration: 320 },
        );
        return;
      }
      const submitBtn =
        checkoutForm.querySelector("#checkout") ||
        checkoutForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        await submitOrderToServer({
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          note: customer.note || "",
        });
        // при успехе — очистка формы
        checkoutForm.reset();
      } catch (err) {
        // submitOrderToServer уже показывает ошибку
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // Delegation: add-to-cart buttons on menu pages
  document.body.addEventListener("click", (e) => {
    const addBtn = e.target.closest(".add");
    if (addBtn) {
      const id = addBtn.dataset.id;
      cart[id] = (cart[id] || 0) + 1;
      saveCart();
      // micro animation for visible cart button
      document.querySelectorAll(".cart-float").forEach((b) => {
        b.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.08)" },
            { transform: "scale(1)" },
          ],
          { duration: 320, easing: "ease-out" },
        );
      });
      updateAllCartCounts();
    }
  });

  // Filter chips (support pages that include controls)
  document.querySelectorAll(".controls").forEach((ctrl) => {
    const chips = Array.from(ctrl.querySelectorAll(".chip"));
    chips.forEach((c) => {
      c.addEventListener("click", () => {
        chips.forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        const filter = c.dataset.filter;
        renderMenu(filter);
      });
    });
  });

  // Attach cart modal handlers for available sets (suffix '', '2' on menu page)
  [
    ["", ""],
    ["2", "2"],
  ].forEach(([suf, s]) => {
    const els = getCartElements(suf);
    if (!els.cartBtn) return;
    els.cartBtn.addEventListener("click", () => {
      if (!els.modalBackdrop) return;
      els.modalBackdrop.style.display = "flex";
      els.modalBackdrop.setAttribute("aria-hidden", "false");
      setTimeout(
        () => els.modalBackdrop.querySelector(".modal")?.classList.add("open"),
        20,
      );
      updateCartUI(suf);
    });
    els.closeModal?.addEventListener("click", () => {
      if (!els.modalBackdrop) return;
      els.modalBackdrop.querySelector(".modal")?.classList.remove("open");
      setTimeout(() => {
        els.modalBackdrop.style.display = "none";
        els.modalBackdrop.setAttribute("aria-hidden", "true");
      }, 240);
    });
    els.modalBackdrop?.addEventListener("click", (e) => {
      if (e.target === els.modalBackdrop) {
        els.modalBackdrop.querySelector(".modal")?.classList.remove("open");
        setTimeout(() => {
          els.modalBackdrop.style.display = "none";
          els.modalBackdrop.setAttribute("aria-hidden", "true");
        }, 240);
      }
    });
    els.clearCart?.addEventListener("click", () => {
      cart = {};
      saveCart();
      updateAllCartCounts();
    });
    els.checkout?.addEventListener("click", () => {
      if (Object.keys(cart).length === 0) {
        alert("Корзина пуста");
        return;
      }
      const customer = { name: "", phone: "", address: "" }; // при желании заполнить
      submitOrderToServer(customer);
      cart = {};
      saveCart();
      updateAllCartCounts();
      els.modalBackdrop.querySelector(".modal")?.classList.remove("open");
      setTimeout(() => {
        els.modalBackdrop.style.display = "none";
        els.modalBackdrop.setAttribute("aria-hidden", "true");
      }, 240);
      const form = document.getElementById("checkoutForm");
      form?.querySelector('[name="name"]')?.focus();
    });
  });

  updateAllCartCounts();

  document.querySelectorAll('[id^="themeToggle"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const isDark = document.documentElement.classList.toggle("dark-theme");
      const newTheme = isDark ? "dark" : "light";
      applyTheme(newTheme); // применить переменные корректно
      localStorage.setItem(THEME_KEY, newTheme); // сохранить выбор
    });
  });

  const saved = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(saved);

  // Order buttons open cart
  document.querySelectorAll('[id^="orderNow"]').forEach((btn) => {
    btn.addEventListener("click", () =>
      document.querySelector(".cart-float")?.click(),
    );
  });

  // Contact form demo (prevent reload)
  const contactFormEl = document.getElementById("contactForm");
  console.log("contactFormEl", contactFormEl);
  const toast = document.getElementById("toast");

  if (contactFormEl) {
    contactFormEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      // простая валидация
      const fm = new FormData(contactFormEl);
      let valid = true;
      ["name", "email", "msg"].forEach((k) => {
        const el = contactFormEl.querySelector(`[name="${k}"]`);
        const wrap = el.closest(".field");
        if (!fm.get(k) || fm.get(k).trim() === "") {
          wrap.classList.add("invalid");
          valid = false;
        } else {
          wrap.classList.remove("invalid");
        }
      });
      if (!valid) {
        // краткая анимация ошибки
        contactFormEl.animate(
          [
            { transform: "translateY(0)" },
            { transform: "translateY(-6px)" },
            { transform: "translateY(0)" },
          ],
          { duration: 320 },
        );
        return;
      }

      // имитация отправки
      const submitBtn = document.getElementById("contactSubmit");
      submitBtn.disabled = true;
      submitBtn.textContent = "Отправка...";

      const body = {
        name: fm.get("name") || "",
        email: fm.get("email") || "",
        message: fm.get("msg") || "",
      };

      try {
        const res = await fetch(`/api/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Contact failed");
        contactFormEl.reset();
        toast.hidden = false;
        toast.classList.add("show");
        setTimeout(() => {
          toast.classList.remove("show");
          setTimeout(() => (toast.hidden = true), 320);
        }, 3000);
      } catch (err) {
        console.error(err);
        alert("Не удалось отправить сообщение: " + (err.message || err));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Отправить";
      }
    });

    // убрать подсветку при вводе
    contactFormEl.querySelectorAll("input,textarea").forEach((inp) => {
      inp.addEventListener("input", () =>
        inp.closest(".field")?.classList.remove("invalid"),
      );
    });
  }

  // Keyboard shortcuts
  // window.addEventListener('keydown', e=>{
  //     if(e.key==='m') document.querySelector('a[href="menu.html"]')?.click();
  //     if(e.key==='c') document.querySelector('.cart-float')?.click();
  // });
});

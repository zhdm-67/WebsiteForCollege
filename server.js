const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const Database = require("better-sqlite3");
const cors = require("cors");

const app = express();
const db = new Database(path.resolve(__dirname, "data.db"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total REAL NOT NULL,
  customer_json TEXT
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  name TEXT,
  email TEXT,
  message TEXT
);
`);

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

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/items", (req, res) => {
  res.json(items);
});

// {
//   cart: { "1":2, "3":1 },
//   customer: { name: "...", phone: "...", address: "...", note: "..." }
// }
app.post("/api/orders", (req, res) => {
  try {
    const { cart = {}, customer = null } = req.body;
    const keys = Object.keys(cart);
    if (keys.length === 0) return res.status(400).json({ error: "Empty cart" });

    let total = 0;
    const lineItems = [];
    for (const k of keys) {
      const it = items.find((x) => String(x.id) === String(k));
      if (!it) return res.status(400).json({ error: `Item ${k} not found` });
      const qty = parseInt(cart[k], 10) || 0;
      if (qty <= 0)
        return res.status(400).json({ error: `Invalid qty for ${k}` });
      total += it.price * qty;
      lineItems.push({ id: it.id, name: it.name, price: it.price, qty });
    }

    if (!customer || !customer.name || !customer.phone || !customer.address) {
    return res.status(400).json({ error: 'Customer name, phone and address are required' });
    }
    if (String(customer.name).length > 200) {
    return res.status(400).json({ error: 'Name too long' });
    }
    if (!/^[\d+\-\s()]{6,20}$/.test(customer.phone)) {
    return res.status(400).json({ error: 'Invalid phone' });
    }


    const stmt = db.prepare(
      "INSERT INTO orders (created_at, items_json, total, customer_json) VALUES (?, ?, ?, ?)",
    );
    const info = stmt.run(
      new Date().toISOString(),
      JSON.stringify(lineItems),
      total,
      customer ? JSON.stringify(customer) : null,
    );
    console.log("Добавлен заказ");

    res.json({
      success: true,
      orderId: info.lastInsertRowid,
      total,
      items: lineItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/contact", (req, res) => {
  console.log("contact body:", req.body);
  try {
    const body = req.body || {};
    const name = body.name || null;
    const email = body.email || null;
    const message = body.message || body.msg || null; // <- поддержка msg

    if (!message || String(message).trim() === "") {
      return res.status(400).json({ error: "Message required" });
    }

    const stmt = db.prepare(
      "INSERT INTO contacts (created_at, name, email, message) VALUES (?, ?, ?, ?)",
    );
    const info = stmt.run(new Date().toISOString(), name, email, message);
    console.log("Добавлен контакт");
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/orders", (req, res) => {
  try {
    const rows = db
      .prepare(
        "SELECT id, created_at, items_json, total, customer_json FROM orders ORDER BY id DESC LIMIT 200",
      )
      .all();
    const parsed = rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      items: JSON.parse(r.items_json),
      total: r.total,
      customer: r.customer_json ? JSON.parse(r.customer_json) : null,
    }));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/contacts", (req, res) => {
  try {
    const rows = db
      .prepare(
        "SELECT id, created_at, name, email, message FROM contacts ORDER BY id DESC LIMIT 200",
      )
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

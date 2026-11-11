const express = require('express');
const app = express();
app.use(express.json());

const products = [
  { id: 1, name: 'Keyboard Mekanik', price: 450000, stock: 10 },
  { id: 2, name: 'Mouse Wireless', price: 175000, stock: 25 },
  { id: 3, name: 'Monitor 24 inci', price: 1850000, stock: 5 },
];
const orders = [];

app.get('/products', (req, res) => res.json(products));
app.get('/products/:id', (req, res) => {
  const p = products.find(x => x.id === Number(req.params.id));
  p ? res.json(p) : res.status(404).json({ error: 'Produk tidak ditemukan' });
});

app.post('/orders', (req, res) => {
  const { productId, qty } = req.body || {};
  const p = products.find(x => x.id === productId);
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: 'qty tidak valid' });
  if (p.stock < qty) return res.status(409).json({ error: 'Stok tidak cukup' });
  p.stock -= qty;                         // <-- order mengubah data produk secara langsung
  const order = { id: orders.length + 1, productId, productName: p.name,
                  qty, total: p.price * qty, createdAt: new Date().toISOString() };
  orders.push(order);
  res.status(201).json(order);
});
app.get('/orders', (req, res) => res.json(orders));

app.listen(3000, () => console.log('Monolith di :3000'));

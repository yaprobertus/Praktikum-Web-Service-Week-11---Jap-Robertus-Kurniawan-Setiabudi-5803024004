const express = require('express');
const amqp = require('amqplib');                         // Lab 10
const app = express();
app.use(express.json());

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: { title: 'Order Service', version: '1.0.0', description: 'Pembuatan dan daftar pesanan' },
    servers: [{ url: 'http://localhost:3001' }],
  },
  apis: [__filename],
});
app.get('/openapi.json', (req, res) => res.json(spec));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));

/**
 * @openapi
 * components:
 *   schemas:
 *     OrderRequest:
 *       type: object
 *       required: [productId, qty]
 *       properties:
 *         productId: { type: integer, example: 1 }
 *         qty: { type: integer, minimum: 1, example: 2 }
 *     Order:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         productId: { type: integer, example: 1 }
 *         productName: { type: string, example: Keyboard Mekanik }
 *         qty: { type: integer, example: 2 }
 *         total: { type: integer, example: 900000 }
 *         createdAt: { type: string, format: date-time }
 *     Error:
 *       type: object
 *       properties:
 *         error: { type: string, example: Stok tidak cukup }
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Buat pesanan baru
 *     description: Memanggil product-service untuk mengurangi stok, lalu menyimpan pesanan.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/OrderRequest' }
 *     responses:
 *       201:
 *         description: Pesanan dibuat
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Order' }
 *       400: { description: Input tidak valid, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Produk tidak ditemukan, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: Stok tidak cukup, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       503: { description: product-service tidak tersedia, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *   get:
 *     tags: [Orders]
 *     summary: Daftar semua pesanan
 *     responses:
 *       200:
 *         description: Berhasil
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Order' }
 */


const PRODUCT_URL = (process.env.PRODUCT_SERVICE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const orders = [];

// ---------- Lab 10: publisher RabbitMQ ----------
const AMQP_URL = process.env.AMQP_URL || 'amqp://localhost';
let channel = null;

async function connectQueue() {
  try {
    const conn = await amqp.connect(AMQP_URL);
    conn.on('error', () => {});
    conn.on('close', () => { channel = null; setTimeout(connectQueue, 3000); });
    channel = await conn.createChannel();
    await channel.assertExchange('orders', 'fanout', { durable: true });
    console.log('terhubung ke RabbitMQ');
  } catch (e) {
    console.error('RabbitMQ belum tersedia, coba lagi dalam 3 detik');
    setTimeout(connectQueue, 3000);
  }
}

function publishOrderCreated(order) {
  if (!channel) { console.warn('channel tidak tersedia, event TIDAK terkirim:', order.id); return false; }
  const body = Buffer.from(JSON.stringify({ type: 'order.created', data: order }));
  return channel.publish('orders', '', body,
    { persistent: true, contentType: 'application/json', messageId: `order-${order.id}` });
}
// -------------------------------------------------

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order-service' }));

app.post('/orders', async (req, res) => {
  const { productId, qty } = req.body || {};
  if (!Number.isInteger(productId) || !Number.isInteger(qty) || qty < 1)
    return res.status(400).json({ error: 'productId dan qty harus bilangan bulat > 0' });

  // Tidak ada array products di sini: stok dikurangi lewat API product-service (timeout 2 detik).
  let resp, data;
  try {
    resp = await fetch(`${PRODUCT_URL}/products/${productId}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty }),
      signal: AbortSignal.timeout(2000),
    });
    data = await resp.json();
  } catch (err) {
    return res.status(503).json({ error: 'product-service tidak tersedia, coba lagi nanti' });
  }

  if (!resp.ok) return res.status(resp.status).json(data);   // 404 / 409 diteruskan apa adanya

  const order = { id: orders.length + 1, productId, productName: data.name,
                  qty, total: data.price * qty, createdAt: new Date().toISOString() };
  orders.push(order);
  publishOrderCreated(order);                // Lab 10: terbitkan event, tidak menunggu consumer
  res.status(201).json(order);
});

app.get('/orders', (req, res) => res.json(orders));

app.use((req, res) => res.status(404).json({ error: 'Route tidak ditemukan di order-service' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Body JSON tidak valid' });
  console.error(err);
  res.status(500).json({ error: 'Kesalahan internal server' });
});

app.listen(process.env.PORT || 3001, () => {
  console.log('order-service di :' + (process.env.PORT || 3001));
  connectQueue();                            // Lab 10: sambung ke RabbitMQ sekali saat start
});

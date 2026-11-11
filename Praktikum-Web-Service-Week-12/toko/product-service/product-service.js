const express = require('express');
const app = express();
app.use(express.json());

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: { title: 'Product Service', version: '1.0.0', description: 'Data produk dan stok' },
    servers: [{ url: 'http://localhost:3000' }],
  },
  apis: [__filename],                           // baca anotasi dari file ini
});
app.get('/openapi.json', (req, res) => res.json(spec));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));

/**
 * @openapi
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         name: { type: string, example: Keyboard Mekanik }
 *         price: { type: integer, example: 450000 }
 *         stock: { type: integer, example: 10 }
 *         category: { type: string, example: Periferal }
 *     ReserveRequest:
 *       type: object
 *       required: [qty]
 *       properties:
 *         qty: { type: integer, minimum: 1, example: 2 }
 *     Error:
 *       type: object
 *       properties:
 *         error: { type: string, example: Produk tidak ditemukan }
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: Daftar semua produk
 *     responses:
 *       200:
 *         description: Berhasil
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Product' }
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Detail satu produk
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Berhasil
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       404: { description: Produk tidak ditemukan, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 * /products/{id}/reserve:
 *   post:
 *     tags: [Products]
 *     summary: Kurangi stok produk (dipanggil service lain)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ReserveRequest' }
 *     responses:
 *       200:
 *         description: Stok berhasil dikurangi
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       400: { description: qty tidak valid, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Produk tidak ditemukan, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: Stok tidak cukup, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */


const products = [
   { id: 1, name: 'Keyboard Mekanik', price: 450000, stock: 10, category: 'Periferal' },
   { id: 2, name: 'Mouse Wireless', price: 175000, stock: 25, category: 'Periferal' },
   { id: 3, name: 'Monitor 24 inci', price: 1850000, stock: 5, category: 'Periferal' },
];

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'product-service' }));

app.get('/products', (req, res) => res.json(products));
app.get('/products/:id', (req, res) => {
  const p = products.find(x => x.id === Number(req.params.id));
  p ? res.json(p) : res.status(404).json({ error: 'Produk tidak ditemukan' });
});

// endpoint baru: dipanggil service lain untuk mengurangi stok
app.post('/products/:id/reserve', (req, res) => {
  const p = products.find(x => x.id === Number(req.params.id));
  const qty = (req.body || {}).qty;
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: 'qty tidak valid' });
  if (p.stock < qty) return res.status(409).json({ error: 'Stok tidak cukup' });
  p.stock -= qty;
  res.json(p);
});

app.use((req, res) => res.status(404).json({ error: 'Route tidak ditemukan di product-service' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Body JSON tidak valid' });
  console.error(err);
  res.status(500).json({ error: 'Kesalahan internal server' });
});

app.listen(process.env.PORT || 3000, () => console.log('product-service di :' + (process.env.PORT || 3000)));

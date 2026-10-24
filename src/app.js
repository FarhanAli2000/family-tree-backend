import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import routes from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// CORS_ORIGIN: comma-separated list of allowed frontend URLs; unset allows any origin.
// Trailing slashes are dropped: browsers send the origin without one.
const origins = process.env.CORS_ORIGIN?.split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);
app.use(cors(origins?.length && !origins.includes('*') ? { origin: origins } : undefined));
app.use(express.json());

app.get('/', (req, res) => res.json({ ok: true, service: 'family-tree-backend' }));

// Copy the Family Tree Maker "Media" folder's files into server/media to show photos.
app.use('/media', express.static(path.resolve(__dirname, '../media')));

app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});
app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

export default app;

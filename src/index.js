import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import routes from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());

// Copy the Family Tree Maker "Media" folder's files into server/media to show photos.
app.use('/media', express.static(path.resolve(__dirname, '../media')));
app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

await connectDB();
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

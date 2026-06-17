import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import gamesRouter from './routes/games.js';
import realmsRouter from './routes/realms.js';
import mapRouter from './routes/map.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/games', gamesRouter);
app.use('/api/realms', realmsRouter);
app.use('/api/map', mapRouter);

app.listen(PORT, () => console.log(`Server listening on :${PORT}`));

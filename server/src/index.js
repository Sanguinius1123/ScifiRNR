import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import gamesRouter from './routes/games.js';
import realmsRouter from './routes/realms.js';
import mapRouter from './routes/map.js';
import gmRouter from './routes/gm.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)) }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/games', gamesRouter);
app.use('/api/realms', realmsRouter);
app.use('/api/map', mapRouter);
app.use('/api/gm', gmRouter);

app.listen(PORT, () => console.log(`Server listening on :${PORT}`));

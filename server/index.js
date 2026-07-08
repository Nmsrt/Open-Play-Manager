import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, 'data.js');

const app = express();
app.use(cors());
app.use(express.json());

async function loadData() {
  const mod = await import(pathToFileURL(dataPath).href + '?v=' + Date.now());
  return mod.default;
}

async function saveData(data) {
  const file = 'export default ' + JSON.stringify(data, null, 2) + ';\n';
  await fs.writeFile(dataPath, file, 'utf8');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function token() {
  return crypto.randomBytes(24).toString('hex');
}

async function getUser(req) {
  const auth = req.headers.authorization || '';
  const sessionToken = auth.replace('Bearer ', '');
  if (!sessionToken) return null;
  const data = await loadData();
  const session = data.sessions.find((s) => s.token === sessionToken);
  if (!session) return null;
  return data.users.find((u) => u.id === session.userId) || null;
}

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required.' });
  const data = await loadData();
  const normalizedEmail = email.toLowerCase().trim();
  if (data.users.some((u) => u.email === normalizedEmail)) return res.status(409).json({ error: 'Email already exists.' });
  const user = { id: crypto.randomUUID(), name: name.trim(), email: normalizedEmail, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
  const session = { token: token(), userId: user.id, createdAt: new Date().toISOString() };
  data.users.push(user);
  data.sessions.push(session);
  await saveData(data);
  res.json({ token: session.token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const data = await loadData();
  const user = data.users.find((u) => u.email === String(email || '').toLowerCase().trim());
  if (!user || user.passwordHash !== hashPassword(password || '')) return res.status(401).json({ error: 'Invalid email or password.' });
  const session = { token: token(), userId: user.id, createdAt: new Date().toISOString() };
  data.sessions.push(session);
  await saveData(data);
  res.json({ token: session.token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/me', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });
  res.json({ id: user.id, name: user.name, email: user.email });
});

app.get('/api/events', async (req, res) => {
  const data = await loadData();
  res.json(data.events.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)));
});

app.post('/api/events', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Login required.' });
  const { title, location, date, time, maxPlayers, notes } = req.body;
  if (!title || !location || !date || !time) return res.status(400).json({ error: 'Title, location, date, and time are required.' });
  const data = await loadData();
  const event = { id: crypto.randomUUID(), title, location, date, time, maxPlayers: Number(maxPlayers || 10), notes: notes || '', createdBy: user.id, createdAt: new Date().toISOString(), players: [] };
  data.events.unshift(event);
  await saveData(data);
  res.json(event);
});

app.put('/api/events/:id', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Login required.' });
  const data = await loadData();
  const event = data.events.find((e) => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  if (event.createdBy !== user.id) return res.status(403).json({ error: 'Only the creator can edit this event.' });
  Object.assign(event, {
    title: req.body.title ?? event.title,
    location: req.body.location ?? event.location,
    date: req.body.date ?? event.date,
    time: req.body.time ?? event.time,
    maxPlayers: Number(req.body.maxPlayers ?? event.maxPlayers),
    notes: req.body.notes ?? event.notes
  });
  await saveData(data);
  res.json(event);
});

app.delete('/api/events/:id', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Login required.' });
  const data = await loadData();
  const event = data.events.find((e) => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  if (event.createdBy !== user.id) return res.status(403).json({ error: 'Only the creator can delete this event.' });
  data.events = data.events.filter((e) => e.id !== req.params.id);
  await saveData(data);
  res.json({ ok: true });
});

app.post('/api/events/:id/join', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Login required.' });
  const data = await loadData();
  const event = data.events.find((e) => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  const player = event.players.find((p) => p.userId === user.id || p.name === user.name);
  const payload = { userId: user.id, name: user.name, position: req.body.position || 'ANY', status: req.body.status || 'Going' };
  if (player) Object.assign(player, payload);
  else event.players.push(payload);
  await saveData(data);
  res.json(event);
});

app.delete('/api/events/:id/join', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Login required.' });
  const data = await loadData();
  const event = data.events.find((e) => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  event.players = event.players.filter((p) => p.userId !== user.id && p.name !== user.name);
  await saveData(data);
  res.json(event);
});

app.listen(4000, () => console.log('OpenPlay API running on http://localhost:4000'));

import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = 'http://localhost:4000/api';
const positions = ['ANY', 'GK', 'DEF', 'MID', 'FWD'];
const statuses = ['Going', 'Maybe', 'Out'];

function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('openplay_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('openplay_user') || 'null'));

  function saveAuth(nextToken, nextUser) {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem('openplay_token', nextToken);
    localStorage.setItem('openplay_user', JSON.stringify(nextUser));
  }

  function logout() {
    setToken('');
    setUser(null);
    localStorage.removeItem('openplay_token');
    localStorage.removeItem('openplay_user');
  }

  return { token, user, saveAuth, logout };
}

async function api(path, options = {}, token = '') {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function AuthPanel({ saveAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await api(mode === 'login' ? '/auth/login' : '/auth/register', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      saveAuth(data.token, data.user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="auth-card glass">
      <div>
        <p className="eyebrow">OpenPlay</p>
        <h1>Organize football games without messy group chats.</h1>
        <p className="muted">Create matches, manage slots, and let players mark Going, Maybe, or Out.</p>
      </div>
      <form onSubmit={submit} className="auth-form">
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Register</button>
        </div>
        {mode === 'register' && <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <p className="error">{error}</p>}
        <button className="primary">{mode === 'login' ? 'Login' : 'Create account'}</button>
      </form>
    </section>
  );
}

function EventForm({ token, onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', location: '', date: '', time: '', maxPlayers: 10, notes: '' });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/events', { method: 'POST', body: JSON.stringify(form) }, token);
      setForm({ title: '', location: '', date: '', time: '', maxPlayers: 10, notes: '' });
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!open) return <button className="primary" onClick={() => setOpen(true)}>+ Create match</button>;

  return (
    <form className="event-form glass" onSubmit={submit}>
      <h2>Create match</h2>
      <div className="grid2">
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        <input type="number" min="2" placeholder="Max players" value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: e.target.value })} />
      </div>
      <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      {error && <p className="error">{error}</p>}
      <div className="actions"><button className="primary">Save match</button><button type="button" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}

function EventCard({ event, token, user, refresh }) {
  const [position, setPosition] = useState('ANY');
  const [status, setStatus] = useState('Going');
  const going = event.players.filter((p) => p.status === 'Going').length;
  const mine = event.players.find((p) => p.userId === user?.id || p.name === user?.name);
  const isCreator = event.createdBy === user?.id;

  async function join() {
    await api(`/events/${event.id}/join`, { method: 'POST', body: JSON.stringify({ position, status }) }, token);
    refresh();
  }

  async function leave() {
    await api(`/events/${event.id}/join`, { method: 'DELETE' }, token);
    refresh();
  }

  async function remove() {
    await api(`/events/${event.id}`, { method: 'DELETE' }, token);
    refresh();
  }

  return (
    <article className="event-card glass">
      <div className="event-top">
        <div>
          <h3>{event.title}</h3>
          <p className="muted">📍 {event.location}</p>
          <p className="muted">🗓 {event.date} · {event.time}</p>
        </div>
        <div className="slot"><strong>{going}</strong><span>/ {event.maxPlayers}</span></div>
      </div>
      {event.notes && <p>{event.notes}</p>}
      <div className="join-row">
        <select value={position} onChange={(e) => setPosition(e.target.value)}>{positions.map((p) => <option key={p}>{p}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
        <button onClick={join}>{mine ? 'Update' : 'Join'}</button>
        {mine && <button onClick={leave}>Leave</button>}
        {isCreator && <button className="danger" onClick={remove}>Delete</button>}
      </div>
      <div className="players">
        {event.players.length === 0 ? <span className="muted">No players yet.</span> : event.players.map((p, i) => (
          <span className={`chip ${p.status.toLowerCase()}`} key={i}>{p.name} · {p.position} · {p.status}</span>
        ))}
      </div>
    </article>
  );
}

function Dashboard({ token, user, logout }) {
  const [events, setEvents] = useState([]);
  const [q, setQ] = useState('');

  async function load() {
    setEvents(await api('/events'));
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => events.filter((e) => `${e.title} ${e.location}`.toLowerCase().includes(q.toLowerCase())), [events, q]);

  return (
    <>
      <header className="nav">
        <div><strong>⚽ OpenPlay</strong><span>File-powered prototype</span></div>
        <div className="nav-right"><span>{user.name}</span><button onClick={logout}>Logout</button></div>
      </header>
      <main className="container">
        <section className="hero glass">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>Manage your next football open play.</h1>
            <p className="muted">All accounts, sessions, and matches are saved inside <code>server/data.js</code>.</p>
          </div>
          <EventForm token={token} onCreated={load} />
        </section>
        <input className="search" placeholder="Search matches..." value={q} onChange={(e) => setQ(e.target.value)} />
        <section className="event-grid">
          {filtered.map((event) => <EventCard key={event.id} event={event} token={token} user={user} refresh={load} />)}
        </section>
      </main>
    </>
  );
}

function App() {
  const auth = useAuth();
  return auth.user ? <Dashboard {...auth} /> : <main className="container"><AuthPanel saveAuth={auth.saveAuth} /></main>;
}

createRoot(document.getElementById('root')).render(<App />);

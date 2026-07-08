import { Routes, Route } from 'react-router-dom';
import HomePage from '@/pages/public/HomePage';
import SessionPage from '@/pages/public/SessionPage';

function Placeholder({ name }: { name: string }) {
  return <main className="mx-auto max-w-2xl p-8 text-muted-foreground">{name} — coming soon</main>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/session/:id" element={<SessionPage />} />
      <Route path="/admin/login" element={<Placeholder name="Admin login" />} />
      <Route path="/admin/*" element={<Placeholder name="Admin" />} />
    </Routes>
  );
}

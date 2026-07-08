import { Routes, Route } from 'react-router-dom';

function Placeholder({ name }: { name: string }) {
  return <main className="mx-auto max-w-2xl p-8 text-muted-foreground">{name} — coming soon</main>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder name="Home" />} />
      <Route path="/session/:id" element={<Placeholder name="Session" />} />
      <Route path="/admin/login" element={<Placeholder name="Admin login" />} />
      <Route path="/admin/*" element={<Placeholder name="Admin" />} />
    </Routes>
  );
}

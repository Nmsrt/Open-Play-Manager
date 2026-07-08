import { Outlet } from 'react-router-dom';

// Public surface only (not admin): a fixed, dimmed pitch-side photo behind
// every page. A translucent warm-white scrim keeps the dim-white theme and
// text contrast intact over the photo.
export default function PublicLayout() {
  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/background.jpg')" }}
      />
      <div aria-hidden className="fixed inset-0 -z-10 bg-background/30" />
      <Outlet />
    </div>
  );
}

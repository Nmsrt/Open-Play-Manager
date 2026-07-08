import { useEffect } from 'react';

// Toggles the dark admin theme on <html> instead of a wrapper div so it also
// covers Radix Dialog portals, which render into document.body (still a
// descendant of html) rather than wherever the trigger lives in the tree.
export function useAdminTheme() {
  useEffect(() => {
    document.documentElement.classList.add('admin-theme');
    return () => document.documentElement.classList.remove('admin-theme');
  }, []);
}

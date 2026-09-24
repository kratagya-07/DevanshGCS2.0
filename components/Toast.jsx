import { useEffect } from 'react';

export default function Toast({ toasts, setToasts }) {
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toasts]);

  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'rgba(0,0,0,0.85)',
          color: 'var(--text)',
          padding: '0.75rem 1rem',
          borderRadius: '0.4rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          maxWidth: '300px',
          fontFamily: "Space Grotesk, sans-serif",
          borderLeft: '4px solid var(--accent-a)'
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

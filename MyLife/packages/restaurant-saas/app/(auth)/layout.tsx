export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--surface-low)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '2rem',
      }}>
        {children}
      </div>
    </div>
  );
}

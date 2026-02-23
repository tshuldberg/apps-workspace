export default function Home() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontSize: '3rem',
          fontWeight: 700,
          color: '#F4EDE2',
          marginBottom: '0.75rem',
          letterSpacing: '-0.02em',
        }}
      >
        MyBooks
      </h1>
      <p
        style={{
          fontSize: '1.25rem',
          color: '#C9894D',
          marginBottom: '2rem',
          fontWeight: 500,
        }}
      >
        Your reading list. Not Amazon's ad profile.
      </p>
      <div
        style={{
          padding: '1.5rem 2.5rem',
          backgroundColor: '#1A1610',
          borderRadius: '12px',
          border: '1px solid #2A2520',
        }}
      >
        <p style={{ color: '#A99E8E', fontSize: '1rem' }}>
          Web app coming soon.
        </p>
      </div>
      <p
        style={{
          marginTop: '3rem',
          fontSize: '0.875rem',
          color: '#6B6155',
          maxWidth: '420px',
          lineHeight: 1.7,
        }}
      >
        Private book tracking powered by Open Library. No accounts, no cloud, no
        telemetry. $4.99 once, forever.
      </p>
    </main>
  );
}

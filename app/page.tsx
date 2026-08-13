export default function HomePage() {
  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div>
        <h1 style={{ fontSize: '48px', margin: '0 0 20px 0' }}>MÜÜGIBINGO</h1>
        <p style={{ fontSize: '18px', color: '#666', margin: '0 0 30px 0' }}>CVK/CVM 2026</p>
        <a href="/auth" style={{ 
          display: 'inline-block',
          padding: '12px 24px',
          background: '#0066cc',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '8px'
        }}>
          Alusta
        </a>
      </div>
    </div>
  )
}
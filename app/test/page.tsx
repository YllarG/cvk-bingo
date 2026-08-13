'use client'

export default function TestPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>ENV Test</h1>
      <p>URL: <code>{process.env.NEXT_PUBLIC_SUPABASE_URL}</code></p>
      <p>KEY: <code>{process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20)}...</code></p>
      
      {process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? (
        <p style={{ color: 'green' }}>✅ Env variable'd OK</p>
      ) : (
        <p style={{ color: 'red' }}>❌ Env variable'd puudu!</p>
      )}
    </div>
  )
}
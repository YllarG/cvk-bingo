'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function PlayerPage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (localStorage.getItem('player_id') && localStorage.getItem('card_id')) {
      router.push('/bingo')
    }
  }, [])

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert([{ 
          email: `${name.toLowerCase()}-${Date.now()}@bingo.local`,
          name 
        }])
        .select()
        .single()

      if (playerError) throw playerError

      const { data: card, error: cardError } = await supabase
        .from('cards')
        .insert([{ player_id: player.id }])
        .select()
        .single()

      if (cardError) throw cardError

      await supabase
        .from('marked_squares')
        .insert([{ card_id: card.id, square_number: 12 }])

      localStorage.setItem('player_id', player.id)
      localStorage.setItem('player_name', name)
      localStorage.setItem('card_id', card.id)

      router.push('/bingo')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Viga')
      alert('Viga: ' + JSON.stringify(err, null, 2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'Arial'
    }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '20px' }}>
      <h1 style={{
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 800,
          fontSize: '48px',
          color: '#2D2D2D',
          letterSpacing: '-0.5px',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          MÜÜGIBINGO
        </h1>
        <p style={{ textAlign: 'center', color: '#5B7795', marginBottom: '40px' }}>
          CVK / CVM 2026
        </p>

        <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            placeholder="Sisesta oma nimi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: '12px',
              border: '1px solid #D9DEE5',
              borderRadius: '8px',
              fontSize: '16px'
            }}
            required
          />
          {error && <p style={{ color: '#c00', fontSize: '14px' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !name}
            style={{
              padding: '12px',
              background: loading || !name ? '#D9DEE5' : '#0090FF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: loading || !name ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Laadin...' : 'Alusta mängu'}
          </button>
        </form>
      </div>
    </div>
  )
}
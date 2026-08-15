'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function PlayerPage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [taken, setTaken] = useState(false)
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
    setTaken(false)

    const clean = name.trim()

    try {
      const { data: existing } = await supabase
        .from('players')
        .select('name')
        .ilike('name', clean)

      if (existing && existing.length > 0) {
        setTaken(true)
        setLoading(false)
        return
      }

      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert([{
          email: `${clean.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}@bingo.local`,
          name: clean
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
      localStorage.setItem('player_name', clean)
      localStorage.setItem('card_id', card.id)

      router.push('/bingo')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Midagi läks valesti')
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
      fontFamily: 'Montserrat, sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: '420px', padding: '20px' }}>
        <h1 style={{
          fontWeight: 800,
          fontSize: '48px',
          color: '#2D2D2D',
          letterSpacing: '-0.5px',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          MÜÜGIBINGO
        </h1>
        <p style={{ textAlign: 'center', color: '#5B7795', marginBottom: '40px', fontSize: '14px' }}>
          CVK / CVM 2026
        </p>

        <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            placeholder="Sisesta oma pärisnimi"
            value={name}
            onChange={(e) => { setName(e.target.value); setTaken(false) }}
            style={{
              fontFamily: 'inherit',
              padding: '12px',
              border: taken ? '1px solid #0090FF' : '1px solid #D9DEE5',
              borderRadius: '8px',
              fontSize: '16px'
            }}
            required
          />

          {taken && (
            <div style={{
              background: '#E7F4FF',
              border: '1px solid #0090FF',
              borderRadius: '8px',
              padding: '14px 16px',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#2D2D2D'
            }}>
              <strong>Nimi „{name.trim()}" on juba kasutusel.</strong>
              <p style={{ margin: '8px 0 0 0' }}>
                Kui see oled siiski sina, siis proovid ilmselt teisest seadmest sisse saada.
                Kaart on seotud selle seadme ja brauseriga, kust mängu alustasid.
              </p>
              <p style={{ margin: '8px 0 0 0' }}>
                Kui oled uus mängija, vali endale teine nimi.
              </p>
            </div>
          )}

          {error && (
            <p style={{ color: '#c00', fontSize: '14px', margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            style={{
              fontFamily: 'inherit',
              padding: '12px',
              background: loading || !name.trim() ? '#D9DEE5' : '#0090FF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: loading || !name.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Kontrollin...' : 'Alusta mängu'}
          </button>

          <p style={{ fontSize: '13px', color: '#5B7795', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>
            Kaart jääb seotuks selle seadme ja brauseriga. Mängi kogu aeg samast kohast.
          </p>
        </form>
      </div>
    </div>
  )
}
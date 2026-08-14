'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const PATTERN_POINTS: { [key: string]: number } = {
  '1. rida': 6,
  '2. rida': 6,
  '3. rida': 4,
  '4. rida': 6,
  '5. rida': 6,
  'B tulp': 6,
  'I tulp': 6,
  'N tulp': 4,
  'G tulp': 6,
  'O tulp': 6,
  'Diagonaal 1': 4,
  'Diagonaal 2': 4,
  'Nurgad': 4,
  'Täismäng': 30
}

type Entry = {
  name: string
  patterns: string[]
  points: number
  firstWin: string
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    load()

    const channel = supabase
      .channel('leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wins' }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const load = async () => {
    const { data } = await supabase
      .from('wins')
      .select('pattern_type, won_at, players!inner(name)')
      .order('won_at', { ascending: true })

    const byPlayer: { [key: string]: Entry } = {}

    data?.forEach((w: any) => {
      const name = w.players.name
      if (!byPlayer[name]) {
        byPlayer[name] = { name, patterns: [], points: 0, firstWin: w.won_at }
      }
      byPlayer[name].patterns.push(w.pattern_type)
      byPlayer[name].points += PATTERN_POINTS[w.pattern_type] || 0
    })

    const sorted = Object.values(byPlayer).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      return new Date(a.firstWin).getTime() - new Date(b.firstWin).getTime()
    })

    setEntries(sorted)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', padding: '20px', fontFamily: 'Arial' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '32px',
            color: '#2D2D2D',
            letterSpacing: '-0.5px',
            margin: 0
          }}>Edetabel</h1>
          <a href="/bingo" style={{
            padding: '8px 16px',
            background: '#0090FF',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '6px'
          }}>
            Tagasi mängu
          </a>
        </div>

        {loading ? (
          <p style={{ color: '#666' }}>Laadin...</p>
        ) : entries.length === 0 ? (
          <p style={{ color: '#666' }}>Veel ühtegi võitu pole.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {entries.map((e, idx) => (
              <div key={e.name} style={{
                padding: '16px',
                border: '1px solid #BAC7D5',
                borderRadius: '8px',
                background: idx === 0 ? '#E7F4FF' : 'white'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {idx + 1}. {e.name}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0090FF', lineHeight: 1 }}>
                      {e.points}
                    </div>
                    <div style={{ fontSize: '11px', color: '#5B7795' }}>
                      punkti · {e.patterns.length} võitu
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '10px' }}>
                  {e.patterns.map((p, i) => (
                    <span key={i} style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      background: '#E7F4FF',
                      color: '#2D2D2D',
                      borderRadius: '12px',
                      fontSize: '12px',
                      margin: '2px 4px 2px 0'
                    }}>{p} · {PATTERN_POINTS[p]}p</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '32px', padding: '16px', background: '#f8f8f8', borderRadius: '8px', fontSize: '13px', color: '#5B7795', lineHeight: 1.6 }}>
          <strong style={{ color: '#2D2D2D' }}>Punktid</strong><br />
          Neli märgistust (3. rida, N tulp, diagonaalid, nurgad) — 4 punkti.<br />
          Viis märgistust (ülejäänud read ja tulbad) — 6 punkti.<br />
          Täismäng — 30 punkti.<br /><br />
          Iga mustri saab võita ainult üks kord — esimene, kes selle täidab.
          Mäng kestab 31.12.2026.
        </div>
      </div>
    </div>
  )
}
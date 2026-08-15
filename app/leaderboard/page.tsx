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
  'MÜÜGIBINGO': 15,
  'Täismäng': 30
}

const PATTERN_SHAPES: { [key: string]: number[] } = {
  '1. rida': [0, 1, 2, 3, 4],
  '2. rida': [5, 6, 7, 8, 9],
  '3. rida': [10, 11, 12, 13, 14],
  '4. rida': [15, 16, 17, 18, 19],
  '5. rida': [20, 21, 22, 23, 24],
  'B tulp': [0, 5, 10, 15, 20],
  'I tulp': [1, 6, 11, 16, 21],
  'N tulp': [2, 7, 12, 17, 22],
  'G tulp': [3, 8, 13, 18, 23],
  'O tulp': [4, 9, 14, 19, 24],
  'Diagonaal 1': [0, 6, 12, 18, 24],
  'Diagonaal 2': [4, 8, 12, 16, 20],
  'Nurgad': [0, 4, 20, 24],
  'MÜÜGIBINGO': [1, 10, 18, 23, 24],
  'Täismäng': Array.from({ length: 25 }, (_, i) => i)
}

const ALL_PATTERNS = Object.keys(PATTERN_SHAPES)

function MiniCard({ pattern, taken, hidden }: { pattern: string; taken: boolean; hidden?: boolean }) {
  const cells = PATTERN_SHAPES[pattern] || []
  const active = taken ? '#BAC7D5' : '#0090FF'

  if (hidden) {
    return (
      <div style={{
        width: '52px', height: '52px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', border: '1px solid #E7F4FF', borderRadius: '4px',
        color: taken ? '#BAC7D5' : '#0090FF', fontWeight: 700, fontSize: '18px'
      }}>?</div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: '2px',
      width: '52px'
    }}>
      {Array.from({ length: 25 }, (_, i) => (
        <div key={i} style={{
          aspectRatio: '1',
          borderRadius: '1px',
          background: cells.includes(i) ? active : '#F0F4F8'
        }} />
      ))}
    </div>
  )
}

type Entry = {
  name: string
  patterns: string[]
  points: number
  firstWin: string
}

type Event = {
  name: string
  pattern: string
  at: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'äsja'
  if (min < 60) return `${min} min tagasi`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} t tagasi`
  const d = Math.floor(h / 24)
  if (d === 1) return 'eile'
  return `${d} päeva tagasi`
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [claimed, setClaimed] = useState<{ [key: string]: string }>({})
  const [events, setEvents] = useState<Event[]>([])
  const [monthTop, setMonthTop] = useState<Entry[]>([])
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
    const byPattern: { [key: string]: string } = {}

    data?.forEach((w: any) => {
      const name = w.players.name
      if (!byPlayer[name]) {
        byPlayer[name] = { name, patterns: [], points: 0, firstWin: w.won_at }
      }
      byPlayer[name].patterns.push(w.pattern_type)
      byPlayer[name].points += PATTERN_POINTS[w.pattern_type] || 0
      byPattern[w.pattern_type] = name
    })

    const sorted = Object.values(byPlayer).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      return new Date(a.firstWin).getTime() - new Date(b.firstWin).getTime()
    })

    const recent: Event[] = (data || [])
      .map((w: any) => ({ name: w.players.name, pattern: w.pattern_type, at: w.won_at }))
      .reverse()
      .slice(0, 15)

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const byMonth: { [key: string]: Entry } = {}

    data?.forEach((w: any) => {
      if (new Date(w.won_at).getTime() < monthStart) return
      const name = w.players.name
      if (!byMonth[name]) {
        byMonth[name] = { name, patterns: [], points: 0, firstWin: w.won_at }
      }
      byMonth[name].patterns.push(w.pattern_type)
      byMonth[name].points += PATTERN_POINTS[w.pattern_type] || 0
    })

    const monthSorted = Object.values(byMonth)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        return new Date(a.firstWin).getTime() - new Date(b.firstWin).getTime()
      })
      .slice(0, 3)

    setMonthTop(monthSorted)

    setEntries(sorted)
    setClaimed(byPattern)
    setEvents(recent)
    setLoading(false)
  }

  const freeCount = ALL_PATTERNS.filter(p => !claimed[p]).length
  const freePoints = ALL_PATTERNS
    .filter(p => !claimed[p])
    .reduce((sum, p) => sum + PATTERN_POINTS[p], 0)

  return (
    <div style={{ minHeight: '100vh', padding: '20px', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{
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
            borderRadius: '6px',
            fontSize: '14px'
          }}>
            Tagasi mängu
          </a>
        </div>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

          <div style={{ flex: '1 1 460px', minWidth: '300px' }}>

            {loading ? (
              <p style={{ color: '#5B7795', fontSize: '14px' }}>Laadin...</p>
            ) : entries.length === 0 ? (
              <p style={{ color: '#5B7795', fontSize: '14px' }}>Veel ühtegi võitu pole.</p>
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
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#2D2D2D' }}>
                        {idx + 1}. {e.name}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#0090FF', lineHeight: 1 }}>
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

            <h2 style={{
              fontWeight: 700,
              fontSize: '20px',
              color: '#2D2D2D',
              marginTop: '40px',
              marginBottom: '4px'
            }}>Mustrid</h2>
            <p style={{ fontSize: '14px', color: '#5B7795', margin: '0 0 16px 0' }}>
              Veel vaba: {freeCount} mustrit, {freePoints} punkti
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#2D2D2D' }}>
              <thead>
                <tr style={{ background: '#E7F4FF' }}>
                  <th style={{ padding: '8px', width: '60px' }}></th>
                  <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600 }}>Muster</th>
                  <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>Punkte</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600 }}>Võitja</th>
                </tr>
              </thead>
              <tbody>
                {ALL_PATTERNS.map(p => {
                  const winner = claimed[p]
                  return (
                    <tr key={p} style={{ borderBottom: '1px solid #E7F4FF' }}>
                      <td style={{ padding: '8px' }}>
                        <MiniCard
                          pattern={p}
                          taken={!!winner}
                          hidden={p === 'MÜÜGIBINGO' && !winner}
                        />
                      </td>
                      <td style={{ padding: '8px', color: winner ? '#9CA3AF' : '#2D2D2D' }}>
                        {p === 'MÜÜGIBINGO' ? 'MÜÜGIBINGO (salajane)' : p}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: winner ? '#9CA3AF' : '#2D2D2D' }}>
                        {PATTERN_POINTS[p]}
                      </td>
                      <td style={{ padding: '8px', color: winner ? '#9CA3AF' : '#0090FF' }}>
                        {winner || 'vaba'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ flex: '1 1 260px', minWidth: '260px' }}>
          <h2 style={{
              fontWeight: 700,
              fontSize: '20px',
              color: '#2D2D2D',
              margin: '0 0 4px 0'
            }}>Kuu tegija</h2>
            <p style={{ fontSize: '13px', color: '#5B7795', margin: '0 0 12px 0' }}>
              {new Date().toLocaleDateString('et-EE', { month: 'long', year: 'numeric' })}
            </p>

            {monthTop.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#5B7795', marginBottom: '32px' }}>
                Sel kuul pole veel ühtegi võitu.
              </p>
            ) : (
              <div style={{ marginBottom: '32px' }}>
                {monthTop.map((m, i) => (
                  <div key={m.name} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: i === 0 ? '#E7F4FF' : 'white',
                    border: i === 0 ? 'none' : '1px solid #E7F4FF',
                    marginBottom: '6px',
                    fontSize: '14px',
                    color: '#2D2D2D'
                  }}>
                    <span>
                      <strong>{i + 1}.</strong> {m.name}
                    </span>
                    <span style={{ fontWeight: 700, color: '#0090FF' }}>
                      {m.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <h2 style={{
              fontWeight: 700,
              fontSize: '20px',
              color: '#2D2D2D',
              margin: '0 0 16px 0'
            }}>Viimased võidud</h2>

            {events.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#5B7795' }}>Veel midagi pole juhtunud.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {events.map((e, i) => (
                  <div key={i} style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #E7F4FF',
                    fontSize: '14px',
                    color: '#2D2D2D',
                    lineHeight: 1.5
                  }}>
                    <strong>{e.name}</strong> võttis mustri {e.pattern}
                    <div style={{ fontSize: '12px', color: '#5B7795', marginTop: '2px' }}>
                      {timeAgo(e.at)} · {PATTERN_POINTS[e.pattern]} punkti
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '32px', padding: '16px', background: '#F6FBFF', borderRadius: '8px', fontSize: '14px', color: '#2D2D2D', lineHeight: 1.6 }}>
          Punkte annab ainult terve muster. Iga mustri saab võita ainult üks kord — esimene, kes selle täidab.
          Mäng kestab 31.12.2026 või täismängu võiduni.
          {' '}
          <a href="/bingo" style={{ color: '#0090FF' }}>Täpsed reeglid ja punktitabel leiad mängulehelt.</a>
        </div>
      </div>
    </div>
  )
}
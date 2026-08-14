'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const ADMIN_PASSWORD = 'BINGO'

type Row = {
  id: string
  name: string
  created_at: string
  wins: number
  marked: number
}

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [pw, setPw] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [claimed, setClaimed] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (unlocked) load()
  }, [unlocked])

  const load = async () => {
    setLoading(true)

    const { data: players } = await supabase
      .from('players')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })

    const { data: winsData } = await supabase.from('wins').select('player_id')
    const { data: cardsData } = await supabase.from('cards').select('id, player_id')
    const { data: markedData } = await supabase.from('marked_squares').select('card_id')
    const { data: claimedData } = await supabase
      .from('claimed_patterns')
      .select('pattern_type, claimed_at, players!inner(name)')
      .order('claimed_at', { ascending: true })

    const winCount: { [k: string]: number } = {}
    winsData?.forEach((w: any) => {
      winCount[w.player_id] = (winCount[w.player_id] || 0) + 1
    })

    const cardToPlayer: { [k: string]: string } = {}
    cardsData?.forEach((c: any) => { cardToPlayer[c.id] = c.player_id })

    const markCount: { [k: string]: number } = {}
    markedData?.forEach((m: any) => {
      const pid = cardToPlayer[m.card_id]
      if (pid) markCount[pid] = (markCount[pid] || 0) + 1
    })

    setRows((players || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      created_at: p.created_at,
      wins: winCount[p.id] || 0,
      marked: markCount[p.id] || 0
    })))

    setClaimed(claimedData || [])
    setLoading(false)
  }

  const deletePlayer = async (id: string, name: string) => {
    if (!confirm(`Kustutada mängija "${name}" ja kõik tema andmed?`)) return

    const { data: cards } = await supabase.from('cards').select('id').eq('player_id', id)
    for (const c of cards || []) {
      await supabase.from('marked_squares').delete().eq('card_id', c.id)
    }
    await supabase.from('claimed_patterns').delete().eq('claimed_by_player_id', id)
    await supabase.from('wins').delete().eq('player_id', id)
    await supabase.from('cards').delete().eq('player_id', id)
    await supabase.from('players').delete().eq('id', id)

    load()
  }

  if (!unlocked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'Arial'
      }}>
        <div style={{ width: '300px' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Admin</h1>
          <input
            type="password"
            placeholder="Parool"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (pw === ADMIN_PASSWORD) setUnlocked(true)
                else alert('Vale parool')
              }
            }}
            style={{
              width: '100%', padding: '12px', border: '1px solid #BAC7D5',
              borderRadius: '8px', fontSize: '16px', marginBottom: '12px'
            }}
          />
          <button
            onClick={() => {
              if (pw === ADMIN_PASSWORD) setUnlocked(true)
              else alert('Vale parool')
            }}
            style={{
              width: '100%', padding: '12px', background: '#0090FF', color: 'white',
              border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer'
            }}
          >
            Ava
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', padding: '20px', fontFamily: 'Arial' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '32px', margin: 0 }}>Admin</h1>
          <button onClick={load} style={{
            padding: '8px 16px', background: '#0090FF', color: 'white',
            border: 'none', borderRadius: '6px', cursor: 'pointer'
          }}>
            Värskenda
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <div style={{ flex: 1, padding: '16px', background: '#E7F4FF', borderRadius: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0090FF' }}>{rows.length}</div>
            <div style={{ fontSize: '13px', color: '#5B7795' }}>Mängijat</div>
          </div>
          <div style={{ flex: 1, padding: '16px', background: '#E7F4FF', borderRadius: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0090FF' }}>{claimed.length} / 14</div>
            <div style={{ fontSize: '13px', color: '#5B7795' }}>Mustrit võidetud</div>
          </div>
        </div>

        {loading && <p style={{ color: '#666' }}>Laadin...</p>}

        <h2 style={{ fontSize: '18px', marginTop: '32px', marginBottom: '12px' }}>Mängijad</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#E7F4FF' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>Nimi</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>Märgitud</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>Võite</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Liitus</th>
              <th style={{ padding: '10px' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{r.name}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>{r.marked}/25</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>{r.wins}</td>
                <td style={{ padding: '10px', color: '#5B7795' }}>
                  {new Date(r.created_at).toLocaleDateString('et-EE')}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  <button onClick={() => deletePlayer(r.id, r.name)} style={{
                    padding: '4px 10px', background: '#fff', color: '#c00',
                    border: '1px solid #fcc', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                  }}>
                    Kustuta
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ fontSize: '18px', marginTop: '32px', marginBottom: '12px' }}>Võidetud mustrid</h2>
        {claimed.length === 0 ? (
          <p style={{ color: '#666' }}>Veel ühtegi.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#E7F4FF' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Muster</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Võitja</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Aeg</th>
              </tr>
            </thead>
            <tbody>
              {claimed.map((c: any, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{c.pattern_type}</td>
                  <td style={{ padding: '10px' }}>{c.players.name}</td>
                  <td style={{ padding: '10px', color: '#5B7795' }}>
                    {new Date(c.claimed_at).toLocaleString('et-EE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
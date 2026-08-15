'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const ADMIN_PASSWORD = 'BINGO'

const PATTERN_POINTS: { [key: string]: number } = {
  '1. rida': 6, '2. rida': 6, '3. rida': 4, '4. rida': 6, '5. rida': 6,
  'B tulp': 6, 'I tulp': 6, 'N tulp': 4, 'G tulp': 6, 'O tulp': 6,
  'Diagonaal 1': 4, 'Diagonaal 2': 4, 'Nurgad': 4,
  'MÜÜGIBINGO': 15, 'Täismäng': 30
}

const WEEKLY_POINTS = 2

const MONTH_NAMES = [
  'jaanuar', 'veebruar', 'märts', 'aprill', 'mai', 'juuni',
  'juuli', 'august', 'september', 'oktoober', 'november', 'detsember'
]

const DEFAULT_PRIZES = {
  prize_month_1: 50,
  prize_month_2: 25,
  prize_month_3: 15,
  prize_full: 500,
  prize_secret: 100
}

type Prizes = typeof DEFAULT_PRIZES

type Row = {
  id: string
  name: string
  created_at: string
  wins: number
  marked: number
  weekly: number
}

type MonthGroup = {
  key: string
  label: string
  top: { name: string; points: number; prize: number }[]
}

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [pw, setPw] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [claimed, setClaimed] = useState<any[]>([])
  const [months, setMonths] = useState<MonthGroup[]>([])
  const [special, setSpecial] = useState<{ label: string; name: string; prize: number }[]>([])
  const [prizes, setPrizes] = useState<Prizes>(DEFAULT_PRIZES)
  const [draft, setDraft] = useState<Prizes>(DEFAULT_PRIZES)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (unlocked) load()
  }, [unlocked])

  const load = async () => {
    setLoading(true)

    const { data: settingsData } = await supabase.from('settings').select('key, value')

    const p: Prizes = { ...DEFAULT_PRIZES }
    settingsData?.forEach((s: any) => {
      if (s.key in p) (p as any)[s.key] = Number(s.value)
    })
    setPrizes(p)
    setDraft(p)

    const { data: players } = await supabase
      .from('players')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })

    const { data: winsData } = await supabase
      .from('wins')
      .select('player_id, pattern_type, won_at')

    const { data: cardsData } = await supabase.from('cards').select('id, player_id')
    const { data: markedData } = await supabase.from('marked_squares').select('card_id')

    const { data: claimedData } = await supabase
      .from('claimed_patterns')
      .select('pattern_type, claimed_at, players:claimed_by_player_id(name)')
      .order('claimed_at', { ascending: true })

    const { data: weeklyData } = await supabase
      .from('weekly_square')
      .select('winner_player_id, won_at')
      .not('winner_player_id', 'is', null)

    const nameById: { [k: string]: string } = {}
    players?.forEach((pl: any) => { nameById[pl.id] = pl.name })

    const winCount: { [k: string]: number } = {}
    winsData?.forEach((w: any) => {
      winCount[w.player_id] = (winCount[w.player_id] || 0) + 1
    })

    const weeklyCount: { [k: string]: number } = {}
    weeklyData?.forEach((w: any) => {
      weeklyCount[w.winner_player_id] = (weeklyCount[w.winner_player_id] || 0) + 1
    })

    const cardToPlayer: { [k: string]: string } = {}
    cardsData?.forEach((c: any) => { cardToPlayer[c.id] = c.player_id })

    const markCount: { [k: string]: number } = {}
    markedData?.forEach((m: any) => {
      const pid = cardToPlayer[m.card_id]
      if (pid) markCount[pid] = (markCount[pid] || 0) + 1
    })

    setRows((players || []).map((pl: any) => ({
      id: pl.id,
      name: pl.name,
      created_at: pl.created_at,
      wins: winCount[pl.id] || 0,
      marked: markCount[pl.id] || 0,
      weekly: weeklyCount[pl.id] || 0
    })))

    setClaimed(claimedData || [])

    const monthPrizes = [p.prize_month_1, p.prize_month_2, p.prize_month_3]
    const byMonth: { [key: string]: { [name: string]: number } } = {}

    winsData?.forEach((w: any) => {
      const d = new Date(w.won_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const name = nameById[w.player_id]
      if (!name) return
      if (!byMonth[key]) byMonth[key] = {}
      byMonth[key][name] = (byMonth[key][name] || 0) + (PATTERN_POINTS[w.pattern_type] || 0)
    })

    weeklyData?.forEach((w: any) => {
      if (!w.won_at) return
      const d = new Date(w.won_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const name = nameById[w.winner_player_id]
      if (!name) return
      if (!byMonth[key]) byMonth[key] = {}
      byMonth[key][name] = (byMonth[key][name] || 0) + WEEKLY_POINTS
    })

    const monthList: MonthGroup[] = Object.keys(byMonth)
      .sort()
      .reverse()
      .map(key => {
        const [y, m] = key.split('-')
        const top = Object.entries(byMonth[key])
          .map(([name, points]) => ({ name, points }))
          .sort((a, b) => b.points - a.points)
          .slice(0, 3)
          .map((e, i) => ({ ...e, prize: monthPrizes[i] }))

        return { key, label: `${MONTH_NAMES[Number(m) - 1]} ${y}`, top }
      })

    setMonths(monthList)

    const sp: { label: string; name: string; prize: number }[] = []
    claimedData?.forEach((c: any) => {
      const n = c.players?.name
      if (!n) return
      if (c.pattern_type === 'Täismäng') sp.push({ label: 'Täismäng', name: n, prize: p.prize_full })
      if (c.pattern_type === 'MÜÜGIBINGO') sp.push({ label: 'MÜÜGIBINGO', name: n, prize: p.prize_secret })
    })
    setSpecial(sp)

    setLoading(false)
  }

  const savePrizes = async () => {
    setSaving(true)
    for (const key of Object.keys(draft) as (keyof Prizes)[]) {
      await supabase.from('settings').upsert({ key, value: draft[key] })
    }
    setSaving(false)
    load()
  }

  const deletePlayer = async (id: string, name: string) => {
    if (!confirm(`Kustutada mängija "${name}" ja kõik tema andmed?`)) return

    const { data: cards } = await supabase.from('cards').select('id').eq('player_id', id)
    for (const c of cards || []) {
      await supabase.from('marked_squares').delete().eq('card_id', c.id)
    }
    await supabase.from('weekly_square').update({ winner_player_id: null, won_at: null }).eq('winner_player_id', id)
    await supabase.from('claimed_patterns').delete().eq('claimed_by_player_id', id)
    await supabase.from('wins').delete().eq('player_id', id)
    await supabase.from('cards').delete().eq('player_id', id)
    await supabase.from('players').delete().eq('id', id)

    load()
  }

  const monthTotal = months.reduce(
    (sum, m) => sum + m.top.reduce((s, t) => s + t.prize, 0), 0
  )
  const specialTotal = special.reduce((s, e) => s + e.prize, 0)

  const inputStyle = {
    fontFamily: 'inherit',
    width: '80px',
    padding: '6px 8px',
    border: '1px solid #BAC7D5',
    borderRadius: '6px',
    fontSize: '14px'
  }

  const th = { padding: '8px', textAlign: 'left' as const, fontWeight: 600 }

  if (!unlocked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'Montserrat, sans-serif'
      }}>
        <div style={{ width: '300px' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px', fontWeight: 800, color: '#2D2D2D' }}>Admin</h1>
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
              fontFamily: 'inherit',
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
              fontFamily: 'inherit',
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
    <div style={{ minHeight: '100vh', padding: '20px', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '32px', margin: 0, fontWeight: 800, color: '#2D2D2D', letterSpacing: '-0.5px' }}>Admin</h1>
          <button onClick={load} style={{
            fontFamily: 'inherit',
            padding: '8px 16px', background: '#0090FF', color: 'white',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
          }}>
            Värskenda
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px', padding: '16px', background: '#E7F4FF', borderRadius: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0090FF' }}>{rows.length}</div>
            <div style={{ fontSize: '13px', color: '#5B7795' }}>Mängijat</div>
          </div>
          <div style={{ flex: '1 1 160px', padding: '16px', background: '#E7F4FF', borderRadius: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0090FF' }}>{claimed.length} / 15</div>
            <div style={{ fontSize: '13px', color: '#5B7795' }}>Mustrit võidetud</div>
          </div>
          <div style={{ flex: '1 1 160px', padding: '16px', background: '#F6FBFF', border: '1px solid #BAC7D5', borderRadius: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#2D2D2D' }}>{monthTotal + specialTotal} €</div>
            <div style={{ fontSize: '13px', color: '#5B7795' }}>Auhindu välja teenitud</div>
          </div>
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D2D2D', marginBottom: '12px' }}>
          Auhinnasummad
        </h2>
        <div style={{
          padding: '16px', background: '#F6FBFF', border: '1px solid #BAC7D5',
          borderRadius: '8px', marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '14px', color: '#2D2D2D' }}>
            {([
              ['prize_month_1', 'Kuu 1. koht'],
              ['prize_month_2', 'Kuu 2. koht'],
              ['prize_month_3', 'Kuu 3. koht'],
              ['prize_full', 'Täismäng'],
              ['prize_secret', 'MÜÜGIBINGO']
            ] as [keyof Prizes, string][]).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '13px', color: '#5B7795' }}>{label}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                    style={inputStyle}
                  />
                  <span style={{ color: '#5B7795' }}>€</span>
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={savePrizes}
            disabled={saving || JSON.stringify(draft) === JSON.stringify(prizes)}
            style={{
              fontFamily: 'inherit',
              marginTop: '16px',
              padding: '8px 20px',
              background: JSON.stringify(draft) === JSON.stringify(prizes) ? '#D9DEE5' : '#0090FF',
              color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px',
              cursor: JSON.stringify(draft) === JSON.stringify(prizes) ? 'default' : 'pointer'
            }}
          >
            {saving ? 'Salvestan...' : 'Salvesta summad'}
          </button>
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D2D2D', marginBottom: '12px' }}>
          Auhinnad kuude kaupa
        </h2>

        {months.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#5B7795' }}>Veel ühtegi kuud pole punkte teenitud.</p>
        ) : (
          months.map(m => (
            <div key={m.key} style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: '10px',
                marginBottom: '6px', flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#2D2D2D' }}>
                  {m.label}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0090FF' }}>
                  {m.key === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
                    ? 'KÄIB'
                    : 'LÕPPENUD'}
                </span>
                <span style={{ fontSize: '13px', color: '#5B7795', marginLeft: 'auto' }}>
                  Väljamakse: <strong style={{ color: '#2D2D2D' }}>
                    {m.top.reduce((s, t) => s + t.prize, 0)} €
                  </strong>
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#2D2D2D' }}>
                <thead>
                  <tr style={{ background: '#E7F4FF' }}>
                    <th style={{ ...th, width: '60px' }}>Koht</th>
                    <th style={th}>Mängija</th>
                    <th style={{ ...th, textAlign: 'center' }}>Punkte</th>
                    <th style={{ ...th, textAlign: 'right' }}>Auhind</th>
                  </tr>
                </thead>
                <tbody>
                  {m.top.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #E7F4FF' }}>
                      <td style={{ padding: '8px' }}>{i + 1}.</td>
                      <td style={{ padding: '8px' }}>{t.name}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{t.points}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#0090FF' }}>{t.prize} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}

        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D2D2D', marginTop: '32px', marginBottom: '12px' }}>
          Eriauhinnad
        </h2>

        {special.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#5B7795' }}>Täismäng ja MÜÜGIBINGO on veel võitmata.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#2D2D2D' }}>
            <thead>
              <tr style={{ background: '#E7F4FF' }}>
                <th style={th}>Muster</th>
                <th style={th}>Võitja</th>
                <th style={{ ...th, textAlign: 'right' }}>Auhind</th>
              </tr>
            </thead>
            <tbody>
              {special.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #E7F4FF' }}>
                  <td style={{ padding: '8px' }}>{s.label}</td>
                  <td style={{ padding: '8px' }}>{s.name}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#0090FF' }}>{s.prize} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D2D2D', marginTop: '32px', marginBottom: '12px' }}>
          Mängijad
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#2D2D2D' }}>
          <thead>
            <tr style={{ background: '#E7F4FF' }}>
              <th style={th}>Nimi</th>
              <th style={{ ...th, textAlign: 'center' }}>Märgitud</th>
              <th style={{ ...th, textAlign: 'center' }}>Mustreid</th>
              <th style={{ ...th, textAlign: 'center' }}>Nädalaruute</th>
              <th style={th}>Liitus</th>
              <th style={{ padding: '8px' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #E7F4FF' }}>
                <td style={{ padding: '8px' }}>{r.name}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{r.marked}/25</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{r.wins}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{r.weekly}</td>
                <td style={{ padding: '8px', color: '#5B7795' }}>
                  {new Date(r.created_at).toLocaleDateString('et-EE')}
                </td>
                <td style={{ padding: '8px', textAlign: 'right' }}>
                  <button onClick={() => deletePlayer(r.id, r.name)} style={{
                    fontFamily: 'inherit',
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

        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D2D2D', marginTop: '32px', marginBottom: '12px' }}>
          Võidetud mustrid
        </h2>
        {claimed.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#5B7795' }}>Veel ühtegi.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#2D2D2D' }}>
            <thead>
              <tr style={{ background: '#E7F4FF' }}>
                <th style={th}>Muster</th>
                <th style={th}>Võitja</th>
                <th style={th}>Aeg</th>
              </tr>
            </thead>
            <tbody>
              {claimed.map((c: any, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #E7F4FF' }}>
                  <td style={{ padding: '8px' }}>{c.pattern_type}</td>
                  <td style={{ padding: '8px' }}>{c.players?.name}</td>
                  <td style={{ padding: '8px', color: '#5B7795' }}>
                    {new Date(c.claimed_at).toLocaleString('et-EE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {loading && <p style={{ marginTop: '16px', fontSize: '14px', color: '#5B7795' }}>Laadin...</p>}
      </div>
    </div>
  )
}
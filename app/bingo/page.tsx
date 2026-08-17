'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const BINGO_SQUARES = [
  'Müüsin 100 bännerit + 200 kuldtähte + 300 töökuulutust',
  'Läbisin tasuta AI-koolituse või AI-teemalise veebiseminari',
  'Sõlmisin 50 NEW lepingut + koostasin 30 PRO arvet',
  'Kiitsin siiralt 5 kolleegi + tänasin kolleegi, kes mind aitas',
  'Tegin ühel päeval 40 OK-kõnet',
  'Müüsin 15 Kiirus/Nähtavus/Branding paketti + sõlmisin 5 värbamise lepingut',
  'Kasutasin AI-d vähemalt 5 kliendianalüüsi tegemisel',
  'Tegin olemasolevale paketikliendile lisamüügi + kasvatasin 5 REP-kliendi arveldust',
  'Aitasin kolleegil ühe müügitehingu lõpuni viia',
  'Võtsin ühendust 50 potentsiaalse kliendiga + leppisin kokku 5 kliendikohtumist',
  'Minu kliendid aktiveerisid 5 integratsiooni',
  'Lõin 3 toimivat AI-juhist müügitööks + jagasin AI-nippi',
  'CVK',
  'Jagasin kolleegile sisulist tagasisidet',
  'Koostasin 5 memo ja saatsin klientidele',
  'Müüsin 25 kliendile vähemalt 3 erinevat teenust',
  'Analüüsisin kaotatud müüki + panin kirja õppetunni',
  'Müüsin 50 teenust allahindluseta + klient valis kõrgema hinnaga pakkumise',
  'Parandasin oma müügiargumente + küsisin kliendi tagasisidet enda tööle',
  'Küsisin 10 kliendilt, miks nad meid valisid',
  'Müüsin sisuturundusartikli + bänneri artikli võimendamiseks',
  'Lahendasin edukalt 5 vastuväidet "CV.ee on odavam"',
  'Ületasin kahel kuul müügieesmärgi',
  'Jagasin toimivat müügivõtet + kutsusin kohvipausile kolleegi kellega räägin vähem',
  'Valisin välja 10 juurdemüügi potentsiaaliga ettevõtet + müüsin 10 töökuulutusele lisateenuse'
]

const PATTERNS = [
  { name: '1. rida', points: 6, indices: [0, 1, 2, 3, 4] },
  { name: '2. rida', points: 6, indices: [5, 6, 7, 8, 9] },
  { name: '3. rida', points: 4, indices: [10, 11, 12, 13, 14] },
  { name: '4. rida', points: 6, indices: [15, 16, 17, 18, 19] },
  { name: '5. rida', points: 6, indices: [20, 21, 22, 23, 24] },
  { name: 'B tulp', points: 6, indices: [0, 5, 10, 15, 20] },
  { name: 'I tulp', points: 6, indices: [1, 6, 11, 16, 21] },
  { name: 'N tulp', points: 4, indices: [2, 7, 12, 17, 22] },
  { name: 'G tulp', points: 6, indices: [3, 8, 13, 18, 23] },
  { name: 'O tulp', points: 6, indices: [4, 9, 14, 19, 24] },
  { name: 'Diagonaal 1', points: 4, indices: [0, 6, 12, 18, 24] },
  { name: 'Diagonaal 2', points: 4, indices: [4, 8, 12, 16, 20] },
  { name: 'Nurgad', points: 4, indices: [0, 4, 20, 24] },
  { name: 'MÜÜGIBINGO', points: 15, indices: [1, 10, 18, 23, 24] },
  { name: 'Täismäng', points: 30, indices: Array.from({ length: 25 }, (_, i) => i) }
]

const PATTERN_POINTS: { [key: string]: number } = Object.fromEntries(
  PATTERNS.map(p => [p.name, p.points])
)

const WEEKLY_POINTS = 2

function mondayOf(d: Date) {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + diff)
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`
}
const RULE_TEXT = { fontSize: '14px', lineHeight: 1.6, color: '#2D2D2D' }
const RULE_HEADING = { fontSize: '14px', lineHeight: 1.6, color: '#2D2D2D', fontWeight: 700 }

export default function BingoPage() {
  const [playerName, setPlayerName] = useState('')
  const [cardId, setCardId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [marked, setMarked] = useState<Set<number>>(new Set([12]))
  const [wins, setWins] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showRules, setShowRules] = useState(false)
  const [counts, setCounts] = useState<{ [key: number]: number }>({})
  const [taken, setTaken] = useState<string[]>([])
  const [weekly, setWeekly] = useState<{ square: number; winner: string | null } | null>(null)
  const [weeklyWins, setWeeklyWins] = useState(0)
  const [celebrate, setCelebrate] = useState(false)
  const [toast, setToast] = useState<{ title: string; text: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const pid = localStorage.getItem('player_id')
    const pname = localStorage.getItem('player_name')
    const cid = localStorage.getItem('card_id')

    if (!pid || !cid) {
      router.push('/player')
      return
    }

    setPlayerId(pid)
    setPlayerName(pname || '')
    setCardId(cid)
    loadData(cid, pid)
    loadCounts()
    loadTaken()
    loadWeekly(pid)

    const channel = supabase
      .channel('square-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marked_squares' }, () => loadCounts())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])
  const claimWeekly = async (idx: number) => {
    if (!weekly || weekly.square !== idx || weekly.winner) return

    const week = mondayOf(new Date())

    const { error } = await supabase
      .from('weekly_square')
      .update({ winner_player_id: playerId, won_at: new Date().toISOString() })
      .eq('week_start', week)
      .is('winner_player_id', null)

    if (error) return

    const { data: check } = await supabase
      .from('weekly_square')
      .select('winner_player_id')
      .eq('week_start', week)
      .maybeSingle()

    if (check?.winner_player_id === playerId) {
      setWeekly({ square: idx, winner: playerName })
      setWeeklyWins(prev => prev + 1)
      setToast({
        title: 'Nädala ruut!',
        text: `${WEEKLY_POINTS} boonuspunkti`
      })
    }
  }
  const loadWeekly = async (pid?: string) => {
    const week = mondayOf(new Date())
    const me = pid || playerId

    const { data: mine } = await supabase
      .from('weekly_square')
      .select('id')
      .eq('winner_player_id', me)

    setWeeklyWins(mine?.length || 0)

    const { data: existing } = await supabase
      .from('weekly_square')
      .select('square_number, winner_player_id, players:winner_player_id(name)')
      .eq('week_start', week)
      .maybeSingle()

    if (existing) {
      setWeekly({
        square: existing.square_number,
        winner: (existing.players as any)?.name || null
      })
      return
    }

    // Uus nädal – vali juhuslik ruut (mitte keskmine)
    let pick = 12
    while (pick === 12) pick = Math.floor(Math.random() * 25)

    await supabase
      .from('weekly_square')
      .insert([{ week_start: week, square_number: pick }])

    const { data: fresh } = await supabase
      .from('weekly_square')
      .select('square_number, winner_player_id, players:winner_player_id(name)')
      .eq('week_start', week)
      .maybeSingle()

    if (fresh) {
      setWeekly({
        square: fresh.square_number,
        winner: (fresh.players as any)?.name || null
      })
    }
  }
  const loadTaken = async () => {
    const { data } = await supabase
      .from('claimed_patterns')
      .select('pattern_type')

    setTaken(data?.map((c: any) => c.pattern_type) || [])
  }
  const loadCounts = async () => {
    const { data } = await supabase
      .from('marked_squares')
      .select('square_number')

    const tally: { [key: number]: number } = {}
    data?.forEach((m: any) => {
      tally[m.square_number] = (tally[m.square_number] || 0) + 1
    })
    setCounts(tally)
  }
  const loadData = async (cid: string, pid: string) => {
    const { data: markedData } = await supabase
      .from('marked_squares')
      .select('square_number')
      .eq('card_id', cid)

    const markedSet = new Set(markedData?.map(m => m.square_number) || [])
    markedSet.add(12)
    setMarked(markedSet)

    const { data: winsData } = await supabase
      .from('wins')
      .select('pattern_type')
      .eq('player_id', pid)

    setWins(winsData?.map(w => w.pattern_type) || [])
    setLoading(false)
  }

  const toggleSquare = async (idx: number) => {
    if (idx === 12) return

    const newMarked = new Set(marked)

    if (newMarked.has(idx)) {
      newMarked.delete(idx)
      await supabase
        .from('marked_squares')
        .delete()
        .eq('card_id', cardId)
        .eq('square_number', idx)

      await releaseWins(newMarked)
    } else {
      newMarked.add(idx)
      await supabase
        .from('marked_squares')
        .insert([{ card_id: cardId, square_number: idx }])

      await claimWeekly(idx)
      checkWins(newMarked)
    }

    setMarked(newMarked)
  }

  const releaseWins = async (markedSet: Set<number>) => {
    const lost: string[] = []

    for (const pattern of PATTERNS) {
      if (!wins.includes(pattern.name)) continue
      if (pattern.indices.every(i => markedSet.has(i))) continue

      await supabase
        .from('wins')
        .delete()
        .eq('player_id', playerId)
        .eq('pattern_type', pattern.name)

      await supabase
        .from('claimed_patterns')
        .delete()
        .eq('pattern_type', pattern.name)
        .eq('claimed_by_player_id', playerId)

      lost.push(pattern.name)
    }

    if (lost.length > 0) {
      setWins(prev => prev.filter(w => !lost.includes(w)))
      setToast({
        title: 'Võit võeti tagasi',
        text: `${lost.join(', ')} — muster ei ole enam täidetud`
      })
    }
  }

  const checkWins = async (markedSet: Set<number>) => {
    for (const pattern of PATTERNS) {
      if (wins.includes(pattern.name)) continue
      if (!pattern.indices.every(i => markedSet.has(i))) continue

      const { error: claimError } = await supabase
        .from('claimed_patterns')
        .insert([{
          pattern_type: pattern.name,
          claimed_by_player_id: playerId
        }])

      if (claimError) continue

      await supabase
        .from('wins')
        .insert([{ player_id: playerId, pattern_type: pattern.name }])

      setWins(prev => [...prev, pattern.name])

      if (pattern.name === 'Täismäng') {
        setCelebrate(true)
        setTimeout(() => setCelebrate(false), 5000)
      }

      setToast({
        title: 'Võitsid mustri!',
        text: `${pattern.name} — ${pattern.points} punkti`
      })
    }
  }

  const closest = (() => {
    let best: { name: string; missing: number; points: number } | null = null

    for (const p of PATTERNS) {
      if (taken.includes(p.name)) continue
      const missing = p.indices.filter(i => !marked.has(i)).length
      if (missing === 0 || missing > 2) continue
      if (!best || missing < best.missing || (missing === best.missing && p.points > best.points)) {
        best = { name: p.name, missing, points: p.points }
      }
    }

    return best
  })()
  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Montserrat, sans-serif' }}>Laadin...</div>
  }

  return (
    <div style={{ minHeight: '100vh', padding: '20px', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{
              fontWeight: 800,
              fontSize: '32px',
              color: '#2D2D2D',
              letterSpacing: '-0.5px',
              margin: 0
            }}>MÜÜGIBINGO</h1>
            <p style={{ color: '#5B7795', margin: '4px 0 0 0' }}>{playerName}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowRules(true)} style={{
              fontFamily: 'inherit',
              padding: '8px 16px',
              background: 'white',
              color: '#0090FF',
              border: '1px solid #0090FF',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}>
              Reeglid
            </button>
            <a href="/leaderboard" style={{
              padding: '8px 16px',
              background: '#0090FF',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '14px'
            }}>
              Edetabel
            </a>
            <a href="/" style={{
              padding: '8px 16px',
              background: 'white',
              color: '#0090FF',
              border: '1px solid #0090FF',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '14px'
            }}>
              Avaleht
            </a>
          </div>
        </div>

        <div style={{
          background: '#E7F4FF',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#2D2D2D'
        }}>
          Märgitud: <strong>{marked.size}/25</strong>
          {'  ·  '}
          Võite: <strong>{wins.length}</strong>
          {'  ·  '}
          Punkte: <strong style={{ color: '#0090FF' }}>
          {wins.reduce((sum, w) => sum + (PATTERN_POINTS[w] || 0), 0)
              + weeklyWins * WEEKLY_POINTS}
          </strong>
        </div>
        {weekly && (
          <div style={{
            background: weekly.winner ? '#F6FBFF' : '#E7F4FF',
            border: weekly.winner ? '1px solid #BAC7D5' : '2px solid #0090FF',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            textAlign: 'center',
            fontSize: '14px',
            color: '#2D2D2D'
          }}>
            {weekly.winner ? (
              <>Nädala ruudu võttis <strong>{weekly.winner}</strong> — {WEEKLY_POINTS} boonuspunkti.</>
            ) : (
              <>Nädala ruut on kaardil märgitud — esimene, kes selle täidab, saab {WEEKLY_POINTS} boonuspunkti.</>
            )}
          </div>
        )}
        {closest && (
          <div style={{
            background: 'white',
            border: '1px solid #0090FF',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            textAlign: 'center',
            fontSize: '14px',
            color: '#2D2D2D'
          }}>
            Lähim muster: <strong>{closest.name}</strong> — puudu {closest.missing === 1 ? 'üks ruut' : `${closest.missing} ruutu`} ({closest.points} punkti)
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginBottom: '8px' }}>
          {['B', 'I', 'N', 'G', 'O'].map(h => (
            <div key={h} style={{
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '20px',
              color: '#0090FF'
            }}>{h}</div>
          ))}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '8px',
          background: '#F6FBFF',
          padding: '12px',
          borderRadius: '8px'
        }}>
          {BINGO_SQUARES.map((text, idx) => (
            <button
              key={idx}
              onClick={() => toggleSquare(idx)}
              disabled={idx === 12}
              style={{
                fontFamily: 'inherit',
                aspectRatio: '1',
                padding: '8px',
                fontSize: '12.5px',
                lineHeight: '1.35',
                background: idx === 12 ? '#E7F4FF' : marked.has(idx) ? '#0090FF' : 'white',
                color: idx === 12 ? '#0090FF' : marked.has(idx) ? 'white' : '#2D2D2D',
                border: idx === 12 ? '2px solid #0090FF' : '1px solid #BAC7D5',
                borderRadius: '4px',
                cursor: idx === 12 ? 'default' : 'pointer',
                fontWeight: idx === 12 ? 700 : 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                position: 'relative',
                boxShadow: weekly && weekly.square === idx && !weekly.winner
                  ? 'inset 0 0 0 3px #0090FF'
                  : 'none'
              }}
            >
              {idx === 12 ? (
                <svg viewBox="0 0 149 24" style={{ width: '80%', height: 'auto' }} xmlns="http://www.w3.org/2000/svg">
                  <path d="M33.7404 5.22115L29.0175 18.1194L24.3439 5.22115H20.2737C20.2737 15.579 15.1439 19.9018 10.3368 19.9018C6.89123 19.9018 4.19649 17.6422 4.19649 14.2457C4.19649 11.0317 6.70877 8.81413 9.6 8.81413C11.5368 8.81413 13.2421 9.81062 14.2175 11.3124L16.8561 8.16851C15.1719 6.00711 12.7649 4.7229 9.63509 4.7229C4.32281 4.72992 0 8.66676 0 13.9861C0 19.8106 4.81404 24.0001 10.2526 24.0001C16.379 24.0001 21.1018 19.7896 22.7509 13.1229L27.0456 23.5089H30.9263L38.4562 5.22115H33.7404Z" fill="#0090FF"/>
                  <path d="M51.8947 23.5018H57.5298L49.1719 13.7123L57.186 5.22105H51.6491L44.6456 12.9614V0H40.4772V23.5018H44.6456V18.5053L46.393 16.6526L51.8947 23.5018Z" fill="#2D2D2D"/>
                  <path d="M120.414 23.9999C122.786 23.9999 124.891 22.856 126.042 21.1508V23.5017H130.049V5.22095H125.895V16.028C125.895 18.2174 124.309 20.0771 122.042 20.0771C119.467 20.0771 118.204 18.2245 118.204 16.028V5.22095H114.028V17.0666C114.028 21.1297 116.786 23.9999 120.414 23.9999Z" fill="#2D2D2D"/>
                  <path d="M87.3474 12.6666L83.958 12.049C82.7088 11.8245 81.9229 11.1157 81.9229 10.1473C81.9229 9.03149 83.1439 8.11921 84.9755 8.11921C87.3755 8.11921 88.5825 9.22798 88.8001 10.421H92.9474C92.8141 8.14728 90.786 4.72974 85.1369 4.72974C80.9404 4.72974 77.7053 7.41044 77.7053 10.5824C77.7053 13.0806 79.572 15.1648 83.1439 15.8736L86.4422 16.5332C88.0632 16.828 88.8071 17.5789 88.8071 18.5473C88.8071 19.6631 87.6211 20.5753 85.6281 20.5753C83.2211 20.5753 81.6843 19.4806 81.4036 17.8034H77.158C77.158 20.421 79.6492 24.0069 85.5088 24.0069C90.6597 24.0069 93.1509 20.9473 93.1509 18.1894C93.165 15.5017 91.4387 13.4455 87.3474 12.6666Z" fill="#2D2D2D"/>
                  <path d="M75.2702 16.049C75.3755 15.4596 75.4316 14.849 75.4316 14.2315C75.4316 8.91219 71.4597 4.72974 66.1053 4.72974C60.7509 4.72974 56.772 9.04553 56.772 14.3648C56.772 19.6841 60.7509 23.9999 66.0983 23.9999C69.193 23.9999 71.8316 22.5543 73.5018 20.3017L70.5123 17.6982C69.6702 18.9122 67.7334 19.9087 66.0983 19.9087C63.6141 19.9087 61.6843 18.2876 61.0386 16.049H75.2702ZM61.0457 12.6806C61.6913 10.442 63.6141 8.82096 66.1053 8.82096C68.6386 8.82096 70.5825 10.4139 71.193 12.6806H61.0457Z" fill="#2D2D2D"/>
                  <path d="M107.186 23.5018H112.821L104.456 13.7123L112.477 5.22105H106.94L99.9369 12.9614V0H95.7684V23.5018H99.9369V18.5053L101.684 16.6526L107.186 23.5018Z" fill="#2D2D2D"/>
                  <path d="M142.421 12.6666L139.032 12.049C137.782 11.8245 136.996 11.1157 136.996 10.1473C136.996 9.03149 138.218 8.11921 140.049 8.11921C142.449 8.11921 143.656 9.22798 143.874 10.421H148.021C147.888 8.14728 145.86 4.72974 140.211 4.72974C136.014 4.72974 132.779 7.41044 132.779 10.5824C132.779 13.0806 134.646 15.1648 138.218 15.8736L141.516 16.5332C143.137 16.828 143.881 17.5789 143.881 18.5473C143.881 19.6631 142.695 20.5753 140.702 20.5753C138.295 20.5753 136.758 19.4806 136.477 17.8034H132.232C132.232 20.421 134.723 24.0069 140.582 24.0069C145.733 24.0069 148.225 20.9473 148.225 18.1894C148.239 15.5017 146.512 13.4455 142.421 12.6666Z" fill="#2D2D2D"/>
                </svg>
              ) : (
                <>
                  {text}
                  {counts[idx] > 0 && (
                    <span style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '6px',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: marked.has(idx) ? 'rgba(255,255,255,0.7)' : '#5B7795'
                    }}>{counts[idx]}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {wins.length > 0 && (
          <div style={{ marginTop: '20px', padding: '16px', background: '#F6FBFF', borderRadius: '8px', fontSize: '14px', color: '#2D2D2D' }}>
            <strong>Minu võidud:</strong>
            <div style={{ marginTop: '8px' }}>
              {wins.map((w, i) => (
                <span key={i} style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  background: '#0090FF',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '12px',
                  margin: '4px 4px 0 0'
                }}>{w}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {showRules && (
        <div
          onClick={() => setShowRules(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', zIndex: 100
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: '12px', padding: '28px',
              maxWidth: '620px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
              fontSize: '14px', lineHeight: 1.6, color: '#2D2D2D'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#2D2D2D', letterSpacing: '-0.3px' }}>Reeglid</h2>
              <button onClick={() => setShowRules(false)} style={{
                fontFamily: 'inherit',
                background: 'none', border: 'none', fontSize: '24px',
                cursor: 'pointer', color: '#5B7795', lineHeight: 1
              }}>×</button>
            </div>

            <p style={{ ...RULE_HEADING, margin: '0 0 4px 0' }}>Märkimine</p>
            <p style={{ ...RULE_TEXT, margin: 0 }}>
              Märgi ruut, kui oled selle ülesande täitnud. Keskmine ruut on vaba.
              Ruudud ei ole broneeritavad — sama ruudu võivad ära märkida kõik.
            </p>
            <p style={{ ...RULE_TEXT, margin: '12px 0 0 0' }}>
              Kui ruudus on kaks tegevust, tuleb märkimiseks mõlemad ära teha.
            </p>
            <p style={{ ...RULE_TEXT, margin: '12px 0 0 0' }}>
              Ruudu eesmärki ei pea täitma ühe tehingu või ühe arvega — see on
              erinevate tegevuste summa aja jooksul.
            </p>

            <p style={{ ...RULE_HEADING, margin: '20px 0 4px 0' }}>Võit</p>
            <p style={{ ...RULE_TEXT, margin: 0 }}>
              Punkte annab ainult terve muster: rida, tulp, diagonaal, nurgad või täismäng.
              Iga mustri saab võita ainult üks kord — esimene, kes selle täidab.
              Kui muster on juba võidetud, võid selle ruudud ikka ära märkida — need loevad
              edasi teiste mustrite jaoks.
            </p>

            <p style={{ ...RULE_HEADING, margin: '20px 0 8px 0' }}>Punktid</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#2D2D2D' }}>
              <thead>
                <tr style={{ background: '#E7F4FF' }}>
                  <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600 }}>Muster</th>
                  <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>Ruute</th>
                  <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>Punkte</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #E7F4FF' }}>
                  <td style={{ padding: '8px' }}>1., 2., 4., 5. rida</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>5</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>6</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E7F4FF' }}>
                  <td style={{ padding: '8px' }}>B, I, G, O tulp</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>5</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>6</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E7F4FF' }}>
                  <td style={{ padding: '8px' }}>3. rida</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>4</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>4</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E7F4FF' }}>
                  <td style={{ padding: '8px' }}>N tulp</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>4</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>4</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E7F4FF' }}>
                  <td style={{ padding: '8px' }}>Diagonaalid</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>4</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>4</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E7F4FF' }}>
                  <td style={{ padding: '8px' }}>Nurgad</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>4</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>4</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E7F4FF' }}>
                  <td style={{ padding: '8px' }}>MÜÜGIBINGO (salajane)</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>5</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>15</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E7F4FF' }}>
                  <td style={{ padding: '8px' }}>Täismäng</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>25</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>30</td>
                </tr>
              </tbody>
            </table>

            <p style={{ ...RULE_TEXT, margin: '16px 0 0 0' }}>
              3. rida, N tulp ja diagonaalid läbivad vaba ruutu, seega vajavad neli märgistust.
            </p>

            <p style={{ ...RULE_HEADING, margin: '20px 0 4px 0' }}>Nädala ruut</p>
            <p style={{ ...RULE_TEXT, margin: 0 }}>
              Igal esmaspäeval valib süsteem juhusliku ruudu ja märgib selle kaardil sinise raamiga.
              Esimene, kes selle nädala jooksul ära märgib, saab <strong>2 boonuspunkti</strong>.
              Kui oled ruudu juba varem märkinud, sel nädalal punkte ei tule — nii saavad ka
              teised võimaluse.
            </p>

            <p style={{ ...RULE_TEXT, margin: '16px 0 0 0' }}>
              Kaardil on peidus ka üks salajane viie ruudu muster — <strong>MÜÜGIBINGO</strong>, 15 punkti.
              Keegi ei tea, millised ruudud need on. Esimene, kes selle kogemata täidab, saab punktid.
            </p>
            <p style={{ ...RULE_TEXT, margin: '16px 0 0 0' }}>
              Mäng kestab kuni <strong>31.12.2026</strong> või täismängu võiduni.
            </p>

            <p style={{ ...RULE_HEADING, margin: '20px 0 4px 0' }}>Nimi ja kaart</p>
            <p style={{ ...RULE_TEXT, margin: 0 }}>
              Sisesta oma pärisnimi, et edetabelis oleks selge, kes on kes.
              Kaart on seotud selle seadme ja brauseriga — mängi kogu aeg samast seadmest.
              Kui alustad uue nimega või teisest seadmest, on see uus mängija ja algab uus kaart nullist.
            </p>

          </div>
          </div>
      )}

{toast && (
        <div
          onClick={() => setToast(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', zIndex: 150
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: '12px', padding: '32px',
              maxWidth: '400px', width: '100%', textAlign: 'center'
            }}
          >
            <div style={{
              fontSize: '24px', fontWeight: 800, color: '#2D2D2D', letterSpacing: '-0.3px'
            }}>{toast.title}</div>
            <div style={{
              fontSize: '16px', color: '#5B7795', marginTop: '8px', lineHeight: 1.5
            }}>{toast.text}</div>
            <button
              onClick={() => setToast(null)}
              style={{
                fontFamily: 'inherit',
                marginTop: '24px', padding: '10px 32px', background: '#0090FF',
                color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '15px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Sulge
            </button>
          </div>
        </div>
      )}
      {celebrate && (
        <div style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 200
        }}>
          <style>{`
            @keyframes cvkfall {
              0%   { transform: translateY(-10vh) rotate(0deg); opacity: 1 }
              100% { transform: translateY(110vh) rotate(720deg); opacity: 0 }
            }
            @keyframes cvkpop {
              0%   { transform: scale(0.6); opacity: 0 }
              15%  { transform: scale(1.08); opacity: 1 }
              25%  { transform: scale(1); opacity: 1 }
              80%  { transform: scale(1); opacity: 1 }
              100% { transform: scale(1.02); opacity: 0 }
            }
          `}</style>

          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'cvkpop 5s ease-out forwards'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px 48px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
              textAlign: 'center'
            }}>
              <svg viewBox="0 0 149 24" style={{ width: '220px', height: 'auto' }} xmlns="http://www.w3.org/2000/svg">
                <path d="M33.7404 5.22115L29.0175 18.1194L24.3439 5.22115H20.2737C20.2737 15.579 15.1439 19.9018 10.3368 19.9018C6.89123 19.9018 4.19649 17.6422 4.19649 14.2457C4.19649 11.0317 6.70877 8.81413 9.6 8.81413C11.5368 8.81413 13.2421 9.81062 14.2175 11.3124L16.8561 8.16851C15.1719 6.00711 12.7649 4.7229 9.63509 4.7229C4.32281 4.72992 0 8.66676 0 13.9861C0 19.8106 4.81404 24.0001 10.2526 24.0001C16.379 24.0001 21.1018 19.7896 22.7509 13.1229L27.0456 23.5089H30.9263L38.4562 5.22115H33.7404Z" fill="#0090FF"/>
                <path d="M51.8947 23.5018H57.5298L49.1719 13.7123L57.186 5.22105H51.6491L44.6456 12.9614V0H40.4772V23.5018H44.6456V18.5053L46.393 16.6526L51.8947 23.5018Z" fill="#2D2D2D"/>
                <path d="M120.414 23.9999C122.786 23.9999 124.891 22.856 126.042 21.1508V23.5017H130.049V5.22095H125.895V16.028C125.895 18.2174 124.309 20.0771 122.042 20.0771C119.467 20.0771 118.204 18.2245 118.204 16.028V5.22095H114.028V17.0666C114.028 21.1297 116.786 23.9999 120.414 23.9999Z" fill="#2D2D2D"/>
                <path d="M87.3474 12.6666L83.958 12.049C82.7088 11.8245 81.9229 11.1157 81.9229 10.1473C81.9229 9.03149 83.1439 8.11921 84.9755 8.11921C87.3755 8.11921 88.5825 9.22798 88.8001 10.421H92.9474C92.8141 8.14728 90.786 4.72974 85.1369 4.72974C80.9404 4.72974 77.7053 7.41044 77.7053 10.5824C77.7053 13.0806 79.572 15.1648 83.1439 15.8736L86.4422 16.5332C88.0632 16.828 88.8071 17.5789 88.8071 18.5473C88.8071 19.6631 87.6211 20.5753 85.6281 20.5753C83.2211 20.5753 81.6843 19.4806 81.4036 17.8034H77.158C77.158 20.421 79.6492 24.0069 85.5088 24.0069C90.6597 24.0069 93.1509 20.9473 93.1509 18.1894C93.165 15.5017 91.4387 13.4455 87.3474 12.6666Z" fill="#2D2D2D"/>
                <path d="M75.2702 16.049C75.3755 15.4596 75.4316 14.849 75.4316 14.2315C75.4316 8.91219 71.4597 4.72974 66.1053 4.72974C60.7509 4.72974 56.772 9.04553 56.772 14.3648C56.772 19.6841 60.7509 23.9999 66.0983 23.9999C69.193 23.9999 71.8316 22.5543 73.5018 20.3017L70.5123 17.6982C69.6702 18.9122 67.7334 19.9087 66.0983 19.9087C63.6141 19.9087 61.6843 18.2876 61.0386 16.049H75.2702ZM61.0457 12.6806C61.6913 10.442 63.6141 8.82096 66.1053 8.82096C68.6386 8.82096 70.5825 10.4139 71.193 12.6806H61.0457Z" fill="#2D2D2D"/>
                <path d="M107.186 23.5018H112.821L104.456 13.7123L112.477 5.22105H106.94L99.9369 12.9614V0H95.7684V23.5018H99.9369V18.5053L101.684 16.6526L107.186 23.5018Z" fill="#2D2D2D"/>
                <path d="M142.421 12.6666L139.032 12.049C137.782 11.8245 136.996 11.1157 136.996 10.1473C136.996 9.03149 138.218 8.11921 140.049 8.11921C142.449 8.11921 143.656 9.22798 143.874 10.421H148.021C147.888 8.14728 145.86 4.72974 140.211 4.72974C136.014 4.72974 132.779 7.41044 132.779 10.5824C132.779 13.0806 134.646 15.1648 138.218 15.8736L141.516 16.5332C143.137 16.828 143.881 17.5789 143.881 18.5473C143.881 19.6631 142.695 20.5753 140.702 20.5753C138.295 20.5753 136.758 19.4806 136.477 17.8034H132.232C132.232 20.421 134.723 24.0069 140.582 24.0069C145.733 24.0069 148.225 20.9473 148.225 18.1894C148.239 15.5017 146.512 13.4455 142.421 12.6666Z" fill="#2D2D2D"/>
              </svg>
              <div style={{
                marginTop: '20px',
                fontSize: '28px',
                fontWeight: 800,
                color: '#2D2D2D',
                letterSpacing: '-0.5px'
              }}>TÄISMÄNG</div>
              <div style={{ marginTop: '6px', fontSize: '15px', color: '#5B7795' }}>
                Kogu kaart täidetud — 30 punkti!
              </div>
            </div>
          </div>
          {Array.from({ length: 80 }, (_, i) => {
            const left = Math.random() * 100
            const delay = Math.random() * 1.5
            const dur = 2.5 + Math.random() * 2
            const size = 6 + Math.random() * 8
            const colors = ['#0090FF', '#5B7795', '#BAC7D5', '#E7F4FF']
            return (
              <div key={i} style={{
                position: 'absolute',
                top: 0,
                left: `${left}%`,
                width: `${size}px`,
                height: `${size * 1.6}px`,
                background: colors[i % colors.length],
                borderRadius: '1px',
                animation: `cvkfall ${dur}s linear ${delay}s forwards`
              }} />
            )
          })}
        </div>
      )}
    </div>
  )
}
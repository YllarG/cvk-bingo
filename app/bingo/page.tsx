'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Square = {
  id: number
  text: string
  marked: boolean
}

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
  'N3 - VABA RUUT (CVK LOGO)',
  'Jagasin kolleegile sisulist tagasisidet',
  'Koostasin 5 memo ja saatsin klientidele',
  'Müüsin 25 kliendile vähemalt 3 erinevat teenust',
  'Analüüsisin kaotatud müüki + panin kirja õppetunni',
  'Müüsin 50 teenust allahindlusteha + klient valis kõrgema hinnaga pakkumise',
  'Parandsin oma müügiargumente + küsisin kliendi tagasisidet enda tööle',
  'Küsisin 10 kliendilt, miks nad meid valisid',
  'Müüsin sisuturundusartikli + bänneri võimendamiseks',
  'Lahendasin edukalt 5 vastuväidet "CV.ee on odavam"',
  'Ületasin kahel kuul müügieesmärgi',
  'Jagasin toimivat müügivõtet + kutsusin kohvipausile kolleegi kellega räägin vähem',
  'Valisin välja 10 juurdemüügi potentsiaaliga ettevõtet + müüsin 10 töökuulutusele lisateenuse'
]

const COLUMN_HEADERS = ['B', 'I', 'N', 'G', 'O']

export default function BingoPage() {
  const [user, setUser] = useState<any>(null)
  const [squares, setSquares] = useState<Square[]>([])
  const [wins, setWins] = useState<any[]>([])
  const [markedCount, setMarkedCount] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) router.push('/auth')
      else {
        setUser(user)
        loadCard(user.id)
        subscribeToUpdates()
      }
    }
    getUser()
  }, [])

  const loadCard = async (userId: string) => {
    const { data: cardData } = await supabase
      .from('cards')
      .select('id')
      .eq('player_id', userId)
      .single()

    let cardId = cardData?.id
    if (!cardId) {
      const { data: newCard } = await supabase
        .from('cards')
        .insert([{ player_id: userId }])
        .select()
      cardId = newCard?.[0]?.id
    }

    const { data: marked } = await supabase
      .from('marked_squares')
      .select('square_number')
      .eq('card_id', cardId)

    const markedNumbers = new Set(marked?.map(m => m.square_number) || [])
    markedNumbers.add(12) // N3 vaba ruut alati märgitud

    const newSquares = BINGO_SQUARES.map((text, idx) => ({
      id: idx,
      text,
      marked: markedNumbers.has(idx)
    }))

    setSquares(newSquares)
    setMarkedCount(markedNumbers.size)

    const { data: winsData } = await supabase
      .from('wins')
      .select('*')
      .eq('player_id', userId)
    setWins(winsData || [])
  }

  const subscribeToUpdates = () => {
    const channel = supabase
      .channel('bingo-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wins' },
        () => loadCard(user.id)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const toggleSquare = async (idx: number) => {
    if (idx === 12) return // N3 ei saa muuta

    const { data: cardData } = await supabase
      .from('cards')
      .select('id')
      .eq('player_id', user.id)
      .single()

    const cardId = cardData?.id

    const newSquares = [...squares]
    newSquares[idx].marked = !newSquares[idx].marked
    setSquares(newSquares)

    if (newSquares[idx].marked) {
      await supabase
        .from('marked_squares')
        .insert([{ card_id: cardId, square_number: idx }])
      setMarkedCount(c => c + 1)
      checkWin(cardId, idx)
    } else {
      await supabase
        .from('marked_squares')
        .delete()
        .eq('card_id', cardId)
        .eq('square_number', idx)
      setMarkedCount(c => c - 1)
    }
  }

  const checkWin = async (cardId: string, lastIdx: number) => {
    const marked = new Set(squares
      .filter(s => s.marked)
      .map(s => s.id))

    // Kontrolli mustrite
    const patterns = [
      // Read
      { name: 'B rida', indices: [0, 5, 10, 15, 20] },
      { name: 'I rida', indices: [1, 6, 11, 16, 21] },
      { name: 'N rida', indices: [2, 7, 12, 17, 22] },
      { name: 'G rida', indices: [3, 8, 13, 18, 23] },
      { name: 'O rida', indices: [4, 9, 14, 19, 24] },
      // Tulbad
      { name: 'B tulp', indices: [0, 1, 2, 3, 4] },
      { name: 'I tulp', indices: [5, 6, 7, 8, 9] },
      { name: 'N tulp', indices: [10, 11, 12, 13, 14] },
      { name: 'G tulp', indices: [15, 16, 17, 18, 19] },
      { name: 'O tulp', indices: [20, 21, 22, 23, 24] },
      // Diagonaalid
      { name: 'Diagonaal 1', indices: [0, 6, 12, 18, 24] },
      { name: 'Diagonaal 2', indices: [4, 8, 12, 16, 20] },
      // Nurgad
      { name: 'Nurgad', indices: [0, 4, 20, 24] }
    ]

    for (const pattern of patterns) {
      if (pattern.indices.every(i => marked.has(i))) {
        const { data: claimed } = await supabase
          .from('claimed_patterns')
          .select('*')
          .eq('pattern_type', pattern.name)

        if (!claimed || claimed.length === 0) {
          await supabase
            .from('wins')
            .insert([{ player_id: user.id, pattern_type: pattern.name }])

          await supabase
            .from('claimed_patterns')
            .insert([{
              pattern_type: pattern.name,
              claimed_by_player_id: user.id
            }])

          alert(`🎉 Võitsid: ${pattern.name}!`)
        }
      }
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">MÜÜGIBINGO</h1>
            <p className="text-gray-500">{user?.user_metadata?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Välja logimine
          </button>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-8">
          <p className="text-center text-gray-700">
            📊 Märgitud: <strong>{markedCount}/25</strong> | 
            Võite: <strong>{wins.length}</strong>
          </p>
        </div>

        <div className="mb-4">
          <div className="grid grid-cols-5 gap-1 mb-2">
            {COLUMN_HEADERS.map(h => (
              <div key={h} className="text-center font-bold text-blue-600">
                {h}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-2 bg-blue-50 p-4 rounded-lg">
            {squares.map((square) => (
              <button
                key={square.id}
                onClick={() => toggleSquare(square.id)}
                disabled={square.id === 12}
                className={`aspect-square p-2 rounded-lg text-xs font-medium text-center flex items-center justify-center cursor-pointer transition ${
                  square.id === 12
                    ? 'bg-white border-2 border-blue-600'
                    : square.marked
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {square.id === 12 ? (
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">CVK</div>
                  </div>
                ) : (
                  square.text
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-gray-50 p-4 rounded-lg">
          <h2 className="font-bold text-gray-900 mb-4">Minu võidud:</h2>
          {wins.length > 0 ? (
            <ul className="space-y-2">
              {wins.map((win, idx) => (
                <li key={idx} className="text-sm text-gray-700">
                  ✅ {win.pattern_type}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">Veel võite pole</p>
          )}
        </div>
      </div>
    </div>
  )
}
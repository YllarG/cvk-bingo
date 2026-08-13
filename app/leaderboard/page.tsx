'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type LeaderboardEntry = {
  player_name: string
  win_count: number
  patterns: string[]
  first_win_time: string
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadLeaderboard()
    const channel = supabase
      .channel('leaderboard-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wins' },
        () => loadLeaderboard()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadLeaderboard = async () => {
    const { data, error } = await supabase
      .from('wins')
      .select('player_id, players!inner(name), pattern_type, won_at')
      .order('won_at', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    const playerWins: {
      [key: string]: {
        name: string
        patterns: string[]
        first_win_time: string
      }
    } = {}

    data?.forEach((win: any) => {
      const playerId = win.player_id
      const playerName = win.players.name

      if (!playerWins[playerId]) {
        playerWins[playerId] = {
          name: playerName,
          patterns: [],
          first_win_time: win.won_at
        }
      }
      playerWins[playerId].patterns.push(win.pattern_type)
    })

    const leaderboardData = Object.values(playerWins)
      .sort((a, b) => b.patterns.length - a.patterns.length)
      .map(p => ({
        player_name: p.name,
        win_count: p.patterns.length,
        patterns: p.patterns,
        first_win_time: p.first_win_time
      }))

    setLeaderboard(leaderboardData)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">LEADERBOARD 🏆</h1>
          <Link href="/bingo">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Tagasi mängu
            </button>
          </Link>
        </div>

        {loading ? (
          <p className="text-center text-gray-500">Laadime...</p>
        ) : leaderboard.length === 0 ? (
          <p className="text-center text-gray-500">Veel võite pole</p>
        ) : (
          <div className="space-y-4">
            {leaderboard.map((entry, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-lg border-2 ${
                  idx === 0
                    ? 'border-yellow-400 bg-yellow-50'
                    : idx === 1
                    ? 'border-gray-400 bg-gray-50'
                    : idx === 2
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-300 bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {idx + 1}. {entry.player_name}
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(entry.first_win_time).toLocaleString('et-EE')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-blue-600">
                      {entry.win_count}
                    </div>
                    <p className="text-xs text-gray-500">võitu</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {entry.patterns.map((pattern, pidx) => (
                    <span
                      key={pidx}
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium"
                    >
                      {pattern}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 bg-blue-50 p-6 rounded-lg">
          <h2 className="font-bold text-gray-900 mb-2">ℹ️ Reglid:</h2>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>✅ Esimene kes täidab mustri → võidab selle</li>
            <li>✅ Teised ei saa samat mustrit enam võita</li>
            <li>✅ Mäng kestab kuni 31.12.2026</li>
            <li>✅ Võimalikud mustrid: read, tulbad, diagonaalid, nurgad, täismäng</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type AdminPlayer = {
  id: string
  name: string
  email: string
  created_at: string
  win_count: number
}

const ADMIN_EMAIL = 'ullar.gustavson@cvkeskus.ee' // Muutke oma email'iga!

export default function AdminPage() {
  const [players, setPlayers] = useState<AdminPlayer[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalPlayers: 0, totalWins: 0 })
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Admin kontroll - muutke enda email'iga
      if (!user || user.email !== ADMIN_EMAIL) {
        router.push('/auth')
        return
      }

      setUser(user)
      loadAdminData()
    }

    checkAdmin()
  }, [])

  const loadAdminData = async () => {
    // Mängijad
    const { data: playersData } = await supabase
      .from('players')
      .select('*')
      .order('created_at', { ascending: false })

    // Võidud
    const { data: winsData } = await supabase
      .from('wins')
      .select('player_id')

    // Arvuta võidud per mängija
    const winsPerPlayer: { [key: string]: number } = {}
    winsData?.forEach((win: any) => {
      winsPerPlayer[win.player_id] = (winsPerPlayer[win.player_id] || 0) + 1
    })

    const adminPlayers = playersData?.map((p: any) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      created_at: p.created_at,
      win_count: winsPerPlayer[p.id] || 0
    })) || []

    setPlayers(adminPlayers)
    setStats({
      totalPlayers: adminPlayers.length,
      totalWins: winsData?.length || 0
    })
    setLoading(false)
  }

  const resetPlayer = async (playerId: string) => {
    if (!confirm('Oled kindel? See kustutab kõik selle mängija andmed!')) return

    // Kustuta marked squares
    const { data: cards } = await supabase
      .from('cards')
      .select('id')
      .eq('player_id', playerId)

    for (const card of cards || []) {
      await supabase
        .from('marked_squares')
        .delete()
        .eq('card_id', card.id)
    }

    // Kustuta kaardid
    await supabase
      .from('cards')
      .delete()
      .eq('player_id', playerId)

    // Kustuta võidud
    await supabase
      .from('wins')
      .delete()
      .eq('player_id', playerId)

    // Vabasta claimed patterns
    await supabase
      .from('claimed_patterns')
      .delete()
      .eq('claimed_by_player_id', playerId)

    alert('Mängija reset!')
    loadAdminData()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">ADMIN PANEL 🔧</h1>
          <div className="space-x-4">
            <Link href="/leaderboard">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                Leaderboard
              </button>
            </Link>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Välja logimine
            </button>
          </div>
        </div>

        {!loading && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-300">
                <div className="text-3xl font-bold text-blue-600">
                  {stats.totalPlayers}
                </div>
                <p className="text-gray-600">Mängijaid</p>
              </div>
              <div className="bg-green-50 p-6 rounded-lg border-2 border-green-300">
                <div className="text-3xl font-bold text-green-600">
                  {stats.totalWins}
                </div>
                <p className="text-gray-600">Võite kokku</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-blue-600 text-white">
                  <tr>
                    <th className="px-6 py-3 text-left">Nimi</th>
                    <th className="px-6 py-3 text-left">Email</th>
                    <th className="px-6 py-3 text-center">Võidud</th>
                    <th className="px-6 py-3 text-left">Registreeritud</th>
                    <th className="px-6 py-3 text-center">Tegevused</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {players.map((player) => (
                    <tr key={player.id} className="hover:bg-gray-100">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {player.name}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{player.email}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">
                          {player.win_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(player.created_at).toLocaleString('et-EE')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => resetPlayer(player.id)}
                          className="bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 text-sm font-medium"
                        >
                          Reset
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 bg-yellow-50 p-6 rounded-lg border-2 border-yellow-300">
              <h2 className="font-bold text-gray-900 mb-2">⚠️ Oluline:</h2>
              <p className="text-sm text-gray-700 mb-2">
                Admin email: <code className="bg-white px-2 py-1 rounded">{ADMIN_EMAIL}</code>
              </p>
              <p className="text-sm text-gray-700">
                Muutke <code className="bg-white px-2 py-1 rounded">ADMIN_EMAIL</code> muutujat, 
                et lubada admin access'i.
              </p>
            </div>
          </>
        )}

        {loading && <p className="text-center text-gray-500">Laadime...</p>}
      </div>
    </div>
  )
}
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { businessInfo } from '../lib/useBusinessInfo.js'

// Lets a page through only for a signed-in account listed in the app_owners table.
// (The database enforces the same rule; this just gives a clear message instead of empty pages.)
export default function ProtectedRoute({ children, loginPath = '/owner/login' }) {
  const [session, setSession] = useState(undefined)
  const [owner, setOwner] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let alive = true
    setOwner(undefined)
    businessInfo.isOwner().then((ok) => alive && setOwner(ok))
    return () => {
      alive = false
    }
  }, [session])

  if (session === undefined || (session && owner === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to={loginPath} replace />

  if (!owner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-sm text-center">
          <ShieldAlert size={32} className="mx-auto text-amber-500 mb-3" />
          <h1 className="font-semibold text-gray-900">Not authorized</h1>
          <p className="text-sm text-gray-500 mt-2">
            {session.user?.email} is signed in but is not registered as the owner. Ask the developer to add this account to the
            owners list.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-5 text-sm text-pink-500 hover:text-pink-600 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return children
}

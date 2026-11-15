import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useBusinessInfo } from '../lib/useBusinessInfo.js'

export default function OwnerLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const { catalog } = useBusinessInfo()

  const salonName = catalog?.business?.name || 'Salon Studio'

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/owner')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50/70 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pink-600 bg-pink-50 border border-pink-100 px-3.5 py-1.5 rounded-full mb-4">
            <Sparkles size={13} />
            Owner Studio
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-3.5 shadow-md shadow-pink-500/20">
            <Sparkles size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{salonName}</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to manage bookings, chats, and studio rates</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white/95 backdrop-blur-sm rounded-3xl border border-pink-100/90 p-7 shadow-xl shadow-pink-100/40 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="owner@example.com"
              className="w-full min-h-[44px] border border-pink-100 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full min-h-[44px] border border-pink-100 rounded-xl px-4 py-2.5 text-sm text-gray-900 pr-11 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition-all"
              />
              <button
                type="button"
                aria-label={showPass ? 'Hide password' : 'Show password'}
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-pink-600 hover:bg-rose-50 transition-colors"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3.5 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-sm shadow-pink-500/20"
          >
            {loading ? 'Signing in...' : 'Sign In to Owner Studio'}
          </button>
        </form>

        <div className="text-center mt-5">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-pink-600 transition-colors"
          >
            <ArrowLeft size={13} />
            Back to Website
          </Link>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useBusinessInfo } from '../lib/useBusinessInfo.js'
import StudioMark from '../components/StudioMark.jsx'

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
    <div className="min-h-screen bg-[#f8f6f2] flex items-center justify-center px-3.5 py-6 sm:px-4 sm:py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-5 sm:mb-7">
          <div className="flex justify-center mb-3 sm:mb-4">
            <StudioMark size="lg" />
          </div>
          <p className="text-xs font-medium text-pink-700 mb-1">Owner studio</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-stone-900 tracking-[-0.02em]">{salonName}</h1>
          <p className="text-stone-500 text-xs sm:text-sm mt-1">Sign in to manage bookings, chats, and studio rates</p>
        </div>

        <form onSubmit={handleLogin} className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 p-5 sm:p-7 shadow-xs space-y-4 sm:space-y-5">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="owner@example.com"
              className="w-full min-h-11 border border-stone-200/80 bg-white rounded-lg px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-[border-color,box-shadow]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Password"
                className="w-full min-h-11 border border-stone-200/80 bg-white rounded-lg px-4 py-2.5 text-sm text-stone-900 pr-11 placeholder:text-stone-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-[border-color,box-shadow]"
              />
              <button
                type="button"
                aria-label={showPass ? 'Hide password' : 'Show password'}
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                {showPass ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3.5 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-press w-full min-h-11 bg-pink-600 hover:bg-pink-700 disabled:bg-pink-300 text-white text-sm font-medium py-2.5 rounded-lg"
          >
            {loading ? 'Signing in...' : 'Sign In to Owner Studio'}
          </button>
        </form>

        <div className="text-center mt-5">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-pink-700 transition-colors"
          >
            <ArrowLeft size={13} strokeWidth={1.75} />
            Back to Website
          </Link>
        </div>
      </div>
    </div>
  )
}

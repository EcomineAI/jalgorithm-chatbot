import { Link, useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-gray-900">
          <div className="w-7 h-7 bg-pink-500 rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          JALgorithm
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <a href="#how-it-works" className="text-gray-500 hover:text-gray-900 transition-colors hidden sm:block">
            How It Works
          </a>
          <a href="#services" className="text-gray-500 hover:text-gray-900 transition-colors hidden sm:block">
            Services
          </a>
          <Link
            to="/chat"
            className="bg-pink-500 hover:bg-pink-600 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
          >
            Book Now
          </Link>
        </div>
      </div>
    </nav>
  )
}

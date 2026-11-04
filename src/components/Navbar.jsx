import { Link, useLocation } from 'react-router-dom'
import { Sparkles, Menu, X } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Navbar() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const transparent = isHome && !scrolled
  const textColor = transparent ? 'text-white/80 hover:text-white' : 'text-gray-500 hover:text-gray-900'
  const logoColor = transparent ? 'text-white' : 'text-gray-900'

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      transparent ? 'bg-transparent border-transparent' : 'bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm'
    }`}>
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className={`flex items-center gap-2 font-bold transition-colors ${logoColor}`}>
          <div className="w-7 h-7 bg-pink-500 rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          JALgorithm
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-6 text-sm">
          <a href="#services" className={`transition-colors ${textColor}`}>Services</a>
          <a href="#how-it-works" className={`transition-colors ${textColor}`}>How It Works</a>
          <Link
            to="/chat"
            className="bg-pink-500 hover:bg-pink-600 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
          >
            Book Now
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className={`sm:hidden p-1 transition-colors ${textColor}`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-4 text-sm shadow-lg">
          <a href="#services" className="text-gray-600 hover:text-gray-900" onClick={() => setMenuOpen(false)}>Services</a>
          <a href="#how-it-works" className="text-gray-600 hover:text-gray-900" onClick={() => setMenuOpen(false)}>How It Works</a>
          <Link to="/chat" className="bg-pink-500 text-white font-semibold px-5 py-2.5 rounded-lg text-center" onClick={() => setMenuOpen(false)}>
            Book Now
          </Link>
        </div>
      )}
    </nav>
  )
}

import { Link, useLocation } from 'react-router-dom'
import { Sparkles, Menu, X, ChevronDown, MessageCircle, Scissors, Info, Phone, HelpCircle } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

const services = [
  { name: 'Bridal Makeup', price: 'PHP 3,500' },
  { name: 'Hair Styling', price: 'PHP 500' },
  { name: 'Personal Makeup', price: 'PHP 800' },
  { name: 'Event Package', price: 'PHP 2,500' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setServicesOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
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
          <div className="w-7 h-7 bg-pink-500 rounded-lg flex items-center justify-center animate-pulse-glow">
            <Sparkles size={14} className="text-white animate-spin-slow" />
          </div>
          Vicky's Parlor
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-6 text-sm">

          {/* Services dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setServicesOpen(!servicesOpen)}
              className={`flex items-center gap-1 transition-colors ${textColor}`}
            >
              Services
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${servicesOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {servicesOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                <div className="p-1.5">
                  {services.map((svc) => (
                    <a
                      key={svc.name}
                      href="#services"
                      onClick={() => setServicesOpen(false)}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-pink-50 group transition-colors"
                    >
                      <span className="text-gray-700 group-hover:text-gray-900 text-sm font-medium">{svc.name}</span>
                      <span className="text-pink-500 text-xs font-semibold">{svc.price}</span>
                    </a>
                  ))}
                </div>
                <div className="border-t border-gray-100 p-2">
                  <Link
                    to="/chat"
                    onClick={() => setServicesOpen(false)}
                    className="flex items-center justify-center gap-1.5 w-full bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold py-2 rounded-xl transition-colors"
                  >
                    Book a Service
                  </Link>
                </div>
              </div>
            )}
          </div>

          <a href="#about" className={`link-underline transition-colors ${textColor}`}>About</a>
          <a href="#contact" className={`link-underline transition-colors ${textColor}`}>Contact</a>
          <a href="#how-it-works" className={`link-underline transition-colors ${textColor}`}>How It Works</a>
          <Link
            to="/chat"
            className={`link-underline flex items-center gap-1.5 transition-colors ${textColor}`}
          >
            <MessageCircle size={14} />
            Chat with JAL
          </Link>
          <Link
            to="/chat"
            className="btn-press bg-pink-500 hover:bg-pink-600 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
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
      <div className={`sm:hidden transition-all duration-300 ease-in-out overflow-hidden ${menuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-2xl">
          <div className="px-4 pt-4 pb-6 flex flex-col gap-1">

            {/* Services accordion */}
            <button
              className="flex items-center justify-between w-full px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors group"
              onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-pink-50 rounded-lg flex items-center justify-center">
                  <Scissors size={14} className="text-pink-500" />
                </div>
                <span className="text-gray-700 font-medium text-sm">Services</span>
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${mobileServicesOpen ? 'rotate-180' : ''}`} />
            </button>

            {mobileServicesOpen && (
              <div className="mx-3 mb-1 bg-pink-50/60 rounded-xl overflow-hidden border border-pink-100">
                {services.map((svc, i) => (
                  <a
                    key={svc.name}
                    href="#services"
                    onClick={() => { setMenuOpen(false); setMobileServicesOpen(false) }}
                    className={`flex items-center justify-between px-4 py-3 hover:bg-pink-100/60 transition-colors ${i < services.length - 1 ? 'border-b border-pink-100' : ''}`}
                  >
                    <span className="text-gray-700 text-sm">{svc.name}</span>
                    <span className="text-pink-500 text-xs font-bold">{svc.price}</span>
                  </a>
                ))}
              </div>
            )}

            {/* Nav links */}
            {[
              { href: '#about', label: 'About', Icon: Info },
              { href: '#contact', label: 'Contact', Icon: Phone },
              { href: '#how-it-works', label: 'How It Works', Icon: HelpCircle },
            ].map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Icon size={14} className="text-gray-500" />
                </div>
                <span className="text-gray-700 font-medium text-sm">{label}</span>
              </a>
            ))}

            {/* Divider */}
            <div className="border-t border-gray-100 my-2" />

            {/* Chat with JAL */}
            <Link
              to="/chat"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-pink-50 transition-colors"
            >
              <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
                <MessageCircle size={14} className="text-pink-500" />
              </div>
              <span className="text-pink-500 font-semibold text-sm">Chat with JAL</span>
            </Link>

            {/* Book Now */}
            <Link
              to="/chat"
              onClick={() => setMenuOpen(false)}
              className="mt-1 w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3.5 rounded-xl text-center text-sm transition-colors shadow-lg shadow-pink-200"
            >
              Book Now
            </Link>

          </div>
        </div>
      </div>
    </nav>
  )
}

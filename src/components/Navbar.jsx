import { Link, useLocation } from 'react-router-dom'
import {
  Menu,
  X,
  ChevronDown,
  MessageCircle,
  Scissors,
  Info,
  Phone,
  HelpCircle,
  Clock,
  Images,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import StudioMark from './StudioMark.jsx'
import { useBusinessInfo } from '../lib/useBusinessInfo.js'
import { formatServicePrice, formatDuration } from '../lib/ownerInsights.js'
import { formatTime } from '../jalgorithm/entities/calendar.js'

function hasConfiguredUrl(url) {
  const clean = String(url ?? '').trim().toLowerCase().replace(/\/+$/, '')
  if (!clean) return false
  return ![
    'https://m.me',
    'http://m.me',
    'https://facebook.com',
    'https://www.facebook.com',
    'https://instagram.com',
    'https://www.instagram.com',
  ].includes(clean)
}

export default function Navbar() {
  // Services and studio profile come from the Owner's panel (same catalog JAL uses).
  const { catalog } = useBusinessInfo()
  const biz = catalog?.business
  const services = (catalog?.services ?? []).map((s) => ({
    key: s.key,
    name: s.name,
    price: formatServicePrice(s),
    duration: formatDuration(s.durationMinutes),
  }))

  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const [drawerServicesOpen, setDrawerServicesOpen] = useState(true)
  const dropdownRef = useRef(null)

  const studioName = biz?.name ?? "Vicky's Parlor"
  const studioHours = biz?.hours ? `${formatTime(biz.hours.open)} - ${formatTime(biz.hours.close)}` : null
  const minAdvanceDays = biz?.rules?.minAdvanceDays ?? 3
  const contactDigits = String(biz?.contact ?? '').replace(/[^\d+]/g, '')
  const telHref = contactDigits.length >= 7 ? `tel:${contactDigits}` : null
  const messengerUrl = hasConfiguredUrl(biz?.messengerUrl) ? biz.messengerUrl : null

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [drawerOpen])

  useEffect(() => {
    const onClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setServicesOpen(false)
      }
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setServicesOpen(false)
        setDrawerOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const transparent = isHome && !scrolled
  const linkColor = transparent
    ? 'text-white/85 hover:text-white'
    : 'text-gray-600 hover:text-pink-600'
  const logoColor = transparent ? 'text-white' : 'text-gray-900'

  const sectionLinks = [
    { href: '#gallery', label: 'Lookbook', Icon: Images },
    { href: '#how-it-works', label: 'How It Works', Icon: HelpCircle },
    { href: '#about', label: 'About', Icon: Info },
    { href: '#contact', label: 'Booking Guide', Icon: Phone },
  ]

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-40 transition-[background-color,border-color,box-shadow] duration-200 ${
          transparent
            ? 'bg-gradient-to-b from-stone-950/65 to-transparent border-transparent'
            : 'bg-[#fdfcfa]/95 backdrop-blur-md border-b border-stone-200/80 shadow-2xs'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link
            to="/"
            className={`flex items-center gap-2.5 font-semibold min-w-0 transition-colors ${logoColor}`}
          >
            <StudioMark size="sm" />
            <span className="truncate text-sm sm:text-base">{studioName}</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-5 lg:gap-6 text-sm font-medium">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setServicesOpen((v) => !v)}
                className={`flex items-center gap-1 transition-colors ${linkColor}`}
              >
                Services
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${servicesOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {servicesOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-80 bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden z-50">
                  <div className="px-3.5 py-2.5 border-b border-stone-200/80 bg-[#fdfcfa] flex items-center justify-between">
                    <span className="text-xs font-medium text-stone-600">
                      Studio services
                    </span>
                    <a
                      href="#services"
                      onClick={() => setServicesOpen(false)}
                      className="text-xs font-medium text-pink-700 hover:text-pink-800"
                    >
                      View all
                    </a>
                  </div>
                  <div className="p-1.5 max-h-72 overflow-y-auto">
                    {services.map((svc) => (
                      <Link
                        key={svc.key || svc.name}
                        to={`/chat?service=${encodeURIComponent(svc.key)}`}
                        onClick={() => setServicesOpen(false)}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-stone-50 group transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-stone-900 group-hover:text-pink-700 text-sm font-medium truncate">
                            {svc.name}
                          </div>
                          <div className="text-xs text-stone-500 tabular-nums">{svc.duration}</div>
                        </div>
                        <span className="text-pink-700 text-xs font-medium tabular-nums shrink-0">{svc.price}</span>
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-stone-200/80 p-2 bg-white">
                    <Link
                      to="/chat"
                      onClick={() => setServicesOpen(false)}
                      className="flex items-center justify-center gap-1.5 w-full bg-pink-600 hover:bg-pink-700 text-white text-xs font-medium min-h-9 rounded-lg transition-colors"
                    >
                      Book with JAL
                      <ArrowRight size={14} strokeWidth={1.75} />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {sectionLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className={`link-underline transition-colors whitespace-nowrap ${linkColor}`}
              >
                {label}
              </a>
            ))}

            <Link
              to="/chat"
              className={`link-underline inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${linkColor}`}
            >
              <MessageCircle size={14} />
              <span>Chat with JAL</span>
            </Link>

            <Link
              to="/chat"
              className="btn-press bg-pink-600 hover:bg-pink-700 text-white font-medium px-4 lg:px-5 min-h-9 inline-flex items-center rounded-lg text-sm whitespace-nowrap shrink-0"
            >
              Book Now
            </Link>
          </div>

          {/* Mobile & Narrow-Tablet Controls */}
          <div className="flex md:hidden items-center gap-2 shrink-0">
            <Link
              to="/chat"
              className="bg-pink-600 hover:bg-pink-700 text-white text-xs font-medium px-3 min-h-9 inline-flex items-center rounded-lg transition-colors whitespace-nowrap"
            >
              Book Now
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open website navigation drawer"
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                transparent
                  ? 'border-white/25 bg-white/10 text-white hover:bg-white/20'
                  : 'border-stone-200 bg-[#fdfcfa] text-stone-700 hover:bg-stone-100'
              }`}
            >
              <Menu size={18} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Website Slide-Out Sidebar Drawer (< md) */}
      <div
        className={`md:hidden fixed inset-0 z-50 flex transition-[visibility] duration-300 ${
          drawerOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!drawerOpen}
        aria-label="Website Navigation Sidebar"
      >
        <div
          className={`fixed inset-0 bg-stone-950/50 backdrop-blur-xs transition-opacity duration-300 ease-[var(--ease-editorial)] ${
            drawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={`relative z-10 w-[min(86vw,21rem)] max-w-full bg-white h-full flex flex-col border-r border-stone-200 shadow-2xl transition-transform duration-300 ease-[var(--ease-editorial)] will-change-transform ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
            {/* Drawer Header */}
            <div className="px-4 py-4 border-b border-stone-200/80 bg-[#fdfcfa] flex items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <StudioMark size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-900 truncate">{studioName}</div>
                  <div className="text-xs font-normal text-stone-500 truncate">
                    {biz?.location ?? 'Hair and Makeup Studio'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation drawer"
                className="w-9 h-9 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 flex items-center justify-center shrink-0"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            {/* Live Studio Status Banner */}
            <div className="px-4 py-2.5 bg-[#f8f6f2] border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 tabular-nums">
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {studioHours ? `${studioHours} Daily` : 'Open Daily'}
              </span>
              <span className="font-medium text-stone-600 bg-white border border-stone-200 px-2 py-0.5 rounded-md">
                {minAdvanceDays}-day advance notice
              </span>
            </div>

            {/* Scrollable Links & Dynamic Services */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              <button
                type="button"
                onClick={() => setDrawerServicesOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 min-h-11 rounded-lg bg-[#f8f6f2] hover:bg-stone-100 text-sm font-medium text-stone-900 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-md bg-white border border-stone-200 text-stone-700 flex items-center justify-center">
                    <Scissors size={14} strokeWidth={1.75} />
                  </span>
                  <span>Services &amp; Rates</span>
                </span>
                <ChevronDown
                  size={16}
                  className={`text-stone-400 transition-transform ${drawerServicesOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {drawerServicesOpen && services.length > 0 && (
                <div className="mx-1 rounded-lg border border-stone-200/80 bg-white overflow-hidden divide-y divide-stone-100">
                  {services.map((svc) => (
                    <Link
                      key={svc.key || svc.name}
                      to={`/chat?service=${encodeURIComponent(svc.key)}`}
                      onClick={() => setDrawerOpen(false)}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-stone-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-stone-900 truncate">{svc.name}</div>
                        <div className="text-xs text-stone-500 flex items-center gap-1 tabular-nums">
                          <Clock size={12} strokeWidth={1.75} />
                          {svc.duration}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-pink-700 tabular-nums shrink-0">{svc.price}</span>
                    </Link>
                  ))}
                </div>
              )}

              <div className="pt-2 space-y-1">
                {sectionLinks.map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-2.5 px-3 min-h-11 rounded-lg hover:bg-stone-100 text-sm font-normal text-stone-700 transition-colors"
                  >
                    <Icon size={16} strokeWidth={1.75} className="text-stone-500 shrink-0" />
                    <span>{label}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-stone-200/80 bg-[#fdfcfa] space-y-2.5 shrink-0">
              {(telHref || messengerUrl) && (
                <div className="flex items-center gap-2">
                  {telHref && (
                    <a
                      href={telHref}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-10 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-700 hover:text-pink-700"
                    >
                      <Phone size={14} strokeWidth={1.75} className="text-stone-500" />
                      Call Studio
                    </a>
                  )}
                  {messengerUrl && (
                    <a
                      href={messengerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-10 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-700 hover:text-pink-700"
                    >
                      Page
                      <ExternalLink size={12} strokeWidth={1.75} className="text-stone-500" />
                    </a>
                  )}
                </div>
              )}

              <Link
                to="/chat"
                onClick={() => setDrawerOpen(false)}
                className="w-full inline-flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-medium min-h-11 px-4 rounded-lg transition-colors"
              >
                <MessageCircle size={15} strokeWidth={1.75} />
                Book with JAL
              </Link>
            </div>
          </aside>
        </div>
    </>
  )
}

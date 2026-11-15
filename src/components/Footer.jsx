import { Link } from 'react-router-dom'
import { ExternalLink, MessageCircle, Phone, MapPin, Clock, Lock } from 'lucide-react'
import { useBusinessInfo } from '../lib/useBusinessInfo.js'
import { formatTime } from '../jalgorithm/entities/calendar.js'
import StudioMark from './StudioMark.jsx'

function isConfiguredUrl(url) {
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

export default function Footer() {
  const { catalog } = useBusinessInfo()
  const biz = catalog?.business
  const name = biz?.name ?? "Vicky's Parlor"
  const location = biz?.location ?? 'Olongapo City'
  const hours = biz?.hours ? `${formatTime(biz.hours.open)} - ${formatTime(biz.hours.close)}` : null
  const contactDigits = String(biz?.contact ?? '').replace(/[^\d+]/g, '')
  const telHref = contactDigits.length >= 7 ? `tel:${contactDigits}` : null
  const messenger = isConfiguredUrl(biz?.messengerUrl) ? biz.messengerUrl : null
  const portfolio = isConfiguredUrl(biz?.portfolio) ? biz.portfolio : null

  return (
    <footer className="border-t border-stone-200/80 bg-[#f8f6f2] pt-10 pb-24 sm:pb-10 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Studio Identity */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <StudioMark size="sm" />
              <span className="font-medium text-stone-900 text-base">{name}</span>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed max-w-xs">
              Hair and makeup artistry backed by JAL for appointment checks, package rates, and automated reminders.
            </p>
            <div className="space-y-1.5 text-xs text-stone-500">
              <div className="flex items-center gap-2">
                <MapPin size={14} strokeWidth={1.75} className="text-stone-400 shrink-0" />
                <span>{location}</span>
              </div>
              {hours && (
                <div className="flex items-center gap-2">
                  <Clock size={14} strokeWidth={1.75} className="text-stone-400 shrink-0" />
                  <span className="tabular-nums">{hours} Daily</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Sections */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-stone-500">Explore</p>
            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-stone-600">
              <a href="#services" className="hover:text-pink-700 transition-colors">
                Services &amp; Rates
              </a>
              <a href="#gallery" className="hover:text-pink-700 transition-colors">
                Studio Lookbook
              </a>
              <a href="#how-it-works" className="hover:text-pink-700 transition-colors">
                How It Works
              </a>
              <a href="#about" className="hover:text-pink-700 transition-colors">
                Meet the Artist
              </a>
              <a href="#contact" className="hover:text-pink-700 transition-colors">
                Booking Guide
              </a>
              <Link to="/chat" className="text-pink-700 font-medium hover:text-pink-800 transition-colors">
                Chat with JAL
              </Link>
            </div>
          </div>

          {/* Direct Links & Booking */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-stone-500">Connect &amp; Book</p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {telHref && (
                <a
                  href={telHref}
                  className="inline-flex items-center gap-1.5 px-3 min-h-9 rounded-lg border border-stone-200 bg-white text-stone-700 hover:text-pink-700 hover:border-pink-200 transition-colors tabular-nums"
                >
                  <Phone size={13} strokeWidth={1.75} className="text-stone-500" />
                  {biz.contact}
                </a>
              )}
              {messenger && (
                <a
                  href={messenger}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 min-h-9 rounded-lg border border-stone-200 bg-white text-stone-800 hover:text-pink-700 hover:border-pink-200 font-medium transition-colors"
                >
                  <MessageCircle size={13} strokeWidth={1.75} />
                  Facebook Page
                  <ExternalLink size={12} />
                </a>
              )}
              {portfolio && (
                <a
                  href={portfolio}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 min-h-9 rounded-lg border border-stone-200 bg-white text-stone-600 hover:text-pink-700 transition-colors"
                >
                  Portfolio
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <div>
              <Link
                to="/chat"
                className="btn-press inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-medium px-4 min-h-9 rounded-lg"
              >
                <MessageCircle size={14} strokeWidth={1.75} />
                Book Appointment
              </Link>
            </div>
          </div>
        </div>

        <div className="pt-5 border-t border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-500">
          <p className="tabular-nums">&copy; {new Date().getFullYear()} {name} | Powered by JALgorithm</p>
          <Link
            to="/owner"
            className="inline-flex items-center gap-1.5 text-stone-500 hover:text-pink-700 transition-colors"
          >
            <Lock size={12} strokeWidth={1.75} />
            Owner Studio
          </Link>
        </div>
      </div>
    </footer>
  )
}

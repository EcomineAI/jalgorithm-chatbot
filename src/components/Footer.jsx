import { Link } from 'react-router-dom'
import { ExternalLink, MessageCircle, Phone } from 'lucide-react'
import { useBusinessInfo } from '../lib/useBusinessInfo.js'
import { formatTime } from '../jalgorithm/entities/calendar.js'

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
    <footer className="border-t border-pink-100 bg-white py-8 px-6 pb-20 sm:pb-8">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-gray-500">
        <div className="text-center md:text-left">
          <p className="font-semibold text-gray-800">{name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Hair and Makeup Services | {location}
            {hours ? ` | ${hours} Daily` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
          {telHref && (
            <a
              href={telHref}
              className="inline-flex items-center gap-1 text-gray-600 hover:text-pink-600 transition-colors"
            >
              <Phone size={12} className="text-pink-500" />
              {biz.contact}
            </a>
          )}
          {messenger && (
            <a
              href={messenger}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-pink-600 hover:text-pink-700 font-medium transition-colors"
            >
              <MessageCircle size={12} />
              Facebook Page
              <ExternalLink size={10} />
            </a>
          )}
          {portfolio && (
            <a
              href={portfolio}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-gray-600 hover:text-pink-600 transition-colors"
            >
              Portfolio
              <ExternalLink size={10} />
            </a>
          )}
          <Link
            to="/chat"
            className="inline-flex items-center gap-1 bg-pink-50 hover:bg-pink-100 text-pink-600 font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            Book with JAL
          </Link>
        </div>

        <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} | Powered by JALgorithm</p>
      </div>
    </footer>
  )
}

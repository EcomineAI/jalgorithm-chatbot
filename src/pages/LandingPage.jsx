import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  MessageCircle,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  CreditCard,
  ExternalLink,
  X,
  Info,
  CalendarClock,
  Images,
  HelpCircle,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import StudioMark from '../components/StudioMark.jsx'
import { useBusinessInfo } from '../lib/useBusinessInfo.js'
import { formatServicePrice, formatDuration } from '../lib/ownerInsights.js'
import { formatTime } from '../jalgorithm/entities/calendar.js'
import {
  DEFAULT_HERO_PHOTO_URL,
  DEFAULT_ARTIST_PHOTO_URL,
  SHOWCASE_GALLERY_URLS,
  SHOWCASE_SERVICE_IMAGES,
} from '../jalgorithm/config/business.js'

function hasRealUrl(url) {
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

function buildDynamicServices(catalog) {
  const all = catalog?.services ?? []
  return all.map((s) => ({
    key: s.key,
    name: s.name,
    desc: s.description,
    inclusions: s.inclusions,
    priceNote: s.priceNote,
    featured: Boolean(s.showOnLanding),
    durationMinutes: Number(s.durationMinutes) || 60,
    duration: formatDuration(s.durationMinutes),
    price: formatServicePrice(s),
    img: s.imageUrl || SHOWCASE_SERVICE_IMAGES[s.key] || DEFAULT_ARTIST_PHOTO_URL,
  }))
}

const BOOKING_FLOW_STEPS = [
  {
    icon: MessageCircle,
    title: 'Chat with JAL',
    desc: 'Pick your hair or makeup service, target date, time slot, and venue anytime 24/7.',
  },
  {
    icon: CheckCircle,
    title: 'Instant Slot Check & Ref Code',
    desc: 'Your schedule is checked against studio availability and confirmed with a unique JAL reference code.',
  },
  {
    icon: Bell,
    title: 'Prep & Automated Reminders',
    desc: 'Receive calendar links, travel guidance, and timely reminders before your event day.',
  },
]

export default function LandingPage() {
  const { catalog } = useBusinessInfo()
  const allServices = useMemo(() => buildDynamicServices(catalog), [catalog])
  const biz = catalog?.business
  const heroImg = biz?.heroPhotoUrl || DEFAULT_HERO_PHOTO_URL
  const artistImg = biz?.artistPhotoUrl || DEFAULT_ARTIST_PHOTO_URL
  const gallery = biz?.galleryUrls?.length ? biz.galleryUrls : SHOWCASE_GALLERY_URLS

  const [serviceFilter, setServiceFilter] = useState('all')
  const [openFaqId, setOpenFaqId] = useState('advance')
  const [selectedService, setSelectedService] = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedService(null)
        setLightboxIndex(null)
      } else if (lightboxIndex !== null && e.key === 'ArrowRight') {
        setLightboxIndex((i) => (i + 1) % gallery.length)
      } else if (lightboxIndex !== null && e.key === 'ArrowLeft') {
        setLightboxIndex((i) => (i - 1 + gallery.length) % gallery.length)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightboxIndex, gallery.length])

  const paymentBadges = String(biz?.paymentMethods ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const freeAreas = biz?.freeTravelAreas ?? []
  const travelAreas = biz?.travelAreas ?? []
  const minAdvanceDays = biz?.rules?.minAdvanceDays ?? 3
  const messengerLink = hasRealUrl(biz?.messengerUrl) ? biz.messengerUrl : null
  const portfolioLink = hasRealUrl(biz?.portfolio) ? biz.portfolio : null
  const contactDigits = String(biz?.contact ?? '').replace(/[^\d+]/g, '')
  const telHref = contactDigits.length >= 7 ? `tel:${contactDigits}` : null
  const studioHoursText = biz?.hours
    ? `${formatTime(biz.hours.open)} - ${formatTime(biz.hours.close)}`
    : 'Flexible Hours'

  const serviceFilters = useMemo(() => {
    const pills = [{ id: 'all', label: `All Services (${allServices.length})` }]
    const featuredCount = allServices.filter((s) => s.featured).length
    const quickCount = allServices.filter((s) => s.durationMinutes < 120).length
    const longCount = allServices.filter((s) => s.durationMinutes >= 120).length
    if (featuredCount > 0 && featuredCount < allServices.length) {
      pills.push({ id: 'featured', label: `Featured (${featuredCount})` })
    }
    if (quickCount > 0 && quickCount < allServices.length) {
      pills.push({ id: 'quick', label: `Under 2 Hours (${quickCount})` })
    }
    if (longCount > 0 && longCount < allServices.length) {
      pills.push({ id: 'full', label: `2+ Hours (${longCount})` })
    }
    return pills
  }, [allServices])

  const visibleServices = useMemo(() => {
    if (serviceFilter === 'featured') return allServices.filter((s) => s.featured)
    if (serviceFilter === 'quick') return allServices.filter((s) => s.durationMinutes < 120)
    if (serviceFilter === 'full') return allServices.filter((s) => s.durationMinutes >= 120)
    return allServices
  }, [allServices, serviceFilter])

  const dynamicFaqs = useMemo(() => {
    const items = [
      {
        id: 'advance',
        question: 'How far in advance should I book my session?',
        answer: `Appointments open at least ${minAdvanceDays} day${minAdvanceDays === 1 ? '' : 's'} in advance so schedules and kit prep are confirmed smoothly.${
          biz?.rules?.sameDayRushNote ? ` ${biz.rules.sameDayRushNote}` : ''
        }`,
      },
      {
        id: 'travel',
        question: 'Which areas qualify for free travel vs. out-of-town fees?',
        answer: [
          freeAreas.length > 0 ? `Free travel coverage: ${freeAreas.join(', ')}.` : null,
          travelAreas.length > 0 ? `Out-of-town service areas: ${travelAreas.join(', ')}.` : null,
          biz?.travelFeeNote || null,
        ]
          .filter(Boolean)
          .join(' '),
      },
      {
        id: 'deposits',
        question: 'What are your down payment, reservation, and cancellation rules?',
        answer: [
          biz?.rules?.weddingDownpaymentPercent != null
            ? `Weddings: ${biz.rules.weddingDownpaymentPercent}% down payment${
                biz.rules.weddingCancelCutoffDays
                  ? ` (${biz.rules.weddingCancelCutoffDays}-day cancellation cutoff)`
                  : ''
              }.`
            : null,
          biz?.rules?.eventDownpaymentPercent
            ? `Events: ${biz.rules.eventDownpaymentPercent} reservation fee${
                biz.rules.eventCancelCutoffDays
                  ? ` (${biz.rules.eventCancelCutoffDays}-day cutoff)`
                  : ''
              }.`
            : null,
          paymentBadges.length > 0 ? `Accepted methods: ${paymentBadges.join(', ')}.` : null,
        ]
          .filter(Boolean)
          .join(' '),
      },
    ]

    if (biz?.additionalHeadPrice != null) {
      items.push({
        id: 'heads',
        question: 'Can I add extra bridesmaids, family members, or entourage heads?',
        answer: `Yes! Additional heads start from PHP ${Number(biz.additionalHeadPrice).toLocaleString(
          'en-PH',
        )} per person. You can ask JAL to estimate your group total or coordinate directly via our Page.`,
      })
    }

    return items.filter((item) => item.answer)
  }, [biz, freeAreas, travelAreas, minAdvanceDays, paymentBadges])

  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-[86svh] sm:min-h-[92vh] flex items-center overflow-hidden bg-gray-950">
        <img
          src={heroImg}
          alt={biz?.name ?? 'Hair and Makeup Studio'}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-55"
          onError={(e) => {
            e.target.style.display = 'none'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/95 via-gray-950/70 to-gray-950/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-transparent to-transparent" />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-16 sm:pb-24 grid md:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="md:col-span-7">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-medium text-white leading-[1.06] tracking-[-0.02em] mb-4 sm:mb-5">
              Look Good,
              <br />
              Feel <span className="text-pink-300">Beautiful</span>
            </h1>

            <p className="text-white/80 text-sm sm:text-base mb-7 leading-relaxed max-w-lg">
              Hair and makeup artistry in {biz?.location ?? 'Olongapo City'}. Reserve at least {minAdvanceDays} days ahead or ask JAL for open slots, package inclusions, and travel quotes.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-7">
              <Link
                to="/chat"
                className="btn-press inline-flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white font-medium px-6 sm:px-7 min-h-12 rounded-lg text-sm sm:text-base"
              >
                Book Appointment
                <ArrowRight size={16} strokeWidth={1.75} />
              </Link>
              <a
                href="#services"
                className="inline-flex items-center justify-center gap-2 border border-white/25 bg-white/5 hover:bg-white/10 hover:border-white/40 text-white/90 hover:text-white font-medium px-6 sm:px-7 min-h-12 rounded-lg transition-colors text-sm sm:text-base"
              >
                Explore Services
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-white/75">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} strokeWidth={1.75} className="text-pink-300" />
                {biz?.location ?? 'Olongapo City'}
              </span>
              <span className="text-white/30" aria-hidden="true">|</span>
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Clock size={14} strokeWidth={1.75} className="text-pink-300" />
                {studioHoursText} Daily
              </span>
            </div>
          </div>

          {/* White Frosted-Glass Hero Chat Preview Card */}
          <div className="hidden md:flex md:col-span-5 justify-end">
            <div className="bg-white/75 backdrop-blur-xl border border-white/60 ring-1 ring-black/5 rounded-2xl p-5 lg:p-6 w-80 lg:w-[21rem] shadow-2xl">
              <div className="flex items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-stone-900/10">
                <div className="flex items-center gap-3 min-w-0">
                  <StudioMark size="md" />
                  <div className="min-w-0">
                    <div className="text-stone-900 font-medium text-sm truncate">JAL</div>
                    <div className="text-stone-600 text-xs truncate">
                      {biz?.name ?? "Vicky's Parlor"}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono text-stone-600 tabular-nums shrink-0">
                  {studioHoursText}
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="bg-white/65 backdrop-blur-sm border border-white/80 rounded-xl rounded-tl-sm px-3.5 py-2.5 text-stone-900 text-xs leading-relaxed shadow-2xs">
                  Welcome to {biz?.name ?? "Vicky's Parlor"}. Which hair or makeup session can I help schedule for you?
                </div>
                <div className="bg-pink-600 rounded-xl rounded-tr-sm px-3.5 py-2.5 text-white text-xs ml-8 leading-relaxed shadow-xs">
                  How much is {allServices[0]?.name ?? 'Bridal Makeup'}?
                </div>
                <div className="bg-white/65 backdrop-blur-sm border border-white/80 rounded-xl rounded-tl-sm px-3.5 py-2.5 text-stone-900 text-xs leading-relaxed shadow-2xs">
                  {allServices[0]?.name ?? 'Bridal Makeup'} rate: {allServices[0]?.price ?? 'PHP 3,500'} ({allServices[0]?.duration ?? '3 hrs'}). Would you like to check open dates?
                </div>
              </div>

              <Link
                to="/chat"
                className="btn-press mt-4 w-full bg-pink-600 hover:bg-pink-700 text-white text-xs font-medium min-h-10 rounded-lg flex items-center justify-center gap-2 shadow-sm"
              >
                Open Studio Chat
                <ArrowRight size={14} strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Studio Highlights Bar */}
      <section id="highlights" className="bg-[#f8f6f2] border-y border-stone-200/80 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl border border-stone-200/80 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
              <MapPin size={16} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-normal text-stone-500">Location</p>
              <p className="text-xs sm:text-sm font-medium text-stone-900 truncate">
                {biz?.location ?? 'Olongapo City'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200/80 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
              <Clock size={16} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-normal text-stone-500">Studio hours</p>
              <p className="text-xs sm:text-sm font-medium text-stone-900 truncate tabular-nums">
                {studioHoursText}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200/80 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
              <CalendarClock size={16} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-normal text-stone-500">Booking notice</p>
              <p className="text-xs sm:text-sm font-medium text-stone-900 truncate tabular-nums">
                {minAdvanceDays}+ Days Ahead
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200/80 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
              <MessageCircle size={16} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-normal text-stone-500">Reservations</p>
              <p className="text-xs sm:text-sm font-medium text-stone-900 truncate">
                Live slot booking
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Showcase */}
      <section id="services" className="py-14 sm:py-20 px-4 sm:px-6 bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 gap-4">
            <div>
              <p className="text-pink-700 text-xs sm:text-sm font-medium mb-1">
                What we offer
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-medium text-gray-900 tracking-[-0.02em]">
                Packages &amp; Studio Services
              </h2>
              <p className="text-gray-500 text-xs sm:text-sm mt-1">
                Synced live from {biz?.name ?? 'our studio'}. Tap any card to view full package inclusions.
              </p>
            </div>
            <Link
              to="/chat"
              className="text-pink-700 hover:text-pink-800 text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 group shrink-0"
            >
              Ask JAL for recommendations
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Dynamic Quick-Filter Tabs */}
          {serviceFilters.length > 1 && (
            <div className="flex overflow-x-auto sm:flex-wrap gap-2 pb-2 mb-6 -mx-1 px-1 sm:mx-0 sm:px-0">
              {serviceFilters.map((pill) => {
                const active = serviceFilter === pill.id
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setServiceFilter(pill.id)}
                    className={`shrink-0 whitespace-nowrap px-3.5 min-h-9 rounded-lg border text-xs font-medium transition-colors ${
                      active
                        ? 'bg-pink-600 border-pink-600 text-white'
                        : 'bg-[#f8f6f2] border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-100'
                    }`}
                  >
                    {pill.label}
                  </button>
                )
              })}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {visibleServices.map((svc) => (
              <div
                key={svc.key || svc.name}
                className="group rounded-xl overflow-hidden border border-stone-200/80 bg-white flex flex-col hover-lift hover:border-stone-300"
              >
                <button
                  type="button"
                  onClick={() => setSelectedService(svc)}
                  className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100 text-left"
                >
                  <img
                    src={svc.img}
                    alt={svc.name}
                    className="w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-95"
                    onError={(e) => {
                      e.target.src = `https://placehold.co/400x300/f5f5f4/db2777?text=${encodeURIComponent(svc.name)}`
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                  {svc.featured && (
                    <span className="absolute top-2.5 left-2.5 inline-flex items-center text-xs font-medium bg-pink-600 text-white px-2.5 py-0.5 rounded-md">
                      Popular
                    </span>
                  )}
                  <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 text-xs font-medium bg-black/60 backdrop-blur-xs text-white px-2.5 py-0.5 rounded-md tabular-nums">
                    <Clock size={12} strokeWidth={1.75} />
                    {svc.duration}
                  </span>
                </button>

                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-medium text-stone-900 text-sm sm:text-base">{svc.name}</h3>
                  {svc.desc && (
                    <p className="text-stone-500 text-xs mt-1 mb-2.5 line-clamp-2 leading-relaxed">
                      {svc.desc}
                    </p>
                  )}
                  {svc.inclusions && (
                    <div className="bg-[#f8f6f2] border border-stone-200/80 rounded-lg px-2.5 py-2 mb-3">
                      <p className="text-xs text-stone-600 leading-relaxed line-clamp-2">
                        <strong className="font-medium text-stone-800">Includes:</strong> {svc.inclusions}
                      </p>
                    </div>
                  )}

                  <div className="mt-auto pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-pink-700 font-medium text-sm sm:text-base block truncate tabular-nums">
                        {svc.price}
                      </span>
                      {svc.priceNote && (
                        <span className="text-xs text-stone-500 line-clamp-1">{svc.priceNote}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedService(svc)}
                        className="text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-200 hover:border-stone-300 px-2.5 min-h-9 rounded-lg transition-colors"
                      >
                        Details
                      </button>
                      <Link
                        to={`/chat?service=${encodeURIComponent(svc.key)}`}
                        className="btn-press bg-pink-600 hover:bg-pink-700 text-white text-xs font-medium px-3 min-h-9 inline-flex items-center rounded-lg"
                      >
                        Book
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio Lookbook Strip + Lightbox */}
      <section id="gallery" className="bg-white py-10 sm:py-12 border-t border-stone-200/80 overflow-hidden scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-pink-700 text-xs font-medium mb-1">
              Studio lookbook
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-medium text-stone-900 tracking-[-0.02em]">
              Recent Hair &amp; Makeup Looks
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 bg-[#f8f6f2] border border-stone-200 px-3 py-1 rounded-md tabular-nums">
            <Images size={13} strokeWidth={1.75} className="text-stone-500" />
            {gallery.length} looks
          </span>
        </div>

        <style>{`
          @keyframes marquee {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .marquee-track {
            display: flex;
            width: max-content;
            animation: marquee 32s linear infinite;
          }
          .marquee-wrapper:hover .marquee-track {
            animation-play-state: paused;
          }
          .gallery-inner {
            transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
                        box-shadow 0.2s cubic-bezier(0.22, 1, 0.36, 1);
            border-radius: 16px;
            overflow: hidden;
          }
          .gallery-tile:hover .gallery-inner {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(17, 24, 39, 0.08);
          }
        `}</style>
        <div className="marquee-wrapper">
          <div className="marquee-track">
            {[...gallery, ...gallery].map((img, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setLightboxIndex(i % gallery.length)}
                className="gallery-tile relative h-40 w-52 sm:h-48 sm:w-64 flex-shrink-0 mx-2 cursor-pointer text-left"
              >
                <div className="gallery-inner w-full h-full border border-stone-200/80">
                  <img
                    src={img}
                    alt={`${biz?.name ?? 'Salon'} portfolio ${(i % gallery.length) + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'https://placehold.co/300x200/1f2937/db2777?text=Photo'
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-14 sm:py-20 px-4 sm:px-6 bg-[#f8f6f2] border-t border-stone-200/80 scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <p className="text-pink-700 text-xs sm:text-sm font-medium mb-1">
              Booking process
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-medium text-stone-900 tracking-[-0.02em]">How It Works</h2>
            <p className="text-stone-500 text-xs sm:text-sm mt-1.5">
              Three steps to reserve a studio or on-location session
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {BOOKING_FLOW_STEPS.map((step, i) => (
              <div
                key={step.title}
                className="bg-white rounded-xl border border-stone-200/80 p-6 sm:p-7 text-center hover-lift"
              >
                <div className="w-12 h-12 bg-stone-100 rounded-lg flex items-center justify-center mx-auto mb-4 border border-stone-200">
                  <step.icon size={18} strokeWidth={1.75} className="text-stone-700" />
                </div>
                <div className="text-xs font-mono font-medium text-pink-700 mb-1.5 tabular-nums">
                  Step 0{i + 1}
                </div>
                <h3 className="font-medium text-stone-900 text-base mb-2">{step.title}</h3>
                <p className="text-xs sm:text-sm text-stone-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Artist */}
      <section id="about" className="py-14 sm:py-20 px-4 sm:px-6 bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div className="relative">
            <div className="rounded-xl overflow-hidden h-72 sm:h-84 border border-stone-200 bg-stone-100">
              <img
                src={artistImg}
                alt={`${biz?.artist ?? 'Artist'} Hair and Makeup Artist`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = `https://placehold.co/600x400/f5f5f4/db2777?text=${encodeURIComponent(biz?.artist ?? 'Artist')}`
                }}
              />
            </div>
            <div className="absolute -bottom-3 right-3 sm:-bottom-4 sm:-right-4 bg-pink-600 text-white rounded-lg px-4 py-2.5 sm:px-5 sm:py-3 shadow-md border border-pink-700">
              <div className="text-base sm:text-xl font-medium tabular-nums">{biz?.experienceYears || '5+ yrs'}</div>
              <div className="text-xs text-pink-100">Experience</div>
            </div>
          </div>

          <div>
            <p className="text-pink-700 text-xs sm:text-sm font-medium mb-1.5">
              Lead artist
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-medium text-stone-900 tracking-[-0.02em] mb-3.5">
              About {biz?.artist ?? 'Our Lead Artist'}
            </h2>
            <p className="text-stone-600 text-sm leading-relaxed mb-3.5">
              {biz?.aboutBio ||
                `${biz?.artist ?? 'Our lead artist'} is a professional hair and makeup artist based in ${biz?.location ?? 'Olongapo City'}, specializing in bridal, debut, and event glam with personalized care.`}
            </p>
            <p className="text-stone-500 text-sm leading-relaxed mb-5">
              Available for on-location bookings and studio appointments across {biz?.location ?? 'Olongapo'} and surrounding areas. Reserve anytime via JAL.
            </p>
            <div className="flex flex-wrap gap-2">
              {(biz?.specialtyTags?.length
                ? biz.specialtyTags
                : ['Bridal', 'Debut', 'Events', 'Home Service', 'Hair Styling']
              ).map((tag) => (
                <span
                  key={tag}
                  className="bg-[#f8f6f2] text-stone-700 text-xs font-medium px-3 py-1 rounded-md border border-stone-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Studio Policies, Travel Coverage & Dynamic FAQ */}
      <section
        id="contact"
        className="py-14 sm:py-18 px-4 sm:px-6 bg-[#f8f6f2] border-t border-stone-200/80 scroll-mt-16"
      >
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-pink-700 text-xs font-medium">
              Studio info &amp; policies
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-medium text-stone-900 tracking-[-0.02em] mt-1">
              Location, Travel &amp; Booking Guide
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1.5">
              Live rates, travel areas, deposit rules, and direct contact details synced from the studio profile.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {/* Travel & Service Areas */}
            <div className="bg-white rounded-xl border border-stone-200/80 p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-stone-100 rounded-lg flex items-center justify-center shrink-0">
                  <MapPin size={16} strokeWidth={1.75} className="text-stone-700" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-stone-900">Service Area &amp; Travel</h3>
                  <p className="text-xs text-stone-500 truncate">{biz?.location ?? 'Olongapo City'}</p>
                </div>
              </div>
              {freeAreas.length > 0 && (
                <div className="text-xs text-stone-600">
                  <span className="font-medium text-emerald-700">Free travel: </span>
                  {freeAreas.join(', ')}
                </div>
              )}
              {travelAreas.length > 0 && (
                <div className="text-xs text-stone-600">
                  <span className="font-medium text-stone-800">Out-of-town: </span>
                  {travelAreas.join(', ')}
                </div>
              )}
              {biz?.travelFeeNote && (
                <p className="text-xs text-stone-600 leading-relaxed bg-[#f8f6f2] rounded-lg p-3 border border-stone-200/80">
                  {biz.travelFeeNote}
                </p>
              )}
            </div>

            {/* Policies, Advance Notice & Deposits */}
            <div className="bg-white rounded-xl border border-stone-200/80 p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-stone-100 rounded-lg flex items-center justify-center shrink-0">
                  <ShieldCheck size={16} strokeWidth={1.75} className="text-stone-700" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-stone-900">Policies &amp; Payments</h3>
                  <p className="text-xs text-stone-500 tabular-nums">
                    Book at least {minAdvanceDays} day{minAdvanceDays === 1 ? '' : 's'} ahead
                  </p>
                </div>
              </div>

              {paymentBadges.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {paymentBadges.map((method) => (
                    <span
                      key={method}
                      className="inline-flex items-center gap-1 text-xs font-medium bg-[#f8f6f2] text-stone-700 border border-stone-200 px-2.5 py-0.5 rounded-md"
                    >
                      <CreditCard size={12} strokeWidth={1.75} />
                      {method}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-1 text-xs text-stone-600 tabular-nums">
                {biz?.rules?.weddingDownpaymentPercent != null && (
                  <p>
                    <strong className="font-medium text-stone-800">Weddings:</strong> {biz.rules.weddingDownpaymentPercent}% down payment
                    {biz.rules.weddingCancelCutoffDays ? ` (${biz.rules.weddingCancelCutoffDays}-day cutoff)` : ''}
                  </p>
                )}
                {biz?.rules?.eventDownpaymentPercent && (
                  <p>
                    <strong className="font-medium text-stone-800">Events:</strong> {biz.rules.eventDownpaymentPercent} reservation fee
                    {biz.rules.eventCancelCutoffDays ? ` (${biz.rules.eventCancelCutoffDays}-day cutoff)` : ''}
                  </p>
                )}
                {biz?.additionalHeadPrice != null && (
                  <p>
                    <strong className="font-medium text-stone-800">Additional heads:</strong> From PHP{' '}
                    {Number(biz.additionalHeadPrice).toLocaleString('en-PH')} per person
                  </p>
                )}
              </div>

              {biz?.rules?.sameDayRushNote && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed">
                  {biz.rules.sameDayRushNote}
                </p>
              )}
            </div>

            {/* Hours & Direct Contact */}
            <div className="bg-white rounded-xl border border-stone-200/80 p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-stone-100 rounded-lg flex items-center justify-center shrink-0">
                  <Clock size={16} strokeWidth={1.75} className="text-stone-700" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-stone-900">Hours &amp; Contact</h3>
                  <p className="text-xs text-stone-500 tabular-nums">
                    {biz ? `${studioHoursText} (${biz.hours.days})` : 'Daily'}
                  </p>
                </div>
              </div>

              {biz?.contact && (
                <div className="text-xs text-stone-600 flex items-center gap-1.5">
                  <Phone size={13} strokeWidth={1.75} className="text-stone-500 shrink-0" />
                  {telHref ? (
                    <a href={telHref} className="font-mono font-medium text-pink-700 hover:underline tabular-nums">
                      {biz.contact}
                    </a>
                  ) : (
                    <span className="tabular-nums">{biz.contact}</span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {messengerLink && (
                  <a
                    href={messengerLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-700 text-white px-3.5 min-h-9 rounded-lg transition-colors"
                  >
                    <MessageCircle size={13} strokeWidth={1.75} />
                    Message on Facebook Page
                    <ExternalLink size={12} />
                  </a>
                )}
                {portfolioLink && (
                  <a
                    href={portfolioLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-900 border border-stone-200 px-3.5 min-h-9 rounded-lg transition-colors"
                  >
                    View Portfolio
                    <ExternalLink size={12} />
                  </a>
                )}
                {!messengerLink && !portfolioLink && (
                  <Link
                    to="/chat"
                    className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-700 text-white px-3.5 min-h-9 rounded-lg transition-colors"
                  >
                    <MessageCircle size={13} strokeWidth={1.75} />
                    Chat with JAL
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Expandable Booking Guide FAQ Accordion */}
          {dynamicFaqs.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-stone-200/80 bg-[#fdfcfa] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <HelpCircle size={16} strokeWidth={1.75} className="text-stone-500 shrink-0" />
                  <h3 className="text-sm sm:text-base font-medium text-stone-900">
                    Booking Quick Answers
                  </h3>
                </div>
                <Link
                  to="/chat"
                  className="text-xs font-medium text-pink-700 hover:text-pink-800 whitespace-nowrap"
                >
                  Ask JAL directly
                </Link>
              </div>
              <div className="divide-y divide-stone-100">
                {dynamicFaqs.map((item) => {
                  const isOpen = openFaqId === item.id
                  return (
                    <div key={item.id}>
                      <button
                        type="button"
                        onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                        className="w-full px-4 sm:px-6 py-3.5 text-left flex items-center justify-between gap-3 hover:bg-stone-50 transition-colors"
                      >
                        <span className="text-xs sm:text-sm font-medium text-stone-900">
                          {item.question}
                        </span>
                        <ChevronDown
                          size={16}
                          className={`text-stone-400 shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 sm:px-6 pb-4 text-xs sm:text-sm text-stone-600 leading-relaxed space-y-2">
                          <p>{item.answer}</p>
                          <Link
                            to="/chat"
                            className="inline-flex items-center gap-1 text-xs font-medium text-pink-700 hover:underline"
                          >
                            Verify availability with JAL
                            <ArrowRight size={12} />
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Closing Dark Studio CTA Banner */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-stone-950">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-pink-300 text-xs sm:text-sm font-medium mb-2">
              Studio reservations
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-medium text-white mb-3.5 leading-tight tracking-[-0.02em]">
              Reserve Your Session
              <br />
              with {biz?.artist ?? 'Our Studio'}
            </h2>
            <p className="text-white/70 text-xs sm:text-sm mb-7 leading-relaxed max-w-md">
              Check open dates, travel estimates, and package inclusions with JAL.
            </p>
            <Link
              to="/chat"
              className="btn-press inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium px-6 sm:px-8 min-h-12 rounded-lg"
            >
              Open Studio Chat
              <ArrowRight size={16} strokeWidth={1.75} />
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="grid grid-cols-2 gap-3">
              {gallery.slice(0, 4).map((img, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className={`rounded-xl overflow-hidden text-left border border-white/10 ${
                    i === 0 ? 'row-span-2 h-64' : 'h-[7.5rem]'
                  }`}
                >
                  <img
                    src={img}
                    alt="Portfolio showcase"
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity duration-200"
                    onError={(e) => {
                      e.target.src = 'https://placehold.co/300x300/1f2937/db2777?text=Photo'
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {/* Mobile Sticky Bottom CTA Bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-[#fdfcfa]/95 backdrop-blur-md border-t border-stone-200 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 shadow-md">
        <div className="min-w-0">
          <div className="text-xs font-medium text-stone-900 truncate">Ready to reserve</div>
          <div className="text-xs text-stone-500 truncate">Check open dates with JAL</div>
        </div>
        <Link
          to="/chat"
          className="inline-flex items-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-medium px-3.5 min-h-10 rounded-lg shrink-0 whitespace-nowrap"
        >
          Open Chat
          <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      </div>

      {/* Service Detail Quick-View Modal (Mobile Bottom Sheet + Desktop Dialog) */}
      {selectedService && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedService(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full max-h-[90dvh] flex flex-col overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-48 sm:h-56 bg-stone-100 shrink-0">
              <img
                src={selectedService.img}
                alt={selectedService.name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setSelectedService(null)}
                aria-label="Close service details"
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-medium text-stone-900">{selectedService.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-1 tabular-nums">
                    <Clock size={12} strokeWidth={1.75} className="text-stone-400" />
                    <span>{selectedService.duration}</span>
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-medium bg-pink-50 text-pink-700 border border-pink-100 px-2.5 py-1 rounded-md shrink-0 tabular-nums">
                  {selectedService.price}
                </span>
              </div>

              {selectedService.desc && (
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">{selectedService.desc}</p>
              )}

              {selectedService.inclusions && (
                <div className="bg-[#f8f6f2] border border-stone-200/80 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-stone-800">
                    <Info size={12} strokeWidth={1.75} />
                    Package inclusions
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{selectedService.inclusions}</p>
                </div>
              )}

              {selectedService.priceNote && (
                <p className="text-xs text-stone-500">{selectedService.priceNote}</p>
              )}
            </div>

            <div className="px-4 py-3 sm:px-5 sm:py-4 border-t border-stone-200/80 bg-[#fdfcfa] flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedService(null)}
                className="px-4 min-h-11 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Close
              </button>
              <Link
                to={`/chat?service=${encodeURIComponent(selectedService.key)}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-medium min-h-11 px-4 rounded-lg transition-colors"
              >
                Book This Service
                <ArrowRight size={14} strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Lightbox Modal */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close photo preview"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
          >
            <X size={20} />
          </button>

          {gallery.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setLightboxIndex((i) => (i - 1 + gallery.length) % gallery.length)
              }}
              aria-label="Previous photo"
              className="absolute left-3 sm:left-6 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          <div
            className="max-w-3xl max-h-[82vh] w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={gallery[lightboxIndex]}
              alt={`Portfolio look ${lightboxIndex + 1}`}
              className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <div className="text-xs text-white/75">
              Photo {lightboxIndex + 1} of {gallery.length}
            </div>
          </div>

          {gallery.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setLightboxIndex((i) => (i + 1) % gallery.length)
              }}
              aria-label="Next photo"
              className="absolute right-3 sm:right-6 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
            >
              <ChevronRight size={22} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

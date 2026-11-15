import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  MessageCircle,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  CreditCard,
  ExternalLink,
  X,
  Info,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
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

function landingServices(catalog) {
  const all = catalog?.services ?? []
  const flagged = all.filter((s) => s.showOnLanding)
  return (flagged.length ? flagged : all.slice(0, 4)).map((s) => ({
    key: s.key,
    name: s.name,
    desc: s.description,
    inclusions: s.inclusions,
    priceNote: s.priceNote,
    duration: formatDuration(s.durationMinutes),
    price: formatServicePrice(s),
    img: s.imageUrl || SHOWCASE_SERVICE_IMAGES[s.key] || DEFAULT_ARTIST_PHOTO_URL,
  }))
}

const steps = [
  { icon: MessageCircle, title: 'Chat to Book', desc: 'Message JAL with your preferred service, date, and event.' },
  { icon: CheckCircle, title: 'Get Confirmed', desc: 'Your slot is checked and confirmed instantly.' },
  { icon: Bell, title: 'Get Reminded', desc: 'Automated reminders sent before your appointment.' },
]

export default function LandingPage() {
  const { catalog } = useBusinessInfo()
  const services = landingServices(catalog)
  const biz = catalog?.business
  const heroImg = biz?.heroPhotoUrl || DEFAULT_HERO_PHOTO_URL
  const artistImg = biz?.artistPhotoUrl || DEFAULT_ARTIST_PHOTO_URL
  const gallery = biz?.galleryUrls?.length ? biz.galleryUrls : SHOWCASE_GALLERY_URLS

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

  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-gray-950">
        <img
          src={heroImg}
          alt={biz?.name ?? 'Hair and Makeup Studio'}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-55"
          onError={(e) => {
            e.target.style.display = 'none'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/95 via-gray-950/65 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/85 via-transparent to-transparent" />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 pt-24 pb-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 shimmer-badge text-pink-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-pink-500/20 animate-fade-up">
              <Sparkles size={11} className="animate-spin-slow" />
              Automated Appointment Booking
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-5">
              Look Good,
              <br />
              Feel <span className="text-pink-400">Beautiful</span>
            </h1>
            <p className="text-white/65 text-base mb-8 leading-relaxed max-w-md">
              Professional hair and makeup services in {biz?.location ?? 'Olongapo City'}. Reserve at least {minAdvanceDays} days ahead or chat with JAL anytime for availability, inclusions, and quotes.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Link
                to="/chat"
                className="btn-press inline-flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-400 text-white font-semibold px-7 py-3.5 rounded-xl shadow-lg shadow-pink-900/40"
              >
                Book Appointment <ArrowRight size={16} />
              </Link>
              <a
                href="#services"
                className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-white/80 hover:text-white font-medium px-7 py-3.5 rounded-xl transition-all"
              >
                Explore Services
              </a>
            </div>
          </div>

          {/* Floating chat preview card */}
          <div className="hidden md:flex justify-end">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-3xl p-6 w-80 shadow-2xl animate-float animate-pulse-glow">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-pink-500 rounded-xl flex items-center justify-center animate-pulse-glow">
                  <Sparkles size={16} className="text-white animate-spin-slow" />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">JAL</div>
                  <div className="text-green-400 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                    Online 24/7
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-white/90 text-sm">
                  Hi! I am JAL for {biz?.name ?? "Vicky's Parlor"}. Which hair or makeup service can I help you book?
                </div>
                <div className="bg-pink-500 rounded-2xl rounded-tr-sm px-4 py-3 text-white text-sm ml-8">
                  How much is {services[0]?.name ?? 'Bridal Makeup'}?
                </div>
                <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-white/90 text-sm">
                  {services[0]?.name ?? 'Bridal Makeup'} is {services[0]?.price ?? 'PHP 3,500'} ({services[0]?.duration ?? '3 hrs'}). Want me to check open slots?
                </div>
              </div>
              <Link
                to="/chat"
                className="mt-5 w-full bg-pink-500 hover:bg-pink-400 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                Start Chatting <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        <a
          href="#services"
          aria-label="Scroll to services"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 hover:text-white/70 transition-colors z-10"
        >
          <ChevronDown size={24} className="animate-bounce" />
        </a>
      </section>

      {/* Services */}
      <section id="services" className="py-20 px-6 bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-10 gap-4">
            <div>
              <p className="text-pink-500 text-sm font-semibold mb-1">What We Offer</p>
              <h2 className="text-3xl font-bold text-gray-900">Our Services</h2>
              <p className="text-gray-400 text-sm mt-1">
                Updated live from {biz?.name ?? 'our studio'}. Click any card to view full inclusions.
              </p>
            </div>
            <Link
              to="/chat"
              className="text-pink-500 hover:text-pink-600 text-sm font-medium hidden sm:flex items-center gap-1 group shrink-0"
            >
              Book via chat <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {services.map((svc) => (
              <div
                key={svc.key || svc.name}
                className="group rounded-2xl overflow-hidden border border-pink-100/80 bg-white flex flex-col hover-lift-pink animate-scale-in"
              >
                <button
                  type="button"
                  onClick={() => setSelectedService(svc)}
                  className="relative h-48 overflow-hidden bg-pink-50 text-left w-full"
                >
                  <img
                    src={svc.img}
                    alt={svc.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.target.src = `https://placehold.co/400x300/fce7f3/ec4899?text=${encodeURIComponent(svc.name)}`
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                  <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 text-[11px] font-medium bg-black/60 backdrop-blur-xs text-white px-2.5 py-0.5 rounded-full">
                    <Clock size={10} />
                    {svc.duration}
                  </span>
                </button>

                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-semibold text-gray-900 text-sm">{svc.name}</h3>
                  {svc.desc && <p className="text-gray-400 text-xs mt-0.5 mb-2 line-clamp-2">{svc.desc}</p>}
                  {svc.inclusions && (
                    <div className="bg-rose-50/60 border border-pink-100/70 rounded-lg px-2.5 py-1.5 mb-3">
                      <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
                        Includes: {svc.inclusions}
                      </p>
                    </div>
                  )}
                  <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-pink-600 font-bold text-sm block">{svc.price}</span>
                      {svc.priceNote && (
                        <span className="text-[11px] text-gray-400 line-clamp-1">{svc.priceNote}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedService(svc)}
                        className="text-xs font-medium text-gray-600 hover:text-pink-600 border border-gray-200 hover:border-pink-200 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        Details
                      </button>
                      <Link
                        to={`/chat?service=${encodeURIComponent(svc.key)}`}
                        className="bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors"
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

      {/* Gallery strip - infinite scroll + click to open Lightbox */}
      <section id="gallery" className="bg-white py-4 overflow-hidden">
        <style>{`
          @keyframes marquee {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .marquee-track {
            display: flex;
            width: max-content;
            animation: marquee 28s linear infinite;
          }
          .marquee-wrapper:hover .marquee-track {
            animation-play-state: paused;
          }
          .gallery-tile {
            perspective: 700px;
          }
          .gallery-inner {
            transition: transform 0.35s cubic-bezier(0.23, 1, 0.32, 1),
                        box-shadow 0.35s cubic-bezier(0.23, 1, 0.32, 1);
            transform-style: preserve-3d;
            border-radius: 12px;
            overflow: hidden;
          }
          .gallery-tile:hover .gallery-inner {
            transform: rotateY(-12deg) rotateX(6deg) scale(1.06) translateY(-6px);
            box-shadow: 0 24px 60px rgba(236, 72, 153, 0.45), 0 0 0 1px rgba(236, 72, 153, 0.3);
          }
          .gallery-glow {
            opacity: 0;
            transition: opacity 0.35s ease;
          }
          .gallery-tile:hover .gallery-glow {
            opacity: 1;
          }
        `}</style>
        <div className="marquee-wrapper">
          <div className="marquee-track">
            {[...gallery, ...gallery].map((img, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setLightboxIndex(i % gallery.length)}
                className="gallery-tile relative h-44 w-60 flex-shrink-0 mx-2 cursor-pointer text-left"
              >
                <div className="gallery-inner w-full h-full">
                  <img
                    src={img}
                    alt={`${biz?.name ?? 'Salon'} portfolio ${(i % gallery.length) + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'https://placehold.co/300x200/1f2937/ec4899?text=Photo'
                    }}
                  />
                  <div className="gallery-glow absolute inset-0 bg-gradient-to-t from-pink-500/50 via-pink-500/10 to-transparent" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-6 bg-rose-50/70 scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-pink-500 text-sm font-semibold mb-1">Simple Process</p>
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="text-gray-400 text-sm mt-2">3 steps to your confirmed appointment</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={step.title} className="bg-white rounded-2xl border border-pink-100/70 p-7 text-center shadow-xs hover-lift-pink animate-fade-up">
                <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto mb-5 icon-hover-spin">
                  <step.icon size={24} className="text-pink-500" />
                </div>
                <div className="text-xs font-bold text-pink-300 mb-2 tracking-widest">STEP 0{i + 1}</div>
                <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-20 px-6 bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="relative animate-float-subtle">
            <div className="rounded-3xl overflow-hidden h-80 border border-pink-100 shadow-sm">
              <img
                src={artistImg}
                alt={`${biz?.artist ?? 'Artist'} - Hair and Makeup Artist`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = `https://placehold.co/600x400/fce7f3/ec4899?text=${encodeURIComponent(biz?.artist ?? 'Artist')}`
                }}
              />
            </div>
            <div className="absolute -bottom-4 -right-4 bg-pink-500 text-white rounded-2xl px-5 py-3 shadow-lg hidden md:block">
              <div className="text-xl font-bold">{biz?.experienceYears || '5+ yrs'}</div>
              <div className="text-xs text-pink-100">Experience</div>
            </div>
          </div>
          <div>
            <p className="text-pink-500 text-sm font-semibold mb-2">Meet the Artist</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">About {biz?.artist ?? 'Our Artist'}</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-4">
              {biz?.aboutBio ||
                `${biz?.artist ?? 'Our lead artist'} is a professional freelance hair and makeup artist based in ${biz?.location ?? 'Olongapo City, Zambales'}, specializing in bridal, debut, and event looks with a personalized touch.`}
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Available for on-location bookings and studio sessions across {biz?.location ?? 'Olongapo'} and nearby areas. Book through JAL, our appointment chatbot, anytime, 24/7.
            </p>
            <div className="flex flex-wrap gap-2">
              {(biz?.specialtyTags?.length ? biz.specialtyTags : ['Bridal', 'Debut', 'Events', 'Home Service', 'Hair Styling']).map((tag) => (
                <span key={tag} className="bg-pink-50 text-pink-600 text-xs font-medium px-3 py-1.5 rounded-full border border-pink-100">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Policies, Travel Coverage & Direct Contact */}
      <section id="contact" className="py-16 px-6 bg-gradient-to-b from-rose-50/50 to-white border-t border-pink-100/70 scroll-mt-20">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center">
            <p className="text-pink-500 text-xs font-semibold uppercase tracking-wider">Studio Info & Policies</p>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">Location, Travel & Booking Guide</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Travel & Service Areas */}
            <div className="bg-white rounded-2xl border border-pink-100 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-pink-50 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin size={17} className="text-pink-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Service Area & Travel</h3>
                  <p className="text-xs text-gray-400">{biz?.location ?? 'Olongapo City'}</p>
                </div>
              </div>
              {freeAreas.length > 0 && (
                <div className="text-xs text-gray-600">
                  <span className="font-semibold text-green-700">Free travel: </span>
                  {freeAreas.join(', ')}
                </div>
              )}
              {travelAreas.length > 0 && (
                <div className="text-xs text-gray-600">
                  <span className="font-semibold text-gray-700">Out-of-town: </span>
                  {travelAreas.join(', ')}
                </div>
              )}
              {biz?.travelFeeNote && (
                <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                  {biz.travelFeeNote}
                </p>
              )}
            </div>

            {/* Payments, Advance Notice & Deposits */}
            <div className="bg-white rounded-2xl border border-pink-100 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-pink-50 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck size={17} className="text-pink-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Policies & Payments</h3>
                  <p className="text-xs text-gray-400">
                    Book at least {minAdvanceDays} day{minAdvanceDays === 1 ? '' : 's'} ahead
                  </p>
                </div>
              </div>

              {paymentBadges.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {paymentBadges.map((method) => (
                    <span
                      key={method}
                      className="inline-flex items-center gap-1 text-[11px] font-medium bg-pink-50 text-pink-700 border border-pink-100 px-2.5 py-0.5 rounded-full"
                    >
                      <CreditCard size={10} />
                      {method}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-1 text-xs text-gray-600">
                {biz?.rules?.weddingDownpaymentPercent != null && (
                  <p>
                    <strong className="text-gray-800">Weddings:</strong> {biz.rules.weddingDownpaymentPercent}% down payment
                    {biz.rules.weddingCancelCutoffDays ? ` (${biz.rules.weddingCancelCutoffDays}-day cutoff)` : ''}
                  </p>
                )}
                {biz?.rules?.eventDownpaymentPercent && (
                  <p>
                    <strong className="text-gray-800">Events:</strong> {biz.rules.eventDownpaymentPercent} reservation fee
                    {biz.rules.eventCancelCutoffDays ? ` (${biz.rules.eventCancelCutoffDays}-day cutoff)` : ''}
                  </p>
                )}
                {biz?.additionalHeadPrice != null && (
                  <p>
                    <strong className="text-gray-800">Additional heads:</strong> From PHP {Number(biz.additionalHeadPrice).toLocaleString('en-PH')} per person
                  </p>
                )}
              </div>

              {biz?.rules?.sameDayRushNote && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-2.5 leading-relaxed">
                  {biz.rules.sameDayRushNote}
                </p>
              )}
            </div>

            {/* Hours & Direct Contact */}
            <div className="bg-white rounded-2xl border border-pink-100 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-pink-50 rounded-xl flex items-center justify-center shrink-0">
                  <Clock size={17} className="text-pink-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Hours & Contact</h3>
                  <p className="text-xs text-gray-400">
                    {biz ? `${formatTime(biz.hours.open)} - ${formatTime(biz.hours.close)} (${biz.hours.days})` : 'Daily'}
                  </p>
                </div>
              </div>

              {biz?.contact && (
                <div className="text-xs text-gray-600 flex items-center gap-1.5">
                  <Phone size={13} className="text-pink-500 shrink-0" />
                  {telHref ? (
                    <a href={telHref} className="font-mono font-semibold text-pink-600 hover:underline">
                      {biz.contact}
                    </a>
                  ) : (
                    <span>{biz.contact}</span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {messengerLink && (
                  <a
                    href={messengerLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-pink-500 hover:bg-pink-600 text-white px-3.5 py-2 rounded-xl transition-colors"
                  >
                    <MessageCircle size={13} />
                    Message on Facebook Page
                    <ExternalLink size={11} />
                  </a>
                )}
                {portfolioLink && (
                  <a
                    href={portfolioLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-pink-50 text-gray-700 hover:text-pink-600 border border-gray-200 hover:border-pink-200 px-3.5 py-2 rounded-xl transition-colors"
                  >
                    View Portfolio
                    <ExternalLink size={11} />
                  </a>
                )}
                {!messengerLink && !portfolioLink && (
                  <Link
                    to="/chat"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-pink-500 hover:bg-pink-600 text-white px-3.5 py-2 rounded-xl transition-colors"
                  >
                    <MessageCircle size={13} />
                    Chat with JAL 24/7
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-950">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-pink-400 text-sm font-semibold mb-2">Ready to Glow?</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Book Your Appointment
              <br />
              with {biz?.artist ?? 'Us'} Today
            </h2>
            <p className="text-white/50 text-sm mb-8 leading-relaxed">
              Chat with JAL, our appointment chatbot, and get your appointment confirmed in minutes. Available anytime, no waiting needed.
            </p>
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 bg-pink-500 hover:bg-pink-400 text-white font-semibold px-8 py-4 rounded-xl transition-all hover:shadow-lg hover:shadow-pink-900/40 hover:-translate-y-0.5"
            >
              Start Chatting with JAL <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="grid grid-cols-2 gap-3">
              {gallery.slice(0, 4).map((img, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className={`rounded-2xl overflow-hidden text-left ${i === 0 ? 'row-span-2 h-64' : 'h-[7.5rem]'}`}
                >
                  <img
                    src={img}
                    alt="Portfolio showcase"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.target.src = 'https://placehold.co/300x300/1f2937/ec4899?text=Photo'
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {/* Mobile Sticky CTA Bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-pink-100 px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
        <div className="min-w-0">
          <div className="text-xs font-bold text-gray-900 truncate">Ready to book?</div>
          <div className="text-[11px] text-gray-400 truncate">Check open slots with JAL</div>
        </div>
        <Link
          to="/chat"
          className="inline-flex items-center gap-1.5 bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold px-4 py-2 rounded-xl shrink-0 shadow-xs"
        >
          Chat with JAL
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* Service Detail Quick-View Modal */}
      {selectedService && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedService(null)}
        >
          <div
            className="bg-white rounded-3xl border border-pink-100 shadow-2xl max-w-md w-full overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-56 bg-pink-50">
              <img
                src={selectedService.img}
                alt={selectedService.name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setSelectedService(null)}
                aria-label="Close service details"
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedService.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <Clock size={12} className="text-pink-500" />
                    <span>{selectedService.duration}</span>
                  </div>
                </div>
                <span className="text-sm font-bold bg-pink-50 text-pink-600 border border-pink-100 px-3 py-1 rounded-full shrink-0">
                  {selectedService.price}
                </span>
              </div>

              {selectedService.desc && (
                <p className="text-xs text-gray-600 leading-relaxed">{selectedService.desc}</p>
              )}

              {selectedService.inclusions && (
                <div className="bg-rose-50/60 border border-pink-100 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-pink-600">
                    <Info size={12} />
                    Package Inclusions
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">{selectedService.inclusions}</p>
                </div>
              )}

              {selectedService.priceNote && (
                <p className="text-[11px] text-gray-500">{selectedService.priceNote}</p>
              )}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedService(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Close
                </button>
                <Link
                  to={`/chat?service=${encodeURIComponent(selectedService.key)}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors"
                >
                  Book This Service
                  <ArrowRight size={14} />
                </Link>
              </div>
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

          <div className="max-w-3xl max-h-[82vh] w-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
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

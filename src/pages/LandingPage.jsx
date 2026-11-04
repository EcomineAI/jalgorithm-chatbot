import { Link } from 'react-router-dom'
import { Bell, MessageCircle, CheckCircle, ChevronDown, Star, ArrowRight, Sparkles, Phone, MapPin, Clock } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'

const HERO_IMG = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=90&fit=crop'

const services = [
  {
    name: 'Bridal Makeup',
    desc: 'Full glam for your wedding day',
    price: 'PHP 3,500',
    img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80&fit=crop',
  },
  {
    name: 'Hair Styling',
    desc: 'Updos and event-ready styles',
    price: 'PHP 500',
    img: 'https://images.unsplash.com/photo-1620331311520-246422fd82f9?w=600&q=80&fit=crop',
  },
  {
    name: 'Personal Makeup',
    desc: 'Debuts, parties, and shoots',
    price: 'PHP 800',
    img: 'https://images.unsplash.com/photo-1512207736890-6ffed8a84e8d?w=600&q=80&fit=crop',
  },
  {
    name: 'Event Package',
    desc: 'Hair + makeup for entourages',
    price: 'PHP 2,500',
    img: 'https://images.unsplash.com/photo-1457972729786-0411a3b2b626?w=600&q=80&fit=crop',
  },
]

const steps = [
  { icon: MessageCircle, title: 'Chat to Book', desc: 'Message JAL with your preferred service, date, and event.' },
  { icon: CheckCircle, title: 'Get Confirmed', desc: 'Your slot is checked and confirmed instantly.' },
  { icon: Bell, title: 'Get Reminded', desc: 'Automated reminders sent before your appointment.' },
]

const gallery = [
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80&fit=crop',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80&fit=crop',
  'https://images.unsplash.com/photo-1512207736890-6ffed8a84e8d?w=600&q=80&fit=crop',
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80&fit=crop',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80&fit=crop',
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80&fit=crop',
  'https://images.unsplash.com/photo-1512207736890-6ffed8a84e8d?w=600&q=80&fit=crop',
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80&fit=crop',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-gray-950">
        <img
          src={HERO_IMG}
          alt="Vicky's Parlor"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-50"
          onError={(e) => { e.target.style.display = 'none' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/95 via-gray-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-transparent to-transparent" />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 pt-20 pb-24 grid md:grid-cols-2 gap-12 items-center">
          {/* Left text */}
          <div>
            <div className="inline-flex items-center gap-1.5 bg-pink-500/20 text-pink-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-pink-500/20">
              <Sparkles size={11} />
              AI-Powered Appointment Booking
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-5">
              Look Good,<br />
              Feel <span className="text-pink-400">Beautiful</span>
            </h1>
            <p className="text-white/50 text-base mb-8 leading-relaxed max-w-sm">
              Professional hair and makeup services in Olongapo City. Book your appointment instantly through JAL, our AI assistant.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Link
                to="/chat"
                className="inline-flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-400 text-white font-semibold px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-pink-900/40 hover:shadow-pink-500/30 hover:-translate-y-0.5"
              >
                Book Appointment <ArrowRight size={16} />
              </Link>
              <a
                href="#services"
                className="inline-flex items-center justify-center gap-2 border border-white/15 hover:border-white/30 text-white/70 hover:text-white font-medium px-7 py-3.5 rounded-xl transition-all"
              >
                Explore Services
              </a>
            </div>

          </div>

          {/* Right — floating chat preview card */}
          <div className="hidden md:flex justify-end">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl p-6 w-80 shadow-2xl">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-pink-500 rounded-xl flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">JAL</div>
                  <div className="text-green-400 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                    Online
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-white/90 text-sm">
                  Hi! I'm JAL. I can help you book an appointment with Vicky's Parlor. What service are you looking for?
                </div>
                <div className="bg-pink-500 rounded-2xl rounded-tr-sm px-4 py-3 text-white text-sm ml-8">
                  I want to book bridal makeup for Dec 15
                </div>
                <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-white/90 text-sm">
                  Great! Can I get your name, event location, and contact number?
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

        <a href="#services" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 hover:text-white/60 transition-colors z-10">
          <ChevronDown size={24} className="animate-bounce" />
        </a>
      </section>

      {/* ── Services ── */}
      <section id="services" className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-pink-500 text-sm font-semibold mb-1">What We Offer</p>
              <h2 className="text-3xl font-bold text-gray-900">Our Services</h2>
              <p className="text-gray-400 text-sm mt-1">Find the perfect service for you</p>
            </div>
            <Link to="/chat" className="text-pink-500 hover:text-pink-600 text-sm font-medium hidden sm:flex items-center gap-1 group">
              Book now <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {services.map((svc) => (
              <div key={svc.name} className="group rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl hover:shadow-pink-50 hover:-translate-y-1 transition-all duration-300">
                <div className="relative h-48 overflow-hidden bg-gray-100">
                  <img
                    src={svc.img}
                    alt={svc.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => { e.target.src = 'https://placehold.co/400x300/fce7f3/ec4899?text=' + svc.name }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm">{svc.name}</h3>
                  <p className="text-gray-400 text-xs mt-0.5 mb-3">{svc.desc}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-pink-500 font-bold text-sm">{svc.price}</span>
                    <Link
                      to="/chat"
                      className="bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
                    >
                      Book
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gallery strip ── */}
      <section className="bg-gray-950">
        <div className="grid grid-cols-4 md:grid-cols-8">
          {gallery.map((img, i) => (
            <div key={i} className="relative h-36 overflow-hidden group">
              <img
                src={img}
                alt="Gallery"
                className="w-full h-full object-cover opacity-60 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
                onError={(e) => { e.target.src = 'https://placehold.co/300x200/1f2937/ec4899?text=Photo' }}
              />
              <div className="absolute inset-0 border border-white/5" />
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-20 px-6 bg-pink-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-pink-500 text-sm font-semibold mb-1">Simple Process</p>
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="text-gray-400 text-sm mt-2">3 steps to your confirmed appointment</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={step.title} className="bg-white rounded-2xl p-7 text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
                <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
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

      {/* ── Info strip ── */}
      <section className="py-10 px-6 bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[
            { icon: MapPin, label: 'Location', value: 'Olongapo City, Zambales' },
            { icon: Clock, label: 'Working Hours', value: '8:00 AM - 7:00 PM daily' },
            { icon: Phone, label: 'Book via Chat', value: 'Available 24/7 through JAL' },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center">
                <item.icon size={18} className="text-pink-500" />
              </div>
              <div className="text-xs text-gray-400 font-medium">{item.label}</div>
              <div className="text-sm text-gray-700 font-semibold">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6 bg-gray-950">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-pink-400 text-sm font-semibold mb-2">Ready to Glow?</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Book Your Appointment<br />with Vicky Today</h2>
            <p className="text-white/40 text-sm mb-8 leading-relaxed">
              Chat with JAL, our AI assistant, and get your appointment confirmed in minutes. Available anytime, no waiting needed.
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
                <div key={i} className={`rounded-2xl overflow-hidden ${i === 0 ? 'row-span-2 h-64' : 'h-[7.5rem]'}`}>
                  <img
                    src={img}
                    alt="Portfolio"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    onError={(e) => { e.target.src = 'https://placehold.co/300x300/1f2937/ec4899?text=Photo' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

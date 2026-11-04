import { Link } from 'react-router-dom'
import { Bell, MessageCircle, CheckCircle, ChevronDown, Star, ArrowRight } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'

const services = [
  {
    name: 'Bridal Makeup',
    desc: 'Full glam for your wedding day',
    price: 'PHP 3,500',
    img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80',
  },
  {
    name: 'Hair Styling',
    desc: 'Updos and event-ready styles',
    price: 'PHP 500',
    img: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400&q=80',
  },
  {
    name: 'Personal Makeup',
    desc: 'Debuts, parties, and shoots',
    price: 'PHP 800',
    img: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=400&q=80',
  },
  {
    name: 'Event Package',
    desc: 'Hair + makeup for entourages',
    price: 'PHP 2,500',
    img: 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=400&q=80',
  },
]

const steps = [
  { icon: MessageCircle, title: 'Chat to Book', desc: 'Message JAL with your preferred service, date, and event.' },
  { icon: CheckCircle, title: 'Get Confirmed', desc: 'Your slot is checked and confirmed instantly.' },
  { icon: Bell, title: 'Get Reminded', desc: 'Automated reminders sent before your appointment.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col">
      <Navbar />

      {/* Hero — dark with model photo */}
      <section className="relative min-h-[92vh] flex items-end overflow-hidden bg-gray-950">
        {/* Background image */}
        <img
          src="https://images.unsplash.com/photo-1500840216050-6ffa99d75160?w=1200&q=85"
          alt="Hair and makeup model"
          className="absolute inset-0 w-full h-full object-cover object-top opacity-60"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/50 to-transparent" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pb-16 md:pb-24">
          <div className="max-w-lg">
            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur text-white/80 text-xs font-medium px-3 py-1.5 rounded-full mb-6 border border-white/10">
              <Star size={11} fill="currentColor" className="text-pink-400" />
              AI-Powered Appointment Booking
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-4">
              Look Good,<br />
              Feel <span className="text-pink-400">Beautiful</span>
            </h1>
            <p className="text-white/60 text-base mb-8 leading-relaxed">
              Beauty and style, designed just for you. Book your hair and makeup appointment instantly through our AI assistant.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/chat"
                className="inline-flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-400 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors shadow-lg shadow-pink-900/30"
              >
                Book Appointment <ArrowRight size={16} />
              </Link>
              <a
                href="#services"
                className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-white/80 hover:text-white font-medium px-7 py-3.5 rounded-xl transition-colors backdrop-blur"
              >
                Explore Services
              </a>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <a href="#services" className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 hover:text-white/70 transition-colors z-10 flex flex-col items-center gap-1 text-xs">
          <ChevronDown size={20} className="animate-bounce" />
        </a>
      </section>

      {/* Services */}
      <section id="services" className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-pink-500 text-sm font-semibold mb-1">What We Offer</p>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Our Services</h2>
              <p className="text-gray-400 text-sm mt-1">Find the perfect service for you</p>
            </div>
            <Link to="/chat" className="text-pink-500 hover:text-pink-600 text-sm font-medium hidden sm:flex items-center gap-1">
              Book now <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {services.map((svc) => (
              <div key={svc.name} className="group rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg hover:shadow-pink-50 transition-all">
                <div className="relative h-44 overflow-hidden bg-gray-100">
                  <img
                    src={svc.img}
                    alt={svc.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm">{svc.name}</h3>
                  <p className="text-gray-400 text-xs mt-0.5 mb-3">{svc.desc}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-pink-500 font-bold text-sm">{svc.price}</span>
                    <Link
                      to="/chat"
                      className="bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
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

      {/* How it works */}
      <section id="how-it-works" className="py-16 px-6 bg-pink-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-pink-500 text-sm font-semibold mb-1">Simple Process</p>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="text-gray-400 text-sm mt-2">3 steps to your confirmed appointment</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={step.title} className="bg-white rounded-2xl p-6 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <step.icon size={22} className="text-pink-500" />
                </div>
                <div className="text-xs font-bold text-pink-300 mb-2">0{i + 1}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden bg-gray-950 min-h-[220px] flex items-center px-8 md:px-14 py-10">
            <img
              src="https://images.unsplash.com/photo-1457972729786-0411a3b2b626?w=1200&q=80"
              alt="Beauty"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-transparent" />
            <div className="relative z-10 max-w-md">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Ready to Book?</h2>
              <p className="text-white/50 text-sm mb-6">Chat with JAL, our AI assistant, and get your appointment confirmed in minutes.</p>
              <Link
                to="/chat"
                className="inline-flex items-center gap-2 bg-pink-500 hover:bg-pink-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                Start Chatting <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

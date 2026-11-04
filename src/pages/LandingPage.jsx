import { Link } from 'react-router-dom'
import { Calendar, Clock, Bell, MessageCircle, CheckCircle, Sparkles } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'

const services = [
  { name: 'Bridal Makeup', desc: 'Full glam for your wedding day, tailored to your style and venue.' },
  { name: 'Hair Styling', desc: 'Updos, blowouts, and event-ready styles for any occasion.' },
  { name: 'Personal Makeup', desc: 'Everyday and special occasion makeup for debuts, parties, and shoots.' },
  { name: 'Event Packages', desc: 'Bundled hair and makeup packages for entourages and events.' },
]

const steps = [
  { icon: MessageCircle, title: 'Chat to Book', desc: 'Send a message describing your service, date, and event. The chatbot will guide you.' },
  { icon: CheckCircle, title: 'Get Confirmed', desc: 'Your appointment is checked against the schedule and confirmed instantly.' },
  { icon: Bell, title: 'Receive Reminders', desc: 'Automated reminders are sent before your appointment so you never forget.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 bg-gradient-to-b from-pink-50 to-white">
        <div className="inline-flex items-center gap-2 bg-pink-100 text-pink-600 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <Sparkles size={14} />
          Smart Booking for Hair &amp; Makeup
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight mb-6 max-w-3xl">
          Book Your Beauty<br />
          <span className="text-pink-500">Appointment Instantly</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mb-10">
          Chat with our AI assistant to book, reschedule, or cancel appointments - anytime, without waiting for a reply.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            to="/chat"
            className="bg-pink-500 hover:bg-pink-600 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-sm shadow-pink-200"
          >
            Book an Appointment
          </Link>
          <a
            href="#how-it-works"
            className="border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold px-8 py-3.5 rounded-xl transition-colors"
          >
            How It Works
          </a>
        </div>

        {/* Stats strip */}
        <div className="mt-16 grid grid-cols-3 gap-8 max-w-md mx-auto">
          {[
            { value: '95%', label: 'Reminder delivery' },
            { value: '< 3s', label: 'Response time' },
            { value: '90%+', label: 'Booking completion' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold text-pink-500">{s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How It Works</h2>
            <p className="text-gray-500">Three simple steps to your confirmed appointment.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.title} className="flex flex-col items-center text-center p-6 rounded-2xl border border-gray-100 hover:border-pink-100 hover:shadow-sm transition-all">
                <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center mb-4">
                  <step.icon size={22} className="text-pink-500" />
                </div>
                <div className="text-xs font-semibold text-pink-400 mb-2">Step {i + 1}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20 px-6 bg-pink-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Services</h2>
            <p className="text-gray-500">Professional hair and makeup for every occasion.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {services.map((svc) => (
              <div key={svc.name} className="bg-white rounded-2xl p-6 border border-pink-100 hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-gray-900 mb-2">{svc.name}</h3>
                <p className="text-sm text-gray-500">{svc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-2xl mx-auto text-center bg-gradient-to-br from-pink-500 to-pink-400 rounded-3xl p-12 text-white shadow-lg shadow-pink-100">
          <h2 className="text-3xl font-bold mb-4">Ready to Book?</h2>
          <p className="text-pink-100 mb-8">
            Chat with JAL, our AI assistant, and get your appointment confirmed in minutes.
          </p>
          <Link
            to="/chat"
            className="inline-block bg-white text-pink-500 font-semibold px-8 py-3.5 rounded-xl hover:bg-pink-50 transition-colors shadow-sm"
          >
            Start Chatting
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}

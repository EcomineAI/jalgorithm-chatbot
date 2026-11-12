import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, Users, Bell, BarChart2, LogOut, Sparkles,
  CheckCircle, XCircle, Clock, AlertCircle, Store,
} from 'lucide-react'
import BusinessInfoTab from './owner/BusinessInfoTab.jsx'

const TABS = [
  { id: 'appointments', icon: Calendar, label: 'Appointments' },
  { id: 'logs', icon: BarChart2, label: 'Chat Logs' },
  { id: 'reminders', icon: Bell, label: 'Reminders' },
  { id: 'business', icon: Store, label: 'Business Info' },
]
import { supabase } from '../lib/supabase.js'

const STATUS_STYLES = {
  confirmed: { color: 'text-green-600 bg-green-50', icon: CheckCircle, label: 'Confirmed' },
  rescheduled: { color: 'text-blue-600 bg-blue-50', icon: Clock, label: 'Rescheduled' },
  cancelled: { color: 'text-gray-500 bg-gray-50', icon: XCircle, label: 'Cancelled' },
  no_show: { color: 'text-red-600 bg-red-50', icon: AlertCircle, label: 'No-show' },
}

export default function OwnerDashboard() {
  const [appointments, setAppointments] = useState([])
  const [stats, setStats] = useState({ total: 0, confirmed: 0, noShow: 0, completion: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('appointments')
  const [chatLogs, setChatLogs] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetchAppointments()
    fetchChatLogs()
  }, [])

  async function fetchAppointments() {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: true })
    if (data) {
      setAppointments(data)
      const total = data.length
      const confirmed = data.filter((a) => a.status === 'confirmed').length
      const noShow = data.filter((a) => a.status === 'no_show').length
      const completed = data.filter((a) => ['confirmed', 'rescheduled'].includes(a.status)).length
      setStats({
        total,
        confirmed,
        noShow,
        completion: total ? Math.round((completed / total) * 100) : 0,
      })
    }
    setLoading(false)
  }

  async function fetchChatLogs() {
    const { data } = await supabase
      .from('chat_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setChatLogs(data)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/owner/login')
  }

  async function updateStatus(id, status) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    fetchAppointments()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col py-6 px-4 hidden md:flex">
        <div className="flex items-center gap-2 font-bold text-gray-900 mb-8 px-2">
          <div className="w-7 h-7 bg-pink-500 rounded-lg flex items-center justify-center">
            <Sparkles size={13} className="text-white" />
          </div>
          JALgorithm
        </div>
        <nav className="flex-1 space-y-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-pink-50 text-pink-600'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900 capitalize">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Owner's panel</p>
          </div>
          <div className="md:hidden flex items-center gap-3">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              aria-label="Section"
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-pink-300"
            >
              {TABS.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500" aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="p-6">
          {/* Stats */}
          {activeTab === 'appointments' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total Bookings', value: stats.total, color: 'text-gray-900' },
                  { label: 'Confirmed', value: stats.confirmed, color: 'text-green-600' },
                  { label: 'No-shows', value: stats.noShow, color: 'text-red-500' },
                  { label: 'Completion Rate', value: `${stats.completion}%`, color: 'text-pink-500' },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Appointments table */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50">
                      {['Ref', 'Client', 'Service', 'Date', 'Status', 'Reminder', 'Action'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                          Loading appointments...
                        </td>
                      </tr>
                    ) : appointments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                          No appointments yet.
                        </td>
                      </tr>
                    ) : (
                      appointments.map((appt) => {
                        const s = STATUS_STYLES[appt.status] || STATUS_STYLES.confirmed
                        return (
                          <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{appt.reference_code || '-'}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{appt.client_name}</td>
                            <td className="px-4 py-3 text-gray-500">{appt.service_type}</td>
                            <td className="px-4 py-3 text-gray-500">
                              {new Date(appt.appointment_date).toLocaleString('en-PH', {
                                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
                                <s.icon size={11} />
                                {s.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {appt.reminder_sent ? (
                                <span className="text-green-500 text-xs font-medium">Sent</span>
                              ) : (
                                <span className="text-gray-300 text-xs">Pending</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={appt.status}
                                onChange={(e) => updateStatus(appt.id, e.target.value)}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-pink-300"
                              >
                                <option value="confirmed">Confirmed</option>
                                <option value="rescheduled">Rescheduled</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="no_show">No-show</option>
                              </select>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <h2 className="font-semibold text-sm text-gray-900">Chat Logs</h2>
                <span className="text-xs text-gray-400">{chatLogs.length} messages</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    {['Time', 'User Message', 'Intent', 'Bot Reply'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {chatLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                        No chat logs yet.
                      </td>
                    </tr>
                  ) : (
                    chatLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{log.user_message}</td>
                        <td className="px-4 py-3">
                          <span className="bg-pink-50 text-pink-600 text-xs px-2 py-0.5 rounded-full font-medium capitalize">
                            {log.intent_classified?.toLowerCase().replace(/_/g, ' ')}
                          </span>
                          {typeof log.confidence === 'number' && (
                            <span className="ml-1 text-xs text-gray-400">{Math.round(log.confidence * 100)}%</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{log.bot_reply}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'business' && <BusinessInfoTab />}

          {activeTab === 'reminders' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
              <Bell size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="font-medium text-gray-500">Reminder Logs</p>
              <p className="text-sm mt-1">Automated reminder tracking will appear here.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

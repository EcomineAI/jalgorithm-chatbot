import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  Bell,
  LogOut,
  Sparkles,
  Clock,
  AlertCircle,
  AlertTriangle,
  Store,
  MapPin,
  ExternalLink,
  CalendarPlus,
  Copy,
  Check,
  Search,
  Phone,
  MessageSquare,
  LayoutDashboard,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react'
import BusinessInfoTab from './owner/BusinessInfoTab.jsx'
import ChatLogsTab from './owner/ChatLogsTab.jsx'
import { DashboardHomeTab } from '../components/owner/DashboardHomeTab.jsx'
import { ManualBookingModal } from '../components/owner/ManualBookingModal.jsx'
import {
  ConfirmModal,
  PaginationBar,
  PrimaryButton,
  StatKpiCard,
  StatusBadge,
} from '../components/owner/OwnerPrimitives.jsx'
import { supabase } from '../lib/supabase.js'
import { createAppointmentService } from '../services/appointments.js'
import { useBusinessInfo, businessInfo } from '../lib/useBusinessInfo.js'
import { sanitizeImageUrl } from '../lib/mediaUpload.js'
import {
  DEFAULT_ARTIST_PHOTO_URL,
  SHOWCASE_SERVICE_IMAGES,
} from '../jalgorithm/config/business.js'
import {
  checkSetupWarnings,
  computeProfileCompletion,
  filterAndSortChatLogs,
  groupChatLogsBySession,
  filterAppointments,
  paginateItems,
} from '../lib/ownerInsights.js'
import {
  computeOwnerPrepSummary,
  buildClientReminderText,
  daysUntilManila,
  manilaTodayIso,
} from '../lib/calendarLinks.js'

const TABS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', shortLabel: 'Home' },
  { id: 'appointments', icon: Calendar, label: 'Appointments', shortLabel: 'Bookings' },
  { id: 'reminders', icon: Bell, label: 'Reminders', shortLabel: 'Reminders' },
  { id: 'logs', icon: MessageSquare, label: 'Chat Logs', shortLabel: 'Logs' },
  { id: 'business', icon: Store, label: 'Business Info', shortLabel: 'Salon' },
]

const APPT_FILTERS = [
  { id: 'all', label: 'All Bookings' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'soon', label: 'Today / Tomorrow' },
  { id: 'closed', label: 'Cancelled / Past' },
]

function formatTelHref(contact) {
  const cleaned = String(contact ?? '').replace(/[^\d+]/g, '')
  return cleaned ? `tel:${cleaned}` : null
}

async function copyTextValue(value) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    /* fallback below */
  }
  try {
    const el = document.createElement('textarea')
    el.value = value
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

export default function OwnerDashboard() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [chatLogs, setChatLogs] = useState([])
  const [copiedKey, setCopiedKey] = useState(null)
  const [setupWarnings, setSetupWarnings] = useState([])
  const [setupPercent, setSetupPercent] = useState(100)
  const [requestedBizTab, setRequestedBizTab] = useState(null)
  const [apptFilter, setApptFilter] = useState('all')
  const [apptQuery, setApptQuery] = useState('')
  const [apptPage, setApptPage] = useState(1)
  const [globalSearch, setGlobalSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [ownerEmail, setOwnerEmail] = useState('')

  const notifRef = useRef(null)
  const searchRef = useRef(null)
  const { catalog } = useBusinessInfo()
  const navigate = useNavigate()

  const appointmentActions = useMemo(() => createAppointmentService(supabase), [])
  const bizName = catalog?.business?.name ?? 'JALgorithm'
  const artistName = catalog?.business?.artist ?? bizName
  const artistAvatar =
    sanitizeImageUrl(catalog?.business?.artistPhoto) || DEFAULT_ARTIST_PHOTO_URL
  const freeTravelAreas = catalog?.business?.freeTravelAreas ?? ['Olongapo City', 'Subic Bay']

  useEffect(() => {
    fetchAppointments()
    fetchChatLogs()
    businessInfo.loadOwnerData().then((rows) => {
      if (!rows.error) {
        setSetupWarnings(checkSetupWarnings(rows))
        setSetupPercent(computeProfileCompletion(rows).percentage)
      }
    })
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setOwnerEmail(data.user.email)
    })
  }, [])

  useEffect(() => {
    function handleOutsideClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    setApptPage(1)
  }, [apptFilter, apptQuery])

  async function fetchAppointments() {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: true })
    if (data) {
      setAppointments(data)
    }
    setLoading(false)
  }

  async function fetchChatLogs() {
    const { data } = await supabase
      .from('chat_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) setChatLogs(data)
  }

  function jumpToBusinessTab(subTab = 'profile') {
    setRequestedBizTab(subTab)
    setActiveTab('business')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/owner/login')
  }

  async function updateStatus(id, status) {
    setStatusBusy(true)
    await supabase.from('appointments').update({ status }).eq('id', id)
    setStatusBusy(false)
    setPendingStatusChange(null)
    fetchAppointments()
  }

  function requestStatusChange(appt, nextStatus) {
    if (!nextStatus || nextStatus === appt.status) return
    if (nextStatus === 'cancelled' || nextStatus === 'no_show') {
      setPendingStatusChange({
        id: appt.id,
        clientName: appt.client_name,
        ref: appt.reference_code,
        nextStatus,
      })
      return
    }
    updateStatus(appt.id, nextStatus)
  }

  async function markReminderSent(id) {
    await supabase
      .from('appointments')
      .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
      .eq('id', id)
    fetchAppointments()
  }

  async function handleCopyReminder(id, text) {
    const ok = await copyTextValue(text)
    if (!ok) return
    setCopiedKey(id)
    setTimeout(() => setCopiedKey(null), 1800)
  }

  const upcomingSchedule = useMemo(
    () =>
      appointments
        .filter((a) => ['confirmed', 'rescheduled'].includes(a.status))
        .map((appt) => {
          const prep = computeOwnerPrepSummary(appt, { freeTravelAreas, businessName: bizName })
          const daysUntil = prep ? daysUntilManila(prep.date) : null
          return { appt, prep, daysUntil }
        })
        .filter((item) => item.prep && (item.daysUntil == null || item.daysUntil >= 0)),
    [appointments, freeTravelAreas, bizName],
  )

  const soonCount = useMemo(
    () => upcomingSchedule.filter((item) => item.daysUntil === 0 || item.daysUntil === 1).length,
    [upcomingSchedule],
  )

  const remindersDueCount = useMemo(
    () =>
      upcomingSchedule.filter(
        (item) => item.daysUntil != null && item.daysUntil <= 2 && !item.appt.reminder_sent,
      ).length,
    [upcomingSchedule],
  )

  const attentionChatCount = useMemo(() => {
    const cleanLogs = filterAndSortChatLogs(chatLogs, { hideTrash: true })
    return groupChatLogsBySession(cleanLogs).filter((s) => s.needsReview).length
  }, [chatLogs])

  const todayIso = manilaTodayIso()

  const filterCounts = useMemo(
    () => ({
      all: filterAppointments(appointments, { filter: 'all', query: apptQuery, todayIso }).length,
      upcoming: filterAppointments(appointments, { filter: 'upcoming', query: apptQuery, todayIso }).length,
      soon: filterAppointments(appointments, { filter: 'soon', query: apptQuery, todayIso }).length,
      closed: filterAppointments(appointments, { filter: 'closed', query: apptQuery, todayIso }).length,
    }),
    [appointments, apptQuery, todayIso],
  )

  const visibleAppointments = useMemo(
    () => filterAppointments(appointments, { filter: apptFilter, query: apptQuery, todayIso }),
    [appointments, apptFilter, apptQuery, todayIso],
  )

  const pagedAppointments = useMemo(
    () => paginateItems(visibleAppointments, apptPage, 10),
    [visibleAppointments, apptPage],
  )

  const apptStats = useMemo(() => {
    const total = appointments.length
    const confirmed = appointments.filter((a) => ['confirmed', 'rescheduled'].includes(a.status)).length
    const cancelledOrNoShow = appointments.filter((a) => ['cancelled', 'no_show'].includes(a.status)).length
    return { total, confirmed, soon: soonCount, cancelledOrNoShow }
  }, [appointments, soonCount])

  const serviceByKey = useMemo(() => {
    const map = {}
    for (const s of catalog?.services || []) {
      map[s.key] = s
    }
    return map
  }, [catalog])

  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase()
    if (q.length < 2) return null
    const matchedBookings = appointments
      .filter((a) =>
        `${a.reference_code || ''} ${a.client_name || ''} ${a.service_type || ''} ${a.client_contact || ''}`
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 4)
    const matchedServices = (catalog?.services || [])
      .filter((s) => `${s.name || ''} ${s.description || ''}`.toLowerCase().includes(q))
      .slice(0, 3)
    const matchedLogs = chatLogs
      .filter((l) => `${l.user_message || ''} ${l.bot_reply || ''}`.toLowerCase().includes(q))
      .slice(0, 3)
    return { matchedBookings, matchedServices, matchedLogs }
  }, [globalSearch, appointments, catalog, chatLogs])

  const totalNotifCount = remindersDueCount + attentionChatCount + setupWarnings.length

  function getTabBadge(tabId) {
    if (tabId === 'logs' && attentionChatCount > 0) {
      return { count: attentionChatCount, tone: 'bg-rose-100 text-rose-700' }
    }
    if (tabId === 'reminders' && remindersDueCount > 0) {
      return { count: remindersDueCount, tone: 'bg-pink-100 text-pink-700' }
    }
    if (tabId === 'business' && setupWarnings.length > 0) {
      return { count: setupWarnings.length, tone: 'bg-amber-100 text-amber-800' }
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50/50 via-gray-50 to-pink-50/30 flex">
      {/* Desktop Left Sidebar */}
      <aside className="w-64 xl:w-68 bg-white border-r border-pink-100/90 flex-col py-6 px-4 hidden md:flex sticky top-0 h-screen shrink-0">
        <div className="flex items-center gap-3 font-bold text-gray-900 mb-7 px-2">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl flex items-center justify-center shrink-0 shadow-sm shadow-pink-500/25">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-gray-900">{bizName}</div>
            <div className="text-[11px] font-semibold text-pink-500">Owner Studio</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {TABS.map((item) => {
            const badge = getTabBadge(item.id)
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'appointments') setApptQuery('')
                  setActiveTab(item.id)
                }}
                className={`w-full flex items-center justify-between gap-2 px-3.5 min-h-[44px] rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-pink-50 text-pink-600 border border-pink-100 shadow-xs'
                    : 'text-gray-600 hover:bg-rose-50/50 hover:text-gray-900 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <item.icon size={17} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {badge && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isActive ? 'bg-pink-500 text-white' : badge.tone
                    }`}
                  >
                    {badge.count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Rose-Gold Client Experience & Readiness Card */}
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-pink-600 p-4 text-white shadow-lg shadow-pink-500/20 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wide uppercase text-pink-100">
              Client Experience
            </span>
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
              {setupPercent}%
            </span>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-pink-50 leading-snug">
              Keep your salon rates, photos, and policies fresh for clients.
            </p>
            <div className="w-full h-1.5 rounded-full bg-white/25 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${setupPercent}%` }}
              />
            </div>
          </div>

          <div className="pt-0.5">
            <button
              type="button"
              onClick={() =>
                handleCopyReminder('sidebar-public-site', `${window.location.origin}/`)
              }
              className="w-full flex items-center justify-center gap-1.5 bg-white text-pink-600 hover:bg-rose-50 text-xs font-bold min-h-[38px] rounded-xl transition-colors shadow-xs"
            >
              {copiedKey === 'sidebar-public-site' ? <Check size={14} /> : <Copy size={14} />}
              {copiedKey === 'sidebar-public-site' ? 'Copied Public Site' : 'Copy Public Site'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 flex items-center gap-2.5 text-sm font-medium text-gray-500 hover:text-rose-600 px-3.5 min-h-[40px] rounded-xl hover:bg-rose-50/50 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Spacious SaaS Top Header */}
        <header className="bg-white/95 backdrop-blur-sm border-b border-pink-100/90 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-30">
          {/* Mobile Brand + Search */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="md:hidden flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
            </div>

            <div ref={searchRef} className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                value={globalSearch}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setGlobalSearch(e.target.value)
                  setSearchFocused(true)
                }}
                placeholder="Search bookings, clients, services, or chat logs..."
                className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl border border-pink-100 bg-rose-50/25 focus:bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition-all"
              />

              {/* Live Global Search Popover */}
              {searchFocused && searchResults && (
                <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-pink-100 shadow-xl p-3 space-y-3 z-40 max-h-96 overflow-y-auto">
                  {searchResults.matchedBookings.length === 0 &&
                  searchResults.matchedServices.length === 0 &&
                  searchResults.matchedLogs.length === 0 ? (
                    <p className="text-xs text-gray-500 px-2 py-3 text-center">
                      No matching bookings, services, or chat logs for "{globalSearch}".
                    </p>
                  ) : (
                    <>
                      {searchResults.matchedBookings.length > 0 && (
                        <div className="space-y-1">
                          <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Bookings
                          </p>
                          {searchResults.matchedBookings.map((b) => (
                            <button
                              key={`sr-b-${b.id}`}
                              type="button"
                              onClick={() => {
                                setApptFilter('all')
                                setApptQuery(b.reference_code || b.client_name || '')
                                setActiveTab('appointments')
                                setSearchFocused(false)
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="font-semibold text-gray-800 truncate">
                                {b.client_name} · {b.service_type}
                              </span>
                              <span className="font-mono text-pink-600 shrink-0">
                                {b.reference_code}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.matchedServices.length > 0 && (
                        <div className="space-y-1">
                          <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Services
                          </p>
                          {searchResults.matchedServices.map((s) => (
                            <button
                              key={`sr-s-${s.key}`}
                              type="button"
                              onClick={() => {
                                jumpToBusinessTab('services')
                                setSearchFocused(false)
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 text-xs font-semibold text-gray-800"
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.matchedLogs.length > 0 && (
                        <div className="space-y-1">
                          <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Chat Logs
                          </p>
                          {searchResults.matchedLogs.map((l) => (
                            <button
                              key={`sr-l-${l.id}`}
                              type="button"
                              onClick={() => {
                                setActiveTab('logs')
                                setSearchFocused(false)
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 text-xs text-gray-700 truncate"
                            >
                              {l.user_message}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Top Right Utility Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Notification Bell Popover */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Studio notifications"
                className="relative w-10 h-10 rounded-xl border border-pink-100 bg-white hover:bg-rose-50 text-gray-600 flex items-center justify-center transition-colors"
              >
                <Bell size={18} />
                {totalNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {totalNotifCount > 9 ? '9+' : totalNotifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-pink-100 shadow-xl p-4 space-y-3 z-40">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">Action Center</span>
                    <span className="text-[11px] font-semibold text-pink-600">
                      {totalNotifCount} updates
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('reminders')
                        setNotifOpen(false)
                      }}
                      className="w-full text-left p-3 rounded-xl bg-rose-50/60 hover:bg-rose-50 border border-pink-100 flex items-center justify-between"
                    >
                      <span className="font-semibold text-gray-800">Reminders due soon</span>
                      <span className="px-2 py-0.5 rounded-full bg-pink-500 text-white font-bold">
                        {remindersDueCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('logs')
                        setNotifOpen(false)
                      }}
                      className="w-full text-left p-3 rounded-xl bg-amber-50/60 hover:bg-amber-50 border border-amber-100 flex items-center justify-between"
                    >
                      <span className="font-semibold text-gray-800">Chats needing review</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold">
                        {attentionChatCount}
                      </span>
                    </button>

                    {setupWarnings.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          jumpToBusinessTab(setupWarnings[0]?.tab || 'profile')
                          setNotifOpen(false)
                        }}
                        className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-between"
                      >
                        <span className="font-semibold text-gray-800">Salon setup items</span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-700 text-white font-bold">
                          {setupWarnings.length}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Chat Logs Shortcut */}
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              aria-label="Open Chat Logs"
              className="relative w-10 h-10 rounded-xl border border-pink-100 bg-white hover:bg-rose-50 text-gray-600 flex items-center justify-center transition-colors"
            >
              <MessageSquare size={18} />
              {attentionChatCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-pink-500" />
              )}
            </button>

            {/* Mobile Sign Out */}
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign Out"
              className="md:hidden w-10 h-10 rounded-xl border border-pink-100 bg-white text-gray-500 hover:text-rose-600 flex items-center justify-center"
            >
              <LogOut size={16} />
            </button>

            {/* Owner Profile Badge */}
            <button
              type="button"
              onClick={() => jumpToBusinessTab('profile')}
              className="hidden sm:flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl border border-pink-100 bg-white hover:bg-rose-50/40 transition-colors"
            >
              <img
                src={artistAvatar}
                alt={artistName}
                className="w-8 h-8 rounded-full object-cover border border-pink-200"
              />
              <div className="text-left min-w-0 max-w-[150px]">
                <p className="text-xs font-bold text-gray-900 truncate">{artistName}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {ownerEmail || 'Salon Owner'}
                </p>
              </div>
            </button>
          </div>
        </header>

        {/* Main Workspace Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-10 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardHomeTab
              appointments={appointments}
              chatLogs={chatLogs}
              catalog={catalog}
              setupWarnings={setupWarnings}
              setupPercent={setupPercent}
              upcomingSchedule={upcomingSchedule}
              onOpenNewBooking={() => setBookingModalOpen(true)}
              onNavigateTab={setActiveTab}
              onOpenBusinessTab={jumpToBusinessTab}
              onSelectDateSchedule={(iso) => {
                setApptFilter('all')
                setApptQuery(iso)
                setActiveTab('appointments')
              }}
            />
          )}

          {activeTab === 'appointments' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Appointments</h1>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Review client bookings, export calendar invites, and update session statuses.
                  </p>
                </div>
                <PrimaryButton onClick={() => setBookingModalOpen(true)}>
                  <CalendarPlus size={16} />
                  New Booking
                </PrimaryButton>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatKpiCard
                  label="Total Bookings"
                  value={apptStats.total}
                  sublabel="All client records"
                  icon={Calendar}
                  tone="charcoal"
                  active={apptFilter === 'all'}
                  onClick={() => setApptFilter('all')}
                />
                <StatKpiCard
                  label="Confirmed & Active"
                  value={apptStats.confirmed}
                  sublabel="Booked upcoming or active"
                  icon={CheckCircle2}
                  tone="emerald"
                  active={apptFilter === 'upcoming'}
                  onClick={() => setApptFilter('upcoming')}
                />
                <StatKpiCard
                  label="Today & Tomorrow"
                  value={apptStats.soon}
                  sublabel="Immediate 48-hour prep"
                  icon={Clock}
                  tone="rose"
                  active={apptFilter === 'soon'}
                  onClick={() => setApptFilter('soon')}
                />
                <StatKpiCard
                  label="Cancelled / No-show"
                  value={apptStats.cancelledOrNoShow}
                  sublabel="Closed or missed slots"
                  icon={XCircle}
                  tone="amber"
                  active={apptFilter === 'closed'}
                  onClick={() => setApptFilter('closed')}
                />
              </div>

              {/* Filter & Search Bar */}
              <div className="bg-white rounded-2xl border border-pink-100/90 shadow-sm p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {APPT_FILTERS.map((f) => {
                    const active = apptFilter === f.id
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setApptFilter(f.id)}
                        className={`inline-flex items-center gap-2 text-xs font-semibold px-3.5 min-h-[38px] rounded-xl border transition-colors ${
                          active
                            ? 'bg-pink-500 border-pink-500 text-white shadow-xs'
                            : 'bg-white border-pink-100 text-gray-600 hover:border-pink-300 hover:bg-rose-50/40'
                        }`}
                      >
                        <span>{f.label}</span>
                        <span
                          className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                            active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {filterCounts[f.id]}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="relative w-full lg:w-72">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={apptQuery}
                    onChange={(e) => setApptQuery(e.target.value)}
                    placeholder="Search client, ref, date, venue..."
                    className="w-full min-h-[42px] border border-pink-100 rounded-xl pl-10 pr-9 py-2 text-xs text-gray-800 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
                  />
                  {apptQuery && (
                    <button
                      type="button"
                      onClick={() => setApptQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-pink-50"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {loading ? (
                  <div className="bg-white rounded-2xl border border-pink-100 p-8 text-center text-gray-400 text-sm">
                    Loading appointments...
                  </div>
                ) : pagedAppointments.items.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-pink-100 p-8 text-center text-gray-400 text-sm space-y-3">
                    <p>{appointments.length === 0 ? 'No appointments yet.' : 'No bookings match your current filter.'}</p>
                    {appointments.length > 0 && (apptQuery || apptFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setApptQuery('')
                          setApptFilter('all')
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-pink-200 text-xs font-semibold text-pink-600 hover:bg-pink-50 transition-colors"
                      >
                        Clear search & filters
                      </button>
                    )}
                  </div>
                ) : (
                  pagedAppointments.items.map((appt) => {
                    const prep = computeOwnerPrepSummary(appt, { freeTravelAreas, businessName: bizName })
                    const telHref = formatTelHref(appt.client_contact)
                    const thumb =
                      serviceByKey[appt.service_key]?.imageUrl ||
                      SHOWCASE_SERVICE_IMAGES[appt.service_key] ||
                      DEFAULT_ARTIST_PHOTO_URL
                    return (
                      <div key={appt.id} className="bg-white rounded-2xl border border-pink-100/90 shadow-xs p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={thumb}
                              alt={appt.service_type}
                              className="w-11 h-11 rounded-xl object-cover border border-pink-100 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 text-sm truncate">{appt.client_name}</div>
                              <div className="font-mono text-xs text-pink-600 font-semibold">
                                {appt.reference_code || 'No Ref'}
                              </div>
                            </div>
                          </div>
                          <StatusBadge status={appt.status} />
                        </div>

                        <div className="text-xs text-gray-600 space-y-1">
                          <div>
                            <strong className="text-gray-800">{appt.service_type}</strong>
                          </div>
                          <div>
                            {new Date(appt.appointment_date).toLocaleString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              timeZone: 'Asia/Manila',
                            })}
                          </div>
                          {telHref && (
                            <a href={telHref} className="inline-flex items-center gap-1 text-pink-600 font-mono">
                              <Phone size={12} /> {appt.client_contact}
                            </a>
                          )}
                          {prep?.venue && (
                            <a
                              href={prep.mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-pink-600 font-medium"
                            >
                              <MapPin size={12} />
                              <span className="truncate">{prep.venue}</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-pink-50">
                          <select
                            value={appt.status}
                            onChange={(e) => requestStatusChange(appt, e.target.value)}
                            className="text-xs border border-pink-100 rounded-xl px-3 min-h-[36px] bg-white focus:outline-none focus:border-pink-400"
                          >
                            <option value="confirmed">Confirmed</option>
                            <option value="rescheduled">Rescheduled</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="no_show">No-show</option>
                          </select>
                          {prep?.calendarUrl && (
                            <a
                              href={prep.calendarUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-pink-500 text-white px-3 min-h-[36px] rounded-xl"
                            >
                              <CalendarPlus size={12} />
                              Calendar
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Desktop Spacious SaaS Table */}
              <div className="hidden md:block bg-white rounded-2xl border border-pink-100/90 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-pink-100 bg-rose-50/40">
                        {['Service & Ref', 'Client & Contact', 'Schedule', 'Venue / Maps', 'Status', 'Reminder', 'Actions'].map((h) => (
                          <th
                            key={h}
                            className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pink-50">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-gray-400 text-sm">
                            Loading appointments...
                          </td>
                        </tr>
                      ) : pagedAppointments.items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-gray-400 text-sm">
                            <div className="space-y-3">
                              <p>{appointments.length === 0 ? 'No appointments yet.' : 'No bookings match your current filter.'}</p>
                              {appointments.length > 0 && (apptQuery || apptFilter !== 'all') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setApptQuery('')
                                    setApptFilter('all')
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-pink-200 text-xs font-semibold text-pink-600 hover:bg-pink-50 transition-colors"
                                >
                                  Clear search & filters
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        pagedAppointments.items.map((appt) => {
                          const prep = computeOwnerPrepSummary(appt, { freeTravelAreas, businessName: bizName })
                          const telHref = formatTelHref(appt.client_contact)
                          const thumb =
                            serviceByKey[appt.service_key]?.imageUrl ||
                            SHOWCASE_SERVICE_IMAGES[appt.service_key] ||
                            DEFAULT_ARTIST_PHOTO_URL
                          return (
                            <tr key={appt.id} className="hover:bg-rose-50/25 transition-colors">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3 min-w-[200px]">
                                  <img
                                    src={thumb}
                                    alt={appt.service_type}
                                    className="w-11 h-11 rounded-xl object-cover border border-pink-100 shrink-0 bg-rose-50"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-semibold text-gray-900 truncate max-w-[220px]">
                                      {appt.service_type}
                                    </div>
                                    <div className="font-mono text-xs text-pink-600 font-semibold mt-0.5">
                                      {appt.reference_code || '-'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <div className="font-semibold text-gray-900">{appt.client_name}</div>
                                {telHref ? (
                                  <a
                                    href={telHref}
                                    className="inline-flex items-center gap-1 font-mono text-xs text-gray-500 hover:text-pink-600 mt-0.5"
                                  >
                                    <Phone size={11} className="text-pink-400" />
                                    {appt.client_contact}
                                  </a>
                                ) : (
                                  <span className="text-xs text-gray-400">Not set</span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-xs text-gray-700 font-medium whitespace-nowrap">
                                {new Date(appt.appointment_date).toLocaleString('en-PH', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  timeZone: 'Asia/Manila',
                                })}
                              </td>
                              <td className="px-5 py-4 text-xs">
                                {prep?.venue ? (
                                  <a
                                    href={prep.mapsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-pink-600 hover:text-pink-700 font-semibold"
                                  >
                                    <MapPin size={12} />
                                    <span className="max-w-[160px] truncate">{prep.venue}</span>
                                    <ExternalLink size={10} />
                                  </a>
                                ) : (
                                  <span className="text-gray-400">Studio / not set</span>
                                )}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <StatusBadge status={appt.status} />
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap text-xs">
                                {appt.reminder_sent ? (
                                  <span className="text-emerald-600 font-semibold">Sent</span>
                                ) : (
                                  <span className="text-gray-400">Pending</span>
                                )}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <select
                                    aria-label={`Change status for ${appt.client_name}`}
                                    value={appt.status}
                                    onChange={(e) => requestStatusChange(appt, e.target.value)}
                                    className="text-xs font-semibold border border-pink-100 rounded-xl px-2.5 min-h-[36px] bg-white focus:outline-none focus:border-pink-400"
                                  >
                                    <option value="confirmed">Confirmed</option>
                                    <option value="rescheduled">Rescheduled</option>
                                    <option value="cancelled">Cancelled</option>
                                    <option value="no_show">No-show</option>
                                  </select>
                                  {prep?.calendarUrl && (
                                    <a
                                      href={prep.calendarUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Add to Google Calendar"
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-pink-600 border border-pink-100 hover:border-pink-300 px-3 min-h-[36px] rounded-xl transition-colors"
                                    >
                                      <CalendarPlus size={13} />
                                      Calendar
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationBar
                  page={pagedAppointments.page}
                  totalPages={pagedAppointments.totalPages}
                  total={pagedAppointments.total}
                  startIndex={pagedAppointments.startIndex}
                  endIndex={pagedAppointments.endIndex}
                  onPageChange={setApptPage}
                  itemLabel="appointments"
                />
              </div>
            </div>
          )}

          {activeTab === 'logs' && <ChatLogsTab chatLogs={chatLogs} />}

          {activeTab === 'business' && (
            <BusinessInfoTab
              requestedSubTab={requestedBizTab}
              onWarningsChanged={(w) => {
                setSetupWarnings(w)
                businessInfo.loadOwnerData().then((rows) => {
                  if (!rows.error) setSetupPercent(computeProfileCompletion(rows).percentage)
                })
              }}
            />
          )}

          {activeTab === 'reminders' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Prep & Client Reminders</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Stay ahead of leave times and send 1-to-2-day confirmation messages with one click.
                </p>
              </div>

              {/* Section 1: Owner 1-Day-Before Preparation Schedule */}
              <section className="bg-white rounded-2xl border border-pink-100/90 shadow-sm p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-base text-gray-900 flex items-center gap-2">
                      <Clock size={18} className="text-pink-500" />
                      Owner Preparation & Travel Schedule
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Review call time, suggested leave buffer for venue traffic, and sync directly to Google Calendar.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-rose-50 text-pink-600 border border-pink-100">
                    {upcomingSchedule.length} upcoming active
                  </span>
                </div>

                {upcomingSchedule.length === 0 ? (
                  <div className="bg-rose-50/30 border border-dashed border-pink-200 rounded-2xl p-8 text-center text-sm text-gray-500">
                    No upcoming confirmed or rescheduled bookings yet.
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {upcomingSchedule.map(({ appt, prep, daysUntil }) => {
                      const isTomorrowOrToday = daysUntil === 0 || daysUntil === 1
                      return (
                        <div
                          key={`prep-${appt.id}`}
                          className={`rounded-2xl border p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                            isTomorrowOrToday ? 'border-pink-200 bg-rose-50/40' : 'border-pink-100 bg-white'
                          }`}
                        >
                          <div className="space-y-2 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-gray-900">{appt.client_name}</span>
                              <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-lg">
                                {appt.reference_code || 'No Ref'}
                              </span>
                              <span className="text-xs text-pink-600 font-semibold">{appt.service_type}</span>
                              {daysUntil === 0 && (
                                <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                                  Today
                                </span>
                              )}
                              {daysUntil === 1 && (
                                <span className="text-[11px] font-bold bg-pink-500 text-white px-2.5 py-0.5 rounded-full">
                                  Tomorrow (1-Day Prep)
                                </span>
                              )}
                              {daysUntil != null && daysUntil > 1 && (
                                <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full">
                                  In {daysUntil} days
                                </span>
                              )}
                            </div>

                            <div className="grid sm:grid-cols-3 gap-3 text-xs text-gray-600 pt-1">
                              <div>
                                <span className="text-gray-400 block">Date & Call Time</span>
                                <span className="font-semibold text-gray-900">
                                  {prep.displayDate} at {prep.callTimeFormatted}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400 block">Suggested Leave Time</span>
                                <span className="font-bold text-pink-600">
                                  {prep.leaveTimeFormatted || '-'}
                                </span>
                                <span className="text-[11px] text-gray-400 block">{prep.prepLabel}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block">Event Location</span>
                                {prep.venue ? (
                                  <span className="font-semibold text-gray-900">{prep.venue}</span>
                                ) : (
                                  <span className="text-gray-400">Studio / not specified</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {prep.mapsUrl && (
                              <a
                                href={prep.mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-pink-50 text-gray-700 hover:text-pink-600 border border-pink-100 hover:border-pink-300 px-3.5 min-h-[38px] rounded-xl transition-colors"
                              >
                                <MapPin size={13} className="text-pink-500" />
                                Open in Maps
                              </a>
                            )}
                            {prep.calendarUrl && (
                              <a
                                href={prep.calendarUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-pink-500 hover:bg-pink-600 text-white px-4 min-h-[38px] rounded-xl transition-colors shadow-xs"
                              >
                                <CalendarPlus size={13} />
                                Add to Google Calendar
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Section 2: Client 1-to-2-Day Confirmation Reminders */}
              <section className="bg-white rounded-2xl border border-pink-100/90 shadow-sm p-6 space-y-5">
                <div>
                  <h2 className="font-bold text-base text-gray-900 flex items-center gap-2">
                    <Bell size={18} className="text-pink-500" />
                    Client 1-to-2-Day Confirmation Reminders
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Copy a ready-to-send SMS or Messenger reminder 1 to 2 days before the client appointment.
                  </p>
                </div>

                {upcomingSchedule.length === 0 ? (
                  <div className="bg-rose-50/30 border border-dashed border-pink-200 rounded-2xl p-8 text-center text-sm text-gray-500">
                    No client reminders due right now.
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {upcomingSchedule.map(({ appt, daysUntil }) => {
                      const reminderText = buildClientReminderText(appt, bizName)
                      const copyId = `rem-${appt.id}`
                      const dueSoon = daysUntil != null && daysUntil <= 2
                      return (
                        <div key={copyId} className="rounded-2xl border border-pink-100 p-5 space-y-3 bg-white">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-bold text-sm text-gray-900">{appt.client_name}</span>
                              {appt.client_contact && (
                                <span className="text-gray-500 font-mono">{appt.client_contact}</span>
                              )}
                              {dueSoon && !appt.reminder_sent && (
                                <span className="bg-pink-50 text-pink-600 border border-pink-100 font-semibold px-2.5 py-0.5 rounded-full">
                                  Due for 1-2 day reminder
                                </span>
                              )}
                              {appt.reminder_sent ? (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-2.5 py-0.5 rounded-full">
                                  Marked Sent
                                </span>
                              ) : (
                                <span className="text-gray-400">Not marked sent</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopyReminder(copyId, reminderText)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-50/60 hover:bg-pink-100 text-gray-800 hover:text-pink-700 border border-pink-100 px-3.5 min-h-[38px] rounded-xl transition-colors"
                              >
                                {copiedKey === copyId ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                {copiedKey === copyId ? 'Copied Reminder' : 'Copy Reminder Text'}
                              </button>
                              {!appt.reminder_sent && (
                                <button
                                  type="button"
                                  onClick={() => markReminderSent(appt.id)}
                                  className="text-xs font-semibold bg-pink-500 hover:bg-pink-600 text-white px-4 min-h-[38px] rounded-xl transition-colors shadow-xs"
                                >
                                  Mark Sent
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-700 bg-rose-50/35 rounded-xl p-3.5 border border-pink-100/70 whitespace-pre-wrap leading-relaxed">
                            {reminderText}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-pink-100 flex justify-around py-2 px-1 z-40">
        {TABS.map((item) => {
          const badge = getTabBadge(item.id)
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-xl ${
                isActive ? 'text-pink-600' : 'text-gray-400'
              }`}
            >
              <item.icon size={18} />
              <span>{item.shortLabel}</span>
              {badge && (
                <span className="absolute -top-0.5 right-0.5 w-2 h-2 rounded-full bg-pink-500" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Manual Booking Modal */}
      <ManualBookingModal
        open={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        onBooked={fetchAppointments}
        appointmentActions={appointmentActions}
        catalog={catalog}
      />

      {/* Destructive Status Confirmation Modal */}
      <ConfirmModal
        open={Boolean(pendingStatusChange)}
        title={
          pendingStatusChange?.nextStatus === 'cancelled'
            ? 'Cancel This Appointment?'
            : 'Mark Client as No-show?'
        }
        description={
          pendingStatusChange
            ? `This will update ${pendingStatusChange.clientName || 'this client'} (${pendingStatusChange.ref || 'booking'}) to ${pendingStatusChange.nextStatus === 'cancelled' ? 'Cancelled' : 'No-show'}.`
            : ''
        }
        confirmLabel={
          pendingStatusChange?.nextStatus === 'cancelled' ? 'Yes, Cancel Booking' : 'Mark No-show'
        }
        tone="danger"
        busy={statusBusy}
        onCancel={() => setPendingStatusChange(null)}
        onConfirm={() =>
          pendingStatusChange &&
          updateStatus(pendingStatusChange.id, pendingStatusChange.nextStatus)
        }
      />
    </div>
  )
}

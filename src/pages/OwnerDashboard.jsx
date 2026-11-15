import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  Bell,
  LogOut,
  Clock,
  AlertCircle,
  AlertTriangle,
  Store,
  MapPin,
  ExternalLink,
  CalendarPlus,
  Copy,
  Check,
  Download,
  FileText,
  Upload,
  Search,
  Phone,
  MessageSquare,
  LayoutDashboard,
  CheckCircle2,
  XCircle,
  X,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import BusinessInfoTab from './owner/BusinessInfoTab.jsx'
import ChatLogsTab from './owner/ChatLogsTab.jsx'
import StudioMark from '../components/StudioMark.jsx'
import NotificationPrompt from '../components/NotificationPrompt.jsx'
import BookingCompletionCard from '../components/owner/BookingCompletionCard.jsx'
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
import { enableOwnerAlerts, pushSupported, pushConfigured, currentPermission } from '../lib/push.js'
import { createAppointmentService } from '../services/appointments.js'
import { useBusinessInfo, businessInfo } from '../lib/useBusinessInfo.js'
import { sanitizeImageUrl } from '../lib/mediaUpload.js'
import {
  downloadAppointmentTemplate,
  exportAppointmentsCsv,
  parseAppointmentsCsv,
} from '../lib/csvExport.js'
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
  const [sendingReminderId, setSendingReminderId] = useState(null)
  const [reminderNotice, setReminderNotice] = useState(null)
  const [ownerAlertStatus, setOwnerAlertStatus] = useState(() => currentPermission())
  const [ownerAlertMessage, setOwnerAlertMessage] = useState(null)
  const [setupWarnings, setSetupWarnings] = useState([])
  const [setupPercent, setSetupPercent] = useState(100)
  const [requestedBizTab, setRequestedBizTab] = useState(null)
  const [apptFilter, setApptFilter] = useState('all')
  const [apptQuery, setApptQuery] = useState('')
  const [apptPage, setApptPage] = useState(1)
  const [globalSearch, setGlobalSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('jal_owner_sidebar_collapsed') === '1'
    } catch {
      return false
    }
  })
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
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false)
        setNotifOpen(false)
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
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

  const importInputRef = useRef(null)

  async function handleAppointmentImport(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const text = await file.text()
    const { rows, errors } = parseAppointmentsCsv(text)
    if (errors.length > 0) {
      const preview = errors
        .slice(0, 5)
        .map((e) => `Line ${e.line}: ${e.message}`)
        .join('\n')
      const more = errors.length > 5 ? `\n...and ${errors.length - 5} more` : ''
      window.alert(`Nothing was imported. Fix these rows and try again:\n\n${preview}${more}`)
      return
    }
    if (rows.length === 0) {
      window.alert('The file has no appointment rows to import.')
      return
    }
    const count = rows.length
    if (!window.confirm(`Import ${count} appointment${count === 1 ? '' : 's'} into the live database?`)) {
      return
    }
    const { error } = await supabase.from('appointments').insert(rows)
    if (error) {
      window.alert(`Import failed: ${error.message}`)
      return
    }
    window.alert(`Imported ${count} appointment${count === 1 ? '' : 's'}.`)
    fetchAppointments()
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

  // Posts the reminder into the client's chat session (and pushes it to their device if they allowed alerts).
  async function handleSendSessionReminder(appt, text) {
    setSendingReminderId(appt.id)
    setReminderNotice(null)
    const { error } = await supabase.rpc('jal_send_session_reminder', {
      p_appointment_id: appt.id,
      p_body: text,
    })
    setSendingReminderId(null)
    if (error) {
      setReminderNotice({ tone: 'error', text: `Could not send to ${appt.client_name}: ${error.message}` })
      return
    }
    setReminderNotice({ tone: 'ok', text: `Reminder posted to ${appt.client_name}'s chat session.` })
    fetchAppointments()
  }

  // Permission already granted on this browser: register it for owner alerts without asking again.
  useEffect(() => {
    if (currentPermission() === 'granted') enableOwnerAlerts().catch(() => {})
  }, [])

  async function handleEnableOwnerAlerts() {
    setOwnerAlertMessage(null)
    try {
      await enableOwnerAlerts()
      setOwnerAlertMessage('Alerts are on for this device. You will be notified about new, cancelled and rescheduled bookings.')
    } catch (err) {
      setOwnerAlertMessage(err.message)
    }
    setOwnerAlertStatus(currentPermission())
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
        (item) => item.daysUntil != null && item.daysUntil <= 3 && !item.appt.reminder_sent,
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

  function toggleDesktopSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('jal_owner_sidebar_collapsed', next ? '1' : '0')
      } catch {
        // Ignore storage errors cleanly
      }
      return next
    })
  }

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
    <div className="min-h-screen bg-[#f8f6f2] flex">
      {/* Desktop Left Sidebar */}
      <aside
        className={`bg-[#fdfcfa] border-r border-stone-200/80 flex-col hidden md:flex sticky top-0 h-screen shrink-0 transition-[width,padding] duration-200 ${
          sidebarCollapsed ? 'w-20 py-5 px-2.5' : 'w-64 xl:w-68 py-6 px-4'
        }`}
      >
        <div
          className={`flex items-center mb-6 ${
            sidebarCollapsed ? 'flex-col gap-2.5' : 'justify-between gap-2 px-1.5'
          }`}
        >
          <div className={`flex items-center gap-3 font-semibold text-stone-900 min-w-0 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <StudioMark size="md" />
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-stone-900">{bizName}</div>
                <div className="text-xs font-medium text-pink-700">Owner Studio</div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleDesktopSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-8 h-8 rounded-lg border border-stone-200/80 bg-[#f8f6f2] hover:bg-stone-100 text-stone-500 hover:text-stone-900 flex items-center justify-center shrink-0 transition-colors"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={15} strokeWidth={1.75} /> : <PanelLeftClose size={15} strokeWidth={1.75} />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto pr-0.5">
          {TABS.map((item) => {
            const badge = getTabBadge(item.id)
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                title={sidebarCollapsed ? item.label : undefined}
                aria-label={item.label}
                onClick={() => {
                  if (item.id === 'appointments') setApptQuery('')
                  setActiveTab(item.id)
                }}
                className={`relative w-full flex items-center ${
                  sidebarCollapsed ? 'justify-center px-0' : 'justify-between gap-2 px-3'
                } min-h-9 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-pink-50 text-pink-700 border border-pink-200'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 border border-transparent'
                }`}
              >
                <span className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}>
                  <item.icon size={16} strokeWidth={1.75} className="shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </span>
                {badge && !sidebarCollapsed && (
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-md tabular-nums shrink-0 ${
                      isActive ? 'bg-pink-600 text-white' : badge.tone
                    }`}
                  >
                    {badge.count}
                  </span>
                )}
                {badge && sidebarCollapsed && (
                  <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-pink-600" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Client Experience & Readiness Card */}
        {sidebarCollapsed ? (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div
              title={`Studio Readiness: ${setupPercent}%`}
              className="w-11 h-11 rounded-lg bg-pink-600 text-white text-xs font-semibold tabular-nums flex items-center justify-center"
            >
              {setupPercent}%
            </div>
            <button
              type="button"
              onClick={() =>
                handleCopyReminder('sidebar-public-site', `${window.location.origin}/`)
              }
              title={copiedKey === 'sidebar-public-site' ? 'Copied Public Site' : 'Copy Public Site'}
              aria-label="Copy Public Site"
              className="w-11 h-10 rounded-lg border border-stone-200/80 bg-[#f8f6f2] hover:bg-stone-100 text-pink-700 flex items-center justify-center transition-colors"
            >
              {copiedKey === 'sidebar-public-site' ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-[#f8f6f2] border border-stone-200/80 p-4 text-stone-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-stone-700">
                Client experience
              </span>
              <span className="text-xs font-medium bg-[#fdfcfa] text-pink-700 border border-stone-200/80 px-2 py-0.5 rounded-md tabular-nums">
                {setupPercent}%
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-stone-500 leading-snug">
                Keep your salon rates, photos, and policies fresh for clients.
              </p>
              <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
                <div
                  className="h-full bg-pink-600 rounded-full transition-[width] duration-300"
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
                className="w-full flex items-center justify-center gap-1.5 bg-[#fdfcfa] text-stone-800 hover:bg-stone-100 border border-stone-200/80 text-xs font-medium min-h-9 rounded-lg transition-colors"
              >
                {copiedKey === 'sidebar-public-site' ? <Check size={14} /> : <Copy size={14} />}
                {copiedKey === 'sidebar-public-site' ? 'Copied Public Site' : 'Copy Public Site'}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          title={sidebarCollapsed ? 'Sign Out' : undefined}
          aria-label="Sign Out"
          className={`mt-3 flex items-center text-sm font-medium text-stone-600 hover:text-rose-700 min-h-10 rounded-lg hover:bg-stone-100 transition-colors ${
            sidebarCollapsed ? 'justify-center px-0' : 'gap-2.5 px-3.5'
          }`}
        >
          <LogOut size={16} strokeWidth={1.75} />
          {!sidebarCollapsed && 'Sign Out'}
        </button>
      </aside>

      {/* Mobile Slide-Out Drawer */}
      {mobileDrawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Owner Studio Menu"
        >
          <div
            className="fixed inset-0 bg-stone-900/45 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative z-10 w-[min(84vw,20rem)] max-w-full bg-[#fdfcfa] h-full flex flex-col py-4 px-3.5 shadow-2xl border-r border-stone-200/80 overflow-y-auto">
            <div className="flex items-center justify-between gap-2 mb-5 px-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <StudioMark size="md" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-stone-900">{bizName}</div>
                  <div className="text-xs font-medium text-pink-700">Owner Studio</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="w-9 h-9 rounded-lg border border-stone-200/80 bg-[#f8f6f2] text-stone-600 hover:bg-stone-100 flex items-center justify-center shrink-0"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <nav className="flex-1 space-y-1">
              {TABS.map((item) => {
                const badge = getTabBadge(item.id)
                const isActive = activeTab === item.id
                return (
                  <button
                    key={`drawer-${item.id}`}
                    type="button"
                    onClick={() => {
                      if (item.id === 'appointments') setApptQuery('')
                      setActiveTab(item.id)
                      setMobileDrawerOpen(false)
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 min-h-11 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-pink-50 text-pink-700 border border-pink-200'
                        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <item.icon size={17} strokeWidth={1.75} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {badge && (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-md tabular-nums shrink-0 ${
                          isActive ? 'bg-pink-600 text-white' : badge.tone
                        }`}
                      >
                        {badge.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>

            <div className="mt-4 rounded-xl bg-[#f8f6f2] border border-stone-200/80 p-3.5 text-stone-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-stone-700">
                  Client experience
                </span>
                <span className="text-xs font-medium bg-[#fdfcfa] text-pink-700 border border-stone-200/80 px-2 py-0.5 rounded-md tabular-nums">
                  {setupPercent}%
                </span>
              </div>
              <p className="text-xs text-stone-500 leading-snug">
                Keep your salon rates, photos, and policies fresh for clients.
              </p>
              <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
                <div
                  className="h-full bg-pink-600 rounded-full transition-[width] duration-300"
                  style={{ width: `${setupPercent}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopyReminder('drawer-public-site', `${window.location.origin}/`)
                }
                className="w-full flex items-center justify-center gap-1.5 bg-[#fdfcfa] text-stone-800 hover:bg-stone-100 border border-stone-200/80 text-xs font-medium min-h-9 rounded-lg transition-colors"
              >
                {copiedKey === 'drawer-public-site' ? <Check size={14} /> : <Copy size={14} />}
                {copiedKey === 'drawer-public-site' ? 'Copied Public Site' : 'Copy Public Site'}
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-stone-200/80 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  jumpToBusinessTab('profile')
                  setMobileDrawerOpen(false)
                }}
                className="flex items-center gap-2 min-w-0 text-left hover:bg-stone-100 rounded-lg p-1.5 flex-1"
              >
                <img
                  src={artistAvatar}
                  alt={artistName}
                  className="w-8 h-8 rounded-full object-cover border border-stone-200 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-900 truncate">{artistName}</p>
                  <p className="text-xs text-stone-500 truncate">{ownerEmail || 'Salon Owner'}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign Out"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-rose-700 px-2.5 min-h-9 rounded-lg border border-stone-200/80 bg-[#f8f6f2] hover:bg-stone-100 shrink-0"
              >
                <LogOut size={14} strokeWidth={1.75} />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-[#fdfcfa]/95 backdrop-blur-sm border-b border-stone-200/80 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30">
          {/* Mobile Menu Drawer Button + Search */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden w-9 h-9 rounded-lg border border-stone-200/80 bg-[#fdfcfa] hover:bg-stone-100 text-stone-700 flex items-center justify-center shrink-0"
            >
              <Menu size={18} strokeWidth={1.75} />
            </button>

            <div ref={searchRef} className="relative flex-1 max-w-md min-w-0">
              <Search
                size={15}
                className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
              />
              <input
                type="text"
                value={globalSearch}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setGlobalSearch(e.target.value)
                  setSearchFocused(true)
                }}
                placeholder="Search"
                className="w-full min-h-9 sm:min-h-10 pl-9 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 rounded-lg border border-stone-200/80 bg-[#f8f6f2] focus:bg-[#fdfcfa] text-xs sm:text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-[background-color,border-color,box-shadow]"
              />

              {/* Live Global Search Popover */}
              {searchFocused && searchResults && (
                <div className="absolute left-0 right-0 mt-2 bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-lg p-3 space-y-3 z-40 max-h-96 overflow-y-auto">
                  {searchResults.matchedBookings.length === 0 &&
                  searchResults.matchedServices.length === 0 &&
                  searchResults.matchedLogs.length === 0 ? (
                    <p className="text-xs text-stone-500 px-2 py-3 text-center">
                      No matching bookings, services, or chat logs for "{globalSearch}".
                    </p>
                  ) : (
                    <>
                      {searchResults.matchedBookings.length > 0 && (
                        <div className="space-y-1">
                          <p className="px-2 text-xs font-medium text-stone-500">
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
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-100 flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="font-medium text-stone-800 truncate">
                                {b.client_name} · {b.service_type}
                              </span>
                              <span className="font-mono text-pink-700 shrink-0 tabular-nums">
                                {b.reference_code}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.matchedServices.length > 0 && (
                        <div className="space-y-1">
                          <p className="px-2 text-xs font-medium text-stone-500">
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
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-100 text-xs font-medium text-stone-800"
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.matchedLogs.length > 0 && (
                        <div className="space-y-1">
                          <p className="px-2 text-xs font-medium text-stone-500">
                            Chat logs
                          </p>
                          {searchResults.matchedLogs.map((l) => (
                            <button
                              key={`sr-l-${l.id}`}
                              type="button"
                              onClick={() => {
                                setActiveTab('logs')
                                setSearchFocused(false)
                              }}
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-100 text-xs text-stone-700 truncate"
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
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Notification Bell Popover */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Studio notifications"
                className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-stone-200/80 bg-[#fdfcfa] hover:bg-stone-100 text-stone-600 flex items-center justify-center transition-colors"
              >
                <Bell size={17} strokeWidth={1.75} />
                {totalNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-pink-600 text-white text-[11px] font-medium tabular-nums flex items-center justify-center">
                    {totalNotifCount > 9 ? '9+' : totalNotifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-14 sm:top-auto sm:mt-2 sm:w-80 bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xl p-4 space-y-3 z-40">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-stone-900">Action Center</span>
                    <span className="text-xs font-medium text-pink-700 tabular-nums">
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
                      className="w-full text-left p-3 rounded-lg bg-[#f8f6f2] hover:bg-stone-100 border border-stone-200/80 flex items-center justify-between"
                    >
                      <span className="font-medium text-stone-800">Reminders due soon</span>
                      <span className="px-2 py-0.5 rounded-md bg-pink-600 text-white font-medium tabular-nums">
                        {remindersDueCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('logs')
                        setNotifOpen(false)
                      }}
                      className="w-full text-left p-3 rounded-lg bg-[#f8f6f2] hover:bg-stone-100 border border-stone-200/80 flex items-center justify-between"
                    >
                      <span className="font-medium text-stone-800">Chats needing review</span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white font-medium tabular-nums">
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
                        className="w-full text-left p-3 rounded-lg bg-[#f8f6f2] hover:bg-stone-100 border border-stone-200/80 flex items-center justify-between"
                      >
                        <span className="font-medium text-stone-800">Salon setup items</span>
                        <span className="px-2 py-0.5 rounded-md bg-stone-700 text-white font-medium tabular-nums">
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
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-stone-200/80 bg-[#fdfcfa] hover:bg-stone-100 text-stone-600 flex items-center justify-center transition-colors"
            >
              <MessageSquare size={17} strokeWidth={1.75} />
              {attentionChatCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-pink-600" />
              )}
            </button>

            {/* Owner Profile Badge */}
            <button
              type="button"
              onClick={() => jumpToBusinessTab('profile')}
              className="hidden sm:flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg border border-stone-200/80 bg-[#fdfcfa] hover:bg-stone-100 transition-colors"
            >
              <img
                src={artistAvatar}
                alt={artistName}
                className="w-8 h-8 rounded-full object-cover border border-stone-200"
              />
              <div className="text-left min-w-0 max-w-[150px]">
                <p className="text-xs font-semibold text-stone-900 truncate">{artistName}</p>
                <p className="text-xs text-stone-500 truncate">
                  {ownerEmail || 'Salon Owner'}
                </p>
              </div>
            </button>
          </div>
        </header>

        {/* Main Workspace Canvas */}
        <main className="flex-1 p-3 sm:p-5 lg:p-8 pb-24 md:pb-10 max-w-[1440px] w-full mx-auto">
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

          {activeTab === 'dashboard' && (
            <div className="mt-4 sm:mt-6">
              <BookingCompletionCard />
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold text-stone-900">Appointments</h1>
                  <p className="text-sm text-stone-500 mt-0.5">
                    Review client bookings, export calendar invites, and update session statuses.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadAppointmentTemplate()}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50"
                  >
                    <FileText size={16} strokeWidth={1.75} />
                    Blank Template
                  </button>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50"
                  >
                    <Upload size={16} strokeWidth={1.75} />
                    Import CSV
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleAppointmentImport}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => exportAppointmentsCsv(appointments)}
                    disabled={appointments.length === 0}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={16} strokeWidth={1.75} />
                    Export CSV
                  </button>
                  <PrimaryButton onClick={() => setBookingModalOpen(true)}>
                    <CalendarPlus size={16} strokeWidth={1.75} />
                    New Booking
                  </PrimaryButton>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <StatKpiCard
                  label="Total Bookings"
                  value={apptStats.total}
                  sublabel="All client records"
                  active={apptFilter === 'all'}
                  onClick={() => setApptFilter('all')}
                />
                <StatKpiCard
                  label="Confirmed & Active"
                  value={apptStats.confirmed}
                  sublabel="Booked upcoming or active"
                  active={apptFilter === 'upcoming'}
                  onClick={() => setApptFilter('upcoming')}
                />
                <StatKpiCard
                  label="Today & Tomorrow"
                  value={apptStats.soon}
                  sublabel="Immediate 48-hour prep"
                  active={apptFilter === 'soon'}
                  onClick={() => setApptFilter('soon')}
                />
                <StatKpiCard
                  label="Cancelled / No-show"
                  value={apptStats.cancelledOrNoShow}
                  sublabel="Closed or missed slots"
                  active={apptFilter === 'closed'}
                  onClick={() => setApptFilter('closed')}
                />
              </div>

              {/* Filter & Search Bar */}
              <div className="bg-white rounded-2xl border border-pink-100/90 shadow-sm p-3.5 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex overflow-x-auto sm:flex-wrap gap-2 pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
                  {APPT_FILTERS.map((f) => {
                    const active = apptFilter === f.id
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setApptFilter(f.id)}
                        className={`inline-flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap text-xs font-medium px-3 sm:px-3.5 min-h-9 rounded-lg border transition-colors ${
                          active
                            ? 'bg-pink-600 border-pink-600 text-white shadow-xs'
                            : 'bg-[#fdfcfa] border-stone-200/80 text-stone-600 hover:border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        <span>{f.label}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-md tabular-nums ${
                            active ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {filterCounts[f.id]}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="relative w-full lg:w-72">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={apptQuery}
                    onChange={(e) => setApptQuery(e.target.value)}
                    placeholder="Search bookings"
                    className="w-full min-h-10 border border-stone-200/80 bg-[#fdfcfa] rounded-lg pl-10 pr-9 py-2 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                  />
                  {apptQuery && (
                    <button
                      type="button"
                      onClick={() => setApptQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {loading ? (
                  <div className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 p-8 text-center text-stone-400 text-sm">
                    Loading appointments...
                  </div>
                ) : pagedAppointments.items.length === 0 ? (
                  <div className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 p-8 text-center text-stone-500 text-sm space-y-3">
                    <p>{appointments.length === 0 ? 'No appointments yet.' : 'No bookings match your current filter.'}</p>
                    {appointments.length > 0 && (apptQuery || apptFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setApptQuery('')
                          setApptFilter('all')
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-200/80 text-xs font-medium text-pink-700 hover:bg-stone-100 transition-colors"
                      >
                        Clear filters
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
                      <div key={appt.id} className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={thumb}
                              alt={appt.service_type}
                              className="w-10 h-10 rounded-lg object-cover border border-stone-200/80 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-stone-900 text-sm truncate">{appt.client_name}</div>
                              <div className="font-mono text-xs text-pink-700 font-medium truncate tabular-nums">
                                {appt.reference_code || 'No Ref'}
                              </div>
                            </div>
                          </div>
                          <StatusBadge status={appt.status} />
                        </div>

                        <div className="text-xs text-stone-600 space-y-1">
                          <div className="truncate">
                            <strong className="font-medium text-stone-800">{appt.service_type}</strong>
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
                            <a href={telHref} className="inline-flex items-center gap-1 text-pink-700 font-mono tabular-nums">
                              <Phone size={12} /> {appt.client_contact}
                            </a>
                          )}
                          {prep?.venue && (
                            <a
                              href={prep.mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-pink-700 font-medium min-w-0"
                            >
                              <MapPin size={12} className="shrink-0" />
                              <span className="truncate">{prep.venue}</span>
                              <ExternalLink size={11} className="shrink-0" />
                            </a>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200/70">
                          <select
                            value={appt.status}
                            onChange={(e) => requestStatusChange(appt, e.target.value)}
                            className="flex-1 min-w-0 max-w-[155px] text-xs border border-stone-200/80 rounded-lg px-2.5 min-h-9 bg-[#fdfcfa] focus:outline-none focus:border-pink-400"
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
                              className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-700 text-white px-3 min-h-9 rounded-lg shrink-0 whitespace-nowrap"
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

              {/* Desktop Table */}
              <div className="hidden md:block bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200/80 bg-[#f8f6f2]">
                        {['Service & Ref', 'Client & Contact', 'Schedule', 'Venue / Maps', 'Status', 'Reminder', 'Actions'].map((h) => (
                          <th
                            key={h}
                            className="text-left px-5 py-3.5 text-xs font-medium text-stone-500 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200/60">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-stone-400 text-sm">
                            Loading appointments...
                          </td>
                        </tr>
                      ) : pagedAppointments.items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-stone-500 text-sm">
                            <div className="space-y-3">
                              <p>{appointments.length === 0 ? 'No appointments yet.' : 'No bookings match your current filter.'}</p>
                              {appointments.length > 0 && (apptQuery || apptFilter !== 'all') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setApptQuery('')
                                    setApptFilter('all')
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-200/80 text-xs font-medium text-pink-700 hover:bg-stone-100 transition-colors"
                                >
                                  Clear filters
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
                            <tr key={appt.id} className="hover:bg-stone-100/60 transition-colors">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3 min-w-[200px]">
                                  <img
                                    src={thumb}
                                    alt={appt.service_type}
                                    className="w-11 h-11 rounded-lg object-cover border border-stone-200/80 shrink-0 bg-stone-100"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-medium text-stone-900 truncate max-w-[220px]">
                                      {appt.service_type}
                                    </div>
                                    <div className="font-mono text-xs text-pink-700 font-medium mt-0.5 tabular-nums">
                                      {appt.reference_code || '-'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <div className="font-medium text-stone-900">{appt.client_name}</div>
                                {telHref ? (
                                  <a
                                    href={telHref}
                                    className="inline-flex items-center gap-1 font-mono text-xs text-stone-500 hover:text-pink-700 mt-0.5 tabular-nums"
                                  >
                                    <Phone size={12} className="text-stone-400" />
                                    {appt.client_contact}
                                  </a>
                                ) : (
                                  <span className="text-xs text-stone-400">Not set</span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-xs text-stone-700 font-medium whitespace-nowrap tabular-nums">
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
                                    className="inline-flex items-center gap-1 text-pink-700 hover:text-pink-800 font-medium"
                                  >
                                    <MapPin size={12} />
                                    <span className="max-w-[160px] truncate">{prep.venue}</span>
                                    <ExternalLink size={11} />
                                  </a>
                                ) : (
                                  <span className="text-stone-400">Studio / not set</span>
                                )}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <StatusBadge status={appt.status} />
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap text-xs">
                                {appt.reminder_sent ? (
                                  <span className="text-emerald-700 font-medium">Sent</span>
                                ) : (
                                  <span className="text-stone-400">Pending</span>
                                )}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <select
                                    aria-label={`Change status for ${appt.client_name}`}
                                    value={appt.status}
                                    onChange={(e) => requestStatusChange(appt, e.target.value)}
                                    className="text-xs font-medium border border-stone-200/80 rounded-lg px-2.5 min-h-9 bg-[#fdfcfa] focus:outline-none focus:border-pink-400"
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
                                      className="inline-flex items-center gap-1 text-xs font-medium text-stone-700 hover:text-pink-700 border border-stone-200/80 hover:border-stone-300 bg-[#fdfcfa] hover:bg-stone-100 px-3 min-h-9 rounded-lg transition-colors"
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

          {activeTab === 'logs' && <ChatLogsTab chatLogs={chatLogs} onImported={fetchChatLogs} />}

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
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h1 className="text-lg sm:text-2xl font-semibold text-stone-900">Prep & Client Reminders</h1>
                <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                  Stay ahead of leave times and send 1-to-2-day confirmation messages with one click.
                </p>
              </div>

              {/* Owner alerts: a button, because browsers only show the permission prompt after a tap. */}
              {pushSupported() && pushConfigured() && ownerAlertStatus !== 'granted' && (
                <div className="bg-[#fdfcfa] rounded-2xl border border-pink-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900">Get booking alerts on this device</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Notify me when a client books, cancels or reschedules. Works on desktop and Android; on iPhone, add the site to your Home Screen first.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleEnableOwnerAlerts}
                    disabled={ownerAlertStatus === 'denied'}
                    className="text-xs font-medium bg-pink-600 hover:bg-pink-700 disabled:bg-stone-300 text-white px-4 min-h-9 rounded-lg transition-colors"
                  >
                    {ownerAlertStatus === 'denied' ? 'Blocked in browser settings' : 'Turn on alerts'}
                  </button>
                </div>
              )}
              {ownerAlertMessage && (
                <p className="text-xs text-stone-600 bg-[#f8f6f2] border border-stone-200/80 rounded-lg px-3 py-2">{ownerAlertMessage}</p>
              )}
              {reminderNotice && (
                <p
                  className={`text-xs rounded-lg px-3 py-2 border ${
                    reminderNotice.tone === 'ok'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {reminderNotice.text}
                </p>
              )}

              {/* Section 1: Owner 1-Day-Before Preparation Schedule */}
              <section className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs p-4 sm:p-6 space-y-4 sm:space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-sm sm:text-base text-stone-900 flex items-center gap-2">
                      <Clock size={18} strokeWidth={1.75} className="text-stone-500 shrink-0" />
                      Owner Preparation & Travel Schedule
                    </h2>
                    <p className="text-xs text-stone-500 mt-1">
                      Review call time, suggested leave buffer for venue traffic, and sync directly to Google Calendar.
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#f8f6f2] text-pink-700 border border-stone-200/80 shrink-0 tabular-nums">
                    {upcomingSchedule.length} upcoming active
                  </span>
                </div>

                {upcomingSchedule.length === 0 ? (
                  <div className="bg-[#f8f6f2] border border-dashed border-stone-200 rounded-xl p-6 sm:p-8 text-center text-sm text-stone-500">
                    No upcoming confirmed or rescheduled bookings yet.
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-3.5">
                    {upcomingSchedule.map(({ appt, prep, daysUntil }) => {
                      const isTomorrowOrToday = daysUntil === 0 || daysUntil === 1
                      return (
                        <div
                          key={`prep-${appt.id}`}
                          className={`rounded-xl border p-3.5 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 ${
                            isTomorrowOrToday ? 'border-pink-200 bg-rose-50/35' : 'border-stone-200/80 bg-[#fdfcfa]'
                          }`}
                        >
                          <div className="space-y-2 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <span className="font-semibold text-sm text-stone-900">{appt.client_name}</span>
                              <span className="text-xs font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md tabular-nums">
                                {appt.reference_code || 'No Ref'}
                              </span>
                              <span className="text-xs text-pink-700 font-medium">{appt.service_type}</span>
                              {daysUntil === 0 && (
                                <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                                  Today
                                </span>
                              )}
                              {daysUntil === 1 && (
                                <span className="text-xs font-medium bg-pink-600 text-white px-2 py-0.5 rounded-md">
                                  Tomorrow (1-Day Prep)
                                </span>
                              )}
                              {daysUntil != null && daysUntil > 1 && (
                                <span className="text-xs font-medium bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md tabular-nums">
                                  In {daysUntil} days
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs text-stone-600 pt-1">
                              <div className="min-w-0">
                                <span className="text-stone-400 block">Date & Call Time</span>
                                <span className="font-medium text-stone-900 tabular-nums">
                                  {prep.displayDate} at {prep.callTimeFormatted}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-stone-400 block">Suggested Leave Time</span>
                                <span className="font-semibold text-pink-700 tabular-nums">
                                  {prep.leaveTimeFormatted || '-'}
                                </span>
                                <span className="text-xs text-stone-400 block">{prep.prepLabel}</span>
                              </div>
                              <div className="col-span-2 sm:col-span-1 min-w-0">
                                <span className="text-stone-400 block">Event Location</span>
                                {prep.venue ? (
                                  <span className="font-medium text-stone-900 break-words">{prep.venue}</span>
                                ) : (
                                  <span className="text-stone-400">Studio / not specified</span>
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
                                className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 text-xs font-medium bg-[#fdfcfa] hover:bg-stone-100 text-stone-700 border border-stone-200/80 px-3 sm:px-3.5 min-h-9 rounded-lg transition-colors whitespace-nowrap"
                              >
                                <MapPin size={13} className="text-stone-500" />
                                Open in Maps
                              </a>
                            )}
                            {prep.calendarUrl && (
                              <a
                                href={prep.calendarUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-700 text-white px-3.5 sm:px-4 min-h-9 rounded-lg transition-colors shadow-xs whitespace-nowrap"
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
              <section className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs p-4 sm:p-6 space-y-4 sm:space-y-5">
                <div>
                  <h2 className="font-semibold text-sm sm:text-base text-stone-900 flex items-center gap-2">
                    <Bell size={18} strokeWidth={1.75} className="text-stone-500 shrink-0" />
                    Client 3-Day Reminders
                  </h2>
                  <p className="text-xs text-stone-500 mt-1">
                    Reminders go out automatically 3 days before each booking at 9:00 AM (Manila time) and appear in the client's chat. To send one now, press Send to Session. Copy Reminder Text is for SMS or Messenger. Mark sent only records a reminder you sent some other way. The 1-day reminder is still sent by hand.
                  </p>
                </div>

                {upcomingSchedule.length === 0 ? (
                  <div className="bg-[#f8f6f2] border border-dashed border-stone-200 rounded-xl p-6 sm:p-8 text-center text-sm text-stone-500">
                    No client reminders due right now.
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-3.5">
                    {upcomingSchedule.map(({ appt, daysUntil }) => {
                      const reminderText = buildClientReminderText(appt, bizName)
                      const copyId = `rem-${appt.id}`
                      const dueSoon = daysUntil != null && daysUntil <= 3
                      return (
                        <div key={copyId} className="rounded-xl border border-stone-200/80 p-3.5 sm:p-5 space-y-2.5 sm:space-y-3 bg-[#fdfcfa]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
                              <span className="font-semibold text-sm text-stone-900">{appt.client_name}</span>
                              {appt.client_contact && (
                                <span className="text-stone-500 font-mono tabular-nums">{appt.client_contact}</span>
                              )}
                              {dueSoon && !appt.reminder_sent && (
                                <span className="bg-pink-50 text-pink-700 border border-pink-200 font-medium px-2 py-0.5 rounded-md">
                                  Due for 3-day reminder
                                </span>
                              )}
                              {appt.reminder_sent ? (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium px-2 py-0.5 rounded-md">
                                  Sent
                                </span>
                              ) : (
                                <span className="text-stone-400">Not sent yet</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => handleCopyReminder(copyId, reminderText)}
                                className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 text-xs font-medium bg-[#f8f6f2] hover:bg-stone-100 text-stone-800 border border-stone-200/80 px-3 sm:px-3.5 min-h-9 rounded-lg transition-colors whitespace-nowrap"
                              >
                                {copiedKey === copyId ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                {copiedKey === copyId ? 'Copied Reminder' : 'Copy Reminder Text'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendSessionReminder(appt, reminderText)}
                                disabled={sendingReminderId === appt.id}
                                className="flex-1 sm:flex-none text-xs font-medium bg-pink-600 hover:bg-pink-700 disabled:bg-stone-300 text-white px-4 min-h-9 rounded-lg transition-colors shadow-xs whitespace-nowrap"
                              >
                                {sendingReminderId === appt.id
                                  ? 'Sending...'
                                  : appt.reminder_sent
                                    ? 'Resend to Session'
                                    : 'Send to Session'}
                              </button>
                              {!appt.reminder_sent && (
                                <button
                                  type="button"
                                  onClick={() => markReminderSent(appt.id)}
                                  className="flex-1 sm:flex-none text-xs font-medium bg-[#fdfcfa] hover:bg-stone-100 text-stone-600 border border-stone-200/80 px-3 min-h-9 rounded-lg transition-colors whitespace-nowrap"
                                >
                                  Mark sent only
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-stone-700 bg-[#f8f6f2] rounded-lg p-3 sm:p-3.5 border border-stone-200/80 whitespace-pre-wrap leading-relaxed break-words">
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#fdfcfa]/95 backdrop-blur-sm border-t border-stone-200/80 flex justify-around pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-1 z-40">
        {TABS.map((item) => {
          const badge = getTabBadge(item.id)
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-xs font-medium px-2 py-1 min-h-11 rounded-lg ${
                isActive ? 'text-pink-700' : 'text-stone-500'
              }`}
            >
              <item.icon size={18} strokeWidth={1.75} />
              <span>{item.shortLabel}</span>
              {badge && (
                <span className="absolute -top-0.5 right-0.5 w-2 h-2 rounded-full bg-pink-600" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Manual Booking Modal */}
      <NotificationPrompt
        storageKey="jal_owner_notif_snooze"
        title="Turn on booking alerts?"
        body="Get notified on this device when a client books, cancels or reschedules."
        onEnable={async () => {
          await enableOwnerAlerts()
          setOwnerAlertStatus(currentPermission())
        }}
      />
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

import { useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  MessageSquare,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react';
import {
  ActionTileButton,
  StatKpiCard,
  StatusBadge,
} from './OwnerPrimitives';
import {
  buildGoogleCalendarUrl,
  buildGoogleMapsUrl,
  computeOwnerPrepSummary,
  formatDisplayDate,
  formatDisplayTime,
  manilaTodayIso,
  toManilaDateTime,
} from '../../lib/calendarLinks';
import { buildCalendarDateMap, buildDashboardMetrics } from '../../lib/ownerInsights';
import {
  DEFAULT_ARTIST_PHOTO_URL,
  SHOWCASE_SERVICE_IMAGES,
} from '../../jalgorithm/config/business';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildCalendarCells(year, monthIndex) {
  const firstDow = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const prevMonthDays = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();

  const cells = [];
  for (let i = firstDow - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    const prevDate = new Date(Date.UTC(year, monthIndex - 1, day));
    cells.push({
      iso: prevDate.toISOString().slice(0, 10),
      day,
      inMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ iso, day, inMonth: true });
  }
  while (cells.length < 42) {
    const nextDay = cells.length - (firstDow + daysInMonth) + 1;
    const nextDate = new Date(Date.UTC(year, monthIndex + 1, nextDay));
    cells.push({
      iso: nextDate.toISOString().slice(0, 10),
      day: nextDate.getUTCDate(),
      inMonth: false,
    });
  }
  return cells;
}

export function DashboardHomeTab({
  appointments = [],
  chatLogs = [],
  catalog,
  setupWarnings = [],
  setupPercent = 100,
  upcomingSchedule = [],
  onOpenNewBooking,
  onNavigateTab,
  onOpenBusinessTab,
  onSelectDateSchedule,
}) {
  const todayIso = useMemo(() => manilaTodayIso(), []);
  const [selectedDate, setSelectedDate] = useState(todayIso);

  const [calCursor, setCalCursor] = useState(() => {
    const [y, m] = todayIso.split('-').map(Number);
    return { year: y, monthIndex: m - 1 };
  });

  const [copiedChatLink, setCopiedChatLink] = useState(false);

  const metrics = useMemo(
    () => buildDashboardMetrics(appointments, chatLogs, todayIso),
    [appointments, chatLogs, todayIso]
  );

  const calendarMap = useMemo(
    () => buildCalendarDateMap(appointments),
    [appointments]
  );

  const calendarCells = useMemo(
    () => buildCalendarCells(calCursor.year, calCursor.monthIndex),
    [calCursor.year, calCursor.monthIndex]
  );

  const serviceByKey = useMemo(() => {
    const map = {};
    for (const s of catalog?.services || []) {
      map[s.key] = s;
    }
    return map;
  }, [catalog]);

  const artistName = String(catalog?.business?.artist || catalog?.business?.name || 'Owner').trim();
  const greetingName = artistName.split(' ')[0] || 'Owner';
  const freeAreas = catalog?.business?.freeTravelAreas || ['Olongapo City', 'Subic Bay'];
  const bizName = catalog?.business?.name || 'JAL Beauty Studio';

  const recentBookings = useMemo(() => {
    const sorted = [...appointments].sort((a, b) => {
      const ta = Date.parse(a.appointment_date || a.created_at || '') || 0;
      const tb = Date.parse(b.appointment_date || b.created_at || '') || 0;
      return tb - ta;
    });
    return sorted.slice(0, 5);
  }, [appointments]);

  const daySchedule = useMemo(() => {
    const list = calendarMap[selectedDate] || [];
    return list.map((appt) => ({
      appt,
      prep: computeOwnerPrepSummary(appt, {
        freeTravelAreas: freeAreas,
        businessName: bizName,
      }),
    }));
  }, [calendarMap, selectedDate, freeAreas, bizName]);

  function stepMonth(delta) {
    setCalCursor((prev) => {
      const next = new Date(Date.UTC(prev.year, prev.monthIndex + delta, 1));
      return { year: next.getUTCFullYear(), monthIndex: next.getUTCMonth() };
    });
  }

  function handleCopyChatLink() {
    if (typeof window === 'undefined' || !navigator?.clipboard) return;
    navigator.clipboard.writeText(`${window.location.origin}/#book-chat`);
    setCopiedChatLink(true);
    setTimeout(() => setCopiedChatLink(false), 2000);
  }

  const timelineTintClasses = [
    'bg-[#f8f6f2] border-stone-200/80',
    'bg-[#fdfcfa] border-stone-200/80',
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 items-start">
      {/* Main Left Workspace */}
      <div className="xl:col-span-8 space-y-4 sm:space-y-6 min-w-0">
        {/* Contextual Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-gray-900 tracking-[-0.02em] truncate">
              {bizName} Overview
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 tabular-nums">
              {formatDisplayDate(todayIso)} | Signed in as {greetingName}
            </p>
          </div>

          {setupWarnings.length > 0 ? (
            <button
              type="button"
              onClick={() => onOpenBusinessTab(setupWarnings[0]?.tab || 'profile')}
              className="inline-flex items-center gap-2 min-h-9 px-3.5 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100/70 text-xs font-medium text-amber-800 transition-colors tabular-nums"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
              {setupWarnings.length} setup {setupWarnings.length === 1 ? 'item' : 'items'} left
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700 tabular-nums">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Studio profile 100% ready
            </span>
          )}
        </div>

        {/* 4 KPI Sparkline Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <StatKpiCard
            label="Total Bookings"
            value={metrics.totalBookings}
            badgeText={`${metrics.completionRate}% active`}
            sublabel="Across all recorded appointments"
            icon={Calendar}
            tone="rose"
            series={metrics.series.totalBookings}
            onClick={() => onNavigateTab('appointments')}
          />
          <StatKpiCard
            label="Confirmed"
            value={metrics.confirmedTotal}
            badgeText="Live schedule"
            sublabel="Confirmed and rescheduled sessions"
            icon={CheckCircle2}
            tone="emerald"
            series={metrics.series.confirmed}
            onClick={() => onNavigateTab('appointments')}
          />
          <StatKpiCard
            label="Reminders Due"
            value={metrics.remindersDueTotal}
            badgeText={metrics.remindersDueTotal > 0 ? 'Send soon' : 'All caught up'}
            sublabel="Upcoming within 3 days"
            icon={Bell}
            tone="amber"
            series={metrics.series.remindersDue}
            onClick={() => onNavigateTab('reminders')}
          />
          <StatKpiCard
            label="Important Leads"
            value={metrics.importantLeads}
            badgeText={
              metrics.attentionLeads > 0
                ? `${metrics.attentionLeads} need check`
                : 'Bot handled'
            }
            sublabel="Inquiry turns in Chat Logs"
            icon={MessageSquare}
            tone="sky"
            series={metrics.series.leads}
            onClick={() => onNavigateTab('logs')}
          />
        </div>

        {/* Quick Actions */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium text-gray-500">
              Quick actions
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            <ActionTileButton
              icon={CalendarPlus}
              label="New Booking"
              hint="Walk-in or Messenger"
              accent="rose"
              onClick={onOpenNewBooking}
            />
            <ActionTileButton
              icon={Wrench}
              label="Manage Services"
              hint="Rates, durations, photos"
              accent="sky"
              onClick={() => onOpenBusinessTab('services')}
            />
            <ActionTileButton
              icon={MessageSquare}
              label="Review Leads"
              hint="Client chat inquiries"
              accent="amber"
              onClick={() => onNavigateTab('logs')}
            />
            <ActionTileButton
              icon={copiedChatLink ? Check : Copy}
              label={copiedChatLink ? 'Link Copied' : 'Copy Chat Link'}
              hint="Share JAL booking link"
              accent="emerald"
              onClick={handleCopyChatLink}
            />
          </div>
        </section>

        {/* Recent Bookings Card */}
        <section className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-200/70 flex items-center justify-between gap-2.5 sm:gap-3">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-stone-900">Recent Bookings</h2>
              <p className="text-xs text-stone-500 mt-0.5 truncate">
                Latest client appointments with quick calendar actions
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('appointments')}
              className="min-h-9 px-3 sm:px-3.5 py-2 rounded-lg border border-stone-200/80 bg-[#f8f6f2] hover:bg-stone-100 text-xs font-medium text-pink-700 transition-colors shrink-0 whitespace-nowrap"
            >
              View All
            </button>
          </div>

          {recentBookings.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-gray-700">No bookings recorded yet</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Clients booking via the chatbot appear here automatically, or you can add a manual booking now.
              </p>
              <button
                type="button"
                onClick={onOpenNewBooking}
                className="inline-flex items-center gap-2 min-h-9 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-xs font-medium"
              >
                <CalendarPlus className="w-4 h-4" />
                Add First Booking
              </button>
            </div>
          ) : (
            <div className="divide-y divide-pink-50">
              {recentBookings.map((appt) => {
                const svc = serviceByKey[appt.service_key];
                const thumb =
                  svc?.imageUrl ||
                  SHOWCASE_SERVICE_IMAGES[appt.service_key] ||
                  DEFAULT_ARTIST_PHOTO_URL;
                const manila = toManilaDateTime(appt.appointment_date);
                const gcalUrl = buildGoogleCalendarUrl({
                  title: `${appt.service_type} - ${appt.client_name}`,
                  timestampIso: appt.appointment_date,
                  durationMinutes: appt.duration_minutes || 120,
                  location: appt.event_location || '',
                  description: `Ref: ${appt.reference_code || ''}\nMobile: ${appt.client_contact || ''}`,
                });

                return (
                  <div
                    key={appt.id}
                    className="px-3.5 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 hover:bg-stone-100/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                      <img
                        src={thumb}
                        alt={appt.service_type || 'Salon service'}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover border border-stone-200/80 shrink-0 bg-stone-100"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">
                          {appt.service_type}
                        </p>
                        <p className="text-xs font-mono text-stone-500 mt-0.5 truncate tabular-nums">
                          {appt.reference_code || 'NO-REF'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-6 text-xs">
                      <div className="min-w-0 sm:min-w-[120px]">
                        <p className="font-medium text-stone-800 truncate">{appt.client_name}</p>
                        <a
                          href={`tel:${appt.client_contact}`}
                          className="text-stone-500 hover:text-pink-700 transition-colors block truncate tabular-nums"
                        >
                          {appt.client_contact}
                        </a>
                      </div>

                      <div className="min-w-0 sm:min-w-[130px]">
                        <p className="font-medium text-stone-800 truncate tabular-nums">
                          {manila ? formatDisplayDate(manila.date) : '-'}
                        </p>
                        <p className="text-stone-500 truncate tabular-nums">
                          {manila ? formatDisplayTime(manila.time) : '-'}
                          {appt.duration_minutes ? ` · ${appt.duration_minutes}m` : ''}
                        </p>
                      </div>

                      <div className="col-span-2 sm:col-span-1 flex items-center justify-between sm:justify-end gap-2.5">
                        <StatusBadge status={appt.status} />
                        {gcalUrl ? (
                          <a
                            href={gcalUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Add to Google Calendar"
                            className="w-8 h-8 rounded-lg border border-stone-200/80 bg-[#fdfcfa] hover:bg-stone-100 text-stone-500 hover:text-pink-700 flex items-center justify-center"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Sticky Right Rail: Mini Calendar + Selected Day Schedule + Summary */}
      <aside className="xl:col-span-4 space-y-5 xl:sticky xl:top-24">
        {/* Monthly Mini Calendar */}
        <section className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs p-3.5 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-stone-900">
              {MONTH_NAMES[calCursor.monthIndex]} {calCursor.year}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => stepMonth(-1)}
                aria-label="Previous month"
                className="w-8 h-8 rounded-lg border border-pink-100 hover:bg-pink-50 text-gray-600 flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => stepMonth(1)}
                aria-label="Next month"
                className="w-8 h-8 rounded-lg border border-pink-100 hover:bg-pink-50 text-gray-600 flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="text-xs font-medium text-stone-400 py-1">
                {wd}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              const count = (calendarMap[cell.iso] || []).length;
              const isSelected = cell.iso === selectedDate;
              const isToday = cell.iso === todayIso;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedDate(cell.iso)}
                  className={`relative h-9 rounded-lg text-xs font-medium tabular-nums flex flex-col items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-pink-600 text-white'
                      : isToday
                        ? 'bg-pink-50 text-pink-700 border border-pink-200'
                        : cell.inMonth
                          ? 'text-stone-700 hover:bg-stone-100'
                          : 'text-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <span>{cell.day}</span>
                  {count > 0 ? (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                        isSelected ? 'bg-white' : 'bg-pink-600'
                      }`}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* Day Schedule Timeline */}
        <section className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs p-3.5 sm:p-5 space-y-3.5 sm:space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-stone-900 truncate">
                {selectedDate === todayIso ? "Today's Schedule" : `Schedule · ${formatDisplayDate(selectedDate)}`}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
                {daySchedule.length} active {daySchedule.length === 1 ? 'session' : 'sessions'}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onSelectDateSchedule
                  ? onSelectDateSchedule(selectedDate)
                  : onNavigateTab('reminders')
              }
              className="px-2.5 py-1.5 rounded-lg border border-stone-200/80 bg-[#f8f6f2] hover:bg-stone-100 text-xs font-medium text-pink-700 shrink-0 whitespace-nowrap"
            >
              View Full Schedule
            </button>
          </div>

          {daySchedule.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 bg-[#f8f6f2] p-5 text-center space-y-1.5">
              <Clock className="w-5 h-5 text-stone-400 mx-auto" strokeWidth={1.75} />
              <p className="text-xs font-medium text-stone-700">No bookings on this date</p>
              <p className="text-xs text-stone-500">
                Pick a marked date on the calendar or click New Booking.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {daySchedule.map(({ appt, prep }, idx) => {
                const tint = timelineTintClasses[idx % timelineTintClasses.length];
                const mapsUrl = prep?.venue ? buildGoogleMapsUrl(prep.venue) : null;
                return (
                  <div key={appt.id} className="flex items-stretch gap-2.5 sm:gap-3">
                    <div className="w-14 sm:w-16 shrink-0 pt-2 text-xs font-medium text-stone-500 tabular-nums">
                      {prep?.callTimeFormatted || '-'}
                    </div>
                    <div className={`flex-1 rounded-xl border p-3 min-w-0 ${tint}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-stone-900 truncate">
                          {appt.service_type}
                        </p>
                        <span className="text-xs font-mono text-stone-500 shrink-0 tabular-nums">
                          {appt.reference_code}
                        </span>
                      </div>
                      <p className="text-xs text-stone-700 mt-0.5 truncate">
                        {appt.client_name} · {appt.client_contact}
                      </p>
                      {prep?.venue ? (
                        <div className="flex items-center justify-between gap-2 mt-1.5 text-xs text-stone-600">
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-stone-500 shrink-0" />
                            {prep.venue}
                          </span>
                          {mapsUrl ? (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-pink-700 font-medium shrink-0 hover:underline"
                            >
                              Map
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Studio Summary 3-tile Footer */}
        <section className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs p-3.5 sm:p-5 space-y-2.5 sm:space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900">Studio Summary</h2>
            <span className="text-xs font-medium text-stone-500">Live status</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5 tabular-nums">
            <div className="rounded-xl bg-[#f8f6f2] border border-stone-200/80 p-2.5 sm:p-3 text-center">
              <p className="text-base sm:text-lg font-semibold text-stone-900">{setupPercent}%</p>
              <p className="text-xs font-medium text-stone-500 mt-0.5">Setup</p>
            </div>
            <div className="rounded-xl bg-[#f8f6f2] border border-stone-200/80 p-2.5 sm:p-3 text-center">
              <p className="text-base sm:text-lg font-semibold text-stone-900">{upcomingSchedule.length}</p>
              <p className="text-xs font-medium text-stone-500 mt-0.5">Upcoming</p>
            </div>
            <div className="rounded-xl bg-[#f8f6f2] border border-stone-200/80 p-2.5 sm:p-3 text-center">
              <p className="text-base sm:text-lg font-semibold text-pink-700">{metrics.remindersDueTotal}</p>
              <p className="text-xs font-medium text-stone-500 mt-0.5">Due Soon</p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}

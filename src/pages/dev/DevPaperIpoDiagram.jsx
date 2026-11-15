import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  BellRing,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Code2,
  Database,
  GitBranch,
  MessageSquare,
  Send,
  ShieldCheck,
} from 'lucide-react'

export default function DevPaperIpoDiagram({ catalog, engineStats, showTechDetails }) {
  const [selectedNodeId, setSelectedNodeId] = useState('p1')

  const settings = catalog?.settings || {}
  const servicesCount = catalog?.services?.length ?? 0

  const nodes = useMemo(
    () => ({
      i1: {
        id: 'i1',
        zone: 'INPUT',
        title: 'Customer Message',
        subtitle: 'Book / Reschedule / Cancel Request',
        icon: MessageSquare,
        tone: 'border-pink-200 bg-pink-50/60 text-pink-700',
        paperHeading: 'Input 1: Free-Text Customer Request',
        paperSummary:
          'Clients type naturally in English, Tagalog, or Taglish (for example: "pwde ba magpabook sa sabado 2pm?"). Unlike rigid menu-only bots, JAL accepts messy texting shortcuts, typos, and incomplete fragments.',
        paperBasis:
          'Section 2 & 3 of docs/JALGORITHM.md explain how raw input stays preserved while passing through token-level preprocessing and 4 ordered normalization passes.',
        liveFact: `Training dataset: ${engineStats?.trainingSize ?? 0} labeled examples across ${engineStats?.intentsCount ?? 0} intents`,
        files: ['app/src/pages/ChatPage.jsx', 'app/src/jalgorithm/pipeline/preprocess.js', 'app/src/jalgorithm/pipeline/normalizer.js'],
      },
      i2: {
        id: 'i2',
        zone: 'INPUT',
        title: 'Scheduling Database',
        subtitle: 'Available Slots and Existing Appointments',
        icon: Database,
        tone: 'border-sky-200 bg-sky-50/60 text-sky-700',
        paperHeading: 'Input 2: Live Salon Schedule & Business Rules',
        paperSummary:
          'Real-time salon services, pricing, operating hours, advance-notice rules, and active bookings stored in Supabase Postgres are fed into both the website and the Dialogue Manager.',
        paperBasis:
          'Separation of concerns: JAlgorithm never hardcodes salon availability or prices. All live facts come from business_profile, services, booking_settings, and appointments.',
        liveFact: `${servicesCount} active services | Hours ${settings.openTime || '08:00'} to ${settings.closeTime || '19:00'}`,
        files: ['app/src/services/businessInfo.js', 'app/src/services/appointments.js', 'app/supabase/setup_all.sql'],
      },
      p1: {
        id: 'p1',
        zone: 'PROCESS',
        title: 'Intent Classification',
        subtitle: 'Late Fusion NLU (Rules + NB + TF-IDF)',
        icon: GitBranch,
        tone: 'border-purple-200 bg-purple-50/70 text-purple-700',
        paperHeading: 'Process 1: Hybrid Intent Classification (No External LLM)',
        paperSummary:
          'Instead of sending prompts to a cloud LLM or local LM Studio server, JAlgorithm runs a deterministic Late Fusion formula in the browser: 0.45 Rules + 0.35 Multinomial Naive Bayes + 0.20 TF-IDF Cosine Similarity.',
        paperBasis:
          'Section 4 of docs/JALGORITHM.md details how out-of-domain guards, a 0.30 confidence threshold, and a 0.10 ambiguity window prevent guessing on unrelated chat.',
        liveFact: 'Latency: typically under 5ms locally with zero external API cost',
        files: ['app/src/jalgorithm/analyzer.js', 'app/src/jalgorithm/classifier/ensemble.js', 'app/src/jalgorithm/classifier/naiveBayes.js'],
      },
      p2: {
        id: 'p2',
        zone: 'PROCESS',
        title: 'Dialogue Manager / Database Check',
        subtitle: 'Slot Filling & Supabase RPC Validation',
        icon: ShieldCheck,
        tone: 'border-indigo-200 bg-indigo-50/70 text-indigo-700',
        paperHeading: 'Process 2: Finite-State Dialogue & Server Lock Check',
        paperSummary:
          'Tracks multi-step conversation memory (service, date, time, venue, name, mobile number, reference code) one missing item at a time, while calling Postgres SECURITY DEFINER RPCs to check real open slots and conflicts.',
        paperBasis:
          'Section 1 & 5 of docs/JALGORITHM.md explain how the engine never assumes an extracted slot is free; Postgres validates hours, advance days, overlap locks, and 24-hour cutoffs.',
        liveFact: `Min advance notice: ${settings.minAdvanceDays ?? 3} day(s) | Cutoff: ${settings.cutoffHours ?? 24}h`,
        files: ['app/src/jalgorithm/dialogue/manager.js', 'app/src/jalgorithm/dialogue/state.js', 'app/supabase/migrations/20261112_jalgorithm.sql'],
      },
      p3: {
        id: 'p3',
        zone: 'PROCESS',
        title: 'Confirmation',
        subtitle: 'Explicit Yes / No Review Before Write',
        icon: CheckCircle2,
        tone: 'border-amber-200 bg-amber-50/70 text-amber-700',
        paperHeading: 'Process 3: Summary Review & Atomic Write Confirmation',
        paperSummary:
          'Before any database write (`book`, `reschedule`, or `cancel`), JAL displays a structured summary and requires an explicit Yes/No reply (`oo`, `yes`, `sige` / `hindi`, `no`). Only after the RPC returns ok: true does JAL generate the booking code.',
        paperBasis:
          'Section 5 ("Confirmation") & Rule of Honest Replies: replies never claim an appointment is booked or cancelled unless Postgres committed the transaction.',
        liveFact: 'Atomic transaction lock prevents simultaneous double-booking races',
        files: ['app/src/jalgorithm/responder.js', 'app/src/jalgorithm/config/responses.js', 'app/src/components/ChatWidgets.jsx'],
      },
      p4: {
        id: 'p4',
        zone: 'PROCESS',
        title: 'Reminder Trigger',
        subtitle: 'Owner Prep & Client Reminder Scheduling',
        icon: BellRing,
        tone: 'border-rose-200 bg-rose-50/70 text-rose-700',
        paperHeading: 'Process 4: Appointment Persistence & Reminder Preparation',
        paperSummary:
          'Once confirmed, the appointment enters the active schedule queue where Owner Studio computes 1-day-before artist preparation alerts and 1-to-2-day client confirmation reminders in Asia/Manila time.',
        paperBasis:
          'Calendar & reminder helpers compute exact Manila day deltas (`daysUntilManila`) and call-time travel schedules for Vicky\'s Parlor / Trev Luna workflows.',
        liveFact: `Timezone anchored to ${settings.timezone || 'Asia/Manila'}`,
        files: ['app/src/lib/calendarLinks.js', 'app/src/pages/OwnerDashboard.jsx'],
      },
      o1: {
        id: 'o1',
        zone: 'OUTPUT',
        title: 'Confirmed / Rescheduled / Cancelled Appointment',
        subtitle: 'Saved Record with JAL-XXXXX Reference',
        icon: CalendarCheck,
        tone: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
        paperHeading: 'Output 1: Verified Appointment Record in Postgres',
        paperSummary:
          'Creates or updates the booking row in Supabase `appointments` with a unique `JAL-XXXXX` reference code, service key, duration, Manila timestamp, and venue.',
        paperBasis:
          'Protected by Row-Level Security and ownership verification (`jal_lookup` matches both reference code and normalized PH contact number `09XXXXXXXXX`).',
        liveFact: 'Protected against unauthorized lookup or out-of-hours inserts',
        files: ['app/supabase/setup_all.sql', 'app/src/services/appointments.js'],
      },
      o2: {
        id: 'o2',
        zone: 'OUTPUT',
        title: 'Confirmation Message to Customer',
        subtitle: 'Bilingual EN/FIL Box + Calendar & Maps Links',
        icon: Send,
        tone: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
        paperHeading: 'Output 2: Bilingual Non-Generative Template Reply',
        paperSummary:
          'JAL selects the matching English or Filipino/Taglish template with the exact database-confirmed reference, date, time, Add to Google Calendar button, Maps link, and optional Page Handoff card.',
        paperBasis:
          'Because JAL is non-generative, output grammar and rates stay 100% controlled with zero AI hallucination risk.',
        liveFact: 'Every reply key enforces placeholder parity between English & Filipino',
        files: ['app/src/jalgorithm/config/responses.js', 'app/src/components/ChatWidgets.jsx'],
      },
      o3: {
        id: 'o3',
        zone: 'OUTPUT',
        title: 'Automated Reminder Sent to Customer',
        subtitle: 'Client Confirmation Queue & Owner Prep Alerts',
        icon: BellRing,
        tone: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
        paperHeading: 'Output 3: Client & Owner Pre-Event Reminders',
        paperSummary:
          'Surfaces ready-to-send client confirmation templates and owner prep call-time checklists inside Owner Studio -> Reminders 1 to 2 days before the scheduled booking.',
        paperBasis:
          'Supports the salon\'s real beneficiary workflow where reminders prevent no-shows and confirm call time / travel buffer ahead of event day.',
        liveFact: 'Tracks reminder-sent timestamps cleanly inside Owner Studio',
        files: ['app/src/lib/calendarLinks.js', 'app/src/pages/OwnerDashboard.jsx'],
      },
    }),
    [engineStats?.intentsCount, engineStats?.trainingSize, servicesCount, settings.cutoffHours, settings.minAdvanceDays, settings.openTime, settings.closeTime, settings.timezone],
  )

  const active = nodes[selectedNodeId] || nodes.p1
  const ActiveIcon = active.icon

  const renderNodeButton = (node) => {
    const Icon = node.icon
    const isSelected = selectedNodeId === node.id
    return (
      <button
        key={node.id}
        type="button"
        onClick={() => setSelectedNodeId(node.id)}
        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
          isSelected
            ? 'bg-white border-pink-500 ring-2 ring-pink-300/60 shadow-sm'
            : `${node.tone} hover:bg-white hover:border-pink-300`
        }`}
      >
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 mt-0.5 text-gray-700">
            <Icon size={14} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-gray-900 leading-snug">{node.title}</div>
            <div className="text-[11px] text-gray-600 leading-snug mt-0.5">{node.subtitle}</div>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-5">
      {/* IPO Figure Card matching Thesis Paper Diagram */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-xs p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 border border-pink-200 flex items-center justify-center shrink-0">
              <BookOpen size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Paper Diagram 1: Input - Process - Output (IPO) Workflow
              </h3>
              <p className="text-xs text-gray-500">
                Direct visual model from your thesis paper (`docs/JALGORITHM.md`). Click any block to read its explanation below.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 items-stretch">
          {/* INPUT + PROCESS Column (Left 8 cols) */}
          <div className="col-span-8 flex flex-col gap-4">
            {/* INPUT Box */}
            <div className="rounded-2xl border-2 border-dashed border-pink-200 bg-rose-50/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-pink-600">
                  INPUT
                </span>
                <span className="text-[11px] text-gray-400">User Requests &amp; Live Salon Data</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {renderNodeButton(nodes.i1)}
                {renderNodeButton(nodes.i2)}
              </div>
            </div>

            {/* Downward flow connectors from Input -> Process */}
            <div className="grid grid-cols-2 px-12 text-pink-400">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <ArrowDown size={15} />
                <span>Feeds into Intent Classification</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold justify-end">
                <ArrowDown size={15} />
                <span>Feeds into Database Check</span>
              </div>
            </div>

            {/* PROCESS Box */}
            <div className="rounded-2xl border-2 border-purple-200 bg-purple-50/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-purple-700">
                  PROCESS
                </span>
                <span className="text-[11px] text-gray-400">In-Browser Engine + Server Validation</span>
              </div>
              <div className="grid grid-cols-4 gap-2 items-center">
                <div className="flex items-center gap-1.5">
                  <div className="flex-1">{renderNodeButton(nodes.p1)}</div>
                  <ArrowRight size={14} className="text-purple-400 shrink-0" />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1">{renderNodeButton(nodes.p2)}</div>
                  <ArrowRight size={14} className="text-purple-400 shrink-0" />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1">{renderNodeButton(nodes.p3)}</div>
                  <ArrowRight size={14} className="text-purple-400 shrink-0" />
                </div>
                <div>{renderNodeButton(nodes.p4)}</div>
              </div>
            </div>
          </div>

          {/* OUTPUT Column (Right 4 cols) */}
          <div className="col-span-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/20 p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700">
                OUTPUT
              </span>
              <span className="text-[11px] text-gray-400">Verified Results</span>
            </div>

            <div className="space-y-3 flex-1 flex flex-col justify-center">
              {renderNodeButton(nodes.o1)}
              {renderNodeButton(nodes.o2)}
              {renderNodeButton(nodes.o3)}
            </div>
          </div>
        </div>
      </div>

      {/* Paper-Aligned Deep Explanation Card */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-xs p-6 grid grid-cols-12 gap-6">
        <div className="col-span-7 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-pink-50 border border-pink-200 text-pink-600 flex items-center justify-center">
              <ActiveIcon size={17} />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-pink-500">
                {active.zone} Block Explanation
              </div>
              <h4 className="text-base font-bold text-gray-900">{active.paperHeading}</h4>
            </div>
          </div>

          <p className="text-xs text-gray-700 leading-relaxed bg-rose-50/35 border border-pink-100 rounded-xl p-4">
            {active.paperSummary}
          </p>

          <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 rounded-xl p-4">
            <strong className="text-gray-800">Thesis Rationale: </strong>
            {active.paperBasis}
          </p>
        </div>

        <div className="col-span-5 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Live System Verification
          </div>
          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            {active.liveFact}
          </div>

          {showTechDetails && (
            <div className="space-y-2 pt-2 border-t border-pink-100">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <Code2 size={12} />
                Code &amp; Database Implementation
              </div>
              <div className="space-y-1">
                {active.files.map((f) => (
                  <div
                    key={f}
                    className="font-mono text-[11px] text-gray-700 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg"
                  >
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

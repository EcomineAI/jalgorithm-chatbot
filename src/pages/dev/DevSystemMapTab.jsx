import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Brain,
  Code2,
  Cpu,
  Database,
  Globe,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { createJAlgorithm } from '../../jalgorithm/index.js'
import { CLASSIFIER_CONFIG } from '../../jalgorithm/config/intents.js'
import { useBusinessInfo } from '../../lib/useBusinessInfo.js'
import DevPaperIpoDiagram from './DevPaperIpoDiagram.jsx'

export default function DevSystemMapTab() {
  const { catalog } = useBusinessInfo()
  const [selectedId, setSelectedId] = useState('brain')
  const [showTechDetails, setShowTechDetails] = useState(false)

  const engineStats = useMemo(() => {
    const bot = createJAlgorithm({ catalog: catalog || undefined })
    return bot.stats || { intentsCount: 0, trainingSize: 0, intents: [] }
  }, [catalog])

  const biz = catalog?.business || {}
  const settings = catalog?.settings || {}
  const servicesCount = catalog?.services?.length ?? 0

  const nodes = useMemo(
    () => [
      {
        id: 'frontend',
        step: 'Step 1',
        title: 'User Screens',
        subtitle: 'Website, Client Chat, Owner & Dev Studio',
        icon: Globe,
        tone: 'bg-pink-50 border-pink-200 text-pink-700',
        activeRing: 'ring-2 ring-pink-400 border-pink-400',
        plainWhat:
          'Everything the customer and salon owner see runs smoothly inside a fast web app with 4 dedicated pages: Public Landing Site (/), Client Chatbot (/chat), Owner Studio (/owner), and this Localhost-Only Dev Studio (/dev).',
        plainWhy:
          'Separating Owner management and Localhost Dev tools keeps client pages fast and clutter-free while ensuring salon prices, hours, and photos stay synced everywhere.',
        liveMetrics: [
          `Salon: ${biz.name || "Vicky's Parlor"}`,
          `Active Services Loaded: ${servicesCount}`,
          'Localhost Lock: /dev blocked on public domains',
        ],
        techStack: ['React 18', 'Vite 6', 'Tailwind CSS v4', 'React Router v7', 'Lucide Icons'],
        files: [
          'app/src/App.jsx',
          'app/src/pages/LandingPage.jsx',
          'app/src/pages/ChatPage.jsx',
          'app/src/pages/OwnerDashboard.jsx',
          'app/src/pages/DevDebugPage.jsx',
        ],
      },
      {
        id: 'normalizer',
        step: 'Step 2',
        title: 'Taglish Cleanup & Entities',
        subtitle: 'Normalizer & Keyword Extractor',
        icon: Sparkles,
        tone: 'bg-rose-50 border-rose-200 text-rose-700',
        activeRing: 'ring-2 ring-rose-400 border-rose-400',
        plainWhat:
          'Before guessing what the client means, JAL cleans texting shortcuts, typos, and Taglish phrases (like "hm", "pwde", "bukas"), then pulls out key details: which service, target date, time, contact number, and JAL-XXXXX reference code.',
        plainWhy:
          'Real clients rarely type perfect English. Normalizing slang and catching dates/services upfront helps JAL respond accurately even on casual Taglish messages.',
        liveMetrics: [
          `Timezone: ${settings.timezone || 'Asia/Manila'}`,
          `Dynamic Catalog Keywords: ${servicesCount} services`,
          'Supported Languages: English, Filipino, Taglish',
        ],
        techStack: ['Pure JS Text Pipeline', 'Deterministic Tokenizer', 'Fuzzy Dictionary Match', 'Date/Time & Phone Parser'],
        files: [
          'app/src/jalgorithm/pipeline/preprocess.js',
          'app/src/jalgorithm/pipeline/normalizer.js',
          'app/src/jalgorithm/entities/index.js',
          'app/src/jalgorithm/config/lexicon.js',
        ],
      },
      {
        id: 'brain',
        step: 'Step 3',
        title: 'JAL Brain (No External AI)',
        subtitle: `${Math.round(CLASSIFIER_CONFIG.weights.rules * 100)}% Rules + ${Math.round(CLASSIFIER_CONFIG.weights.naiveBayes * 100)}% NB + ${Math.round(CLASSIFIER_CONFIG.weights.tfidf * 100)}% TF-IDF`,
        icon: Brain,
        tone: 'bg-purple-50 border-purple-200 text-purple-700',
        activeRing: 'ring-2 ring-purple-400 border-purple-400',
        plainWhat:
          'JAlgorithm scores every message using three lightweight models inside your browser, blends their votes together (Late Fusion), and manages multi-step booking memory (service -> date -> time -> venue -> name -> contact -> confirm).',
        plainWhy:
          'Unlike ChatGPT or external LLM APIs, JAlgorithm is 100% deterministic, works offline with zero monthly AI API bills, never hallucinates salon prices, and replies in a few milliseconds.',
        liveMetrics: [
          `Total Intents: ${engineStats.intentsCount}`,
          `Training Phrases: ${engineStats.trainingSize}`,
          `Confidence Threshold: ${Math.round(CLASSIFIER_CONFIG.minConfidence * 100)}%`,
        ],
        techStack: [
          `Rule Classifier (${CLASSIFIER_CONFIG.weights.rules})`,
          `Multinomial Naive Bayes (${CLASSIFIER_CONFIG.weights.naiveBayes})`,
          `TF-IDF Cosine Similarity (${CLASSIFIER_CONFIG.weights.tfidf})`,
          'Finite-State Dialogue Manager',
        ],
        files: [
          'app/src/jalgorithm/analyzer.js',
          'app/src/jalgorithm/classifier/ensemble.js',
          'app/src/jalgorithm/dialogue/manager.js',
          'app/src/jalgorithm/data/training.js',
        ],
      },
      {
        id: 'database',
        step: 'Step 4',
        title: 'Security & Database',
        subtitle: 'Supabase Postgres, RPC Locks & Split Logs',
        icon: Database,
        tone: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        activeRing: 'ring-2 ring-emerald-400 border-emerald-400',
        plainWhat:
          'When checking slots or saving a booking, the database itself verifies salon hours, advance-notice rules, double-booking locks, and 24-hour cutoffs before replying "booked". Chat logs are split cleanly so spam/test noise stays out of Owner Studio.',
        plainWhy:
          'Putting booking rules inside Postgres prevents hacked browsers or double-clicks from creating fake or overlapping bookings, and keeps both log tables under 1,000 rows.',
        liveMetrics: [
          `Advance Rule: >= ${settings.minAdvanceDays ?? 3} days ahead`,
          `Hours: ${settings.openTime || '08:00'} to ${settings.closeTime || '19:00'}`,
          'Split Tables: chat_logs vs dev_chat_logs (1,000-row cap)',
        ],
        techStack: ['Supabase Postgres', 'SECURITY DEFINER RPCs (jal_*)', 'Row-Level Security (is_owner)', 'Supabase Storage (salon-media)'],
        files: [
          'app/supabase/setup_all.sql',
          'app/src/services/appointments.js',
          'app/src/services/businessInfo.js',
          'app/src/services/devLogs.js',
        ],
      },
    ],
    [biz.name, engineStats.intentsCount, engineStats.trainingSize, servicesCount, settings.closeTime, settings.minAdvanceDays, settings.openTime, settings.timezone],
  )

  const activeNode = nodes.find((n) => n.id === selectedId) || nodes[0]

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-xs p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-900 text-pink-300 flex items-center justify-center shrink-0">
            <Layers size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              System Map &amp; Paper Architecture (Localhost Only)
            </h2>
            <p className="text-xs text-gray-500">
              Click any box in the Paper IPO workflow or architecture layers below to read thesis-aligned explanations. Switch to Animated NLU Flow for the moving NLU pipeline.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowTechDetails((v) => !v)}
          className={`inline-flex items-center gap-2 px-3.5 min-h-[38px] rounded-xl text-xs font-semibold border transition-colors ${
            showTechDetails
              ? 'bg-gray-900 text-pink-300 border-gray-900'
              : 'bg-white text-gray-700 border-pink-200 hover:bg-pink-50'
          }`}
        >
          <Code2 size={14} />
          {showTechDetails ? 'Hide Tech & File Details' : 'Show Tech & File Details'}
        </button>
      </div>

      {/* Separated Paper IPO Diagram + Explanations */}
      <DevPaperIpoDiagram
        catalog={catalog}
        engineStats={engineStats}
        showTechDetails={showTechDetails}
      />

      {/* Interactive 4-Layer System Architecture */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              System Architecture Layers (Tech Stack &amp; Separation of Concerns)
            </h3>
            <p className="text-xs text-gray-500">
              How React, JAlgorithm (browser JS), and Supabase Postgres separate UI, language understanding, and server-enforced rules.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 items-stretch">
          {nodes.map((node, index) => {
            const Icon = node.icon
            const isSelected = node.id === selectedId
            return (
              <div key={node.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedId(node.id)}
                  className={`flex-1 h-full text-left p-4 rounded-2xl border transition-all space-y-2 ${
                    isSelected
                      ? `bg-white shadow-sm ${node.activeRing}`
                      : 'bg-rose-50/20 border-pink-100 hover:bg-white hover:border-pink-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {node.step}
                    </span>
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${node.tone}`}>
                      <Icon size={14} />
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-900">{node.title}</div>
                  <div className="text-[11px] text-gray-500 leading-snug">{node.subtitle}</div>
                </button>
                {index < nodes.length - 1 && (
                  <ArrowRight size={16} className="text-pink-300 shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected Stage Deep-Dive */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-7 bg-white rounded-2xl border border-pink-100 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${activeNode.tone}`}>
              <activeNode.icon size={17} />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-pink-500">
                {activeNode.step} Explained Simply
              </div>
              <h3 className="text-base font-bold text-gray-900">{activeNode.title}</h3>
            </div>
          </div>

          <div className="space-y-3 text-xs leading-relaxed">
            <div className="p-4 rounded-xl bg-rose-50/40 border border-pink-100 space-y-1">
              <div className="font-bold text-gray-900">What happens here</div>
              <p className="text-gray-600">{activeNode.plainWhat}</p>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
              <div className="font-bold text-gray-900">Why we built it this way</div>
              <p className="text-gray-600">{activeNode.plainWhy}</p>
            </div>
          </div>
        </div>

        <div className="col-span-5 bg-white rounded-2xl border border-pink-100 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
            <Cpu size={15} className="text-pink-500" />
            Live System Readings
          </div>

          <ul className="space-y-2 text-xs text-gray-700">
            {activeNode.liveMetrics.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50/30 border border-pink-100"
              >
                <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Technologies Used in This Layer
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeNode.techStack.map((tech) => (
                <span
                  key={tech}
                  className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-semibold"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {showTechDetails && (
            <div className="space-y-2 pt-2 border-t border-pink-100">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <Lock size={12} />
                Source Files
              </div>
              <div className="space-y-1">
                {activeNode.files.map((filePath) => (
                  <div
                    key={filePath}
                    className="font-mono text-[11px] text-gray-700 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg"
                  >
                    {filePath}
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

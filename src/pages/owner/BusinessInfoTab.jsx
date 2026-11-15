import { useEffect, useState } from 'react'
import {
  Store,
  Scissors,
  Clock,
  Plus,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Sparkles,
  RotateCcw,
  MapPin,
  ShieldCheck,
  Pencil,
  X,
  Image as ImageIcon,
  Upload,
  Trash2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { businessInfo, loadCatalogOnce } from '../../lib/useBusinessInfo.js'
import { supabase } from '../../lib/supabase.js'
import { uploadSalonImage, sanitizeImageUrl } from '../../lib/mediaUpload.js'
import {
  BENEFICIARY_PRESET_TREV_LUNA,
  DEFAULT_PRESET,
  DEFAULT_HERO_PHOTO_URL,
  DEFAULT_ARTIST_PHOTO_URL,
  SHOWCASE_GALLERY_URLS,
  SHOWCASE_SERVICE_IMAGES,
} from '../../jalgorithm/config/business.js'
import { serviceKeyFromName, SAVE_ERRORS } from '../../services/businessInfo.js'
import {
  PRICE_MODE_OPTIONS,
  splitDurationMinutes,
  formatDuration,
  formatServicePrice,
  checkSetupWarnings,
  computeProfileCompletion,
} from '../../lib/ownerInsights.js'
import {
  ConfirmModal,
  PrimaryButton,
  SecondaryButton,
  SettingsCard,
  StatusBadge,
} from '../../components/owner/OwnerPrimitives.jsx'

const WORKSPACE_TABS = [
  { id: 'profile', label: 'Salon Profile & Photos', icon: Store },
  { id: 'services', label: 'Services & Portfolio', icon: Scissors },
  { id: 'hours', label: 'Hours & Booking Rules', icon: Clock },
  { id: 'policies', label: 'Travel, Extra Heads & Policies', icon: ShieldCheck },
]

export function normalizeBusinessSectionTab(tab) {
  switch (tab) {
    case 'profile':
    case 'overview':
    case 'branding':
    case 'contact':
      return 'profile'
    case 'services':
    case 'media':
      return 'services'
    case 'hours':
      return 'hours'
    case 'policies':
    case 'travel':
      return 'policies'
    default:
      return 'profile'
  }
}

const EXPERIENCE_PRESETS = [
  { value: '1-2 yrs', label: '1 to 2 years' },
  { value: '3-4 yrs', label: '3 to 4 years' },
  { value: '5+ yrs', label: '5+ years' },
  { value: '8+ yrs', label: '8+ years' },
  { value: '10+ yrs', label: '10+ years' },
]

const SPECIALTY_SUGGESTIONS = [
  'Bridal',
  'Debut',
  'Special Events',
  'Everyday Glam',
  'Hairstyling',
  'On-Location',
  'Studio',
  'Entourage',
  'Pageant',
  'Graduation / Prom',
]

const PAYMENT_SUGGESTIONS = ['GCash', 'Maya', 'Bank Transfer', 'Cash', 'Credit / Debit Card']

const FREE_AREA_SUGGESTIONS = [
  'Olongapo City',
  'Subic Bay',
  'Barretto',
  'Subic',
  'Castillejos',
]

const OUT_OF_TOWN_SUGGESTIONS = [
  'Zambales',
  'Clark',
  'Castillejos',
  'San Antonio',
  'San Marcelino',
  'Iba',
  'Bataan',
  'Pampanga',
  'Metro Manila',
]

const TRAVEL_NOTE_PRESETS = [
  {
    value:
      'Subic Bay is already inclusive in packages. Out-of-town fees apply for Zambales areas and Clark depending on distance, toll fees, car rental, gas, and driver. Message our page for an exact transpo quote.',
    label: 'Subic Bay free; Zambales & Clark quoted by distance/toll/driver',
  },
  {
    value:
      'Olongapo City travel is free. Outside Olongapo, transportation fee depends on exact venue distance and toll fees.',
    label: 'Olongapo free; out-of-town quoted by distance',
  },
  {
    value: 'Transportation / out-of-town fee is confirmed on our Page after checking your venue address.',
    label: 'Confirm venue travel fee via Page inquiry',
  },
]

const EXTRA_HEAD_PRESETS = [
  { value: '', label: 'Not set / quote on inquiry' },
  { value: '500', label: 'PHP 500 per head' },
  { value: '800', label: 'PHP 800 per head' },
  { value: '1000', label: 'PHP 1,000 per head' },
  { value: '1200', label: 'PHP 1,200 per head' },
  { value: '1500', label: 'PHP 1,500 per head' },
]

const WEDDING_DP_PRESETS = [
  { value: '', label: 'Not specified' },
  { value: '20', label: '20% down payment' },
  { value: '30', label: '30% down payment' },
  { value: '40', label: '40% down payment' },
  { value: '50', label: '50% down payment' },
]

const WEDDING_CUTOFF_PRESETS = [
  { value: '', label: 'Not specified' },
  { value: '7', label: '7 days (1 week before)' },
  { value: '14', label: '14 days (2 weeks before)' },
  { value: '30', label: '30 days (1 month before)' },
  { value: '45', label: '45 days before' },
  { value: '60', label: '60 days (2 months before)' },
]

const EVENT_DP_PRESETS = [
  { value: '', label: 'Not specified' },
  { value: '10% to 20%', label: '10% to 20% reservation fee' },
  { value: '20%', label: '20% reservation fee' },
  { value: '30%', label: '30% reservation fee' },
  { value: 'PHP 500', label: 'Fixed PHP 500 reservation fee' },
  { value: 'PHP 1,000', label: 'Fixed PHP 1,000 reservation fee' },
]

const EVENT_CUTOFF_PRESETS = [
  { value: '', label: 'Not specified' },
  { value: '1', label: '1 day (24 hours before)' },
  { value: '3', label: '3 days before' },
  { value: '5', label: '5 days before' },
  { value: '7', label: '7 days before' },
]

const CONSULTATION_PRESETS = [
  { value: '', label: 'Free / none on record' },
  { value: '300', label: 'PHP 300' },
  { value: '500', label: 'PHP 500' },
  { value: '1000', label: 'PHP 1,000' },
]

const RESERVATION_FEE_PRESETS = [
  { value: '0', label: 'None (PHP 0)' },
  { value: '500', label: 'PHP 500' },
  { value: '1000', label: 'PHP 1,000' },
  { value: '1500', label: 'PHP 1,500' },
  { value: '2000', label: 'PHP 2,000' },
]

const RUSH_NOTE_PRESETS = [
  {
    value:
      'Same-day / rush bookings may still be accepted depending on team schedule, at a slightly higher rush rate. Message our page directly for urgent availability.',
    label: 'Accept rush bookings if team is free (adjusted rush rate)',
  },
  {
    value: 'Strict advance booking only; please check with us on our Page for urgent requests.',
    label: 'Strict advance booking (inquire on Page for exceptions)',
  },
]

const ADVANCE_DAY_PRESETS = [
  { value: '0', label: 'Same day allowed (0 days)' },
  { value: '1', label: 'At least 1 day ahead' },
  { value: '3', label: 'At least 3 days ahead' },
  { value: '5', label: 'At least 5 days ahead' },
  { value: '7', label: 'At least 7 days ahead (1 week)' },
  { value: '14', label: 'At least 14 days ahead (2 weeks)' },
]

const CUTOFF_HOUR_PRESETS = [
  { value: '12', label: '12 hours before' },
  { value: '24', label: '24 hours (1 day before)' },
  { value: '48', label: '48 hours (2 days before)' },
  { value: '72', label: '72 hours (3 days before)' },
  { value: '168', label: '168 hours (7 days before)' },
]

const SLOT_INTERVAL_PRESETS = [
  { value: '30', label: 'Every 30 minutes' },
  { value: '60', label: 'Every 1 hour (60 mins)' },
  { value: '90', label: 'Every 1 hr 30 mins (90 mins)' },
  { value: '120', label: 'Every 2 hours (120 mins)' },
]

const DURATION_HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i)
const DURATION_MINUTE_OPTIONS = [0, 15, 30, 45]

const listToText = (arr) => (arr ?? []).join(', ')
const textToList = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
const blankToNull = (s) => (String(s ?? '').trim() === '' ? null : String(s).trim())

function buildProfileForm(profile) {
  return {
    name: profile.name ?? '',
    artist: profile.artist ?? '',
    location: profile.location ?? '',
    experience_years: profile.experience_years ?? '5+ yrs',
    about_bio: profile.about_bio ?? '',
    specialty_tags: listToText(profile.specialty_tags),
    contact: profile.contact ?? '',
    messenger_url: profile.messenger_url ?? '',
    portfolio_url: profile.portfolio_url ?? '',
    payment_methods: profile.payment_methods ?? '',
    consultation_fee: profile.consultation_fee != null ? String(profile.consultation_fee) : '',
    free_travel_areas: listToText(profile.free_travel_areas),
    travel_areas: listToText(profile.travel_areas),
    travel_fee_note: profile.travel_fee_note ?? '',
    additional_head_price: profile.additional_head_price != null ? String(profile.additional_head_price) : '',
    additional_head_note: profile.additional_head_note ?? '',
    reservation_fee: String(profile.reservation_fee ?? 0),
    reservation_fee_services: profile.reservation_fee_services ?? [],
    wedding_downpayment_percent:
      profile.wedding_downpayment_percent != null ? String(profile.wedding_downpayment_percent) : '',
    wedding_cancel_cutoff_days:
      profile.wedding_cancel_cutoff_days != null ? String(profile.wedding_cancel_cutoff_days) : '',
    event_downpayment_percent: profile.event_downpayment_percent ?? '',
    event_cancel_cutoff_days:
      profile.event_cancel_cutoff_days != null ? String(profile.event_cancel_cutoff_days) : '',
    same_day_rush_note: profile.same_day_rush_note ?? '',
    hero_photo_url: profile.hero_photo_url ?? '',
    artist_photo_url: profile.artist_photo_url ?? '',
  }
}

export default function BusinessInfoTab({ requestedSubTab = null, onWarningsChanged = null }) {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [version, setVersion] = useState(0)
  const [activeWorkspace, setActiveWorkspace] = useState(() =>
    normalizeBusinessSectionTab(requestedSubTab || 'profile'),
  )
  const [presetState, setPresetState] = useState({ busy: false, ok: null, message: '' })
  const [pendingPreset, setPendingPreset] = useState(null)

  useEffect(() => {
    if (requestedSubTab) {
      setActiveWorkspace(normalizeBusinessSectionTab(requestedSubTab))
    }
  }, [requestedSubTab])

  async function reload({ bump = false } = {}) {
    const rows = await businessInfo.loadOwnerData()
    if (rows.error) {
      setLoadError(rows.error)
    } else {
      setLoadError(null)
      setData(rows)
      onWarningsChanged?.(checkSetupWarnings(rows))
      if (bump) setVersion((v) => v + 1)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  async function runApplyPreset(preset) {
    setPresetState({ busy: true, ok: null, message: '' })
    const res = await businessInfo.applyPreset(preset, data?.services ?? [])
    setPendingPreset(null)
    if (res.ok) {
      loadCatalogOnce({ refresh: true })
      await reload({ bump: true })
      setPresetState({
        busy: false,
        ok: true,
        message: res.localExtended
          ? `Loaded "${preset.label}". Core fields saved to Supabase; extended fields are cached locally until all SQL migrations are run.`
          : `Loaded "${preset.label}" and updated the live site and chatbot.`,
      })
    } else {
      setPresetState({
        busy: false,
        ok: false,
        message: res.error || 'Failed to load starter template.',
      })
    }
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-6 flex items-start gap-3">
        <AlertCircle size={18} className="text-rose-500 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <div className="font-semibold text-sm text-gray-900">Could not load salon information</div>
          <p className="text-xs text-gray-600">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-pink-100 p-10 flex items-center justify-center gap-2.5 text-sm text-gray-500">
        <Loader2 size={18} className="animate-spin text-pink-500" />
        Loading your salon profile and catalog...
      </div>
    )
  }

  const warnings = checkSetupWarnings(data)
  const completion = computeProfileCompletion(data)

  return (
    <div className="space-y-6">
      {/* Header + Completion Readiness Banner */}
      <div className="bg-white rounded-2xl border border-pink-100/90 shadow-sm p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Business Studio Settings</h2>
            <p className="text-sm text-gray-500 mt-1">
              Update your salon identity, services, hours, and booking policies. All changes sync immediately to your public website and JAL chatbot.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-rose-50/70 border border-pink-100 rounded-2xl px-4 py-3 shrink-0">
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Profile Readiness
              </p>
              <p className="text-lg font-bold text-pink-600">{completion.percentage}% Ready</p>
            </div>
            <div className="w-24 h-2.5 rounded-full bg-pink-100 overflow-hidden">
              <div
                className="h-full bg-pink-500 rounded-full transition-all"
                style={{ width: `${completion.percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* 4 Clean Workspace Tabs */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-pink-100/70">
          {WORKSPACE_TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeWorkspace === tab.id
            const tabWarnings = warnings.filter((w) => normalizeBusinessSectionTab(w.tab) === tab.id)
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveWorkspace(tab.id)}
                className={`inline-flex items-center gap-2 px-4 min-h-[42px] rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                  active
                    ? 'bg-pink-500 border-pink-500 text-white shadow-sm shadow-pink-500/20'
                    : 'bg-white border-pink-100 text-gray-700 hover:border-pink-300 hover:bg-rose-50/40'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tabWarnings.length > 0 && (
                  <span
                    className={`w-2 h-2 rounded-full ${active ? 'bg-white' : 'bg-amber-400'}`}
                    title={`${tabWarnings.length} item${tabWarnings.length === 1 ? '' : 's'} to review`}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Actionable Warnings Bar (when warnings exist) */}
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-800">
              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              <span>
                {warnings[0].title}: {warnings[0].detail}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveWorkspace(normalizeBusinessSectionTab(warnings[0].tab))}
              className="text-xs font-bold text-pink-600 hover:underline shrink-0"
            >
              Fix in {WORKSPACE_TABS.find((t) => t.id === normalizeBusinessSectionTab(warnings[0].tab))?.label}
            </button>
          </div>
        )}
      </div>

      {/* Workspace 1: Salon Profile & Photos */}
      {activeWorkspace === 'profile' && (
        <ProfileWorkspace
          key={`profile-${version}`}
          profile={data.profile}
          presetState={presetState}
          onRequestPreset={(preset) => setPendingPreset(preset)}
          onSaved={reload}
        />
      )}

      {/* Workspace 2: Services & Portfolio */}
      {activeWorkspace === 'services' && (
        <ServicesAndPortfolioWorkspace
          key={`services-${version}`}
          profile={data.profile}
          services={data.services}
          onSaved={reload}
        />
      )}

      {/* Workspace 3: Hours & Booking Rules */}
      {activeWorkspace === 'hours' && (
        <HoursSection key={`hours-${version}`} settings={data.settings} onSaved={reload} />
      )}

      {/* Workspace 4: Travel, Extra Heads & Policies */}
      {activeWorkspace === 'policies' && (
        <PoliciesAndTravelWorkspace
          key={`policies-${version}`}
          profile={data.profile}
          services={data.services}
          onSaved={reload}
        />
      )}

      <ConfirmModal
        open={Boolean(pendingPreset)}
        title="Apply Starter Template?"
        description={
          pendingPreset
            ? `Loading "${pendingPreset.label}" will update your studio profile, bio, policies, and default services. You can customize every detail afterward.`
            : ''
        }
        confirmLabel="Apply Template"
        tone="primary"
        busy={presetState.busy}
        onCancel={() => setPendingPreset(null)}
        onConfirm={() => pendingPreset && runApplyPreset(pendingPreset)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Workspace 1: Salon Profile, Photos, Contact & Templates
// ---------------------------------------------------------------------------
function ProfileWorkspace({ profile, presetState, onRequestPreset, onSaved }) {
  const [form, setForm] = useState(() => buildProfileForm(profile))
  const save = useSaver(onSaved)
  const setField = (k, val) => setForm((prev) => ({ ...prev, [k]: val }))
  const set = (k) => (e) => setField(k, e.target.value)

  function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.artist.trim() || !form.location.trim()) {
      return save.fail('Business name, artist name, and base location are required.')
    }
    save.run(() =>
      businessInfo.saveProfile({
        name: form.name.trim(),
        artist: form.artist.trim(),
        location: form.location.trim(),
        experience_years: blankToNull(form.experience_years),
        about_bio: blankToNull(form.about_bio),
        specialty_tags: textToList(form.specialty_tags),
        contact: blankToNull(form.contact),
        messenger_url: blankToNull(form.messenger_url),
        portfolio_url: blankToNull(form.portfolio_url),
        payment_methods: blankToNull(form.payment_methods),
        hero_photo_url: blankToNull(sanitizeImageUrl(form.hero_photo_url) || form.hero_photo_url),
        artist_photo_url: blankToNull(sanitizeImageUrl(form.artist_photo_url) || form.artist_photo_url),
      }),
    )
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <SettingsCard
        title="Brand Identity & Showcase Photos"
        description="Your hero banner and artist portrait appear at the top of your website and chat header."
        badge="Website & Chatbot"
      >
        <div className="grid lg:grid-cols-2 gap-5">
          <MediaPickerField
            label="Hero Banner Photo"
            hint="Wide landscape photo works best behind the headline."
            value={form.hero_photo_url}
            fallbackPreview={DEFAULT_HERO_PHOTO_URL}
            folder="hero"
            disabled={save.busy}
            onChange={(url) => setField('hero_photo_url', url)}
            aspectClass="w-36 h-24"
          />
          <MediaPickerField
            label="Artist Portrait / Avatar"
            hint="Shown on your profile badge, About section, and service fallback."
            value={form.artist_photo_url}
            fallbackPreview={DEFAULT_ARTIST_PHOTO_URL}
            folder="artist"
            disabled={save.busy}
            onChange={(url) => setField('artist_photo_url', url)}
            aspectClass="w-24 h-24"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          <Field
            label="Business / Salon name"
            value={form.name}
            onChange={set('name')}
            disabled={save.busy}
            required
          />
          <Field
            label="Artist / Owner name"
            value={form.artist}
            onChange={set('artist')}
            disabled={save.busy}
            required
          />
          <Field
            label="Base location"
            value={form.location}
            onChange={set('location')}
            disabled={save.busy}
            required
            hint="Shown on your website and when clients ask where you are based"
          />
          <PresetSelectField
            label="Years of experience"
            value={form.experience_years}
            options={EXPERIENCE_PRESETS}
            onChange={(v) => setField('experience_years', v)}
            disabled={save.busy}
            placeholder="e.g. 5+ yrs"
          />
          <div className="sm:col-span-2">
            <ChipMultiPicker
              label="Specialty tags"
              value={form.specialty_tags}
              suggestions={SPECIALTY_SUGGESTIONS}
              onChange={(v) => setField('specialty_tags', v)}
              disabled={save.busy}
              placeholder="Click chips or type custom tags separated by commas..."
            />
          </div>
          <TextAreaField
            label="About the Artist / Bio"
            value={form.about_bio}
            onChange={set('about_bio')}
            disabled={save.busy}
            className="sm:col-span-2"
            rows={3}
            placeholder="Describe your experience, approach, and specializations..."
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Contact Links & Payment Methods"
        description="Shared by JAL when clients confirm bookings or ask how to pay."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Mobile / Contact details"
            value={form.contact}
            onChange={set('contact')}
            disabled={save.busy}
            placeholder="e.g. 09XX XXX XXXX or Studio phone"
          />
          <Field
            label="Facebook / Messenger link"
            value={form.messenger_url}
            onChange={set('messenger_url')}
            disabled={save.busy}
            placeholder="https://m.me/..."
            hint="Clients see a direct Confirm on Page button with this link"
          />
          <Field
            label="Instagram / Portfolio link"
            value={form.portfolio_url}
            onChange={set('portfolio_url')}
            disabled={save.busy}
            placeholder="https://instagram.com/..."
          />
          <div className="sm:col-span-2">
            <ChipMultiPicker
              label="Accepted payment methods"
              value={form.payment_methods}
              suggestions={PAYMENT_SUGGESTIONS}
              onChange={(v) => setField('payment_methods', v)}
              disabled={save.busy}
              placeholder="Click payment options above or add your own..."
            />
          </div>
        </div>
        <SaveBar save={save} />
      </SettingsCard>

      {/* Starter Templates Card */}
      <SettingsCard
        title="Quick Starter Templates"
        description="Reset or populate your salon profile with a pre-built preset. Asks for confirmation before applying."
      >
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton
            disabled={presetState.busy}
            onClick={() => onRequestPreset(BENEFICIARY_PRESET_TREV_LUNA)}
          >
            {presetState.busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Load Preset: Makeup and Hair by Trev Luna
          </PrimaryButton>
          <SecondaryButton
            disabled={presetState.busy}
            onClick={() => onRequestPreset(DEFAULT_PRESET)}
          >
            <RotateCcw size={15} />
            Restore Default Preset
          </SecondaryButton>
        </div>

        {presetState.message && (
          <div className={`text-xs flex items-center gap-1.5 font-medium ${presetState.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
            {presetState.ok ? <CheckCircle size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
            <span>{presetState.message}</span>
          </div>
        )}
      </SettingsCard>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Workspace 2: Services Catalog Table + Modal + Portfolio Gallery
// ---------------------------------------------------------------------------
function ServicesAndPortfolioWorkspace({ profile, services, onSaved }) {
  const [modalMode, setModalMode] = useState(null) // null | { type: 'add' } | { type: 'edit', service }

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Services, Pricing & Inclusions"
        description="Manage your salon packages. Active packages appear inside JAL and on your public landing page."
        badge={`${services.length} services`}
        actions={
          <PrimaryButton onClick={() => setModalMode({ type: 'add' })}>
            <Plus size={15} />
            Add New Service
          </PrimaryButton>
        }
      >
        {services.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-pink-200 bg-rose-50/30 p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-gray-800">No services added yet</p>
            <p className="text-xs text-gray-500">Add your first service so clients can view rates and book slots.</p>
          </div>
        ) : (
          <div className="divide-y divide-pink-100/70 border border-pink-100 rounded-2xl overflow-hidden">
            {services.map((s) => {
              const thumb =
                sanitizeImageUrl(s.image_url) ||
                SHOWCASE_SERVICE_IMAGES[s.key] ||
                DEFAULT_ARTIST_PHOTO_URL
              const priceLabel = formatServicePrice({
                priceMode: s.price_mode || 'fixed',
                price: s.price,
                priceMax: s.price_max,
                priceNote: s.price_note,
              })
              return (
                <div
                  key={s.key}
                  className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white hover:bg-rose-50/25 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <img
                      src={thumb}
                      alt={s.name}
                      className="w-16 h-16 rounded-xl object-cover border border-pink-100 shrink-0 bg-rose-50"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">{s.name}</span>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-100">
                          {priceLabel}
                        </span>
                        <span className="text-xs font-medium text-gray-500">
                          {formatDuration(s.duration_minutes)}
                        </span>
                        <StatusBadge status={s.active !== false ? 'active' : 'inactive'} />
                        {s.show_on_landing && (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-pink-600 border border-pink-100">
                            Featured on site
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <p className="text-xs text-gray-600 line-clamp-1">{s.description}</p>
                      )}
                      {s.aliases?.length > 0 && (
                        <p className="text-[11px] text-gray-400 truncate">
                          Chat keywords: {s.aliases.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <SecondaryButton
                    onClick={() => setModalMode({ type: 'edit', service: s })}
                    className="shrink-0 min-h-[38px] px-3.5 text-xs"
                  >
                    <Pencil size={13} />
                    Edit Service
                  </SecondaryButton>
                </div>
              )
            })}
          </div>
        )}
      </SettingsCard>

      {/* Portfolio Gallery Section */}
      <PortfolioGalleryCard profile={profile} onSaved={onSaved} />

      {/* Add / Edit Service Modal */}
      {modalMode && (
        <ServiceEditorModal
          mode={modalMode.type}
          service={modalMode.service}
          existingServices={services}
          onClose={() => setModalMode(null)}
          onSaved={async () => {
            await onSaved()
            setModalMode(null)
          }}
        />
      )}
    </div>
  )
}

function ServiceEditorModal({ mode, service, existingServices, onClose, onSaved }) {
  const isEdit = mode === 'edit' && service
  const [form, setForm] = useState(() =>
    isEdit ? serviceForm(service) : serviceForm({ show_on_landing: false }),
  )
  const save = useSaver(onSaved)

  function submit(e) {
    e.preventDefault()
    const problem = validService(form)
    if (problem) return save.fail(problem)
    if (isEdit) {
      save.run(() => businessInfo.saveService(service.key, servicePatch(form)))
    } else {
      const key = serviceKeyFromName(form.name)
      if (key.length < 2) return save.fail('Please use letters or numbers in the name.')
      if (existingServices.some((s) => s.key === key)) return save.fail(SAVE_ERRORS.duplicate)
      save.run(() =>
        businessInfo.addService({
          key,
          sort_order: existingServices.length + 1,
          ...servicePatch(form),
        }),
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={submit}
        className="bg-white rounded-3xl border border-pink-100 shadow-2xl max-w-2xl w-full overflow-hidden my-auto"
      >
        <div className="px-6 py-5 border-b border-pink-100/80 bg-gradient-to-r from-rose-50 via-white to-pink-50/40 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {isEdit ? `Edit Service: ${service.name}` : 'Add New Service'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Set pricing mode, session duration, inclusions, and chat recognition keywords.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close service editor"
            className="w-9 h-9 rounded-xl border border-pink-100 bg-white text-gray-500 hover:text-gray-800 hover:bg-rose-50 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          <ServiceFields form={form} setForm={setForm} disabled={save.busy} />
          <SaveBar
            save={save}
            label={isEdit ? 'Save Service Changes' : 'Create Service'}
            extra={
              <SecondaryButton onClick={onClose} disabled={save.busy}>
                Cancel
              </SecondaryButton>
            }
          />
        </div>
      </form>
    </div>
  )
}

function serviceForm(s) {
  return {
    name: s.name ?? '',
    price: s.price ?? '',
    price_mode: s.price_mode || 'fixed',
    price_max: s.price_max != null ? String(s.price_max) : '',
    price_note: s.price_note ?? '',
    duration_minutes: s.duration_minutes ?? 60,
    aliases: listToText(s.aliases),
    description: s.description ?? '',
    inclusions: s.inclusions ?? '',
    image_url: s.image_url ?? '',
    show_on_landing: Boolean(s.show_on_landing),
    active: s.active ?? true,
  }
}

function validService(form) {
  if (!form.name.trim()) return 'Service name is required.'
  const min = Number(form.price)
  if (form.price_mode !== 'varies' && (form.price === '' || min < 0)) {
    return 'Price must be 0 or more.'
  }
  if (form.price !== '' && min < 0) return 'Price cannot be negative.'
  if (form.price_mode === 'range') {
    const max = Number(form.price_max)
    if (form.price_max === '' || !(max > min)) {
      return 'Maximum price must be higher than the minimum price.'
    }
  }
  if (!(Number(form.duration_minutes) > 0)) return 'Duration must be at least 15 minutes.'
  return null
}

function servicePatch(form) {
  return {
    name: form.name.trim(),
    price: form.price === '' ? 0 : Number(form.price),
    price_mode: form.price_mode || 'fixed',
    price_max:
      form.price_mode === 'range' && blankToNull(form.price_max) !== null
        ? Number(form.price_max)
        : null,
    price_note: blankToNull(form.price_note),
    duration_minutes: Math.round(Number(form.duration_minutes)),
    aliases: textToList(form.aliases.toLowerCase()),
    description: blankToNull(form.description),
    inclusions: blankToNull(form.inclusions),
    image_url: blankToNull(sanitizeImageUrl(form.image_url) || form.image_url),
    show_on_landing: form.show_on_landing,
    active: form.active,
  }
}

function ServiceFields({ form, setForm, disabled }) {
  const setField = (k, val) => setForm((prev) => ({ ...prev, [k]: val }))
  const set = (k) => (e) => setField(k, e.target.type === 'checkbox' ? e.target.checked : e.target.value)

  const { hours, minutes } = splitDurationMinutes(form.duration_minutes)
  const minuteChoices = DURATION_MINUTE_OPTIONS.includes(minutes)
    ? DURATION_MINUTE_OPTIONS
    : [...DURATION_MINUTE_OPTIONS, minutes].sort((a, b) => a - b)

  const updateDuration = (nextH, nextM) => {
    const total = Math.max(15, Number(nextH) * 60 + Number(nextM))
    setField('duration_minutes', total)
  }

  const priceMode = form.price_mode || 'fixed'
  const priceLabel =
    priceMode === 'range'
      ? 'Min price (PHP)'
      : priceMode === 'starting'
        ? 'Starting price (PHP)'
        : priceMode === 'varies'
          ? 'Estimated base (PHP, optional)'
          : 'Price (PHP)'

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Service name" value={form.name} onChange={set('name')} disabled={disabled} />

        <div>
          <span className="block text-xs font-semibold text-gray-700 mb-1.5">Session duration</span>
          <div className="grid grid-cols-2 gap-2.5">
            <select
              aria-label="Duration hours"
              value={hours}
              onChange={(e) => updateDuration(e.target.value, minutes)}
              disabled={disabled}
              className="min-h-[44px] border border-pink-100 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-pink-400"
            >
              {DURATION_HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h} {h === 1 ? 'hr' : 'hrs'}
                </option>
              ))}
            </select>
            <select
              aria-label="Duration minutes"
              value={minutes}
              onChange={(e) => updateDuration(hours, e.target.value)}
              disabled={disabled}
              className="min-h-[44px] border border-pink-100 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-pink-400"
            >
              {minuteChoices.map((m) => (
                <option key={m} value={m}>
                  {m} mins
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-pink-100 bg-rose-50/30 p-4 space-y-3">
        <div className="text-xs font-bold text-gray-800">Pricing Format</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Pricing display</span>
            <select
              value={priceMode}
              onChange={(e) => setField('price_mode', e.target.value)}
              disabled={disabled}
              className="mt-1.5 w-full min-h-[44px] border border-pink-100 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-pink-400"
            >
              {PRICE_MODE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <Field
            label={priceLabel}
            type="number"
            min="0"
            value={form.price}
            onChange={set('price')}
            disabled={disabled}
            placeholder={priceMode === 'varies' ? 'Optional (0 = quote only)' : '2000'}
          />

          {priceMode === 'range' ? (
            <Field
              label="Max price (PHP)"
              type="number"
              min="0"
              value={form.price_max}
              onChange={set('price_max')}
              disabled={disabled}
              placeholder="3500"
            />
          ) : (
            <Field
              label="Price note (optional)"
              value={form.price_note}
              onChange={set('price_note')}
              disabled={disabled}
              placeholder="e.g. Depends on hair length or peg"
            />
          )}
        </div>

        {priceMode === 'range' && (
          <Field
            label="Price note (optional)"
            value={form.price_note}
            onChange={set('price_note')}
            disabled={disabled}
            placeholder="e.g. Price depends on hair complexity or venue"
          />
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label="Keywords clients use"
          value={form.aliases}
          onChange={set('aliases')}
          disabled={disabled}
          placeholder="bride, kasal, wedding makeup"
          hint="Add Taglish or local words so JAL recognizes client requests."
        />
        <Field
          label="Short description (website)"
          value={form.description}
          onChange={set('description')}
          disabled={disabled}
          placeholder="Full glam for your special day"
        />
        <TextAreaField
          label="Package inclusions"
          value={form.inclusions}
          onChange={set('inclusions')}
          disabled={disabled}
          className="sm:col-span-2"
          rows={2}
          placeholder="Skin prep, long-wear makeup, false lashes, hairstyling..."
        />
      </div>

      <MediaPickerField
        label="Service card photo"
        value={form.image_url}
        fallbackPreview={DEFAULT_ARTIST_PHOTO_URL}
        folder="services"
        disabled={disabled}
        onChange={(url) => setField('image_url', url)}
        aspectClass="w-24 h-20"
      />

      <div className="flex flex-wrap gap-5 pt-1 text-xs font-medium text-gray-700">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.show_on_landing}
            onChange={set('show_on_landing')}
            disabled={disabled}
            className="w-4 h-4 accent-pink-500 rounded"
          />
          Featured on website landing section
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.active}
            onChange={set('active')}
            disabled={disabled}
            className="w-4 h-4 accent-pink-500 rounded"
          />
          Active service (clients can book)
        </label>
      </div>
    </div>
  )
}

function PortfolioGalleryCard({ profile, onSaved }) {
  const [gallery, setGallery] = useState(() =>
    Array.isArray(profile.gallery_urls) && profile.gallery_urls.length
      ? profile.gallery_urls
      : [...SHOWCASE_GALLERY_URLS],
  )
  const [newUrlInput, setNewUrlInput] = useState('')
  const [galleryBusy, setGalleryBusy] = useState(false)
  const [galleryNote, setGalleryNote] = useState('')
  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState(null)
  const save = useSaver(onSaved)

  function addGalleryUrl() {
    const clean = sanitizeImageUrl(newUrlInput)
    if (!clean) {
      setGalleryNote('Please enter a valid http(s) or image URL.')
      return
    }
    if (gallery.length >= 12) {
      setGalleryNote('Maximum of 12 portfolio gallery photos reached.')
      return
    }
    if (!gallery.includes(clean)) {
      setGallery((prev) => [...prev, clean])
    }
    setNewUrlInput('')
    setGalleryNote('')
  }

  async function handleGalleryUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (gallery.length >= 12) {
      setGalleryNote('Maximum of 12 portfolio gallery photos reached.')
      return
    }
    setGalleryBusy(true)
    setGalleryNote('')
    try {
      const res = await uploadSalonImage(supabase, file, 'gallery')
      if (res.ok && res.url) {
        setGallery((prev) => [...prev, res.url])
        if (res.fallback) {
          setGalleryNote('Added optimized preview (click Save Portfolio to publish).')
        }
      }
    } catch (err) {
      setGalleryNote(err?.message || 'Could not process that image file.')
    } finally {
      setGalleryBusy(false)
    }
  }

  function movePhoto(index, delta) {
    const nextIdx = index + delta
    if (nextIdx < 0 || nextIdx >= gallery.length) return
    setGallery((prev) => {
      const copy = [...prev]
      const [item] = copy.splice(index, 1)
      copy.splice(nextIdx, 0, item)
      return copy
    })
  }

  function handleSaveGallery(e) {
    e.preventDefault()
    save.run(() =>
      businessInfo.saveProfile({
        gallery_urls: gallery.map((u) => sanitizeImageUrl(u) || u).filter(Boolean).slice(0, 12),
      }),
    )
  }

  return (
    <form onSubmit={handleSaveGallery}>
      <SettingsCard
        title="Portfolio Gallery Grid"
        description="Showcase your best bridal and glam looks on the public website (up to 12 photos)."
        badge={`${gallery.length}/12 photos`}
      >
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <label
            className={`inline-flex items-center justify-center gap-2 text-xs font-semibold px-4 min-h-[42px] rounded-xl transition-colors cursor-pointer shrink-0 ${
              save.busy || galleryBusy || gallery.length >= 12
                ? 'bg-pink-200 text-white cursor-not-allowed'
                : 'bg-pink-500 hover:bg-pink-600 text-white shadow-sm shadow-pink-500/20'
            }`}
          >
            {galleryBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            <span>{galleryBusy ? 'Uploading...' : 'Upload Photo'}</span>
            <input
              type="file"
              accept="image/*"
              disabled={save.busy || galleryBusy || gallery.length >= 12}
              onChange={handleGalleryUpload}
              className="sr-only"
            />
          </label>

          <div className="flex-1 flex gap-2">
            <input
              type="url"
              value={newUrlInput}
              disabled={save.busy || gallery.length >= 12}
              onChange={(e) => setNewUrlInput(e.target.value)}
              placeholder="Or paste an image URL (https://...)..."
              className="flex-1 min-h-[42px] border border-pink-100 rounded-xl px-3.5 py-2 text-sm bg-white focus:outline-none focus:border-pink-400"
            />
            <SecondaryButton
              onClick={addGalleryUrl}
              disabled={save.busy || gallery.length >= 12 || !newUrlInput.trim()}
              className="min-h-[42px] px-4 text-xs"
            >
              Add Link
            </SecondaryButton>
          </div>
        </div>

        {galleryNote && <p className="text-xs text-pink-600 font-medium">{galleryNote}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {gallery.map((url, idx) => (
            <div
              key={`${url.slice(0, 32)}-${idx}`}
              className="group relative rounded-2xl overflow-hidden border border-pink-100 bg-rose-50/40 aspect-[4/3] shadow-xs"
            >
              <img src={url} alt={`Portfolio ${idx + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/75 via-black/35 to-transparent flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0 || save.busy}
                    onClick={() => movePhoto(idx, -1)}
                    aria-label="Move photo earlier"
                    className="w-7 h-7 rounded-lg bg-white/90 text-gray-800 hover:bg-white disabled:opacity-40 flex items-center justify-center"
                  >
                    <ArrowLeft size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === gallery.length - 1 || save.busy}
                    onClick={() => movePhoto(idx, 1)}
                    aria-label="Move photo later"
                    className="w-7 h-7 rounded-lg bg-white/90 text-gray-800 hover:bg-white disabled:opacity-40 flex items-center justify-center"
                  >
                    <ArrowRight size={12} />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={save.busy}
                  onClick={() => setConfirmRemoveIdx(idx)}
                  aria-label="Remove portfolio photo"
                  className="w-7 h-7 rounded-lg bg-rose-500 text-white hover:bg-rose-600 flex items-center justify-center"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <SaveBar save={save} label="Save Portfolio" />
      </SettingsCard>

      <ConfirmModal
        open={confirmRemoveIdx !== null}
        title="Remove Portfolio Photo?"
        description="This removes the photo from your website gallery strip once you save the gallery."
        confirmLabel="Remove Photo"
        tone="danger"
        onCancel={() => setConfirmRemoveIdx(null)}
        onConfirm={() => {
          setGallery((prev) => prev.filter((_, i) => i !== confirmRemoveIdx))
          setConfirmRemoveIdx(null)
        }}
      />
    </form>
  )
}

// ---------------------------------------------------------------------------
// Workspace 3: Hours & Booking Notice Rules
// ---------------------------------------------------------------------------
function HoursSection({ settings, onSaved }) {
  const [form, setForm] = useState(() => ({
    open_time: settings.open_time.slice(0, 5),
    close_time: settings.close_time.slice(0, 5),
    min_advance_days: String(settings.min_advance_days ?? 3),
    cutoff_hours: String(settings.cutoff_hours ?? 24),
    slot_interval_minutes: String(settings.slot_interval_minutes ?? 60),
  }))
  const save = useSaver(onSaved)
  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))
  const set = (k) => (e) => setField(k, e.target.value)

  function submit(e) {
    e.preventDefault()
    if (form.open_time >= form.close_time) {
      return save.fail('Opening time must be before closing time.')
    }
    save.run(() =>
      businessInfo.saveSettings({
        open_time: form.open_time,
        close_time: form.close_time,
        min_advance_days: Number(form.min_advance_days),
        cutoff_hours: Number(form.cutoff_hours),
        slot_interval_minutes: Number(form.slot_interval_minutes),
      }),
    )
  }

  return (
    <form onSubmit={submit}>
      <SettingsCard
        title="Studio Hours & Automated Booking Rules"
        description="Enforced live inside JAL and manual bookings so clients never book outside working hours."
        badge="Server Enforced"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Opens at"
            type="time"
            value={form.open_time}
            onChange={set('open_time')}
            disabled={save.busy}
          />
          <Field
            label="Closes at"
            type="time"
            value={form.close_time}
            onChange={set('close_time')}
            disabled={save.busy}
            hint="Services must finish before closing time"
          />
          <PresetSelectField
            label="Minimum advance booking notice"
            value={form.min_advance_days}
            options={ADVANCE_DAY_PRESETS}
            onChange={(v) => setField('min_advance_days', v)}
            disabled={save.busy}
            customType="number"
            min="0"
            max="60"
          />
          <PresetSelectField
            label="Cancel or reschedule cutoff"
            value={form.cutoff_hours}
            options={CUTOFF_HOUR_PRESETS}
            onChange={(v) => setField('cutoff_hours', v)}
            disabled={save.busy}
            customType="number"
            min="0"
            max="168"
          />
          <PresetSelectField
            label="Available slot intervals"
            value={form.slot_interval_minutes}
            options={SLOT_INTERVAL_PRESETS}
            onChange={(v) => setField('slot_interval_minutes', v)}
            disabled={save.busy}
            customType="number"
            min="15"
            max="240"
          />
        </div>
        <SaveBar save={save} label="Save Hours & Rules" />
      </SettingsCard>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Workspace 4: Travel, Extra Heads & Deposit Policies
// ---------------------------------------------------------------------------
function PoliciesAndTravelWorkspace({ profile, services, onSaved }) {
  const [form, setForm] = useState(() => buildProfileForm(profile))
  const save = useSaver(onSaved)
  const setField = (k, val) => setForm((prev) => ({ ...prev, [k]: val }))
  const set = (k) => (e) => setField(k, e.target.value)

  const toggleFeeService = (key) =>
    setForm((prev) => ({
      ...prev,
      reservation_fee_services: prev.reservation_fee_services.includes(key)
        ? prev.reservation_fee_services.filter((k) => k !== key)
        : [...prev.reservation_fee_services, key],
    }))

  function submit(e) {
    e.preventDefault()
    save.run(() =>
      businessInfo.saveProfile({
        consultation_fee:
          blankToNull(form.consultation_fee) === null ? null : Number(form.consultation_fee),
        free_travel_areas: textToList(form.free_travel_areas),
        travel_areas: textToList(form.travel_areas),
        travel_fee_note: blankToNull(form.travel_fee_note),
        additional_head_price:
          blankToNull(form.additional_head_price) === null ? null : Number(form.additional_head_price),
        additional_head_note: blankToNull(form.additional_head_note),
        reservation_fee: Number(form.reservation_fee) || 0,
        reservation_fee_services: form.reservation_fee_services,
        wedding_downpayment_percent:
          blankToNull(form.wedding_downpayment_percent) === null
            ? null
            : Number(form.wedding_downpayment_percent),
        wedding_cancel_cutoff_days:
          blankToNull(form.wedding_cancel_cutoff_days) === null
            ? null
            : Number(form.wedding_cancel_cutoff_days),
        event_downpayment_percent: blankToNull(form.event_downpayment_percent),
        event_cancel_cutoff_days:
          blankToNull(form.event_cancel_cutoff_days) === null
            ? null
            : Number(form.event_cancel_cutoff_days),
        same_day_rush_note: blankToNull(form.same_day_rush_note),
      }),
    )
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <SettingsCard
        title="Travel Coverage & Extra Heads"
        description="Configure free local venues, out-of-town coverage, and add-on rates for entourage heads."
      >
        <div className="space-y-4">
          <ChipMultiPicker
            label="Free travel / transportation inclusive areas"
            value={form.free_travel_areas}
            suggestions={FREE_AREA_SUGGESTIONS}
            onChange={(v) => setField('free_travel_areas', v)}
            disabled={save.busy}
            placeholder="Select areas with no extra travel fee..."
          />
          <ChipMultiPicker
            label="Out-of-town / extended service areas"
            value={form.travel_areas}
            suggestions={OUT_OF_TOWN_SUGGESTIONS}
            onChange={(v) => setField('travel_areas', v)}
            disabled={save.busy}
            placeholder="Select areas covered with transpo fee..."
          />

          <div className="space-y-2">
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">Quick travel fee template</span>
              <select
                value={TRAVEL_NOTE_PRESETS.some((p) => p.value === form.travel_fee_note) ? form.travel_fee_note : ''}
                onChange={(e) => {
                  if (e.target.value) setField('travel_fee_note', e.target.value)
                }}
                disabled={save.busy}
                className="mt-1.5 w-full min-h-[44px] border border-pink-100 rounded-xl px-3.5 py-2 text-sm bg-white focus:outline-none focus:border-pink-400"
              >
                <option value="">Choose a quick template or customize below...</option>
                {TRAVEL_NOTE_PRESETS.map((p) => (
                  <option key={p.label} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <TextAreaField
              label="Travel & out-of-town fee explanation"
              value={form.travel_fee_note}
              onChange={set('travel_fee_note')}
              disabled={save.busy}
              rows={2}
              placeholder="Explain when travel is free and how out-of-town fees apply..."
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-pink-100/70">
            <PresetSelectField
              label="Additional head / entourage rate (PHP)"
              value={form.additional_head_price}
              options={EXTRA_HEAD_PRESETS}
              onChange={(v) => setField('additional_head_price', v)}
              disabled={save.busy}
              customType="number"
              min="0"
              placeholder="e.g. 1000"
            />
            <Field
              label="Extra head inclusion note"
              value={form.additional_head_note}
              onChange={set('additional_head_note')}
              disabled={save.busy}
              placeholder="e.g. Includes full hair & makeup with false lashes"
            />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Down Payments, Consultation & Cancellation Policies"
        description="JAL shares these exact deposit and cancellation terms whenever clients ask or confirm bookings."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-pink-100 bg-rose-50/40 p-4 space-y-3">
            <div className="text-xs font-bold text-pink-700">Wedding Bookings</div>
            <PresetSelectField
              label="Wedding down payment (%)"
              value={form.wedding_downpayment_percent}
              options={WEDDING_DP_PRESETS}
              onChange={(v) => setField('wedding_downpayment_percent', v)}
              disabled={save.busy}
              customType="number"
              min="0"
              max="100"
              placeholder="e.g. 40"
            />
            <PresetSelectField
              label="Wedding notice / cutoff (days before)"
              value={form.wedding_cancel_cutoff_days}
              options={WEDDING_CUTOFF_PRESETS}
              onChange={(v) => setField('wedding_cancel_cutoff_days', v)}
              disabled={save.busy}
              customType="number"
              min="0"
              placeholder="e.g. 30"
            />
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-gray-50/60 p-4 space-y-3">
            <div className="text-xs font-bold text-gray-800">Event & Debut Bookings</div>
            <PresetSelectField
              label="Event / Debut reservation fee"
              value={form.event_downpayment_percent}
              options={EVENT_DP_PRESETS}
              onChange={(v) => setField('event_downpayment_percent', v)}
              disabled={save.busy}
              placeholder="e.g. 10% to 20%"
            />
            <PresetSelectField
              label="Event notice / cutoff (days before)"
              value={form.event_cancel_cutoff_days}
              options={EVENT_CUTOFF_PRESETS}
              onChange={(v) => setField('event_cancel_cutoff_days', v)}
              disabled={save.busy}
              customType="number"
              min="0"
              placeholder="e.g. 3"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <PresetSelectField
            label="Consultation / trial fee (PHP)"
            value={form.consultation_fee}
            options={CONSULTATION_PRESETS}
            onChange={(v) => setField('consultation_fee', v)}
            disabled={save.busy}
            customType="number"
            min="0"
            placeholder="0 = Free / inquire"
          />
          <PresetSelectField
            label="Flat reservation fee fallback (PHP)"
            value={form.reservation_fee}
            options={RESERVATION_FEE_PRESETS}
            onChange={(v) => setField('reservation_fee', v)}
            disabled={save.busy}
            customType="number"
            min="0"
            placeholder="e.g. 1000"
          />
        </div>

        <div className="space-y-2 border-t border-pink-100/70 pt-4">
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Same-day / rush booking template</span>
            <select
              value={RUSH_NOTE_PRESETS.some((p) => p.value === form.same_day_rush_note) ? form.same_day_rush_note : ''}
              onChange={(e) => {
                if (e.target.value) setField('same_day_rush_note', e.target.value)
              }}
              disabled={save.busy}
              className="mt-1.5 w-full min-h-[44px] border border-pink-100 rounded-xl px-3.5 py-2 text-sm bg-white focus:outline-none focus:border-pink-400"
            >
              <option value="">Choose a quick template or customize below...</option>
              {RUSH_NOTE_PRESETS.map((p) => (
                <option key={p.label} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <TextAreaField
            label="Same-day / short-notice rush note"
            value={form.same_day_rush_note}
            onChange={set('same_day_rush_note')}
            disabled={save.busy}
            rows={2}
            placeholder="Explain whether rush bookings are accepted at a slightly higher rate..."
          />
        </div>

        <div className="border-t border-pink-100/70 pt-4">
          <div className="text-xs font-semibold text-gray-700 mb-2.5">
            Services requiring down payment / reservation fee
          </div>
          <div className="flex flex-wrap gap-2">
            {services
              .filter((s) => s.active)
              .map((s) => (
                <label
                  key={s.key}
                  className="inline-flex items-center gap-2 text-xs font-medium border border-pink-100 rounded-xl px-3 py-2 cursor-pointer bg-white hover:border-pink-300"
                >
                  <input
                    type="checkbox"
                    checked={form.reservation_fee_services.includes(s.key)}
                    onChange={() => toggleFeeService(s.key)}
                    disabled={save.busy}
                    className="w-4 h-4 accent-pink-500 rounded"
                  />
                  {s.name}
                </label>
              ))}
          </div>
        </div>

        <SaveBar save={save} label="Save Travel & Policies" />
      </SettingsCard>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Shared Form Controls & Save Logic
// ---------------------------------------------------------------------------
function MediaPickerField({
  label,
  hint,
  value,
  fallbackPreview,
  folder = 'media',
  disabled = false,
  onChange,
  aspectClass = 'w-28 h-20',
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadNotice, setUploadNotice] = useState('')
  const previewSrc = sanitizeImageUrl(value) || fallbackPreview

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadNotice('')
    try {
      const res = await uploadSalonImage(supabase, file, folder)
      if (res.ok && res.url) {
        onChange(res.url)
        setUploadNotice(
          res.fallback
            ? 'Saved compressed preview locally (run salon-media migration for cloud hosting).'
            : 'Uploaded photo cleanly.',
        )
      }
    } catch (err) {
      setUploadNotice(err?.message || 'Could not process that image file.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border border-pink-100 rounded-2xl p-4 bg-rose-50/25 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-gray-800">{label}</span>
        {value && (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => {
              onChange('')
              setUploadNotice('')
            }}
            className="text-[11px] font-semibold text-gray-500 hover:text-pink-600"
          >
            Reset to showcase default
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
        <img
          src={previewSrc}
          alt={label}
          className={`${aspectClass} rounded-xl object-cover border border-pink-100 bg-white shrink-0`}
        />

        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 min-h-[38px] rounded-xl transition-colors cursor-pointer ${
                disabled || uploading
                  ? 'bg-pink-200 text-white cursor-not-allowed'
                  : 'bg-pink-500 hover:bg-pink-600 text-white shadow-xs'
              }`}
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              <span>{uploading ? 'Optimizing...' : 'Upload Photo'}</span>
              <input
                type="file"
                accept="image/*"
                disabled={disabled || uploading}
                onChange={handleFileSelect}
                className="sr-only"
              />
            </label>
            <span className="text-[11px] text-gray-400">or paste image link below</span>
          </div>

          <input
            type="url"
            value={value}
            disabled={disabled || uploading}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://images.unsplash.com/..."
            className="w-full min-h-[40px] border border-pink-100 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
          />

          {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
          {uploadNotice && <p className="text-[11px] text-pink-600 font-semibold">{uploadNotice}</p>}
        </div>
      </div>
    </div>
  )
}

function PresetSelectField({
  label,
  value,
  options,
  onChange,
  disabled,
  customType = 'text',
  placeholder,
  min,
  max,
}) {
  const stringVal = value ?? ''
  const matchesPreset = options.some((opt) => opt.value === stringVal)
  const [customMode, setCustomMode] = useState(!matchesPreset && stringVal !== '')
  const selectVal = customMode ? '__custom__' : matchesPreset ? stringVal : '__custom__'

  return (
    <div className="space-y-1.5">
      <label className="block">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <select
          value={selectVal}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value === '__custom__') {
              setCustomMode(true)
            } else {
              setCustomMode(false)
              onChange(e.target.value)
            }
          }}
          className="mt-1.5 w-full min-h-[44px] border border-pink-100 rounded-xl px-3.5 py-2 text-sm bg-white focus:outline-none focus:border-pink-400"
        >
          {options.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
          <option value="__custom__">Custom value...</option>
        </select>
      </label>

      {selectVal === '__custom__' && (
        <input
          type={customType}
          min={min}
          max={max}
          value={stringVal}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Enter custom value...'}
          className="w-full min-h-[42px] border border-pink-200 rounded-xl px-3.5 py-2 text-sm bg-white focus:outline-none focus:border-pink-400"
        />
      )}
    </div>
  )
}

function ChipMultiPicker({ label, value, suggestions, onChange, disabled, placeholder }) {
  const selected = textToList(value)
  const selectedLower = new Set(selected.map((x) => x.toLowerCase()))

  function toggleChip(tag) {
    if (disabled) return
    if (selectedLower.has(tag.toLowerCase())) {
      const next = selected.filter((x) => x.toLowerCase() !== tag.toLowerCase())
      onChange(listToText(next))
    } else {
      onChange(listToText([...selected, tag]))
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-gray-700">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((tag) => {
          const active = selectedLower.has(tag.toLowerCase())
          return (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              onClick={() => toggleChip(tag)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? 'bg-pink-500 border-pink-500 text-white'
                  : 'bg-white border-pink-100 text-gray-600 hover:border-pink-300 hover:bg-rose-50/40'
              }`}
            >
              {active ? `${tag} ✓` : `+ ${tag}`}
            </button>
          )
        })}
      </div>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-[42px] border border-pink-100 rounded-xl px-3.5 py-2 text-xs text-gray-700 focus:outline-none focus:border-pink-400"
      />
    </div>
  )
}

function useSaver(onSaved) {
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(null)
  const [message, setMessage] = useState('')

  async function run(action) {
    setBusy(true)
    setOk(null)
    setMessage('')
    const res = await action()
    setBusy(false)
    if (res.ok) {
      setOk(true)
      setMessage(
        res.localExtended
          ? 'Core details saved to Supabase; extended profile fields cached locally in this browser.'
          : 'Saved changes. Website and JAL chatbot are updated.',
      )
      loadCatalogOnce({ refresh: true })
      onSaved()
    } else {
      setOk(false)
      setMessage(res.error || 'Could not save changes.')
    }
  }

  function fail(msg) {
    setOk(false)
    setMessage(msg)
  }

  return { busy, ok, message, run, fail }
}

function SaveBar({ save, label = 'Save Changes', extra = null }) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-pink-100/70">
      <PrimaryButton type="submit" disabled={save.busy}>
        {save.busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {label}
      </PrimaryButton>
      {extra}
      {save.message && (
        <span className={`text-xs flex items-center gap-1.5 font-medium ${save.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
          {save.ok ? <CheckCircle size={14} className="shrink-0" /> : <Info size={14} className="shrink-0" />}
          {save.message}
        </span>
      )}
    </div>
  )
}

function Field({ label, hint, className = '', ...rest }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</span>
      <input
        {...rest}
        className="w-full min-h-[44px] border border-pink-100 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 disabled:bg-gray-50 disabled:text-gray-500"
      />
      {hint && <span className="block text-[11px] text-gray-500 mt-1">{hint}</span>}
    </label>
  )
}

function TextAreaField({ label, hint, className = '', ...rest }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</span>
      <textarea
        {...rest}
        className="w-full border border-pink-100 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 disabled:bg-gray-50 disabled:text-gray-500"
      />
      {hint && <span className="block text-[11px] text-gray-500 mt-1">{hint}</span>}
    </label>
  )
}

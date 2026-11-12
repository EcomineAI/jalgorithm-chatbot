import { useEffect, useState } from 'react'
import { Store, Scissors, Clock, Plus, Save, Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { businessInfo, loadCatalogOnce } from '../../lib/useBusinessInfo.js'
import { serviceKeyFromName, SAVE_ERRORS } from '../../services/businessInfo.js'

// Owner's panel → Business Info. Everything here is saved to Supabase and is what the
// chatbot (JAL), the navbar and the landing page show. Changes reach the chatbot the next
// time a client opens the chat.

const listToText = (arr) => (arr ?? []).join(', ')
const textToList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean)
const blankToNull = (s) => (String(s ?? '').trim() === '' ? null : String(s).trim())

export default function BusinessInfoTab() {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)

  async function reload() {
    const rows = await businessInfo.loadOwnerData()
    if (rows.error) setLoadError(rows.error)
    else {
      setLoadError(null)
      setData(rows)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  if (loadError) return <Banner type="error" text={SAVE_ERRORS[loadError] ?? loadError} />
  if (!data) return <div className="text-sm text-gray-400 p-6">Loading business info…</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <Banner type="info" text="This is what JAL tells your clients, and what the website shows. Changes apply the next time someone opens the chat." />
      <ProfileSection profile={data.profile} services={data.services} onSaved={reload} />
      <ServicesSection services={data.services} onSaved={reload} />
      <HoursSection settings={data.settings} onSaved={reload} />
    </div>
  )
}

// ── Salon details ────────────────────────────────────────────────────────────
function ProfileSection({ profile, services, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: profile.name,
    artist: profile.artist,
    location: profile.location,
    contact: profile.contact ?? '',
    portfolio_url: profile.portfolio_url ?? '',
    payment_methods: profile.payment_methods ?? '',
    consultation_fee: profile.consultation_fee ?? '',
    travel_areas: listToText(profile.travel_areas),
    reservation_fee: profile.reservation_fee ?? 0,
    reservation_fee_services: profile.reservation_fee_services ?? [],
  }))
  const save = useSaver(onSaved)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.artist.trim() || !form.location.trim()) return save.fail('Salon name, artist and location are required.')
    save.run(() =>
      businessInfo.saveProfile({
        name: form.name.trim(),
        artist: form.artist.trim(),
        location: form.location.trim(),
        contact: blankToNull(form.contact),
        portfolio_url: blankToNull(form.portfolio_url),
        payment_methods: blankToNull(form.payment_methods),
        consultation_fee: blankToNull(form.consultation_fee) === null ? null : Number(form.consultation_fee),
        travel_areas: textToList(form.travel_areas),
        reservation_fee: Number(form.reservation_fee) || 0,
        reservation_fee_services: form.reservation_fee_services,
      }),
    )
  }

  const toggleFeeService = (key) =>
    setForm({
      ...form,
      reservation_fee_services: form.reservation_fee_services.includes(key)
        ? form.reservation_fee_services.filter((k) => k !== key)
        : [...form.reservation_fee_services, key],
    })

  return (
    <Section icon={Store} title="Salon details" onSubmit={submit} save={save}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Salon name" value={form.name} onChange={set('name')} disabled={save.busy} required />
        <Field label="Artist name" value={form.artist} onChange={set('artist')} disabled={save.busy} required />
        <Field label="Location" value={form.location} onChange={set('location')} disabled={save.busy} required hint="Shown on the website and when clients ask 'saan kayo?'" />
        <Field label="Areas with travel fee" value={form.travel_areas} onChange={set('travel_areas')} disabled={save.busy} hint="Separate with commas, e.g. Subic, Castillejos" />
        <Field label="Contact number / page" value={form.contact} onChange={set('contact')} disabled={save.busy} hint="Leave blank and JAL says it isn't available yet" />
        <Field label="Portfolio link" value={form.portfolio_url} onChange={set('portfolio_url')} disabled={save.busy} placeholder="https://facebook.com/…" />
        <Field label="Accepted payment methods" value={form.payment_methods} onChange={set('payment_methods')} disabled={save.busy} placeholder="GCash, cash" />
        <Field label="Consultation fee (PHP)" type="number" min="0" value={form.consultation_fee} onChange={set('consultation_fee')} disabled={save.busy} hint="Leave blank if there is none on record" />
        <Field label="Reservation fee (PHP)" type="number" min="0" value={form.reservation_fee} onChange={set('reservation_fee')} disabled={save.busy} />
      </div>
      <div className="mt-4">
        <div className="text-xs font-medium text-gray-600 mb-2">Services that need the reservation fee</div>
        <div className="flex flex-wrap gap-2">
          {services.filter((s) => s.active).map((s) => (
            <label key={s.key} className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-full px-3 py-1 cursor-pointer">
              <input type="checkbox" checked={form.reservation_fee_services.includes(s.key)} onChange={() => toggleFeeService(s.key)} disabled={save.busy} />
              {s.name}
            </label>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ── Services & prices ────────────────────────────────────────────────────────
function ServicesSection({ services, onSaved }) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <SectionHeader icon={Scissors} title="Services & prices" />
      <p className="text-xs text-gray-400 mb-4 flex gap-1.5">
        <Info size={13} className="shrink-0 mt-0.5" />
        Keywords are words clients might type for this service (e.g. "kasal", "bride"). They help JAL recognize it. Duration is
        used to block the calendar so bookings don't overlap.
      </p>
      <div className="space-y-3">
        {services.map((s) => (
          <ServiceRow key={s.key} service={s} onSaved={onSaved} />
        ))}
      </div>
      {adding ? (
        <NewServiceRow existing={services} onDone={() => setAdding(false)} onSaved={onSaved} />
      ) : (
        <button onClick={() => setAdding(true)} className="mt-4 flex items-center gap-1.5 text-sm text-pink-500 hover:text-pink-600 font-medium">
          <Plus size={15} /> Add a service
        </button>
      )}
    </div>
  )
}

function serviceForm(s) {
  return {
    name: s.name ?? '',
    price: s.price ?? '',
    duration_minutes: s.duration_minutes ?? 60,
    aliases: listToText(s.aliases),
    description: s.description ?? '',
    show_on_landing: Boolean(s.show_on_landing),
    active: s.active ?? true,
  }
}

function validService(form) {
  if (!form.name.trim()) return 'Service name is required.'
  if (form.price === '' || Number(form.price) < 0) return 'Price must be 0 or more.'
  if (!(Number(form.duration_minutes) > 0)) return 'Duration must be more than 0 minutes.'
  return null
}

function servicePatch(form) {
  return {
    name: form.name.trim(),
    price: Number(form.price),
    duration_minutes: Math.round(Number(form.duration_minutes)),
    aliases: textToList(form.aliases.toLowerCase()),
    description: blankToNull(form.description),
    show_on_landing: form.show_on_landing,
    active: form.active,
  }
}

function ServiceFields({ form, setForm, disabled }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  return (
    <>
      <div className="grid sm:grid-cols-4 gap-3">
        <Field label="Name" value={form.name} onChange={set('name')} disabled={disabled} className="sm:col-span-2" />
        <Field label="Price (PHP)" type="number" min="0" value={form.price} onChange={set('price')} disabled={disabled} />
        <Field label="Duration (minutes)" type="number" min="15" step="15" value={form.duration_minutes} onChange={set('duration_minutes')} disabled={disabled} />
        <Field label="Keywords clients use" value={form.aliases} onChange={set('aliases')} disabled={disabled} className="sm:col-span-2" placeholder="bride, kasal, wedding makeup" />
        <Field label="Short description (website)" value={form.description} onChange={set('description')} disabled={disabled} className="sm:col-span-2" />
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-600">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={form.show_on_landing} onChange={set('show_on_landing')} disabled={disabled} /> Show on website
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={form.active} onChange={set('active')} disabled={disabled} /> Offered (uncheck to hide it from clients)
        </label>
      </div>
    </>
  )
}

function ServiceRow({ service, onSaved }) {
  const [form, setForm] = useState(() => serviceForm(service))
  const save = useSaver(onSaved)
  function submit(e) {
    e.preventDefault()
    const problem = validService(form)
    if (problem) return save.fail(problem)
    save.run(() => businessInfo.saveService(service.key, servicePatch(form)))
  }
  return (
    <form onSubmit={submit} className={`border rounded-xl p-4 ${form.active ? 'border-gray-100' : 'border-dashed border-gray-200 bg-gray-50'}`}>
      <ServiceFields form={form} setForm={setForm} disabled={save.busy} />
      <SaveBar save={save} label="Save service" />
    </form>
  )
}

function NewServiceRow({ existing, onDone, onSaved }) {
  const [form, setForm] = useState(() => serviceForm({ show_on_landing: false }))
  const save = useSaver(async () => {
    await onSaved()
    onDone()
  })
  function submit(e) {
    e.preventDefault()
    const problem = validService(form)
    if (problem) return save.fail(problem)
    const key = serviceKeyFromName(form.name)
    if (key.length < 2) return save.fail('Please use letters or numbers in the name.')
    if (existing.some((s) => s.key === key)) return save.fail(SAVE_ERRORS.duplicate)
    save.run(() => businessInfo.addService({ key, sort_order: existing.length + 1, ...servicePatch(form) }))
  }
  return (
    <form onSubmit={submit} className="border border-pink-200 rounded-xl p-4 mt-4">
      <div className="text-xs font-semibold text-pink-500 mb-3">New service</div>
      <ServiceFields form={form} setForm={setForm} disabled={save.busy} />
      <SaveBar save={save} label="Add service" extra={<button type="button" onClick={onDone} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>} />
    </form>
  )
}

// ── Hours & booking rules ────────────────────────────────────────────────────
function HoursSection({ settings, onSaved }) {
  const [form, setForm] = useState(() => ({
    open_time: settings.open_time.slice(0, 5),
    close_time: settings.close_time.slice(0, 5),
    min_advance_days: settings.min_advance_days,
    cutoff_hours: settings.cutoff_hours,
    slot_interval_minutes: settings.slot_interval_minutes,
  }))
  const save = useSaver(onSaved)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  function submit(e) {
    e.preventDefault()
    if (form.open_time >= form.close_time) return save.fail('Opening time must be before closing time.')
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
    <Section icon={Clock} title="Hours & booking rules" onSubmit={submit} save={save}>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Opens at" type="time" value={form.open_time} onChange={set('open_time')} disabled={save.busy} />
        <Field label="Closes at" type="time" value={form.close_time} onChange={set('close_time')} disabled={save.busy} hint="Services must finish by this time" />
        <Field label="Book at least (days ahead)" type="number" min="0" max="60" value={form.min_advance_days} onChange={set('min_advance_days')} disabled={save.busy} />
        <Field label="Cancel / reschedule notice (hours)" type="number" min="0" max="168" value={form.cutoff_hours} onChange={set('cutoff_hours')} disabled={save.busy} />
        <Field label="Time between start slots (minutes)" type="number" min="15" max="240" step="15" value={form.slot_interval_minutes} onChange={set('slot_interval_minutes')} disabled={save.busy} hint="60 = clients can start at 8:00, 9:00, …" />
      </div>
    </Section>
  )
}

// ── shared bits ──────────────────────────────────────────────────────────────
function useSaver(onSaved) {
  const [state, setState] = useState({ busy: false, ok: null, message: '' })
  return {
    ...state,
    fail: (message) => setState({ busy: false, ok: false, message }),
    run: async (fn) => {
      setState({ busy: true, ok: null, message: '' })
      const r = await fn()
      if (r.ok) {
        setState({ busy: false, ok: true, message: 'Saved' })
        loadCatalogOnce({ refresh: true }) // website/chat on this tab pick up the change
        await onSaved?.()
      } else {
        setState({ busy: false, ok: false, message: SAVE_ERRORS[r.error] ?? `Could not save (${r.error}).` })
      }
    },
  }
}

function Section({ icon, title, onSubmit, save, children }) {
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-gray-100 p-5">
      <SectionHeader icon={icon} title={title} />
      {children}
      <SaveBar save={save} label="Save" />
    </form>
  )
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <h2 className="flex items-center gap-2 font-semibold text-sm text-gray-900 mb-4">
      <Icon size={16} className="text-pink-500" /> {title}
    </h2>
  )
}

function SaveBar({ save, label, extra }) {
  return (
    <div className="flex items-center gap-3 mt-4">
      <button
        type="submit"
        disabled={save.busy}
        className="flex items-center gap-1.5 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-200 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {save.busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {label}
      </button>
      {extra}
      {save.ok === true && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={13} /> {save.message}</span>}
      {save.ok === false && <span className="flex items-center gap-1 text-xs text-red-500"><AlertCircle size={13} /> {save.message}</span>}
    </div>
  )
}

function Field({ label, hint, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        {...props}
        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 disabled:bg-gray-50"
      />
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}

function Banner({ type, text }) {
  const styles = type === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-pink-50 border-pink-100 text-pink-700'
  return <div className={`border text-sm px-4 py-3 rounded-xl ${styles}`}>{text}</div>
}

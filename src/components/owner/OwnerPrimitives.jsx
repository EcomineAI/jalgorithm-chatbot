import { useId } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const KPI_TONES = {
  rose: {
    card: 'bg-gradient-to-br from-rose-50/90 via-white to-pink-50/70 border-pink-100/90',
    iconBox: 'bg-pink-500 text-white shadow-sm shadow-pink-500/20',
    pill: 'bg-pink-100/80 text-pink-700',
    stroke: '#ec4899',
    fill: '#fbcfe8',
  },
  emerald: {
    card: 'bg-gradient-to-br from-emerald-50/85 via-white to-teal-50/50 border-emerald-100/90',
    iconBox: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20',
    pill: 'bg-emerald-100/80 text-emerald-700',
    stroke: '#10b981',
    fill: '#a7f3d0',
  },
  sky: {
    card: 'bg-gradient-to-br from-sky-50/85 via-white to-blue-50/50 border-sky-100/90',
    iconBox: 'bg-sky-500 text-white shadow-sm shadow-sky-500/20',
    pill: 'bg-sky-100/80 text-sky-700',
    stroke: '#0ea5e9',
    fill: '#bae6fd',
  },
  amber: {
    card: 'bg-gradient-to-br from-amber-50/85 via-white to-orange-50/50 border-amber-100/90',
    iconBox: 'bg-amber-500 text-white shadow-sm shadow-amber-500/20',
    pill: 'bg-amber-100/80 text-amber-800',
    stroke: '#f59e0b',
    fill: '#fde68a',
  },
  charcoal: {
    card: 'bg-white border-gray-200/80',
    iconBox: 'bg-gray-800 text-white shadow-sm shadow-gray-800/15',
    pill: 'bg-gray-100 text-gray-700',
    stroke: '#374151',
    fill: '#e5e7eb',
  },
};

function buildSparklineGeometry(series = []) {
  const values = Array.isArray(series) && series.length >= 2 ? series : [0, 0, 0, 0, 0, 0, 0];
  const width = 140;
  const height = 34;
  const padX = 4;
  const padY = 5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - padX * 2) / (values.length - 1);

  const pts = values.map((v, idx) => ({
    x: Number((padX + idx * stepX).toFixed(2)),
    y: Number((height - padY - ((v - min) / span) * (height - padY * 2)).toFixed(2)),
  }));

  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i += 1) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cx = Number(((prev.x + curr.x) / 2).toFixed(2));
    line += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  const area = `${line} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`;
  return { line, area, width, height };
}

export function StatKpiCard({
  label,
  value,
  sublabel,
  badgeText,
  icon: Icon,
  tone = 'rose',
  series,
  onClick,
  active = false,
}) {
  const palette = KPI_TONES[tone] || KPI_TONES.rose;
  const gradId = useId().replace(/:/g, '');
  const hasSeries = Array.isArray(series) && series.length >= 2;
  const spark = hasSeries ? buildSparklineGeometry(series) : null;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`text-left w-full rounded-2xl border p-4 sm:p-5 transition-all shadow-sm ${palette.card} ${
        onClick ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : ''
      } ${active ? 'ring-2 ring-pink-400 border-pink-300' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${palette.iconBox}`}>
          {Icon ? <Icon className="w-5 h-5" /> : null}
        </div>
        {badgeText ? (
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${palette.pill}`}>
            {badgeText}
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-2xl sm:text-[28px] leading-tight font-bold text-gray-900 tracking-tight">
            {value}
          </p>
        </div>
        {sublabel ? (
          <p className="text-xs text-gray-500 mt-1 truncate">{sublabel}</p>
        ) : null}
      </div>

      {spark ? (
        <div className="mt-3 -mx-1">
          <svg
            viewBox={`0 0 ${spark.width} ${spark.height}`}
            className="w-full h-8 overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`spark-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.fill} stopOpacity="0.55" />
                <stop offset="100%" stopColor={palette.fill} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={spark.area} fill={`url(#spark-${gradId})`} />
            <path
              d={spark.line}
              fill="none"
              stroke={palette.stroke}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      ) : null}
    </Tag>
  );
}

export function ActionTileButton({ icon: Icon, label, hint, onClick, accent = 'rose' }) {
  const accents = {
    rose: 'bg-pink-50 text-pink-600 group-hover:bg-pink-500 group-hover:text-white',
    emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white',
    sky: 'bg-sky-50 text-sky-600 group-hover:bg-sky-500 group-hover:text-white',
    amber: 'bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3.5 w-full text-left bg-white hover:bg-rose-50/40 border border-pink-100/90 hover:border-pink-300 rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md transition-all min-h-[58px]"
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
          accents[accent] || accents.rose
        }`}
      >
        {Icon ? <Icon className="w-5 h-5" /> : null}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{label}</p>
        {hint ? <p className="text-[11px] text-gray-500 truncate mt-0.5">{hint}</p> : null}
      </div>
    </button>
  );
}

const STATUS_BADGES = {
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rescheduled: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-sky-50 text-sky-700 border-sky-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  no_show: 'bg-gray-100 text-gray-600 border-gray-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_LABELS = {
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  active: 'Active',
  inactive: 'Hidden',
};

export function StatusBadge({ status }) {
  const key = String(status || 'confirmed').toLowerCase();
  const cls = STATUS_BADGES[key] || STATUS_BADGES.confirmed;
  const text = STATUS_LABELS[key] || key;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {text}
    </span>
  );
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const confirmCls =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/20'
      : 'bg-pink-500 hover:bg-pink-600 text-white shadow-sm shadow-pink-500/25';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl border border-pink-100 shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            {description ? (
              <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close confirmation modal"
            className="w-9 h-9 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 min-h-[42px] rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-5 min-h-[42px] rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${confirmCls}`}
          >
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaginationBar({
  page,
  totalPages,
  total,
  startIndex,
  endIndex,
  onPageChange,
  itemLabel = 'items',
}) {
  if (!total || totalPages <= 1) {
    return total > 0 ? (
      <div className="px-5 py-3 border-t border-pink-100/70 bg-rose-50/25 flex items-center justify-between text-xs text-gray-500">
        <span>
          Showing {startIndex + 1} to {endIndex} of {total} {itemLabel}
        </span>
      </div>
    ) : null;
  }

  return (
    <div className="px-5 py-3.5 border-t border-pink-100/70 bg-rose-50/25 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs font-medium text-gray-500">
        Showing <span className="font-semibold text-gray-800">{startIndex + 1}</span> to{' '}
        <span className="font-semibold text-gray-800">{endIndex}</span> of{' '}
        <span className="font-semibold text-gray-800">{total}</span> {itemLabel}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 px-3 min-h-[36px] rounded-xl border border-pink-100 bg-white text-xs font-semibold text-gray-700 hover:bg-pink-50 disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>
        <span className="px-2.5 text-xs font-semibold text-gray-700">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 px-3 min-h-[36px] rounded-xl border border-pink-100 bg-white text-xs font-semibold text-gray-700 hover:bg-pink-50 disabled:opacity-40 disabled:pointer-events-none"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function SettingsCard({ title, description, badge, actions, children }) {
  return (
    <section className="bg-white rounded-2xl border border-pink-100/90 shadow-sm overflow-hidden">
      {(title || description || actions) && (
        <div className="px-6 py-5 border-b border-pink-100/70 bg-gradient-to-r from-rose-50/40 via-white to-white flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">{title}</h3>
              {badge ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-pink-50 text-pink-600 border border-pink-100">
                  {badge}
                </span>
              ) : null}
            </div>
            {description ? (
              <p className="text-xs sm:text-sm text-gray-500 mt-1">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
        </div>
      )}
      <div className="p-6 space-y-5">{children}</div>
    </section>
  );
}

export function FormField({
  label,
  hint,
  error,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  className = '',
  ...rest
}) {
  return (
    <div className={className}>
      {label ? (
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      ) : null}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-shadow disabled:bg-gray-50 disabled:text-gray-500 ${
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
            : 'border-pink-100 focus:border-pink-400 focus:ring-pink-200'
        }`}
        {...rest}
      />
      {error ? (
        <p className="text-xs font-medium text-rose-600 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormTextArea({
  label,
  hint,
  error,
  value,
  onChange,
  rows = 3,
  placeholder,
  disabled = false,
  className = '',
}) {
  return (
    <div className={className}>
      {label ? (
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      ) : null}
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-shadow disabled:bg-gray-50 disabled:text-gray-500 ${
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
            : 'border-pink-100 focus:border-pink-400 focus:ring-pink-200'
        }`}
      />
      {error ? (
        <p className="text-xs font-medium text-rose-600 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormSelect({
  label,
  hint,
  value,
  onChange,
  options = [],
  disabled = false,
  className = '',
}) {
  return (
    <div className={className}>
      {label ? (
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      ) : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-pink-100 text-sm text-gray-900 bg-white focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition-shadow disabled:bg-gray-50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint ? <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p> : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  className = '',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-5 min-h-[44px] rounded-xl bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white text-sm font-semibold shadow-sm shadow-pink-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  className = '',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-xl border border-pink-200 bg-white hover:bg-pink-50/70 text-gray-800 text-sm font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none ${className}`}
    >
      {children}
    </button>
  );
}

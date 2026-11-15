import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export function StatKpiCard({
  label,
  value,
  sublabel,
  badgeText,
  onClick,
  active = false,
}) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`text-left w-full min-w-0 rounded-xl border bg-white p-4 sm:p-5 transition-[border-color,background-color] duration-150 ${
        onClick ? 'hover:border-stone-300 cursor-pointer' : ''
      } ${active ? 'border-pink-600 ring-1 ring-pink-200 bg-[#fdfcfa]' : 'border-stone-200/80'}`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className="text-xs font-medium text-stone-500 truncate">{label}</p>
        {badgeText ? (
          <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-xs font-medium tabular-nums truncate shrink-0">
            {badgeText}
          </span>
        ) : null}
      </div>

      <p className="mt-2.5 text-2xl sm:text-[28px] leading-none font-medium text-stone-900 tabular-nums truncate">
        {value}
      </p>

      {sublabel ? (
        <p className="text-xs text-stone-500 mt-2 truncate">{sublabel}</p>
      ) : null}
    </Tag>
  );
}

export function ActionTileButton({ icon: Icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 w-full min-w-0 text-left bg-white hover:bg-[#fdfcfa] border border-stone-200/80 hover:border-pink-300 rounded-xl px-3.5 py-3 transition-[background-color,border-color] duration-150 min-h-14"
    >
      <div className="w-9 h-9 rounded-lg bg-stone-100 text-stone-700 group-hover:bg-pink-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
        {Icon ? <Icon className="w-4 h-4" strokeWidth={1.75} /> : null}
      </div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-medium text-stone-900 truncate">{label}</p>
        {hint ? <p className="text-xs text-stone-500 truncate mt-0.5">{hint}</p> : null}
      </div>
    </button>
  );
}

const STATUS_BADGES = {
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rescheduled: 'bg-amber-50 text-amber-800 border-amber-200',
  completed: 'bg-stone-100 text-stone-700 border-stone-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  no_show: 'bg-stone-100 text-stone-600 border-stone-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-stone-100 text-stone-600 border-stone-200',
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium whitespace-nowrap ${cls}`}
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
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : 'bg-pink-600 hover:bg-pink-700 text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/45 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-medium text-stone-900">{title}</h3>
            {description ? (
              <p className="text-xs sm:text-sm text-stone-600 mt-1.5 leading-relaxed">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close confirmation modal"
            className="w-9 h-9 rounded-lg border border-stone-200 text-stone-500 hover:text-stone-700 hover:bg-stone-50 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="w-full sm:w-auto px-4 min-h-11 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-sm font-medium text-stone-700 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`w-full sm:w-auto px-5 min-h-11 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${confirmCls}`}
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
      <div className="px-4 sm:px-5 py-3 border-t border-stone-200/80 bg-[#fdfcfa] flex items-center justify-between text-xs text-stone-500 tabular-nums">
        <span>
          Showing {startIndex + 1} to {endIndex} of {total} {itemLabel}
        </span>
      </div>
    ) : null;
  }

  return (
    <div className="px-4 sm:px-5 py-3 border-t border-stone-200/80 bg-[#fdfcfa] flex flex-wrap items-center justify-between gap-2 sm:gap-3">
      <p className="text-xs font-normal text-stone-500 tabular-nums">
        Showing <span className="font-medium text-stone-800">{startIndex + 1}</span> to{' '}
        <span className="font-medium text-stone-800">{endIndex}</span> of{' '}
        <span className="font-medium text-stone-800">{total}</span> {itemLabel}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 px-3 min-h-9 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>
        <span className="px-2 text-xs font-medium text-stone-700 tabular-nums whitespace-nowrap">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 px-3 min-h-9 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
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
    <section className="bg-white rounded-xl border border-stone-200/80">
      {(title || description || actions) && (
        <div className="px-4 py-4 sm:px-6 sm:py-5 rounded-t-xl border-b border-stone-200/80 bg-[#fdfcfa] flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-medium text-stone-900">{title}</h3>
              {badge ? (
                <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200 tabular-nums">
                  {badge}
                </span>
              ) : null}
            </div>
            {description ? (
              <p className="text-xs sm:text-sm text-stone-500 mt-1">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
        </div>
      )}
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">{children}</div>
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
        <label className="block text-xs font-medium text-stone-700 mb-1.5">{label}</label>
      ) : null}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full min-h-11 px-3.5 py-2.5 rounded-lg border text-sm text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 transition-shadow disabled:bg-stone-50 disabled:text-stone-500 ${
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
            : 'border-stone-200 focus:border-pink-400 focus:ring-pink-100'
        }`}
        {...rest}
      />
      {error ? (
        <p className="text-xs font-medium text-rose-600 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-stone-500 mt-1.5">{hint}</p>
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
        <label className="block text-xs font-medium text-stone-700 mb-1.5">{label}</label>
      ) : null}
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 transition-shadow disabled:bg-stone-50 disabled:text-stone-500 ${
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
            : 'border-stone-200 focus:border-pink-400 focus:ring-pink-100'
        }`}
      />
      {error ? (
        <p className="text-xs font-medium text-rose-600 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-stone-500 mt-1.5">{hint}</p>
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
        <label className="block text-xs font-medium text-stone-700 mb-1.5">{label}</label>
      ) : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full min-h-11 px-3.5 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-shadow disabled:bg-stone-50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint ? <p className="text-xs text-stone-500 mt-1.5">{hint}</p> : null}
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
      className={`btn-press inline-flex items-center justify-center gap-2 px-5 min-h-11 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium disabled:opacity-50 disabled:pointer-events-none ${className}`}
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
      className={`inline-flex items-center justify-center gap-2 px-4 min-h-11 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${className}`}
    >
      {children}
    </button>
  );
}

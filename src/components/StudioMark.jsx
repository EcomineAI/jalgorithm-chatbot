const SIZE_CLASSES = {
  xs: { box: 'w-7 h-7 rounded-lg', svg: 13 },
  sm: { box: 'w-8 h-8 rounded-lg', svg: 15 },
  md: { box: 'w-9 h-9 rounded-xl', svg: 17 },
  lg: { box: 'w-12 h-12 rounded-xl', svg: 22 },
}

const TONE_CLASSES = {
  blush: 'bg-pink-600 text-white',
  dark: 'bg-gray-900 text-pink-300',
  soft: 'bg-pink-50 text-pink-700 border border-pink-200',
}

/**
 * Flat studio monogram emblem shared across Website, Chat, Owner, and Dev views.
 */
export default function StudioMark({ size = 'sm', tone = 'blush', roundedFull = false, className = '' }) {
  const s = SIZE_CLASSES[size] || SIZE_CLASSES.sm
  const t = TONE_CLASSES[tone] || TONE_CLASSES.blush

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center shrink-0 ${s.box} ${
        roundedFull ? 'rounded-full' : ''
      } ${t} ${className}`}
    >
      <svg
        width={s.svg}
        height={s.svg}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5.5 6.5L12 18.5L18.5 6.5" />
        <path d="M9.5 6.5L12 11.2L14.5 6.5" />
      </svg>
    </span>
  )
}

import './Skeleton.css'

type Variant = 'text' | 'block' | 'circle' | 'chip'

interface SkeletonProps {
  /** Shape preset. */
  variant?: Variant
  width?: string | number
  height?: string | number
  /** Border radius override. */
  radius?: string | number
  className?: string
  style?: React.CSSProperties
}

/** A single shimmering placeholder block. */
export default function Skeleton({
  variant = 'block',
  width,
  height,
  radius,
  className = '',
  style,
}: SkeletonProps) {
  return (
    <span
      className={`skeleton skeleton--${variant} ${className}`}
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  )
}

/** A stack of text-line skeletons; the last line is shortened for realism. */
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number
  className?: string
}) {
  return (
    <span className={`skeleton-text ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 && lines > 1 ? '60%' : '100%'}
        />
      ))}
    </span>
  )
}

/**
 * Accessible wrapper that swaps skeletons for real content once loaded.
 * Announces the busy state to assistive tech via aria-busy.
 */
export function SkeletonBoundary({
  loading,
  fallback,
  children,
  label = 'Loading',
}: {
  loading: boolean
  fallback: React.ReactNode
  children: React.ReactNode
  label?: string
}) {
  return (
    <div aria-busy={loading} aria-live="polite">
      {loading ? (
        <div role="status" aria-label={label}>
          {fallback}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

import { useCallback, useEffect, useState, type AnchorHTMLAttributes } from 'react'

export interface LocationState {
  path: string
  search: string
  hash: string
}

function parseLocation(): LocationState {
  const { pathname, search, hash } = window.location
  const path = pathname.replace(/\/+$/, '') || '/'
  return { path, search, hash }
}

function isExternal(href: string) {
  return /^(https?:)?\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Scroll to an element by id. The target may not exist yet when navigating
 * across pages (the destination renders after the location change), so retry
 * across a few animation frames before giving up.
 */
function scrollToHash(id: string, attemptsLeft = 10) {
  if (!id) return
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'

  if (id === 'top') {
    window.scrollTo({ top: 0, behavior })
    return
  }

  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior, block: 'start' })
    return
  }
  if (attemptsLeft > 0) {
    requestAnimationFrame(() => scrollToHash(id, attemptsLeft - 1))
  }
}

export function navigate(to: string, options?: { replace?: boolean }) {
  const [pathPart, hash] = to.split('#', 2)
  const current = window.location.pathname.replace(/\/+$/, '') || '/'
  const target = (pathPart || '').replace(/\/+$/, '') || '/'
  const samePage = target === current

  // Same-page hash jump: no history entry needed beyond updating the hash.
  if (samePage && hash) {
    window.history.replaceState({}, '', to)
    scrollToHash(hash)
    return
  }

  if (options?.replace) {
    window.history.replaceState({}, '', to)
  } else {
    window.history.pushState({}, '', to)
  }
  window.dispatchEvent(new PopStateEvent('popstate'))

  if (hash) {
    // Wait for the routed page to mount before scrolling to the anchor.
    requestAnimationFrame(() => scrollToHash(hash))
  } else {
    window.scrollTo(0, 0)
  }
}

export function useLocation(): LocationState {
  const [location, setLocation] = useState<LocationState>(parseLocation)

  useEffect(() => {
    const onPop = () => setLocation(parseLocation())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return location
}

export function useIsActive(to: string): boolean {
  const { path } = useLocation()
  const target = to.split('#')[0].replace(/\/+$/, '') || '/'
  const current = path.replace(/\/+$/, '') || '/'
  if (target === '/') return current === '/'
  return current === target || current.startsWith(target + '/')
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e)
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return
      }
      if (isExternal(to)) return
      e.preventDefault()
      navigate(to)
    },
    [to, onClick],
  )

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}

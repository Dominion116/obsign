import { useEffect, useState, type ReactNode } from 'react'
import { Link, useIsActive } from '../lib/router'
import './Nav.css'

export interface NavItem {
  label: string
  href: string
}

export interface NavProps {
  /** Destination for the brand/logo (landing page for app, top for landing). */
  brandTo: string
  /** Primary navigation items. */
  links: NavItem[]
  /** Optional primary call-to-action shown on the right. */
  cta?: { label: string; to: string }
  /** Optional custom controls rendered in the right-hand actions area. */
  right?: ReactNode
  /** Optional control rendered in the fixed action area of the mobile menu. */
  mobileAction?: ReactNode
}

function NavLink({
  item,
  className,
  onNavigate,
}: {
  item: NavItem
  className?: string
  onNavigate?: () => void
}) {
  // Only page links (no hash target) receive an active state.
  const isPage = !item.href.includes('#')
  const active = useIsActive(item.href) && isPage
  return (
    <Link
      to={item.href}
      className={className}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
    >
      {item.label}
    </Link>
  )
}

/**
 * Shared, prop-driven navigation shell. Landing and app surfaces compose it
 * with their own link sets (see LandingNav / AppNav).
 */
export default function Nav({ brandTo, links, cta, right, mobileAction }: NavProps) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll() // check on initial mount
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    // Lock body scroll when mobile menu is open
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <div className="nav__bar container">
        <Link className="nav__brand" to={brandTo} aria-label="Obsign home">
          <img
            className="nav__brand-icon"
            src="/favicon.svg"
            alt="Obsign"
            width={36}
            height={36}
          />
        </Link>

        <nav className="nav__links" aria-label="Primary">
          {links.map((l) => (
            <NavLink key={l.href} item={l} className="nav__link" />
          ))}
        </nav>

        <div className="nav__actions">
          {cta && (
            <Link className="btn btn--primary nav__cta" to={cta.to}>
              {cta.label}
            </Link>
          )}

          {right}

          <button
            className="nav__toggle"
            aria-expanded={open}
            aria-controls="nav-sheet"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="nav__burger" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>
        </div>
      </div>

      <div
        id="nav-sheet"
        className={`nav__sheet ${open ? 'nav__sheet--open' : ''}`}
        aria-hidden={!open}
      >
        <nav className="nav__sheet-links" aria-label="Mobile">
          {links.map((l) => (
            <NavLink key={l.href} item={l} onNavigate={() => setOpen(false)} />
          ))}
        </nav>
        {(cta || mobileAction) && (
          <div className="nav__sheet-actions">
            {mobileAction}
            {cta && (
              <Link
                className="btn btn--primary nav__sheet-cta"
                to={cta.to}
                onClick={() => setOpen(false)}
              >
                {cta.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

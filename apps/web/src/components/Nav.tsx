import { useEffect, useState } from 'react'
import { Link, useIsActive } from '../lib/router'
import './Nav.css'

interface NavItem {
  label: string
  href: string
}

// Section links resolve to the landing page first (`/#…`) so they work from
// any route, not just the homepage.
const LINKS: NavItem[] = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Verify', href: '/verify' },
  { label: 'Issuers', href: '/credentials' },
  { label: 'Docs', href: '/docs' },
]

function NavLink({ item, className, onNavigate }: { item: NavItem; className?: string; onNavigate?: () => void }) {
  // Only page links (no hash target) get an active state.
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

export default function Nav() {
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
        <Link className="nav__brand" to="/#top" aria-label="Obsign home">
          <span className="nav__brand-mark" aria-hidden="true">o</span>
          <span className="nav__brand-name">Obsign</span>
        </Link>

        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((l) => (
            <NavLink key={l.href} item={l} className="nav__link" />
          ))}
        </nav>

        <div className="nav__actions">
          {/* This CTA is now hidden on mobile via CSS to prevent squeezing */}
          <Link className="btn btn--primary nav__cta" to="/verify">
            Verify a credential
          </Link>
          
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
          {LINKS.map((l) => (
            <NavLink key={l.href} item={l} onNavigate={() => setOpen(false)} />
          ))}
          <Link
            className="btn btn--primary nav__sheet-cta"
            to="/verify"
            onClick={() => setOpen(false)}
          >
            Verify a credential
          </Link>
        </nav>
      </div>
    </header>
  )
}
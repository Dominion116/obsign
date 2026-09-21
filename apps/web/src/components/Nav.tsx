import { useEffect, useState } from 'react'
import './Nav.css'

const LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Verify', href: '#verify' },
  { label: 'Modules', href: '#modules' },
  { label: 'Developers', href: '#developers' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <div className="nav__bar container">
        <a className="nav__brand" href="#top" aria-label="Obsign home">
          <span className="nav__brand-mark" aria-hidden="true">o</span>
          <span className="nav__brand-name">Obsign</span>
        </a>

        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.href} className="nav__link" href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="nav__actions">
          <a className="btn btn--primary nav__cta" href="#verify">
            Verify a credential
          </a>
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
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a
            className="btn btn--primary nav__sheet-cta"
            href="#verify"
            onClick={() => setOpen(false)}
          >
            Verify a credential
          </a>
        </nav>
      </div>
    </header>
  )
}
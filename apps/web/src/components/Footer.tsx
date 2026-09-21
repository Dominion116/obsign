import { Link } from '../lib/router'
import './Footer.css'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Verify', href: '/app/verify' },
      { label: 'Issue', href: '/app/issue' },
      { label: 'Credentials', href: '/app/credentials' },
      { label: 'Docs', href: '/app/docs' },
      { label: 'Status', href: '/app/status' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'GitHub', href: '#' },
      { label: 'npm', href: '#' },
      { label: 'MCP', href: '/app/docs#mcp' },
      { label: 'Contract', href: '/app/docs' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <img
              className="footer__icon"
              src="/favicon.svg"
              alt=""
              aria-hidden="true"
              width={40}
              height={40}
            />
            <div>
              <p className="footer__word">Obsign</p>
              <p className="footer__tag">
                Verifiable credentials that anyone can recompute for themselves, without
                trusting a central server.
              </p>
            </div>
          </div>

          <nav className="footer__cols" aria-label="Footer">
            {COLUMNS.map((c) => (
              <div key={c.title} className="footer__col">
                <h3 className="footer__col-title">{c.title}</h3>
                <ul>
                  {c.links.map((l) => (
                    <li key={l.label}>
                      {l.href === '#' ? (
                        // Placeholder link that is not yet wired to a destination.
                        <a href={l.href} aria-disabled="true">
                          {l.label}
                        </a>
                      ) : (
                        <Link to={l.href}>{l.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <span className="footer__badge">Base Sepolia</span>
        </div>

        <div className="footer__bottom">
          <p className="footer__copy">© {new Date().getFullYear()} Obsign.</p>
          {/* <p className="footer__proof">
            Proof, not promises · <span className="script-accent footer__script">build on Base</span>
          </p> */}
        </div>
      </div>
    </footer>
  )
}

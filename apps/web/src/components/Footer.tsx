import './Footer.css'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Verify', href: '#verify' },
      { label: 'Issue', href: '/issue' },
      { label: 'Docs', href: '/docs' },
      { label: 'Status', href: '/status' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'GitHub', href: '#' },
      { label: 'npm', href: '#' },
      { label: 'MCP', href: '#' },
      { label: 'Contract', href: '#' },
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
            <div>
              <p className="footer__word">Obsign</p>
              <p className="footer__tag">Credentials anyone can recompute.</p>
            </div>
          </div>

          <nav className="footer__cols" aria-label="Footer">
            {COLUMNS.map((c) => (
              <div key={c.title} className="footer__col">
                <h3 className="footer__col-title">{c.title}</h3>
                <ul>
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href}>{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <span className="footer__badge">Base Sepolia</span>
        </div>

        <div className="footer__bottom">
          <p className="footer__copy">© {new Date().getFullYear()} Obsign. Open spec, open receipts.</p>
          <p className="footer__proof">
            Proof, not promises · <span className="script-accent footer__script">build on Base</span>
          </p>
        </div>
      </div>
    </footer>
  )
}

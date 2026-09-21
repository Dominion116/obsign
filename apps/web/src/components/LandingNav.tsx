import Nav, { type NavItem } from './Nav'

// In-page section anchors for the marketing landing page.
const LINKS: NavItem[] = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Modules', href: '/#modules' },
  { label: 'Pricing', href: '/#pricing' },
]

export default function LandingNav() {
  return (
    <Nav
      brandTo="/#top"
      links={LINKS}
      cta={{ label: 'Verify a credential', to: '/app/verify' }}
    />
  )
}

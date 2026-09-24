import Nav, { type NavItem } from './Nav'
import WalletControls from './WalletControls'

// Cross-page navigation between the functional /app surfaces.
const LINKS: NavItem[] = [
  { label: 'Verify', href: '/app/verify' },
  { label: 'Issue', href: '/app/issue' },
  { label: 'Credentials', href: '/app/credentials' },
  { label: 'Sentinel', href: '/app/sentinel' },
  { label: 'Docs', href: '/app/docs' },
  { label: 'Status', href: '/app/status' },
]

export default function AppNav() {
  // The brand/logo is the primary way back to the landing page.
  return (
    <Nav
      brandTo="/"
      links={LINKS}
      right={<WalletControls />}
      mobileAction={<WalletControls />}
    />
  )
}

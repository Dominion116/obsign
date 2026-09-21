import { useEffect } from 'react'
import Nav from './components/Nav'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import Modules from './components/Modules'
import CTA from './components/CTA'
import Footer from './components/Footer'
import VerifyPage from './pages/VerifyPage'
import IssuePage from './pages/IssuePage'
import DocsPage from './pages/DocsPage'
import StatusPage from './pages/StatusPage'
import CredentialsPage from './pages/CredentialsPage'
import ReceiptPage from './pages/ReceiptPage'
import NotFoundPage from './pages/NotFoundPage'
import { useLocation } from './lib/router'

const TITLES: Record<string, string> = {
  '/': 'Obsign — Credentials anyone can recompute.',
  '/verify': 'Verify a credential — Obsign',
  '/issue': 'Issue credentials — Obsign',
  '/docs': 'Documentation — Obsign',
  '/status': 'System status — Obsign',
  '/credentials': 'Issuer dashboard — Obsign',
}

export function resolvePage(path: string) {
  if (path === '/') return { page: <Hero />, title: TITLES['/'] }
  if (path === '/verify') return { page: <VerifyPage />, title: TITLES['/verify'] }
  if (path === '/issue') return { page: <IssuePage />, title: TITLES['/issue'] }
  if (path === '/docs') return { page: <DocsPage />, title: TITLES['/docs'] }
  if (path === '/status') return { page: <StatusPage />, title: TITLES['/status'] }
  if (path === '/credentials') return { page: <CredentialsPage />, title: TITLES['/credentials'] }

  const receipt = path.match(/^\/receipt\/(.+)$/)
  if (receipt) {
    const id = decodeURIComponent(receipt[1])
    return { page: <ReceiptPage receiptId={id} />, title: `Receipt ${id.slice(0, 12)}… — Obsign` }
  }

  return { page: <NotFoundPage />, title: 'Page not found — Obsign' }
}

export default function App() {
  const { path } = useLocation()
  const { page, title } = resolvePage(path)

  useEffect(() => {
    document.title = title
  }, [title])

  const isLanding = path === '/'

  return (
    <>
      <Nav />
      {isLanding ? (
        <main>
          <Hero />
          <HowItWorks />
          <Modules />
          <CTA />
        </main>
      ) : (
        page
      )}
      <Footer />
    </>
  )
}

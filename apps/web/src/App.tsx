import { useEffect } from 'react'
import LandingNav from './components/LandingNav'
import AppNav from './components/AppNav'
import Hero from './components/Hero'
import About from './components/About'
import HowItWorks from './components/HowItWorks'
import Modules from './components/Modules'
import CTA from './components/CTA'
import FAQ from './components/FAQ'
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
  '/': 'Obsign · Credentials anyone can recompute',
  '/app/verify': 'Verify a credential · Obsign',
  '/app/issue': 'Issue credentials · Obsign',
  '/app/docs': 'Documentation · Obsign',
  '/app/status': 'System status · Obsign',
  '/app/credentials': 'Issuer dashboard · Obsign',
}

interface Resolved {
  page: React.ReactNode
  title: string
  /** Which surface this route belongs to. */
  surface: 'landing' | 'app'
}

export function resolvePage(path: string): Resolved {
  if (path === '/') return { page: <Hero />, title: TITLES['/'], surface: 'landing' }

  // Functional application surfaces live under /app.
  if (path === '/app' || path === '/app/verify')
    return { page: <VerifyPage />, title: TITLES['/app/verify'], surface: 'app' }
  if (path === '/app/issue')
    return { page: <IssuePage />, title: TITLES['/app/issue'], surface: 'app' }
  if (path === '/app/docs')
    return { page: <DocsPage />, title: TITLES['/app/docs'], surface: 'app' }
  if (path === '/app/status')
    return { page: <StatusPage />, title: TITLES['/app/status'], surface: 'app' }
  if (path === '/app/credentials')
    return { page: <CredentialsPage />, title: TITLES['/app/credentials'], surface: 'app' }

  const receipt = path.match(/^\/app\/receipt\/(.+)$/)
  if (receipt) {
    const id = decodeURIComponent(receipt[1])
    return {
      page: <ReceiptPage receiptId={id} />,
      title: `Receipt ${id.slice(0, 12)}… · Obsign`,
      surface: 'app',
    }
  }

  return { page: <NotFoundPage />, title: 'Page not found · Obsign', surface: 'app' }
}

export default function App() {
  const { path } = useLocation()
  const { page, title, surface } = resolvePage(path)

  useEffect(() => {
    document.title = title
  }, [title])

  if (surface === 'landing') {
    return (
      <>
        <LandingNav />
        <main>
          <Hero />
          <About />
          <HowItWorks />
          <Modules />
          <CTA />
          <FAQ />
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <AppNav />
      {page}
      <Footer />
    </>
  )
}

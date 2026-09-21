import { useEffect, useState } from 'react'
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

function currentPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

export default function App() {
  const [path, setPath] = useState<string>(currentPath())

  useEffect(() => {
    const onPop = () => setPath(currentPath())
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]')
      if (!anchor || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const href = anchor.getAttribute('href') as string | null
      if (!href || !href.startsWith('/') || href.startsWith('//') || href.startsWith('/#')) return
      e.preventDefault()
      history.pushState({}, '', href)
      setPath(currentPath())
      const hashIndex = href.indexOf('#')
      if (hashIndex !== -1) {
        const el = document.getElementById(href.slice(hashIndex + 1))
        if (el) el.scrollIntoView()
      } else {
        window.scrollTo(0, 0)
      }
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('click', onClick)
    }
  }, [])

  const isVerify = path === '/verify'
  const isIssue = path === '/issue'
  const isDocs = path === '/docs'
  const isStatus = path === '/status'
  const isCredentials = path === '/credentials'

  const receiptMatch = path.match(/^\/receipt\/(.+)$/)

  const page = isVerify
    ? <VerifyPage />
    : isIssue
      ? <IssuePage />
      : isDocs
        ? <DocsPage />
        : isStatus
          ? <StatusPage />
          : isCredentials
            ? <CredentialsPage />
            : receiptMatch
              ? <ReceiptPage receiptId={decodeURIComponent(receiptMatch[1])} />
              : null

  return (
    <>
      <Nav />
      {page ?? (
        <main>
          <Hero />
          <HowItWorks />
          <Modules />
          <CTA />
        </main>
      )}
      <Footer />
    </>
  )
}

// Wallet + SIWE controls for the app nav (P3-1/P3-2). RainbowKit handles the
// connect UI; the "Sign in" button performs the SIWE handshake once connected.

import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useSession } from '../lib/session'

export default function WalletControls() {
  const { isConnected, hasSession, login, logout } = useSession()
  const [busy, setBusy] = useState(false)
  const [signedIn, setSignedIn] = useState(hasSession)

  async function onSignIn() {
    setBusy(true)
    try {
      await login()
      setSignedIn(true)
    } catch {
      setSignedIn(false)
    } finally {
      setBusy(false)
    }
  }

  function onSignOut() {
    logout()
    setSignedIn(false)
  }

  return (
    <div className="nav__wallet">
      <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      {isConnected &&
        (signedIn ? (
          <button type="button" className="btn btn--secondary" onClick={onSignOut}>
            Sign out
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => void onSignIn()} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        ))}
    </div>
  )
}

// Wallet + SIWE controls for the app nav (P3-1/P3-2). RainbowKit handles the
// connect UI; the "Sign in" button performs the SIWE handshake once connected.

import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useSession } from '../lib/session'

function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        if (!mounted || !account || !chain) {
          return (
            <button type="button" className="btn btn--primary nav__connect" onClick={openConnectModal}>
              Connect wallet
            </button>
          )
        }

        if (chain.unsupported) {
          return (
            <button type="button" className="btn btn--primary nav__connect" onClick={openChainModal}>
              Wrong network
            </button>
          )
        }

        return (
          <button type="button" className="btn btn--secondary nav__account" onClick={openAccountModal}>
            {account.displayName}
          </button>
        )
      }}
    </ConnectButton.Custom>
  )
}

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
      <WalletButton />
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

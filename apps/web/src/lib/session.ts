// SIWE login hook (P3-2). Builds an EIP-4361 message with a server-issued nonce,
// asks the connected wallet to personal_sign it, and exchanges the signature for
// a session JWT. No key material leaves the wallet.

import { useEffect, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { SiweMessage } from 'siwe'
import { backend, getSessionToken, setSessionToken, SESSION_EVENT } from './backend'
import { CHAIN } from './wagmi'

export function useSession() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [hasSession, setHasSession] = useState<boolean>(() => getSessionToken() !== null)

  // Keep hasSession reactive: sign-in/out anywhere (this tab or another) updates it.
  useEffect(() => {
    const sync = () => setHasSession(getSessionToken() !== null)
    window.addEventListener(SESSION_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SESSION_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  async function login(): Promise<string> {
    if (!address) throw new Error('Connect a wallet before signing in')
    const { nonce } = await backend.siweNonce()
    const message = new SiweMessage({
      domain: window.location.host,
      address,
      uri: window.location.origin,
      version: '1',
      chainId: CHAIN.id,
      nonce,
      statement: 'Sign in to Obsign.',
      issuedAt: new Date().toISOString(),
    }).prepareMessage()
    const signature = await signMessageAsync({ message })
    const res = await backend.siweVerify(message, signature)
    setSessionToken(res.token)
    return res.address
  }

  function logout(): void {
    setSessionToken(null)
  }

  return { address, isConnected, hasSession, login, logout }
}

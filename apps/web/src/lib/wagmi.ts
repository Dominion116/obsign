// wagmi + RainbowKit configuration for Base Sepolia (P3-1). Issuers connect
// their own wallet; the app holds no keys.

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia } from 'wagmi/chains'
import { http } from 'wagmi'

const projectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ?? ''

export const CHAIN = baseSepolia

export const wagmiConfig = getDefaultConfig({
  appName: 'Obsign',
  projectId,
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
  ssr: false,
})

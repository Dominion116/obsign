/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_CHAIN_ID?: string
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_ANCHOR_ADDRESS?: string
  readonly VITE_REVOCATION_ADDRESS?: string
  readonly VITE_ISSUER_REGISTRY_ADDRESS?: string
  readonly VITE_POLICY_REGISTRY_ADDRESS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

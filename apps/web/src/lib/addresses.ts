// Resolve deployed Obsign contract addresses for the client. The committed
// deployments file is the source of truth (INV-6 / precondition 2); env
// overrides (VITE_*) are honored for local experiments. resolveAddresses throws
// on zero placeholders, so the UI fails fast before attempting a write.

import { resolveAddresses, type ObsignAddresses } from '@obsign/sdk'
import deployments from '../../../../contracts/deployments/84532.json'

export function getAddresses(): ObsignAddresses {
  const env = import.meta.env
  return resolveAddresses(deployments, {
    anchor: env.VITE_ANCHOR_ADDRESS as `0x${string}` | undefined,
    revocation: env.VITE_REVOCATION_ADDRESS as `0x${string}` | undefined,
    issuerRegistry: env.VITE_ISSUER_REGISTRY_ADDRESS as `0x${string}` | undefined,
    policyRegistry: env.VITE_POLICY_REGISTRY_ADDRESS as `0x${string}` | undefined,
  })
}

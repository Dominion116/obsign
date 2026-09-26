import './Legal.css'

interface LegalBlock {
  heading: string
  body?: string[]
  list?: string[]
}

const UPDATED = 'Last updated: September 26, 2026'

const SECTIONS: LegalBlock[] = [
  {
    heading: 'Information you provide',
    body: ['When you use Obsign, you may submit the following:'],
    list: [
      'Wallet address. You connect a self-custodial wallet and sign in using Sign-In with Ethereum. Your public wallet address identifies you as an issuer or a caller. Obsign never receives or stores your private keys.',
      'Credentials and evidence. When you issue a credential, you provide the claim and one machine-checkable evidence module, such as an artifact hash, an on-chain event reference, or a quorum of signatures. Evidence files you upload are stored so their hash can be recomputed later.',
      'Verification requests. When you verify a credential, you submit the credential identifier and its inputs so the deterministic core can produce a receipt.',
    ],
  },
  {
    heading: 'Information created automatically',
    list: [
      'Receipts. Each verification produces a receipt containing hashes, a result, and a reason code. Receipts are designed for public sharing and can be recomputed by anyone from the same inputs.',
      'Payment records. Paid verification uses the x402 protocol with test USDC on Base Sepolia. The settlement is recorded on the public blockchain, and the payment recipient is the configured Obsign service payee.',
      'Operational logs. We keep limited records, such as sign-in events and request activity, to run the service, monitor its health, and prevent abuse.',
    ],
  },
  {
    heading: 'Public and on-chain data',
    body: [
      'Obsign is designed for public verification. Credentials, evidence hashes, and receipts are meant to be shared and checked by third parties, so you should treat anything you submit as public.',
      'When a credential is anchored, its receipt hash is committed to the Base Sepolia network. On-chain records are public and permanent. They cannot be edited or deleted, including by us. Please do not place sensitive or private personal information in a credential, its evidence, or any field that will be anchored or shared.',
    ],
  },
  {
    heading: 'How we use information',
    list: [
      'To verify credentials and return receipts.',
      'To anchor receipts on Base Sepolia when you choose to do so.',
      'To operate, maintain, secure, and improve the service.',
      'To detect, prevent, and investigate abuse or technical problems.',
    ],
  },
  {
    heading: 'Where information is stored',
    body: [
      'We use a cache database to store copies of credentials, evidence, receipts, and related records so the app responds quickly. This database is a convenience layer, not a source of truth. Every receipt can be recomputed from the published specification and public chain state without relying on our database.',
      'Uploaded evidence files are stored with a size limit and are used only to recompute the artifact hash named by a credential.',
    ],
  },
  {
    heading: 'Wallets, keys, and authentication',
    body: [
      'Obsign is self-custodial. You keep control of your wallet and private keys at all times. Issuance and other sensitive actions are signed by your own wallet, and the platform holds no issuer keys.',
      "After you sign in with your wallet, the app stores a session token in your browser's local storage so you stay signed in. You can clear it by signing out or by clearing your browser storage.",
    ],
  },
  {
    heading: 'Third-party services',
    body: [
      'To provide the service, Obsign relies on third parties, including blockchain RPC providers, your wallet provider, an x402 payment facilitator, and hosting providers. When you use Obsign, these providers may process technical data, such as your address, request metadata, or network information, under their own terms and policies.',
    ],
  },
  {
    heading: 'Data retention',
    body: [
      'Cached data is retained while the pilot operates and may be reset as we develop the service. On-chain data, including anchored receipt hashes and payment settlements, is permanent and outside our control.',
    ],
  },
  {
    heading: 'Your choices',
    list: [
      'Choose what to submit. Only include information that is appropriate to disclose publicly.',
      'Disconnect at any time. You can disconnect your wallet and sign out to end your session.',
      'Ask questions. You can contact us about this policy using the details below.',
    ],
    body: [
      'Because much of the data is public or stored on-chain, some information cannot be changed or removed after it is shared or anchored.',
    ],
  },
  {
    heading: 'Security',
    body: [
      'We take reasonable measures to protect the service. However, Obsign is an experimental testnet pilot, and no online service can be guaranteed to be completely secure. Please use it with test data and test funds only.',
    ],
  },
  {
    heading: 'Children',
    body: [
      'Obsign is not directed to children and is not intended for use by anyone under the age required to form a binding agreement in their location.',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'We may update this Privacy Policy as the service evolves. When we do, we will change the date at the top of this page. Continued use of Obsign after an update means you accept the revised policy.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <main className="legal">
      <section className="legal__main section">
        <div className="container">
          <div className="legal__head">
            <p className="eyebrow">Legal</p>
            <h1 className="legal__title">
              Privacy <span className="script-accent">Policy.</span>
            </h1>
            <p className="legal__updated">{UPDATED}</p>
            <p className="legal__lead">
              This Privacy Policy explains how Obsign handles information when you use the Obsign
              web app, API, SDK, and MCP tools during our public testnet pilot on Base Sepolia.
              Obsign is verification infrastructure: it turns a credential and its supporting
              evidence into a receipt that anyone can recompute. Because the service is built
              around public, independently verifiable proofs, most of the data it handles is meant
              to be shared rather than kept private.
            </p>
          </div>

          <div className="legal__sections">
            {SECTIONS.map((s) => (
              <div key={s.heading} className="legal__section">
                <h2 className="legal__section-title">{s.heading}</h2>
                {s.body?.map((p, i) => <p key={i}>{p}</p>)}
                {s.list && (
                  <ul className="legal__list">
                    {s.list.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="legal__contact">
            <p className="legal__contact-title">Contact</p>
            <p>
              If you have questions about this Privacy Policy or how Obsign handles information,
              please reach out through the project&apos;s public channels. We will respond as the
              pilot allows.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

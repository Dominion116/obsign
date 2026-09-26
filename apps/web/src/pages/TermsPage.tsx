import './Legal.css'

interface LegalBlock {
  heading: string
  body?: string[]
  list?: string[]
}

const UPDATED = 'Last updated: September 26, 2026'

const SECTIONS: LegalBlock[] = [
  {
    heading: 'About the service',
    body: [
      'Obsign is verification infrastructure for AI agents and humans. It packages a credential with machine-checkable evidence and produces a deterministic receipt that anyone can recompute. The service includes credential issuance, verification, on-chain anchoring, the Sentinel vetting agent, and developer access through the API, SDK, and MCP.',
    ],
  },
  {
    heading: 'Testnet pilot and no monetary value',
    body: [
      'Obsign currently runs on the Base Sepolia test network. Any tokens, payments, or assets used with the service are test assets with no monetary value. The service is experimental and provided for evaluation. Do not use it for production systems, real value, or decisions that require a guaranteed outcome.',
    ],
  },
  {
    heading: 'Eligibility',
    body: [
      'You may use Obsign only if you can form a binding agreement under the law that applies to you. If you use Obsign on behalf of an organization, you confirm that you are authorized to accept these Terms for that organization.',
    ],
  },
  {
    heading: 'Wallets and authentication',
    body: [
      'You are responsible for your wallet, your private keys, and any activity that occurs through your wallet or your signed-in session. Obsign is self-custodial and never holds your keys. Sign-In with Ethereum is used to authenticate sensitive actions. Keep your wallet and session secure, and sign out on shared devices.',
    ],
  },
  {
    heading: 'Acceptable use',
    body: ['When using Obsign, you agree not to:'],
    list: [
      'Use the service for any unlawful purpose or in violation of any applicable law.',
      'Submit content that infringes the rights of others or that you do not have the right to share.',
      'Upload sensitive, confidential, or private personal information, since credentials, evidence, and receipts are public and may be anchored on-chain.',
      'Misrepresent a credential, forge evidence, or attempt to present a failed or unverified result as valid.',
      'Interfere with, overload, or attempt to break the security or integrity of the service.',
    ],
  },
  {
    heading: 'Issuing credentials',
    body: [
      'When you issue a credential, you confirm that you have the right to make the claim and to attach the evidence you provide. Credentials are public and can be independently verified. Revocation creates a deterministic future verification result rather than deleting history. You are responsible for the accuracy and lawfulness of the credentials you issue.',
    ],
  },
  {
    heading: 'Payments',
    body: [
      'Some verification requests are payment-gated using the x402 protocol with test USDC on Base Sepolia. Pricing is shown in the app and is charged per call, without accounts or subscriptions. Because payments use test funds on a test network, they carry no monetary value and are not refundable. Payment grants access to hosted verification and never changes the validity result or the receipt identifier. Payment is sent to the configured Obsign service payee.',
    ],
  },
  {
    heading: 'Verification is not a judgment of truth',
    body: [
      'Obsign verifies whether the evidence attached to a claim satisfies a clear, published rule. It does not decide whether the underlying claim is socially or factually true, and it does not provide legal, financial, or professional advice. A receipt tells you that a specific rule was met for specific inputs, and nothing more.',
    ],
  },
  {
    heading: 'Intellectual property',
    body: [
      'The Obsign receipt format and verification rules are published so that results can be reproduced independently. You keep ownership of the content you submit. By submitting content, you grant Obsign the permissions needed to store, process, verify, display, and anchor it in order to operate the service.',
    ],
  },
  {
    heading: 'No warranty',
    body: [
      'Obsign is provided on an as is and as available basis, without warranties of any kind, whether express or implied, including any implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the service will be uninterrupted, error free, or available at any particular time. This is a testnet pilot and may change or stop at any time.',
    ],
  },
  {
    heading: 'Limitation of liability',
    body: [
      'To the maximum extent permitted by law, Obsign and its contributors will not be liable for any indirect, incidental, special, consequential, or exemplary damages, or for any loss of data, profits, or opportunities, arising from your use of the service. Because Obsign is a testnet pilot with no monetary value, you use it at your own risk.',
    ],
  },
  {
    heading: 'Indemnification',
    body: [
      'You agree to indemnify and hold harmless Obsign and its contributors from any claims, damages, or expenses arising out of the content you submit, your use of the service, or your violation of these Terms.',
    ],
  },
  {
    heading: 'Third-party services',
    body: [
      'Obsign relies on third parties such as blockchain networks, RPC providers, wallet providers, an x402 payment facilitator, and hosting providers. We do not control these services and are not responsible for their availability, actions, or terms.',
    ],
  },
  {
    heading: 'Changes to the service and these Terms',
    body: [
      'We may modify, suspend, or discontinue any part of the service at any time during the pilot. We may also update these Terms as the service evolves. When we do, we will change the date at the top of this page. Continued use of Obsign after an update means you accept the revised Terms.',
    ],
  },
  {
    heading: 'Governing law',
    body: [
      'These Terms are governed by applicable law. Where required, any dispute will be handled under the law that applies to the operator of the service. Nothing in these Terms limits any rights that cannot be limited under the law that applies to you.',
    ],
  },
]

export default function TermsPage() {
  return (
    <main className="legal">
      <section className="legal__main section">
        <div className="container">
          <div className="legal__head">
            <p className="eyebrow">Legal</p>
            <h1 className="legal__title">
              Terms of <span className="script-accent">Service.</span>
            </h1>
            <p className="legal__updated">{UPDATED}</p>
            <p className="legal__lead">
              These Terms of Service govern your use of Obsign, including the web app, API, SDK,
              and MCP tools, during our public testnet pilot on Base Sepolia. By connecting a
              wallet, signing in, or otherwise using Obsign, you agree to these Terms. If you do
              not agree, please do not use the service.
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
              If you have questions about these Terms, please reach out through the project&apos;s
              public channels.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

import './FAQ.css'

const QUESTIONS = [
  ['Can I verify without trusting Obsign?', 'Yes. Anyone with the credential and its evidence can recompute the receipt from the published rules, including offline.'],
  ['What stops someone from faking a credential?', 'The claim only passes when its attached evidence passes the selected verification module. A screenshot or unsupported database entry is not proof by itself.'],
  ['Is it private?', 'Credentials and receipts are designed for public verification. Only include information that is appropriate to disclose publicly.'],
  ['What does it cost?', 'Verification is priced per call through x402. There are no subscriptions, and every paid call receives a settlement receipt.'],
  ['Which chains are supported?', 'Obsign uses Base Sepolia during the pilot, with Base mainnet planned for production.'],
  ['Is Obsign open source?', 'The receipt format and verification rules are published so independent people and tools can inspect and reproduce results.'],
]

export default function FAQ() {
  return (
    <section id="faq" className="section faq">
      <div className="container faq__inner">
        <div className="faq__head">
          <p className="eyebrow faq__eyebrow">Questions, answered</p>
          <h2 className="section-title">The important details, <span className="script-accent">clearly.</span></h2>
        </div>
        <div className="faq__list">
          {QUESTIONS.map(([question, answer]) => (
            <details key={question} className="faq__item">
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

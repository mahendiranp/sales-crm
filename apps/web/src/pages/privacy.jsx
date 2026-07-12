import Link from "next/link";
import { Target } from "lucide-react";
import { APP_NAME } from "../lib/brand";
import Seo from "../components/Seo";

function LegalHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-border">
      <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Target size={17} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">{APP_NAME}</span>
        </Link>
        <Link href="/signup" className="px-3.5 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-dark">
          Sign up free
        </Link>
      </div>
    </header>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="font-display font-semibold text-lg mb-2">{title}</h2>
      <div className="text-sm text-ink/70 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <div className="font-body text-ink">
      <Seo title="Privacy Policy" description={`${APP_NAME}'s Privacy Policy.`} path="/privacy" />
      <LegalHeader />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display font-bold text-3xl mb-2">Privacy Policy</h1>
        <p className="text-sm text-ink/40 mb-10">Last updated: July 2026</p>

        <Section title="1. What We Collect">
          <p>We collect the following categories of information:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account data</strong> — name, email, and company name you provide at signup</li>
            <li><strong>Form responses</strong> — the answers your respondents submit through forms you build, encrypted at rest (AES-256-GCM)</li>
            <li><strong>Usage data</strong> — basic technical logs (IP address, browser, timestamps) needed to operate and secure the Service</li>
            <li><strong>WhatsApp data</strong> — message content and metadata, only if you connect the WhatsApp integration</li>
          </ul>
        </Section>

        <Section title="2. How We Use It">
          <p>We use your information to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Operate, maintain, and improve the Service</li>
            <li>Authenticate your account and enforce access permissions</li>
            <li>Send transactional emails (e.g. password resets) — never marketing email without your consent</li>
            <li>Detect and prevent abuse, fraud, or security incidents</li>
          </ul>
          <p>We do not sell your data, or the data your respondents submit through your forms, to third parties.</p>
        </Section>

        <Section title="3. AI Assistant">
          <p>
            If you use the Form Builder's AI Assistant, the text of your prompts (and,
            for context, your form's current field list) is sent to our third-party AI
            provider (Anthropic) to generate a response. Respondent data submitted
            through your published forms is never sent to the AI provider.
          </p>
        </Section>

        <Section title="4. Data Storage & Security">
          <p>
            Data is stored on MongoDB Atlas with encryption in transit (TLS) and, for
            form response answers specifically, encryption at rest. Access to your
            account's data is scoped per-tenant — no other customer's account can read
            or write your data.
          </p>
        </Section>

        <Section title="5. Third-Party Services">
          <p>We rely on the following third parties to operate the Service:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>MongoDB Atlas</strong> — database hosting</li>
            <li><strong>Vercel</strong> — application hosting</li>
            <li><strong>Anthropic</strong> — AI Assistant, only when you use that feature</li>
            <li><strong>Meta (WhatsApp Business API)</strong> — only if you connect the WhatsApp integration</li>
          </ul>
        </Section>

        <Section title="6. Data Retention">
          <p>
            We retain your account data and form responses for as long as your account
            is active. You can delete individual forms and responses at any time from
            within the product. If you close your account, we delete your data within
            a reasonable period, except where we're required to retain it by law.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>
            Depending on where you're located, you may have the right to access,
            correct, export, or delete your personal data. Contact us at the email
            below to exercise these rights.
          </p>
        </Section>

        <Section title="8. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. If we make material
            changes, we'll notify you before they take effect.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>Questions about this policy or your data? Reach us at hello@pipeline.app.</p>
        </Section>
      </main>
    </div>
  );
}

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

export default function Terms() {
  return (
    <div className="font-body text-ink">
      <Seo title="Terms of Service" description={`${APP_NAME}'s Terms of Service.`} path="/terms" />
      <LegalHeader />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display font-bold text-3xl mb-2">Terms of Service</h1>
        <p className="text-sm text-ink/40 mb-10">Last updated: July 2026</p>

        <Section title="1. Agreement to Terms">
          <p>
            These Terms of Service ("Terms") govern your access to and use of {APP_NAME}
            ("the Service"), a form-building and workflow platform. By creating an
            account or using the Service, you agree to be bound by these Terms. If you
            don't agree, don't use the Service.
          </p>
        </Section>

        <Section title="2. Accounts">
          <p>
            You're responsible for the accuracy of the information you provide when
            creating an account, and for maintaining the confidentiality of your login
            credentials. You're responsible for all activity that happens under your
            account, including teammates you invite.
          </p>
        </Section>

        <Section title="3. Acceptable Use">
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Collect data unlawfully or without the necessary consent from respondents</li>
            <li>Send unsolicited messages via the WhatsApp integration in violation of Meta's platform policies</li>
            <li>Upload malicious content, or attempt to disrupt or gain unauthorized access to the Service</li>
            <li>Violate any applicable law or the rights of any third party</li>
          </ul>
        </Section>

        <Section title="4. Your Content">
          <p>
            You retain ownership of the forms you build and the responses you collect
            ("Your Content"). You grant us a limited license to host, store, and
            process Your Content solely to provide the Service to you. We don't claim
            ownership of Your Content and won't use it for any purpose beyond operating
            the Service, except as described in our Privacy Policy.
          </p>
        </Section>

        <Section title="5. AI Assistant">
          <p>
            The Form Builder's AI Assistant, where enabled, uses a third-party language
            model to generate or modify form fields based on your prompts. Suggestions
            are generated automatically and should be reviewed before publishing a form
            — we don't guarantee the accuracy or suitability of AI-generated content.
          </p>
        </Section>

        <Section title="6. Subscription & Payment">
          <p>
            Paid plans are billed in advance on a recurring basis as described at
            checkout. You can cancel at any time; cancellation takes effect at the end
            of your current billing period. Fees are non-refundable except where
            required by law.
          </p>
        </Section>

        <Section title="7. Termination">
          <p>
            You may stop using the Service and delete your account at any time. We may
            suspend or terminate your access if you violate these Terms or if required
            to comply with the law.
          </p>
        </Section>

        <Section title="8. Disclaimer & Limitation of Liability">
          <p>
            The Service is provided "as is" without warranties of any kind. To the
            fullest extent permitted by law, we're not liable for indirect, incidental,
            or consequential damages arising from your use of the Service.
          </p>
        </Section>

        <Section title="9. Changes to These Terms">
          <p>
            We may update these Terms from time to time. If we make material changes,
            we'll notify you (e.g. by email or an in-app notice) before they take
            effect. Continued use of the Service after changes take effect means you
            accept the updated Terms.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>Questions about these Terms? Reach us at hello@pipeline.app.</p>
        </Section>
      </main>
    </div>
  );
}

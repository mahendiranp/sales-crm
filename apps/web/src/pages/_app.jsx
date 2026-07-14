import Head from "next/head";
import "../index.css";
import { AuthProvider } from "../context/AuthContext";
import ErrorBoundary from "../components/ErrorBoundary";
import Analytics from "../components/Analytics";
import { APP_NAME } from "../lib/brand";

// App-wide fallback — public pages set their own via <Seo> (components/Seo.jsx),
// whose next/head tags render after this and take precedence. Logged-in-only
// /app/* pages never used Seo (deliberately kept out of search/analytics), so
// without this they shipped with no <title>/description at all.
export default function MyApp({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <Head>
        <title>{`${APP_NAME} — CRM, Forms & Automation`}</title>
        <meta name="description" content={`${APP_NAME} — a CRM with drag-and-drop forms, approvals, and WhatsApp automation.`} />
      </Head>
      <Analytics />
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </ErrorBoundary>
  );
}

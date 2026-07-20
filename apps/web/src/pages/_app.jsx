import { useEffect } from "react";
import Head from "next/head";
import "../index.css";
import { AuthProvider } from "../context/AuthContext";
import ErrorBoundary from "../components/ErrorBoundary";
import Analytics from "../components/Analytics";
import { ToastProvider } from "../components/ui/Toast";
import { APP_NAME } from "../lib/brand";
import { initLogRocket } from "../lib/logrocket";

// App-wide fallback — public pages set their own via <Seo> (components/Seo.jsx),
// whose next/head tags render after this and take precedence. Logged-in-only
// /app/* pages never used Seo (deliberately kept out of search/analytics), so
// without this they shipped with no <title>/description at all.
export default function MyApp({ Component, pageProps }) {
  // Client-only (no SSR) and a no-op until NEXT_PUBLIC_LOGROCKET_APP_ID is
  // set — see lib/logrocket.js. Session identification happens separately,
  // once a user is actually known (AuthContext.jsx's persist()).
  useEffect(() => {
    initLogRocket();
  }, []);

  return (
    <ErrorBoundary>
      <Head>
        <title>{`${APP_NAME} — CRM, Forms & Automation`}</title>
        <meta name="description" content={`${APP_NAME} — a CRM with drag-and-drop forms, approvals, and WhatsApp automation.`} />
      </Head>
      <Analytics />
      <ToastProvider>
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

import { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import "../index.css";
import { AuthProvider } from "../context/AuthContext";
import ErrorBoundary from "../components/ErrorBoundary";
import Analytics from "../components/Analytics";
import AppShell from "../components/AppShell";
import { APP_NAME } from "../lib/brand";
import { initLogRocket } from "../lib/logrocket";

// App-wide fallback — public pages set their own via <Seo> (components/Seo.jsx),
// whose next/head tags render after this and take precedence. Logged-in-only
// /app/* pages never used Seo (deliberately kept out of search/analytics), so
// without this they shipped with no <title>/description at all.
export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  // Client-only (no SSR) and a no-op until NEXT_PUBLIC_LOGROCKET_APP_ID is
  // set — see lib/logrocket.js. Session identification happens separately,
  // once a user is actually known (AuthContext.jsx's persist()).
  useEffect(() => {
    initLogRocket();
  }, []);

  // AppShell (sidebar/header + auth gate) is hoisted here, once, instead of
  // each /app/* page wrapping itself in it individually — every page file
  // doing its own wrapping meant Next's router fully unmounted and
  // remounted the whole shell (sidebar, its data fetch, the live socket
  // connection) on every single navigation between /app pages, which
  // looked like a full page reload even though it wasn't one. Hoisting it
  // here keeps one persistent AppShell instance across every /app/* route
  // change — only the page content inside it swaps.
  const isAppRoute = router.pathname.startsWith("/app");

  return (
    <ErrorBoundary>
      <Head>
        <title>{`${APP_NAME} — CRM, Forms & Automation`}</title>
        <meta name="description" content={`${APP_NAME} — a CRM with drag-and-drop forms, approvals, and WhatsApp automation.`} />
      </Head>
      <Analytics />
      <AuthProvider>
        {isAppRoute ? (
          <AppShell>
            <Component {...pageProps} />
          </AppShell>
        ) : (
          <Component {...pageProps} />
        )}
      </AuthProvider>
    </ErrorBoundary>
  );
}

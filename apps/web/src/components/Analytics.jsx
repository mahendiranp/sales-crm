import { useEffect } from "react";
import Script from "next/script";
import { useRouter } from "next/router";

// Set in .env.local (and must be set the same way in Vercel's production
// env vars — that file itself is never deployed, see apps/web/.env.local).
// Not sensitive (it'd be visible in client-side JS either way), it's just
// an env var so a different project/environment can use its own.
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Production only, same reasoning as lib/logrocket.js — Next.js sets
// NODE_ENV to "development" for `next dev`, so without this every local
// dev session was sending real pageviews into the actual GA property,
// polluting production analytics with dev traffic.
//
// Also only loaded on public marketing/auth pages (landing, login, signup,
// terms, privacy) — not the authenticated /app/* CRM, where visitors are
// already-known logged-in customers using the product, not prospects to
// measure funnel/conversion for.
export default function Analytics() {
  const router = useRouter();
  const enabled = !!GA_MEASUREMENT_ID && process.env.NODE_ENV === "production";

  // GA's own `config` call only fires a page_view once, on initial script
  // load — Next.js's pages router navigates client-side without a full
  // reload, so without this, moving from e.g. /login to /signup would
  // never register as a second pageview.
  useEffect(() => {
    if (!enabled || router.pathname.startsWith("/app")) return;
    const handleRouteChange = (url) => {
      window.gtag?.("event", "page_view", { page_path: url });
    };
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!enabled || router.pathname.startsWith("/app")) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.gtag = function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}

import { useEffect } from "react";
import Script from "next/script";
import { useRouter } from "next/router";

// GA4 measurement ID — public by design (it's embedded in client-side JS
// anyone can view), not a secret, so a plain constant is fine here rather
// than an env var.
const GA_MEASUREMENT_ID = "G-KDJ5NVT81X";

// Only loaded on public marketing/auth pages (landing, login, signup,
// terms, privacy) — not the authenticated /app/* CRM, where visitors are
// already-known logged-in customers using the product, not prospects to
// measure funnel/conversion for.
export default function Analytics() {
  const router = useRouter();

  // GA's own `config` call only fires a page_view once, on initial script
  // load — Next.js's pages router navigates client-side without a full
  // reload, so without this, moving from e.g. /login to /signup would
  // never register as a second pageview.
  useEffect(() => {
    if (router.pathname.startsWith("/app")) return;
    const handleRouteChange = (url) => {
      window.gtag?.("event", "page_view", { page_path: url });
    };
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (router.pathname.startsWith("/app")) return null;

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

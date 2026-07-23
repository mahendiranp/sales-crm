import { useEffect, useRef } from "react";
import Script from "next/script";

// Cloudflare Turnstile widget — no npm dependency, just their hosted
// script, same "wire up their script tag directly" pattern this app
// already uses for Google Sign-In and Razorpay Checkout. Renders an
// invisible/managed challenge and calls onVerify(token) once solved; the
// token is only meaningful when the backend verifies it server-side
// (integrations/turnstileClient.js) — nothing here proves anything on its
// own, it's just collecting the proof for the real request to carry.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function Turnstile({ onVerify, className = "" }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  const render = () => {
    if (!SITE_KEY || !window.turnstile || !containerRef.current || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: (token) => onVerify?.(token),
      // A token is one-time-use and expires after ~5 minutes — resetting on
      // expiry/error re-arms the widget instead of leaving it stuck holding
      // a token the backend will reject anyway.
      "expired-callback": () => onVerify?.(null),
      "error-callback": () => onVerify?.(null),
    });
  };

  useEffect(() => {
    if (window.turnstile) render();
    return () => {
      if (window.turnstile && widgetIdRef.current) window.turnstile.remove(widgetIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" onLoad={render} />
      <div ref={containerRef} className={className} />
    </>
  );
}

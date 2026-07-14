import { useEffect, useRef } from "react";
import Script from "next/script";
import { useAuth } from "../context/AuthContext";

// Renders Google's own hosted button via Identity Services (GIS) — no new
// npm dependency, just their script tag, consistent with how this app wires
// up other third-party widgets (Razorpay Checkout). The ID token it returns
// is verified server-side in routes/auth.js; the frontend never inspects it.
export default function GoogleSignInButton({ onSuccess, onError }) {
  const { googleLogin } = useAuth();
  const buttonRef = useRef(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const renderButton = () => {
    if (!clientId || !window.google || !buttonRef.current) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        try {
          await googleLogin(credential);
          onSuccess?.();
        } catch (err) {
          onError?.(err.response?.data?.error || "Google sign-in failed — please try again.");
        }
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      width: 336,
      text: "continue_with",
    });
  };

  useEffect(() => {
    if (window.google) renderButton();
  }, []);

  if (!clientId) return null;

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={renderButton} />
      <div className="flex justify-center" ref={buttonRef} />
    </>
  );
}

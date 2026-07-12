// Razorpay's Checkout widget is loaded from their CDN on demand (not
// bundled) — only pages that actually show a "pay" button need it, and it
// has to be a real <script> tag (not an npm import) for their widget to
// work. Shared by Settings.jsx (Upgrade Plan) and Signup.jsx (pay during
// signup for a paid plan) so the loading logic isn't duplicated.
export function loadRazorpayScript() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

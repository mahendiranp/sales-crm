import { Html, Head, Main, NextScript } from "next/document";

// Document-level stuff that must be the same on every page (lang attribute,
// charset, favicon) — per-page <title>/description/robots meta lives in
// each page via the shared <Seo> component instead (see components/Seo.jsx).
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

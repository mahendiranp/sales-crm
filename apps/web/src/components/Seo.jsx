import Head from "next/head";
import { APP_NAME } from "../lib/brand";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://floworaone.com";

// One shared way to set per-page <title>/description/robots/Open-Graph tags
// instead of every page hand-rolling its own <Head>, so the title format
// and OG defaults stay consistent as pages get added.
export default function Seo({ title, description, keywords, noindex = false, path = "", jsonLd = null }) {
  const fullTitle = title ? `${title} | ${APP_NAME}` : `${APP_NAME} — Forms that route themselves`;
  const url = `${SITE_URL}${path}`;

  return (
    <Head>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {/* Ignored by Google/Bing for ranking — kept for the handful of
          smaller engines/directories that still read it. Title and
          description above are what actually affects search ranking. */}
      {keywords && <meta name="keywords" content={Array.isArray(keywords) ? keywords.join(", ") : keywords} />}
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="canonical" href={url} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <>
          <meta property="og:type" content="website" />
          <meta property="og:title" content={fullTitle} />
          {description && <meta property="og:description" content={description} />}
          <meta property="og:url" content={url} />
          <meta property="og:site_name" content={APP_NAME} />
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content={fullTitle} />
          {description && <meta name="twitter:description" content={description} />}
        </>
      )}
      {jsonLd && (
        // eslint-disable-next-line react/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
    </Head>
  );
}

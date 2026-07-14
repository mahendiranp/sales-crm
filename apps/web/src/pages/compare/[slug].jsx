import ComparisonPage from "../../components/ComparisonPage";
import { COMPARISONS } from "../../lib/comparisons";

export default function Compare({ slug, data }) {
  return <ComparisonPage slug={slug} data={data} />;
}

// Static generation (not client-side fetching, like most of this app's
// pages) matters here specifically: it's what puts the <title>/description/
// keywords into the actual HTML search engines crawl, instead of only
// appearing after JS hydration.
export async function getStaticPaths() {
  return {
    paths: Object.keys(COMPARISONS).map((slug) => ({ params: { slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  return { props: { slug: params.slug, data: COMPARISONS[params.slug] } };
}

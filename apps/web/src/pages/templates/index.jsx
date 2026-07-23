import TemplateGallery from "../../components/TemplateGallery";
import { fetchTemplateList } from "../../lib/templatesApi";

export default function Templates({ templates }) {
  return <TemplateGallery templates={templates} />;
}

// Static generation (not client fetch) so the marketplace's titles/
// descriptions land in the crawled HTML, matching /compare/[slug]'s
// reasoning — with ISR so a new template (data-file edit) shows up within
// an hour without a full frontend redeploy.
export async function getStaticProps() {
  const templates = await fetchTemplateList();
  return { props: { templates }, revalidate: 3600 };
}

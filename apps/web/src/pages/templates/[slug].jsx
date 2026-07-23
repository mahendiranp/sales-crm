import TemplateDetail from "../../components/TemplateDetail";
import { fetchTemplate, fetchTemplateList } from "../../lib/templatesApi";

export default function TemplatePage({ template, related }) {
  return <TemplateDetail template={template} related={related} />;
}

export async function getStaticPaths() {
  const templates = await fetchTemplateList();
  return {
    paths: templates.map((t) => ({ params: { slug: t.key } })),
    // A template added after the last build/revalidate still resolves —
    // fetched and cached on first request instead of needing a redeploy.
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }) {
  const template = await fetchTemplate(params.slug);
  if (!template || template.key === "blank") return { notFound: true };

  const allTemplates = await fetchTemplateList();
  const others = allTemplates.filter((t) => t.key !== template.key);
  const sameCategory = others.filter((t) => t.category === template.category);
  // Same-category alone is often fewer than 4 (e.g. "Sales" only has 2
  // others) — fill the rest with tag-overlapping templates from other
  // categories rather than showing a sparse 2-card row.
  const sameTag = others.filter(
    (t) => !sameCategory.includes(t) && t.tags?.some((tag) => template.tags?.includes(tag))
  );
  const related = [...sameCategory, ...sameTag].slice(0, 4);

  return { props: { template, related }, revalidate: 3600 };
}

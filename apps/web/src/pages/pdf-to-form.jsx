import FeatureLandingPage from "../components/FeatureLandingPage";
import { FEATURE_PAGES } from "../lib/featurePages";

export default function PdfToFormPage() {
  return <FeatureLandingPage data={FEATURE_PAGES["pdf-to-form"]} />;
}

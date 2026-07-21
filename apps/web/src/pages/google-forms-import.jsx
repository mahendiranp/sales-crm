import FeatureLandingPage from "../components/FeatureLandingPage";
import { FEATURE_PAGES } from "../lib/featurePages";

export default function GoogleFormsImportPage() {
  return <FeatureLandingPage data={FEATURE_PAGES["google-forms-import"]} />;
}

import FeatureLandingPage from "../components/FeatureLandingPage";
import { FEATURE_PAGES } from "../lib/featurePages";

export default function AiFormBuilderPage() {
  return <FeatureLandingPage data={FEATURE_PAGES["ai-form-builder"]} />;
}

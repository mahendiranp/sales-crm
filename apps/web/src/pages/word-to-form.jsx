import FeatureLandingPage from "../components/FeatureLandingPage";
import { FEATURE_PAGES } from "../lib/featurePages";

export default function WordToFormPage() {
  return <FeatureLandingPage data={FEATURE_PAGES["word-to-form"]} />;
}

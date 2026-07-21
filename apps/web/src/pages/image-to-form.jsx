import FeatureLandingPage from "../components/FeatureLandingPage";
import { FEATURE_PAGES } from "../lib/featurePages";

export default function ImageToFormPage() {
  return <FeatureLandingPage data={FEATURE_PAGES["image-to-form"]} />;
}

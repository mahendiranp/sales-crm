import FeatureLandingPage from "../components/FeatureLandingPage";
import { FEATURE_PAGES } from "../lib/featurePages";

export default function TallyImportPage() {
  return <FeatureLandingPage data={FEATURE_PAGES["tally-import"]} />;
}

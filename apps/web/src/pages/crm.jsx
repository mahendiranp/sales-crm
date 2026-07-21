import FeatureLandingPage from "../components/FeatureLandingPage";
import { FEATURE_PAGES } from "../lib/featurePages";

export default function CrmPage() {
  return <FeatureLandingPage data={FEATURE_PAGES["crm"]} />;
}

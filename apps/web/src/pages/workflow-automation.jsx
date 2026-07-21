import FeatureLandingPage from "../components/FeatureLandingPage";
import { FEATURE_PAGES } from "../lib/featurePages";

export default function WorkflowAutomationPage() {
  return <FeatureLandingPage data={FEATURE_PAGES["workflow-automation"]} />;
}

import FeatureLandingPage from "../components/FeatureLandingPage";
import { FEATURE_PAGES } from "../lib/featurePages";

export default function ApprovalWorkflowPage() {
  return <FeatureLandingPage data={FEATURE_PAGES["approval-workflow"]} />;
}

import AppShell from "../../../components/AppShell";
import RequireApp from "../../../components/RequireApp";
import Page from "../../../views/AllResponses";

export default function AppAllResponsesPage() {
  return (
    <AppShell>
      <RequireApp appKey="forms">
        <Page />
      </RequireApp>
    </AppShell>
  );
}

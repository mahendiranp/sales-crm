import AppShell from "../../components/AppShell";
import RequireApp from "../../components/RequireApp";
import Page from "../../views/Documents";

export default function AppDocumentsPage() {
  return (
    <AppShell>
      <RequireApp appKey="documents">
        <Page />
      </RequireApp>
    </AppShell>
  );
}

import AppShell from "../../components/AppShell";
import RequireApp from "../../components/RequireApp";
import Page from "../../views/Forms";

export default function AppFormsPage() {
  return (
    <AppShell>
      <RequireApp appKey="forms">
        <Page />
      </RequireApp>
    </AppShell>
  );
}

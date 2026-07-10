import AppShell from "../../components/AppShell";
import RequireApp from "../../components/RequireApp";
import Page from "../../views/Invoicing";

export default function AppInvoicingPage() {
  return (
    <AppShell>
      <RequireApp appKey="invoicing">
        <Page />
      </RequireApp>
    </AppShell>
  );
}

import AppShell from "../../components/AppShell";
import RequireApp from "../../components/RequireApp";
import Page from "../../views/Expenses";

export default function AppExpensesPage() {
  return (
    <AppShell>
      <RequireApp appKey="expenses">
        <Page />
      </RequireApp>
    </AppShell>
  );
}

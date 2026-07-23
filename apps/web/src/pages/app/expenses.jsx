import RequireApp from "../../components/RequireApp";
import Page from "../../views/Expenses";

export default function AppExpensesPage() {
  return (
    <RequireApp appKey="expenses">
      <Page />
    </RequireApp>
  );
}

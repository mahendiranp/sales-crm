import RequireApp from "../../components/RequireApp";
import Page from "../../views/Invoicing";

export default function AppInvoicingPage() {
  return (
    <RequireApp appKey="invoicing">
      <Page />
    </RequireApp>
  );
}

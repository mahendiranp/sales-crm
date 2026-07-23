import RequireApp from "../../components/RequireApp";
import Page from "../../views/Documents";

export default function AppDocumentsPage() {
  return (
    <RequireApp appKey="documents">
      <Page />
    </RequireApp>
  );
}

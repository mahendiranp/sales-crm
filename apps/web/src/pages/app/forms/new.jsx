import AppShell from "../../../components/AppShell";
import RequireApp from "../../../components/RequireApp";
import { AddFormPage } from "../../../views/Forms";

export default function AppFormNewPage() {
  return (
    <AppShell>
      <RequireApp appKey="forms">
        <AddFormPage />
      </RequireApp>
    </AppShell>
  );
}

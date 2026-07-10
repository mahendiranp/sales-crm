import AppShell from "../../components/AppShell";
import AdminRoute from "../../components/AdminRoute";
import Page from "../../views/Apps";

export default function AppAppsPage() {
  return (
    <AppShell>
      <AdminRoute>
        <Page />
      </AdminRoute>
    </AppShell>
  );
}

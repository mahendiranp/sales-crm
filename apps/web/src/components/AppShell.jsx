import Layout from "./Layout";
import ProtectedRoute from "./ProtectedRoute";

export default function AppShell({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

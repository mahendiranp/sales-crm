import Layout from "../../components/Layout";
import Dashboard from "../../views/Dashboard";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function AppDashboard() {
  return (
    <ProtectedRoute>
      <Layout>
        <Dashboard />
      </Layout>
    </ProtectedRoute>
  );
}

import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import RequireApp from "../../../components/RequireApp";
import ModulePlaceholder from "../../../views/ModulePlaceholder";
import { findApp } from "../../../lib/appCatalog";

export default function ModulePage() {
  const router = useRouter();
  const { key } = router.query;
  const app = findApp(key);

  return (
    <AppShell>
      {app ? (
        <RequireApp appKey={key}>
          <ModulePlaceholder app={app} />
        </RequireApp>
      ) : (
        <p className="text-sm text-ink/40">Unknown app.</p>
      )}
    </AppShell>
  );
}

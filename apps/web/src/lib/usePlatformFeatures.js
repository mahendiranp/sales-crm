import { useEffect, useState } from "react";
import api from "../api/client";
import useLiveCollection from "./useLiveCollection";

// What's actually released platform-wide (master admin controls this from
// the Admin Portal) — separate from a tenant's own settings.modules/
// settings.apps, which just says "is this on for my account" among
// whatever has been released. Used by the sidebar, the signup picker
// (before any session exists — this endpoint is public), and Settings'
// Upgrade Plan picker, so all three always agree on what's pickable.
export default function usePlatformFeatures() {
  const [releasedModules, setReleasedModules] = useState({ dashboard: true });
  const [releasedApps, setReleasedApps] = useState({ forms: true });
  const [loaded, setLoaded] = useState(false);

  const load = () =>
    api
      .get("/platform")
      .then((r) => {
        setReleasedModules(r.data.releasedModules || {});
        setReleasedApps(r.data.releasedApps || {});
        setLoaded(true);
      })
      .catch(() => setLoaded(true));

  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["platform"], load);

  return { releasedModules, releasedApps, loaded, reload: load };
}

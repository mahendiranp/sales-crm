// Platform-wide feature release switches — separate from any tenant's own
// settings.modules/settings.apps (which just says "is this ON for my
// account"). This says "does this feature exist for anyone but master
// admin to turn on at all yet." Read by the signup picker (before login
// exists) and every tenant's own Settings/Upgrade page; written only by
// master admin from the Admin Portal.
const express = require("express");
const { collection } = require("../db/store");
const { requireMasterAdmin } = require("../middleware/auth");

const router = express.Router();
const platform = collection("platform");
const ID = "platform-features";

// Matches the pre-launch defaults RELEASED_MODULE_KEYS/RELEASED_APP_KEYS
// used to hardcode — same starting point, now editable at runtime instead
// of requiring a code change to widen the release.
function defaults() {
  return {
    id: ID,
    releasedModules: { dashboard: true },
    releasedApps: { forms: true },
  };
}

router.get("/", async (req, res) => {
  const current = await platform.find(ID);
  res.json(current || defaults());
});

router.put("/", requireMasterAdmin, async (req, res) => {
  const current = await platform.find(ID);
  const base = current || defaults();
  const patch = {};
  if (req.body.releasedModules) patch.releasedModules = { ...base.releasedModules, ...req.body.releasedModules };
  if (req.body.releasedApps) patch.releasedApps = { ...base.releasedApps, ...req.body.releasedApps };

  if (!current) await platform.insert({ ...base, ...patch });
  else await platform.update(ID, patch);
  res.json(await platform.find(ID));
});

module.exports = router;

import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, Pencil, ShieldCheck, Users as UsersIcon } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, Field, inputCls, EmptyState, ErrorModal } from "../components/ui";
import { formatDate } from "../lib/format";
import { limitsFor } from "../lib/plans";

const PERMISSIONS = [
  { key: "view", label: "View Only", desc: "Can see everything, can't create, edit, or delete.", icon: Eye },
  { key: "edit", label: "Edit Only", desc: "Can create and edit records, but not delete them.", icon: Pencil },
  { key: "full", label: "View, Edit & Delete", desc: "Full access — same as the account owner, minus feature flags.", icon: ShieldCheck },
];

const emptyForm = { name: "", email: "", password: "", permission: "edit" };

export default function Team() {
  const { user, isOwner } = useAuth();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [planLimits, setPlanLimits] = useState(null);
  const [limitError, setLimitError] = useState("");

  const load = () => api.get("/auth/team").then((r) => { setTeam(r.data); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => {
    load();
    api.get("/settings").then((r) => setPlanLimits(limitsFor(r.data.subscription?.plan))).catch(() => {});
  }, []);

  // +1 for the owner — `team` only holds the other members.
  const atUserLimit = planLimits && team.length + 1 >= planLimits.maxUsers;

  const createTeammate = async () => {
    setError("");
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Name, email, and password are all required.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/team", form);
      setModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't create that account.");
    } finally {
      setSaving(false);
    }
  };

  const changePermission = async (id, permission) => {
    await api.put(`/auth/team/${id}`, { permission });
    load();
  };

  const removeTeammate = async (member) => {
    if (!confirm(`Remove ${member.name}'s access? They won't be able to log in anymore.`)) return;
    await api.delete(`/auth/team/${member.id}`);
    load();
  };

  if (!isOwner) {
    return (
      <div>
        <PageHeader title="Team" />
        <Card className="p-10 flex flex-col items-center text-center">
          <UsersIcon size={20} className="text-ink/30 mb-3" />
          <p className="font-medium text-ink/70">Owners only</p>
          <p className="text-sm text-ink/40 mt-1 max-w-sm">Ask your account owner to manage team access.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Create logins for your teammates and control exactly what each one can do."
        action={
          <Button
            onClick={() => {
              if (atUserLimit) {
                setLimitError(`Your plan (${planLimits.label}) allows up to ${planLimits.maxUsers} user${planLimits.maxUsers === 1 ? "" : "s"}. Upgrade to add more.`);
              } else {
                setModal(true);
              }
            }}
          >
            <Plus size={15} /> Add Teammate
          </Button>
        }
      />

      <Card className="p-4 mb-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-display font-semibold text-xs shrink-0">
          {(user?.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{user?.name} (you)</p>
          <p className="text-xs text-ink/40">Account owner — full access, controls team & flags</p>
        </div>
        <Badge>Owner</Badge>
      </Card>

      {loading ? (
        <div className="text-ink/40 text-sm">Loading…</div>
      ) : team.length === 0 ? (
        <Card><EmptyState icon={UsersIcon} title="No teammates yet" subtitle="Add one to give them their own login and permission level." /></Card>
      ) : (
        <Card>
          {team.map((member) => {
            const perm = PERMISSIONS.find((p) => p.key === member.permission) || PERMISSIONS[1];
            return (
              <div key={member.id} className="flex items-center gap-3 p-4 border-b border-border last:border-0">
                <div className="w-9 h-9 rounded-full bg-base flex items-center justify-center font-display font-semibold text-xs shrink-0">
                  {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  <p className="text-xs text-ink/40 truncate">{member.email} · Added {formatDate(member.createdAt)}</p>
                </div>
                <select
                  className={`${inputCls} w-44`}
                  value={member.permission}
                  onChange={(e) => changePermission(member.id, e.target.value)}
                >
                  {PERMISSIONS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
                <button onClick={() => removeTeammate(member)} className="text-ink/30 hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Teammate" wide>
        <Field label="Full Name">
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} />
        </Field>

        <p className="text-xs font-medium text-ink/60 mb-1.5 mt-1">Permission Level</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {PERMISSIONS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setForm({ ...form, permission: p.key })}
              className={`text-left p-3 rounded-lg border-2 transition-colors ${
                form.permission === p.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              <p.icon size={16} className={form.permission === p.key ? "text-primary" : "text-ink/40"} />
              <p className="text-xs font-medium mt-1.5">{p.label}</p>
              <p className="text-[11px] text-ink/40 mt-0.5 leading-snug">{p.desc}</p>
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-danger mb-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={createTeammate} disabled={saving}>{saving ? "Creating…" : "Create Login"}</Button>
        </div>
      </Modal>

      <ErrorModal open={!!limitError} message={limitError} onClose={() => setLimitError("")} />
    </div>
  );
}

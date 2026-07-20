import { useEffect, useState } from "react";
import { Plus, Users as UsersIcon } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { Card, PageHeader, Button, Modal, Field, inputCls } from "../components/ui";
import useLiveCollection from "../lib/useLiveCollection";

const emptyForm = { name: "", region: "", memberIds: [] };

export default function Teams() {
  const { canManage } = useAuth();
  const toast = useToast();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([api.get("/teams"), api.get("/users")]).then(([t, u]) => {
      setTeams(t.data);
      setUsers(u.data);
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["teams", "users"], load);

  const userName = (id) => users.find((u) => u.id === id)?.name || "—";

  const toggleMember = (id) => {
    setForm((f) => ({
      ...f,
      memberIds: f.memberIds.includes(id) ? f.memberIds.filter((x) => x !== id) : [...f.memberIds, id],
    }));
  };

  const save = async () => {
    try {
      await api.post("/teams", form);
      setModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't create that team.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Teams"
        subtitle="Organize salespeople by region, and monitor each team separately."
        action={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> New Team</Button>}
      />

      {loading ? (
        <div className="text-ink/40 text-sm">Loading…</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {teams.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <UsersIcon size={16} />
                </div>
                <div>
                  <h4 className="font-display font-semibold">{t.name}</h4>
                  <p className="text-xs text-ink/40">{t.region}</p>
                </div>
              </div>
              <p className="text-xs text-ink/40 mb-1.5">Manager: {userName(t.managerId)}</p>
              <div className="space-y-1 mt-2">
                {(t.memberIds || []).map((id) => (
                  <div key={id} className="text-sm text-ink/70">{userName(id)}</div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="New Team">
        <Field label="Team Name"><input className={inputCls} placeholder="e.g. Pune Sales" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Region"><input className={inputCls} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></Field>
        <Field label="Members">
          <div className="space-y-1 max-h-40 overflow-y-auto border border-border rounded-lg p-2">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm p-1">
                <input type="checkbox" checked={form.memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} />
                {u.name}
              </label>
            ))}
          </div>
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save}>Save Team</Button>
        </div>
      </Modal>
    </div>
  );
}

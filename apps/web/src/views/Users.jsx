import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, Field, inputCls } from "../components/ui";

const ROLES = ["Owner", "Admin", "Sales Manager", "Sales Executive", "Support Agent"];
const emptyForm = { name: "", email: "", phone: "", role: "Sales Executive", avatarColor: "#2F5D50" };

export default function Users() {
  const { canManage } = useAuth();
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get("/users").then((r) => {
      setUsers(r.data);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const save = async () => {
    await api.post("/users", form);
    setModal(false);
    setForm(emptyForm);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage who has access, and what they can do."
        action={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> Add User</Button>}
      />

      <Card>
        {loading ? (
          <div className="p-8 text-ink/40 text-sm">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink/40 uppercase tracking-wide">
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="p-3 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: u.avatarColor }}>
                      {u.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    {u.name}
                  </td>
                  <td className="p-3 text-ink/60">{u.email}</td>
                  <td className="p-3 text-ink/60">{u.phone}</td>
                  <td className="p-3"><Badge>{u.role}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Add User">
        <Field label="Full Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Role">
          <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save}>Save User</Button>
        </div>
      </Modal>
    </div>
  );
}

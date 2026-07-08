import { useEffect, useState } from "react";
import { Plus, Mail, MessageSquare, Bell, Check } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, Field, inputCls, EmptyState } from "../components/ui";
import { formatDate } from "../lib/format";

const emptyForm = { title: "", relatedTo: "", dueDate: "", priority: "Medium", notifyVia: ["Email"] };

export default function Tasks() {
  const { canManage } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("Pending");
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([api.get("/tasks"), api.get("/users")]).then(([t, u]) => {
      setTasks(t.data.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)));
      setUsers(u.data);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const userName = (id) => users.find((u) => u.id === id)?.name || "Unassigned";
  const filtered = tasks.filter((t) => t.status === filter);

  const complete = async (task) => {
    await api.put(`/tasks/${task.id}`, { status: "Completed" });
    load();
  };

  const save = async () => {
    await api.post("/tasks", { ...form, assignedTo: users[0]?.id, status: "Pending" });
    setModal(false);
    setForm(emptyForm);
    load();
  };

  const channelIcon = { Email: Mail, SMS: MessageSquare, Push: Bell };

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Follow-ups your team will never forget."
        action={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> Add Task</Button>}
      />

      <div className="flex gap-2 mb-4">
        {["Pending", "Completed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              filter === f ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/60"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="p-8 text-ink/40 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState title={`No ${filter.toLowerCase()} tasks`} />
        ) : (
          <div>
            {filtered.map((t) => {
              const overdue = filter === "Pending" && new Date(t.dueDate) < new Date();
              return (
                <div key={t.id} className="flex items-center gap-3 p-4 border-b border-border last:border-0">
                  <button
                    onClick={() => canManage && filter === "Pending" && complete(t)}
                    disabled={!canManage}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      filter === "Completed" ? "bg-primary border-primary" : "border-ink/20 hover:border-primary disabled:hover:border-ink/20 disabled:cursor-not-allowed"
                    }`}
                  >
                    {filter === "Completed" && <Check size={12} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${filter === "Completed" ? "line-through text-ink/40" : ""}`}>{t.title}</p>
                    <p className="text-xs text-ink/40">{t.relatedTo} · {userName(t.assignedTo)}</p>
                  </div>
                  <div className="flex gap-1">
                    {(t.notifyVia || []).map((ch) => {
                      const Icon = channelIcon[ch] || Mail;
                      return <Icon key={ch} size={13} className="text-ink/30" />;
                    })}
                  </div>
                  <Badge>{t.priority}</Badge>
                  <span className={`text-xs w-20 text-right ${overdue ? "text-danger font-medium" : "text-ink/40"}`}>
                    {formatDate(t.dueDate)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Task">
        <Field label="Task"><input className={inputCls} placeholder="e.g. Call customer tomorrow" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Related To"><input className={inputCls} value={form.relatedTo} onChange={(e) => setForm({ ...form, relatedTo: e.target.value })} /></Field>
        <Field label="Due Date"><input type="date" className={inputCls} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
        <Field label="Priority">
          <select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {["High", "Medium", "Low"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save}>Save Task</Button>
        </div>
      </Modal>
    </div>
  );
}

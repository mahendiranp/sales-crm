import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, Eye, Copy, Trash2, Pencil } from "lucide-react";
import RequireApp from "../../../../components/RequireApp";
import api from "../../../../api/client";
import { useAuth } from "../../../../context/AuthContext";
import { Button, Badge, ConfirmDialog, ErrorModal } from "../../../../components/ui";
import { limitsFor } from "../../../../lib/plans";
import { FormBuilder, ShareLink } from "../../../../views/Forms";

// Templates are created with a placeholder "Untitled Form" name (the New
// Form flow no longer asks for a name up front — see AddFormPage) — this
// is where that gets fixed: click the pencil to rename inline instead of
// a separate settings screen.
function EditableTitle({ name, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  useEffect(() => setValue(name), [name]);

  const commit = () => {
    const trimmed = value.trim();
    setEditing(false);
    if (trimmed && trimmed !== name) onSave(trimmed);
    else setValue(name);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setValue(name); setEditing(false); }
        }}
        className="font-display font-bold text-2xl bg-transparent border-b-2 border-primary outline-none"
      />
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="group flex items-center gap-2" title="Click to rename">
      <h1 className="font-display font-bold text-2xl">{name}</h1>
      <Pencil size={15} className="text-ink/30 group-hover:text-primary transition-colors" />
    </button>
  );
}

// The canvas builder used to live as one tab among several (Build /
// Workflow / Settings / Responses / Analytics) inside the Forms list page.
// It's now its own page — the list page shows a quick-link per form for
// the other panels instead, and this is what "Build" navigates to.
function BuildPageContent({ id }) {
  const router = useRouter();
  const { canManage, isMasterAdmin } = useAuth();
  const [form, setForm] = useState(null);
  const [planLimits, setPlanLimits] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = () => api.get(`/forms/${id}`).then((r) => setForm(r.data));

  useEffect(() => {
    if (!id) return;
    load();
    api.get("/settings").then((r) => setPlanLimits(limitsFor(r.data.subscription?.plan))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async (patch) => {
    setSaveError("");
    try {
      await api.put(`/forms/${id}`, patch);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.error || "Couldn't save that change.");
    }
  };

  const togglePublish = async () => {
    setActionBusy(true);
    try {
      const endpoint = form.status === "Published" ? "unpublish" : "publish";
      await api.put(`/forms/${id}/${endpoint}`);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.error || "Couldn't update that form's publish status.");
    } finally {
      setActionBusy(false);
    }
  };

  const duplicateForm = async () => {
    setActionBusy(true);
    try {
      await api.post(`/forms/${id}/duplicate`);
      router.push("/app/forms");
    } catch (err) {
      setSaveError(err.response?.data?.error || "Couldn't duplicate that form.");
      setActionBusy(false);
    }
  };

  const deleteForm = async () => {
    setActionBusy(true);
    try {
      await api.delete(`/forms/${id}`);
      router.push("/app/forms");
    } catch (err) {
      setSaveError(err.response?.data?.error || "Couldn't delete that form.");
      setActionBusy(false);
    }
  };

  if (!form) return <div className="text-ink/40 text-sm">Loading…</div>;

  return (
    <div>
      <Link href="/app/forms" className="text-sm text-primary font-medium flex items-center gap-1 mb-4 hover:underline w-fit">
        <ArrowLeft size={14} /> Back to Forms
      </Link>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <EditableTitle name={form.name} onSave={(name) => save({ name })} />
          <Badge>{form.status}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" onClick={() => window.open(`/forms/${id}?preview=1`, "_blank")}>
            <Eye size={14} /> Preview
          </Button>
          {canManage && (
            <>
              <Button variant="secondary" onClick={togglePublish} disabled={actionBusy}>
                {form.status === "Published" ? "Unpublish" : "Publish"}
              </Button>
              <Button variant="secondary" onClick={duplicateForm} disabled={actionBusy}><Copy size={14} /></Button>
              <Button variant="danger" onClick={() => setDeleteTarget(true)} disabled={actionBusy}><Trash2 size={14} /></Button>
            </>
          )}
        </div>
      </div>

      {form.status === "Published" && <ShareLink form={form} />}

      <div className="mt-4">
        <FormBuilder form={form} onSave={save} planLimits={isMasterAdmin ? null : planLimits} />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${form.name}"?`}
        message="This also deletes its responses. This can't be undone."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(false)}
        onConfirm={deleteForm}
      />
      <ErrorModal open={!!saveError} message={saveError} onClose={() => setSaveError("")} />
    </div>
  );
}

export default function AppFormBuildPage() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <RequireApp appKey="forms">
      {id && <BuildPageContent id={id} />}
    </RequireApp>
  );
}

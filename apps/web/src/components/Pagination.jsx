import { ChevronLeft, ChevronRight } from "lucide-react";

// Pairs with the backend's opt-in `?page=&limit=` pagination (see
// crudFactory.js / forms.js responses route) — pass it the { page, limit,
// total, totalPages } shape those endpoints return.
export default function Pagination({ page, totalPages, total, limit, onPageChange }) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm">
      <span className="text-ink/40 text-xs">
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-border text-ink/50 hover:bg-base disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs text-ink/60 px-2">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-border text-ink/50 hover:bg-base disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

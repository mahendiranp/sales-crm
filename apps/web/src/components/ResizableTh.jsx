import { GripVertical } from "lucide-react";

// Drop-in replacement for a plain <th> that adds a drag handle on its right
// edge to resize the column. Requires the parent <table> to have
// `table-fixed` (fixed layout) — under table-auto, per-cell widths are only
// advisory and dragging wouldn't visibly do anything.
export default function ResizableTh({ width, onResize, onResizeEnd, minWidth = 48, className = "", children, ...props }) {
  const onMouseDown = (e) => {
    // Right-click/middle-click shouldn't start a resize.
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width || minWidth;

    const onMouseMove = (moveEvent) => {
      const next = Math.max(minWidth, Math.round(startWidth + (moveEvent.clientX - startX)));
      onResize(next);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      onResizeEnd();
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <th className={`relative ${className}`} style={{ width: width ? `${width}px` : undefined }} {...props}>
      <div className="truncate pr-2">{children}</div>
      <span
        onMouseDown={onMouseDown}
        className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize select-none flex items-center justify-center hover:bg-primary/15 active:bg-primary/25"
      >
        <GripVertical size={11} className="text-ink/30 pointer-events-none" />
      </span>
    </th>
  );
}

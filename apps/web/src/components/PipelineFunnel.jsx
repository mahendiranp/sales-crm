const STAGE_COLORS = {
  "New Lead": "#94A9C9",
  Qualified: "#7B9EA8",
  "Meeting Scheduled": "#5F8B8A",
  "Quotation Sent": "#E8A33D",
  Negotiation: "#C9832A",
  Won: "#2F5D50",
  Lost: "#C1443C",
};

export default function PipelineFunnel({ stageCounts, stages, onStageClick, activeStage }) {
  const max = Math.max(...stages.map((s) => stageCounts[s] || 0), 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {stages.map((stage) => {
        const count = stageCounts[stage] || 0;
        const heightPct = Math.max((count / max) * 100, count > 0 ? 8 : 3);
        const isActive = activeStage === stage;
        return (
          <button
            key={stage}
            onClick={() => onStageClick?.(stage)}
            className="flex-1 flex flex-col items-center justify-end h-full group"
            title={`${stage}: ${count}`}
          >
            <span className="text-xs font-mono font-medium text-ink/70 mb-1">{count}</span>
            <div
              className={`w-full rounded-t transition-all ${isActive ? "ring-2 ring-offset-1 ring-ink/30" : "opacity-90 group-hover:opacity-100"}`}
              style={{ height: `${heightPct}%`, backgroundColor: STAGE_COLORS[stage] || "#ccc" }}
            />
            <span className="text-[10px] text-ink/50 mt-1.5 text-center leading-tight">{stage}</span>
          </button>
        );
      })}
    </div>
  );
}

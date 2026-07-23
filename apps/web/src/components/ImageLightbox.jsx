import { useEffect, useMemo, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, Maximize2, Minimize2, Download, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

// Full-screen image viewer for any attachment thumbnail in the app —
// started for the feedback/support ticket thread's images, but deliberately
// generic (no feedback-specific knowledge) so any other "show a medium
// preview, open a real viewer on click" spot can reuse it instead of
// everyone growing their own <img> + target=_blank escape hatch.
//
// Two ways to call it:
//   <ImageLightbox src={...} alt={...} onClose={...} />               — single image
//   <ImageLightbox images={[{src,alt}, ...]} startIndex={0} onClose={...} /> — gallery, prev/next arrows
// `images`/`startIndex` win if both forms are passed; a single-image call
// is just a one-item gallery under the hood, so every feature (zoom,
// download, etc.) always resets consistently when the current image changes.
export default function ImageLightbox({ src, alt, images, startIndex = 0, onClose }) {
  const gallery = useMemo(() => images || [{ src, alt }], [images, src, alt]);
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef(null);

  const current = gallery[index];
  const hasMultiple = gallery.length > 1;

  const goPrev = () => {
    setZoom(1);
    setIndex((i) => (i - 1 + gallery.length) % gallery.length);
  };
  const goNext = () => {
    setZoom(1);
    setIndex((i) => (i + 1) % gallery.length);
  };

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
  const fitToScreen = () => setZoom(1);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // Fullscreen can be denied by the browser/OS (e.g. no user gesture,
      // or the permission is blocked) — the viewer still works fine at
      // its normal full-viewport overlay size without it.
    }
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = current.src;
    a.download = current.alt || "image";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ESC closes regardless of zoom/fullscreen state — exiting real browser
  // fullscreen first (if active) rather than closing straight through it,
  // so the user isn't left in fullscreen with the viewer gone underneath.
  // Left/Right only matter (and only get wired) when there's more than
  // one image — no point stealing arrow keys for a single-image view.
  // Registered on the capture phase and stops propagation on Escape so it
  // always runs before (and suppresses) the underlying Modal's own Escape
  // handler when the lightbox is opened from inside one (e.g. Response
  // Details) — one Escape should close just the lightbox first, not both
  // layers at once. Capture-phase listeners on window run before
  // bubble-phase ones regardless of which mounted/registered first.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (document.fullscreenElement) document.exitFullscreen?.();
        else onClose();
      } else if (hasMultiple && e.key === "ArrowLeft") {
        goPrev();
      } else if (hasMultiple && e.key === "ArrowRight") {
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, hasMultiple, gallery.length]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[60] bg-black/90 flex flex-col"
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        {hasMultiple ? (
          <span className="text-white/60 text-sm">Image {index + 1} of {gallery.length}</span>
        ) : (
          <span />
        )}
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm"
          aria-label="Close"
        >
          <X size={18} /> Close
        </button>
      </div>

      <div className="relative flex-1 overflow-auto flex items-center justify-center px-4">
        {hasMultiple && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 sm:left-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Previous image"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <img
          src={current.src}
          alt={current.alt}
          onClick={(e) => e.stopPropagation()}
          className="select-none transition-transform duration-150"
          style={{ transform: `scale(${zoom})`, maxWidth: zoom === 1 ? "100%" : "none", maxHeight: zoom === 1 ? "80vh" : "none" }}
          draggable={false}
        />
        {hasMultiple && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 sm:right-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Next image"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      <div className="text-center pb-2" onClick={(e) => e.stopPropagation()}>
        {current.alt && <p className="text-white/70 text-xs truncate px-4">{current.alt}</p>}
      </div>

      <div
        className="flex items-center justify-center gap-4 p-4 pt-0 text-white/90 text-sm flex-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={zoomOut} disabled={zoom <= ZOOM_MIN} className="hover:text-white disabled:opacity-30" aria-label="Zoom out">
          <ZoomOut size={18} />
        </button>
        <span className="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} disabled={zoom >= ZOOM_MAX} className="hover:text-white disabled:opacity-30" aria-label="Zoom in">
          <ZoomIn size={18} />
        </button>
        <span className="w-px h-4 bg-white/20" />
        <button onClick={fitToScreen} className="inline-flex items-center gap-1.5 hover:text-white" aria-label="Fit to screen">
          <RotateCcw size={15} /> Fit to screen
        </button>
        <button onClick={toggleFullscreen} className="inline-flex items-center gap-1.5 hover:text-white" aria-label="Toggle fullscreen">
          {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />} Full screen
        </button>
        <button onClick={download} className="inline-flex items-center gap-1.5 hover:text-white" aria-label="Download">
          <Download size={15} /> Download
        </button>
      </div>
    </div>
  );
}

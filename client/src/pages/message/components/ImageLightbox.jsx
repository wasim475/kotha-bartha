import { Close, Download } from "@mui/icons-material";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { useEffect, useRef, useState } from "react";

import IconButton from "../../../components/ui/IconButton";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export default function ImageLightbox({ src, alt, onClose }) {
  // This component is only ever mounted while open (the caller conditions
  // it on `lightboxOpen && attachment.kind === "image"`), so a fresh mount
  // already starts at scale 1 / centered — no reset-on-prop-change effect
  // needed.
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const dragRef = useRef(null); // { startX, startY, originX, originY } | null
  const pinchRef = useRef(null); // { startDistance, startScale } | null

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // Body scroll lock while the viewer is open, restored on close/unmount.
  useEffect(() => {
    if (!src) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [src]);

  useEffect(() => {
    if (!src) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [src, onClose]);

  const clampScale = (value) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

  const handleWheel = (event) => {
    event.preventDefault();
    setScale((current) => {
      const next = clampScale(current - event.deltaY * 0.0015 * current);
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleDoubleClick = () => {
    if (scale > MIN_SCALE) resetView();
    else setScale(2.5);
  };

  const distanceBetween = (touches) => {
    const [a, b] = touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const handlePointerDown = (event) => {
    if (scale <= MIN_SCALE) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    setIsInteracting(true);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    setOffset({ x: dragRef.current.originX + dx, y: dragRef.current.originY + dy });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    setIsInteracting(false);
  };

  // Swipe-down-to-close when not zoomed in, and pinch-to-zoom on touch
  // devices (pointer events don't cover multi-touch pinch gestures).
  const swipeRef = useRef(null);

  const handleTouchStart = (event) => {
    setIsInteracting(true);
    if (event.touches.length === 2) {
      pinchRef.current = { startDistance: distanceBetween(event.touches), startScale: scale };
      swipeRef.current = null;
      return;
    }
    if (scale <= MIN_SCALE && event.touches.length === 1) {
      swipeRef.current = { startY: event.touches[0].clientY };
    }
  };

  const handleTouchMove = (event) => {
    if (event.touches.length === 2 && pinchRef.current) {
      const distance = distanceBetween(event.touches);
      const next = clampScale(
        pinchRef.current.startScale * (distance / pinchRef.current.startDistance),
      );
      setScale(next);
      return;
    }
    if (swipeRef.current && event.touches.length === 1) {
      const dy = event.touches[0].clientY - swipeRef.current.startY;
      if (dy > 0) setOffset({ x: 0, y: dy });
    }
  };

  const handleTouchEnd = (event) => {
    pinchRef.current = null;
    setIsInteracting(false);
    if (swipeRef.current && offset.y > 100 && event.touches.length === 0) {
      onClose();
      return;
    }
    if (scale <= MIN_SCALE) setOffset({ x: 0, y: 0 });
    swipeRef.current = null;
  };

  return (
    <Dialog open={Boolean(src)} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/80 transition-opacity duration-150 data-[closed]:opacity-0"
      />

      <div
        className="fixed inset-0 flex items-center justify-center touch-none overflow-hidden p-4"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <DialogPanel
          transition
          className="relative flex max-h-full max-w-full items-center justify-center transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          {src && (
            <img
              src={src}
              alt={alt || "Photo"}
              onDoubleClick={handleDoubleClick}
              draggable={false}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-soft select-none"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                cursor: scale > MIN_SCALE ? "grab" : "zoom-in",
                transition: isInteracting ? "none" : "transform 150ms ease-out",
              }}
            />
          )}

          <div className="absolute top-2 right-2 flex gap-1.5">
            <a href={src} download={alt} target="_blank" rel="noreferrer">
              <IconButton
                label="Download image"
                icon={<Download fontSize="small" />}
                className="bg-black/50 text-white hover:bg-black/70 hover:text-white"
              />
            </a>
            <IconButton
              label="Close preview"
              icon={<Close fontSize="small" />}
              onClick={onClose}
              className="bg-black/50 text-white hover:bg-black/70 hover:text-white"
            />
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

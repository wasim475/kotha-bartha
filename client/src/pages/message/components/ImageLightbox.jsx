import { ChevronLeft, ChevronRight, Close, Download } from "@mui/icons-material";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { useEffect, useRef, useState } from "react";

import IconButton from "../../../components/ui/IconButton";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

// Two modes: a single `src` (existing usage — message attachments, profile
// photos) or a multi-image `images` array with `startIndex` (Single Post's
// photo grid), which adds prev/next navigation on top of the same
// zoom/pan/swipe viewer. The single-image callers are untouched.
export default function ImageLightbox({ src, alt, images, startIndex = 0, onClose }) {
  const multi = Array.isArray(images) && images.length > 0;
  const [index, setIndex] = useState(startIndex);
  const activeSrc = multi ? images[index]?.secureUrl : src;
  const isOpen = multi ? images.length > 0 : Boolean(src);

  // This component is only ever mounted while open (the caller conditions
  // it on `lightboxOpen && attachment.kind === "image"`, or a truthy
  // `images` array), so a fresh mount already starts at scale 1 / centered
  // — no reset-on-prop-change effect needed for the initial view.
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const dragRef = useRef(null); // { startX, startY, originX, originY } | null
  const pinchRef = useRef(null); // { startDistance, startScale } | null

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // Switching images (multi mode) should always land back at the default
  // zoom/pan, not carry over whatever the previous photo was zoomed to.
  useEffect(() => {
    queueMicrotask(resetView);
  }, [index]);

  const goPrev = () => setIndex((current) => (current - 1 + images.length) % images.length);
  const goNext = () => setIndex((current) => (current + 1) % images.length);

  // Body scroll lock while the viewer is open, restored on close/unmount.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (multi && event.key === "ArrowLeft") goPrev();
      if (multi && event.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose, multi, images?.length]);

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
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
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
          {activeSrc && (
            <img
              src={activeSrc}
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

          {multi && images.length > 1 && (
            <>
              <IconButton
                label="Previous photo"
                icon={<ChevronLeft fontSize="small" />}
                onClick={(event) => {
                  event.stopPropagation();
                  goPrev();
                }}
                className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 hover:text-white"
              />
              <IconButton
                label="Next photo"
                icon={<ChevronRight fontSize="small" />}
                onClick={(event) => {
                  event.stopPropagation();
                  goNext();
                }}
                className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 hover:text-white"
              />
              <span className="absolute top-2 left-2 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white">
                {index + 1} / {images.length}
              </span>
            </>
          )}

          <div className="absolute top-2 right-2 flex gap-1.5">
            <a href={activeSrc} download={alt} target="_blank" rel="noreferrer">
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

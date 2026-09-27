import { CallEnd, Mic, MicOff, OpenInFull } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";

import Avatar from "../../components/ui/Avatar";
import { useCall } from "../../provider/CallProvider";

const formatDuration = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

/**
 * The minimized call — a small floating bar the person can keep visible
 * while using the rest of the app (Messages, Friends, Feed, ...), per the
 * spec's "minimize call" requirement. It never blocks navigation: it's a
 * small fixed-position pill, not an overlay, and taps land on its own
 * buttons only.
 */
export default function FloatingCall() {
  const call = useCall();
  const ref = useRef(null);
  const drag = useRef(null);
  const [pos, setPos] = useState(null);
  const videoRef = useRef(null);

  const visible = call && call.minimized && (call.status === "ringing" ? call.role === "caller" : ["accepted", "connecting", "connected", "reconnecting"].includes(call.status));
  const pipStream = call?.layoutSwapped ? call?.localStream : call?.remoteStream;

  useEffect(() => {
    if (visible) call.attachVideo(videoRef.current, pipStream);
  }, [visible, call, pipStream]);

  if (!visible) return null;

  const onPointerDown = (event) => {
    // Don't capture the pointer when the press started on one of the bar's
    // own buttons — capturing here would re-target the matching pointerup
    // (and the click synthesized from it) at this container instead of the
    // button, silently swallowing every tap on Mute/Expand/End.
    if (event.target.closest("button")) return;
    const rect = ref.current.getBoundingClientRect();
    drag.current = { startX: event.clientX, startY: event.clientY, originLeft: rect.left, originTop: rect.top };
    ref.current.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.startX;
    const dy = event.clientY - drag.current.startY;
    const width = ref.current.offsetWidth;
    const height = ref.current.offsetHeight;
    setPos({
      left: Math.min(Math.max(8, drag.current.originLeft + dx), window.innerWidth - width - 8),
      top: Math.min(Math.max(8, drag.current.originTop + dy), window.innerHeight - height - 8),
    });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="call-pip fixed z-90 flex w-64 items-center gap-2 rounded-2xl border p-2 shadow-2xl"
      style={{ background: "var(--call-panel-strong)", borderColor: "var(--call-line)", ...(pos ? { left: pos.left, top: pos.top } : { right: 16, bottom: 96 }) }}
      data-testid="call-floating"
    >
      <div className="relative size-11 shrink-0 overflow-hidden rounded-xl">
        {call.remoteStream && call.video ? (
          <video ref={videoRef} autoPlay playsInline muted className="call-video h-full w-full" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: "var(--call-line)" }}>
            <Avatar person={call.peer} size="sm" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold" style={{ color: "var(--call-ink)" }}>{call.peer?.fullName}</p>
        <p className="text-[10px]" style={{ color: "var(--call-muted)" }}>
          {call.status === "connected" ? formatDuration(call.duration) : call.status === "reconnecting" ? "Reconnecting…" : "Calling…"}
        </p>
      </div>
      <button type="button" aria-label="Mute" onClick={call.toggleMic} className="grid size-8 shrink-0 place-items-center rounded-full" style={{ color: "var(--call-ink)" }}>
        {call.micOn ? <Mic fontSize="small" /> : <MicOff fontSize="small" />}
      </button>
      <button type="button" aria-label="Return to call" onClick={() => call.setMinimized(false)} className="grid size-8 shrink-0 place-items-center rounded-full" style={{ color: "var(--call-ink)" }} data-testid="call-expand">
        <OpenInFull fontSize="small" />
      </button>
      <button type="button" aria-label="End call" onClick={call.end} className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: "var(--call-danger)", color: "#fff" }}>
        <CallEnd fontSize="small" />
      </button>
    </div>
  );
}

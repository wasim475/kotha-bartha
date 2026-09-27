import {
  CallEnd,
  ChatBubbleOutlineRounded,
  EmojiEmotions,
  FlipCameraIosRounded,
  Mic,
  MicOff,
  MinimizeRounded,
  ScreenShare,
  StopScreenShare,
  Videocam,
  VideocamOff,
} from "@mui/icons-material";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import Avatar from "../../components/ui/Avatar";
import { useCall } from "../../provider/CallProvider";
import CallChatPanel from "./CallChatPanel";
import CallControlButton from "./CallControlButton";
import CallReactionsOverlay from "./CallReactionsOverlay";
import CallSafetyMenu from "./CallSafetyMenu";

const formatDuration = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const QUALITY_LABEL = { good: "Good connection", unstable: "Unstable connection", poor: "Poor connection" };

function DraggablePip({ children, onTap }) {
  const ref = useRef(null);
  const dragState = useRef(null);
  const [pos, setPos] = useState(null);

  const onPointerDown = (event) => {
    const rect = ref.current.getBoundingClientRect();
    dragState.current = { startX: event.clientX, startY: event.clientY, originLeft: rect.left, originTop: rect.top, moved: false };
    ref.current.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!dragState.current) return;
    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragState.current.moved = true;
    const width = ref.current.offsetWidth;
    const height = ref.current.offsetHeight;
    const left = Math.min(Math.max(8, dragState.current.originLeft + dx), window.innerWidth - width - 8);
    const top = Math.min(Math.max(8, dragState.current.originTop + dy), window.innerHeight - height - 8);
    setPos({ left, top });
  };
  const onPointerUp = () => {
    if (dragState.current && !dragState.current.moved) onTap();
    dragState.current = null;
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="call-pip absolute z-20 h-32 w-24 overflow-hidden rounded-2xl border-2 shadow-xl sm:h-40 sm:w-28"
      style={{ borderColor: "rgba(255,255,255,0.25)", ...(pos ? { left: pos.left, top: pos.top, right: "auto", bottom: "auto" } : { right: 16, top: 88 }) }}
    >
      {children}
    </div>
  );
}

export default function ActiveCall({ userId }) {
  const call = useCall();
  const [fit, setFit] = useState("cover");
  const [cameraCount, setCameraCount] = useState(1);
  const lastTapRef = useRef(0);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const preConnect = call && call.status === "ringing" && call.role === "caller";
  const visible = Boolean(call && !call.minimized && (preConnect || ["accepted", "connecting", "connected", "reconnecting"].includes(call.status)));

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((devices) => setCameraCount(devices.filter((device) => device.kind === "videoinput").length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Re-attach whenever this screen (re)appears too, not just when the
    // stream objects change — the <video> elements themselves are fresh DOM
    // nodes every time `visible` flips from false to true (e.g. returning
    // from the minimized floating bar), and a fresh node's srcObject starts
    // out empty regardless of whether the underlying stream already existed.
    if (call && visible) {
      call.attachVideo(localVideoRef.current, call.localStream);
      call.attachVideo(remoteVideoRef.current, call.remoteStream, { isRemote: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.localStream, call?.remoteStream, call?.layoutSwapped, visible]);

  if (!visible) return null;

  const mainIsRemote = !call.layoutSwapped;
  const showVideo = call.video || call.screenShare.active;
  // The peer connection reaching "connected" only proves the transport is
  // up — it says nothing about whether the remote video is actually
  // decoding frames yet, so the loading state tracks real media readiness
  // (see CallProvider's attachVideo/remoteMediaReady) instead.
  const waitingForMedia = call.status === "connected" && !call.remoteMediaReady;

  const onMainTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) setFit((current) => (current === "cover" ? "contain" : "cover"));
    lastTapRef.current = now;
  };

  return (
    <div className="call-scope fixed inset-0 z-90 flex flex-col overflow-hidden" style={{ background: "var(--call-bg)" }} data-testid="call-screen">
      {/* Main video — the <video> element stays mounted even for an audio-only
          call or while waiting: it's what actually plays the remote audio,
          not just the picture, so it must never be swapped out for a plain
          avatar div the way the video-only content on top of it can be. */}
      <div className="absolute inset-0" onClick={onMainTap}>
        {!preConnect && (
          <video
            ref={mainIsRemote ? remoteVideoRef : localVideoRef}
            autoPlay
            playsInline
            muted={!mainIsRemote}
            className={`call-video h-full w-full ${fit === "contain" ? "call-video--contain" : ""}`}
          />
        )}
        {(preConnect || !showVideo || !call.remoteStream || !call.remoteMediaReady) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: "var(--call-bg)" }}>
            <span className="call-avatar-breathe">
              <Avatar person={call.peer} size="xl" />
            </span>
            {(preConnect || !showVideo) && (
              <p className="text-lg font-semibold" style={{ color: "var(--call-ink)" }}>{call.peer?.fullName || "Friend"}</p>
            )}
          </div>
        )}
      </div>

      {/* Self PiP (only once we actually have a local stream) — same reasoning:
          keep the element mounted so whichever stream it's holding keeps
          playing its audio, and only overlay the avatar for the video-off case. */}
      {call.localStream && !preConnect && (
        <DraggablePip onTap={() => call.toggleLayout()}>
          <video ref={mainIsRemote ? localVideoRef : remoteVideoRef} autoPlay playsInline muted={mainIsRemote} className="call-video h-full w-full" />
          {!showVideo && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--call-panel-strong)" }}>
              <Avatar person={mainIsRemote ? { fullName: "You" } : call.peer} size="sm" />
            </div>
          )}
        </DraggablePip>
      )}

      <CallReactionsOverlay />

      {/* Top bar */}
      <div className="relative z-30 flex items-center justify-between gap-2 p-3.5">
        <CallControlButton tone="neutral" size={40} label="Minimize call" icon={<MinimizeRounded fontSize="small" />} onClick={() => call.setMinimized(true)} data-testid="call-minimize" />
        <div className="flex flex-col items-center">
          <p className="text-sm font-bold" style={{ color: "var(--call-ink)" }}>{call.peer?.fullName}</p>
          <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--call-muted)" }}>
            {preConnect
              ? call.ringingLive
                ? "Ringing…"
                : "Calling…"
              : call.status === "connecting" || waitingForMedia
                ? "Connecting…"
                : call.status === "reconnecting"
                  ? "Reconnecting…"
                  : call.status === "connected"
                    ? formatDuration(call.duration)
                    : ""}
            {call.quality && call.status === "connected" && (
              <span className="flex items-center gap-1" title={QUALITY_LABEL[call.quality]}>
                <span className={`call-quality-dot call-quality-${call.quality}`} />
              </span>
            )}
          </p>
        </div>
        <CallSafetyMenu />
      </div>

      {(call.status === "connecting" || call.status === "reconnecting" || waitingForMedia) && (
        <div className="call-connecting-bar absolute top-16 right-0 left-0 z-30 h-0.5" />
      )}
      {call.status === "reconnecting" && (
        <p className="relative z-30 text-center text-xs font-semibold" style={{ color: "var(--call-warn)" }}>Reconnecting…</p>
      )}
      {call.audioOnlyFallback && (
        <div className="relative z-30 mx-auto mt-2 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold" style={{ background: "var(--call-panel-strong)", color: "var(--call-ink)" }}>
          Video paused to improve connection
          <button type="button" onClick={call.resumeVideo} className="underline" style={{ color: "var(--accent)" }}>Turn video back on</button>
        </div>
      )}

      <div className="flex-1" />

      <AnimatePresence>{call.chatOpen && <CallChatPanel key="call-chat" userId={userId} />}</AnimatePresence>

      {/* Controls */}
      <div className="relative z-30 flex flex-wrap items-center justify-center gap-3 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0)+16px)]">
        <CallControlButton tone={call.micOn ? "neutral" : "off"} label={call.micOn ? "Mute microphone" : "Unmute microphone"} icon={call.micOn ? <Mic /> : <MicOff />} onClick={call.toggleMic} data-testid="call-mic" />
        {call.video && (
          <CallControlButton tone={call.cameraOn ? "neutral" : "off"} label={call.cameraOn ? "Turn camera off" : "Turn camera on"} icon={call.cameraOn ? <Videocam /> : <VideocamOff />} onClick={call.toggleCamera} data-testid="call-camera" />
        )}
        {call.video && cameraCount > 1 && (
          <CallControlButton tone="neutral" label="Switch camera" icon={<FlipCameraIosRounded />} onClick={call.switchCamera} />
        )}
        {call.video && typeof navigator !== "undefined" && navigator.mediaDevices?.getDisplayMedia && (
          <CallControlButton
            tone={call.screenShare.mine ? "active" : "neutral"}
            label={call.screenShare.mine ? "Stop sharing your screen" : "Share your screen"}
            icon={call.screenShare.mine ? <StopScreenShare /> : <ScreenShare />}
            disabled={call.screenShare.active && !call.screenShare.mine}
            onClick={call.screenShare.mine ? call.stopScreenShare : call.startScreenShare}
          />
        )}
        <CallControlButton tone={call.chatOpen ? "active" : "neutral"} label="In-call chat" icon={<ChatBubbleOutlineRounded />} badge={!call.chatOpen && call.chatUnread ? call.chatUnread : null} onClick={call.toggleChat} data-testid="call-chat-toggle" />
        <ReactionsToggleAnchor />
        <CallControlButton tone="danger" size={60} label={preConnect ? "Cancel call" : "End call"} icon={<CallEnd />} onClick={preConnect ? call.cancel : call.end} data-testid="call-end" />
      </div>

      {call.screenShare.active && !call.screenShare.mine && (
        <p className="relative z-30 pb-2 text-center text-xs font-semibold" style={{ color: "var(--call-ink)" }}>{call.peer?.fullName} is sharing their screen</p>
      )}
      {call.screenShare.mine && (
        <p className="relative z-30 pb-2 text-center text-xs font-semibold" style={{ color: "var(--accent)" }}>You are sharing your screen</p>
      )}
    </div>
  );
}

function ReactionsToggleAnchor() {
  const call = useCall();
  const [open, setOpen] = useState(false);
  if (!call) return null;
  return (
    <div className="relative">
      <CallControlButton tone={open ? "active" : "neutral"} label="Reactions" icon={<EmojiEmotions />} onClick={() => setOpen((current) => !current)} />
      <AnimatePresence>
        {open && (
          <Motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full px-2.5 py-2 shadow-xl"
            style={{ background: "var(--call-panel-strong)" }}
          >
            {call.reactionOptions.map((option) => (
              <button
                key={option.type}
                type="button"
                aria-label={option.label}
                onClick={() => {
                  call.sendReaction(option.type);
                  setOpen(false);
                }}
                className="grid size-9 place-items-center rounded-full text-xl transition-transform hover:scale-110"
              >
                {option.emoji}
              </button>
            ))}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

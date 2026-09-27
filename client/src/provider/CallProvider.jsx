import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { api } from "../utility/api";
import { activeSocket, useRealtime } from "../utility/helpers";
import {
  CALL_REACTIONS,
  acceptCall as acceptCallRequest,
  cancelCall as cancelCallRequest,
  declineCall as declineCallRequest,
  endCall as endCallRequest,
  getActiveCall,
  iceServers,
  startCall as startCallRequest,
} from "../utility/call";
import { callHaptics, callSfx, configureCallAudio, startRingtone, stopRingtone } from "../utility/callSound";

export const CallContext = createContext(null);
export const useCall = () => useContext(CallContext);

const IDLE = { status: "idle", callId: null, role: null, peer: null, video: true };
const RECONNECT_GRACE_MS = 2000; // ignore a "disconnected" blip shorter than this
const QUALITY_POLL_MS = 3000;
let reactionSeq = 0;

const emitAck = (event, payload) =>
  new Promise((resolve) => {
    if (!activeSocket) return resolve({ ok: false, error: { code: "OFFLINE" } });
    activeSocket.emit(event, payload, (ack) => resolve(ack || { ok: false }));
  });

// Dev-only tracing for the media pipeline (getUserMedia → addTrack → offer/
// answer → ontrack → <video>). `import.meta.env.DEV` is statically false in
// a production build, so this branch is dead-code-eliminated — never a
// runtime cost or a leak, and never logs tokens/credentials/message content.
const dlog = import.meta.env.DEV ? (...args) => console.log("[call]", ...args) : () => {};

export default function CallProvider({ user, children }) {
  const [call, setCallState] = useState(IDLE);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [layoutSwapped, setLayoutSwapped] = useState(false);
  const [screenShare, setScreenShare] = useState({ active: false, mine: false });
  const [quality, setQuality] = useState(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const [audioOnlyFallback, setAudioOnlyFallback] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [reactions, setReactions] = useState([]);
  // True once the callee's device has actually joined the call room (proof
  // the invite reached a live, rendering client — see call:ringing below),
  // as opposed to just having been created server-side. Lets the caller's
  // UI say "Ringing…" instead of a plain "Calling…" once it's real.
  const [ringingLive, setRingingLive] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  // True only once the remote <video> has actually decoded and started
  // rendering a frame — a WebRTC connectionState of "connected" means the
  // transport is up, not that media is flowing yet (see attachVideo below).
  const [remoteMediaReady, setRemoteMediaReady] = useState(false);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const pendingSignalsRef = useRef([]); // offers/answers that arrived before our own pc existed yet
  const connectedAtRef = useRef(null);
  const reconnectSinceRef = useRef(null);
  const fallbackTriggeredRef = useRef(false);
  const qualityTimerRef = useRef(null);
  const durationTimerRef = useRef(null);
  const callRef = useRef(IDLE);

  // `callRef` is what long-lived callbacks (resetToIdle, the call:* socket
  // handlers, ...) read so they never close over a stale value. It's kept in
  // sync inside this setState updater — which React runs as part of
  // committing the state change, not during this component's own render —
  // rather than as a bare `callRef.current = call` statement in the render
  // body, which reads/writes a ref while rendering.
  const setCall = useCallback((next) => {
    setCallState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      callRef.current = resolved;
      return resolved;
    });
  }, []);

  useEffect(() => {
    if (user?.id) configureCallAudio(user.id);
  }, [user?.id]);

  // Local/remote/screen MediaStream objects: kept in both a ref (read
  // synchronously from long-lived WebRTC callbacks, where a stale closure
  // would be a real bug) and mirrored into state at the same moments (so
  // consumers re-render when a stream actually changes, without reading
  // ref.current during render — see setLocal/RemoteStream below).
  const setLocal = (stream) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
  };
  const setRemote = (stream) => {
    remoteStreamRef.current = stream;
    setRemoteStream(stream);
  };
  const setScreen = (stream) => {
    screenStreamRef.current = stream;
    setScreenStream(stream);
  };

  // ---- Cleanup ------------------------------------------------------------------------------

  const stopAllTracks = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    setLocal(null);
    setRemote(null);
    setScreen(null);
    cameraTrackRef.current = null;
  };

  const resetToIdle = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    stopAllTracks();
    pendingCandidatesRef.current = [];
    connectedAtRef.current = null;
    reconnectSinceRef.current = null;
    fallbackTriggeredRef.current = false;
    clearInterval(qualityTimerRef.current);
    clearInterval(durationTimerRef.current);
    stopRingtone();
    setCall(IDLE);
    setCameraOn(true);
    setMicOn(true);
    setMinimized(false);
    setLayoutSwapped(false);
    setScreenShare({ active: false, mine: false });
    setQuality(null);
    setDuration(0);
    setAudioOnlyFallback(false);
    setChatMessages([]);
    setChatOpen(false);
    setChatUnread(0);
    setReactions([]);
    setRemoteMediaReady(false);
    setRingingLive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stopAllTracks only reads refs, safe to omit
  }, [setCall]);

  // ---- WebRTC ---------------------------------------------------------------------------------

  const ensurePeerConnection = (callId) => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    pcRef.current = pc;
    setRemoteMediaReady(false);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) emitAck("call:ice-candidate", { callId, candidate });
    };
    pc.ontrack = (event) => {
      dlog("ontrack", {
        kind: event.track.kind,
        trackId: event.track.id,
        streamId: event.streams[0]?.id || null,
        trackReadyState: event.track.readyState,
        trackMuted: event.track.muted,
      });
      // Most browsers always populate event.streams[0] when the sender added
      // the track with an explicit stream (see attachLocalTracks below), but
      // per-track-only delivery is valid WebRTC — fall back to accumulating
      // tracks into one persistent MediaStream rather than dropping the track.
      let stream = event.streams[0];
      if (!stream) {
        stream = remoteStreamRef.current instanceof MediaStream ? remoteStreamRef.current : new MediaStream();
        if (!stream.getTracks().some((track) => track.id === event.track.id)) stream.addTrack(event.track);
      }
      event.track.onunmute = () => dlog("remote track unmuted", event.track.kind);
      setRemote(stream);
    };
    pc.oniceconnectionstatechange = () => dlog("iceConnectionState", pc.iceConnectionState);
    pc.onicegatheringstatechange = () => dlog("iceGatheringState", pc.iceGatheringState);
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      dlog("connectionState", state);
      if (state === "connected") {
        reconnectSinceRef.current = null;
        emitAck("call:state", { callId, status: "connected" });
      } else if (state === "disconnected") {
        reconnectSinceRef.current = Date.now();
        setTimeout(() => {
          if (pcRef.current === pc && pc.connectionState === "disconnected" && reconnectSinceRef.current) {
            emitAck("call:state", { callId, status: "reconnecting" });
            if (callRef.current.role === "caller") attemptIceRestart(pc, callId);
          }
        }, RECONNECT_GRACE_MS);
      } else if (state === "failed") {
        if (callRef.current.role === "caller") attemptIceRestart(pc, callId);
        else emitAck("call:state", { callId, status: "reconnecting" });
      }
    };
    return pc;
  };

  const attemptIceRestart = async (pc, callId) => {
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      await emitAck("call:offer", { callId, sdp: offer });
    } catch {
      /* the server's own reconnect timeout will fail the call if this never recovers */
    }
  };

  const getLocalMedia = async (wantVideo) => {
    const constraints = { audio: true, video: wantVideo ? { facingMode: "user" } : false };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      dlog("getUserMedia ok", { tracks: stream.getTracks().map((track) => `${track.kind}:${track.readyState}`) });
      return stream;
    } catch (mediaError) {
      dlog("getUserMedia failed", mediaError?.name, { wantVideo });
      if (wantVideo) {
        // Camera denied/unavailable — fall back to audio-only rather than failing the call outright.
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setError("Camera unavailable — continuing with audio only.");
        return audioOnly;
      }
      throw mediaError;
    }
  };

  const attachLocalTracks = (pc, stream) => {
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
      dlog("addTrack", track.kind, track.id);
    });
    cameraTrackRef.current = stream.getVideoTracks()[0] || null;
  };

  const startAsCaller = async (callId, wantVideo) => {
    const pc = ensurePeerConnection(callId);
    const stream = await getLocalMedia(wantVideo);
    setLocal(stream);
    attachLocalTracks(pc, stream);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    dlog("offer created and sent");
    await emitAck("call:offer", { callId, sdp: offer });
  };

  const startAsCallee = async (callId, wantVideo) => {
    const pc = ensurePeerConnection(callId);
    const stream = await getLocalMedia(wantVideo);
    setLocal(stream);
    attachLocalTracks(pc, stream);
    drainPendingSignals(pc, callId);
  };

  const flushPendingCandidates = async (pc) => {
    const queued = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* a stale/duplicate candidate is harmless to drop */
      }
    }
  };

  const processSignal = async (pc, callId, signal) => {
    dlog("processSignal", signal.type);
    if (signal.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      await flushPendingCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      dlog("answer created and sent");
      await emitAck("call:answer", { callId, sdp: answer });
    } else if (signal.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      await flushPendingCandidates(pc);
    } else if (signal.type === "ice") {
      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(signal.candidate);
        } catch {
          /* ignore a candidate that lost the race with call teardown */
        }
      } else {
        pendingCandidatesRef.current.push(signal.candidate);
      }
    }
  };

  // The callee's own RTCPeerConnection is created right as they accept (see
  // startAsCallee), but that involves an async getUserMedia/socket round
  // trip — the caller's offer can plausibly arrive over the socket before
  // it exists yet. Queueing here (rather than dropping it) is the same fix
  // as pendingCandidatesRef, just one level earlier in the handshake.
  const drainPendingSignals = (pc, callId) => {
    const queued = pendingSignalsRef.current;
    pendingSignalsRef.current = [];
    queued.forEach((signal) => processSignal(pc, callId, signal).catch(() => {}));
  };

  const handleSignal = useCallback(async (event) => {
    const { callId, signal } = event.detail || {};
    if (!callId || callId !== callRef.current.callId || !signal) return;
    const pc = pcRef.current;
    if (!pc) {
      if (signal.type !== "ice") pendingSignalsRef.current.push(signal);
      return;
    }
    await processSignal(pc, callId, signal);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- processSignal only reads refs/stable setState, safe to omit
  }, []);
  useRealtime("call:signal", handleSignal);

  // ---- Connection quality (real WebRTC stats only — never a guess) ----------------------------

  useEffect(() => {
    clearInterval(qualityTimerRef.current);
    if (call.status !== "connected") return undefined;
    qualityTimerRef.current = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let rtt = null;
        let loss = 0;
        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded" && report.currentRoundTripTime != null) {
            rtt = report.currentRoundTripTime * 1000;
          }
          if (report.type === "inbound-rtp" && report.kind === "video" && report.packetsLost != null && report.packetsReceived) {
            loss = report.packetsLost / (report.packetsLost + report.packetsReceived);
          }
        });
        const next = rtt == null ? null : rtt > 400 || loss > 0.08 ? "poor" : rtt > 150 || loss > 0.02 ? "unstable" : "good";
        setQuality(next);
        if (next === "poor" && !fallbackTriggeredRef.current && cameraTrackRef.current?.enabled) {
          fallbackTriggeredRef.current = true;
          cameraTrackRef.current.enabled = false;
          setCameraOn(false);
          setAudioOnlyFallback(true);
        }
      } catch {
        /* stats unavailable this tick — skip, never fabricate a reading */
      }
    }, QUALITY_POLL_MS);
    return () => clearInterval(qualityTimerRef.current);
  }, [call.status]);

  // ---- Duration (server's connectedAt, never a client-only clock) -----------------------------

  useEffect(() => {
    clearInterval(durationTimerRef.current);
    if (call.status !== "connected" || !connectedAtRef.current) return undefined;
    const tick = () => setDuration(Math.max(0, Math.round((Date.now() - connectedAtRef.current) / 1000)));
    tick();
    durationTimerRef.current = setInterval(tick, 1000);
    return () => clearInterval(durationTimerRef.current);
  }, [call.status]);

  // ---- Rehydrate an in-progress call on load/refresh -------------------------------------------

  const rehydrate = useCallback(async () => {
    if (callRef.current.status !== "idle") return;
    try {
      const active = await getActiveCall();
      if (!active) return;
      connectedAtRef.current = active.connectedAt ? new Date(active.connectedAt).getTime() : null;
      setCall({ status: active.status, callId: active.id, role: active.role, peer: active.peer, video: active.video, conversationId: active.conversationId });
      setScreenShare({ active: active.screenShare?.active || false, mine: active.screenShare?.byUserId === user.id });
      await emitAck("call:join", { callId: active.id });
      if (["accepted", "connecting", "connected", "reconnecting"].includes(active.status)) {
        // Refreshed mid-call: rebuild our own side of the connection and let a
        // fresh offer/answer (triggered by whichever side reconnects first)
        // re-establish media — we don't know our previous SDP any more.
        if (active.role === "caller") await startAsCaller(active.id, active.video).catch((mediaError) => setError(mediaError.message || "Couldn't access camera/microphone."));
        else await startAsCallee(active.id, active.video).catch((mediaError) => setError(mediaError.message || "Couldn't access camera/microphone."));
      } else if (active.status === "ringing") {
        startRingtone();
      }
    } catch {
      /* no active call, or the network hiccuped — nothing to restore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startAsCaller/startAsCallee only read refs/stable setState, safe to omit
  }, [user]);

  useEffect(() => {
    // Initial hydration of an in-progress call (e.g. a page refresh mid-call);
    // state is set after the response. Deliberately mount-only — `rehydrate`
    // is stable in effect (see its own `[user]` deps).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    rehydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useRealtime("realtime:connected", rehydrate);

  // ---- Actions ----------------------------------------------------------------------------------

  const call_ = useCallback(async (peer, { video = true } = {}) => {
    if (callRef.current.status !== "idle") return { ok: false, message: "You're already in a call." };
    setError("");
    setCall({ status: "calling", callId: null, role: "caller", peer, video });
    try {
      const summary = await startCallRequest(peer.id, video);
      setCall({ status: "ringing", callId: summary.id, role: "caller", peer, video, conversationId: summary.conversationId });
      await emitAck("call:join", { callId: summary.id });
      startRingtone();
      return { ok: true };
    } catch (requestError) {
      resetToIdle();
      const message = requestError?.response?.data?.error?.message || "Couldn't start the call.";
      setError(message);
      return { ok: false, message };
    }
  }, [resetToIdle, setCall]);

  const accept = useCallback(async () => {
    const { callId, video } = callRef.current;
    if (!callId) return;
    try {
      stopRingtone();
      await acceptCallRequest(callId);
      callHaptics.accepted();
      callSfx.accepted();
      setCall((current) => ({ ...current, status: "accepted" }));
      await emitAck("call:join", { callId });
      await startAsCallee(callId, video);
      await emitAck("call:state", { callId, status: "connecting" });
    } catch (acceptError) {
      setError(acceptError?.response?.data?.error?.message || "Couldn't accept the call.");
      resetToIdle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startAsCallee only reads refs/stable setState, safe to omit
  }, [resetToIdle]);

  const decline = useCallback(async () => {
    const { callId } = callRef.current;
    stopRingtone();
    if (callId) await declineCallRequest(callId).catch(() => {});
    resetToIdle();
  }, [resetToIdle]);

  const cancel = useCallback(async () => {
    const { callId } = callRef.current;
    stopRingtone();
    if (callId) await cancelCallRequest(callId).catch(() => {});
    resetToIdle();
  }, [resetToIdle]);

  const end = useCallback(async () => {
    const { callId, status } = callRef.current;
    callSfx.ended();
    callHaptics.ended();
    if (callId && status !== "idle") await endCallRequest(callId).catch(() => {});
    resetToIdle();
  }, [resetToIdle]);

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
    callSfx.mute(!track.enabled);
  };

  const toggleCamera = () => {
    const track = cameraTrackRef.current;
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
    callSfx.camera(track.enabled);
    if (track.enabled) {
      setAudioOnlyFallback(false);
      fallbackTriggeredRef.current = false;
    }
  };

  const resumeVideo = () => {
    setAudioOnlyFallback(false);
    fallbackTriggeredRef.current = false;
    if (cameraTrackRef.current) {
      cameraTrackRef.current.enabled = true;
      setCameraOn(true);
    }
  };

  const switchCamera = async () => {
    const track = cameraTrackRef.current;
    if (!track) return;
    const current = track.getSettings().facingMode;
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: current === "user" ? "environment" : "user" } });
      const newTrack = next.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((item) => item.track?.kind === "video");
      await sender?.replaceTrack(newTrack);
      track.stop();
      localStreamRef.current?.removeTrack(track);
      localStreamRef.current?.addTrack(newTrack);
      cameraTrackRef.current = newTrack;
    } catch {
      setError("Couldn't switch camera.");
    }
  };

  const startScreenShare = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Screen sharing isn't supported on this device/browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((item) => item.track?.kind === "video");
      await sender?.replaceTrack(track);
      setScreen(stream);
      track.onended = () => stopScreenShare();
      await emitAck("call:screen-share:start", { callId: callRef.current.callId });
      setScreenShare({ active: true, mine: true });
      callSfx.screenShare(true);
    } catch {
      /* user cancelled the picker, or the browser denied it — nothing to clean up */
    }
  };

  const stopScreenShare = async () => {
    const sender = pcRef.current?.getSenders().find((item) => item.track?.kind === "video");
    if (cameraTrackRef.current) await sender?.replaceTrack(cameraTrackRef.current);
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    setScreen(null);
    if (callRef.current.callId) await emitAck("call:screen-share:stop", { callId: callRef.current.callId });
    setScreenShare({ active: false, mine: false });
    callSfx.screenShare(false);
  };

  const sendReaction = (type) => {
    if (!callRef.current.callId) return;
    activeSocket?.emit("call:reaction", { callId: callRef.current.callId, type });
    pushFloatingReaction(type, true);
  };

  const pushFloatingReaction = (type, mine) => {
    const id = ++reactionSeq;
    setReactions((current) => [...current.slice(-11), { id, type, mine }]);
    setTimeout(() => setReactions((current) => current.filter((item) => item.id !== id)), 2300);
  };

  // ---- Chat (plain messages in the same 1-to-1 conversation; no history fetch — only
  // what arrives while this call is open, so it behaves like a lightweight side panel) ----------

  const sendChatMessage = useCallback(async (text) => {
    const body = text.trim();
    const conversationId = callRef.current.conversationId;
    if (!body || !conversationId) return;
    const optimisticId = `pending-${Date.now()}`;
    setChatMessages((current) => [...current, { id: optimisticId, body, senderId: user.id, createdAt: new Date().toISOString(), pending: true }]);
    try {
      const { data } = await api.post(`/conversations/${conversationId}/messages`, { body });
      setChatMessages((current) => current.map((message) => (message.id === optimisticId ? { ...data.data, pending: false } : message)));
    } catch {
      setChatMessages((current) => current.filter((message) => message.id !== optimisticId));
    }
  }, [user]);

  const toggleChat = () => setChatOpen((open) => { if (!open) setChatUnread(0); return !open; });

  // ---- Socket listeners for the call's own lifecycle -------------------------------------------

  useRealtime("call:invite", useCallback((event) => {
    const invite = event.detail?.call;
    if (!invite) return;
    if (callRef.current.status !== "idle") {
      // Already on a call/ringing elsewhere — decline cleanly instead of stacking popups.
      declineCallRequest(invite.id).catch(() => {});
      return;
    }
    setCall({ status: "ringing", callId: invite.id, role: "callee", peer: invite.caller, video: invite.video, conversationId: invite.conversationId });
    startRingtone();
    // Proves to the caller this is a live, rendering device (not just a
    // socket that happens to be connected) — lets their UI say "Ringing…"
    // instead of "Calling…". Fires the instant the invite arrives, before
    // the person has looked at the popup, same as a real phone ringing.
    emitAck("call:join", { callId: invite.id });
  }, [setCall]));

  useRealtime("call:ringing", useCallback((event) => {
    if (event.detail?.callId !== callRef.current.callId || callRef.current.role !== "caller") return;
    setRingingLive(true);
  }, []));

  useRealtime("call:accepted", useCallback((event) => {
    const summary = event.detail?.call;
    if (!summary || summary.id !== callRef.current.callId) return;
    stopRingtone();
    if (callRef.current.role !== "caller") return; // my own other tab answered it
    connectedAtRef.current = null;
    setCall((current) => ({ ...current, status: "accepted", conversationId: summary.conversationId }));
    callSfx.accepted();
    startAsCaller(summary.id, callRef.current.video)
      .then(() => emitAck("call:state", { callId: summary.id, status: "connecting" }))
      .catch((mediaError) => setError(mediaError.message || "Couldn't access camera/microphone."));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startAsCaller only reads refs/stable setState, safe to omit
  }, []));

  useRealtime("call:declined", useCallback((event) => {
    if (event.detail?.callId !== callRef.current.callId) return;
    stopRingtone();
    callSfx.declined();
    if (callRef.current.role === "caller") setError(`${callRef.current.peer?.fullName || "They"} declined the call.`);
    resetToIdle();
  }, [resetToIdle]));

  useRealtime("call:cancelled", useCallback((event) => {
    if (event.detail?.callId !== callRef.current.callId) return;
    stopRingtone();
    resetToIdle();
  }, [resetToIdle]));

  useRealtime("call:missed", useCallback((event) => {
    if (event.detail?.callId !== callRef.current.callId) return;
    stopRingtone();
    resetToIdle();
  }, [resetToIdle]));

  useRealtime("call:state", useCallback((event) => {
    const { callId, status, connectedAt } = event.detail || {};
    if (callId !== callRef.current.callId) return;
    setCall((current) => ({ ...current, status }));
    if (status === "connected" && !connectedAtRef.current) connectedAtRef.current = connectedAt ? new Date(connectedAt).getTime() : Date.now();
  }, [setCall]));

  useRealtime("call:ended", useCallback((event) => {
    if (event.detail?.callId !== callRef.current.callId) return;
    // "failed" is the server giving up on a call that never connected (or
    // dropped and couldn't recover) — surface that instead of the call
    // silently vanishing, which otherwise looks identical to a normal end.
    if (event.detail?.reason === "failed") setError("Couldn't connect the call.");
    resetToIdle();
  }, [resetToIdle]));

  useRealtime("call:screen-share:start", useCallback((event) => {
    const { callId, byUserId } = event.detail || {};
    if (callId !== callRef.current.callId) return;
    setScreenShare({ active: true, mine: byUserId === user.id });
  }, [user]));
  useRealtime("call:screen-share:stop", useCallback((event) => {
    if (event.detail?.callId !== callRef.current.callId) return;
    setScreenShare({ active: false, mine: false });
  }, []));

  useRealtime("call:reaction", useCallback((event) => {
    const { callId, from, type } = event.detail || {};
    if (callId !== callRef.current.callId || from === user.id) return;
    pushFloatingReaction(type, false);
    callSfx.reaction();
  }, [user]));

  useRealtime("message:new", useCallback((event) => {
    const message = event.detail;
    if (!message || message.conversationId !== callRef.current.conversationId || message.type === "call") return;
    if (String(message.senderId) === String(user.id)) return; // our own send is applied optimistically already
    setChatMessages((current) => [...current, message]);
    if (chatOpen) return;
    setChatUnread((count) => count + 1);
    callSfx.message();
  }, [user, chatOpen]));

  // Assigning `srcObject` alone doesn't guarantee playback: the `autoplay`
  // attribute is unreliable once the assignment happens asynchronously well
  // after the click that started/accepted the call (exactly what happens
  // here — it fires from a useEffect once ICE finishes), and an UNMUTED
  // element (the remote video always is — see ActiveCall) is the case
  // browsers are strictest about. This is the actual root cause of "call
  // connects but the remote face/audio never appears": the peer connection
  // reaching "connected" only proves the transport is up, never that the
  // element is actually decoding and rendering frames.
  const attachVideo = (el, stream, { isRemote = false } = {}) => {
    if (!el || !stream) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      dlog("attachVideo", { isRemote, streamId: stream.id, tracks: stream.getTracks().map((track) => track.kind) });
      if (isRemote) setRemoteMediaReady(false);
    }
    const tryPlay = () => {
      const playPromise = el.play();
      playPromise?.catch((playError) => {
        dlog("video.play() blocked", playError?.name, { isRemote, muted: el.muted });
        if (!el.muted) {
          // A muted autoplay is allowed almost everywhere; unmuting right
          // after an element is already playing is treated differently from
          // a fresh unmuted autoplay request, so this recovers real audio
          // instead of leaving the element permanently paused.
          el.muted = true;
          el.play()?.then(() => { el.muted = false; }).catch((retryError) => dlog("muted retry also failed", retryError?.name));
        }
      });
    };
    tryPlay();
    if (isRemote && !el.dataset.callReadyBound) {
      el.dataset.callReadyBound = "1";
      const markReady = () => {
        dlog("remote video ready", { readyState: el.readyState, videoWidth: el.videoWidth, videoHeight: el.videoHeight });
        setRemoteMediaReady(true);
      };
      el.addEventListener("loadeddata", markReady);
      el.addEventListener("playing", markReady);
    }
  };

  const value = useMemo(
    () => ({
      ...call,
      cameraOn,
      micOn,
      minimized,
      layoutSwapped,
      screenShare,
      quality,
      duration,
      error,
      audioOnlyFallback,
      chatMessages,
      chatOpen,
      chatUnread,
      reactions,
      ringingLive,
      reactionOptions: CALL_REACTIONS,
      localStream,
      remoteStream,
      remoteMediaReady,
      screenStream,
      attachVideo,
      startCall: call_,
      accept,
      decline,
      cancel,
      end,
      toggleMic,
      toggleCamera,
      switchCamera,
      resumeVideo,
      startScreenShare,
      stopScreenShare,
      sendReaction,
      sendChatMessage,
      toggleChat,
      setMinimized,
      toggleLayout: () => setLayoutSwapped((swapped) => !swapped),
      dismissError: () => setError(""),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [call, cameraOn, micOn, minimized, layoutSwapped, screenShare, quality, duration, error, audioOnlyFallback, chatMessages, chatOpen, chatUnread, reactions, ringingLive, localStream, remoteStream, remoteMediaReady, screenStream],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

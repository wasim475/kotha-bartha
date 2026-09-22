import { useEffect, useRef, useState } from "react";
import { api } from "../../../utility/api";
import { sendSignal, useRealtime } from "../../../utility/helpers";

// How long the caller rings before auto-cancelling as a missed call, and
// how long the receiver's incoming-call banner waits before dismissing
// itself if the caller's side goes silent (tab closed, network drop, etc.)
// without ever sending an explicit "end" signal.
const RING_TIMEOUT_MS = 30000;
const INCOMING_TIMEOUT_MS = 35000;

const useVoiceCall = ({ selected, conversationId, thread, conversations }) => {
  const [callState, setCallStateValue] = useState("idle");
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  const remoteAudio = useRef(null);
  const peer = useRef(null);
  const localStream = useRef(null);
  const isCallerRef = useRef(false);
  const reportedRef = useRef(false);
  const activeStartRef = useRef(null);
  const ringTimeoutRef = useRef(null);
  const incomingTimeoutRef = useRef(null);
  // Long-lived callbacks (RTCPeerConnection.onconnectionstatechange) are set
  // up once inside createPeer and can fire many renders later, so they'd
  // otherwise close over a stale `callState`. Read this ref instead of the
  // state value inside finishCall so it always sees the current state.
  const callStateRef = useRef("idle");
  const setCallState = (next) => {
    callStateRef.current = next;
    setCallStateValue(next);
  };

  const clearCallTimers = () => {
    clearTimeout(ringTimeoutRef.current);
    clearTimeout(incomingTimeoutRef.current);
  };

  const reportOutcome = (outcome, durationSec = 0) => {
    if (!isCallerRef.current || reportedRef.current || !conversationId) return;
    reportedRef.current = true;

    api
      .post(`/conversations/${conversationId}/calls`, { outcome, durationSec })
      .then(({ data }) => {
        thread?.setData((messages = []) => [...messages, data.data]);
        conversations?.reload();
      })
      .catch((error) => {
        console.error("Could not save call record:", error);
      });
  };

  // notify: tell the other side we're hanging up. reason: how this call is
  // ending, used (caller-side only) to pick the right outcome to report.
  //   "manual"  — this user clicked End/Cancel
  //   "timeout" — the caller's ring timer expired with no answer
  //   "remote"  — reacting to the other side's own "end" signal
  const finishCall = (notify = true, reason = "manual") => {
    if (callStateRef.current === "idle") return;

    if (callStateRef.current === "active" && activeStartRef.current) {
      reportOutcome("completed", Math.round((Date.now() - activeStartRef.current) / 1000));
    } else if (callStateRef.current === "calling") {
      reportOutcome(reason === "manual" ? "cancelled" : "missed");
    }

    if (notify && selected) {
      sendSignal(selected.user.id, { type: "end" });
    }

    clearCallTimers();
    peer.current?.close();
    peer.current = null;

    localStream.current?.getTracks().forEach((track) => track.stop());
    localStream.current = null;

    if (remoteAudio.current) {
      remoteAudio.current.srcObject = null;
    }

    isCallerRef.current = false;
    reportedRef.current = false;
    activeStartRef.current = null;
    setIncomingCall(null);
    setCallDuration(0);
    setCallState("idle");
  };

  const createPeer = async (targetId) => {
    localStream.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    const connection = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });

    peer.current = connection;

    localStream.current.getTracks().forEach((track) => {
      connection.addTrack(track, localStream.current);
    });

    connection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendSignal(targetId, {
          type: "ice",
          candidate,
        });
      }
    };

    connection.ontrack = ({ streams }) => {
      if (remoteAudio.current) {
        remoteAudio.current.srcObject = streams[0];
      }
    };

    connection.onconnectionstatechange = () => {
      if (
        ["failed", "closed", "disconnected"].includes(
          connection.connectionState,
        )
      ) {
        finishCall(false);
      }
    };

    return connection;
  };

  const startCall = async () => {
    if (!selected || callState !== "idle") return;

    try {
      isCallerRef.current = true;
      reportedRef.current = false;
      setCallState("calling");

      const connection = await createPeer(selected.user.id);

      const offer = await connection.createOffer();

      await connection.setLocalDescription(offer);

      sendSignal(selected.user.id, {
        type: "offer",
        sdp: offer,
      });

      ringTimeoutRef.current = setTimeout(() => finishCall(true, "timeout"), RING_TIMEOUT_MS);
    } catch {
      finishCall(false);
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;

    clearTimeout(incomingTimeoutRef.current);

    try {
      setCallState("active");
      activeStartRef.current = Date.now();

      const connection = await createPeer(incomingCall.from);

      await connection.setRemoteDescription(incomingCall.signal.sdp);

      const answer = await connection.createAnswer();

      await connection.setLocalDescription(answer);

      sendSignal(incomingCall.from, {
        type: "answer",
        sdp: answer,
      });

      setIncomingCall(null);
    } catch {
      finishCall(false);
    }
  };

  useRealtime("call:signal", async (event) => {
    const { from, signal } = event.detail;

    if (from !== selected?.user.id) {
      return;
    }

    if (signal.type === "offer") {
      setIncomingCall({ from, signal });
      setCallState("incoming");
      incomingTimeoutRef.current = setTimeout(() => finishCall(false), INCOMING_TIMEOUT_MS);
    } else if (signal.type === "answer" && peer.current) {
      clearTimeout(ringTimeoutRef.current);
      activeStartRef.current = Date.now();
      await peer.current.setRemoteDescription(signal.sdp);

      setCallState("active");
    } else if (signal.type === "ice" && peer.current) {
      await peer.current.addIceCandidate(signal.candidate);
    } else if (signal.type === "end") {
      finishCall(false, "remote");
    }
  });

  // Live call timer, ticking once a second while a call is active.
  // callDuration is already 0 here: finishCall always resets it before a
  // new call can become active, and it starts at 0 on mount.
  useEffect(() => {
    if (callState !== "active") return undefined;

    const interval = setInterval(() => {
      if (activeStartRef.current) {
        setCallDuration(Math.round((Date.now() - activeStartRef.current) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [callState]);

  useEffect(() => {
    return () => {
      finishCall(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  return {
    callState,
    incomingCall,
    callDuration,
    remoteAudio,
    startCall,
    acceptCall,
    finishCall,
  };
};

export default useVoiceCall;

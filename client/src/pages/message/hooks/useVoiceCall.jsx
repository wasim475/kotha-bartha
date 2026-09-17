import { useEffect, useRef, useState } from "react";
import { sendSignal, useRealtime } from "../../../utility/helpers";

const useVoiceCall = ({ selected, conversationId }) => {
  const [callState, setCallState] = useState("idle");
  const [incomingCall, setIncomingCall] = useState(null);

  const remoteAudio = useRef(null);
  const peer = useRef(null);
  const localStream = useRef(null);

  const finishCall = (notify = true) => {
    if (notify && selected) {
      sendSignal(selected.user.id, {
        type: "end",
      });
    }

    peer.current?.close();
    peer.current = null;

    localStream.current?.getTracks().forEach((track) => track.stop());
    localStream.current = null;

    if (remoteAudio.current) {
      remoteAudio.current.srcObject = null;
    }

    setIncomingCall(null);
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
    if (!selected) return;

    try {
      setCallState("calling");

      const connection = await createPeer(selected.user.id);

      const offer = await connection.createOffer();

      await connection.setLocalDescription(offer);

      sendSignal(selected.user.id, {
        type: "offer",
        sdp: offer,
      });
    } catch {
      finishCall(false);
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;

    try {
      setCallState("active");

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
      setIncomingCall({
        from,
        signal,
      });

      setCallState("incoming");
    } else if (signal.type === "answer" && peer.current) {
      await peer.current.setRemoteDescription(signal.sdp);

      setCallState("active");
    } else if (signal.type === "ice" && peer.current) {
      await peer.current.addIceCandidate(signal.candidate);
    } else if (signal.type === "end") {
      finishCall(false);
    }
  });

  useEffect(() => {
    return () => {
      finishCall(false);
    };
  }, [conversationId]);

  return {
    callState,
    incomingCall,
    remoteAudio,
    startCall,
    acceptCall,
    finishCall,
  };
};

export default useVoiceCall;
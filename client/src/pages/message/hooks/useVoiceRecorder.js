import { useRef, useState } from "react";

// Thin wrapper around the browser's built-in MediaRecorder — no extra
// package needed for voice-message recording.
const useVoiceRecorder = ({ onRecorded }) => {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const startedAtRef = useRef(null);
  const cancelledRef = useRef(false);

  const cleanup = () => {
    clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setSeconds(0);
  };

  const start = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const duration = Math.round((Date.now() - startedAtRef.current) / 1000);
        const wasCancelled = cancelledRef.current;
        cleanup();
        if (!wasCancelled && duration > 0) onRecorded(blob, duration);
      };

      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setRecording(true);
      setSeconds(0);
      intervalRef.current = setInterval(() => {
        setSeconds(Math.round((Date.now() - startedAtRef.current) / 1000));
      }, 1000);
    } catch {
      cleanup();
    }
  };

  const stop = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  const cancel = () => {
    cancelledRef.current = true;
    stop();
  };

  return { recording, seconds, start, stop, cancel };
};

export default useVoiceRecorder;

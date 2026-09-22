import { Pause, PlayArrow } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";

import { cx } from "../../../utility/cx";

const formatTime = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds)) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

/**
 * Minimal custom audio player (play/pause, progress, elapsed/duration) for
 * voice messages — native <audio controls> looks inconsistent across
 * browsers and doesn't match the app's bubble styling.
 */
export default function VoiceMessagePlayer({ src, durationSec = 0, isOwn }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  const seek = (event) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  const progressPct = duration ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="flex w-56 max-w-full items-center gap-2.5">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={cx(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isOwn ? "bg-white/20 text-white" : "bg-accent/15 text-accent",
        )}
      >
        {playing ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          onClick={seek}
          className={cx(
            "h-1.5 w-full cursor-pointer rounded-full",
            isOwn ? "bg-white/25" : "bg-line",
          )}
        >
          <div
            className={cx("h-full rounded-full", isOwn ? "bg-white" : "bg-accent")}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className={cx("mt-1 block text-[10px]", isOwn ? "text-white/75" : "text-muted")}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

import { SettingsRounded, VolumeUpRounded } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";

import { ludoSfx, startMusic, updateLudoSettings, useLudoSettings, vibrate } from "../../../../../utility/ludoSound";

const OPTIONS = [
  { key: "sound", label: "Sound effects", hint: "Dice, moves, captures" },
  { key: "music", label: "Music", hint: "A soft background loop" },
  { key: "vibration", label: "Vibration", hint: "On phones that support it" },
  { key: "notifications", label: "Notification sounds", hint: "Game invitations" },
];

function Switch({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-soft"
      data-testid={`ludo-switch-${label.split(" ")[0].toLowerCase()}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-[11px] text-muted">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? "var(--accent)" : "var(--line)" }}
      >
        <span className="absolute top-0.5 size-5 rounded-full bg-white shadow transition-all" style={{ left: checked ? 22 : 2 }} />
      </span>
      <span className="sr-only">{checked ? "On" : "Off"}</span>
    </button>
  );
}

/** Sound / music / vibration / notification-sound switches, saved per user. */
export default function SettingsMenu({ compact = false }) {
  const settings = useLudoSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const key = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const toggle = (key) => {
    const next = !settings[key];
    updateLudoSettings({ [key]: next });
    if (key === "music" && next) startMusic();
    if (key === "sound" && next) ludoSfx.click();
    if (key === "vibration" && next) vibrate(30);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Game settings: sound, music, vibration"
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-panel px-2.5 text-xs font-semibold text-ink hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{ borderWidth: 1, borderStyle: "solid", borderColor: "var(--line)", background: "var(--panel)" }}
        data-testid="ludo-settings"
      >
        {settings.sound ? <VolumeUpRounded fontSize="small" /> : <SettingsRounded fontSize="small" />}
        {!compact && <span className="hidden min-[420px]:inline">Sound</span>}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 w-72 max-w-[calc(100vw-24px)] rounded-2xl border border-line bg-panel p-2 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.35)]"
          data-testid="ludo-settings-menu"
        >
          {OPTIONS.map((option) => (
            <Switch key={option.key} checked={settings[option.key]} onChange={() => toggle(option.key)} label={option.label} hint={option.hint} />
          ))}
        </div>
      )}
    </div>
  );
}

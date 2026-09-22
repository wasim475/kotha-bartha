import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { Check, Close } from "@mui/icons-material";
import { useState } from "react";

import IconButton from "../../../components/ui/IconButton";
import { cx } from "../../../utility/cx";
import { CONVERSATION_THEMES } from "../utility/conversationThemes";

export default function ThemeDialog({ open, currentTheme, onClose, onSelect }) {
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  const choose = async (themeId) => {
    if (themeId === currentTheme || savingId) return;
    setSavingId(themeId);
    setError("");
    try {
      await onSelect(themeId);
    } catch (selectError) {
      setError(selectError.response?.data?.error?.message || "Couldn't change the theme.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 transition-opacity duration-150 data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full max-w-sm rounded-lg border border-line bg-panel p-5 shadow-soft transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-lg font-semibold text-ink">
              Chat theme
            </DialogTitle>
            <IconButton label="Close" icon={<Close fontSize="small" />} size="sm" onClick={onClose} />
          </div>
          <p className="mt-1 text-xs text-muted">
            The theme you pick is shared — the other person will see it too.
          </p>

          <div className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4">
            {CONVERSATION_THEMES.map((theme) => {
              const active = theme.id === currentTheme;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => choose(theme.id)}
                  disabled={Boolean(savingId)}
                  className="flex flex-col items-center gap-1.5 disabled:cursor-wait"
                >
                  <span
                    className={cx(
                      "flex size-11 items-center justify-center rounded-full shadow-sm ring-2 ring-offset-2 ring-offset-panel transition motion-safe:duration-150",
                      active ? "ring-ink" : "ring-transparent",
                      savingId === theme.id && "opacity-60",
                    )}
                    style={{ backgroundColor: theme.swatch }}
                  >
                    {active && <Check fontSize="small" className="text-white" />}
                  </span>
                  <span className="text-[10px] font-medium text-muted">{theme.label}</span>
                </button>
              );
            })}
          </div>

          {error && <p className="mt-3 text-xs font-medium text-danger">{error}</p>}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

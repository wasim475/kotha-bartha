import { Quiz as QuizIcon } from "@mui/icons-material";

/**
 * Shared "backend data still loading" state for the quiz feature — shown
 * while a quiz set is being started/resumed (QuizFlow.jsx) and as a
 * defensive fallback if QuizPlayer ever renders before its question data
 * is ready. Deliberately not a generic spinner/"Loading…" so it reads as
 * part of the quiz experience rather than a bare loading indicator.
 */
export default function QuizLoader({ label = "Preparing your quiz…" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-3 py-20 text-center"
    >
      <div className="relative flex size-14 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
        <span className="relative flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent">
          <QuizIcon fontSize="medium" />
        </span>
      </div>
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  );
}

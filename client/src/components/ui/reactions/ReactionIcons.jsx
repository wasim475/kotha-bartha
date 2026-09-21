import { Favorite, ThumbUpAlt } from "@mui/icons-material";

const FACE_YELLOW = "#f7c948";
const FACE_LINE = "#5b4636";

function HahaFace() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full">
      <circle cx="12" cy="12" r="10" fill={FACE_YELLOW} />
      <path
        d="M7.8 9.6c.9-.9 1.6-.9 2.5 0M13.7 9.6c.9-.9 1.6-.9 2.5 0"
        fill="none"
        stroke={FACE_LINE}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7 13.5c1.3 3.2 3.2 4.3 5 4.3s3.7-1.1 5-4.3c.2-.5-.2-1-.8-.8-1.2.5-2.7.8-4.2.8s-3-.3-4.2-.8c-.6-.2-1 .3-.8.8Z"
        fill={FACE_LINE}
      />
    </svg>
  );
}

function SadFace() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full">
      <circle cx="12" cy="12" r="10" fill={FACE_YELLOW} />
      <circle cx="8.5" cy="9.5" r="1" fill={FACE_LINE} />
      <circle cx="15.5" cy="9.5" r="1" fill={FACE_LINE} />
      <path
        d="M8 17c1.2-1.8 2.5-2.6 4-2.6s2.8.8 4 2.6"
        fill="none"
        stroke={FACE_LINE}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AngryFace() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full">
      <circle cx="12" cy="12" r="10" fill={FACE_YELLOW} />
      <path
        d="m7.2 8.7 3 1M16.8 8.7l-3 1"
        stroke="#8b2f2f"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="8.5" cy="11" r="1" fill={FACE_LINE} />
      <circle cx="15.5" cy="11" r="1" fill={FACE_LINE} />
      <path
        d="M8 17c1.4-1 2.7-1.4 4-1.4s2.6.4 4 1.4"
        fill="none"
        stroke={FACE_LINE}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const renderers = {
  like: () => <ThumbUpAlt className="size-full text-accent" />,
  love: () => <Favorite className="size-full text-danger" />,
  haha: HahaFace,
  sad: SadFace,
  angry: AngryFace,
};

/**
 * Renders one reaction's face/icon. Every type renders inside the same
 * square box (sized by the parent via `className`) so the five reactions
 * line up cleanly wherever they're used: the trigger button, the picker
 * row, and the compact summary.
 */
export default function ReactionIcon({ type, className = "size-4" }) {
  const Render = renderers[type];
  if (!Render) return null;
  return (
    <span className={className}>
      <Render />
    </span>
  );
}

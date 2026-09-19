import { ThumbUpAlt } from "@mui/icons-material";

function SadReactionIcon() {
  return (
    <svg className="reaction-face" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#f7c948" />
      <circle cx="8.5" cy="9.5" r="1" fill="#5b4636" />
      <circle cx="15.5" cy="9.5" r="1" fill="#5b4636" />
      <path
        d="M8 17c1.2-1.8 2.5-2.6 4-2.6s2.8.8 4 2.6"
        fill="none"
        stroke="#5b4636"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AngryReactionIcon() {
  return (
    <svg className="reaction-face" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#f7c948" />
      <path
        d="m7.2 8.7 3 1M16.8 8.7l-3 1"
        stroke="#8b2f2f"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="8.5" cy="11" r="1" fill="#5b4636" />
      <circle cx="15.5" cy="11" r="1" fill="#5b4636" />
      <path
        d="M8 17c1.4-1 2.7-1.4 4-1.4s2.6.4 4 1.4"
        fill="none"
        stroke="#5b4636"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const reactionIcons = {
  like: ThumbUpAlt,
  haha: "😂",
  sad: SadReactionIcon,
  angry: AngryReactionIcon,
};

const CommentReaction = ({ type, className = "" }) => {
  const Icon = reactionIcons[type];
  if (typeof Icon === "string")
    return <span className={`reaction-emoji ${className}`}>{Icon}</span>;
  return Icon ? <Icon fontSize="small" className={className} /> : null;
};

export default CommentReaction;

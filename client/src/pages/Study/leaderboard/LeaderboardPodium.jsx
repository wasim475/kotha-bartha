import { Link } from "react-router-dom";

import ProfileAvatarLink from "../../../components/ui/ProfileAvatarLink";
import { cx } from "../../../utility/cx";

const TIER = {
  1: {
    medal: "🥇",
    avatarSize: "lg",
    width: "w-20 sm:w-28",
    card: "border-amber-400/70 bg-gradient-to-b from-amber-50 to-panel shadow-md dark:from-amber-950/40 dark:to-panel -translate-y-2 sm:-translate-y-3",
    name: "text-xs font-bold sm:text-sm",
  },
  2: {
    medal: "🥈",
    avatarSize: "md",
    width: "w-16 sm:w-24",
    card: "border-slate-300/70 bg-panel",
    name: "text-[11px] font-semibold sm:text-xs",
  },
  3: {
    medal: "🥉",
    avatarSize: "md",
    width: "w-16 sm:w-24",
    card: "border-orange-300/70 bg-panel",
    name: "text-[11px] font-semibold sm:text-xs",
  },
};

function PodiumCard({ entry }) {
  const tier = TIER[entry.rank];
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-1 rounded-2xl border p-2.5 text-center transition-transform motion-safe:duration-300 sm:gap-1.5 sm:p-3.5",
        tier.width,
        tier.card,
      )}
    >
      <span className="text-lg sm:text-2xl">{tier.medal}</span>
      <ProfileAvatarLink person={{ id: entry.id, fullName: entry.fullName, avatar: entry.avatar }} size={tier.avatarSize} />
      <Link to={`/app/profile/${entry.id}`} className={cx("line-clamp-1 max-w-full text-ink hover:underline", tier.name)}>
        {entry.fullName}
      </Link>
      {entry.currentCity && <p className="line-clamp-1 max-w-full text-[9px] text-muted sm:text-[10px]">{entry.currentCity}</p>}
      <p className="text-xs font-bold tabular-nums text-ink sm:text-sm">{entry.points.toLocaleString()}</p>
    </div>
  );
}

/**
 * The Top-3 podium, always built from the exact same filtered/ranked
 * dataset as the Top 20 list below it (both come from the same
 * `/leaderboard/top` response) — never a separately-fetched "overall"
 * view while the rest of the page is filtered differently. #1 gets a
 * slightly raised position and a warm accent tint; #2/#3 stay visually
 * secondary. Gracefully renders just 1 or 2 cards, centered, when fewer
 * than 3 eligible users exist for the current filters.
 */
export default function LeaderboardPodium({ top3 }) {
  if (!top3.length) return null;

  const first = top3.find((entry) => entry.rank === 1);
  const second = top3.find((entry) => entry.rank === 2);
  const third = top3.find((entry) => entry.rank === 3);

  return (
    <div className="mb-5 flex items-end justify-center gap-2 sm:gap-4">
      {second && <PodiumCard entry={second} />}
      {first && <PodiumCard entry={first} />}
      {third && <PodiumCard entry={third} />}
    </div>
  );
}

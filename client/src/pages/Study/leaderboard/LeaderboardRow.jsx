import { ArrowDownward, ArrowUpward, ChevronRight } from "@mui/icons-material";
import { Link } from "react-router-dom";

import Card from "../../../components/ui/Card";
import ProfileAvatarLink from "../../../components/ui/ProfileAvatarLink";
import { cx } from "../../../utility/cx";

const RANK_BADGE_CLASSES = {
  1: "bg-linear-to-br from-amber-300 to-amber-500 text-amber-950",
  2: "bg-linear-to-br from-slate-300 to-slate-400 text-slate-900",
  3: "bg-linear-to-br from-orange-300 to-orange-500 text-orange-950",
};

// Only rendered when the backend actually has a reliable previous-period
// rank to compare against (period "this week"/"this month" — never "all
// time", and never for a user who wasn't ranked last period) — see
// leaderboard.routes.js's rankChangeFor, which returns null rather than
// guessing whenever that data isn't available.
export function RankChangeBadge({ rankChange }) {
  if (!rankChange) return null;
  if (rankChange.direction === "same") {
    return <span className="text-[10px] font-semibold text-muted">— 0</span>;
  }
  const isUp = rankChange.direction === "up";
  return (
    <span
      className={cx(
        "flex items-center gap-0.5 text-[10px] font-semibold tabular-nums",
        isUp ? "text-green-600 dark:text-green-400" : "text-danger",
      )}
    >
      {isUp ? <ArrowUpward style={{ fontSize: 11 }} /> : <ArrowDownward style={{ fontSize: 11 }} />}
      {rankChange.delta}
    </span>
  );
}

function StatTile({ label, value, sub, tone }) {
  const toneClass =
    tone === "green" ? "text-green-600 dark:text-green-400" : tone === "red" ? "text-danger" : "text-ink";
  return (
    <div className="rounded-lg border border-line bg-panel p-2 text-center">
      <p className={cx("text-base font-bold tabular-nums", toneClass)}>{value.toLocaleString()}</p>
      <p className="text-[10px] text-muted">{label}</p>
      {sub && <p className={cx("text-[10px] font-semibold", toneClass)}>{sub}</p>}
    </div>
  );
}

function ExpandedStatsSkeleton() {
  return (
    <div className="grid animate-pulse gap-3 border-t border-line p-4 motion-reduce:animate-none sm:grid-cols-2">
      <div className="space-y-1.5">
        <div className="h-2.5 w-24 rounded bg-soft" />
        <div className="h-8 rounded-lg bg-soft" />
      </div>
      <div className="space-y-1.5">
        <div className="h-2.5 w-24 rounded bg-soft" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-14 rounded-lg bg-soft" />
          <div className="h-14 rounded-lg bg-soft" />
          <div className="h-14 rounded-lg bg-soft" />
        </div>
      </div>
    </div>
  );
}

function ExpandedStats({ stats }) {
  if (!stats || stats.loading) return <ExpandedStatsSkeleton />;
  if (stats.error) {
    return <p className="border-t border-line p-4 text-xs font-medium text-danger">{stats.error}</p>;
  }

  const { categories, quiz } = stats.data;

  return (
    <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-wide text-muted uppercase">Category Points</p>
        <div className="flex flex-col gap-1.5">
          {categories.map((category) => (
            <div
              key={category.key}
              className="flex items-center justify-between rounded-lg bg-soft px-3 py-2 text-sm"
            >
              <span className="font-medium text-ink">{category.label}</span>
              <span className="font-bold tabular-nums text-ink">{category.points.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-wide text-muted uppercase">Quiz Statistics</p>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Attempted" value={quiz.attempted} />
          <StatTile label="Correct" value={quiz.correct} sub={`${quiz.correctPercent}%`} tone="green" />
          <StatTile label="Wrong" value={quiz.wrong} sub={`${quiz.wrongPercent}%`} tone="red" />
        </div>
        {quiz.attempted > 0 ? (
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-soft">
            <div className="h-full bg-green-500" style={{ width: `${quiz.correctPercent}%` }} />
            <div className="h-full bg-danger" style={{ width: `${quiz.wrongPercent}%` }} />
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted">No quizzes completed in this period.</p>
        )}
      </div>
    </div>
  );
}

/**
 * One Top-20 row. Collapsed: rank badge + rank-change + avatar/name/city +
 * points. Clicking anywhere on the row toggles the expanded stats panel
 * below it (smooth CSS-grid height transition, motion-safe-gated);
 * clicking the avatar or name specifically navigates to that person's
 * profile instead (stopPropagation keeps the two interactions from
 * conflicting, per the existing app convention of avatar/name as a
 * profile link).
 */
export default function LeaderboardRow({ row, isMe, expanded, onToggle, stats }) {
  const rankBadgeClass = RANK_BADGE_CLASSES[row.rank] || "bg-soft text-muted";

  return (
    <Card padded={false} className={cx("overflow-hidden", isMe && "border-accent/50 bg-accent/5")}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        className="flex cursor-pointer items-center gap-2.5 p-3 transition-colors motion-safe:duration-150 hover:bg-soft active:bg-soft sm:gap-3.5 sm:p-3.5"
      >
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          <span
            className={cx(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums sm:size-8",
              rankBadgeClass,
            )}
          >
            {row.rank}
          </span>
          <RankChangeBadge rankChange={row.rankChange} />
        </div>

        <span onClick={(event) => event.stopPropagation()} className="shrink-0">
          <ProfileAvatarLink person={{ id: row.id, fullName: row.fullName, avatar: row.avatar }} size="md" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              to={`/app/profile/${row.id}`}
              onClick={(event) => event.stopPropagation()}
              className="truncate text-sm font-semibold text-ink hover:underline"
            >
              {row.fullName}
            </Link>
            {isMe && (
              <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-accent">
                You
              </span>
            )}
          </div>
          {row.currentCity && <p className="truncate text-xs text-muted">{row.currentCity}</p>}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums text-ink">{row.points.toLocaleString()}</p>
          <p className="text-[10px] text-muted">points</p>
        </div>

        <ChevronRight
          fontSize="small"
          className={cx("shrink-0 text-muted transition-transform motion-safe:duration-200", expanded && "rotate-90")}
        />
      </div>

      {/* Content stays mounted through the collapse transition (only
          gated by grid-rows going to 0fr) rather than unmounting the
          instant `expanded` flips false, so collapsing a row visibly
          shrinks its content away instead of leaving a blank shrinking
          box. */}
      <div
        className={cx(
          "grid transition-[grid-template-rows] motion-safe:duration-300 ease-in-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <ExpandedStats stats={stats} />
        </div>
      </div>
    </Card>
  );
}

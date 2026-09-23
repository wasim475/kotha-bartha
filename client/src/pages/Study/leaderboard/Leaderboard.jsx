import { Groups, Public } from "@mui/icons-material";
import { useEffect, useState } from "react";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { api } from "../../../utility/api";
import SegmentedControl from "./LeaderboardFilters";
import LeaderboardPodium from "./LeaderboardPodium";
import LeaderboardRow, { RankChangeBadge } from "./LeaderboardRow";

const CATEGORY_OPTIONS = [
  { value: "overall", label: "Overall" },
  { value: "quiz", label: "Quiz" },
  { value: "games", label: "Games" },
];
const PERIOD_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "month", label: "This Month" },
  { value: "week", label: "This Week" },
];
const AUDIENCE_OPTIONS = [
  { value: "everyone", label: "Everyone", icon: <Public style={{ fontSize: 14 }} /> },
  { value: "friends", label: "Friends", icon: <Groups style={{ fontSize: 14 }} /> },
];

function LeaderboardRowSkeleton() {
  return (
    <Card
      padded={false}
      className="flex animate-pulse items-center gap-3 p-3 motion-reduce:animate-none sm:gap-3.5 sm:p-3.5"
    >
      <div className="size-7 shrink-0 rounded-full bg-soft sm:size-8" />
      <div className="size-10 shrink-0 rounded-full bg-soft" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-28 rounded bg-soft" />
        <div className="h-2.5 w-20 rounded bg-soft" />
      </div>
      <div className="h-4 w-10 shrink-0 rounded bg-soft" />
    </Card>
  );
}

function PodiumSkeleton() {
  return (
    <div className="mb-5 flex animate-pulse items-end justify-center gap-2 motion-reduce:animate-none sm:gap-4">
      <div className="h-32 w-16 rounded-2xl bg-soft sm:w-24" />
      <div className="h-40 w-20 rounded-2xl bg-soft sm:w-28" />
      <div className="h-32 w-16 rounded-2xl bg-soft sm:w-24" />
    </div>
  );
}

function YourRankCard({ me }) {
  const showProgress = me.nextRank && !me.nextRank.isFirst;
  const progressPercent = showProgress
    ? Math.max(4, Math.min(96, Math.round((me.points / Math.max(1, me.nextRank.points)) * 100)))
    : 100;

  return (
    <Card className="mb-4 flex flex-col gap-3 border-accent/40 bg-accent/5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold tabular-nums text-accent">
          #{me.rank}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-wide text-accent uppercase">Your Rank</p>
          <p className="truncate text-sm font-bold text-ink">{me.points.toLocaleString()} points</p>
        </div>
        <RankChangeBadge rankChange={me.rankChange} />
      </div>

      {me.nextRank?.isFirst ? (
        <p className="text-xs font-semibold text-accent">🏆 You're #1!</p>
      ) : (
        me.nextRank && (
          <div className="min-w-0 sm:w-56">
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span>Next: #{me.nextRank.rank}</span>
              <span>{me.nextRank.pointsNeeded > 0 ? `${me.nextRank.pointsNeeded} pts needed` : "Tied!"}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-soft">
              <div
                className="h-full rounded-full bg-accent transition-all motion-safe:duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )
      )}
    </Card>
  );
}

/**
 * The Study section's Leaderboard tab. Ranking, admin/moderator exclusion,
 * period windows, friends scoping, rank-change and next-rank are all
 * computed server-side (server/src/routes/leaderboard.routes.js) — this
 * component only renders what it's given and lazily fetches each row's
 * detailed stats the moment it's expanded (cached per user+period so
 * re-expanding the same row under the same period never refetches).
 */
export default function Leaderboard() {
  const [category, setCategory] = useState("overall");
  const [period, setPeriod] = useState("all");
  const [audience, setAudience] = useState("everyone");

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [statsById, setStatsById] = useState({});

  const load = async () => {
    setLoading(true);
    setError("");
    setExpandedId(null);
    try {
      const { data } = await api.get("/leaderboard/top", { params: { category, period, audience } });
      setSummary(data.data);
    } catch (loadError) {
      setError(loadError.response?.data?.error?.message || "Couldn't load the leaderboard.");
    } finally {
      setLoading(false);
    }
  };

  // Re-fetches (and shows the skeleton again, never stale data under the
  // new filter's label) whenever any filter changes.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, period, audience]);

  const fetchStats = async (userId) => {
    const cacheKey = `${userId}:${period}`;
    setStatsById((current) => ({ ...current, [cacheKey]: { loading: true, error: "", data: null } }));
    try {
      const { data } = await api.get(`/leaderboard/users/${userId}/stats`, { params: { period } });
      setStatsById((current) => ({ ...current, [cacheKey]: { loading: false, error: "", data: data.data } }));
    } catch (statsError) {
      setStatsById((current) => ({
        ...current,
        [cacheKey]: {
          loading: false,
          error: statsError.response?.data?.error?.message || "Couldn't load this user's stats.",
          data: null,
        },
      }));
    }
  };

  const toggleRow = (userId) => {
    setExpandedId((current) => (current === userId ? null : userId));
    const cacheKey = `${userId}:${period}`;
    if (!statsById[cacheKey]) fetchStats(userId);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Leaderboard</h1>
          <p className="text-sm text-muted">Top learners ranked by points.</p>
        </div>
        {summary && (
          <div className="rounded-xl border border-line bg-panel px-4 py-2.5 text-right">
            <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">{summary.participantLabel}</p>
            <p className="text-lg font-bold tabular-nums text-ink">{summary.totalParticipants.toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SegmentedControl ariaLabel="Category" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
        <SegmentedControl ariaLabel="Time period" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        <SegmentedControl ariaLabel="Audience" options={AUDIENCE_OPTIONS} value={audience} onChange={setAudience} />
      </div>

      {loading && (
        <>
          <PodiumSkeleton />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <LeaderboardRowSkeleton key={index} />
            ))}
          </div>
        </>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm font-medium text-danger">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>
            Try Again
          </Button>
        </div>
      )}

      {!loading && !error && summary && (
        <>
          {summary.me && !summary.me.inTop20 && <YourRankCard me={summary.me} />}

          {summary.top20.length ? (
            <>
              <LeaderboardPodium top3={summary.top3} />
              <div className="flex flex-col gap-2">
                {summary.top20.map((row) => (
                  <LeaderboardRow
                    key={row.id}
                    row={row}
                    isMe={summary.me?.id === row.id}
                    expanded={expandedId === row.id}
                    onToggle={() => toggleRow(row.id)}
                    stats={statsById[`${row.id}:${period}`]}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-sm text-muted">
                {audience === "friends"
                  ? "None of your friends have completed a quiz yet."
                  : "No one has completed a quiz yet — be the first!"}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

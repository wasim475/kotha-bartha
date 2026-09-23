import { useEffect, useState } from "react";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { api } from "../../../utility/api";
import LeaderboardRow from "./LeaderboardRow";

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

function YourRankCard({ me }) {
  return (
    <Card className="mb-4 flex items-center gap-3 border-accent/40 bg-accent/5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold tabular-nums text-accent">
        #{me.rank}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-wide text-accent uppercase">Your Rank</p>
        <p className="truncate text-sm font-bold text-ink">{me.points.toLocaleString()} points</p>
      </div>
    </Card>
  );
}

/**
 * The Study section's Leaderboard tab. Ranking, admin/moderator exclusion,
 * and the total-participants count are all computed server-side
 * (server/src/routes/leaderboard.routes.js) — this component only
 * renders what it's given and lazily fetches each row's detailed stats
 * the moment it's expanded (cached per user id for the rest of this page
 * visit so re-expanding the same row never refetches).
 */
export default function Leaderboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [statsById, setStatsById] = useState({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/leaderboard/top");
      setSummary(data.data);
    } catch (loadError) {
      setError(loadError.response?.data?.error?.message || "Couldn't load the leaderboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const fetchStats = async (userId) => {
    setStatsById((current) => ({ ...current, [userId]: { loading: true, error: "", data: null } }));
    try {
      const { data } = await api.get(`/leaderboard/users/${userId}/stats`);
      setStatsById((current) => ({ ...current, [userId]: { loading: false, error: "", data: data.data } }));
    } catch (statsError) {
      setStatsById((current) => ({
        ...current,
        [userId]: {
          loading: false,
          error: statsError.response?.data?.error?.message || "Couldn't load this user's stats.",
          data: null,
        },
      }));
    }
  };

  const toggleRow = (userId) => {
    setExpandedId((current) => (current === userId ? null : userId));
    if (!statsById[userId]) fetchStats(userId);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Leaderboard</h1>
          <p className="text-sm text-muted">Top learners ranked by quiz points.</p>
        </div>
        {summary && (
          <div className="rounded-xl border border-line bg-panel px-4 py-2.5 text-right">
            <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">Total Participants</p>
            <p className="text-lg font-bold tabular-nums text-ink">{summary.totalParticipants.toLocaleString()}</p>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <LeaderboardRowSkeleton key={index} />
          ))}
        </div>
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

          {summary.top.length ? (
            <div className="flex flex-col gap-2">
              {summary.top.map((row) => (
                <LeaderboardRow
                  key={row.id}
                  row={row}
                  isMe={summary.me?.id === row.id}
                  expanded={expandedId === row.id}
                  onToggle={() => toggleRow(row.id)}
                  stats={statsById[row.id]}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-sm text-muted">No one has completed a quiz yet — be the first!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

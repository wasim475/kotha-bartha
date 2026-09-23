import { ArrowBack } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { api } from "../../../utility/api";
import LeaderboardPodium from "./LeaderboardPodium";
import LeaderboardRow from "./LeaderboardRow";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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

function YourHistoricalRankCard({ me }) {
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
 * Read-only historical Leaderboard viewer. Reuses the exact same podium/row
 * components as the live Leaderboard for visual consistency, but every
 * number on this page comes straight from the immutable archive snapshot
 * (server/src/models/LeaderboardArchive.js) — never recalculated from
 * current user data — so a row's expanded stats are already fully present
 * in the fetched archive and need no separate per-row request (unlike the
 * live page's lazy per-row fetch, which exists only because live stats
 * require their own query).
 */
export default function PreviousLeaderboards() {
  const now = new Date();
  const [month, setMonth] = useState(null);
  const [year, setYear] = useState(null);
  const [availableMonths, setAvailableMonths] = useState(null);
  const [monthsError, setMonthsError] = useState("");

  const [archive, setArchive] = useState(null); // { data, meta } from the API
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  // Only the {year, month} pairs that actually have an archive — cheap,
  // fetched once, used to pick a sensible default selection and to build
  // the year dropdown's range without guessing.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/leaderboard/archive/months");
        setAvailableMonths(data.data);
        if (data.data.length) {
          setYear(data.data[0].year);
          setMonth(data.data[0].month);
        }
      } catch (loadError) {
        setMonthsError(loadError.response?.data?.error?.message || "Couldn't load available months.");
      }
    })();
  }, []);

  const loadArchive = async () => {
    if (!year || !month) return;
    setLoading(true);
    setError("");
    setExpandedId(null);
    try {
      const { data } = await api.get(`/leaderboard/archive/${year}/${month}`);
      setArchive(data);
    } catch (loadError) {
      setError(loadError.response?.data?.error?.message || "Couldn't load that leaderboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Deferred into a callback (rather than calling loadArchive directly
    // in the effect body) purely so its state updates happen from a
    // callback, not synchronously during the effect.
    const timeoutId = setTimeout(() => loadArchive(), 0);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const years = availableMonths?.length
    ? Array.from(new Set(availableMonths.map((entry) => entry.year))).sort((a, b) => b - a)
    : [now.getFullYear()];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link to="/study/leaderboard" className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
        <ArrowBack style={{ fontSize: 15 }} /> Back to Leaderboard
      </Link>

      <div className="mb-5">
        <h1 className="font-display text-xl font-bold text-ink">Previous Leaderboards</h1>
        <p className="text-sm text-muted">Browse finalized monthly rankings — read-only.</p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          Month
          <select
            value={month || ""}
            disabled={!availableMonths?.length}
            onChange={(event) => setMonth(Number(event.target.value))}
            className="rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          Year
          <select
            value={year || ""}
            disabled={!availableMonths?.length}
            onChange={(event) => setYear(Number(event.target.value))}
            className="rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {monthsError && <p className="mb-4 text-xs font-medium text-danger">{monthsError}</p>}

      {availableMonths && availableMonths.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm text-muted">No archived leaderboards yet — check back after the current month closes.</p>
        </div>
      )}

      {availableMonths?.length > 0 && loading && (
        <>
          <PodiumSkeleton />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <LeaderboardRowSkeleton key={index} />
            ))}
          </div>
        </>
      )}

      {availableMonths?.length > 0 && !loading && error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm font-medium text-danger">{error}</p>
          <Button variant="outline" size="sm" onClick={loadArchive}>
            Try Again
          </Button>
        </div>
      )}

      {availableMonths?.length > 0 && !loading && !error && archive && (
        <>
          {!archive.data ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-sm font-medium text-ink">
                {archive.meta?.isCurrentActiveMonth
                  ? "This month's leaderboard is still active."
                  : `No Leaderboard available for ${archive.meta?.label || "this month"}.`}
              </p>
              {archive.meta?.isCurrentActiveMonth && (
                <Link to="/study/leaderboard" className="text-xs font-semibold text-accent hover:underline">
                  View the current Leaderboard
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span className="font-semibold text-ink">{archive.data.label} Leaderboard (Final)</span>
                <span>{archive.data.totalParticipants.toLocaleString()} total participants</span>
              </div>

              {archive.data.me === null ? (
                <p className="mb-4 rounded-lg border border-line bg-soft px-3 py-2.5 text-xs text-muted">
                  You did not participate in this leaderboard.
                </p>
              ) : (
                !archive.data.me.inTop20 && <YourHistoricalRankCard me={archive.data.me} />
              )}

              {archive.data.top20.length ? (
                <>
                  <LeaderboardPodium top3={archive.data.top3} />
                  <div className="flex flex-col gap-2">
                    {archive.data.top20.map((row) => (
                      <LeaderboardRow
                        key={row.id}
                        row={row}
                        isMe={archive.data.me?.id === row.id}
                        expanded={expandedId === row.id}
                        onToggle={() => setExpandedId((current) => (current === row.id ? null : row.id))}
                        stats={{ loading: false, error: "", data: row }}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-16 text-center">
                  <p className="text-sm text-muted">No one completed a quiz that month.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

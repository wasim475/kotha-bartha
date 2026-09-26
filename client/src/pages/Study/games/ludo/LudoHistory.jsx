import { ArrowBackRounded, ExpandMoreRounded } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Avatar from "../../../../components/ui/Avatar";
import Card from "../../../../components/ui/Card";
import { api } from "../../../../utility/api";
import { formatTime, ResourceState, useResource } from "../../../../utility/helpers";
import { apiErrorMessage, LUDO_HOME } from "../../../../utility/ludo";
import FixedButton from "../components/FixedButton";

const ordinal = (n) => ["", "1st", "2nd", "3rd", "4th"][n] || `${n}th`;
const RESULT = { WIN: "Won", LOSS: "Lost", FINISHED: "Finished", FORFEIT: "Left the match", DRAW: "Draw" };
const duration = (seconds) => (typeof seconds === "number" ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "—");

function Summary({ id }) {
  const detail = useResource(`/games/ludo/${id}`);
  return (
    <div className="mt-2 border-t border-line pt-2" data-testid="ludo-summary">
      <ResourceState loading={detail.loading} error={detail.error}>
        <ul className="flex flex-col gap-1.5">
          {(detail.data?.results || []).map((row) => (
            <li key={row.seat} className="flex items-center gap-2 text-xs">
              <span className="w-8 shrink-0 font-bold text-ink">{ordinal(row.rank)}</span>
              <Avatar person={row.user} size="xs" />
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{row.user.fullName}</span>
              <span className="shrink-0 text-muted">
                {row.captures} ✕ · {row.tokensHome}/4 home{row.rewardPoints ? ` · +${row.rewardPoints} pts` : ""}
              </span>
            </li>
          ))}
        </ul>
      </ResourceState>
    </div>
  );
}

function MatchCard({ match }) {
  const [open, setOpen] = useState(false);
  const opponents = match.opponents.map((person) => person.fullName).join(", ");
  return (
    <Card className="p-3" data-testid="ludo-history-item">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-3 text-left">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl text-sm font-black"
          style={{ background: match.won ? "color-mix(in srgb, #22a55b 20%, var(--panel))" : "var(--soft)", color: match.won ? "#1f8f4d" : "var(--muted)" }}
          aria-label={match.won ? "Won" : "Not won"}
        >
          {match.result === "DRAW" ? "=" : ordinal(match.rank)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold text-ink">
            {match.variantTitle} · {RESULT[match.result] || match.result}
          </span>
          <span className="truncate text-xs text-muted">
            vs {opponents || "—"} · {formatTime(match.finishedAt)}
          </span>
          <span className="truncate text-[11px] text-muted">
            {duration(match.durationSec)} · {match.captures} captured · {match.tokensHome}/4 home
            {match.rewardPoints ? ` · +${match.rewardPoints} pts` : ""}
            {match.rewardXp ? ` · +${match.rewardXp} XP` : ""}
          </span>
        </span>
        <ExpandMoreRounded className="shrink-0 text-muted" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
      </button>
      {open && <Summary id={match.id} />}
    </Card>
  );
}

/** Match history. Route: /study/games/ludo/history */
export default function LudoHistory() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const first = useResource("/games/ludo/history?page=1");

  const data = first.data;
  const shown = [...(data?.items || []), ...items];
  const hasMore = data ? page < data.totalPages : false;

  const more = async () => {
    setLoadingMore(true);
    setError("");
    try {
      const { data: next } = await api.get(`/games/ludo/history?page=${page + 1}`);
      setItems((current) => [...current, ...next.data.items]);
      setPage(page + 1);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Couldn't load more."));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="games-scope ludo-scope mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-4" data-tone="math">
      <button
        type="button"
        onClick={() => navigate(LUDO_HOME)}
        className="inline-flex min-h-11 w-fit items-center gap-1 rounded-md py-1 pr-2 text-xs font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ArrowBackRounded style={{ fontSize: 16 }} /> Ludo
      </button>
      <h1 className="font-display text-2xl font-semibold text-ink">Match history</h1>
      <ResourceState loading={first.loading} error={first.error} empty={data && !shown.length ? "No finished online matches yet. Play one with a friend!" : ""}>
        <div className="flex flex-col gap-2.5" data-testid="ludo-history">
          {shown.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
        {hasMore && (
          <FixedButton variant="outline" size="md" className="min-h-11" loading={loadingMore} onClick={more}>
            Load more
          </FixedButton>
        )}
        {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}
      </ResourceState>
    </div>
  );
}

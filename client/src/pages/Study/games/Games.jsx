import { ChevronRight, ManageAccounts } from "@mui/icons-material";
import { motion as Motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ResourceState, formatTime, useResource } from "../../../utility/helpers";
import CategoryTabs from "./components/CategoryTabs";
import FixedButton from "./components/FixedButton";
import GameCard from "./components/GameCard";
import { toneFor } from "./utility/gameTypes";

/**
 * "Your last game" entry — opens the mistake review for the most recent
 * COMPLETED game. Stays put while a new game is being played and only changes
 * once another game is completed. Renders nothing if there is no such game
 * (or the lookup fails — it's a convenience, never a blocker).
 */
function LastGameCard({ last, onOpen }) {
  const mistakes = last.mistakeCount;
  return (
    <button type="button" className="game-last" data-tone={toneFor(last.category)} onClick={onOpen}>
      <span className="game-tile" aria-hidden="true">
        {last.icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="text-[11px] font-bold tracking-wide text-muted uppercase">Your last game</span>
        <span className="truncate font-display text-base leading-tight font-semibold text-ink">
          {last.gameName} · {last.score} / {last.totalQuestions}
        </span>
        <span className="truncate text-xs text-muted">
          {mistakes > 0 ? `Review ${mistakes} mistake${mistakes === 1 ? "" : "s"}` : "Perfect game — view result"}
          {last.completedAt ? ` · ${formatTime(last.completedAt)}` : ""}
        </span>
      </span>
      <ChevronRight className="shrink-0 text-muted" />
    </button>
  );
}

/**
 * Games landing page: every game from the server's catalog, grouped by
 * category. Route: /study/games
 */
export default function Games({ canManage = false }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const catalog = useResource("/games");
  const last = useResource("/games/last");

  const categories = catalog.meta?.categories || [];
  const games = catalog.data || [];
  // Games whose category the server didn't list still show, under their key.
  const knownKeys = new Set(categories.map((category) => category.key));
  const orphanKeys = [...new Set(games.map((game) => game.category))].filter((key) => !knownKeys.has(key));
  const sections = [
    ...categories,
    ...orphanKeys.map((key) => ({ key, label: key, icon: "🎮" })),
  ]
    .map((category) => ({ ...category, games: games.filter((game) => game.category === category.key) }))
    .filter((section) => section.games.length);

  // Math is selected whenever the page is opened without an explicit category
  // (an unknown category falls back to it too); only ONE category's games show.
  const requested = searchParams.get("category");
  const activeSection =
    sections.find((section) => section.key === requested) ||
    sections.find((section) => section.key === "math") ||
    sections[0];
  const selectCategory = (key) => setSearchParams(key === "math" ? {} : { category: key }, { replace: true });

  return (
    <div className="games-scope flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
          <h1 className="font-display text-3xl font-semibold text-ink">Games</h1>
          <p className="text-sm text-muted">Learn while you play — ten quick questions per game.</p>
        </div>
        {canManage && (
          <FixedButton variant="outline" size="sm" className="shrink-0" onClick={() => navigate("/study/games/manage")}>
            <ManageAccounts fontSize="small" /> English Questions
          </FixedButton>
        )}
      </header>

      {last.data && (
        <LastGameCard last={last.data} onOpen={() => navigate(`/study/games/review/${last.data.attemptId}`)} />
      )}

      <ResourceState
        loading={catalog.loading}
        error={catalog.error}
        empty={!games.length ? "No games are available yet." : ""}
      >
        {activeSection && (
          <div className="flex flex-col gap-3.5">
            <CategoryTabs categories={sections} activeKey={activeSection.key} onSelect={selectCategory} />
            <Motion.div
              key={activeSection.key}
              id="game-tabpanel"
              role="tabpanel"
              aria-labelledby={`game-tab-${activeSection.key}`}
              data-tone={toneFor(activeSection.key)}
              className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {activeSection.games.map((game) => (
                <GameCard key={game.type} game={game} onPlay={() => navigate(game.route || `/study/games/play/${game.type}`)} />
              ))}
            </Motion.div>
          </div>
        )}
      </ResourceState>
    </div>
  );
}

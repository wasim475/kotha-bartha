import { useNavigate } from "react-router-dom";

import { ResourceState, useResource } from "../../../utility/helpers";
import GameCard from "./components/GameCard";
import { toneFor } from "./utility/gameTypes";

/**
 * Games landing page: every game from the server's catalog, grouped by
 * category. Route: /study/games
 */
export default function Games() {
  const navigate = useNavigate();
  const catalog = useResource("/games");

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

  return (
    <div className="games-scope flex min-w-0 flex-col gap-7">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-semibold text-ink">Games</h1>
        <p className="text-sm text-muted">Learn while you play — ten quick questions per game.</p>
      </header>

      <ResourceState
        loading={catalog.loading}
        error={catalog.error}
        empty={!games.length ? "No games are available yet." : ""}
      >
        {sections.map((section) => (
          <section key={section.key} data-tone={toneFor(section.key)} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-ink uppercase">
              <span aria-hidden="true">{section.icon}</span>
              {section.label}
            </h2>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {section.games.map((game) => (
                <GameCard key={game.type} game={game} onPlay={() => navigate(`/study/games/play/${game.type}`)} />
              ))}
            </div>
          </section>
        ))}
      </ResourceState>
    </div>
  );
}

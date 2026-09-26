import { ArrowBackRounded, ChevronRight, HistoryRounded, PeopleAltRounded, PhoneIphoneRounded } from "@mui/icons-material";
import { motion as Motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Card from "../../../../components/ui/Card";
import { getVariant } from "../../../../games/ludo/variants.js";
import { ResourceState, useRealtime, useResource } from "../../../../utility/helpers";
import { apiErrorMessage, createLobby, LUDO_HISTORY_PATH, LUDO_LOCAL_PATH, ludoLobbyPath, ludoPlayPath } from "../../../../utility/ludo";
import { ludoSfx } from "../../../../utility/ludoSound";
import FixedButton from "../components/FixedButton";
import SettingsMenu from "./components/SettingsMenu";
import { hasSavedLocalGame } from "./hooks/useLocalLudo";

const maxPoints = (variant) => Math.max(0, ...Object.values(variant.rewards?.points || {}).map((list) => list[0] || 0));

function Stat({ label, value, hint }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-soft/50 px-3 py-2">
      <p className="truncate text-[11px] font-bold tracking-wide text-muted uppercase">{label}</p>
      <p className="font-display text-xl font-semibold text-ink tabular-nums" data-testid={`ludo-stat-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
        {value}
      </p>
      {hint && <p className="truncate text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function StatsCard({ stats }) {
  const s = stats.data;
  return (
    <Card className="flex flex-col gap-3" data-testid="ludo-stats">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold tracking-wide text-muted uppercase">Your Ludo record</h2>
        {s && <span className="ludo-chip">Level {s.level} · {s.xp} XP</span>}
      </div>
      <ResourceState loading={stats.loading} error={stats.error}>
        {s && (
          <>
            <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
              <Stat label="Games played" value={s.played} />
              <Stat label="Wins" value={s.wins} />
              <Stat label="Losses" value={s.losses} />
              <Stat label="Draws" value={s.draws} />
              <Stat label="Win rate" value={`${s.winRate}%`} />
              <Stat label="Captures" value={s.totalCaptures} />
              <Stat label="Best streak" value={s.bestStreak} />
              <Stat label="Tokens home" value={s.tokensHome} />
              <Stat label="Points earned" value={s.points} />
            </div>
            <div className="grid grid-cols-4 gap-2" aria-label="Finishing places in ranked games">
              {[["1st", s.placements.first], ["2nd", s.placements.second], ["3rd", s.placements.third], ["4th", s.placements.fourth]].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-line bg-soft/50 px-2 py-1.5 text-center" data-testid={`ludo-place-${label}`}>
                  <p className="text-[11px] font-bold text-muted">{label}</p>
                  <p className="font-display text-lg font-semibold text-ink tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </ResourceState>
    </Card>
  );
}

function ModeCard({ variant, selected, onSelect }) {
  return (
    <button type="button" className="ludo-mode" data-selected={selected ? "true" : "false"} onClick={() => onSelect(variant.id)} aria-pressed={selected} data-testid={`ludo-mode-${variant.id}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="font-display text-base font-semibold text-ink">{variant.title}</span>
        <span className="ludo-chip">
          <PeopleAltRounded style={{ fontSize: 13 }} /> {variant.minPlayers}–{variant.maxPlayers}
        </span>
      </span>
      <span className="text-xs leading-snug text-muted">{variant.description}</span>
      <span className="flex flex-wrap gap-1.5">
        {variant.rankingEnabled && <span className="ludo-chip">Ranked 1st–4th</span>}
        {variant.timer && <span className="ludo-chip">{Math.round(variant.timer.turnMs / 1000)}s turns</span>}
        {variant.leaderboardEnabled && <span className="ludo-chip">Up to +{maxPoints(variant)} pts</span>}
      </span>
    </button>
  );
}

/**
 * Ludo home. Route: /study/games/ludo
 * Pick an online mode (played with online friends) or Local Ludo on this device.
 */
export default function LudoHome() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const catalog = useResource("/games/ludo/variants");
  const active = useResource("/games/ludo/active");
  const stats = useResource("/games/ludo/stats");
  const [selectedId, setSelectedId] = useState("QUICK_CAPTURE");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useRealtime("ludo:lobby:closed", active.reload);
  useRealtime("ludo:started", active.reload);
  useRealtime("ludo:finished", () => {
    active.reload();
    stats.reload();
  });

  const variants = catalog.data?.variants?.filter((variant) => variant.online) || [];
  const selected = variants.find((variant) => variant.id === selectedId) || variants[0];
  const localVariant = getVariant("LOCAL_CLASSIC");

  const create = async () => {
    if (!selected || creating) return;
    setCreating(true);
    setError("");
    ludoSfx.click();
    try {
      const game = await createLobby({ variantId: selected.id, minPlayers: selected.minPlayers, maxPlayers: selected.maxPlayers, autoStart: false });
      navigate(ludoLobbyPath(game.id));
    } catch (requestError) {
      const body = requestError.response?.data?.error;
      if (body?.code === "ALREADY_IN_GAME" && body.gameId) {
        navigate(body.status === "active" ? ludoPlayPath(body.gameId) : ludoLobbyPath(body.gameId));
        return;
      }
      setError(apiErrorMessage(requestError, "Couldn't create the lobby."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="games-scope ludo-scope mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4" data-tone="math">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate("/study/games")}
          className="inline-flex min-h-11 items-center gap-1 rounded-md py-1 pr-2 text-xs font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowBackRounded style={{ fontSize: 16 }} /> All games
        </button>
        <SettingsMenu />
      </div>

      <header className="flex items-center gap-3">
        <span className="game-tile" aria-hidden="true">
          🎲
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight font-semibold text-ink">Ludo</h1>
          <p className="text-xs text-muted">Real-time with online friends, or pass the device around.</p>
        </div>
      </header>

      {(active.data || []).map((game) => (
        <button
          key={game.id}
          type="button"
          className="game-last"
          onClick={() => navigate(game.status === "active" ? ludoPlayPath(game.id) : ludoLobbyPath(game.id))}
          data-testid="ludo-resume"
        >
          <span className="game-tile" aria-hidden="true">🎲</span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
            <span className="text-[11px] font-bold tracking-wide text-muted uppercase">{game.status === "active" ? "Match in progress" : "Lobby open"}</span>
            <span className="truncate font-display text-base leading-tight font-semibold text-ink">{getVariant(game.variantId)?.title || "Ludo"}</span>
            <span className="truncate text-xs text-muted">{game.members.map((member) => member.user.fullName).join(", ")} · Resume</span>
          </span>
          <ChevronRight className="shrink-0 text-muted" />
        </button>
      ))}

      <section className="flex flex-col gap-2" aria-labelledby="ludo-online-heading">
        <h2 id="ludo-online-heading" className="text-xs font-bold tracking-wide text-muted uppercase">Play online with friends</h2>
        <ResourceState loading={catalog.loading} error={catalog.error}>
          {catalog.data && !catalog.data.enabled && <Card className="text-sm text-muted">Online Ludo isn't available right now.</Card>}
          {catalog.data?.enabled && (
            <Motion.div className="grid grid-cols-1 gap-2.5 min-[560px]:grid-cols-3" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              {variants.map((variant) => (
                <ModeCard key={variant.id} variant={variant} selected={selected?.id === variant.id} onSelect={setSelectedId} />
              ))}
            </Motion.div>
          )}
        </ResourceState>

        {selected && (
          <Card className="flex flex-col gap-3" data-testid="ludo-mode-details">
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">{selected.title}</h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted">
                {selected.rulesSummary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <FixedButton variant="primary" size="md" className="min-h-11" loading={creating} onClick={create} data-testid="ludo-create-lobby">
              <PeopleAltRounded fontSize="small" /> Create lobby &amp; invite friends
            </FixedButton>
            {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="ludo-local-heading">
        <h2 id="ludo-local-heading" className="text-xs font-bold tracking-wide text-muted uppercase">Play on this device</h2>
        <button type="button" className="ludo-mode" onClick={() => navigate(LUDO_LOCAL_PATH)} data-testid="ludo-mode-local">
          <span className="flex items-center justify-between gap-2">
            <span className="font-display text-base font-semibold text-ink">{localVariant.title}</span>
            <span className="ludo-chip">
              <PhoneIphoneRounded style={{ fontSize: 13 }} /> 4 players · offline
            </span>
          </span>
          <span className="text-xs leading-snug text-muted">{localVariant.description}</span>
          {hasSavedLocalGame() && <span className="ludo-chip w-fit">Saved game — resume</span>}
        </button>
      </section>

      <StatsCard stats={stats} />

      <FixedButton variant="outline" size="md" className="min-h-11" onClick={() => navigate(LUDO_HISTORY_PATH)} data-testid="ludo-history-link">
        <HistoryRounded fontSize="small" /> Match history
      </FixedButton>
    </div>
  );
}

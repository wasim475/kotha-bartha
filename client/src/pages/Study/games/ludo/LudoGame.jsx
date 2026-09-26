import { ArrowBackRounded, ErrorOutlined, SyncRounded, WifiOffRounded } from "@mui/icons-material";
import { useEffect, useMemo, useState } from "react";
import { getVariant } from "../../../../games/ludo/variants.js";
import { useNavigate, useParams } from "react-router-dom";

import Card from "../../../../components/ui/Card";
import ConfirmDialog from "../../../../components/ui/ConfirmDialog";
import { api } from "../../../../utility/api";
import { apiErrorMessage, LUDO_HISTORY_PATH, LUDO_HOME, ludoLobbyPath, ludoPlayPath } from "../../../../utility/ludo";
import { startMusic, stopMusic, useLudoSettings } from "../../../../utility/ludoSound";
import FixedButton from "../components/FixedButton";
import ChatPanel, { EmoteLayer } from "./components/ChatPanel";
import Countdown from "./components/Countdown";
import LudoTable from "./components/LudoTable";
import ResultOverlay from "./components/ResultOverlay";
import SettingsMenu from "./components/SettingsMenu";
import useLudoDirector from "./hooks/useLudoDirector";
import useServerClock from "./hooks/useServerClock";
import useLudoOnline from "./hooks/useLudoOnline";

function LoadingBoard() {
  return (
    <div className="ludo-scope mx-auto w-full max-w-md" aria-busy="true" aria-label="Loading the game" data-testid="ludo-loading">
      <div className="ludo-board-wrap">
        <div className="ludo-board animate-pulse motion-reduce:animate-none" />
      </div>
      <p className="mt-3 text-center text-sm text-muted">Syncing game…</p>
    </div>
  );
}

/**
 * The live online match. Route: /study/games/ludo/play/:gameId
 * Every rule is the server's; this shows its state and sends the player's
 * intentions (roll / tap a token).
 */
export default function LudoGame({ user }) {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const director = useLudoDirector();
  const online = useLudoOnline(gameId, director);
  const settings = useLudoSettings();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [rematchError, setRematchError] = useState("");
  const { view } = online;
  const state = view?.game;

  // A lobby that hasn't started yet belongs on the lobby screen.
  useEffect(() => {
    if (view && !state && view.status === "lobby") navigate(ludoLobbyPath(gameId), { replace: true });
    if (view && !state && view.status === "cancelled") navigate(LUDO_HOME, { replace: true });
  }, [view, state, gameId, navigate]);

  useEffect(() => {
    if (state && state.phase !== "FINISHED" && settings.music) startMusic();
    return () => stopMusic();
  }, [state?.phase, settings.music]); // eslint-disable-line react-hooks/exhaustive-deps

  const mySeat = view?.mySeat ?? state?.players.find((player) => player.user?.id === user.id)?.seat ?? null;
  const rotation = mySeat === null ? 0 : (3 - mySeat + 4) % 4;
  const nameOf = useMemo(() => (userId) => state?.players.find((player) => player.user?.id === userId)?.user?.fullName || "Player", [state]);

  const finished = view?.status === "finished";
  const showResult = finished && state && !director.busy;
  const rows = useMemo(
    () => (view?.results || []).map((row) => ({ ...row, name: row.user?.fullName || "Player" })),
    [view?.results],
  );
  const live = state && state.phase !== "FINISHED";
  const startsAt = state?.startsAt;
  const clock = useServerClock(Boolean(live));
  const counting = Boolean(live && startsAt && startsAt + 700 > clock + online.offsetMs);

  const exit = () => navigate(LUDO_HOME);

  const confirmAndLeave = async () => {
    setLeaving(true);
    const left = await online.leave();
    setLeaving(false);
    setConfirmLeave(false);
    if (left) exit();
  };

  // "Play Again": accept a rematch someone already asked for, or ask for one.
  const playAgain = async () => {
    setRematchBusy(true);
    setRematchError("");
    try {
      const existing = view?.rematch;
      if (existing?.invite?.status === "pending") {
        const { data } = await api.post(`/games/ludo/invites/${existing.invite.id}/accept`);
        const game = data.data.game;
        navigate(game.status === "active" ? ludoPlayPath(game.id) : ludoLobbyPath(game.id));
        return;
      }
      if (existing?.gameId && (existing.status === "lobby" || existing.status === "active")) {
        navigate(existing.status === "active" ? ludoPlayPath(existing.gameId) : ludoLobbyPath(existing.gameId));
        return;
      }
      const game = await online.requestRematch();
      navigate(game.status === "active" ? ludoPlayPath(game.id) : ludoLobbyPath(game.id));
    } catch (error) {
      setRematchError(apiErrorMessage(error, "Couldn't start a rematch."));
    } finally {
      setRematchBusy(false);
    }
  };

  const rematchNote = (() => {
    const rematch = view?.rematch;
    if (!rematch) return "";
    if (rematch.invite?.status === "pending") return "Your opponent wants to play again — tap Play Again to accept.";
    if (rematch.hostId === user.id && rematch.status === "lobby") return "Rematch requested — waiting for the others to accept.";
    return "";
  })();

  if (online.status.loading && !view) return <LoadingBoard />;

  if (online.status.error && !view) {
    return (
      <div className="games-scope mx-auto flex w-full max-w-md flex-col gap-3" data-tone="math">
        <Card className="flex flex-col items-center gap-3 py-8 text-center" role="alert" data-testid="ludo-error">
          <ErrorOutlined className="text-danger" />
          <p className="text-sm font-semibold text-ink">{online.status.error}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <FixedButton variant="primary" size="md" className="min-h-11" onClick={online.resync}>
              <SyncRounded fontSize="small" /> Retry
            </FixedButton>
            <FixedButton variant="outline" size="md" className="min-h-11" onClick={exit}>
              Exit
            </FixedButton>
          </div>
        </Card>
      </div>
    );
  }

  if (!state) return <LoadingBoard />;

  return (
    <div className="games-scope ludo-scope mx-auto flex w-full min-w-0 flex-col gap-3" data-tone="math">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => (live ? setConfirmLeave(true) : exit())}
          className="inline-flex min-h-11 items-center gap-1 rounded-md py-1 pr-2 text-xs font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          data-testid="ludo-leave"
        >
          <ArrowBackRounded style={{ fontSize: 16 }} /> {live ? "Leave match" : "Ludo"}
        </button>
        <SettingsMenu compact />
      </div>

      {(online.connection !== "connected" || online.syncing) && (
        <Card className="flex flex-wrap items-center gap-2 border-danger/40 p-3 text-sm" role="status" data-testid="ludo-connection">
          <WifiOffRounded className="text-danger" fontSize="small" />
          <span className="min-w-0 flex-1 font-semibold text-ink">{online.syncing ? "Syncing game…" : "Reconnecting…"}</span>
          <FixedButton variant="outline" size="sm" className="min-h-11" onClick={online.resync}>
            Retry
          </FixedButton>
        </Card>
      )}

      {online.takenOver && live && (
        <Card className="flex flex-wrap items-center gap-2 p-3 text-sm" role="status" data-testid="ludo-takeover">
          <span className="min-w-0 flex-1 font-semibold text-ink">This match is open in another tab.</span>
          <FixedButton variant="primary" size="sm" className="min-h-11" onClick={online.takeControl}>
            Take control
          </FixedButton>
        </Card>
      )}

      {online.status.error && (
        <Card className="flex flex-wrap items-center gap-2 p-3 text-sm text-danger" role="alert">
          <span className="min-w-0 flex-1">{online.status.error}</span>
          <FixedButton variant="outline" size="sm" className="min-h-11" onClick={online.resync}>
            Retry
          </FixedButton>
        </Card>
      )}

      <LudoTable
        state={state}
        director={director}
        actingSeat={live && !online.takenOver && online.connection === "connected" ? mySeat : null}
        offsetMs={online.offsetMs}
        pendingRoll={online.pendingRoll}
        pendingKey={online.pendingKey}
        hint={online.hint}
        onRoll={online.roll}
        onPick={online.pick}
        rotation={rotation}
        aside={<ChatPanel chat={online.chat} onSend={online.sendChat} onReact={online.sendReaction} disabled={!live || online.connection !== "connected"} />}
      >
        <EmoteLayer emotes={online.emotes} nameOf={nameOf} />
      </LudoTable>

      {counting && <Countdown startsAt={startsAt} offsetMs={online.offsetMs} />}

      {showResult && (
        <ResultOverlay
          rows={rows}
          mySeat={mySeat}
          reason={view.finishReason}
          durationSec={view.durationSec}
          rankingEnabled={Boolean(getVariant(state.variantId)?.rankingEnabled)}
          onPlayAgain={playAgain}
          playAgainBusy={rematchBusy}
          onHistory={() => navigate(LUDO_HISTORY_PATH)}
          onExit={exit}
          rematchNote={rematchNote}
          error={rematchError}
        />
      )}

      <ConfirmDialog
        open={confirmLeave}
        title="Leave this match?"
        description="You'll forfeit the match and won't earn any rewards."
        confirmLabel="Leave match"
        variant="danger"
        loading={leaving}
        onConfirm={confirmAndLeave}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}

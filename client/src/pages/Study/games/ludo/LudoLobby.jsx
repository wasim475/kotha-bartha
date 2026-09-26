import { AddRounded, ArrowBackRounded, CheckRounded, PlayArrowRounded, RemoveRounded } from "@mui/icons-material";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Avatar from "../../../../components/ui/Avatar";
import Card from "../../../../components/ui/Card";
import ConfirmDialog from "../../../../components/ui/ConfirmDialog";
import { getVariant, listOnlineVariants } from "../../../../games/ludo/variants.js";
import { api } from "../../../../utility/api";
import { activeSocket, ResourceState, useRealtime, useResource } from "../../../../utility/helpers";
import { apiErrorMessage, inviteToLobby, LUDO_HOME, ludoPlayPath } from "../../../../utility/ludo";
import { ludoSfx } from "../../../../utility/ludoSound";
import FixedButton from "../components/FixedButton";
import SettingsMenu from "./components/SettingsMenu";
import useLudoFriends from "./hooks/useLudoFriends";

function Stepper({ label, value, min, max, onChange, disabled, testId }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="inline-flex items-center gap-1.5">
        <button type="button" aria-label={`Decrease ${label}`} disabled={disabled || value <= min} onClick={() => onChange(value - 1)} className="grid size-11 place-items-center rounded-xl border border-line bg-panel text-ink disabled:opacity-40" style={{ borderWidth: 1, borderStyle: "solid", borderColor: "var(--line)", background: "var(--panel)" }}>
          <RemoveRounded fontSize="small" />
        </button>
        <span className="w-6 text-center text-base font-bold text-ink tabular-nums" data-testid={testId}>{value}</span>
        <button type="button" aria-label={`Increase ${label}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)} className="grid size-11 place-items-center rounded-xl border border-line bg-panel text-ink disabled:opacity-40" style={{ borderWidth: 1, borderStyle: "solid", borderColor: "var(--line)", background: "var(--panel)" }}>
          <AddRounded fontSize="small" />
        </button>
      </span>
    </div>
  );
}

function PlayerRow({ member, isHost, isMe, card }) {
  const reduced = useReducedMotion();
  return (
    <Motion.li
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, x: -16, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: 16 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="flex items-center gap-3 rounded-xl border border-line bg-panel p-2.5"
      data-testid="ludo-member"
    >
      <span className="relative shrink-0">
        <Avatar person={member.user} size="md" />
        <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-panel" style={{ background: member.online ? "#22a55b" : "var(--muted)" }} title={member.online ? "Online" : "Offline"} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">
          {member.user.fullName}
          {isMe && <span className="ml-1 text-[11px] font-semibold text-muted">(you)</span>}
        </p>
        <p className="truncate text-[11px] text-muted">
          {card ? `Level ${card.level} · ${card.wins} wins · ${card.winRate}% win rate` : "New player"}
        </p>
      </div>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {isHost && <span className="ludo-chip">Host</span>}
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: member.ready ? "#1f8f4d" : "var(--muted)" }}>
          <span className="ludo-ready-dot" data-on={member.ready ? "true" : "false"} />
          {member.ready ? (
            <>
              <CheckRounded style={{ fontSize: 13 }} /> Ready
            </>
          ) : (
            "Not ready"
          )}
        </span>
      </span>
    </Motion.li>
  );
}

function FriendRow({ friend, outgoing, busy, onInvite, onCancel, disabled }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-panel p-2.5" data-testid="ludo-friend">
      <Avatar person={friend} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{friend.fullName}</p>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <span className="size-2 shrink-0 rounded-full bg-green-500" aria-hidden="true" /> {outgoing ? "Invitation sent — waiting…" : "Online"}
        </p>
      </div>
      {outgoing ? (
        <FixedButton variant="outline" size="sm" className="min-h-11 shrink-0" loading={busy} onClick={() => onCancel(outgoing)}>
          Cancel
        </FixedButton>
      ) : (
        <FixedButton variant="primary" size="sm" className="min-h-11 shrink-0" loading={busy} disabled={disabled} onClick={() => onInvite(friend)} data-testid="ludo-invite">
          <PlayArrowRounded fontSize="small" /> Invite
        </FixedButton>
      )}
    </li>
  );
}

/**
 * The Ludo lobby. Route: /study/games/ludo/lobby/:gameId
 * Players, ready states, online friends to invite, and the host's start controls.
 * Everything is the server's; a lobby update arrives over the socket, so nothing
 * needs a refresh.
 */
export default function LudoLobby({ user }) {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const lobby = useResource(`/games/ludo/${gameId}`);
  const friends = useLudoFriends();
  const pending = useResource("/games/ludo/invites/pending");
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [matchFound, setMatchFound] = useState(false);

  const game = lobby.data;
  const variant = game ? getVariant(game.variantId) : null;
  const isHost = game?.hostId === user.id;
  const me = game?.members.find((member) => member.user.id === user.id);

  // Live updates: a new roster, the game starting, the lobby closing.
  useEffect(() => {
    activeSocket?.emit("ludo:join", { gameId }, () => {});
  }, [gameId]);
  useRealtime("realtime:connected", () => activeSocket?.emit("ludo:join", { gameId }, () => {}));
  useRealtime("ludo:lobby", (event) => {
    if (event.detail?.gameId === gameId) lobby.setData(event.detail.game);
  });
  useRealtime("ludo:started", (event) => {
    if (event.detail?.gameId !== gameId) return;
    lobby.setData(event.detail.game);
    ludoSfx.matchFound();
    setMatchFound(true);
    setTimeout(() => navigate(ludoPlayPath(gameId), { replace: true }), reduced ? 250 : 1100);
  });
  useRealtime("ludo:lobby:closed", (event) => {
    if (event.detail?.gameId !== gameId) return;
    navigate(LUDO_HOME, { replace: true });
  });
  const refreshInvites = () => pending.reload();
  useRealtime("ludo:invite:accepted", refreshInvites);
  useRealtime("ludo:invite:declined", (event) => {
    refreshInvites();
    if (event.detail?.gameId === gameId) setNotice("Your invitation was declined.");
  });
  useRealtime("ludo:invite:cancelled", refreshInvites);
  useRealtime("ludo:invite:expired", refreshInvites);

  // Already started (we arrived late / refreshed): go straight to the match.
  useEffect(() => {
    if ((game?.status === "active" || game?.status === "finished") && !matchFound) navigate(ludoPlayPath(gameId), { replace: true });
    if (game?.status === "cancelled") navigate(LUDO_HOME, { replace: true });
  }, [game?.status, gameId, matchFound, navigate]);

  const outgoing = useMemo(() => (pending.data?.outgoing || []).filter((invite) => invite.gameId === gameId), [pending.data, gameId]);
  const outgoingFor = (friendId) => outgoing.find((invite) => invite.to.id === friendId);
  const memberIds = new Set((game?.members || []).map((member) => member.user.id));
  const invitable = (friends.data || []).filter((friend) => !memberIds.has(friend.id));

  const seatsLeft = game ? game.settings.maxPlayers - game.members.length - outgoing.length : 0;

  const invite = async (friend) => {
    setBusyId(friend.id);
    setNotice("");
    const result = await inviteToLobby(gameId, friend);
    if (result.ok) {
      ludoSfx.click();
      pending.reload();
    } else {
      setNotice(result.message);
      friends.reload();
    }
    setBusyId(null);
  };

  const cancelInvite = async (invitation) => {
    setBusyId(invitation.to.id);
    try {
      await api.post(`/games/ludo/invites/${invitation.id}/cancel`);
    } catch {
      /* already answered */
    }
    pending.reload();
    setBusyId(null);
  };

  const changeSettings = async (patch) => {
    setSaving(true);
    setNotice("");
    try {
      const { data } = await api.patch(`/games/ludo/${gameId}/settings`, patch);
      lobby.setData(data.data.game);
    } catch (error) {
      setNotice(apiErrorMessage(error, "Couldn't change the settings."));
    } finally {
      setSaving(false);
    }
  };

  const toggleReady = async () => {
    ludoSfx.click();
    try {
      const { data } = await api.post(`/games/ludo/${gameId}/ready`, { ready: !me?.ready });
      lobby.setData(data.data.game);
    } catch (error) {
      setNotice(apiErrorMessage(error, "Couldn't change your ready state."));
    }
  };

  const start = async () => {
    setStarting(true);
    setNotice("");
    try {
      await api.post(`/games/ludo/${gameId}/start`);
    } catch (error) {
      setNotice(apiErrorMessage(error, "Couldn't start the game."));
    } finally {
      setStarting(false);
    }
  };

  const leave = async () => {
    try {
      await api.post(`/games/ludo/${gameId}/leave`);
    } catch {
      /* already closed */
    }
    navigate(LUDO_HOME);
  };

  const readyToStart = game && game.members.length >= game.settings.minPlayers && game.members.every((member) => member.ready || member.user.id === game.hostId);
  const startBlock = !game
    ? ""
    : game.members.length < game.settings.minPlayers
      ? `Waiting for ${game.settings.minPlayers - game.members.length} more player${game.settings.minPlayers - game.members.length === 1 ? "" : "s"}…`
      : !readyToStart
        ? "Waiting for everyone to be ready…"
        : "";

  return (
    <div className="games-scope ludo-scope mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4" data-tone="math">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setConfirmLeave(true)}
          className="inline-flex min-h-11 items-center gap-1 rounded-md py-1 pr-2 text-xs font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          data-testid="ludo-lobby-leave"
        >
          <ArrowBackRounded style={{ fontSize: 16 }} /> Leave lobby
        </button>
        <SettingsMenu compact />
      </div>

      <ResourceState loading={lobby.loading} error={lobby.error}>
        {game && variant && (
          <>
            <header className="flex items-center gap-3">
              <span className="game-tile" aria-hidden="true">🎲</span>
              <div className="min-w-0">
                <h1 className="font-display text-2xl leading-tight font-semibold text-ink" data-testid="ludo-lobby-title">{variant.title}</h1>
                <p className="text-xs text-muted">{game.settings.minPlayers === game.settings.maxPlayers ? `${game.settings.maxPlayers} players` : `${game.settings.minPlayers}–${game.settings.maxPlayers} players`} · {game.members.length} joined</p>
              </div>
            </header>

            <Card className="flex flex-col gap-1.5">
              <p className="text-xs leading-snug text-muted">{variant.description}</p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">
                {variant.rulesSummary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Card>

            <section className="flex flex-col gap-2" aria-labelledby="ludo-players-heading">
              <h2 id="ludo-players-heading" className="text-xs font-bold tracking-wide text-muted uppercase">Players</h2>
              <ul className="flex flex-col gap-2" data-testid="ludo-members">
                <AnimatePresence initial={false}>
                  {game.members.map((member) => (
                    <PlayerRow key={member.user.id} member={member} isHost={member.user.id === game.hostId} isMe={member.user.id === user.id} card={game.cards?.[member.user.id]} />
                  ))}
                </AnimatePresence>
              </ul>
            </section>

            {isHost ? (
              <Card className="flex flex-col gap-3" data-testid="ludo-settings-card">
                <h2 className="text-xs font-bold tracking-wide text-muted uppercase">Game settings</h2>
                {!game.rematchOf && (
                  <div role="radiogroup" aria-label="Game mode" className="flex flex-wrap gap-2" data-testid="ludo-mode-picker">
                    {listOnlineVariants().map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={option.id === game.variantId}
                        disabled={saving || option.id === game.variantId}
                        onClick={() => changeSettings({ variantId: option.id })}
                        className="min-h-11 rounded-xl border px-3 text-xs font-bold"
                        style={{ borderWidth: 1.5, borderStyle: "solid", borderColor: option.id === game.variantId ? "var(--accent)" : "var(--line)", background: option.id === game.variantId ? "color-mix(in srgb, var(--accent) 12%, var(--panel))" : "var(--panel)", color: "var(--ink)" }}
                        data-testid={`ludo-pick-${option.id}`}
                      >
                        {option.title}
                      </button>
                    ))}
                  </div>
                )}
                <Stepper label="Minimum players" value={game.settings.minPlayers} min={variant.minPlayers} max={Math.min(game.settings.maxPlayers, variant.maxPlayers)} onChange={(value) => changeSettings({ minPlayers: value })} disabled={saving || game.expectedPlayers !== null} testId="ludo-min" />
                <Stepper label="Maximum players" value={game.settings.maxPlayers} min={Math.max(game.settings.minPlayers, game.members.length)} max={variant.maxPlayers} onChange={(value) => changeSettings({ maxPlayers: value })} disabled={saving || game.expectedPlayers !== null} testId="ludo-max" />
                <button
                  type="button"
                  role="switch"
                  aria-checked={game.settings.autoStart}
                  disabled={saving}
                  onClick={() => changeSettings({ autoStart: !game.settings.autoStart })}
                  className="flex min-h-11 items-center gap-3 rounded-lg text-left"
                  data-testid="ludo-autostart"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">Start when the minimum join</span>
                    <span className="block text-[11px] text-muted">The match begins as soon as {game.settings.minPlayers} players have joined.</span>
                  </span>
                  <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: game.settings.autoStart ? "var(--accent)" : "var(--line)" }}>
                    <span className="absolute top-0.5 size-5 rounded-full bg-white shadow transition-all" style={{ left: game.settings.autoStart ? 22 : 2 }} />
                  </span>
                </button>
              </Card>
            ) : (
              <FixedButton variant={me?.ready ? "outline" : "primary"} size="md" className="min-h-11" onClick={toggleReady} data-testid="ludo-ready">
                {me?.ready ? "Not ready" : "I'm ready"}
              </FixedButton>
            )}

            {isHost && (
              <div className="flex flex-col gap-1.5">
                <FixedButton variant="primary" size="md" className="min-h-11" loading={starting} disabled={!readyToStart || starting} onClick={start} data-testid="ludo-start">
                  <PlayArrowRounded fontSize="small" /> Start game
                </FixedButton>
                {(startBlock || game.settings.autoStart) && (
                  <p className="text-center text-xs text-muted" role="status" data-testid="ludo-start-hint">
                    {game.settings.autoStart && readyToStart ? "Starting…" : game.settings.autoStart ? `${startBlock} It starts by itself when ready.` : startBlock}
                  </p>
                )}
              </div>
            )}

            {notice && (
              <p role="alert" className="text-center text-xs font-medium text-danger" data-testid="ludo-notice">
                {notice}
              </p>
            )}

            {isHost && (
              <section className="flex flex-col gap-2" aria-labelledby="ludo-friends-heading">
                <h2 id="ludo-friends-heading" className="text-xs font-bold tracking-wide text-muted uppercase">Invite online friends</h2>
                <ResourceState loading={friends.loading} error={friends.error} empty={!invitable.length && !outgoing.length ? "None of your friends are online right now. They'll appear here the moment they come online." : ""}>
                  <ul className="flex flex-col gap-2" data-testid="ludo-friends">
                    <AnimatePresence initial={false}>
                      {invitable.map((friend) => (
                        <Motion.div key={friend.id} layout={!reduced} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                          <FriendRow friend={friend} outgoing={outgoingFor(friend.id)} busy={busyId === friend.id} onInvite={invite} onCancel={cancelInvite} disabled={seatsLeft <= 0} />
                        </Motion.div>
                      ))}
                    </AnimatePresence>
                  </ul>
                </ResourceState>
                {seatsLeft <= 0 && <p className="text-xs text-muted">All seats are taken or have an invitation.</p>}
              </section>
            )}
          </>
        )}
      </ResourceState>

      <AnimatePresence>
        {matchFound && (
          <Motion.div className="ludo-overlay ludo-scope" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" data-testid="ludo-match-found">
            <Motion.div initial={reduced ? false : { scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="text-center">
              <p className="text-6xl" aria-hidden="true">🎲</p>
              <p className="mt-2 font-display text-3xl font-semibold text-white">Match found!</p>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmLeave}
        title={isHost ? "Close this lobby?" : "Leave this lobby?"}
        description={isHost ? "Everyone in the lobby will be sent back." : "You can rejoin if you're invited again."}
        confirmLabel={isHost ? "Close lobby" : "Leave"}
        variant="danger"
        onConfirm={leave}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}

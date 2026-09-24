import { ArrowBackRounded, PlayArrowRounded } from "@mui/icons-material";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Avatar from "../../../../components/ui/Avatar";
import Card from "../../../../components/ui/Card";
import { api } from "../../../../utility/api";
import { ResourceState, useRealtime, useResource } from "../../../../utility/helpers";
import { apiErrorMessage, inviteFriend, ticTacToeGamePath, WIN_POINTS } from "../../../../utility/ticTacToe";
import FixedButton from "../components/FixedButton";
import StatsCard from "./StatsCard";

const REQUEST_OPTIONS = [
  { value: "friends", label: "Allow Friends" },
  { value: "off", label: "Turn Off" },
];

// "Game Requests" — who may invite you. Saved on the server, which enforces it
// when an invitation is created (hiding a button would not be enough).
function GameRequestsSetting() {
  const settings = useResource("/games/tic-tac-toe/settings");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const value = settings.data?.gameRequests;

  const choose = async (next) => {
    if (saving || next === value) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.patch("/games/tic-tac-toe/settings", { gameRequests: next });
      settings.setData(data.data);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Couldn't save this setting."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-2.5">
      <div>
        <h2 className="text-xs font-bold tracking-wide text-muted uppercase">Game Requests</h2>
        <p className="mt-0.5 text-xs text-muted">Choose who can invite you to play Tic-Tac-Toe.</p>
      </div>
      <div className="game-tabs" role="radiogroup" aria-label="Game Requests" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {REQUEST_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!settings.data || saving}
              data-tone="math"
              data-active={active ? "true" : "false"}
              className="game-tab"
              onClick={() => choose(option.value)}
            >
              {active && <span className="game-tab-pill" />}
              <span className="game-tab-label">{option.label}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}

const byName = (a, b) => a.fullName.localeCompare(b.fullName);

function FriendRow({ friend, outgoing, onInvite, onCancel, busy }) {
  const reduced = useReducedMotion();
  return (
    <Motion.div
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 rounded-xl border border-line bg-panel p-2.5"
    >
      <Avatar person={friend} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{friend.fullName}</p>
        {outgoing ? (
          <p className="text-[11px] text-muted">Invitation sent — waiting…</p>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <span className="size-2 shrink-0 rounded-full bg-green-500" aria-hidden="true" /> Online
          </p>
        )}
      </div>
      {outgoing ? (
        <FixedButton variant="outline" size="sm" className="min-h-11 shrink-0" loading={busy} onClick={() => onCancel(outgoing)}>
          Cancel
        </FixedButton>
      ) : (
        <FixedButton variant="primary" size="sm" className="min-h-11 shrink-0" loading={busy} onClick={() => onInvite(friend)}>
          <PlayArrowRounded fontSize="small" /> Invite
        </FixedButton>
      )}
    </Motion.div>
  );
}

/**
 * Tic-Tac-Toe home. Route: /study/games/tic-tac-toe
 * Your stats, the Game Requests setting, games you can resume, and friends to
 * invite. (An invitation can also be sent from a friend's profile or the
 * Friends list; the popup for it appears wherever the invited person is.)
 */
export default function TicTacToeLobby({ user }) {
  const navigate = useNavigate();
  const stats = useResource("/games/tic-tac-toe/stats");
  // Only friends who are online right now — kept current by presence events.
  const friends = useResource("/games/tic-tac-toe/friends/online");
  const pending = useResource("/games/tic-tac-toe/invites/pending");
  const active = useResource("/games/tic-tac-toe/active");
  const [busyId, setBusyId] = useState(null);

  // Keep the lists honest when the other person answers / a game changes.
  const refresh = () => {
    pending.reload();
    active.reload();
    stats.reload();
  };
  useRealtime("ticTacToe:invite:accepted", refresh);
  useRealtime("ticTacToe:invite:declined", refresh);
  useRealtime("ticTacToe:invite:cancelled", refresh);
  useRealtime("ticTacToe:invite:expired", refresh);
  useRealtime("ticTacToe:finished", refresh);
  useRealtime("ticTacToe:player:left", refresh);

  // A friend coming online / going offline updates the list in place — no
  // polling. (After a reconnect events may have been missed, so it re-fetches.)
  useRealtime("ticTacToe:presence", (event) => {
    const { userId, isOnline, user: friend } = event.detail || {};
    if (!userId) return;
    friends.setData((current) => {
      const list = current || [];
      if (!isOnline) return list.filter((item) => item.id !== userId);
      if (!friend || list.some((item) => item.id === userId)) return list;
      return [...list, friend].sort(byName);
    });
  });
  useRealtime("realtime:connected", friends.reload);

  const outgoingFor = (friendId) => (pending.data?.outgoing || []).find((invite) => invite.to.id === friendId);

  const invite = async (friend) => {
    setBusyId(friend.id);
    const sent = await inviteFriend(friend, { navigate });
    if (sent) pending.reload();
    else friends.reload(); // e.g. they just went offline — show the truth
    setBusyId(null);
  };

  const cancel = async (invitation) => {
    setBusyId(invitation.to.id);
    try {
      await api.post(`/games/tic-tac-toe/invites/${invitation.id}/cancel`);
    } catch {
      /* already answered — the refresh below shows the truth */
    }
    pending.reload();
    setBusyId(null);
  };

  const games = active.data || [];

  return (
    <div className="games-scope mx-auto flex w-full max-w-md min-w-0 flex-col gap-4" data-tone="math">
      <div>
        <button
          type="button"
          onClick={() => navigate("/study/games")}
          className="inline-flex items-center gap-1 rounded-md py-1 pr-2 text-xs font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowBackRounded style={{ fontSize: 16 }} /> All games
        </button>
      </div>

      <header className="flex items-center gap-3">
        <span className="game-tile" aria-hidden="true">
          ✕○
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight font-semibold text-ink">Tic-Tac-Toe</h1>
          <p className="text-xs text-muted">Challenge a friend · +{WIN_POINTS} points for a win</p>
        </div>
      </header>

      <StatsCard stats={stats.data} />
      <GameRequestsSetting />

      {games.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Games in progress">
          <h2 className="text-xs font-bold tracking-wide text-muted uppercase">Resume a game</h2>
          {games.map((game) => {
            const opponent = game.playerX.id === user.id ? game.playerO : game.playerX;
            return (
              <button
                key={game.id}
                type="button"
                className="game-last"
                data-tone="math"
                onClick={() => navigate(ticTacToeGamePath(game.id))}
              >
                <span className="game-tile game-tile--sm" aria-hidden="true">
                  ✕○
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-bold text-ink">vs {opponent.fullName}</span>
                  <span className="block text-xs text-muted">{game.moveCount} move{game.moveCount === 1 ? "" : "s"} played · Resume</span>
                </span>
              </button>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-2" aria-label="Friends">
        <h2 className="text-xs font-bold tracking-wide text-muted uppercase">Invite an online friend</h2>
        <ResourceState loading={friends.loading} error={friends.error}>
          {!(friends.data || []).length && (
            <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-sm text-muted">
              No friends are online right now.
            </p>
          )}
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {(friends.data || []).map((friend) => (
                <FriendRow
                  key={friend.id}
                  friend={friend}
                  outgoing={outgoingFor(friend.id)}
                  busy={busyId === friend.id}
                  onInvite={invite}
                  onCancel={cancel}
                />
              ))}
            </AnimatePresence>
          </div>
        </ResourceState>
      </section>
    </div>
  );
}

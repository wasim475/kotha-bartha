import { ArrowBackRounded, PlayArrowRounded } from "@mui/icons-material";
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

function FriendRow({ friend, outgoing, onInvite, onCancel, busy }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-panel p-2.5">
      <Avatar person={friend} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{friend.fullName}</p>
        {outgoing && <p className="text-[11px] text-muted">Invitation sent — waiting…</p>}
      </div>
      {outgoing ? (
        <FixedButton variant="outline" size="sm" className="shrink-0" loading={busy} onClick={() => onCancel(outgoing)}>
          Cancel
        </FixedButton>
      ) : (
        <FixedButton variant="primary" size="sm" className="shrink-0" loading={busy} onClick={() => onInvite(friend)}>
          <PlayArrowRounded fontSize="small" /> Invite
        </FixedButton>
      )}
    </div>
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
  const friends = useResource("/friends");
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

  const outgoingFor = (friendId) => (pending.data?.outgoing || []).find((invite) => invite.to.id === friendId);

  const invite = async (friend) => {
    setBusyId(friend.id);
    const sent = await inviteFriend(friend, { navigate });
    if (sent) pending.reload();
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
        <h2 className="text-xs font-bold tracking-wide text-muted uppercase">Invite a friend</h2>
        <ResourceState
          loading={friends.loading}
          error={friends.error}
          empty={!(friends.data || []).length ? "Add some friends to play with them." : ""}
        >
          <div className="flex flex-col gap-2">
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
          </div>
        </ResourceState>
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../../utility/api";
import { useRealtime } from "../../utility/helpers";
import { apiErrorMessage, ludoLobbyPath, ludoPlayPath } from "../../utility/ludo";
import Button from "../ui/Button";
import useButtonColorFix from "../../utility/useButtonColorFix";

const LABEL = { accepted: "Accepted", declined: "Declined", cancelled: "Withdrawn", expired: "Expired" };

/**
 * The "Ludo Challenge" controls inside a notification: Accept / Decline while the
 * invitation is still open, the outcome afterwards. Same server calls as the
 * global popup; the status shown follows the invitation itself (kept up to date
 * by the server and by the live events below).
 */
export default function LudoInviteActions({ notification }) {
  const navigate = useNavigate();
  const primaryFix = useButtonColorFix("primary");
  const outlineFix = useButtonColorFix("outline");
  const payload = notification.payload || {};
  const [status, setStatus] = useState(payload.status || "pending");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "pending") return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  const settle = (next) => (event) => {
    if (event.detail?.inviteId === payload.inviteId || event.detail?.requestId === payload.inviteId) setStatus(next);
  };
  useRealtime("ludo:invite:accepted", settle("accepted"));
  useRealtime("ludo:invite:declined", settle("declined"));
  useRealtime("ludo:invite:cancelled", settle("cancelled"));
  useRealtime("ludo:invite:expired", settle("expired"));
  useRealtime("ludo:rematch:accepted", settle("accepted"));
  useRealtime("ludo:rematch:declined", settle("declined"));

  const expired = status === "pending" && payload.expiresAt && new Date(payload.expiresAt).getTime() <= now;
  const shown = expired ? "expired" : status;

  const respond = async (action) => {
    setBusy(action);
    setError("");
    try {
      const { data } = await api.post(`/games/ludo/invites/${payload.inviteId}/${action}`);
      setStatus(action === "accept" ? "accepted" : "declined");
      if (action === "accept") {
        const game = data.data.game;
        navigate(game.status === "active" ? ludoPlayPath(game.id) : ludoLobbyPath(game.id));
      }
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "That invitation is no longer available."));
      setStatus("expired");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="ludo-notification-actions">
      <span className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-bold tracking-wide text-muted uppercase">Ludo invitation</span>
      {shown === "pending" ? (
        <>
          <Button variant="primary" size="sm" className="min-h-11" loading={busy === "accept"} disabled={Boolean(busy)} onClick={() => respond("accept")} style={primaryFix.style} onMouseEnter={primaryFix.onMouseEnter} onMouseLeave={primaryFix.onMouseLeave} data-testid="ludo-notification-accept">
            Accept
          </Button>
          <Button variant="outline" size="sm" className="min-h-11" loading={busy === "decline"} disabled={Boolean(busy)} onClick={() => respond("decline")} style={outlineFix.style} onMouseEnter={outlineFix.onMouseEnter} onMouseLeave={outlineFix.onMouseLeave} data-testid="ludo-notification-decline">
            Decline
          </Button>
        </>
      ) : (
        <span className="text-xs font-semibold text-muted" data-testid="ludo-notification-status">
          {LABEL[shown] || shown}
        </span>
      )}
      {error && (
        <span role="alert" className="w-full text-xs font-medium text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

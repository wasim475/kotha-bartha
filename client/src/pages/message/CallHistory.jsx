import { ArrowBackRounded, Call, CallMade, CallMissed, CallReceived, Videocam } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Avatar from "../../components/ui/Avatar";
import Button from "../../components/ui/Button";
import { ResourceState, formatTime } from "../../utility/helpers";
import { getCallHistory } from "../../utility/call";
import { useCall } from "../../provider/CallProvider";
import useButtonColorFix from "../../utility/useButtonColorFix";

const formatDuration = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const STATUS_LABEL = {
  completed: (call) => (call.durationSec ? formatDuration(call.durationSec) : "Connected"),
  missed: () => "Missed",
  declined: (call) => (call.direction === "outgoing" ? "Declined" : "Declined by you"),
  cancelled: () => "Missed",
  failed: () => "Call failed",
  ended: (call) => (call.durationSec ? formatDuration(call.durationSec) : "Ended"),
};

function CallRow({ call, onCallBack }) {
  const missed = call.status === "missed" || call.status === "cancelled" || (call.status === "declined" && call.direction === "outgoing");
  const DirectionIcon = missed ? CallMissed : call.direction === "outgoing" ? CallMade : CallReceived;
  const label = (STATUS_LABEL[call.status] || (() => call.status))(call);

  return (
    <div className="flex items-center gap-3 border-b border-line px-3.5 py-3 last:border-b-0">
      <Avatar person={call.with} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{call.with?.fullName || "Unknown"}</p>
        <p className={`flex items-center gap-1 text-xs ${missed ? "text-danger" : "text-muted"}`}>
          <DirectionIcon style={{ fontSize: 14 }} />
          {label}
          {call.video ? <Videocam style={{ fontSize: 13 }} className="ml-1" /> : null}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <p className="text-[11px] text-muted">{formatTime(call.createdAt)}</p>
        {call.with && (
          <button type="button" aria-label={`Call ${call.with.fullName} back`} onClick={() => onCallBack(call.with, call.video)} className="text-muted hover:text-accent">
            {call.video ? <Videocam fontSize="small" /> : <Call fontSize="small" />}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Cross-conversation call log: every past call (incoming/outgoing/missed/
 * declined), with duration, reachable from the Messages conversation list
 * header. Backed entirely by the server-authoritative Call model — nothing
 * here is inferred from message text.
 */
export default function CallHistory() {
  const navigate = useNavigate();
  const call = useCall();
  const [state, setState] = useState({ loading: true, error: "", calls: [], page: 1, totalPages: 1 });
  const outlineFix = useButtonColorFix("outline");

  const load = async (page) => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await getCallHistory(page);
      setState((current) => ({ loading: false, error: "", calls: page === 1 ? data.calls : [...current.calls, ...data.calls], page: data.page, totalPages: data.totalPages }));
    } catch {
      setState((current) => ({ ...current, loading: false, error: "Couldn't load your call history." }));
    }
  };

  useEffect(() => {
    // Initial hydration; state is set after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(1);
  }, []);

  // A call that just ended should show up here without needing a manual refresh.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (call?.status === "idle") load(1);
  }, [call?.status]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate("/app/messages")} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ArrowBackRounded fontSize="small" /> Messages
        </button>
      </div>
      <h1 className="font-display text-2xl font-semibold text-ink">Call history</h1>

      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <ResourceState loading={state.loading && state.page === 1} error={state.error} empty={!state.calls.length ? "No calls yet." : ""}>
          {state.calls.map((row) => (
            <CallRow key={row.id} call={row} onCallBack={(peer, video) => call?.startCall(peer, { video })} />
          ))}
        </ResourceState>
      </div>

      {state.page < state.totalPages && (
        <Button
          variant="outline"
          size="sm"
          className="mx-auto"
          loading={state.loading}
          onClick={() => load(state.page + 1)}
          style={outlineFix.style}
          onMouseEnter={outlineFix.onMouseEnter}
          onMouseLeave={outlineFix.onMouseLeave}
        >
          Load more
        </Button>
      )}
    </div>
  );
}

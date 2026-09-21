import { Call, CallEnd } from "@mui/icons-material";

import Avatar from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import useButtonColorFix from "../../../utility/useButtonColorFix";

const firstName = (fullName = "") => fullName.trim().split(/\s+/)[0] || fullName;

const formatDuration = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const VoiceCall = ({
  selected,
  callState,
  incomingCall,
  callDuration,
  remoteAudio,
  acceptCall,
  finishCall,
}) => {
  const primaryFix = useButtonColorFix("primary");
  const outlineFix = useButtonColorFix("outline");
  const dangerFix = useButtonColorFix("danger");
  const name = firstName(selected?.user?.fullName);

  return (
    <>
      {incomingCall && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-soft px-4 py-3">
          <Avatar person={selected?.user} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="flex items-center gap-1 text-xs text-accent">
              <Call fontSize="inherit" />
              Incoming audio call…
            </p>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={acceptCall}
            style={primaryFix.style}
            onMouseEnter={primaryFix.onMouseEnter}
            onMouseLeave={primaryFix.onMouseLeave}
          >
            Accept
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => finishCall()}
            style={outlineFix.style}
            onMouseEnter={outlineFix.onMouseEnter}
            onMouseLeave={outlineFix.onMouseLeave}
          >
            Decline
          </Button>
        </div>
      )}

      {callState === "calling" && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-soft px-4 py-3">
          <Avatar person={selected?.user} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <Call fontSize="inherit" className="animate-pulse text-accent motion-reduce:animate-none" />
              Calling…
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => finishCall()}
            style={outlineFix.style}
            onMouseEnter={outlineFix.onMouseEnter}
            onMouseLeave={outlineFix.onMouseLeave}
          >
            Cancel
          </Button>
        </div>
      )}

      {callState === "active" && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-soft px-4 py-3">
          <Avatar person={selected?.user} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="flex items-center gap-1.5 text-xs font-medium text-accent">
              <span className="size-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
              Audio call · {formatDuration(callDuration || 0)}
            </p>
          </div>

          <Button
            size="sm"
            variant="danger"
            onClick={() => finishCall()}
            aria-label="End call"
            style={dangerFix.style}
            onMouseEnter={dangerFix.onMouseEnter}
            onMouseLeave={dangerFix.onMouseLeave}
          >
            <CallEnd fontSize="small" />
            End
          </Button>
        </div>
      )}

      <audio ref={remoteAudio} autoPlay />
    </>
  );
};

export default VoiceCall;

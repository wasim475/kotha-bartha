import { Call, CallEnd } from "@mui/icons-material";

import Button from "../../../components/ui/Button";
import useButtonColorFix from "../../../utility/useButtonColorFix";

const VoiceCall = ({
  selected,
  callState,
  incomingCall,
  remoteAudio,
  acceptCall,
  finishCall,
}) => {
  const primaryFix = useButtonColorFix("primary");
  const outlineFix = useButtonColorFix("outline");

  return (
    <>
      {incomingCall && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-line bg-soft px-4 py-2.5 text-sm text-ink">
          <Call fontSize="small" className="text-accent" />
          <span className="flex-1">{selected?.user.fullName} is calling…</span>

          <Button
            size="sm"
            variant="primary"
            onClick={acceptCall}
            style={primaryFix.style}
            onMouseEnter={primaryFix.onMouseEnter}
            onMouseLeave={primaryFix.onMouseLeave}
          >
            Answer
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
        <div className="flex shrink-0 items-center gap-2.5 border-b border-line bg-soft px-4 py-2.5 text-sm text-muted">
          <Call fontSize="small" className="animate-pulse text-accent motion-reduce:animate-none" />
          Calling {selected?.user.fullName}…
        </div>
      )}

      {callState === "active" && (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-line bg-soft px-4 py-2.5 text-sm text-muted">
          <CallEnd fontSize="small" className="text-accent" />
          Voice call in progress
        </div>
      )}

      <audio ref={remoteAudio} autoPlay />
    </>
  );
};

export default VoiceCall;
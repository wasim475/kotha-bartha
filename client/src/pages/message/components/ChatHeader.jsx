import { Call, CallEnd } from "@mui/icons-material";
import { Avatar } from "../../../utility/helpers";

const ChatHeader = ({
  selected,
  onBack,
  callState,
  startCall,
  finishCall,
  isTyping,
}) => {
  return (
    <div className="chat-header">
      {/* Back */}
      <button type="button" className="text-button" onClick={onBack}>
        Back
      </button>

      {/* User */}
      {selected && (
        <>
          <Avatar person={selected.user} />

          <div className="chat-header-user">
            <strong>{selected.user.fullName}</strong>
            {isTyping && <span className="typing-indicator">Typing...</span>}
          </div>
        </>
      )}

      {/* Call */}
      <button
        type="button"
        className="icon-button"
        onClick={callState === "idle" ? startCall : () => finishCall()}
        aria-label="Voice call"
        title="Voice call"
      >
        {callState === "idle" ? <Call /> : <CallEnd />}
      </button>
    </div>
  );
};

export default ChatHeader;

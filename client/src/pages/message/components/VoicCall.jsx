

const VoiceCall = ({
  selected,
  callState,
  incomingCall,
  remoteAudio,
  startCall,
  acceptCall,
  finishCall,
}) => {
  return (
    <>
      

      {/* Incoming Call */}
      {incomingCall && (
        <div className="call-banner">
          <span>{selected?.user.fullName} is calling</span>

          <button
            type="button"
            className="primary-button small"
            onClick={acceptCall}
          >
            Answer
          </button>

          <button
            type="button"
            className="outline-button"
            onClick={() => finishCall()}
          >
            Decline
          </button>
        </div>
      )}

      {/* Calling */}
      {callState === "calling" && (
        <div className="call-banner">
          Calling {selected?.user.fullName}…
        </div>
      )}

      {/* Active Call */}
      {callState === "active" && (
        <div className="call-banner">
          Voice call in progress
        </div>
      )}

      <audio ref={remoteAudio} autoPlay />
    </>
  );
};

export default VoiceCall;
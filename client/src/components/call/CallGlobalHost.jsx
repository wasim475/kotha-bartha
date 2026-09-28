import ActiveCall from "./ActiveCall";
import CallErrorToast from "./CallErrorToast";
import FloatingCall from "./FloatingCall";
import IncomingCallPopup from "./IncomingCallPopup";
import ParticipantInvitePopup from "./ParticipantInvitePopup";

/**
 * Mounted once, above every shell (see Router/Main.jsx), so a call — an
 * incoming ring, the full call screen, or its minimized floating bar —
 * appears on top of whatever page the person is already on (Feed, Messages,
 * Friends, Study, Games, ...) without ever forcing navigation. All actual
 * state lives in CallProvider; this just picks which piece of UI to show.
 */
export default function CallGlobalHost({ userId }) {
  return (
    <>
      <IncomingCallPopup />
      <ParticipantInvitePopup />
      <ActiveCall userId={userId} />
      <FloatingCall />
      <CallErrorToast />
    </>
  );
}

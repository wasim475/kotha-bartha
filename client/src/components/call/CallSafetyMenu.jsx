import { Block, FlagOutlined, MoreVert, NotificationsOff, VolumeOff, VolumeUp } from "@mui/icons-material";
import { useState } from "react";

import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Menu from "../../components/ui/Menu";
import { api } from "../../utility/api";
import { useCall } from "../../provider/CallProvider";
import { getCallSettings, updateCallSettings, useCallSettings } from "../../utility/callSound";
import ReportModal from "../report/ReportModal";

/**
 * Safety + quick settings for the active call: block the other participant
 * (reusing the existing block system — terminates the call immediately),
 * report them (reusing the existing report system), and this device's call
 * sound/vibration preferences (localStorage, same pattern as Ludo's).
 */
export default function CallSafetyMenu() {
  const call = useCall();
  const settings = useCallSettings();
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);

  if (!call?.peer) return null;

  const doBlock = async () => {
    setBlocking(true);
    try {
      await api.post(`/blocks/${call.peer.id}`);
      call.end();
    } finally {
      setBlocking(false);
      setConfirmBlock(false);
    }
  };

  return (
    <>
      <Menu
        align="end"
        trigger={
          <button type="button" aria-label="Call options" className="grid size-10 place-items-center rounded-full" style={{ background: "var(--call-panel)", color: "var(--call-ink)" }}>
            <MoreVert fontSize="small" />
          </button>
        }
        items={[
          {
            key: "sound",
            label: settings.sounds ? "Mute call sounds" : "Unmute call sounds",
            icon: settings.sounds ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />,
            onClick: () => updateCallSettings({ sounds: !getCallSettings().sounds }),
          },
          {
            key: "vibration",
            label: settings.vibration ? "Turn off vibration" : "Turn on vibration",
            icon: <NotificationsOff fontSize="small" />,
            onClick: () => updateCallSettings({ vibration: !getCallSettings().vibration }),
          },
          { key: "report", label: "Report", icon: <FlagOutlined fontSize="small" />, onClick: () => setReportOpen(true) },
          { key: "block", label: "Block & end call", icon: <Block fontSize="small" />, danger: true, onClick: () => setConfirmBlock(true) },
        ]}
      />
      <ReportModal open={reportOpen} targetType="user" targetId={call.peer.id} onClose={() => setReportOpen(false)} />
      <ConfirmDialog
        open={confirmBlock}
        title={`Block ${call.peer.fullName}?`}
        description="This ends the call now and stops them from calling or messaging you until you unblock them."
        confirmLabel="Block"
        variant="danger"
        loading={blocking}
        onConfirm={doBlock}
        onCancel={() => setConfirmBlock(false)}
      />
    </>
  );
}

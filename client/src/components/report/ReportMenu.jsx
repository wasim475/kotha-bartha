import { FlagOutlined, MoreHoriz } from "@mui/icons-material";
import { useState } from "react";

import IconButton from "../ui/IconButton";
import Menu from "../ui/Menu";
import ReportModal from "./ReportModal";

const NOUN = { user: "user", post: "post", comment: "comment", reply: "reply" };

/**
 * The reusable three-dot menu with "Report {thing}", for posts, comments, replies
 * and profiles. It owns the report dialog, so a screen only says what is being
 * reported: <ReportMenu targetType="post" targetId={post.id} />.
 */
export default function ReportMenu({ targetType, targetId, extraItems = [], label }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Menu
        align="end"
        trigger={<IconButton label={label || `${NOUN[targetType][0].toUpperCase()}${NOUN[targetType].slice(1)} options`} icon={<MoreHoriz fontSize="small" />} size="sm" />}
        items={[...extraItems, { key: "report", label: `Report ${NOUN[targetType]}`, icon: <FlagOutlined fontSize="small" />, onClick: () => setOpen(true) }]}
      />
      <ReportModal open={open} targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />
    </>
  );
}

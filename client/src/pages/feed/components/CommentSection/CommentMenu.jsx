import { Delete, Edit, MoreHoriz } from "@mui/icons-material";

import IconButton from "../../../../components/ui/IconButton";
import Menu from "../../../../components/ui/Menu";

const CommentMenu = ({ onEdit, onDelete }) => (
  <Menu
    align="end"
    trigger={<IconButton label="Comment options" icon={<MoreHoriz fontSize="small" />} size="sm" />}
    items={[
      { key: "edit", label: "Edit", icon: <Edit fontSize="small" />, onClick: onEdit },
      { key: "delete", label: "Delete", icon: <Delete fontSize="small" />, danger: true, onClick: onDelete },
    ]}
  />
);

export default CommentMenu;

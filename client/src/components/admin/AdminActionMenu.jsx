import { MoreVert } from "@mui/icons-material";

import IconButton from "../ui/IconButton";
import Menu from "../ui/Menu";

/** The three-dot actions menu on a row. `items` are { key, label, icon?, danger?, onClick }. */
export default function AdminActionMenu({ items, label = "Actions" }) {
  if (!items.length) return null;
  return <Menu align="end" trigger={<IconButton label={label} icon={<MoreVert fontSize="small" />} size="sm" />} items={items} />;
}

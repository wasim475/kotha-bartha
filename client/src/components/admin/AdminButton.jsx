import Button from "../ui/Button";
import useButtonColorFix from "../../utility/useButtonColorFix";

// The shared Button with the app's documented button-reset workaround applied
// (see utility/useButtonColorFix.js), so every Admin button shows its real look.
export default function AdminButton({ variant = "primary", size = "sm", ...props }) {
  const fix = useButtonColorFix(variant);
  return <Button variant={variant} size={size} style={fix.style} onMouseEnter={fix.onMouseEnter} onMouseLeave={fix.onMouseLeave} {...props} />;
}

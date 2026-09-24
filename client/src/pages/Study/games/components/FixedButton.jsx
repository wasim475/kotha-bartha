import Button from "../../../../components/ui/Button";
import useButtonColorFix from "../../../../utility/useButtonColorFix";

// The shared Button, with the app's documented workaround for the
// app-wide `button { background: transparent }` reset applied (see
// utility/useButtonColorFix.js), so every Games button shows its real variant.
export default function FixedButton({ variant = "primary", ...props }) {
  const fix = useButtonColorFix(variant);
  return (
    <Button
      variant={variant}
      style={fix.style}
      onMouseEnter={fix.onMouseEnter}
      onMouseLeave={fix.onMouseLeave}
      {...props}
    />
  );
}

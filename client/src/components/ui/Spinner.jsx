import { cx } from "../../utility/cx";

const sizeMap = {
  xs: "size-3.5 border-[1.5px]",
  sm: "size-4 border-2",
  md: "size-5 border-2",
};

export default function Spinner({ size = "sm", className = "" }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx(
        "inline-block animate-spin rounded-full border-current border-t-transparent opacity-80",
        sizeMap[size] || sizeMap.sm,
        className,
      )}
    />
  );
}

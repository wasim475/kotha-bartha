import { useCall } from "../../provider/CallProvider";

/**
 * Floating reaction particles — purely cosmetic, never interrupts video/audio.
 * Positions are randomized per-reaction (a fixed left offset baked in at
 * push time would look identical every time) but computed once via the
 * reaction's own id so re-renders don't jitter it.
 */
export default function CallReactionsOverlay() {
  const call = useCall();
  if (!call || !call.reactions.length) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-end pr-4 sm:pr-8" aria-hidden="true">
      <div className="relative h-1 w-16">
        {call.reactions.map((reaction) => {
          const option = call.reactionOptions.find((item) => item.type === reaction.type);
          const left = (reaction.id % 5) * 8 - 16;
          return (
            <span key={reaction.id} className="call-reaction-float absolute bottom-0 text-3xl" style={{ left }}>
              {option?.emoji || "💬"}
            </span>
          );
        })}
      </div>
    </div>
  );
}

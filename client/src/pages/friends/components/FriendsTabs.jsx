import { cx } from "../../../utility/cx";

const FriendsTabs = ({ tabs, activeTab, onChange }) => (
  <div
    role="tablist"
    aria-label="Friends sections"
    className="mb-5 inline-flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-full border border-line bg-panel p-1 sm:w-auto"
  >
    {tabs.map(({ id, label }) => {
      const active = activeTab === id;
      return (
        <button
          type="button"
          key={id}
          role="tab"
          aria-selected={active}
          onClick={() => onChange(id)}
          className={cx(
            "flex-1 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors motion-safe:duration-150 sm:flex-none",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            active
              ? "bg-accent text-white shadow-sm"
              : "text-muted hover:bg-soft hover:text-ink",
          )}
        >
          {label}
        </button>
      );
    })}
  </div>
);

export default FriendsTabs;

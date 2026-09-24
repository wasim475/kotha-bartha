import { motion as Motion, useReducedMotion } from "framer-motion";

import { toneFor } from "../utility/gameTypes";

/**
 * Compact segmented selector for the Games page. Categories (key, label, icon)
 * come from the server's game registry via GET /games, so a new category shows
 * up here with no change. Keyboard/screen-reader friendly (tablist).
 */
export default function CategoryTabs({ categories, activeKey, onSelect }) {
  const reduced = useReducedMotion();

  return (
    <div
      className="game-tabs"
      role="tablist"
      aria-label="Game category"
      style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}
    >
      {categories.map((category) => {
        const active = category.key === activeKey;
        return (
          <button
            key={category.key}
            type="button"
            role="tab"
            id={`game-tab-${category.key}`}
            aria-selected={active}
            aria-controls="game-tabpanel"
            data-tone={toneFor(category.key)}
            data-active={active ? "true" : "false"}
            className="game-tab"
            onClick={() => onSelect(category.key)}
          >
            {active && (
              <Motion.span
                layoutId="game-tab-pill"
                className="game-tab-pill"
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="game-tab-icon" aria-hidden="true">
              {category.icon}
            </span>
            <span className="game-tab-label">{category.label}</span>
          </button>
        );
      })}
    </div>
  );
}

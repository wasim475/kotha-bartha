// A 3D die. It only DISPLAYS a value it is given: while `rolling` it tumbles, and
// when the value arrives (from the server online, from the engine locally) it
// settles on that face with a small bounce. The animation is cosmetic — clicking
// only asks for a roll; the result is never generated here.

const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// The cube's rotation that brings each face to the front.
const POSE = {
  1: "rotateX(0deg) rotateY(0deg)",
  2: "rotateY(-90deg)",
  3: "rotateX(-90deg)",
  4: "rotateX(90deg)",
  5: "rotateY(90deg)",
  6: "rotateY(180deg)",
};

function Face({ n }) {
  return (
    <div className="ludo-face" data-n={n}>
      {Array.from({ length: 9 }, (_, cell) => (PIPS[n].includes(cell) ? <span key={cell} className="ludo-pip" /> : <span key={cell} />))}
    </div>
  );
}

export default function Dice({ value, rolling, landed, ready, disabled, onRoll, color, label, size = 68 }) {
  const shown = value && POSE[value] ? value : 1;
  return (
    <button
      type="button"
      className="ludo-dice-btn"
      data-ready={ready ? "true" : "false"}
      data-color={color}
      disabled={disabled}
      onClick={onRoll}
      aria-label={label || (ready ? "Roll the dice" : value ? `Dice shows ${value}` : "Dice")}
      aria-live="polite"
      style={{ "--die": `${size}px` }}
      data-testid="ludo-dice"
      data-value={value || ""}
    >
      <span className="ludo-cube" data-rolling={rolling ? "true" : "false"} data-landed={landed ? "true" : "false"} style={rolling ? undefined : { transform: POSE[shown] }}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <Face key={n} n={n} />
        ))}
      </span>
    </button>
  );
}

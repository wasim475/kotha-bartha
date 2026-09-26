import { ArrowBackRounded, PlayArrowRounded } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import ConfirmDialog from "../../../../components/ui/ConfirmDialog";
import Card from "../../../../components/ui/Card";
import { SEAT_COLORS } from "../../../../games/ludo/board.js";
import { getVariant } from "../../../../games/ludo/variants.js";
import { LUDO_HOME } from "../../../../utility/ludo";
import { ludoSfx, startMusic, stopMusic, useLudoSettings } from "../../../../utility/ludoSound";
import FixedButton from "../components/FixedButton";
import LudoTable from "./components/LudoTable";
import ResultOverlay from "./components/ResultOverlay";
import SettingsMenu from "./components/SettingsMenu";
import useLocalLudo, { hasSavedLocalGame, LOCAL_VARIANT } from "./hooks/useLocalLudo";
import useLudoDirector from "./hooks/useLudoDirector";
import { useEffect } from "react";

const COLOR_LABEL = { red: "Red", green: "Green", yellow: "Yellow", blue: "Blue" };

function Setup({ names, setNames, onStart, onResume, canResume }) {
  const variant = getVariant(LOCAL_VARIANT);
  return (
    <Card className="mx-auto flex w-full max-w-md flex-col gap-4" data-testid="ludo-local-setup">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Who's playing?</h2>
        <p className="text-xs text-muted">{variant.description} No account needed — everything stays on this device.</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {SEAT_COLORS.map((color, index) => (
          <label key={color} className="flex items-center gap-3" data-color={color}>
            <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-black text-white" style={{ background: `var(--ludo-${color})` }} aria-hidden="true">
              {index + 1}
            </span>
            <span className="sr-only">{COLOR_LABEL[color]} player name</span>
            <input
              value={names[index]}
              onChange={(event) => setNames(names.map((name, i) => (i === index ? event.target.value.slice(0, 20) : name)))}
              placeholder={`Player ${index + 1}`}
              maxLength={20}
              aria-label={`${COLOR_LABEL[color]} player name`}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              data-testid={`ludo-name-${index}`}
            />
            <span className="w-14 shrink-0 text-[11px] font-semibold text-muted">{COLOR_LABEL[color]}</span>
          </label>
        ))}
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">
        {variant.rulesSummary.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <FixedButton variant="primary" size="md" className="min-h-11 min-w-0 flex-1" onClick={onStart} data-testid="ludo-local-start">
          <PlayArrowRounded fontSize="small" /> Start game
        </FixedButton>
        {canResume && (
          <FixedButton variant="outline" size="md" className="min-h-11 min-w-0 flex-1" onClick={onResume} data-testid="ludo-local-resume">
            Resume saved game
          </FixedButton>
        )}
      </div>
    </Card>
  );
}

/**
 * Local Ludo (offline, one device). Route: /study/games/ludo/local
 * The same engine as online play, run in the browser: no server, no account.
 */
export default function LudoLocal() {
  const navigate = useNavigate();
  const director = useLudoDirector();
  const local = useLocalLudo(director);
  const settings = useLudoSettings();
  const [names, setNames] = useState(["", "", "", ""]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [canResume] = useState(() => hasSavedLocalGame());
  const { state } = local;

  useEffect(() => {
    if (state && settings.music) startMusic();
    return () => stopMusic();
  }, [state, settings.music]);

  const start = () => {
    ludoSfx.click();
    local.begin(names);
  };
  const finished = state?.phase === "FINISHED";
  const showResult = finished && !director.busy;
  const rows = finished
    ? state.rankings.map((row) => {
        const player = state.players.find((p) => p.seat === row.seat);
        return { ...row, name: player.name, captures: player.captures, tokensHome: player.tokens.filter((t) => t.pos === 56).length };
      })
    : [];

  return (
    <div className="games-scope ludo-scope mx-auto flex w-full min-w-0 flex-col gap-3" data-tone="math">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => (state && !finished ? setConfirmLeave(true) : navigate(LUDO_HOME))}
          className="inline-flex min-h-11 items-center gap-1 rounded-md py-1 pr-2 text-xs font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowBackRounded style={{ fontSize: 16 }} /> Ludo
        </button>
        <div className="flex items-center gap-2">
          <span className="ludo-chip">Local · 4 players</span>
          <SettingsMenu compact />
        </div>
      </div>

      {!state ? (
        <Setup names={names} setNames={setNames} onStart={start} onResume={local.resume} canResume={canResume} />
      ) : (
        <LudoTable
          state={state}
          director={director}
          actingSeat={finished ? null : state.turnSeat}
          local
          hint={local.hint}
          onRoll={local.roll}
          onPick={local.pick}
          variantId={LOCAL_VARIANT}
        />
      )}

      {showResult && (
        <ResultOverlay
          rows={rows}
          local
          rankingEnabled
          onPlayAgain={() => local.begin(state.players.map((p) => p.name))}
          onExit={() => {
            local.quit();
            navigate(LUDO_HOME);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmLeave}
        title="Leave this game?"
        description="Your local game is saved on this device — you can resume it later."
        confirmLabel="Leave"
        onConfirm={() => {
          setConfirmLeave(false);
          navigate(LUDO_HOME);
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}

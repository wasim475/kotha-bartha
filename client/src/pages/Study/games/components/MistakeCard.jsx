import { AccessTime, Close } from "@mui/icons-material";

/**
 * One question from the last-game review: what was asked, what the player
 * answered (or "Time Out"), and the correct answer. `mistake` comes straight
 * from GET /games/attempts/:id/review — which only exists for a completed game.
 */
export default function MistakeCard({ mistake }) {
  const timedOut = mistake.status === "timeout";

  return (
    <article className="game-mistake" data-status={mistake.status}>
      <div className="flex items-center justify-between gap-2">
        <span className="game-chip">Question {mistake.number}</span>
        <span className="game-status-pill" data-status={mistake.status}>
          {timedOut ? <AccessTime style={{ fontSize: 14 }} /> : <Close style={{ fontSize: 14 }} />}
          {timedOut ? "Time Out" : "Wrong"}
        </span>
      </div>

      <p className="game-mistake-prompt">{mistake.prompt}</p>

      <div className="game-mistake-answers">
        <div className="game-answer-box" data-kind="mine">
          <span className="game-answer-label">Your answer</span>
          <span className="game-answer-value">{timedOut ? "Time Out" : mistake.selectedText}</span>
        </div>
        <div className="game-answer-box" data-kind="right">
          <span className="game-answer-label">Correct answer</span>
          <span className="game-answer-value">{mistake.correctText}</span>
        </div>
      </div>
    </article>
  );
}

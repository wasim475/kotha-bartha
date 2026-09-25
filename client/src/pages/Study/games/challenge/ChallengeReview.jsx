import { AccessTime, Check, Close } from "@mui/icons-material";

import { OPTION_LETTERS } from "../utility/gameTypes";

const PILL = { correct: "Correct", wrong: "Wrong", timeout: "Time Out" };
const ICON = { correct: Check, wrong: Close, timeout: AccessTime };

// "B) 48" — the letter is where that answer sits in THIS player's own option
// order (the friend's screen ordered the same options differently).
const withLetter = (options, text) => {
  const at = options.indexOf(text);
  return at >= 0 ? `${OPTION_LETTERS[at]}) ${text}` : text;
};

function AnswerRow({ who, options, answer }) {
  const Icon = ICON[answer.outcome];
  return (
    <div className="ch-review-row" data-outcome={answer.outcome}>
      <span className="game-answer-label">{who}</span>
      <span className="ch-review-value">{answer.outcome === "timeout" ? "No answer" : withLetter(options, answer.selectedText)}</span>
      <span className="ch-pill" data-outcome={answer.outcome}>
        <Icon style={{ fontSize: 14 }} /> {PILL[answer.outcome]}
      </span>
    </div>
  );
}

/**
 * Every question of a finished match: what was asked, the correct answer, and
 * what each player answered with the result. The server only sends a question's
 * answers once it has been resolved, so this can never show a future answer.
 */
export default function ChallengeReview({ results, opponentName }) {
  if (!results.length) return null;
  return (
    <section className="flex flex-col gap-3 text-left" aria-label="Review of the match">
      {results.map((result) => (
        <article key={result.index} className="game-mistake ch-review" data-outcome={result.you.outcome}>
          <div className="flex items-center justify-between gap-2">
            <span className="game-chip">Question {result.number}</span>
          </div>
          <p className="game-mistake-prompt">{result.prompt}</p>
          <div className="ch-review-correct">
            <span className="game-answer-label">Correct answer</span>
            <span className="game-answer-value">{withLetter(result.options, result.correctText)}</span>
          </div>
          <AnswerRow who="You" options={result.options} answer={result.you} />
          <AnswerRow who={opponentName} options={result.options} answer={result.opponent} />
        </article>
      ))}
    </section>
  );
}

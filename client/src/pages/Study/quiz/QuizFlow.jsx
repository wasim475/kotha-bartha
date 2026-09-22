import { ArrowBack, ChevronRight, Lock, MenuBook, PlayArrow, Quiz as QuizIcon, Replay } from "@mui/icons-material";
import { useState } from "react";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { api } from "../../../utility/api";
import { ResourceState, useResource } from "../../../utility/helpers";
import { cx } from "../../../utility/cx";
import QuizPlayer from "./QuizPlayer";
import QuizResult from "./QuizResult";

function SelectionGrid({ items, onSelect, renderLabel, renderSubLabel, emptyLabel }) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center">
        <p className="text-sm text-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {items.map((item) => (
        <button
          key={item.id ?? item}
          type="button"
          onClick={() => onSelect(item)}
          className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3.5 text-left transition-colors motion-safe:duration-150 hover:border-accent hover:bg-soft"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{renderLabel(item)}</span>
            {renderSubLabel && (
              <span className="block truncate text-xs text-muted">{renderSubLabel(item)}</span>
            )}
          </span>
          <ChevronRight fontSize="small" className="shrink-0 text-muted" />
        </button>
      ))}
    </div>
  );
}

function Breadcrumb({ crumbs }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
      {crumbs.map((crumb, index) => (
        <span key={crumb.key} className="flex items-center gap-1.5">
          {index > 0 && <ChevronRight style={{ fontSize: 16 }} className="text-muted" />}
          {crumb.onClick ? (
            <button
              type="button"
              onClick={crumb.onClick}
              className="font-medium text-accent hover:underline"
            >
              {crumb.label}
            </button>
          ) : (
            <span className="font-semibold text-ink">{crumb.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

const setStatusMeta = {
  not_started: { label: "Not started", icon: PlayArrow, className: "text-muted" },
  in_progress: { label: "Resume", icon: PlayArrow, className: "text-accent" },
  completed: { label: "Completed", icon: Replay, className: "text-green-600 dark:text-green-400" },
};

/**
 * The full user-facing quiz journey — Class -> Subject -> Chapter -> Quiz
 * Set -> Play -> Result — as one component with internal step state
 * rather than deep-linked routes (kept simple; resume itself is already
 * server-side via QuizAttempt, so a hard refresh mid-quiz just needs the
 * user to reselect class/subject/chapter/set and "start" transparently
 * resumes their in-progress attempt).
 */
export default function QuizFlow() {
  const [classLevel, setClassLevel] = useState(null);
  const [subject, setSubject] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [result, setResult] = useState(null);
  const [startingSet, setStartingSet] = useState(null);
  const [startError, setStartError] = useState("");

  const classLevels = useResource("/quiz/class-levels");
  const subjects = useResource(classLevel && !chapter && !attempt ? `/quiz/subjects?classLevel=${classLevel}` : null);
  const chapters = useResource(subject && !attempt ? `/quiz/chapters?subjectId=${subject.id}` : null);
  const sets = useResource(chapter && !attempt ? `/quiz/chapters/${chapter.id}/sets` : null);

  const startSet = async (setNumber) => {
    setStartingSet(setNumber);
    setStartError("");
    try {
      const { data } = await api.post(`/quiz/chapters/${chapter.id}/sets/${setNumber}/start`);
      setAttempt(data);
      setResult(null);
    } catch (error) {
      setStartError(error.response?.data?.error?.message || "Couldn't start this quiz set.");
    } finally {
      setStartingSet(null);
    }
  };

  const backToSets = () => {
    setAttempt(null);
    setResult(null);
    sets.reload();
  };

  const retry = () => {
    if (attempt) startSet(attempt.setNumber);
  };

  // ============================================================
  // Playing / Result
  // ============================================================

  if (attempt && !result) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={backToSets} className="mb-4">
          <ArrowBack fontSize="small" /> Back to sets
        </Button>
        <QuizPlayer attempt={attempt} onComplete={setResult} />
      </div>
    );
  }

  if (attempt && result) {
    return (
      <QuizResult
        result={result}
        chapterName={chapter?.name}
        setNumber={attempt.setNumber}
        onRetry={retry}
        onBackToSets={backToSets}
      />
    );
  }

  // ============================================================
  // Class -> Subject -> Chapter -> Sets
  // ============================================================

  const crumbs = [{ key: "quiz", label: "Quiz", onClick: null }];
  if (classLevel) {
    crumbs[0] = { key: "quiz", label: "Quiz", onClick: () => { setClassLevel(null); setSubject(null); setChapter(null); } };
    crumbs.push({
      key: "class",
      label: `Class ${classLevel}`,
      onClick: subject ? () => { setSubject(null); setChapter(null); } : null,
    });
  }
  if (subject) {
    crumbs.push({
      key: "subject",
      label: subject.name,
      onClick: chapter ? () => setChapter(null) : null,
    });
  }
  if (chapter) {
    crumbs.push({ key: "chapter", label: chapter.name, onClick: null });
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Breadcrumb crumbs={crumbs} />

      {!classLevel && (
        <ResourceState loading={classLevels.loading} error={classLevels.error}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {(classLevels.data || []).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setClassLevel(level)}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-5 transition-colors motion-safe:duration-150 hover:border-accent hover:bg-soft"
              >
                <MenuBook className="text-accent" />
                <span className="text-sm font-semibold text-ink">Class {level}</span>
              </button>
            ))}
          </div>
        </ResourceState>
      )}

      {classLevel && !subject && (
        <ResourceState loading={subjects.loading} error={subjects.error}>
          <SelectionGrid
            items={subjects.data || []}
            onSelect={setSubject}
            renderLabel={(item) => item.name}
            emptyLabel="No subjects yet for this class."
          />
        </ResourceState>
      )}

      {subject && !chapter && (
        <ResourceState loading={chapters.loading} error={chapters.error}>
          <SelectionGrid
            items={chapters.data || []}
            onSelect={setChapter}
            renderLabel={(item) => item.name}
            emptyLabel="No chapters yet for this subject."
          />
        </ResourceState>
      )}

      {chapter && (
        <ResourceState loading={sets.loading} error={sets.error}>
          {sets.data?.length ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {sets.data.map((set) => {
                const meta = setStatusMeta[set.status];
                const StatusIcon = meta.icon;
                return (
                  <Card key={set.setNumber} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <QuizIcon fontSize="small" className="text-accent" /> Set {set.setNumber}
                      </span>
                      <span className={cx("text-xs font-medium", meta.className)}>{meta.label}</span>
                    </div>
                    <p className="text-xs text-muted">{set.totalQuestions} questions</p>
                    {set.status === "in_progress" && (
                      <p className="text-xs text-muted">
                        Progress: {set.currentIndex} / {set.totalQuestions}
                      </p>
                    )}
                    {set.firstAttemptScore !== null && (
                      <p className="text-xs text-muted">Leaderboard score: {set.firstAttemptScore}</p>
                    )}
                    <Button
                      variant={set.status === "completed" ? "outline" : "primary"}
                      size="sm"
                      loading={startingSet === set.setNumber}
                      disabled={startingSet !== null}
                      onClick={() => startSet(set.setNumber)}
                    >
                      <StatusIcon fontSize="small" />
                      {set.status === "not_started" && "Start Quiz"}
                      {set.status === "in_progress" && "Resume"}
                      {set.status === "completed" && "Try Again"}
                    </Button>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Lock fontSize="large" className="text-muted" />
              <p className="text-sm text-muted">
                No quiz sets are available for this chapter yet — a set unlocks once 30 questions
                have been added.
              </p>
            </div>
          )}
          {startError && <p className="mt-3 text-center text-xs font-medium text-danger">{startError}</p>}
        </ResourceState>
      )}
    </div>
  );
}

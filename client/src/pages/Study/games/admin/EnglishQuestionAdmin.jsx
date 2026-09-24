import { Add, ArrowBackRounded } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Card from "../../../../components/ui/Card";
import { ResourceState, useResource } from "../../../../utility/helpers";
import FixedButton from "../components/FixedButton";
import EnglishQuestionForm from "./EnglishQuestionForm";
import QuestionRow from "./QuestionRow";

const inputClass =
  "w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent";

function Count({ label, value, tone }) {
  return (
    <Card className="flex flex-col items-center gap-0.5 px-2 py-3 text-center">
      <span className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</span>
      <span className={`font-display text-2xl font-semibold tabular-nums ${tone || "text-ink"}`}>{value}</span>
    </Card>
  );
}

/**
 * English Game question management — Admin / Moderator only. Route:
 * /study/games/manage. This screen is only a convenience: every request it
 * makes is authorised again by the server, which answers 403 to anyone else.
 * Totals, the list and the type catalog all come from the database.
 */
export default function EnglishQuestionAdmin() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ search: "", questionType: "", status: "" });
  const [searchDraft, setSearchDraft] = useState("");
  const [page, setPage] = useState(1);
  // null = closed, "new" = adding, otherwise the question being edited.
  const [editing, setEditing] = useState(null);

  const params = new URLSearchParams({ page: String(page) });
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
  const list = useResource(`/games/english-questions?${params.toString()}`);

  const counts = list.meta?.counts;
  const types = list.meta?.types || [];
  const questions = list.data || [];

  const changeFilter = (patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const onSaved = () => {
    setEditing(null);
    // Changing the page refetches by itself; only reload when already on page 1.
    if (page === 1) list.reload();
    else setPage(1);
  };

  const onChanged = (updated) => {
    list.setData((current = []) => current.map((item) => (item.id === updated.id ? updated : item)));
    list.reload();
  };

  return (
    <div className="games-scope mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-5" data-tone="english">
      <div>
        <button
          type="button"
          onClick={() => navigate("/study/games")}
          className="inline-flex items-center gap-1 rounded-md py-1 pr-2 text-xs font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowBackRounded style={{ fontSize: 16 }} /> All games
        </button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-ink">English Questions</h1>
          <p className="text-sm text-muted">Add and manage questions for the English games.</p>
        </div>
        {editing === null && (
          <FixedButton variant="primary" size="sm" className="shrink-0" onClick={() => setEditing("new")}>
            <Add fontSize="small" /> Add question
          </FixedButton>
        )}
      </div>

      {counts && (
        <div>
          <div className="grid grid-cols-3 gap-2">
            <Count label="Total" value={counts.total} />
            <Count label="Active" value={counts.active} tone="text-success" />
            <Count label="Inactive" value={counts.inactive} tone={counts.inactive ? "text-danger" : "text-muted"} />
          </div>
          <p className="mt-2 text-center text-[11px] text-muted">
            Word Game: {counts.byGame["english-word"].active} active / {counts.byGame["english-word"].total} · Conversion
            Game: {counts.byGame["english-conversion"].active} active / {counts.byGame["english-conversion"].total}
          </p>
        </div>
      )}

      {editing !== null && types.length > 0 && (
        <EnglishQuestionForm
          key={editing === "new" ? "new" : editing.id}
          question={editing === "new" ? null : editing}
          types={types}
          onSaved={onSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      <Card className="flex flex-col gap-2.5">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            changeFilter({ search: searchDraft.trim() });
          }}
        >
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search questions…"
            aria-label="Search questions"
            className={inputClass}
          />
          <FixedButton variant="outline" type="submit" className="shrink-0">
            Search
          </FixedButton>
        </form>
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Filter by type"
            value={filters.questionType}
            onChange={(event) => changeFilter({ questionType: event.target.value })}
            className={inputClass}
          >
            <option value="">All types</option>
            {types.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(event) => changeFilter({ status: event.target.value })}
            className={inputClass}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </Card>

      <ResourceState
        loading={list.loading}
        error={list.error}
        empty={!questions.length ? "No questions match these filters." : ""}
      >
        <div className="flex flex-col gap-3">
          {questions.map((question) => (
            <QuestionRow
              key={question.id}
              question={question}
              onEdit={(item) => {
                setEditing(item);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onChanged={onChanged}
            />
          ))}
        </div>

        {list.meta && (page > 1 || list.meta.hasMore) && (
          <div className="flex items-center justify-between gap-3">
            <FixedButton variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </FixedButton>
            <span className="text-xs text-muted">
              Page {page} · {list.meta.matching} question{list.meta.matching === 1 ? "" : "s"}
            </span>
            <FixedButton variant="outline" size="sm" disabled={!list.meta.hasMore} onClick={() => setPage((current) => current + 1)}>
              Next
            </FixedButton>
          </div>
        )}
      </ResourceState>
    </div>
  );
}

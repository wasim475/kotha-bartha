import { Close, Group, Person, Search } from "@mui/icons-material";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useEffect, useState } from "react";

import Avatar from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";
import Spinner from "../../../components/ui/Spinner";
import { api } from "../../../utility/api";
import { cx } from "../../../utility/cx";
import useButtonColorFix from "../../../utility/useButtonColorFix";

export default function NewConversationDialog({ open, onClose, onCreated }) {
  const [mode, setMode] = useState("direct"); // "direct" | "group"
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const primaryFix = useButtonColorFix("primary");
  const outlineFix = useButtonColorFix("outline");

  useEffect(() => {
    if (!open) {
      setMode("direct");
      setQuery("");
      setResults([]);
      setSelectedIds([]);
      setSelectedPeople([]);
      setGroupName("");
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return undefined;
    }
    let active = true;
    setSearching(true);
    const timeout = setTimeout(() => {
      api
        .get("/users/search", { params: { q: query.trim() } })
        .then(({ data }) => {
          if (active) setResults(data.data || []);
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query]);

  const togglePerson = (person) => {
    if (mode === "direct") {
      startDirect(person);
      return;
    }
    setSelectedIds((current) =>
      current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id],
    );
    setSelectedPeople((current) =>
      current.some((entry) => entry.id === person.id)
        ? current.filter((entry) => entry.id !== person.id)
        : [...current, person],
    );
  };

  const startDirect = async (person) => {
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/conversations", { userId: person.id });
      onCreated(data.data.id);
    } catch (submitError) {
      setError(submitError.response?.data?.error?.message || "Couldn't start that conversation.");
    } finally {
      setSubmitting(false);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedIds.length < 1 || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/conversations/group", {
        groupName: groupName.trim(),
        memberIds: selectedIds,
      });
      onCreated(data.data.id);
    } catch (submitError) {
      setError(submitError.response?.data?.error?.message || "Couldn't create the group.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 transition-opacity duration-150 data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-lg border border-line bg-panel shadow-soft transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <DialogTitle className="font-display text-base font-semibold text-ink">
              {mode === "direct" ? "New conversation" : "New group"}
            </DialogTitle>
            <IconButton label="Close" icon={<Close fontSize="small" />} size="sm" onClick={onClose} />
          </div>

          <div className="flex gap-1.5 border-b border-line px-4 py-2.5">
            <button
              type="button"
              onClick={() => setMode("direct")}
              className={cx(
                "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold",
                mode === "direct" ? "bg-accent text-white" : "bg-soft text-muted",
              )}
            >
              <Person fontSize="inherit" /> Message
            </button>
            <button
              type="button"
              onClick={() => setMode("group")}
              className={cx(
                "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold",
                mode === "group" ? "bg-accent text-white" : "bg-soft text-muted",
              )}
            >
              <Group fontSize="inherit" /> New group
            </button>
          </div>

          {mode === "group" && (
            <div className="border-b border-line px-4 py-3">
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Group name"
                maxLength={80}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
              />
              {selectedPeople.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedPeople.map((person) => (
                    <span
                      key={person.id}
                      className="flex items-center gap-1 rounded-full bg-soft px-2 py-1 text-xs text-ink"
                    >
                      {person.fullName}
                      <button type="button" onClick={() => togglePerson(person)} aria-label={`Remove ${person.fullName}`}>
                        <Close fontSize="inherit" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2 rounded-md border border-line bg-paper px-2.5 py-1.5">
              <Search fontSize="small" className="text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people…"
                autoFocus
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {searching ? (
              <div className="flex justify-center py-6">
                <Spinner size="sm" />
              </div>
            ) : results.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted">
                {query.trim() ? "No one found." : "Search for someone to start with."}
              </p>
            ) : (
              results.map((person) => {
                const isSelected = selectedIds.includes(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => togglePerson(person)}
                    className={cx(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-soft",
                      isSelected && "bg-soft",
                    )}
                  >
                    <Avatar person={person} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{person.fullName}</span>
                    {mode === "group" && (
                      <span
                        className={cx(
                          "flex size-4 items-center justify-center rounded border",
                          isSelected ? "border-accent bg-accent" : "border-line",
                        )}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {error && <p className="px-4 pb-2 text-xs font-medium text-danger">{error}</p>}

          {mode === "group" && (
            <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={submitting}
                style={outlineFix.style}
                onMouseEnter={outlineFix.onMouseEnter}
                onMouseLeave={outlineFix.onMouseLeave}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={submitting}
                disabled={submitting || !groupName.trim() || selectedIds.length < 1}
                onClick={createGroup}
                style={primaryFix.style}
                onMouseEnter={primaryFix.onMouseEnter}
                onMouseLeave={primaryFix.onMouseLeave}
              >
                Create group
              </Button>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

import { Add, EditNote } from "@mui/icons-material";
import { useState } from "react";

import Avatar from "../../../components/ui/Avatar";
import { cx } from "../../../utility/cx";
import useNotes from "../hooks/useNotes";
import useStories from "../hooks/useStories";
import NoteComposerDialog from "./NoteComposerDialog";
import StoryComposerDialog from "./StoryComposerDialog";

function StoryRailSkeleton() {
  return (
    <div className="mb-4 flex gap-3 overflow-x-auto pb-1" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((key) => (
        <div key={key} className="flex w-16 shrink-0 animate-pulse flex-col items-center gap-1.5 motion-reduce:animate-none">
          <div className="size-16 rounded-full bg-soft" />
          <div className="h-2.5 w-10 rounded bg-soft" />
        </div>
      ))}
    </div>
  );
}

// A small speech-bubble pill overlapping the top of an avatar tile,
// Facebook-Notes-style — a sibling of (never nested inside) the tile's own
// avatar button, so its click never also triggers the story viewer.
function NoteBubble({ text, onClick }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="absolute -top-1.5 left-1/2 z-10 max-w-[72px] -translate-x-1/2 truncate rounded-full border border-line bg-panel px-2 py-1 text-[10px] font-medium text-ink shadow-soft"
    >
      {text}
    </button>
  );
}

export default function StoryRail({ user }) {
  const { groups, loading, error, openViewer, createStory } = useStories();
  const notes = useNotes();
  const [composerOpen, setComposerOpen] = useState(false);
  const [noteComposerOpen, setNoteComposerOpen] = useState(false);

  if (loading) return <StoryRailSkeleton />;
  // Stories/Notes are a nice-to-have on top of the feed — a failed fetch
  // shouldn't block the rest of the page, so this just fails soft.
  if (error) return null;

  const myGroup = groups.find((entry) => entry.isMine);
  const friendGroups = groups.filter((entry) => !entry.isMine);
  const friendStoryAuthorIds = new Set(friendGroups.map((entry) => entry.author.id));

  const noteEntries = notes?.entries || [];
  const myNoteEntry = noteEntries.find((entry) => entry.isMine);
  const friendNoteEntries = noteEntries.filter((entry) => !entry.isMine);

  // Union of "has a story" and "has a note" friends — someone with only a
  // note (no story) still needs a tile, or their note would never show up
  // anywhere (see the task's "Notes should appear in the appropriate
  // existing social/story area" requirement).
  const friendTiles = [
    ...friendGroups.map((entry) => ({ author: entry.author, hasStory: true })),
    ...friendNoteEntries
      .filter((entry) => !friendStoryAuthorIds.has(entry.author.id))
      .map((entry) => ({ author: entry.author, hasStory: false })),
  ];
  const friendNotesByAuthorId = new Map(friendNoteEntries.map((entry) => [entry.author.id, entry.note]));

  return (
    <div className="mb-4 flex gap-3 overflow-x-auto pb-1">
      <div className="relative flex w-16 shrink-0 flex-col items-center gap-1.5">
        {myNoteEntry && (
          <NoteBubble text={myNoteEntry.note.text} onClick={() => notes.openViewer(user.id)} />
        )}
        <button
          type="button"
          onClick={() => (myGroup ? openViewer(user.id) : setComposerOpen(true))}
          className="flex w-16 shrink-0 flex-col items-center gap-1.5"
        >
          <span
            className={cx(
              "flex size-16 items-center justify-center rounded-full p-[3px]",
              myGroup ? "bg-blue-500" : "bg-line",
            )}
          >
            <span className="relative flex size-full items-center justify-center rounded-full border-2 border-panel bg-panel">
              <Avatar person={user} size="lg" />
              {!myGroup && (
                <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full border-2 border-panel bg-accent text-white">
                  <Add style={{ fontSize: 13 }} />
                </span>
              )}
            </span>
          </span>
          <span className="w-full truncate text-center text-[11px] text-muted">
            {myGroup ? "Your story" : "Add story"}
          </span>
        </button>
      </div>

      {myGroup && (
        <button
          type="button"
          aria-label="Add another story"
          onClick={() => setComposerOpen(true)}
          className="flex w-16 shrink-0 flex-col items-center gap-1.5"
        >
          <span className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-line text-muted transition-colors hover:border-accent hover:text-accent">
            <Add fontSize="medium" />
          </span>
          <span className="w-full truncate text-center text-[11px] text-muted">Add new</span>
        </button>
      )}

      <button
        type="button"
        aria-label={myNoteEntry ? "Update your note" : "Write a note"}
        onClick={() => setNoteComposerOpen(true)}
        className="flex w-16 shrink-0 flex-col items-center gap-1.5"
      >
        <span className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-line text-muted transition-colors hover:border-accent hover:text-accent">
          <EditNote fontSize="medium" />
        </span>
        <span className="w-full truncate text-center text-[11px] text-muted">
          {myNoteEntry ? "Edit note" : "Write note"}
        </span>
      </button>

      {friendTiles.map(({ author, hasStory }) => {
        const note = friendNotesByAuthorId.get(author.id);
        return (
          <div key={author.id} className="relative flex w-16 shrink-0 flex-col items-center gap-1.5">
            {note && <NoteBubble text={note.text} onClick={() => notes.openViewer(author.id)} />}
            <button
              type="button"
              onClick={() => hasStory && openViewer(author.id)}
              className={cx(
                "flex w-16 shrink-0 flex-col items-center gap-1.5",
                !hasStory && "cursor-default",
              )}
            >
              <span
                className={cx(
                  "flex size-16 items-center justify-center rounded-full p-[3px]",
                  hasStory ? "bg-blue-500" : "bg-transparent",
                )}
              >
                <span className="flex size-full items-center justify-center rounded-full border-2 border-panel bg-panel">
                  <Avatar person={author} size="lg" />
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] text-ink">
                {author.fullName.split(" ")[0]}
              </span>
            </button>
          </div>
        );
      })}

      <StoryComposerDialog
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreate={createStory}
      />

      <NoteComposerDialog
        open={noteComposerOpen}
        onClose={() => setNoteComposerOpen(false)}
        onCreate={notes.createNote}
      />
    </div>
  );
}

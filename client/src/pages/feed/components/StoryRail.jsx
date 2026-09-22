import { Add } from "@mui/icons-material";
import { useState } from "react";

import Avatar from "../../../components/ui/Avatar";
import { cx } from "../../../utility/cx";
import useStories from "../hooks/useStories";
import StoryComposerDialog from "./StoryComposerDialog";
import StoryViewerDialog from "./StoryViewerDialog";

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

export default function StoryRail({ user }) {
  const { groups, loading, error, createStory, deleteStory } = useStories();
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerGroupIndex, setViewerGroupIndex] = useState(null);

  if (loading) return <StoryRailSkeleton />;
  // Stories are a nice-to-have on top of the feed — a failed fetch
  // shouldn't block the rest of the page, so this just fails soft.
  if (error) return null;

  const myGroup = groups.find((entry) => entry.isMine);
  const friendGroups = groups.filter((entry) => !entry.isMine);

  return (
    <div className="mb-4 flex gap-3 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() =>
          myGroup ? setViewerGroupIndex(groups.indexOf(myGroup)) : setComposerOpen(true)
        }
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

      {friendGroups.map((entry) => (
        <button
          key={entry.author.id}
          type="button"
          onClick={() => setViewerGroupIndex(groups.indexOf(entry))}
          className="flex w-16 shrink-0 flex-col items-center gap-1.5"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-blue-500 p-[3px]">
            <span className="flex size-full items-center justify-center rounded-full border-2 border-panel bg-panel">
              <Avatar person={entry.author} size="lg" />
            </span>
          </span>
          <span className="w-full truncate text-center text-[11px] text-ink">
            {entry.author.fullName.split(" ")[0]}
          </span>
        </button>
      ))}

      <StoryComposerDialog
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreate={createStory}
      />

      {viewerGroupIndex !== null && (
        <StoryViewerDialog
          groups={groups}
          startIndex={viewerGroupIndex}
          currentUserId={user.id}
          onClose={() => setViewerGroupIndex(null)}
          onDelete={deleteStory}
        />
      )}
    </div>
  );
}

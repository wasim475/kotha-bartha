import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { ChevronLeft, ChevronRight, Close, Delete } from "@mui/icons-material";
import { useEffect, useState } from "react";

import Avatar from "../../../components/ui/Avatar";
import IconButton from "../../../components/ui/IconButton";
import { formatTime } from "../../../utility/helpers";

/**
 * Full-screen story viewer. Navigates between every story in the current
 * author's group, and rolls over into the next/previous author's group at
 * either end — the same "keep going through everyone's stories" flow
 * Instagram/WhatsApp use. Closes itself if the story it's showing
 * disappears out from under it (e.g. the owner deleted it, or it expired
 * mid-view and a `story:deleted`/`story:new` refresh dropped it).
 */
export default function StoryViewerDialog({ groups, startIndex, currentUserId, onClose, onDelete }) {
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  const goNext = () => {
    if (!group) return;
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((current) => current + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((current) => current + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (storyIndex > 0) {
      setStoryIndex((current) => current - 1);
    } else if (groupIndex > 0) {
      setStoryIndex(groups[groupIndex - 1].stories.length - 1);
      setGroupIndex((current) => current - 1);
    }
  };

  useEffect(() => {
    if (!group || !story) onClose();
  }, [group, story, onClose]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex, groups]);

  if (!group || !story) return null;

  const isMine = group.author.id === currentUserId;

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(story.id);
    } finally {
      setDeleting(false);
      onClose();
    }
  };

  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black" />
      <div className="fixed inset-0 flex items-center justify-center p-0 sm:p-6">
        <DialogPanel className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-black sm:h-[85vh] sm:rounded-2xl">
          {/* Progress segments */}
          <div className="absolute top-0 right-0 left-0 z-10 flex gap-1 p-2">
            {group.stories.map((entry, index) => (
              <span
                key={entry.id}
                className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
              >
                <span
                  className="block h-full rounded-full bg-white"
                  style={{ width: index <= storyIndex ? "100%" : "0%" }}
                />
              </span>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-3 right-0 left-0 z-10 flex items-center gap-2 px-3 pt-3">
            <Avatar person={group.author} size="sm" className="border-2 border-white/70" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{group.author.fullName}</p>
              <p className="text-xs text-white/75">{formatTime(story.createdAt)}</p>
            </div>
            {isMine && (
              <IconButton
                label="Delete story"
                icon={<Delete fontSize="small" />}
                size="sm"
                disabled={deleting}
                onClick={handleDelete}
                className="text-white hover:bg-white/15 hover:text-white"
              />
            )}
            <IconButton
              label="Close"
              icon={<Close fontSize="small" />}
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/15 hover:text-white"
            />
          </div>

          {/* Content */}
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            {story.type === "text" ? (
              <div
                className="flex size-full items-center justify-center p-8"
                style={{ backgroundColor: story.backgroundColor }}
              >
                <p
                  className="text-center text-2xl font-semibold wrap-break-word"
                  style={{ color: story.textColor }}
                >
                  {story.text}
                </p>
              </div>
            ) : (
              <div className="relative flex size-full items-center justify-center">
                <img
                  src={story.media?.secureUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
                {story.text && (
                  <p
                    className="absolute inset-x-6 bottom-8 text-center text-lg font-semibold wrap-break-word"
                    style={{ color: story.textColor }}
                  >
                    {story.text}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Nav zones */}
          <button
            type="button"
            aria-label="Previous story"
            onClick={goPrev}
            className="absolute inset-y-0 left-0 flex w-1/4 items-center justify-start pl-1 text-white/0 hover:text-white/80"
          >
            {(groupIndex > 0 || storyIndex > 0) && <ChevronLeft fontSize="large" />}
          </button>
          <button
            type="button"
            aria-label="Next story"
            onClick={goNext}
            className="absolute inset-y-0 right-0 flex w-1/4 items-center justify-end pr-1 text-white/0 hover:text-white/80"
          >
            <ChevronRight fontSize="large" />
          </button>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

import {
  ErrorOutlined,
  GroupOutlined,
  InboxOutlined,
  OutboxOutlined,
} from "@mui/icons-material";
import { useState } from "react";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import FriendCard from "./FriendCard";

function FriendRowSkeleton() {
  return (
    <Card
      padded={false}
      className="flex animate-pulse items-center gap-3 p-3 motion-reduce:animate-none sm:gap-3.5 sm:p-3.5"
    >
      <div className="size-10 shrink-0 rounded-full bg-soft" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-28 rounded bg-soft" />
        <div className="h-2.5 w-36 rounded bg-soft" />
      </div>
      <div className="h-9 w-20 shrink-0 rounded-md bg-soft" />
    </Card>
  );
}

const emptyStateCopy = {
  friends: {
    icon: GroupOutlined,
    title: "No friends yet",
    message: "People you connect with will show up here.",
  },
  requests: {
    icon: InboxOutlined,
    title: "No pending requests",
    message: "Friend requests sent to you will appear here.",
  },
  sent: {
    icon: OutboxOutlined,
    title: "No sent requests",
    message: "Requests you've sent will show up here until they're accepted.",
  },
};

function FriendEmptyState({ tab }) {
  const copy = emptyStateCopy[tab] || emptyStateCopy.friends;
  const Icon = copy.icon;
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-soft text-muted">
        <Icon fontSize="small" />
      </div>
      <p className="font-display text-lg font-semibold text-ink">{copy.title}</p>
      <p className="max-w-xs text-sm text-muted">{copy.message}</p>
    </div>
  );
}

function FriendErrorState({ message, onRetry }) {
  // See FriendCard.jsx for why this inline style is needed: a pre-existing,
  // app-wide App.css rule silently defeats Button's `outline` colors.
  const [hover, setHover] = useState(false);
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <ErrorOutlined fontSize="small" />
      </div>
      <p className="text-sm text-muted">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          style={{
            backgroundColor: hover ? "var(--soft)" : "var(--panel)",
            color: "var(--ink)",
            borderColor: "var(--line)",
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

const FriendList = ({
  people,
  tab,
  actingIds,
  rowErrors,
  onAccept,
  onCancel,
  onMessage,
  onProfileClick,
}) => {
  if (people.loading) {
    return (
      <div aria-busy="true" aria-label="Loading friends" className="space-y-2">
        <FriendRowSkeleton />
        <FriendRowSkeleton />
        <FriendRowSkeleton />
        <FriendRowSkeleton />
      </div>
    );
  }

  if (people.error) {
    return <FriendErrorState message={people.error} onRetry={people.reload} />;
  }

  if (!people.data?.length) {
    return <FriendEmptyState tab={tab} />;
  }

  return (
    <div className="space-y-2">
      {people.data.map((entry) => {
        const id = entry.id ?? entry.user?.id;
        return (
          <FriendCard
            key={id}
            entry={entry}
            tab={tab}
            acting={actingIds.has(id)}
            error={rowErrors[id]}
            onAccept={onAccept}
            onCancel={onCancel}
            onMessage={onMessage}
            onProfileClick={onProfileClick}
          />
        );
      })}
    </div>
  );
};

export default FriendList;

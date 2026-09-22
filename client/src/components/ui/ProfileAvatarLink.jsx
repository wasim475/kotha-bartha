import { AutoStories, Person } from "@mui/icons-material";
import { Link, useNavigate } from "react-router-dom";

import { useActiveStoryAuthorIds, useStoriesContext } from "../../utility/storyPresence";
import Avatar from "./Avatar";
import Menu from "./Menu";

/**
 * Wraps an Avatar with normal "click to view profile" navigation — unless
 * that person currently has an active Story, in which case clicking opens
 * a small "View Story / View Profile" menu instead (Menu already gives us
 * outside-click/Escape-to-close for free). Falls straight back to a plain
 * profile Link when there's no active story, so navigation is unchanged
 * for the common case.
 */
export default function ProfileAvatarLink({ person, size = "md", className = "" }) {
  const navigate = useNavigate();
  const activeStoryAuthorIds = useActiveStoryAuthorIds();
  const stories = useStoriesContext();
  const hasStory = Boolean(person?.id && activeStoryAuthorIds.has(person.id));

  if (!hasStory || !stories) {
    return (
      <Link to={`/app/profile/${person.id}`} className={className}>
        <Avatar person={person} size={size} />
      </Link>
    );
  }

  return (
    <Menu
      align="start"
      className={className}
      trigger={
        <button type="button" aria-label={`${person.fullName}'s story or profile`}>
          <Avatar person={person} size={size} />
        </button>
      }
      items={[
        {
          key: "story",
          label: "View Story",
          icon: <AutoStories fontSize="small" />,
          onClick: () => stories.openViewer(person.id),
        },
        {
          key: "profile",
          label: "View Profile",
          icon: <Person fontSize="small" />,
          onClick: () => navigate(`/app/profile/${person.id}`),
        },
      ]}
    />
  );
}

import { PersonAddAlt } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../../utility/api";
import "../../CSS/friend.css"

import {
  ResourceState,
  useResource,
} from "../../utility/helpers";

import FriendCard from "./components/FriendCard";

export default function Friends() {
  const [tab, setTab] = useState("friends");

  const navigate = useNavigate();

  const people = useResource(
    `/friends?tab=${tab}`,
  );

  const act = async (entry) => {
    if (tab === "requests") {
      await api.post(
        `/friends/requests/${entry.id}/accept`,
      );
    }

    if (tab === "sent") {
      await api.delete(
        `/friends/requests/${entry.user.id}`,
      );
    }

    people.reload();
  };

  const tabs = [
    {
      id: "friends",
      label: "All Friends",
    },
    {
      id: "requests",
      label: "Friend Requests",
    },
    {
      id: "sent",
      label: "Sent Requests",
    },
  ];

  const handleFindPeople = () => {
    // Find people page পরে এখানে যোগ করতে পারো
  };

  return (
    <>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            Your circle
          </span>

          <h1>Friends</h1>
        </div>

        <button
          type="button"
          className="outline-button"
          onClick={handleFindPeople}
        >
          <PersonAddAlt fontSize="small" />

          Find people
        </button>
      </div>

      {/* Tabs */}
      <div
        className="tabs"
        role="tablist"
      >
        {tabs.map(({ id, label }) => (
          <button
            type="button"
            key={id}
            className={
              tab === id ? "tab-active" : ""
            }
            onClick={() => setTab(id)}
            role="tab"
            aria-selected={tab === id}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Friends */}
      <ResourceState
        loading={people.loading}
        error={people.error}
        empty={
          people.data?.length
            ? ""
            : `No ${tab} to show.`
        }
      >
        <div className="friend-grid">
          {people.data?.map((entry) => (
            <FriendCard
              key={
                entry.id ||
                entry.user?.id
              }
              entry={entry}
              tab={tab}
              onAction={act}
              onProfileClick={(id) =>
                navigate(
                  `/app/profile/${id}`,
                )
              }
            />
          ))}
        </div>
      </ResourceState>
    </>
  );
}
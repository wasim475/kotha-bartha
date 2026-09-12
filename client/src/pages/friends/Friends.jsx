import { PersonAddAlt } from "@mui/icons-material";
import { useState } from "react";
import { api } from "../../utility/api";
import { Avatar, ResourceState, useResource } from "../../utility/helpers";
import { useNavigate } from "react-router-dom";

export default function Friends() {
  const [tab, setTab] = useState("friends");
  const navigate = useNavigate();
  const people = useResource(`/friends?tab=${tab}`);

  const act = async (entry) => {
    if (tab === "requests") {
      await api.post(`/friends/requests/${entry.id}/accept`);
    }
    if (tab === "sent") {
      await api.delete(`/friends/requests/${entry.user.id}`);
    }
    people.reload();
  };

  const tabs = [
    { id: "friends", label: "All Friends" },
    { id: "requests", label: "Friend Requests" },
    { id: "sent", label: "Sent Requests" },
  ];

  // const allUsers = useResource(`/users`);

  // console.log(allUsers.data);

  const handleFindPeople = () => {
    // এখানে Find people বাটনের জন্য কাজ করতে পারেন, যেমন নতুন পেজে নিয়ে যাওয়া।
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Your circle</span>
          <h1>Friends</h1>
        </div>
        <button className="outline-button" onClick={handleFindPeople}>
          <PersonAddAlt fontSize="small" /> Find people
        </button>
      </div>

      <div className="tabs" role="tablist">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            className={tab === id ? "tab-active" : ""}
            onClick={() => setTab(id)}
            role="tab"
            aria-selected={tab === id}
          >
            {label}
          </button>
        ))}
      </div>

      <ResourceState
        loading={people.loading}
        error={people.error}
        empty={people.data?.length ? "" : `No ${tab} to show.`}
      >
        <div className="friend-grid">
          {people.data?.map((entry) => {
            const person = entry.user || entry;
            return (
              <div
                className="friend-card flex"
                key={entry.id || person.id}
                onClick={() => navigate(`/app/profile/${person.id}`)}
                style={{ cursor: "pointer" }}
              >
                <Avatar person={person} />
                <strong>{person.fullName}</strong>
                <span>{entry.status || "Friend"}</span>
                {tab !== "friends" && (
                  <button className="outline-button" onClick={() => act(entry)}>
                    {tab === "requests" ? "Accept" : "Cancel"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </ResourceState>
    </>
  );
}

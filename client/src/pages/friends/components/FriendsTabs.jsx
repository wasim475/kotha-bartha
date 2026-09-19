const FriendsTabs = ({ tabs, activeTab, onChange }) => (
  <div className="tabs" role="tablist">
    {tabs.map(({ id, label }) => (
      <button
        type="button"
        key={id}
        className={activeTab === id ? "tab-active" : ""}
        onClick={() => onChange(id)}
        role="tab"
        aria-selected={activeTab === id}
      >
        {label}
      </button>
    ))}
  </div>
);

export default FriendsTabs;

export default function NotificationHeader({ onMarkAllRead }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">Stay in the loop</span>
        <h1>Notifications</h1>
      </div>

      <button className="text-button" onClick={onMarkAllRead}>
        Mark all read
      </button>
    </div>
  );
}

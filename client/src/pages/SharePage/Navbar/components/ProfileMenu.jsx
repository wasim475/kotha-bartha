import { AdminPanelSettings, Logout, Person, SupportAgent } from "@mui/icons-material";

export default function ProfileMenu({ onProfile, onLogout, onAdmin, onContact }) {
  return (
    <div className="profile-popup">
      <button type="button" className="profile-popup-item" onClick={onProfile}>
        <Person fontSize="small" />

        <span>Profile</span>
      </button>

      {onContact && (
        <button type="button" className="profile-popup-item" onClick={onContact} data-testid="contact-admin-item">
          <SupportAgent fontSize="small" />

          <span>Contact admin</span>
        </button>
      )}

      {onAdmin && (
        <button type="button" className="profile-popup-item" onClick={onAdmin}>
          <AdminPanelSettings fontSize="small" />

          <span>Admin Panel</span>
        </button>
      )}

      <button
        type="button"
        className="profile-popup-item logout-item"
        onClick={onLogout}
      >
        <Logout fontSize="small" />

        <span>Log out</span>
      </button>
    </div>
  );
}

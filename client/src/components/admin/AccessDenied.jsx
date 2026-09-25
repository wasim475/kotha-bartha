import { LockRounded } from "@mui/icons-material";
import { Link } from "react-router-dom";

// What a signed-in user without the right role sees at /admin (the server also
// answers 403 to every admin API call, so this is only the friendly face of it).
export default function AccessDenied({ message = "You don't have permission to view this page." }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper p-6 text-center" data-testid="access-denied">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <span className="grid size-14 place-items-center rounded-full bg-soft text-muted">
          <LockRounded />
        </span>
        <h1 className="font-display text-2xl font-semibold text-ink">Access denied</h1>
        <p className="text-sm text-muted">{message}</p>
        <Link to="/app/feed" className="rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-semibold text-ink shadow-soft hover:bg-soft">
          Back to Kotha-Barta
        </Link>
      </div>
    </div>
  );
}

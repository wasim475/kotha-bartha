import { Cake, Edit, LocationOn, Home as HomeIcon } from "@mui/icons-material";
import { useState } from "react";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import useButtonColorFix from "../../../utility/useButtonColorFix";

const toDateInputValue = (date) => {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const formatDate = (date) => {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
};

const memberSince = (date) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString([], { month: "long", year: "numeric" });
};

// The edit form is only ever mounted while `editing` is true (Profile.jsx
// remounts it via a `key` change), so its fields can be seeded straight
// from `person` in the lazy initializer below — no effect needed to
// re-sync them when edit mode opens.
export default function AboutSection({ person, own, editing, onStartEdit, onCancelEdit, onSave }) {
  const [form, setForm] = useState(() => ({
    bio: person?.bio || "",
    dateOfBirth: toDateInputValue(person?.dateOfBirth),
    hometown: person?.hometown || "",
    currentCity: person?.currentCity || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const primaryFix = useButtonColorFix("primary");
  const outlineFix = useButtonColorFix("outline");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      onCancelEdit();
    } catch (saveError) {
      setError(saveError.response?.data?.error?.message || "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const items = [
    person?.hometown && { icon: <HomeIcon fontSize="small" />, label: `From ${person.hometown}` },
    person?.currentCity && { icon: <LocationOn fontSize="small" />, label: `Lives in ${person.currentCity}` },
    formatDate(person?.dateOfBirth) && {
      icon: <Cake fontSize="small" />,
      label: `Born ${formatDate(person.dateOfBirth)}`,
    },
  ].filter(Boolean);

  if (editing) {
    return (
      <Card>
        <h2 className="font-display text-base font-semibold text-ink">Edit profile info</h2>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-ink">Bio</span>
            <textarea
              value={form.bio}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              rows={3}
              maxLength={240}
              className="w-full resize-y rounded-md border border-line bg-paper p-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-ink">Date of birth</span>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(event) =>
                setForm((current) => ({ ...current, dateOfBirth: event.target.value }))
              }
              max={toDateInputValue(new Date())}
              className="w-full rounded-md border border-line bg-paper p-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-ink">Hometown</span>
            <input
              value={form.hometown}
              onChange={(event) =>
                setForm((current) => ({ ...current, hometown: event.target.value }))
              }
              maxLength={80}
              className="w-full rounded-md border border-line bg-paper p-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-ink">Current city</span>
            <input
              value={form.currentCity}
              onChange={(event) =>
                setForm((current) => ({ ...current, currentCity: event.target.value }))
              }
              maxLength={80}
              className="w-full rounded-md border border-line bg-paper p-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          {error && <p className="text-xs font-medium text-danger">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelEdit}
              disabled={saving}
              style={outlineFix.style}
              onMouseEnter={outlineFix.onMouseEnter}
              onMouseLeave={outlineFix.onMouseLeave}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={saving}
              disabled={saving}
              onClick={save}
              style={primaryFix.style}
              onMouseEnter={primaryFix.onMouseEnter}
              onMouseLeave={primaryFix.onMouseLeave}
            >
              Save
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink">About</h2>
        {own && (
          <button
            type="button"
            onClick={onStartEdit}
            className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            <Edit fontSize="inherit" /> Edit
          </button>
        )}
      </div>

      {items.length === 0 && !memberSince(person?.createdAt) ? (
        <p className="mt-2 text-sm text-muted">
          {own ? "Add your hometown, city, or birthday." : "No profile info yet."}
        </p>
      ) : (
        <ul className="mt-3 grid gap-2.5">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5 text-sm text-ink">
              <span className="text-muted">{item.icon}</span>
              {item.label}
            </li>
          ))}
          {memberSince(person?.createdAt) && (
            <li className="flex items-center gap-2.5 text-sm text-muted">
              Joined {memberSince(person.createdAt)}
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

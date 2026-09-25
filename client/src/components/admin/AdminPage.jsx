/** Title row + content for an Admin page. `actions` sit at the right (wrapping on phones). */
export default function AdminPage({ title, subtitle, actions, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

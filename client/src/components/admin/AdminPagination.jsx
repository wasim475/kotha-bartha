import { ChevronLeft, ChevronRight } from "@mui/icons-material";

import AdminButton from "./AdminButton";

/** Previous / Next with "Page X of Y · N total". Pagination itself happens on the server. */
export default function AdminPagination({ page, totalPages, total, onPage, noun = "items", disabled }) {
  if (!total && total !== 0) return null;
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 pt-1" aria-label="Pagination">
      <p className="text-xs text-muted" data-testid="admin-page-info">
        Page {page} of {totalPages} · {Number(total).toLocaleString()} {noun}
      </p>
      <div className="flex gap-2">
        <AdminButton variant="outline" className="min-h-10" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft fontSize="small" /> Prev
        </AdminButton>
        <AdminButton variant="outline" className="min-h-10" disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
          Next <ChevronRight fontSize="small" />
        </AdminButton>
      </div>
    </nav>
  );
}

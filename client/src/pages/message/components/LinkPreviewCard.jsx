import { Language } from "@mui/icons-material";
import { useEffect, useState } from "react";

import { api } from "../../../utility/api";
import { cx } from "../../../utility/cx";
import { normalizeUrl } from "../utility/richBody";

const previewCache = new Map();

/**
 * Best-effort link preview: fetches OG metadata for the first URL in a
 * message and renders a card, or nothing at all if metadata can't be
 * fetched — a link preview is a nice-to-have, never a blocking error.
 */
export default function LinkPreviewCard({ url, isOwn }) {
  const [preview, setPreview] = useState(previewCache.get(url) ?? undefined);

  useEffect(() => {
    if (previewCache.has(url)) {
      setPreview(previewCache.get(url));
      return;
    }

    let active = true;
    api
      .get("/link-preview", { params: { url: normalizeUrl(url) } })
      .then(({ data }) => {
        previewCache.set(url, data.data);
        if (active) setPreview(data.data);
      })
      .catch(() => {
        previewCache.set(url, null);
        if (active) setPreview(null);
      });

    return () => {
      active = false;
    };
  }, [url]);

  if (!preview) return null;

  return (
    <a
      href={normalizeUrl(url)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={cx(
        "mt-1.5 flex overflow-hidden rounded-lg border",
        isOwn ? "border-white/25 bg-white/10" : "border-line bg-soft",
      )}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          className="h-20 w-20 shrink-0 object-cover"
          loading="lazy"
        />
      )}
      {!preview.image && (
        <div
          className={cx(
            "flex h-20 w-14 shrink-0 items-center justify-center",
            isOwn ? "text-white/60" : "text-muted",
          )}
        >
          <Language fontSize="small" />
        </div>
      )}
      <div className="min-w-0 flex-1 px-2.5 py-2">
        <p className={cx("truncate text-xs font-semibold", isOwn ? "text-white" : "text-ink")}>
          {preview.title}
        </p>
        {preview.description && (
          <p className={cx("mt-0.5 line-clamp-2 text-[11px]", isOwn ? "text-white/75" : "text-muted")}>
            {preview.description}
          </p>
        )}
        <p className={cx("mt-0.5 truncate text-[10px]", isOwn ? "text-white/60" : "text-muted")}>
          {preview.siteName}
        </p>
      </div>
    </a>
  );
}

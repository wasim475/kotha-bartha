import { Lock, PhotoLibraryOutlined } from "@mui/icons-material";
import { useState } from "react";

import ImageLightbox from "../../message/components/ImageLightbox";

function PhotosSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="aspect-square animate-pulse rounded-md bg-soft motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

export default function PhotosGrid({ photos, own }) {
  const [openSrc, setOpenSrc] = useState(null);

  if (photos.loading) return <PhotosSkeleton />;

  if (photos.meta?.restricted) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-soft text-muted">
          <Lock fontSize="small" />
        </div>
        <p className="text-sm text-muted">Add them as a friend to see their photos.</p>
      </div>
    );
  }

  if (!photos.data?.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-soft text-muted">
          <PhotoLibraryOutlined fontSize="small" />
        </div>
        <p className="text-sm text-muted">
          {own ? "Photos from your posts will show up here." : "No photos yet."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.data.map((photo) => (
          <button
            key={photo.postId}
            type="button"
            onClick={() => setOpenSrc(photo.url)}
            className="aspect-square overflow-hidden rounded-md"
          >
            <img
              src={photo.url}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform motion-safe:duration-150 hover:scale-105"
            />
          </button>
        ))}
      </div>

      {openSrc && <ImageLightbox src={openSrc} onClose={() => setOpenSrc(null)} />}
    </>
  );
}

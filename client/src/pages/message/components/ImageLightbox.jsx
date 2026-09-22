import { Close, Download } from "@mui/icons-material";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";

import IconButton from "../../../components/ui/IconButton";

export default function ImageLightbox({ src, alt, onClose }) {
  return (
    <Dialog open={Boolean(src)} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/80 transition-opacity duration-150 data-[closed]:opacity-0"
      />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="relative flex max-h-full max-w-full items-center justify-center transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          {src && (
            <img
              src={src}
              alt={alt || "Photo"}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-soft"
            />
          )}

          <div className="absolute top-2 right-2 flex gap-1.5">
            <a href={src} download={alt} target="_blank" rel="noreferrer">
              <IconButton
                label="Download image"
                icon={<Download fontSize="small" />}
                className="bg-black/50 text-white hover:bg-black/70 hover:text-white"
              />
            </a>
            <IconButton
              label="Close preview"
              icon={<Close fontSize="small" />}
              onClick={onClose}
              className="bg-black/50 text-white hover:bg-black/70 hover:text-white"
            />
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

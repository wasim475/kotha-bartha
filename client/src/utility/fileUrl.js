import { api } from "./api";

export const fileOrigin = api.defaults.baseURL.replace(/\/api\/v1$/, "");

// Attachment URLs are now absolute Cloudinary URLs; this only still adds
// an origin prefix for any old relative /uploads/... URL already saved
// from before the Cloudinary migration.
export const toFileUrl = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${fileOrigin}${path}`;
};

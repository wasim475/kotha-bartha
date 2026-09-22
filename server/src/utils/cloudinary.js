const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true,
});

// resource_type: Cloudinary files audio under "video", everything else
// that isn't an image goes under "raw" so non-media files (pdf, docx, zip…)
// are stored/served as-is rather than being rejected as an invalid image.
const resourceTypeFor = (kind) => {
  if (kind === "image") return "image";
  if (kind === "voice") return "video";
  return "raw";
};

function uploadBuffer(buffer, { kind, folder }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceTypeFor(kind),
        folder,
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });
}

function destroyAsset(publicId, kind) {
  if (!publicId) return Promise.resolve();
  return cloudinary.uploader
    .destroy(publicId, { resource_type: resourceTypeFor(kind) })
    .catch(() => {});
}

module.exports = { cloudinary, uploadBuffer, destroyAsset, resourceTypeFor };

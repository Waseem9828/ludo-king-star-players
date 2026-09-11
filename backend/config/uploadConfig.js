// No cloud storage (Cloudinary/S3/etc.) is configured for this project —
// images are accepted as base64 data URIs and stored directly in MongoDB.
// This caps the data URI string length to keep documents well under
// MongoDB's 16MB hard limit (~4MB of base64 text is ~3MB of actual image).
export const MAX_IMAGE_DATA_URI_LENGTH = 4_000_000;

export function isValidImageDataUri(value) {
  return typeof value === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(value);
}

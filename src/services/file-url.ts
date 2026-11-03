// Attachments are only ever uploaded to our bucket as encrypted-files/<uuid>.<ext> (see backend upload.js).
// The url comes from the sender's encrypted message, so anything else is refused: it would let them
// make us fetch their own server (ip leak) or pick the name the file gets on disk.
const FILE_HOSTS = ["bucket.nanwallet.com"];
const FILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[A-Za-z0-9]{1,32})?$/i;

// On native, cached files are served from the app origin (https://localhost/_capacitor_file_/...) with a
// Content-Type guessed from the extension or sniffed from the content. Only these extensions keep their
// name on disk; any other file gets a .txt suffix so it can never be served as html, svg, xml...
const SAFE_LOCAL_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "heic", "heif",
  "mp4", "webm", "mov", "m4v", "3gp", "mkv",
  "mp3", "m4a", "aac", "ogg", "oga", "opus", "wav", "flac",
  "txt",
];

export const isAllowedFileUrl = (url: unknown): url is string => {
  if (typeof url !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return false;
  if (!FILE_HOSTS.includes(parsed.hostname.toLowerCase())) return false;
  const segments = parsed.pathname.split("/");
  return segments.length === 3 && segments[1] === "encrypted-files" && FILE_ID_PATTERN.test(segments[2]);
};

// Name of the decrypted file in the local cache, or null if the url is not one of our attachments
export const getLocalFileName = (url: unknown): string | null => {
  if (!isAllowedFileUrl(url)) return null;
  const fileID = new URL(url).pathname.split("/")[2];
  const extension = fileID.includes(".") ? fileID.split(".")[1].toLowerCase() : "";
  return SAFE_LOCAL_EXTENSIONS.includes(extension) ? fileID : `${fileID}.txt`;
};

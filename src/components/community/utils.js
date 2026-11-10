import apiService from "../../services/apiService";

/** "just now", "5 min", "3 h", "2 d", then a date. */
export function timeAgo(value) {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`;
  return new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
}

export const fileUrl = (url) => (!url ? "" : url.startsWith("http") ? url : `${apiService.getBaseUrl()}${url}`);

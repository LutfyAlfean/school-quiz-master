const KEY = "hb-quiz-device-id";

/** Kode perangkat acak yang disimpan di browser siswa. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = `dev_${crypto.randomUUID().replace(/-/g, "")}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

export function markQuizDone(slug: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`hb-quiz-done-${slug}`, "1");
}

export function isQuizDoneLocally(slug: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(`hb-quiz-done-${slug}`) === "1";
}

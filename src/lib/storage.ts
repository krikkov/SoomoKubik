import type { Competition, MatchPatch } from "./types";
import { DEFAULT_API_URL, DEFAULT_SHEET_URL } from "@/config";

const API_KEY = "kubik.apiUrl";
const SHEET_KEY = "kubik.sheetUrl";
const LOCAL_DB = "kubik.localDb";

export function getApiUrl(): string {
  if (DEFAULT_API_URL) return DEFAULT_API_URL;
  return localStorage.getItem(API_KEY) ?? "";
}
export function setApiUrl(url: string) {
  localStorage.setItem(API_KEY, url.trim());
}
export function getSheetUrl(): string {
  if (DEFAULT_SHEET_URL) return DEFAULT_SHEET_URL;
  return localStorage.getItem(SHEET_KEY) ?? "";
}
export function setSheetUrl(url: string) {
  localStorage.setItem(SHEET_KEY, url.trim());
}
export const isApiLocked = () => !!DEFAULT_API_URL;
export function isRemote(): boolean {
  return getApiUrl().startsWith("http");
}

/* ------------------------------ локальный режим ------------------------------ */

function readLocal(): Competition[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_DB) ?? "[]") as Competition[];
  } catch {
    return [];
  }
}
function writeLocal(list: Competition[]) {
  localStorage.setItem(LOCAL_DB, JSON.stringify(list));
}
function upsertLocal(comp: Competition) {
  const list = readLocal();
  const idx = list.findIndex((c) => c.id === comp.id);
  if (idx >= 0) list[idx] = comp;
  else list.push(comp);
  writeLocal(list);
}

/* ------------------------------- сетевой слой ------------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ошибка, которую вернул сам Apps Script. Повторять тот же запрос бессмысленно. */
class ApiResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiResponseError";
  }
}

async function fetchTimeout(input: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function jsonp(url: string, params: Record<string, string>, ms = 15000): Promise<any> {
  return new Promise((resolve, reject) => {
    const cb = `kubikcb_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Таймаут запроса к Apps Script"));
    }, ms);
    function cleanup() {
      window.clearTimeout(timer);
      delete (window as any)[cb];
      script.remove();
    }
    (window as any)[cb] = (data: any) => {
      cleanup();
      resolve(data);
    };
    const qs = new URLSearchParams({ ...params, callback: cb }).toString();
    script.src = `${url}${url.includes("?") ? "&" : "?"}${qs}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("Нет связи с Google Таблицей"));
    };
    document.body.appendChild(script);
  });
}

async function apiGet(params: Record<string, string>, attempts = 3): Promise<any> {
  const url = getApiUrl();
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(600 * i);
    const qs = new URLSearchParams({ ...params, t: `${Date.now()}_${i}` }).toString();
    try {
      const res = await fetchTimeout(`${url}${url.includes("?") ? "&" : "?"}${qs}`, { redirect: "follow" }, 15000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.ok === false) throw new ApiResponseError(data.error || "Ошибка Apps Script");
      return data;
    } catch (e) {
      lastErr = e;
    }
    try {
      const data = await jsonp(url, params);
      if (data && data.ok === false) throw new ApiResponseError(data.error || "Ошибка Apps Script");
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Нет связи с Google Таблицей");
}

async function apiPost(body: Record<string, unknown>, attempts = 3): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(800 * i);
    try {
      const res = await fetchTimeout(
        getApiUrl(),
        {
          method: "POST",
          redirect: "follow",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(body),
        },
        20000,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new ApiResponseError(data.error || "Ошибка Apps Script");
      return data;
    } catch (e) {
      lastErr = e;
      // Ответ сервера получен: не ждём три одинаковые неудачные попытки.
      if (e instanceof ApiResponseError) break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Не удалось сохранить данные");
}

/* --------------------------------- публичное -------------------------------- */

export async function pingApi(): Promise<{ ok: boolean; message: string }> {
  if (!isRemote()) return { ok: false, message: "URL Apps Script не задан — работает локальный режим" };
  try {
    const data = await apiGet({ action: "ping" }, 2);
    return data?.ok
      ? { ok: true, message: `Связь с Google Таблицей установлена (версия скрипта ${data.version ?? 1})` }
      : { ok: false, message: data?.error ?? "Некорректный ответ" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function listCompetitions(): Promise<Competition[]> {
  if (!isRemote()) return readLocal();
  const data = await apiGet({ action: "list" });
  if (!data?.ok) throw new Error(data?.error ?? "Ошибка загрузки");
  return (data.competitions ?? []) as Competition[];
}

export async function saveCompetition(comp: Competition): Promise<Competition> {
  const updated = { ...comp, updatedAt: new Date().toISOString() };
  if (!isRemote()) {
    upsertLocal(updated);
    return updated;
  }
  const data = await apiPost({ action: "save", competition: updated });
  return (data.competition ?? updated) as Competition;
}

export type PatchPayload = {
  compId: string;
  patches: MatchPatch[];
  extra?: Partial<Pick<Competition, "finalMatches" | "champion" | "runnerUp" | "stage">>;
};

export async function patchCompetition(payload: PatchPayload, optimistic: Competition): Promise<Competition> {
  if (!isRemote()) {
    upsertLocal(optimistic);
    return optimistic;
  }
  try {
    // Старые развертывания Apps Script ожидают `id`, новые — `compId`.
    // Отправляем оба поля: это обратно совместимо и исключает потерю результатов.
    const data = await apiPost({
      action: "patch",
      ...payload,
      id: payload.compId,
    });
    return (data.competition ?? optimistic) as Competition;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!/Unknown action:\s*patch|Соревнование не найдено/i.test(message)) throw e;

    // Совместимость со старым Apps Script v1: там нет patch либо он принимает
    // другой формат. Через save результат всё равно надёжно попадёт в таблицу.
    // Это гарантирует, что результаты боёв не пропадут после обновления страницы.
    const data = await apiPost({
      action: "save",
      competition: { ...optimistic, updatedAt: new Date().toISOString() },
    });
    return (data.competition ?? optimistic) as Competition;
  }
}

export async function deleteCompetition(id: string): Promise<void> {
  if (!isRemote()) {
    writeLocal(readLocal().filter((c) => c.id !== id));
    return;
  }
  await apiPost({ action: "delete", id });
}

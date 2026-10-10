/**
 * Единая база данных проекта (Google Таблица + Apps Script).
 * Ссылки вшиты в приложение — пользователям ничего настраивать не нужно.
 */
export const DEFAULT_API_URL =
  "https://script.google.com/macros/s/AKfycbyxmkhquYKKrm7P_xB7Z4PPHqs7Zojtp_DZv3rwOJ27DFYAUJgOgHOcXVrUGn-kEoDoxw/exec";

export const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1yDa308L7s03u7e5Oq9-prwlo0vYlfKbn-DXyfNUlw2g/edit?usp=sharing";

/** Интервал автообновления данных (мс) */
export const REFRESH_INTERVAL = 6000;

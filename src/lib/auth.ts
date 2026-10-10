export type Expert = { login: string; password: string; name: string };

export const EXPERTS: Expert[] = [
  { login: "Adminkub1", password: "kubik1111", name: "Эксперт №1" },
  { login: "Adminkub2", password: "kubik2222", name: "Эксперт №2" },
];

const SESSION_KEY = "kubik.session";

export function login(loginValue: string, password: string): Expert | null {
  const found = EXPERTS.find(
    (e) => e.login.toLowerCase() === loginValue.trim().toLowerCase() && e.password === password,
  );
  if (found) localStorage.setItem(SESSION_KEY, found.login);
  return found ?? null;
}

export function currentExpert(): Expert | null {
  const l = localStorage.getItem(SESSION_KEY);
  return EXPERTS.find((e) => e.login === l) ?? null;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

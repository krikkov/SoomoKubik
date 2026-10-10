import type { Competition, Match, MatchPatch, RoundResult, StandingRow, Team } from "./types";

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const isDone = (m: Match) => !!m.winner || !!m.draw;

/* ============================== Круговая система ============================== */

export function roundRobin(teamIds: string[]): Array<Array<[string, string]>> {
  const ids = [...teamIds];
  if (ids.length < 2) return [];
  const bye = "__BYE__";
  if (ids.length % 2 === 1) ids.push(bye);
  const n = ids.length;
  const half = n / 2;
  const rotating = ids.slice(1);
  const rounds: Array<Array<[string, string]>> = [];

  for (let r = 0; r < n - 1; r++) {
    const list = [ids[0], ...rotating];
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < half; i++) {
      const home = list[i];
      const away = list[n - 1 - i];
      if (home === bye || away === bye) continue;
      pairs.push(r % 2 === 0 ? [home, away] : [away, home]);
    }
    rounds.push(shuffle(pairs));
    rotating.unshift(rotating.pop() as string);
  }
  return rounds;
}

export function assignTables(teams: Team[], tables: number): Team[] {
  const shuffled = shuffle(teams);
  return shuffled.map((t, i) => ({ ...t, table: (i % tables) + 1 }));
}

export function generateMainStage(teams: Team[], tables: number): { teams: Team[]; matches: Match[] } {
  const assigned = assignTables(teams, tables);
  const matches: Match[] = [];
  for (let table = 1; table <= tables; table++) {
    const tableTeams = shuffle(assigned.filter((t) => t.table === table).map((t) => t.id));
    roundRobin(tableTeams).forEach((pairs, rIdx) => {
      pairs.forEach((pair, mIdx) => {
        matches.push({
          id: uid("m"),
          stage: "main",
          table,
          round: rIdx + 1,
          order: mIdx + 1,
          a: pair[0],
          b: pair[1],
          winner: null,
          draw: false,
          scoreA: null,
          scoreB: null,
          method: null,
          warnA: 0,
          warnB: 0,
          replays: 0,
          postponed: false,
          finishedAt: null,
          judge: null,
        });
      });
    });
  }
  matches.sort((x, y) => x.table - y.table || x.round - y.round || x.order - y.order);
  return { teams: assigned, matches };
}

export function teamName(comp: Competition, id: string | null | undefined): string {
  if (!id) return "—";
  return comp.teams.find((t) => t.id === id)?.name ?? "—";
}

/* ================================ Турнирная таблица ================================ */

function emptyRow(t: Team): StandingRow {
  return {
    teamId: t.id,
    name: t.name,
    table: t.table,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    scoreFor: 0,
    scoreAgainst: 0,
    place: 0,
  };
}

function computeRows(comp: Competition, teamIds: Set<string>): Map<string, StandingRow> {
  const rows = new Map<string, StandingRow>();
  comp.teams.filter((t) => teamIds.has(t.id)).forEach((t) => rows.set(t.id, emptyRow(t)));
  comp.matches.forEach((m) => {
    if (!m.a || !m.b || !isDone(m)) return;
    const ra = rows.get(m.a);
    const rb = rows.get(m.b);
    const sa = m.scoreA ?? 0;
    const sb = m.scoreB ?? 0;
    [ra, rb].forEach((r) => r && r.played++);
    if (ra) {
      ra.scoreFor += sa;
      ra.scoreAgainst += sb;
    }
    if (rb) {
      rb.scoreFor += sb;
      rb.scoreAgainst += sa;
    }
    if (m.draw) {
      if (ra) ra.draws++;
      if (rb) rb.draws++;
    } else if (m.winner === m.a) {
      if (ra) ra.wins++;
      if (rb) rb.losses++;
    } else {
      if (rb) rb.wins++;
      if (ra) ra.losses++;
    }
  });
  return rows;
}

function primaryCompare(x: StandingRow, y: StandingRow): number {
  return (
    y.wins - x.wins ||
    x.losses - y.losses ||
    y.draws - x.draws ||
    y.scoreFor - x.scoreFor ||
    x.scoreAgainst - y.scoreAgainst
  );
}

function resolveTies(comp: Competition, group: StandingRow[]): StandingRow[] {
  if (group.length < 2) return group;
  const ids = new Set(group.map((r) => r.teamId));
  const mini = { ...comp, matches: comp.matches.filter((m) => m.a && m.b && ids.has(m.a) && ids.has(m.b)) };
  const h2h = computeRows(mini, ids);
  return [...group].sort((x, y) => {
    const c = primaryCompare(h2h.get(x.teamId)!, h2h.get(y.teamId)!);
    return c || x.name.localeCompare(y.name, "ru");
  });
}

function rankRows(comp: Competition, rows: StandingRow[]): StandingRow[] {
  const sorted = [...rows].sort(primaryCompare);
  const result: StandingRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && primaryCompare(sorted[i], sorted[j]) === 0) j++;
    result.push(...resolveTies(comp, sorted.slice(i, j)));
    i = j;
  }
  result.forEach((r, idx) => (r.place = idx + 1));
  return result;
}

export function standings(comp: Competition, tableFilter?: number): StandingRow[] {
  const ids = new Set(comp.teams.filter((t) => (tableFilter ? t.table === tableFilter : true)).map((t) => t.id));
  return rankRows(comp, [...computeRows(comp, ids).values()]);
}

export function mainStageDone(comp: Competition): boolean {
  return comp.matches.length > 0 && comp.matches.every(isDone);
}

export function roundsOfTable(comp: Competition, table: number): number[] {
  return [...new Set(comp.matches.filter((m) => m.table === table).map((m) => m.round))].sort((a, b) => a - b);
}

export function matchesOf(comp: Competition, table: number, round: number): Match[] {
  return comp.matches.filter((m) => m.table === table && m.round === round).sort((a, b) => a.order - b.order);
}

export function roundDone(comp: Competition, table: number, round: number): boolean {
  const list = matchesOf(comp, table, round);
  return list.length > 0 && list.every(isDone);
}

export function byeTeams(comp: Competition, table: number, round: number): Team[] {
  const playing = new Set<string>();
  matchesOf(comp, table, round).forEach((m) => {
    if (m.a) playing.add(m.a);
    if (m.b) playing.add(m.b);
  });
  return comp.teams.filter((t) => t.table === table && !playing.has(t.id));
}

export function postponePatches(comp: Competition, match: Match): MatchPatch[] | null {
  if (match.postponed || isDone(match)) return null;
  const list = matchesOf(comp, match.table, match.round);
  const idx = list.findIndex((m) => m.id === match.id);
  const next = list[idx + 1];
  if (!next) return null;
  return [
    { id: match.id, patch: { order: next.order, postponed: true } },
    { id: next.id, patch: { order: match.order } },
  ];
}

export function canPostpone(comp: Competition, match: Match): boolean {
  return postponePatches(comp, match) !== null;
}

/* ===================================== Финал ===================================== */

export function pickFinalists(comp: Competition, count: number): string[] {
  if (comp.tables <= 1) return standings(comp).slice(0, count).map((r) => r.teamId);
  const perTable = Math.floor(count / comp.tables);
  const picked: string[] = [];
  for (let t = 1; t <= comp.tables; t++) {
    picked.push(...standings(comp, t).slice(0, perTable).map((r) => r.teamId));
  }
  if (picked.length < count) {
    const rest = seedOrderList(comp, comp.teams.map((t) => t.id).filter((id) => !picked.includes(id)));
    picked.push(...rest.slice(0, count - picked.length));
  }
  return seedOrderList(comp, picked);
}

export function seedOrderList(comp: Competition, ids: string[]): string[] {
  const placeAtTable = new Map<string, number>();
  for (let t = 1; t <= Math.max(1, comp.tables); t++) {
    standings(comp, comp.tables > 1 ? t : undefined).forEach((r) => placeAtTable.set(r.teamId, r.place));
  }
  const overall = standings(comp);
  const rowOf = new Map(overall.map((r) => [r.teamId, r]));
  return [...ids].sort((a, b) => {
    const pa = placeAtTable.get(a) ?? 99;
    const pb = placeAtTable.get(b) ?? 99;
    if (pa !== pb) return pa - pb;
    const ra = rowOf.get(a);
    const rb = rowOf.get(b);
    if (ra && rb) return primaryCompare(ra, rb) || ra.place - rb.place;
    return 0;
  });
}

export function seedPositions(size: number): number[] {
  let cur = [1];
  while (cur.length < size) {
    const m = cur.length * 2;
    cur = cur.flatMap((s) => [s, m + 1 - s]);
  }
  return cur;
}

function emptyFinalMatch(round: number, order: number, a: string | null, b: string | null): Match {
  const auto = a && !b ? a : !a && b ? b : null;
  return {
    id: uid("f"),
    stage: "final",
    table: 1,
    round,
    order,
    a,
    b,
    winner: auto,
    scoreA: null,
    scoreB: null,
    method: auto ? "forfeit" : null,
    rounds: [],
    bonusA: 0,
    bonusB: 0,
    warnA: 0,
    warnB: 0,
    replays: 0,
    finishedAt: auto ? new Date().toISOString() : null,
    judge: null,
  };
}

export function generateBracket(seededIds: string[]): Match[] {
  const n = Math.max(2, seededIds.length);
  const size = Math.pow(2, Math.ceil(Math.log2(n)));
  const slots = seedPositions(size).map((s) => seededIds[s - 1] ?? null);
  const matches: Match[] = [];
  const totalRounds = Math.log2(size);
  for (let i = 0; i < slots.length; i += 2) matches.push(emptyFinalMatch(1, i / 2 + 1, slots[i], slots[i + 1]));
  for (let r = 2; r <= totalRounds; r++) {
    const count = size / Math.pow(2, r);
    for (let o = 1; o <= count; o++) matches.push(emptyFinalMatch(r, o, null, null));
  }
  return propagateBracket(matches);
}

const RESET_FIELDS: Partial<Match> = {
  winner: null,
  scoreA: null,
  scoreB: null,
  method: null,
  rounds: [],
  bonusA: 0,
  bonusB: 0,
  warnA: 0,
  warnB: 0,
  replays: 0,
  finishedAt: null,
};

const loserOf = (m: Match): string | null =>
  m.winner && m.a && m.b ? (m.winner === m.a ? m.b : m.a) : null;

export const regularFinals = (list: Match[]) => list.filter((m) => !m.third);

export function totalBracketRounds(list: Match[]): number {
  const reg = regularFinals(list);
  return reg.length ? Math.max(...reg.map((m) => m.round)) : 0;
}

export function propagateBracket(list: Match[]): Match[] {
  const matches = list.map((m) => ({ ...m }));
  const regular = regularFinals(matches);
  const rounds = [...new Set(regular.map((m) => m.round))].sort((a, b) => a - b);
  const byRound = (r: number) => regular.filter((m) => m.round === r).sort((a, b) => a.order - b.order);
  for (let i = 1; i < rounds.length; i++) {
    const prev = byRound(rounds[i - 1]);
    byRound(rounds[i]).forEach((m, idx) => {
      const a = prev[idx * 2]?.winner ?? null;
      const b = prev[idx * 2 + 1]?.winner ?? null;
      if (m.a !== a || m.b !== b) Object.assign(m, RESET_FIELDS, { a, b });
    });
  }

  const total = rounds[rounds.length - 1] ?? 0;
  let third = matches.find((m) => m.third);
  if (total >= 2 && !third) {
    third = { ...emptyFinalMatch(total, 2, null, null), third: true };
    matches.push(third);
  }
  if (third && total >= 2) {
    third.round = total;
    const semis = byRound(total - 1);
    const a = semis[0] ? loserOf(semis[0]) : null;
    const b = semis[1] ? loserOf(semis[1]) : null;
    if (third.a !== a || third.b !== b) Object.assign(third, RESET_FIELDS, { a, b });
    const semisDone = semis.length > 0 && semis.every((m) => m.winner);
    if (semisDone && !third.winner && (a ? !b : !!b)) {
      third.winner = a ?? b;
      third.method = "forfeit";
      third.finishedAt = new Date().toISOString();
    }
  }

  return matches.sort(
    (x, y) => x.round - y.round || Number(!!x.third) - Number(!!y.third) || x.order - y.order,
  );
}

export function bracketRoundName(round: number, totalRounds: number): string {
  const left = totalRounds - round;
  if (left === 0) return "Финал";
  if (left === 1) return "Полуфинал";
  if (left === 2) return "Четвертьфинал";
  return `1/${Math.pow(2, left)} финала`;
}

export function matchTitle(m: Match, totalRounds: number): string {
  if (m.third) return "Матч за 3-е место";
  return bracketRoundName(m.round, totalRounds);
}

export function finalChampion(comp: Competition): { champion: string | null; runnerUp: string | null } {
  const reg = regularFinals(comp.finalMatches);
  if (!reg.length) return { champion: null, runnerUp: null };
  const last = reg.reduce((a, b) => (b.round > a.round ? b : a));
  if (!last.winner || !last.a || !last.b) return { champion: null, runnerUp: null };
  return { champion: last.winner, runnerUp: last.winner === last.a ? last.b : last.a };
}

export function thirdFourth(comp: Competition): { third: string | null; fourth: string | null } {
  const t = comp.finalMatches.find((m) => m.third);
  if (!t || !t.winner) return { third: null, fourth: null };
  return { third: t.winner, fourth: t.a && t.b ? (t.winner === t.a ? t.b : t.a) : null };
}

export function finalsComplete(comp: Competition): boolean {
  if (!comp.finalMatches.length) return false;
  return comp.finalMatches.every((m) => m.winner || (!m.a && !m.b));
}

export type Placement = { teamId: string; place: number; note: string };

export function finalPlacements(comp: Competition): Placement[] {
  const out: Placement[] = [];
  const used = new Set<string>();
  const add = (id: string | null | undefined, note: string) => {
    if (!id || used.has(id)) return;
    used.add(id);
    out.push({ teamId: id, place: out.length + 1, note });
  };
  const { champion, runnerUp } = finalChampion(comp);
  const { third, fourth } = thirdFourth(comp);
  add(champion, "Победитель финала");
  add(runnerUp, "Финал");
  add(third, "Победитель матча за 3-е место");
  add(fourth, "Матч за 3-е место");

  const reg = regularFinals(comp.finalMatches);
  const total = totalBracketRounds(comp.finalMatches);
  const hasThird = comp.finalMatches.some((m) => m.third);
  for (let r = total - (hasThird ? 2 : 1); r >= 1; r--) {
    const losers = reg
      .filter((m) => m.round === r)
      .map(loserOf)
      .filter((x): x is string => !!x);
    seedOrderList(comp, losers).forEach((id) => add(id, bracketRoundName(r, total)));
  }
  seedOrderList(comp, comp.finalists.filter((id) => !used.has(id))).forEach((id) => add(id, "Финалист"));
  const rest = comp.teams.map((t) => t.id).filter((id) => !used.has(id));
  seedOrderList(comp, rest).forEach((id) => add(id, "Основной этап"));
  return out;
}

export type PlayoffState = {
  scoreA: number;
  scoreB: number;
  regularPlayed: number;
  phase: "regular" | "extra" | "judges" | "done";
  winnerSide: "a" | "b" | null;
};

export function evalPlayoff(m: Pick<Match, "rounds" | "bonusA" | "bonusB">): PlayoffState {
  const rounds: RoundResult[] = m.rounds ?? [];
  let a = m.bonusA ?? 0;
  let b = m.bonusB ?? 0;
  const regular = rounds.slice(0, 3);
  if (a >= 2 || b >= 2) return { scoreA: a, scoreB: b, regularPlayed: 0, phase: "done", winnerSide: a >= 2 ? "a" : "b" };
  for (let i = 0; i < regular.length; i++) {
    if (regular[i] === "a") a++;
    if (regular[i] === "b") b++;
    if (a >= 2 || b >= 2)
      return { scoreA: a, scoreB: b, regularPlayed: i + 1, phase: "done", winnerSide: a >= 2 ? "a" : "b" };
  }
  if (regular.length < 3) return { scoreA: a, scoreB: b, regularPlayed: regular.length, phase: "regular", winnerSide: null };
  if (a !== b) return { scoreA: a, scoreB: b, regularPlayed: 3, phase: "done", winnerSide: a > b ? "a" : "b" };
  const extra = rounds[3];
  if (!extra) return { scoreA: a, scoreB: b, regularPlayed: 3, phase: "extra", winnerSide: null };
  if (extra === "none") return { scoreA: a, scoreB: b, regularPlayed: 3, phase: "judges", winnerSide: null };
  return {
    scoreA: a + (extra === "a" ? 1 : 0),
    scoreB: b + (extra === "b" ? 1 : 0),
    regularPlayed: 3,
    phase: "done",
    winnerSide: extra,
  };
}

export function applyPatches(comp: Competition, patches: MatchPatch[]): Competition {
  if (!patches.length) return comp;
  const map = new Map(patches.map((p) => [p.id, p.patch]));
  const apply = (m: Match) => (map.has(m.id) ? { ...m, ...map.get(m.id) } : m);
  return { ...comp, matches: comp.matches.map(apply), finalMatches: comp.finalMatches.map(apply) };
}

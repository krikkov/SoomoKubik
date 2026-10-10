export type Team = {
  id: string;
  name: string;
  members: string[];
  table: number; // 1 | 2 ... назначается при генерации туров, 0 = не назначен
};

export type MatchStage = "main" | "final";

/** Результат одного раунда: победил A, победил B, или «без результата» (после 3 переигровок) */
export type RoundResult = "a" | "b" | "none";

/**
 * normal  — обычная победа по баллам
 * draw    — 0:0, результат не определён после 3 переигровок (только групповой этап)
 * forfeit — неявка соперника (тех. победа 1:0 в группе / 2:0 в плей-офф)
 * penalty — победа за счёт балла, присуждённого за нарушения соперника
 * judges  — решение судей (тактика, агрессия, активность) после доп. раунда
 */
export type WinMethod = "normal" | "draw" | "forfeit" | "penalty" | "judges";

export type Match = {
  id: string;
  stage: MatchStage;
  table: number; // для финала всегда 1
  round: number; // номер тура (main) или раунда сетки (final), с 1
  order: number; // порядок сражения внутри тура
  a: string | null; // id команды
  b: string | null;
  winner: string | null; // id команды-победителя
  draw?: boolean;
  scoreA?: number | null;
  scoreB?: number | null;
  method?: WinMethod | null;
  rounds?: RoundResult[]; // раунды плей-офф
  bonusA?: number; // баллы, присуждённые A за нарушения B
  bonusB?: number;
  warnA?: number; // текущие предупреждения в матче
  warnB?: number;
  replays?: number; // число переигровок текущего раунда
  postponed?: boolean; // матч уже переносился
  third?: boolean; // матч за 3-е место
  finishedAt?: string | null;
  judge?: string | null;
};

export type CompetitionStage = "registration" | "main" | "final" | "finished";

export type Competition = {
  id: string;
  name: string;
  date: string;
  stage: CompetitionStage;
  tables: number;
  teams: Team[];
  matches: Match[]; // основной этап
  finalMatches: Match[]; // плей-офф
  finalistsCount: number;
  finalists: string[]; // в порядке посева (1-й — лучший)
  champion: string | null;
  runnerUp: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type StandingRow = {
  teamId: string;
  name: string;
  table: number;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  scoreFor: number;
  scoreAgainst: number;
  place: number;
};

export type MatchPatch = { id: string; patch: Partial<Match> };

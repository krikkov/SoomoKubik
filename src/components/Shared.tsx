import { Badge, Card } from "@/ui/kit";
import {
  bracketRoundName,
  byeTeams,
  finalPlacements,
  isDone,
  matchesOf,
  regularFinals,
  roundsOfTable,
  standings,
  teamName,
  thirdFourth,
  totalBracketRounds,
} from "@/lib/tournament";
import type { Competition, Match, WinMethod } from "@/lib/types";
import { cn } from "@/utils/cn";

export const METHOD_LABEL: Record<WinMethod, string> = {
  normal: "",
  draw: "ничья 0:0",
  forfeit: "неявка",
  penalty: "нарушение",
  judges: "решение судей",
};

export function TeamChip({
  name,
  state,
  align = "center",
}: {
  name: string;
  state: "win" | "lose" | "idle" | "draw";
  align?: "left" | "right" | "center";
}) {
  return (
    <span
      className={cn(
        "block w-full min-w-0 break-words rounded-lg px-2.5 py-1.5 text-sm font-semibold leading-tight",
        align === "left" && "text-left",
        align === "right" && "text-right",
        align === "center" && "text-center",
        state === "win" && "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/50",
        state === "lose" && "bg-slate-800/70 text-slate-500 line-through",
        state === "draw" && "bg-sky-500/15 text-sky-300",
        state === "idle" && "bg-slate-800/70 text-slate-200",
      )}
    >
      {name}
    </span>
  );
}

export function RoundDots({ match }: { match: Match }) {
  const rounds = match.rounds ?? [];
  if (!rounds.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
      {rounds.map((r, i) => (
        <span
          key={i}
          title={i === 3 ? "доп. раунд" : `раунд ${i + 1}`}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-bold",
            r === "a" && "bg-emerald-500/20 text-emerald-300",
            r === "b" && "bg-violet-500/20 text-violet-300",
            r === "none" && "bg-slate-700 text-slate-400",
          )}
        >
          {i === 3 ? "Д" : `Р${i + 1}`}:{r === "a" ? "A" : r === "b" ? "B" : "–"}
        </span>
      ))}
    </div>
  );
}

export function MatchRow({
  comp,
  match,
  index,
  onClick,
  active,
}: {
  comp: Competition;
  match: Match;
  index?: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const done = isDone(match);
  const stateOf = (side: "a" | "b"): "win" | "lose" | "idle" | "draw" => {
    if (match.draw) return "draw";
    if (!match.winner) return "idle";
    return match.winner === match[side] ? "win" : "lose";
  };
  const hasScore =
    match.scoreA !== null && match.scoreA !== undefined && match.scoreB !== null && match.scoreB !== undefined;
  const isBye = match.stage === "final" && match.method === "forfeit" && (!match.a || !match.b);
  const label = match.method && !isBye ? METHOD_LABEL[match.method] : "";
  const placeholder = isBye ? "— проход —" : "?";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full rounded-xl border p-2.5 text-left transition",
        done ? "border-emerald-700/40 bg-emerald-950/20" : "border-slate-700/60 bg-slate-900/60",
        active && "border-amber-400 ring-2 ring-amber-400/40",
        onClick && "hover:border-amber-400/70",
      )}
    >
      <div className="flex items-center gap-2">
        {index !== undefined && <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-500">{index}</span>}
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] items-center gap-1.5">
          <TeamChip name={match.a ? teamName(comp, match.a) : placeholder} state={stateOf("a")} />
          <span className="text-center text-xs font-bold text-slate-400">
            {hasScore ? `${match.scoreA}:${match.scoreB}` : "vs"}
          </span>
          <TeamChip name={match.b ? teamName(comp, match.b) : placeholder} state={stateOf("b")} />
        </div>
        <span className={cn("w-5 shrink-0 text-center text-xs font-bold", done ? "text-emerald-400" : "text-slate-600")}>
          {done ? "✓" : "…"}
        </span>
      </div>
      {(label || match.postponed) && (
        <div className="mt-1 flex justify-center gap-2 text-[11px] text-slate-400">
          {label && <span>{label}</span>}
          {match.postponed && <span className="text-amber-300/80">перенесён</span>}
        </div>
      )}
      {match.stage === "final" && <RoundDots match={match} />}
    </button>
  );
}

export function TableSchedule({
  comp,
  table,
  onPickMatch,
}: {
  comp: Competition;
  table: number;
  onPickMatch?: (m: Match) => void;
}) {
  const rounds = roundsOfTable(comp, table);
  if (!rounds.length) return <p className="text-slate-400">Туры ещё не сгенерированы.</p>;
  return (
    <div className="space-y-4">
      {rounds.map((r) => {
        const list = matchesOf(comp, table, r);
        const rest = byeTeams(comp, table, r);
        const done = list.every(isDone);
        return (
          <Card key={r} className={cn("p-3", done && "border-emerald-700/40")}>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-bold text-white">Тур {r}</h4>
              <Badge className={done ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}>
                {done ? "завершён" : `${list.filter(isDone).length}/${list.length}`}
              </Badge>
            </div>
            <div className="space-y-2">
              {list.map((m, i) => (
                <MatchRow
                  key={m.id}
                  comp={comp}
                  match={m}
                  index={i + 1}
                  onClick={onPickMatch ? () => onPickMatch(m) : undefined}
                />
              ))}
            </div>
            {rest.length > 0 && <p className="mt-2 text-xs text-slate-500">Отдыхает: {rest.map((t) => t.name).join(", ")}</p>}
          </Card>
        );
      })}
    </div>
  );
}

export function StandingsTable({ comp, table, highlight }: { comp: Competition; table?: number; highlight?: string[] }) {
  const rows = standings(comp, table);
  const showTable = !table && comp.tables > 1;
  const th = "px-1 py-2 text-center sm:px-2";
  const td = "px-1 py-2 text-center sm:px-2";
  return (
    <div>
      <table className="w-full table-auto text-xs sm:text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-slate-400 sm:text-xs">
            <th className="w-7 px-1 py-2 text-left sm:px-2">#</th>
            <th className="px-1 py-2 text-left sm:px-2">Команда</th>
            {showTable && <th className={th}>Стол</th>}
            <th className={th} title="Сыграно матчей">И</th>
            <th className={cn(th, "text-emerald-400")} title="Победы">В</th>
            <th className={cn(th, "text-rose-400")} title="Поражения">П</th>
            <th className={cn(th, "text-sky-300")} title="Ничьи">Н</th>
            <th className={th} title="Баллы набрано : пропущено">Баллы</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.teamId}
              className={cn(
                "border-t border-slate-800",
                r.place === 1 && "bg-amber-500/10",
                r.place === 2 && "bg-slate-400/10",
                r.place === 3 && "bg-orange-700/10",
                highlight?.includes(r.teamId) && "outline outline-1 -outline-offset-1 outline-emerald-500/60",
              )}
            >
              <td className="px-1 py-2 font-bold text-slate-400 sm:px-2">
                {r.place === 1 ? "🥇" : r.place === 2 ? "🥈" : r.place === 3 ? "🥉" : r.place}
              </td>
              <td className="break-words px-1 py-2 font-semibold text-white sm:px-2">{r.name}</td>
              {showTable && <td className={cn(td, "text-slate-400")}>{r.table}</td>}
              <td className={cn(td, "text-slate-300")}>{r.played}</td>
              <td className={cn(td, "font-bold text-emerald-400")}>{r.wins}</td>
              <td className={cn(td, "text-rose-400")}>{r.losses}</td>
              <td className={cn(td, "text-sky-300")}>{r.draws}</td>
              <td className={cn(td, "whitespace-nowrap text-amber-300")}>
                {r.scoreFor}:{r.scoreAgainst}
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={8} className="px-2 py-6 text-center text-slate-500">
                Пока нет результатов
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-slate-500">
        И — игры, В — победы, П — поражения, Н — ничьи. Места: победы → поражения → ничьи → набранные баллы →
        пропущенные баллы → личные встречи
      </p>
    </div>
  );
}

export function AllStandings({ comp, highlight }: { comp: Competition; highlight?: string[] }) {
  if (comp.tables <= 1) return <StandingsTable comp={comp} highlight={highlight} />;
  const tables = Array.from({ length: comp.tables }, (_, i) => i + 1);
  return (
    <div className="space-y-4">
      <div className={cn("grid gap-4", comp.tables === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3")}>
        {tables.map((t) => (
          <div key={t} className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-3">
            <p className="mb-2 text-center text-sm font-black uppercase tracking-wide text-amber-300">🎯 Стол {t}</p>
            <StandingsTable comp={comp} table={t} highlight={highlight} />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-3">
        <p className="mb-2 text-center text-sm font-black uppercase tracking-wide text-sky-300">Общий зачёт</p>
        <StandingsTable comp={comp} highlight={highlight} />
      </div>
    </div>
  );
}

export function BracketView({ comp, onPickMatch }: { comp: Competition; onPickMatch?: (m: Match) => void }) {
  if (!comp.finalMatches.length) return <p className="text-slate-400">Финальная сетка ещё не сформирована.</p>;
  const regular = regularFinals(comp.finalMatches);
  const thirdMatch = comp.finalMatches.find((m) => m.third);
  const rounds = [...new Set(regular.map((m) => m.round))].sort((a, b) => a - b);
  const total = totalBracketRounds(comp.finalMatches);
  const seed = (id: string | null) => {
    const i = id ? comp.finalists.indexOf(id) : -1;
    return i >= 0 ? i + 1 : null;
  };
  const cols = rounds.length;
  return (
    <div
      className={cn(
        "grid gap-4",
        cols === 2 && "md:grid-cols-2",
        cols === 3 && "md:grid-cols-3",
        cols >= 4 && "md:grid-cols-2 xl:grid-cols-4",
      )}
    >
      {rounds.map((r) => {
        const list = regular.filter((m) => m.round === r).sort((a, b) => a.order - b.order);
        const isLast = r === total;
        return (
          <div key={r} className="flex min-w-0 flex-col">
            <h4 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-amber-300">
              {bracketRoundName(r, total)}
            </h4>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {list.map((m) => (
                <div key={m.id}>
                  {r === 1 && (seed(m.a) || seed(m.b)) && (
                    <p className="mb-1 text-center text-[10px] uppercase tracking-wide text-slate-500">
                      посев {seed(m.a) ?? "—"} vs {seed(m.b) ?? "—"}
                    </p>
                  )}
                  <MatchRow comp={comp} match={m} onClick={onPickMatch && m.a && m.b ? () => onPickMatch(m) : undefined} />
                </div>
              ))}
              {isLast && thirdMatch && (
                <div className="mt-2">
                  <p className="mb-1 text-center text-xs font-bold uppercase tracking-wide text-orange-300">
                    🥉 Матч за 3-е место
                  </p>
                  <MatchRow
                    comp={comp}
                    match={thirdMatch}
                    onClick={onPickMatch && thirdMatch.a && thirdMatch.b ? () => onPickMatch(thirdMatch) : undefined}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ChampionBanner({ comp }: { comp: Competition }) {
  if (!comp.champion) return null;
  const { third } = thirdFourth(comp);
  return (
    <Card className="border-amber-400/60 bg-gradient-to-br from-amber-500/20 to-orange-600/10 text-center">
      <div className="text-5xl">🏆</div>
      <p className="mt-2 text-xs uppercase tracking-[0.3em] text-amber-300">Победитель соревнования</p>
      <p className="mt-1 text-3xl font-black text-white">{teamName(comp, comp.champion)}</p>
      {comp.runnerUp && <p className="mt-2 text-sm text-slate-300">🥈 2 место — {teamName(comp, comp.runnerUp)}</p>}
      {third && <p className="mt-1 text-sm text-slate-300">🥉 3 место — {teamName(comp, third)}</p>}
    </Card>
  );
}

export function FinalPlacements({ comp }: { comp: Competition }) {
  const list = finalPlacements(comp);
  if (!list.length) return null;
  const medal = (p: number) => (p === 1 ? "🥇" : p === 2 ? "🥈" : p === 3 ? "🥉" : null);
  return (
    <Card>
      <h4 className="mb-3 text-lg font-bold text-white">Итоговые места</h4>
      <div className="space-y-2">
        {list.map((p) => {
          const team = comp.teams.find((t) => t.id === p.teamId);
          return (
            <div
              key={p.teamId}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3",
                p.place === 1 && "border-amber-400/60 bg-amber-500/10",
                p.place === 2 && "border-slate-400/50 bg-slate-400/10",
                p.place === 3 && "border-orange-600/50 bg-orange-700/10",
                p.place > 3 && "border-slate-700/60 bg-slate-950/40",
              )}
            >
              <div className="w-12 shrink-0 text-center">
                <div className="text-2xl leading-none">{medal(p.place) ?? ""}</div>
                <div className="text-sm font-black text-white">{p.place} место</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words font-bold text-white">{team?.name ?? "—"}</p>
                <p className="break-words text-sm text-slate-300">
                  {team?.members.filter(Boolean).join(", ") || "состав не указан"}
                </p>
                <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">{p.note}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

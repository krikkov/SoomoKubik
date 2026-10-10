import { Badge, Button, Card, PageTitle } from "@/ui/kit";
import { useToast } from "@/ui/toast";
import { BracketView, ChampionBanner, FinalPlacements, METHOD_LABEL, RoundDots } from "../Shared";
import { formatDate } from "../ViewerScreen";
import type { Competition, Match, MatchPatch, RoundResult } from "@/lib/types";
import {
  evalPlayoff,
  finalChampion,
  finalsComplete,
  matchTitle,
  propagateBracket,
  regularFinals,
  teamName,
  totalBracketRounds,
} from "@/lib/tournament";
import { cn } from "@/utils/cn";

type Extra = Partial<Pick<Competition, "finalMatches" | "champion" | "runnerUp" | "stage">>;

export function FinalJudging({
  comp,
  judge,
  onBack,
  onPatch,
  busy,
}: {
  comp: Competition;
  judge: string;
  onBack: () => void;
  onPatch: (patches: MatchPatch[], extra?: Extra) => Promise<void> | void;
  busy: boolean;
}) {
  const toast = useToast();
  const finalMatches = comp.finalMatches.some((m) => m.third) ? comp.finalMatches : propagateBracket(comp.finalMatches);
  const view: Competition = { ...comp, finalMatches };
  const total = totalBracketRounds(finalMatches);

  const playable = finalMatches.filter((m) => m.a && m.b);
  const pending = playable.filter((m) => !m.winner);
  const currentRound = pending.length ? Math.min(...pending.map((m) => m.round)) : total;
  const currentMatches = playable
    .filter((m) => m.round === currentRound)
    .sort((a, b) => Number(!!b.third) - Number(!!a.third) || a.order - b.order);
  const { champion, runnerUp } = finalChampion(view);
  const complete = finalsComplete(view);
  const name = (id: string | null | undefined) => teamName(comp, id);
  const other = (s: "a" | "b") => (s === "a" ? "b" : "a");

  function commit(m: Match, changes: Partial<Match>) {
    const merged: Match = { ...m, ...changes };
    if (merged.method !== "forfeit" && merged.method !== "judges") {
      const st = evalPlayoff(merged);
      merged.scoreA = st.scoreA;
      merged.scoreB = st.scoreB;
      merged.winner = st.phase === "done" && st.winnerSide ? merged[st.winnerSide] : null;
      merged.method = merged.winner ? "normal" : null;
    }
    merged.finishedAt = merged.winner ? new Date().toISOString() : null;
    merged.judge = judge;
    const next = propagateBracket(finalMatches.map((x) => (x.id === m.id ? merged : x)));
    const res = finalChampion({ ...comp, finalMatches: next });
    if (merged.winner && !m.winner) {
      setTimeout(() => toast(`🏆 ${matchTitle(m, total)}: победа «${name(merged.winner)}»`, "success", 3500), 400);
    }
    return onPatch([], { finalMatches: next, champion: res.champion, runnerUp: res.runnerUp });
  }

  const addRound = (m: Match, r: RoundResult) => {
    if (r === "none") toast("🤝 Результат раунда не определён — баллы не начислены", "info");
    else toast(`Раунд: балл «${name(m[r])}»`, "success", 2000);
    return commit(m, { rounds: [...(m.rounds ?? []), r], replays: 0, method: null });
  };

  const warn = (m: Match, side: "a" | "b") => {
    const wKey = side === "a" ? "warnA" : "warnB";
    const bKey = side === "a" ? "bonusB" : "bonusA";
    const w = (m[wKey] ?? 0) + 1;
    if (w >= 2) {
      toast(`⚠️ Второе предупреждение «${name(m[side])}» — балл команде «${name(m[other(side)])}»`, "warning", 3500);
      return commit(m, { [wKey]: 0, [bKey]: (m[bKey] ?? 0) + 1, method: null });
    }
    toast(`⚠️ Предупреждение команде «${name(m[side])}» (1 из 2)`, "warning");
    return commit(m, { [wKey]: w });
  };

  const violation = (m: Match, side: "a" | "b") => {
    const bKey = side === "a" ? "bonusB" : "bonusA";
    toast(`❗ Нарушение «${name(m[side])}» — балл команде «${name(m[other(side)])}»`, "danger", 3500);
    return commit(m, { [bKey]: (m[bKey] ?? 0) + 1, method: null });
  };

  const forfeit = (m: Match, absent: "a" | "b") => {
    const winSide = other(absent);
    toast(`🚫 Неявка «${name(m[absent])}» — победа «${name(m[winSide])}» 2:0`, "danger", 3500);
    return commit(m, {
      winner: m[winSide],
      method: "forfeit",
      scoreA: winSide === "a" ? 2 : 0,
      scoreB: winSide === "b" ? 2 : 0,
    });
  };

  const replay = (m: Match) => {
    const n = Math.min(3, (m.replays ?? 0) + 1);
    toast(n >= 3 ? "🔁 Третья переигровка. Нет результата — «Раунд без результата»" : `🔁 Переигровка раунда (${n} из 3)`, "info");
    return commit(m, { replays: n });
  };

  const judgesDecision = (m: Match, side: "a" | "b") => {
    toast(`⚖️ Решение судей: победа «${name(m[side])}»`, "success");
    return commit(m, { winner: m[side], method: "judges" });
  };

  const undoLast = (m: Match) => {
    toast("↶ Последнее действие отменено", "info");
    if (m.method === "forfeit" || m.method === "judges") return commit(m, { method: null, winner: null });
    return commit(m, { rounds: (m.rounds ?? []).slice(0, -1), method: null });
  };

  const resetMatch = (m: Match) => {
    toast("↺ Матч сброшен", "info");
    return commit(m, { rounds: [], bonusA: 0, bonusB: 0, warnA: 0, warnB: 0, replays: 0, method: null, winner: null });
  };

  const finishCompetition = async () => {
    toast("🏁 Соревнование завершено!", "success", 4000);
    await onPatch([], { finalMatches, stage: "finished", champion, runnerUp });
  };

  const lastDecided = [...playable]
    .filter((m) => m.winner)
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))[0];

  return (
    <div>
      <PageTitle
        title="Финал — олимпийская система"
        subtitle={`${comp.name} · ${formatDate(comp.date)}`}
        onBack={onBack}
        right={
          <Badge className={complete ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}>
            {complete ? "все матчи сыграны" : regularFinals(currentMatches).length ? matchTitle(regularFinals(currentMatches)[0], total) : "Матч за 3-е место"}
          </Badge>
        }
      />

      {champion && <ChampionBanner comp={{ ...view, champion, runnerUp }} />}

      {!complete && (
        <div className="mt-4 space-y-4">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-amber-300">
            Матч до 2 побед (не более 3 раундов)
          </p>
          {currentMatches.map((m) => (
            <PlayoffMatchCard
              key={m.id}
              comp={comp}
              m={m}
              title={matchTitle(m, total)}
              busy={busy}
              onRound={(r) => addRound(m, r)}
              onWarn={(s) => warn(m, s)}
              onViolation={(s) => violation(m, s)}
              onForfeit={(s) => forfeit(m, s)}
              onJudges={(s) => judgesDecision(m, s)}
              onReplay={() => replay(m)}
              onUndo={() => undoLast(m)}
              onReset={() => confirm("Сбросить весь матч?") && resetMatch(m)}
            />
          ))}
        </div>
      )}

      <Card className="mt-4">
        <h4 className="mb-3 font-bold text-white">Сетка плей-офф</h4>
        <BracketView comp={view} />
      </Card>

      {complete && (
        <div className="mt-4">
          <FinalPlacements comp={{ ...view, champion, runnerUp }} />
        </div>
      )}

      {complete && comp.stage !== "finished" && (
        <div className="mt-4 space-y-2">
          <Button size="lg" variant="success" className="w-full" onClick={finishCompetition} disabled={busy}>
            🏁 Завершить соревнование
          </Button>
          {lastDecided && (
            <Button variant="ghost" className="w-full" onClick={() => undoLast(lastDecided)} disabled={busy}>
              ↶ Отменить последний результат ({matchTitle(lastDecided, total)})
            </Button>
          )}
        </div>
      )}
      {comp.stage === "finished" && <p className="mt-4 text-center text-sm text-emerald-300">Соревнование завершено ✓</p>}
    </div>
  );
}

function PlayoffMatchCard({
  comp,
  m,
  title,
  busy,
  onRound,
  onWarn,
  onViolation,
  onForfeit,
  onJudges,
  onReplay,
  onUndo,
  onReset,
}: {
  comp: Competition;
  m: Match;
  title: string;
  busy: boolean;
  onRound: (r: RoundResult) => void;
  onWarn: (s: "a" | "b") => void;
  onViolation: (s: "a" | "b") => void;
  onForfeit: (s: "a" | "b") => void;
  onJudges: (s: "a" | "b") => void;
  onReplay: () => void;
  onUndo: () => void;
  onReset: () => void;
}) {
  const st = evalPlayoff(m);
  const done = !!m.winner;
  const phaseText = done
    ? `Победитель: ${teamName(comp, m.winner)}`
    : st.phase === "extra"
      ? "Равенство баллов — дополнительный раунд"
      : st.phase === "judges"
        ? "Решение судей (тактика, агрессия, активность)"
        : `Раунд ${st.regularPlayed + 1} из 3`;

  return (
    <Card className={cn("border-amber-400/40", m.third && "border-orange-500/40", done && "border-emerald-600/50")}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={cn("text-sm font-black uppercase", m.third ? "text-orange-300" : "text-amber-300")}>
          {m.third ? "🥉 " : "🏆 "}
          {title}
        </span>
        <span className={cn("text-right text-xs font-semibold", done ? "text-emerald-300" : "text-slate-300")}>{phaseText}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
        {(["a", "b"] as const).map((side, i) => {
          const warns = side === "a" ? m.warnA ?? 0 : m.warnB ?? 0;
          const node = (
            <div key={side} className="min-w-0 space-y-2 text-center">
              <p className={cn("break-words text-base font-black sm:text-lg", m.winner === m[side] ? "text-emerald-300" : "text-white")}>
                {m.winner === m[side] && "🏅 "}
                {teamName(comp, m[side])}
              </p>
              {!done && (
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                  <Button size="sm" variant="secondary" className="px-1.5" disabled={busy} onClick={() => onWarn(side)}>
                    ⚠️ {warns}/2
                  </Button>
                  <Button size="sm" variant="secondary" className="px-1.5" disabled={busy} onClick={() => onViolation(side)}>
                    ❗ Наруш.
                  </Button>
                  <Button size="sm" variant="ghost" className="px-1.5" disabled={busy} onClick={() => onForfeit(side)}>
                    🚫 Неявка
                  </Button>
                </div>
              )}
            </div>
          );
          return i === 0
            ? [
                node,
                <div key="score" className="px-1 text-center">
                  <p className="text-3xl font-black text-amber-300">
                    {m.scoreA ?? st.scoreA}:{m.scoreB ?? st.scoreB}
                  </p>
                  {((m.bonusA ?? 0) > 0 || (m.bonusB ?? 0) > 0) && (
                    <p className="text-[10px] text-slate-500">
                      нарушения {m.bonusA ?? 0}:{m.bonusB ?? 0}
                    </p>
                  )}
                </div>,
              ]
            : node;
        })}
      </div>

      <RoundDots match={m} />

      {!done && st.phase !== "judges" && (
        <div className="mt-4 space-y-2">
          <p className="text-center text-xs text-slate-400">
            {st.phase === "extra" ? "Кто выиграл дополнительный раунд?" : "Кто выиграл раунд?"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" className="h-16 whitespace-normal" disabled={busy} onClick={() => onRound("a")}>
              {teamName(comp, m.a)}
            </Button>
            <Button size="lg" className="h-16 whitespace-normal" disabled={busy} onClick={() => onRound("b")}>
              {teamName(comp, m.b)}
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="secondary" disabled={busy || (m.replays ?? 0) >= 3} onClick={onReplay}>
              🔁 Переигровка {m.replays ?? 0}/3
            </Button>
            <Button size="sm" variant={(m.replays ?? 0) >= 3 ? "primary" : "ghost"} disabled={busy} onClick={() => onRound("none")}>
              🤝 Раунд без результата
            </Button>
          </div>
        </div>
      )}

      {!done && st.phase === "judges" && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["a", "b"] as const).map((s) => (
            <Button key={s} size="lg" variant="success" className="h-16 whitespace-normal" disabled={busy} onClick={() => onJudges(s)}>
              ⚖️ {teamName(comp, m[s])}
            </Button>
          ))}
        </div>
      )}

      {done && m.method && m.method !== "normal" && (
        <p className="mt-2 text-center text-xs text-slate-400">{METHOD_LABEL[m.method]}</p>
      )}

      <div className="mt-3 flex justify-between">
        <Button size="sm" variant="ghost" disabled={busy || (!(m.rounds ?? []).length && !m.winner)} onClick={onUndo}>
          ↶ Отменить последний раунд
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onReset}>
          ↺ Сбросить матч
        </Button>
      </div>
    </Card>
  );
}

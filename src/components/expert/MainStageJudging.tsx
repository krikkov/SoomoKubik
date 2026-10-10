import { useMemo, useState } from "react";
import { Badge, Button, Card, Label, Modal, PageTitle } from "@/ui/kit";
import { useToast } from "@/ui/toast";
import { AllStandings, METHOD_LABEL, TableSchedule } from "../Shared";
import { formatDate } from "../ViewerScreen";
import type { Competition, Match, MatchPatch, WinMethod } from "@/lib/types";
import {
  canPostpone,
  generateBracket,
  isDone,
  mainStageDone,
  matchesOf,
  pickFinalists,
  postponePatches,
  roundDone,
  roundsOfTable,
  seedOrderList,
  seedPositions,
  standings,
  teamName,
} from "@/lib/tournament";
import { cn } from "@/utils/cn";

const RESET: Partial<Match> = {
  winner: null,
  draw: false,
  scoreA: null,
  scoreB: null,
  method: null,
  warnA: 0,
  warnB: 0,
  replays: 0,
  finishedAt: null,
  judge: null,
};

export function MainStageJudging({
  comp,
  judge,
  onBack,
  onSave,
  onPatch,
  busy,
}: {
  comp: Competition;
  judge: string;
  onBack: () => void;
  onSave: (c: Competition) => Promise<void> | void;
  onPatch: (patches: MatchPatch[]) => Promise<void> | void;
  busy: boolean;
}) {
  const [table, setTable] = useState(1);
  const [round, setRound] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showStandings, setShowStandings] = useState(false);
  const [finalModal, setFinalModal] = useState(false);

  const rounds = roundsOfTable(comp, table);
  const list = matchesOf(comp, table, round);
  const selected = comp.matches.find((m) => m.id === selectedId) ?? null;
  const allDone = mainStageDone(comp);
  const thisRoundDone = roundDone(comp, table, round);
  const nextUnfinished = useMemo(() => list.find((m) => !isDone(m)) ?? null, [list]);
  const lastRound = rounds[rounds.length - 1];

  const toast = useToast();
  const patch = (m: Match, p: Partial<Match>) => onPatch([{ id: m.id, patch: p }]);
  const other = (side: "a" | "b") => (side === "a" ? "b" : "a");

  function win(m: Match, side: "a" | "b", method: WinMethod = "normal", extra: Partial<Match> = {}) {
    if (method === "normal") toast(`🏅 Победа: ${teamName(comp, m[side])} (1:0)`, "success");
    return patch(m, {
      winner: m[side],
      draw: false,
      scoreA: side === "a" ? 1 : 0,
      scoreB: side === "b" ? 1 : 0,
      method,
      finishedAt: new Date().toISOString(),
      judge,
      ...extra,
    });
  }

  function draw(m: Match) {
    toast("🤝 Результат раунда не определён — баллы не начислены (ничья 0:0)", "info");
    return patch(m, {
      winner: null,
      draw: true,
      scoreA: 0,
      scoreB: 0,
      method: "draw",
      finishedAt: new Date().toISOString(),
      judge,
    });
  }

  function warn(m: Match, side: "a" | "b") {
    const key = side === "a" ? "warnA" : "warnB";
    const w = (m[key] ?? 0) + 1;
    if (w >= 2) {
      toast(
        `⚠️ Второе предупреждение «${teamName(comp, m[side])}» — балл и победа «${teamName(comp, m[other(side)])}»`,
        "warning",
        3500,
      );
      return win(m, other(side), "penalty", { [key]: 2 });
    }
    toast(`⚠️ Предупреждение команде «${teamName(comp, m[side])}» (1 из 2)`, "warning");
    return patch(m, { [key]: w });
  }

  function violation(m: Match, side: "a" | "b") {
    toast(
      `❗ Нарушение «${teamName(comp, m[side])}» — балл и победа «${teamName(comp, m[other(side)])}»`,
      "danger",
      3500,
    );
    return win(m, other(side), "penalty");
  }

  function forfeit(m: Match, absent: "a" | "b") {
    toast(`🚫 Неявка «${teamName(comp, m[absent])}» — тех. победа «${teamName(comp, m[other(absent)])}» 1:0`, "danger", 3500);
    return win(m, other(absent), "forfeit");
  }

  function replay(m: Match) {
    const n = Math.min(3, (m.replays ?? 0) + 1);
    toast(
      n >= 3 ? "🔁 Третья переигровка. Если результата нет — «Без результата (0:0)»" : `🔁 Переигровка раунда (${n} из 3)`,
      "info",
    );
    return patch(m, { replays: n });
  }

  function resetMatch(m: Match) {
    toast("↺ Результат сражения сброшен", "info");
    return patch(m, RESET);
  }

  async function postpone(m: Match) {
    const p = postponePatches(comp, m);
    if (!p) return;
    toast("⏭ Сражение перенесено после следующего", "info");
    await onPatch(p);
    const nextId = p[1].id;
    setSelectedId(nextId);
  }

  function goNextMatch() {
    const idx = list.findIndex((m) => m.id === selectedId);
    const next = list.slice(idx + 1).find((m) => !isDone(m)) ?? list.find((m) => !isDone(m));
    setSelectedId(next?.id ?? null);
  }

  function goNextRound() {
    const next = rounds[rounds.indexOf(round) + 1];
    if (next) {
      setRound(next);
      setSelectedId(matchesOf(comp, table, next).find((m) => !isDone(m))?.id ?? null);
    } else setSelectedId(null);
  }

  const selIdx = selected ? list.findIndex((m) => m.id === selected.id) : -1;

  return (
    <div className="pb-4">
      <PageTitle
        title="Основной этап"
        subtitle={`${comp.name} · ${formatDate(comp.date)}`}
        onBack={onBack}
        right={
          <Badge className={allDone ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}>
            {comp.matches.filter(isDone).length}/{comp.matches.length} сражений
          </Badge>
        }
      />

      {comp.tables > 1 && (
        <div className="mb-3 flex gap-2">
          {Array.from({ length: comp.tables }, (_, i) => i + 1).map((t) => (
            <Button
              key={t}
              variant={table === t ? "primary" : "secondary"}
              onClick={() => {
                setTable(t);
                setRound(1);
                setSelectedId(null);
              }}
            >
              🎯 Стол {t}
            </Button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {rounds.map((r) => (
          <button
            key={r}
            onClick={() => {
              setRound(r);
              setSelectedId(null);
            }}
            className={cn(
              "shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition",
              round === r
                ? "border-amber-400 bg-amber-400/10 text-amber-300"
                : roundDone(comp, table, r)
                  ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-300"
                  : "border-slate-700 bg-slate-900/60 text-slate-300",
            )}
          >
            Тур {r} {roundDone(comp, table, r) ? "✓" : ""}
          </button>
        ))}
      </div>

      {selected ? (
        <Card className="mb-4 border-amber-400/50">
          <p className="mb-1 text-center text-xs uppercase tracking-[0.2em] text-amber-300">
            Стол {table} · Тур {round} · Сражение {selIdx + 1} из {list.length}
          </p>
          <p className="mb-3 text-center text-xs text-slate-400">
            1 раунд до 30 с или до 1 балла · нажмите на команду-победителя
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["a", "b"] as const).map((side) => {
              const id = selected[side];
              const isWinner = !!selected.winner && selected.winner === id;
              const warns = side === "a" ? selected.warnA ?? 0 : selected.warnB ?? 0;
              return (
                <div key={side} className="space-y-2">
                  <Button
                    size="xl"
                    variant={isWinner ? "success" : "secondary"}
                    className="h-24 w-full whitespace-normal text-center"
                    disabled={busy || !id || isDone(selected)}
                    onClick={() => win(selected, side)}
                  >
                    {isWinner && "🏅 "}
                    {teamName(comp, id)}
                  </Button>
                  {!isDone(selected) && (
                    <div className="grid grid-cols-3 gap-1.5">
                      <Button size="sm" variant="secondary" className="px-1.5" disabled={busy} onClick={() => warn(selected, side)}>
                        ⚠️ {warns}/2
                      </Button>
                      <Button size="sm" variant="secondary" className="px-1.5" disabled={busy} onClick={() => violation(selected, side)}>
                        ❗ Наруш.
                      </Button>
                      <Button size="sm" variant="ghost" className="px-1.5" disabled={busy} onClick={() => forfeit(selected, side)}>
                        🚫 Неявка
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!isDone(selected) && (
            <p className="mt-2 text-center text-[11px] text-slate-500">
              ⚠️ предупреждение (2 = балл сопернику) · ❗ нарушение — балл сопернику · 🚫 неявка — тех. победа соперника
            </p>
          )}

          {isDone(selected) ? (
            <p className="mt-3 text-center text-xs text-slate-400">
              {selected.draw ? "🤝 Ничья 0:0" : `Счёт ${selected.scoreA}:${selected.scoreB}`}
              {selected.method && selected.method !== "normal" && selected.method !== "draw" ? ` · ${METHOD_LABEL[selected.method]}` : ""}
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || (selected.replays ?? 0) >= 3}
                onClick={() => replay(selected)}
              >
                🔁 Переигровка {selected.replays ?? 0}/3
              </Button>
              <Button
                variant={(selected.replays ?? 0) >= 3 ? "primary" : "ghost"}
                size="sm"
                disabled={busy}
                onClick={() => draw(selected)}
              >
                🤝 Без результата (0:0)
              </Button>
              {canPostpone(comp, selected) && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => postpone(selected)}>
                  ⏭ Перенести после следующего
                </Button>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(isDone(selected) || (selected.warnA ?? 0) > 0 || (selected.warnB ?? 0) > 0 || (selected.replays ?? 0) > 0) && (
              <Button variant="ghost" size="sm" onClick={() => resetMatch(selected)} disabled={busy}>
                ↺ Сбросить сражение
              </Button>
            )}
            <div className="flex-1" />
            {isDone(selected) &&
              (thisRoundDone ? (
                round !== lastRound ? (
                  <Button size="lg" onClick={goNextRound} disabled={busy}>
                    ✅ Завершить тур {round} и перейти к следующему →
                  </Button>
                ) : (
                  <Badge className="bg-emerald-500/20 px-3 py-2 text-emerald-300">Последний тур стола завершён ✓</Badge>
                )
              ) : (
                <Button size="lg" onClick={goNextMatch} disabled={busy}>
                  Следующее сражение →
                </Button>
              ))}
          </div>
        </Card>
      ) : (
        <Card className="mb-4 text-center text-slate-400">
          {thisRoundDone ? (
            <div className="space-y-3">
              <p className="font-semibold text-emerald-300">Тур {round} завершён ✓</p>
              {round !== lastRound && <Button onClick={goNextRound}>Перейти к туру {rounds[rounds.indexOf(round) + 1]} →</Button>}
            </div>
          ) : (
            <div className="space-y-3">
              <p>Выберите сражение из списка ниже</p>
              {nextUnfinished && (
                <Button onClick={() => setSelectedId(nextUnfinished.id)}>
                  ▶ Начать: {teamName(comp, nextUnfinished.a)} vs {teamName(comp, nextUnfinished.b)}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="space-y-2">
        {list.map((m, i) => (
          <button key={m.id} onClick={() => setSelectedId(m.id)} className="w-full text-left">
            <div
              className={cn(
                "rounded-xl border p-3 transition",
                selectedId === m.id
                  ? "border-amber-400 bg-amber-400/5"
                  : isDone(m)
                    ? "border-emerald-800/50 bg-emerald-950/20"
                    : "border-slate-700 bg-slate-900/60 hover:border-slate-500",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-xs font-bold text-slate-500">#{i + 1}</span>
                <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-center gap-1 text-sm font-semibold">
                  <span
                    className={cn(
                      "break-words text-center",
                      m.winner && m.winner === m.a ? "text-emerald-300" : m.winner ? "text-slate-500" : "text-white",
                    )}
                  >
                    {m.winner === m.a && "🏅 "}
                    {teamName(comp, m.a)}
                  </span>
                  <span className="text-center text-xs text-slate-500">{isDone(m) ? `${m.scoreA}:${m.scoreB}` : "vs"}</span>
                  <span
                    className={cn(
                      "break-words text-center",
                      m.winner && m.winner === m.b ? "text-emerald-300" : m.winner ? "text-slate-500" : "text-white",
                    )}
                  >
                    {m.winner === m.b && "🏅 "}
                    {teamName(comp, m.b)}
                  </span>
                </div>
                <span className="w-6 shrink-0 text-right text-xs text-amber-300/80">{m.postponed && !isDone(m) ? "⏭" : ""}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        <Button variant="secondary" className="w-full" onClick={() => setShowStandings((v) => !v)}>
          📊 {showStandings ? "Скрыть" : "Показать"} турнирную таблицу
        </Button>
        {showStandings && (
          <Card>
            <AllStandings comp={comp} />
          </Card>
        )}
        <Button size="lg" variant="success" className="w-full" disabled={!allDone || busy} onClick={() => setFinalModal(true)}>
          🏁 Завершить основной этап и определить лидеров
        </Button>
        {!allDone && (
          <p className="text-center text-xs text-slate-500">Кнопка станет активной, когда будут внесены результаты всех сражений на всех столах</p>
        )}
      </div>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-slate-400">Полная схема туров стола {table}</summary>
        <div className="mt-3">
          <TableSchedule
            comp={comp}
            table={table}
            onPickMatch={(m) => {
              setRound(m.round);
              setSelectedId(m.id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      </details>

      {finalModal && (
        <FinalistsModal
          comp={comp}
          busy={busy}
          onClose={() => setFinalModal(false)}
          onConfirm={async (seeded) => {
            await onSave({
              ...comp,
              stage: "final",
              finalists: seeded,
              finalistsCount: seeded.length,
              finalMatches: generateBracket(seeded),
            });
            setFinalModal(false);
          }}
        />
      )}
    </div>
  );
}

function FinalistsModal({
  comp,
  busy,
  onClose,
  onConfirm,
}: {
  comp: Competition;
  busy: boolean;
  onClose: () => void;
  onConfirm: (seeded: string[]) => void;
}) {
  const maxCount = comp.teams.length;
  const [count, setCount] = useState(Math.min(4, maxCount));
  const [manual, setManual] = useState<string[] | null>(null);

  const chosen = manual ?? pickFinalists(comp, count);
  const seeded = seedOrderList(comp, chosen);
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(2, seeded.length))));
  const positions = seedPositions(size);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < positions.length; i += 2) pairs.push([positions[i], positions[i + 1]]);

  function toggle(id: string) {
    const base = manual ?? chosen;
    setManual(base.includes(id) ? base.filter((x) => x !== id) : [...base, id]);
  }

  return (
    <Modal open onClose={onClose} title="Лидеры основного этапа → финал" wide>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Label className="mb-0">Команд в финале</Label>
        <Button size="sm" variant="secondary" onClick={() => { setManual(null); setCount((c) => Math.max(2, c - 1)); }}>
          −
        </Button>
        <span className="w-8 text-center text-xl font-bold text-white">{manual ? chosen.length : count}</span>
        <Button size="sm" variant="secondary" onClick={() => { setManual(null); setCount((c) => Math.min(maxCount, c + 1)); }}>
          +
        </Button>
        {[4, 8].filter((n) => n <= maxCount).map((n) => (
          <Button key={n} size="sm" variant={!manual && count === n ? "primary" : "ghost"} onClick={() => { setManual(null); setCount(n); }}>
            {n}
          </Button>
        ))}
        {manual && (
          <Button size="sm" variant="ghost" onClick={() => setManual(null)}>
            ↺ авто
          </Button>
        )}
      </div>

      <p className="mb-3 text-sm text-slate-400">
        {comp.tables > 1
          ? `Автовыбор: по ${Math.floor(count / comp.tables)} лучших с каждого стола${count % comp.tables ? ", остаток — лучшие из оставшихся" : ""}. `
          : "Автовыбор: лучшие команды по турнирной таблице. "}
        Нажмите на команду, чтобы вручную добавить/убрать её.
      </p>

      <div className={cn("mb-4 grid gap-3", comp.tables > 1 && "md:grid-cols-2")}>
        {Array.from({ length: Math.max(1, comp.tables) }, (_, i) => i + 1).map((t) => (
          <Card key={t} className="p-3">
            {comp.tables > 1 && <p className="mb-2 text-sm font-bold text-amber-300">Стол {t}</p>}
            <div className="space-y-1">
              {standings(comp, comp.tables > 1 ? t : undefined)
                .map((r) => r.teamId)
                .map((id, idx) => (
                  <button
                    key={id}
                    onClick={() => toggle(id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                      chosen.includes(id) ? "border-emerald-500/60 bg-emerald-950/40 text-white" : "border-slate-700 text-slate-400",
                    )}
                  >
                    <span>
                      <b className="mr-2 text-slate-500">{idx + 1}</b>
                      {teamName(comp, id)}
                    </span>
                    <span>{chosen.includes(id) ? "✓ финал" : ""}</span>
                  </button>
                ))}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mb-4 p-3">
        <p className="mb-2 text-sm font-bold text-white">Посев и первые пары («лучший с худшим»)</p>
        <ol className="mb-3 grid gap-1 text-sm text-slate-300 sm:grid-cols-2">
          {seeded.map((id, i) => (
            <li key={id}>
              <b className="text-amber-300">{i + 1}.</b> {teamName(comp, id)}
            </li>
          ))}
        </ol>
        <div className="space-y-1 text-sm">
          {pairs.map(([s1, s2]) => (
            <p key={`${s1}-${s2}`} className="text-slate-300">
              <b className="text-amber-300">{s1}</b> {teamName(comp, seeded[s1 - 1])} <span className="text-slate-500">vs</span>{" "}
              <b className="text-amber-300">{s2}</b> {seeded[s2 - 1] ? teamName(comp, seeded[s2 - 1]) : <i className="text-slate-500">проход без боя</i>}
            </p>
          ))}
        </div>
      </Card>

      <Button className="w-full" size="lg" onClick={() => onConfirm(seeded)} disabled={busy || seeded.length < 2}>
        🏆 Сформировать финальную сетку
      </Button>
    </Modal>
  );
}

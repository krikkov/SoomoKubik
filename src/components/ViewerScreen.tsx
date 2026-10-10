import { useState } from "react";
import { Badge, Button, Card, PageTitle, Spinner } from "@/ui/kit";
import { AllStandings, BracketView, ChampionBanner, FinalPlacements, TableSchedule } from "./Shared";
import { finalsComplete, teamName } from "@/lib/tournament";
import type { Competition } from "@/lib/types";
import { cn } from "@/utils/cn";

const STAGE_LABEL: Record<Competition["stage"], string> = {
  registration: "Регистрация команд",
  main: "Основной этап",
  final: "Финал",
  finished: "Завершено",
};

export function CompetitionPicker({
  competitions,
  loading,
  onSelect,
  onBack,
  onRefresh,
  title,
  emptyHint,
}: {
  competitions: Competition[];
  loading: boolean;
  onSelect: (c: Competition) => void;
  onBack: () => void;
  onRefresh: () => void;
  title: string;
  emptyHint: string;
}) {
  const sorted = [...competitions].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div>
      <PageTitle
        title={title}
        subtitle="Выберите соревнование"
        onBack={onBack}
        right={
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            ⟳ Обновить
          </Button>
        }
      />
      {loading && !sorted.length ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((c) => (
            <button key={c.id} onClick={() => onSelect(c)} className="text-left">
              <Card className="h-full transition hover:border-amber-400/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{c.name}</h3>
                    <p className="text-sm text-slate-400">
                      📅 {formatDate(c.date)} · 👥 {c.teams.length} команд
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      c.stage === "finished" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300",
                    )}
                  >
                    {STAGE_LABEL[c.stage]}
                  </Badge>
                </div>
                {c.champion && (
                  <p className="mt-3 text-sm font-semibold text-amber-300">🏆 {teamName(c, c.champion)}</p>
                )}
              </Card>
            </button>
          ))}
          {!sorted.length && <Card className="sm:col-span-2 text-center text-slate-400">{emptyHint}</Card>}
        </div>
      )}
    </div>
  );
}

export function formatDate(d: string): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

export function ViewerCompetition({ comp, onBack }: { comp: Competition; onBack: () => void }) {
  const [mode, setMode] = useState<"menu" | "main" | "final">("menu");
  const [table, setTable] = useState(1);
  const [showStandings, setShowStandings] = useState(false);

  if (mode === "menu") {
    return (
      <div>
        <PageTitle title={comp.name} subtitle={`${formatDate(comp.date)} · ${STAGE_LABEL[comp.stage]}`} onBack={onBack} />
        <ChampionBanner comp={comp} />
        {comp.stage === "finished" && (
          <div className="mt-4">
            <FinalPlacements comp={comp} />
          </div>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Button size="xl" className="h-32 flex-col" onClick={() => setMode("main")}>
            <span className="text-3xl">⚔️</span>
            ОСНОВНОЙ ЭТАП
          </Button>
          <Button size="xl" variant="secondary" className="h-32 flex-col" onClick={() => setMode("final")}>
            <span className="text-3xl">🏆</span>
            ФИНАЛ
          </Button>
        </div>
        <Card className="mt-4">
          <h4 className="mb-2 font-bold text-white">Команды ({comp.teams.length})</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {comp.teams.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-2.5">
                <p className="font-semibold text-white">
                  {t.name} {comp.tables > 1 && t.table ? <span className="text-xs text-slate-500">· стол {t.table}</span> : null}
                </p>
                <p className="text-xs text-slate-400">{t.members.filter(Boolean).join(", ") || "состав не указан"}</p>
              </div>
            ))}
            {!comp.teams.length && <p className="text-slate-400">Регистрация ещё идёт…</p>}
          </div>
        </Card>
      </div>
    );
  }

  if (mode === "main") {
    return (
      <div className="pb-24">
        <PageTitle title="Основной этап" subtitle={comp.name} onBack={() => setMode("menu")} />
        {comp.tables > 1 ? (
          <>
            <div className={cn("hidden gap-4 lg:grid", comp.tables === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3")}>
              {Array.from({ length: comp.tables }, (_, i) => i + 1).map((t) => (
                <div key={t}>
                  <p className="mb-2 text-center text-sm font-black uppercase tracking-wide text-amber-300">🎯 Стол {t}</p>
                  <TableSchedule comp={comp} table={t} />
                </div>
              ))}
            </div>
            <div className="lg:hidden">
              <div className="mb-4 flex gap-2">
                {Array.from({ length: comp.tables }, (_, i) => i + 1).map((t) => (
                  <Button key={t} variant={table === t ? "primary" : "secondary"} onClick={() => setTable(t)}>
                    Стол {t}
                  </Button>
                ))}
              </div>
              <TableSchedule comp={comp} table={table} />
            </div>
          </>
        ) : (
          <TableSchedule comp={comp} table={1} />
        )}

        {showStandings && (
          <Card className="mt-4">
            <h4 className="mb-3 text-lg font-bold text-white">Турнирная таблица</h4>
            <AllStandings comp={comp} />
          </Card>
        )}

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/90 p-3 backdrop-blur">
          <div className="mx-auto max-w-5xl">
            <Button className="w-full" size="lg" onClick={() => setShowStandings((v) => !v)}>
              📊 {showStandings ? "Скрыть турнирную таблицу" : "Турнирная таблица"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const complete = finalsComplete(comp);
  return (
    <div>
      <PageTitle title="Финал" subtitle={comp.name} onBack={() => setMode("menu")} />
      <ChampionBanner comp={comp} />
      <Card className="mt-4">
        <h4 className="mb-3 font-bold text-white">Сетка плей-офф</h4>
        <BracketView comp={comp} />
      </Card>
      {complete && (
        <div className="mt-4">
          <FinalPlacements comp={comp} />
        </div>
      )}
      {!complete && comp.finalMatches.length > 0 && (
        <p className="mt-4 text-center text-sm text-slate-400">Итоговые места появятся после последнего матча</p>
      )}
    </div>
  );
}

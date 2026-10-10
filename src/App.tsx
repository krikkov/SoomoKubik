import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Spinner } from "@/ui/kit";
import { CompetitionPicker, ViewerCompetition } from "@/components/ViewerScreen";
import { ExpertLogin, ExpertWorkspace } from "@/components/ExpertScreen";
import { SettingsModal } from "@/components/SettingsModal";
import {
  deleteCompetition,
  isRemote,
  listCompetitions,
  patchCompetition,
  saveCompetition,
  type PatchPayload,
} from "@/lib/storage";
import { applyPatches } from "@/lib/tournament";
import { currentExpert, logout, type Expert } from "@/lib/auth";
import { REFRESH_INTERVAL } from "@/config";
import type { Competition, MatchPatch } from "@/lib/types";

type View = "home" | "viewer" | "expert";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expert, setExpert] = useState<Expert | null>(currentExpert());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [remote, setRemote] = useState(isRemote());
  const busyRef = useRef(false);
  const lastWriteRef = useRef(0);
  const failuresRef = useRef(0);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const startedAt = Date.now();
    try {
      const list = await listCompetitions();
      if (busyRef.current || lastWriteRef.current > startedAt) return;
      setCompetitions(list);
      failuresRef.current = 0;
      setError("");
    } catch (e) {
      failuresRef.current++;
      if (failuresRef.current >= 3) setError((e as Error).message);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, remote]);

  useEffect(() => {
    const tick = () => {
      if (document.hidden || busyRef.current) return;
      const slowdown = Math.min(failuresRef.current, 4);
      if (slowdown > 0 && Date.now() % (REFRESH_INTERVAL * (slowdown + 1)) > REFRESH_INTERVAL) return;
      refresh();
    };
    const id = window.setInterval(tick, REFRESH_INTERVAL);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  const selected = competitions.find((c) => c.id === selectedId) ?? null;

  const mergeLocal = (comp: Competition) =>
    setCompetitions((prev) => {
      const idx = prev.findIndex((c) => c.id === comp.id);
      if (idx < 0) return [...prev, comp];
      const copy = [...prev];
      copy[idx] = comp;
      return copy;
    });

  const handleSave = useCallback(async (comp: Competition) => {
    setBusy(true);
    busyRef.current = true;
    mergeLocal(comp);
    try {
      const saved = await saveCompetition(comp);
      mergeLocal(saved);
      failuresRef.current = 0;
      lastWriteRef.current = Date.now();
      setError("");
    } catch (e) {
      lastWriteRef.current = Date.now() + 20000;
      setError("Не удалось сохранить в таблицу: " + (e as Error).message);
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }, []);

  const handlePatch = useCallback(
    async (comp: Competition, patches: MatchPatch[], extra?: PatchPayload["extra"]) => {
      const stamped = patches.map((p) => ({ ...p, patch: { ...p.patch } }));
      const updated: Competition = { ...applyPatches(comp, stamped), ...(extra ?? {}) };
      setBusy(true);
      busyRef.current = true;
      mergeLocal(updated);
      try {
        const saved = await patchCompetition({ compId: comp.id, patches: stamped, extra }, updated);
        mergeLocal(saved);
        failuresRef.current = 0;
        lastWriteRef.current = Date.now();
        setError("");
      } catch (e) {
        lastWriteRef.current = Date.now() + 20000;
        setError("Результат не записан в таблицу: " + (e as Error).message);
      } finally {
        setBusy(false);
        busyRef.current = false;
      }
    },
    [],
  );

  const handleDelete = useCallback(async (id: string) => {
    setBusy(true);
    try {
      await deleteCompetition(id);
      setCompetitions((prev) => prev.filter((c) => c.id !== id));
      setSelectedId(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(251,146,60,0.12),transparent),radial-gradient(50rem_35rem_at_0%_10%,rgba(56,189,248,0.10),transparent)] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button className="flex items-center gap-2" onClick={() => { setView("home"); setSelectedId(null); }}>
            <span className="text-2xl">🤖</span>
            <div className="text-left">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-white">КУБИК</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">судейство · механическое сумо 15×15</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />}
            <Badge
              className={
                !remote
                  ? "bg-slate-700/60 text-slate-300"
                  : error
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-emerald-500/20 text-emerald-300"
              }
            >
              {!remote ? "Локальный режим" : error ? "● нет связи" : "● онлайн"}
            </Badge>
            {expert && (
              <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} title="База данных">
                ⚙️
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {error && (
          <Card className="mb-4 border-rose-700/60 bg-rose-950/40 text-sm text-rose-200">
            ⚠️ Нет связи с базой данных. Проверьте интернет — данные обновятся автоматически.
            <span className="block text-xs text-rose-300/70">{error}</span>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => refresh()}>
              Повторить
            </Button>
          </Card>
        )}

        {view === "home" && (
          <HomeScreen
            onViewer={() => setView("viewer")}
            onExpert={() => setView("expert")}
            competitions={competitions}
            loading={loading}
          />
        )}

        {view === "viewer" &&
          (selected ? (
            <ViewerCompetition comp={selected} onBack={() => setSelectedId(null)} />
          ) : (
            <CompetitionPicker
              competitions={competitions}
              loading={loading}
              onSelect={(c) => setSelectedId(c.id)}
              onBack={() => setView("home")}
              onRefresh={refresh}
              title="Соревнования"
              emptyHint="Соревнования ещё не созданы"
            />
          ))}

        {view === "expert" &&
          (expert ? (
            <ExpertWorkspace
              expert={expert}
              competitions={competitions}
              loading={loading}
              onRefresh={refresh}
              onSave={handleSave}
              onPatch={handlePatch}
              onDelete={handleDelete}
              onExit={() => { setView("home"); setSelectedId(null); }}
              onLogout={() => { logout(); setExpert(null); setSelectedId(null); }}
              busy={busy}
              selected={selected}
              setSelected={(c) => setSelectedId(c?.id ?? null)}
            />
          ) : (
            <ExpertLogin onBack={() => setView("home")} onSuccess={(e) => setExpert(e)} />
          ))}
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-center text-xs text-slate-600">
        КУБИК · механическое сумо 15×15 · результаты хранятся в Google Таблице · данные обновляются автоматически
      </footer>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onChanged={() => {
          setRemote(isRemote());
          setLoading(true);
          refresh();
        }}
      />
    </div>
  );
}

function HomeScreen({
  onViewer,
  onExpert,
  competitions,
  loading,
}: {
  onViewer: () => void;
  onExpert: () => void;
  competitions: Competition[];
  loading: boolean;
}) {
  const live = competitions.filter((c) => c.stage === "main" || c.stage === "final");
  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
          Соревнования <span className="bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">КУБИК</span>
        </h1>
        <p className="mt-2 text-slate-400">Механическое сумо 15×15 · судейство, турнирная сетка и рейтинг в реальном времени</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Button size="xl" className="h-40 flex-col gap-3 text-xl" onClick={onViewer}>
          <span className="text-5xl">🏁</span>
          СОРЕВНОВАНИЯ
          <span className="text-xs font-medium opacity-80">сетка, результаты, рейтинг</span>
        </Button>
        <Button size="xl" variant="secondary" className="h-40 flex-col gap-3 text-xl" onClick={onExpert}>
          <span className="text-5xl">🧑‍⚖️</span>
          ЗАЙТИ КАК ЭКСПЕРТ
          <span className="text-xs font-medium opacity-80">регистрация команд и внесение результатов</span>
        </Button>
      </div>

      <div className="mt-8">
        {loading ? (
          <Spinner />
        ) : live.length > 0 ? (
          <Card className="border-emerald-700/50">
            <p className="mb-2 text-xs uppercase tracking-wide text-emerald-300">Идут сейчас</p>
            <ul className="space-y-1">
              {live.map((c) => (
                <li key={c.id} className="text-sm text-slate-200">
                  🔴 {c.name} — {c.stage === "main" ? "основной этап" : "финал"} · {c.teams.length} команд
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

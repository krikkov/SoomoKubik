import { useState } from "react";
import { Button, Card, Input, Label, Modal, PageTitle } from "@/ui/kit";
import { CompetitionPicker } from "./ViewerScreen";
import { RegistrationStage } from "./expert/RegistrationStage";
import { MainStageJudging } from "./expert/MainStageJudging";
import { FinalJudging } from "./expert/FinalJudging";
import { RulesMemo } from "./RulesMemo";
import type { Competition, MatchPatch } from "@/lib/types";
import type { PatchPayload } from "@/lib/storage";
import { uid } from "@/lib/tournament";
import { EXPERTS, login as doLogin, type Expert } from "@/lib/auth";

export function ExpertLogin({ onBack, onSuccess }: { onBack: () => void; onSuccess: (e: Expert) => void }) {
  const [l, setL] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const expert = doLogin(l, p);
    if (!expert) {
      setErr("Неверный логин или пароль");
      return;
    }
    onSuccess(expert);
  }
  return (
    <div className="mx-auto max-w-sm">
      <PageTitle title="Вход для эксперта" onBack={onBack} />
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Логин</Label>
            <Input
              value={l}
              onChange={(e) => setL(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder="Введите логин"
            />
          </div>
          <div>
            <Label>Пароль</Label>
            <Input type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="Введите пароль" />
          </div>
          {err && <p className="text-sm text-rose-400">{err}</p>}
          <Button type="submit" size="lg" className="w-full">
            Войти
          </Button>
          <p className="text-center text-xs text-slate-500">
            Доступ только для членов экспертной комиссии ({EXPERTS.length} учётные записи)
          </p>
        </form>
      </Card>
    </div>
  );
}

export function ExpertWorkspace({
  expert,
  competitions,
  loading,
  onRefresh,
  onSave,
  onPatch,
  onDelete,
  onExit,
  onLogout,
  busy,
  selected,
  setSelected,
}: {
  expert: Expert;
  competitions: Competition[];
  loading: boolean;
  onRefresh: () => void;
  onSave: (c: Competition) => Promise<void>;
  onPatch: (c: Competition, patches: MatchPatch[], extra?: PatchPayload["extra"]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExit: () => void;
  onLogout: () => void;
  busy: boolean;
  selected: Competition | null;
  setSelected: (c: Competition | null) => void;
}) {
  const [mode, setMode] = useState<"menu" | "pick">("menu");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rulesOpen, setRulesOpen] = useState(false);

  async function createCompetition() {
    if (!name.trim()) return;
    const comp: Competition = {
      id: uid("c"),
      name: name.trim(),
      date,
      stage: "registration",
      tables: 1,
      teams: [],
      matches: [],
      finalMatches: [],
      finalistsCount: 4,
      finalists: [],
      champion: null,
      runnerUp: null,
      createdBy: expert.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSave(comp);
    setSelected(comp);
    setCreateOpen(false);
    setName("");
  }

  if (selected) {
    const back = () => setSelected(null);
    const save = (c: Competition) => onSave(c);
    if (selected.stage === "registration") {
      return <RegistrationStage comp={selected} onBack={back} onSave={save} busy={busy} />;
    }
    if (selected.stage === "main") {
      return (
        <MainStageJudging
          comp={selected}
          judge={expert.name}
          onBack={back}
          onSave={save}
          onPatch={(patches) => onPatch(selected, patches)}
          busy={busy}
        />
      );
    }
    return (
      <FinalJudging
        comp={selected}
        judge={expert.name}
        onBack={back}
        onPatch={(patches, extra) => onPatch(selected, patches, extra)}
        busy={busy}
      />
    );
  }

  if (mode === "pick") {
    return (
      <div>
        <CompetitionPicker
          competitions={competitions}
          loading={loading}
          onSelect={(c) => setSelected(c)}
          onBack={() => setMode("menu")}
          onRefresh={onRefresh}
          title="Существующие соревнования"
          emptyHint="Соревнований пока нет — создайте первое"
        />
        {competitions.length > 0 && (
          <Card className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Удаление</p>
            <div className="flex flex-wrap gap-2">
              {competitions.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (confirm(`Удалить «${c.name}»? Действие необратимо.`)) await onDelete(c.id);
                  }}
                >
                  🗑 {c.name}
                </Button>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title={`Кабинет: ${expert.name}`}
        subtitle="Экспертная комиссия"
        onBack={onExit}
        right={
          <Button variant="ghost" size="sm" onClick={onLogout}>
            Выйти
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Button size="xl" className="h-32 flex-col" onClick={() => setCreateOpen(true)}>
          <span className="text-3xl">➕</span>
          СОЗДАТЬ СОРЕВНОВАНИЕ
        </Button>
        <Button size="xl" variant="secondary" className="h-32 flex-col" onClick={() => setMode("pick")}>
          <span className="text-3xl">📋</span>
          ВЫБРАТЬ СУЩЕСТВУЮЩЕЕ
        </Button>
      </div>

      <Button variant="ghost" className="mt-4 w-full" onClick={() => setRulesOpen(true)}>
        📖 Памятка по регламенту «Механическое сумо 15×15»
      </Button>
      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Памятка эксперта" wide>
        <RulesMemo />
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Новое соревнование">
        <div className="space-y-3">
          <div>
            <Label>Название соревнования</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Введите название соревнования" />
          </div>
          <div>
            <Label>Дата проведения</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <Button className="w-full" size="lg" onClick={createCompetition} disabled={!name.trim() || busy}>
            Создать и перейти к регистрации команд
          </Button>
        </div>
      </Modal>
    </div>
  );
}

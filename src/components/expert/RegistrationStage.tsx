import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Input, Label, Modal, PageTitle } from "@/ui/kit";
import { useToast } from "@/ui/toast";
import { formatDate } from "../ViewerScreen";
import type { Competition, Team } from "@/lib/types";
import { generateMainStage, uid } from "@/lib/tournament";

export function RegistrationStage({
  comp,
  onBack,
  onSave,
  busy,
}: {
  comp: Competition;
  onBack: () => void;
  onSave: (c: Competition) => Promise<void> | void;
  busy: boolean;
}) {
  const [teamModal, setTeamModal] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>(["", ""]);
  const [tablesModal, setTablesModal] = useState(false);
  const [tables, setTables] = useState(1);
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  function openNew() {
    setEditing(null);
    setName("");
    setMembers(["", ""]);
    setFlash(null);
    setTeamModal(true);
  }
  function openEdit(t: Team) {
    setEditing(t);
    setName(t.name);
    setMembers(t.members.length ? [...t.members] : [""]);
    setFlash(null);
    setTeamModal(true);
  }

  async function submitTeam() {
    const cleanName = name.trim();
    if (!cleanName) return;
    const cleanMembers = members.map((m) => m.trim()).filter(Boolean);
    if (editing) {
      const teams = comp.teams.map((t) => (t.id === editing.id ? { ...t, name: cleanName, members: cleanMembers } : t));
      setTeamModal(false);
      toast(`Команда «${cleanName}» сохранена`, "success");
      await onSave({ ...comp, teams });
      return;
    }
    if (comp.teams.some((t) => t.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      setFlash({ text: `Команда «${cleanName}» уже зарегистрирована`, ok: false });
      return;
    }
    const teams = [...comp.teams, { id: uid("t"), name: cleanName, members: cleanMembers, table: 0 }];
    setName("");
    setMembers(["", ""]);
    setFlash({ text: `✅ Команда «${cleanName}» зарегистрирована (всего: ${teams.length})`, ok: true });
    nameRef.current?.focus();
    await onSave({ ...comp, teams });
  }

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 3000);
    return () => window.clearTimeout(id);
  }, [flash]);

  async function removeTeam(id: string) {
    if (!confirm("Удалить команду?")) return;
    await onSave({ ...comp, teams: comp.teams.filter((t) => t.id !== id) });
  }

  async function generate() {
    const { teams, matches } = generateMainStage(comp.teams, tables);
    await onSave({ ...comp, teams, matches, tables, stage: "main" });
    setTablesModal(false);
  }

  const roundsPreview = (count: number) => (count % 2 === 0 ? Math.max(0, count - 1) : count);

  return (
    <div>
      <PageTitle
        title={comp.name}
        subtitle={`${formatDate(comp.date)} · этап регистрации команд`}
        onBack={onBack}
        right={<Badge className="bg-amber-500/20 text-amber-300">{comp.teams.length} команд</Badge>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={openNew} disabled={busy}>
          ➕ Зарегистрировать команду
        </Button>
        <Button
          size="lg"
          variant="success"
          disabled={comp.teams.length < 2 || busy}
          onClick={() => setTablesModal(true)}
        >
          ✅ Завершить этап регистрации
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {comp.teams.map((t, i) => (
          <Card key={t.id} className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-white">
                <span className="mr-2 text-slate-500">{i + 1}.</span>
                {t.name}
              </p>
              <p className="text-sm text-slate-400">{t.members.join(", ") || "состав не указан"}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                ✏️
              </Button>
              <Button size="sm" variant="ghost" onClick={() => removeTeam(t.id)}>
                🗑
              </Button>
            </div>
          </Card>
        ))}
        {!comp.teams.length && (
          <Card className="text-center text-slate-400 sm:col-span-2">Ещё нет ни одной команды</Card>
        )}
      </div>

      <Modal open={teamModal} onClose={() => setTeamModal(false)} title={editing ? "Изменить команду" : "Новая команда"}>
        <div className="space-y-3">
          {flash && (
            <div
              className={
                "flash-in rounded-xl border px-3 py-2.5 text-sm font-semibold " +
                (flash.ok
                  ? "border-emerald-500/50 bg-emerald-950/60 text-emerald-200"
                  : "border-rose-500/50 bg-rose-950/60 text-rose-200")
              }
            >
              {flash.text}
            </div>
          )}
          <div>
            <Label>Название команды</Label>
            <Input
              ref={nameRef}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название команды"
            />
          </div>
          <div>
            <Label>ФИО участников (не более 2 по регламенту)</Label>
            <div className="space-y-2">
              {members.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={m}
                    onChange={(e) => setMembers(members.map((x, j) => (i === j ? e.target.value : x)))}
                    placeholder={`Участник ${i + 1}`}
                  />
                  <Button variant="ghost" onClick={() => setMembers(members.filter((_, j) => j !== i))}>
                    ×
                  </Button>
                </div>
              ))}
            </div>
            {members.length < 2 && (
              <Button variant="secondary" size="sm" className="mt-2" onClick={() => setMembers([...members, ""])}>
                + участник
              </Button>
            )}
          </div>
          <Button className="w-full" size="lg" onClick={submitTeam} disabled={!name.trim() || busy}>
            {editing ? "Сохранить изменения" : "Сохранить и добавить следующую"}
          </Button>
          {!editing && (
            <Button className="w-full" variant="ghost" onClick={() => setTeamModal(false)}>
              Готово — закрыть окно
            </Button>
          )}
        </div>
      </Modal>

      <Modal open={tablesModal} onClose={() => setTablesModal(false)} title="Количество столов">
        <p className="mb-3 text-sm text-slate-400">
          Команды будут случайно и поровну распределены между столами. На основном этапе команды играют только
          с соперниками своего стола.
        </p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          {[1, 2].map((n) => {
            const per = Math.ceil(comp.teams.length / n);
            return (
              <button key={n} onClick={() => setTables(n)} className="text-left">
                <Card
                  className={
                    tables === n ? "border-amber-400 ring-2 ring-amber-400/40" : "hover:border-slate-500"
                  }
                >
                  <p className="text-lg font-bold text-white">{n} стол{n > 1 ? "а" : ""}</p>
                  <p className="text-xs text-slate-400">
                    ~{per} команд(ы) на стол · {roundsPreview(per)} туров
                  </p>
                </Card>
              </button>
            );
          })}
        </div>
        <Button className="w-full" size="lg" onClick={generate} disabled={busy}>
          🎲 Сгенерировать туры
        </Button>
      </Modal>
    </div>
  );
}

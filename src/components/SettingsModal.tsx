import { useEffect, useState } from "react";
import { Button, Card, Input, Label, Modal } from "@/ui/kit";
import { APPS_SCRIPT_CODE } from "@/lib/appsScript";
import { getApiUrl, getSheetUrl, isApiLocked, pingApi, setApiUrl, setSheetUrl } from "@/lib/storage";

export function SettingsModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const locked = isApiLocked();
  const [api, setApi] = useState(getApiUrl());
  const [sheet, setSheet] = useState(getSheetUrl());
  const [status, setStatus] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  async function check() {
    setStatus("Проверяем связь…");
    const res = await pingApi();
    setStatus((res.ok ? "✅ " : "⚠️ ") + res.message);
  }

  useEffect(() => {
    if (open) check();
  }, [open]);

  async function save() {
    setApiUrl(api);
    setSheetUrl(sheet);
    await check();
    onChanged();
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowCode(true);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="База данных" wide>
      <div className="space-y-4">
        <Card className="border-slate-700 bg-slate-950/50 text-sm text-slate-300">
          <p className="mb-1 font-bold text-white">Google Таблица подключена к проекту</p>
          <p>
            Все устройства (эксперты и участники) автоматически работают с одной общей таблицей. Ничего настраивать не нужно.
          </p>
          {status && <p className="mt-2 font-semibold">{status}</p>}
        </Card>

        {!locked && (
          <>
            <div>
              <Label>URL веб-приложения Apps Script</Label>
              <Input value={api} onChange={(e) => setApi(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" />
            </div>
            <div>
              <Label>Ссылка на Google-таблицу</Label>
              <Input value={sheet} onChange={(e) => setSheet(e.target.value)} />
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          {sheet && (
            <a href={sheet} target="_blank" rel="noreferrer">
              <Button>📊 Открыть таблицу</Button>
            </a>
          )}
          {locked ? (
            <Button variant="secondary" onClick={check}>
              🔄 Проверить связь
            </Button>
          ) : (
            <Button variant="secondary" onClick={save}>
              Сохранить и проверить
            </Button>
          )}
          <Button variant="ghost" onClick={copyCode}>
            {copied ? "✅ Код скопирован" : "📋 Код Apps Script"}
          </Button>
          <Button variant="ghost" onClick={() => setShowCode((v) => !v)}>
            {showCode ? "Скрыть код" : "Показать код"}
          </Button>
        </div>

        {showCode && (
          <pre className="max-h-80 overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
            {APPS_SCRIPT_CODE}
          </pre>
        )}
      </div>
    </Modal>
  );
}

import { useEffect, useState } from "react";

import { getTg } from "../../telegram";
import type { WorkEntry } from "../../types";
import { Button } from "./Button";
import { CompanyAutocomplete } from "./CompanyAutocomplete";
import { TextInput } from "./TextField";
import { VoiceTextArea } from "./VoiceTextArea";

const emptyEntry = (position = ""): WorkEntry => ({
  company: "",
  position,
  period: "",
  duties: "",
});

interface WorkHistoryStepProps {
  entries: WorkEntry[];
  targetPosition: string;
  onChange: (entries: WorkEntry[]) => void;
  onNoExperience: () => void;
}

export function WorkHistoryStep({
  entries,
  targetPosition,
  onChange,
  onNoExperience,
}: WorkHistoryStepProps) {
  const [local, setLocal] = useState<WorkEntry[]>(
    entries.length > 0 ? entries : [emptyEntry(targetPosition)],
  );

  useEffect(() => {
    if (entries.length > 0) {
      setLocal(entries);
    }
  }, [entries]);

  const update = (next: WorkEntry[]) => {
    setLocal(next);
    onChange(next);
  };

  const updateEntry = (index: number, patch: Partial<WorkEntry>) => {
    const next = local.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
    update(next);
  };

  const addEntry = () => {
    if (local.length >= 3) return;
    update([...local, emptyEntry(targetPosition)]);
    getTg()?.HapticFeedback?.impactOccurred("light");
  };

  const removeEntry = (index: number) => {
    if (index === 0) return;
    update(local.filter((_, i) => i !== index));
    getTg()?.HapticFeedback?.impactOccurred("light");
  };

  return (
    <div className="flex flex-col gap-4">
      {local.map((entry, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-xl border p-4"
          style={{ borderColor: "var(--border-subtle)", background: "var(--surface-elevated)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              Место {index + 1}
            </span>
            {index > 0 && (
              <button
                type="button"
                onClick={() => removeEntry(index)}
                className="text-lg leading-none px-2 py-1"
                style={{ color: "var(--text-muted)" }}
                aria-label="Удалить место работы"
              >
                ✕
              </button>
            )}
          </div>
          <CompanyAutocomplete
            value={entry.company}
            onChange={(company) => updateEntry(index, { company })}
            placeholder="Компания"
          />
          <TextInput
            value={entry.period}
            onChange={(e) => updateEntry(index, { period: e.target.value })}
            placeholder="2020–2023"
          />
          <TextInput
            value={entry.position}
            onChange={(e) => updateEntry(index, { position: e.target.value })}
            placeholder="Должность"
          />
          <VoiceTextArea
            fieldId={`work-duties-${index}`}
            value={entry.duties}
            onChange={(duties) => updateEntry(index, { duties })}
            placeholder="Обязанности и достижения"
            rows={4}
            workPeriod={entry.period}
            workCompany={entry.company}
            workPosition={entry.position || targetPosition}
          />
        </div>
      ))}

      {local.length < 3 && (
        <Button variant="outline" onClick={addEntry} className="!min-h-[44px]">
          + Добавить ещё место
        </Button>
      )}

      <Button variant="ghost" onClick={onNoExperience} className="!min-h-[44px] !py-2">
        Нет опыта работы
      </Button>
    </div>
  );
}

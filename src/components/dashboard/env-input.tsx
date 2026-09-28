"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { envToText, parseEnvText } from "@/lib/tables";

/**
 * Поле переменных KEY=VALUE с кнопкой «Upload .env» — как у Vercel: файл
 * разбирается в браузере и сливается с тем, что уже введено (ключи из файла
 * перезаписывают одноимённые). Файл никуда не отправляется, уходят только
 * разобранные пары вместе с формой.
 */
export function EnvInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [note, setNote] = React.useState<string | null>(null);

  async function load(file: File) {
    const incoming = parseEnvText(await file.text());
    const n = Object.keys(incoming).length;
    if (n === 0) {
      setNote(`No KEY=VALUE lines found in ${file.name}`);
      return;
    }
    onChange(envToText({ ...parseEnvText(value), ...incoming }));
    setNote(`${n} variable${n === 1 ? "" : "s"} loaded from ${file.name}`);
  }

  return (
    <div className="space-y-1">
      <Textarea
        className={className ?? "min-h-28 font-mono text-xs"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onDrop={(e) => {
          const f = e.dataTransfer.files[0];
          if (!f) return;
          e.preventDefault();
          void load(f);
        }}
      />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          Upload .env
        </Button>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void load(f);
          }}
        />
      </div>
    </div>
  );
}

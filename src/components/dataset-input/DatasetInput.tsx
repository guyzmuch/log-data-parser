"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { UploadSimpleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/state/useAppStore";

/** One-click example datasets, served as static files from public/samples/. */
const SAMPLES = [
  { file: "csv-with-header.csv", label: "CSV with header", hint: "comma" },
  { file: "quoted-fields.csv", label: "CSV with quoted fields", hint: "comma" },
  { file: "apm-transaction-log.log", label: "APM transactions", hint: "pipe" },
  { file: "linux-syslog.log", label: "Linux syslog", hint: "space" },
  { file: "aws-alb-access-log.log", label: "AWS ALB access log", hint: "space" },
  { file: "apache-combined-logstash.log", label: "Apache / Nginx access log", hint: "space" },
];

/** The empty state: open a file, drop one, paste text, or try a sample. */
export function DatasetInput() {
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadDataset = useAppStore((s) => s.loadDataset);
  const dataset = useAppStore((s) => s.dataset);
  const replacing = useAppStore((s) => s.replacing);
  const cancelReplacing = useAppStore((s) => s.cancelReplacing);

  async function loadFile(file: File) {
    setError("");
    loadDataset(await file.text(), file.name);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void loadFile(file);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  }

  async function loadSample(file: string) {
    setError("");
    try {
      const response = await fetch(`/samples/${file}`);
      if (!response.ok) throw new Error(String(response.status));
      loadDataset(await response.text(), file);
    } catch {
      setError("Couldn't load that sample. Try pasting your own data instead.");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 pt-14 pb-10">
      {dataset && replacing && (
        <div role="status" className="flex flex-wrap items-center gap-3 border border-border bg-accent px-3 py-2.5 text-sm">
          <span className="min-w-0 flex-1">
            <span className="font-medium">{dataset.name ?? "Pasted text"}</span> is still open. It is only replaced once
            you load something new.
          </span>
          <Button variant="outline" onClick={cancelReplacing}>
            Back to {dataset.name ?? "Pasted text"}
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Open a log or CSV to start</h1>
        <p className="max-w-prose text-muted-foreground">
          Drop a file, or paste text. You choose how it splits into columns next; nothing leaves your browser.
        </p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center gap-3 border border-dashed border-border bg-muted/50 px-6 py-10 text-center",
          dragging && "border-foreground bg-muted",
        )}
      >
        <UploadSimpleIcon className="size-7 text-muted-foreground" />
        <div>
          <p className="font-medium">Drop a file here</p>
          <p className="text-sm text-muted-foreground">.csv, .tsv, .log or .txt</p>
        </div>
        <Button onClick={() => fileInputRef.current?.click()}>Choose file…</Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.log,.txt"
          onChange={handleFileInput}
          className="hidden"
          aria-label="Choose a file"
        />
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or paste text
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          className="min-h-28 w-full resize-y border border-input bg-transparent p-2.5 font-mono text-[0.8125rem] outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
          placeholder="Paste log or CSV data here…"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <div>
          <Button variant="outline" onClick={() => loadDataset(text, "Pasted text")} disabled={text.length === 0}>
            Parse pasted data
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Try a sample</h2>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <Button key={sample.file} variant="outline" onClick={() => void loadSample(sample.file)}>
              {sample.label}
              <span className="text-muted-foreground">· {sample.hint}</span>
            </Button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

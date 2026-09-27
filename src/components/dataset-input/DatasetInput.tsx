"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/state/useAppStore";

export function DatasetInput() {
  const [text, setText] = useState("");
  const loadDataset = useAppStore((s) => s.loadDataset);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void file.text().then((content) => {
      setText(content);
      loadDataset(content);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="min-h-40 w-full rounded-none border border-input bg-transparent p-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
        placeholder="Paste log or CSV data here..."
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex items-center gap-3">
        <Button onClick={() => loadDataset(text)} disabled={text.length === 0}>
          Parse pasted data
        </Button>
        <label className="text-xs text-muted-foreground">
          or upload a file{" "}
          <input type="file" accept=".csv,.tsv,.log,.txt" onChange={handleFile} className="text-xs" />
        </label>
      </div>
    </div>
  );
}

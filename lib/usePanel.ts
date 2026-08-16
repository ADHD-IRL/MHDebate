"use client";

import { useCallback, useRef, useState } from "react";
import type { PanelChoice, PanelEvent, PanelRequest, Stage, Synthesis, VoiceId } from "./types";
import type { RiskResult } from "./safety";

export interface LiveChallenge {
  voiceId: VoiceId;
  targetId: VoiceId;
  text: string;
  streaming: boolean;
}

export interface PanelState {
  stage: Stage;
  panel: PanelChoice | null;
  /** Voice id → text so far. Present as soon as a voice starts, so the UI can
   *  show it thinking rather than popping in finished. */
  takes: Record<string, { text: string; streaming: boolean }>;
  challenges: LiveChallenge[];
  synthesis: Synthesis | null;
  notices: string[];
  error: string | null;
  /** Set when the safety screen stopped the run rather than an error. */
  halted: string | null;
  /** Returned by the server when the reader must see resources first. */
  needsAcknowledgement: RiskResult | null;
}

const EMPTY: PanelState = {
  stage: "idle",
  panel: null,
  takes: {},
  challenges: [],
  synthesis: null,
  notices: [],
  error: null,
  halted: null,
  needsAcknowledgement: null,
};

export interface StartOptions extends PanelRequest {
  acknowledgedSupport?: boolean;
  demoSlug?: string;
}

export function usePanel() {
  const [state, setState] = useState<PanelState>(EMPTY);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(EMPTY);
  }, []);

  const apply = useCallback((event: PanelEvent) => {
    setState((prev) => {
      switch (event.type) {
        case "stage":
          return { ...prev, stage: event.stage };
        case "panel":
          return { ...prev, panel: event.panel };
        case "take-start":
          return {
            ...prev,
            takes: { ...prev.takes, [event.voiceId]: { text: "", streaming: true } },
          };
        case "take-delta": {
          const current = prev.takes[event.voiceId] ?? { text: "", streaming: true };
          return {
            ...prev,
            takes: {
              ...prev.takes,
              [event.voiceId]: { text: current.text + event.text, streaming: true },
            },
          };
        }
        case "take-end": {
          const current = prev.takes[event.voiceId] ?? { text: "", streaming: false };
          return {
            ...prev,
            takes: { ...prev.takes, [event.voiceId]: { ...current, streaming: false } },
          };
        }
        case "challenge-start":
          return {
            ...prev,
            challenges: [
              ...prev.challenges,
              { voiceId: event.voiceId, targetId: event.targetId, text: "", streaming: true },
            ],
          };
        case "challenge-delta":
          return {
            ...prev,
            challenges: prev.challenges.map((c) =>
              c.voiceId === event.voiceId && c.targetId === event.targetId
                ? { ...c, text: c.text + event.text }
                : c,
            ),
          };
        case "challenge-end":
          return {
            ...prev,
            challenges: prev.challenges.map((c) =>
              c.voiceId === event.voiceId && c.targetId === event.targetId
                ? { ...c, streaming: false }
                : c,
            ),
          };
        case "synthesis":
          return { ...prev, synthesis: event.synthesis };
        case "notice":
          return { ...prev, notices: [...prev.notices, event.message] };
        case "halt":
          return { ...prev, stage: "halted", halted: event.reason };
        case "error":
          return { ...prev, stage: "error", error: event.message };
        case "done":
          return { ...prev, stage: "done" };
        default:
          return prev;
      }
    });
  }, []);

  const start = useCallback(
    async (options: StartOptions) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ ...EMPTY, stage: "checking" });

      let response: Response;
      try {
        response = await fetch("/api/panel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options),
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState((s) => ({
          ...s,
          stage: "error",
          error: "Could not reach the server. Check your connection and try again.",
        }));
        return;
      }

      const contentType = response.headers.get("content-type") ?? "";

      // Non-streaming replies are the gate cases: blocked, needs a look at the
      // resources first, rate limited, or a plain validation problem.
      if (!contentType.includes("text/event-stream")) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; risk?: RiskResult }
          | null;

        if (payload?.error === "halted") {
          setState((s) => ({ ...s, stage: "halted", halted: "crisis" }));
          return;
        }
        if (payload?.error === "acknowledgement-required") {
          setState((s) => ({
            ...s,
            stage: "idle",
            needsAcknowledgement: payload.risk ?? { level: "concern", topics: [] },
          }));
          return;
        }
        setState((s) => ({
          ...s,
          stage: "error",
          error: payload?.error ?? "The server refused that request.",
        }));
        return;
      }

      if (!response.body) {
        setState((s) => ({ ...s, stage: "error", error: "The server sent an empty response." }));
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value;

          // SSE frames are separated by a blank line.
          let split: number;
          while ((split = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            try {
              apply(JSON.parse(line.slice(5).trim()) as PanelEvent);
            } catch {
              /* a truncated frame is not worth tearing the stream down for */
            }
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setState((s) => ({
            ...s,
            stage: "error",
            error: "The connection dropped part-way through.",
          }));
        }
      }
    },
    [apply],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => (s.stage === "done" ? s : { ...s, stage: "done" }));
  }, []);

  return { state, start, stop, reset };
}

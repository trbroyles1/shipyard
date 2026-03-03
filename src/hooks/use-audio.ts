"use client";

import { useRef, useCallback, useEffect } from "react";

const FREQ_A5 = 880;
const FREQ_C6_SHARP = 1100;
const FREQ_E5 = 660;

const GAIN_DEFAULT = 0.15;
const GAIN_SILENT = 0.001;

const DURATION_SHORT = 0.15;
const DURATION_MEDIUM = 0.25;
const DURATION_LONG = 0.4;
const NOTE_GAP = 0.18;

export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  const getCtx = useCallback((): AudioContext | null => {
    if (!ctxRef.current) {
      try {
        ctxRef.current = new AudioContext();
      } catch {
        return null;
      }
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    return ctx;
  }, []);

  const playNewMR = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = FREQ_A5;
    gain.gain.setValueAtTime(GAIN_DEFAULT, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(GAIN_SILENT, ctx.currentTime + DURATION_MEDIUM);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + DURATION_MEDIUM);
  }, [getCtx]);

  const playAssignedToMe = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = i === 0 ? FREQ_A5 : FREQ_C6_SHARP;
      const start = ctx.currentTime + i * NOTE_GAP;
      gain.gain.setValueAtTime(GAIN_DEFAULT, start);
      gain.gain.exponentialRampToValueAtTime(GAIN_SILENT, start + DURATION_SHORT);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + DURATION_SHORT);
    }
  }, [getCtx]);

  const playReadyToMerge = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = FREQ_E5;
    gain.gain.setValueAtTime(GAIN_DEFAULT, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(GAIN_SILENT, ctx.currentTime + DURATION_LONG);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + DURATION_LONG);
  }, [getCtx]);

  return { playNewMR, playAssignedToMe, playReadyToMerge };
}

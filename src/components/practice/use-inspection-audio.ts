"use client";
import type { Phase } from "@/lib/training/practice-model";
import { useCallback,useEffect,useRef,type RefObject } from "react";

const INSPECTION_AUDIO_CUE_SECONDS = [5, 4, 3, 2, 1] as const;

type InspectionAudioVoice = {
  gain: GainNode;
  oscillators: OscillatorNode[];
};

export function useInspectionAudio(phaseRef: RefObject<Phase>) {
  const mountedRef = useRef(true);
  const inspectionAudioContextRef = useRef<AudioContext | null>(null);

  const inspectionAudioTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const inspectionAudioVoicesRef = useRef<InspectionAudioVoice[]>([]);

  const getInspectionAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (inspectionAudioContextRef.current) return inspectionAudioContextRef.current;

    const AudioContextCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;

    try {
      const context = new AudioContextCtor();
      inspectionAudioContextRef.current = context;
      return context;
    } catch {
      return null;
    }
  }, []);

  const warmInspectionAudio = useCallback(() => {
    const context = getInspectionAudioContext();
    if (!context || context.state !== "suspended") return;
    void context.resume().catch(() => {
      // Audio is optional; timing should continue if the browser blocks it.
    });
  }, [getInspectionAudioContext]);

  const forgetInspectionVoice = useCallback((voice: InspectionAudioVoice) => {
    inspectionAudioVoicesRef.current = inspectionAudioVoicesRef.current.filter((candidate) => candidate !== voice);
  }, []);

  const stopInspectionVoice = useCallback(
    (voice: InspectionAudioVoice) => {
      const context = inspectionAudioContextRef.current;
      if (!context) {
        forgetInspectionVoice(voice);
        return;
      }

      const now = context.currentTime;
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setTargetAtTime(0, now, 0.012);
        voice.oscillators.forEach((oscillator) => oscillator.stop(now + 0.05));
      } catch {
        // Stopping an already-stopped oscillator throws in some browsers.
      }
      forgetInspectionVoice(voice);
    },
    [forgetInspectionVoice],
  );

  const cancelInspectionAudio = useCallback((preserveActiveVoices = false) => {
    inspectionAudioTimersRef.current.forEach((timer) => clearTimeout(timer));
    inspectionAudioTimersRef.current = [];
    if (preserveActiveVoices) return;
    inspectionAudioVoicesRef.current.forEach(stopInspectionVoice);
    inspectionAudioVoicesRef.current = [];
  }, [stopInspectionVoice]);

  const playInspectionBeep = useCallback(
    function playBeep(variant: "soft" | "bright") {
      if (!mountedRef.current || phaseRef.current !== "inspect") return;
      const context = getInspectionAudioContext();
      if (!context) return;

      if (context.state === "suspended") {
        void context.resume().then(() => {
          if (mountedRef.current && inspectionAudioContextRef.current === context && phaseRef.current === "inspect") playBeep(variant);
        }).catch(() => {
          // Audio is optional; ignore blocked playback.
        });
        return;
      }

      const now = context.currentTime;
      const duration = variant === "bright" ? 0.22 : 0.13;
      const peakGain = 0.30;
      const releaseAt = now + duration - 0.04;
      const stopAt = now + duration + 0.04;
      const gain = context.createGain();
      const frequencies = variant === "bright" ? [1120, 1680] : [680];
      const oscillators = frequencies.map((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = variant === "bright" && index === 1 ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.connect(gain);
        return oscillator;
      });
      const voice: InspectionAudioVoice = { gain, oscillators };

      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.012);
      gain.gain.setValueAtTime(peakGain, releaseAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      inspectionAudioVoicesRef.current = [...inspectionAudioVoicesRef.current, voice];
      oscillators.forEach((oscillator) => {
        oscillator.onended = () => forgetInspectionVoice(voice);
        oscillator.start(now);
        oscillator.stop(stopAt);
      });
    },
    [forgetInspectionVoice, getInspectionAudioContext, phaseRef],
  );

  const scheduleInspectionAudio = useCallback(
    (startedAt: number, durationMs: number) => {
      cancelInspectionAudio();
      warmInspectionAudio();

      inspectionAudioTimersRef.current = INSPECTION_AUDIO_CUE_SECONDS.flatMap((secondsLeft) => {
        const delay = durationMs - secondsLeft * 1000 - (performance.now() - startedAt);
        if (delay <= 0) return [];
        const timeout = setTimeout(() => {
          inspectionAudioTimersRef.current = inspectionAudioTimersRef.current.filter((timer) => timer !== timeout);
          if (phaseRef.current !== "inspect") return;
          playInspectionBeep("soft");
        }, delay);
        return [timeout];
      });
    },
    [cancelInspectionAudio, playInspectionBeep, warmInspectionAudio, phaseRef],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelInspectionAudio();
      const context = inspectionAudioContextRef.current;
      inspectionAudioContextRef.current = null;
      if (context && context.state !== "closed") void context.close().catch(() => { });
    };
  }, [cancelInspectionAudio]);

  return { warmInspectionAudio, cancelInspectionAudio, playInspectionBeep, scheduleInspectionAudio };
}

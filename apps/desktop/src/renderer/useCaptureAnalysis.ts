import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisEventType, CaptureSourceInfo } from "@sibot/shared";

const DRAW_WIDTH = 160;
const DRAW_HEIGHT = 90;

const eventByMetrics = (
  globalDiff: number,
  centerDiff: number,
  brightnessDrop: number
): AnalysisEventType | null => {
  if (brightnessDrop > 18 && globalDiff > 26) {
    return "death";
  }

  if (centerDiff > 30 && globalDiff > 24) {
    return Math.random() > 0.5 ? "failedCloseRangeDuel" : "lowAccuracyBurst";
  }

  if (globalDiff > 21 && centerDiff < 14) {
    return Math.random() > 0.5 ? "missedEasyKill" : "poorUltTiming";
  }

  return null;
};

export const useCaptureAnalysis = () => {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastFrameRef = useRef<Float32Array | null>(null);
  const lastEmitAtRef = useRef(0);

  const [sources, setSources] = useState<CaptureSourceInfo[]>([]);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [lastSignal, setLastSignal] = useState("");

  const canvas = useMemo(() => {
    if (typeof document === "undefined") {
      return null;
    }

    const node = document.createElement("canvas");
    node.width = DRAW_WIDTH;
    node.height = DRAW_HEIGHT;
    return node;
  }, []);

  const refreshSources = async () => {
    try {
      const nextSources = await window.sibot.listCaptureSources();
      setSources(nextSources);
    } catch {
      setSources([]);
      setError("캡처 소스를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    void refreshSources();
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const stop = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (previewRef.current) {
      previewRef.current.srcObject = null;
    }

    lastFrameRef.current = null;
    setActive(false);
  };

  const start = async (sourceId: string, sampleIntervalMs: number) => {
    if (!sourceId) {
      setError("먼저 캡처 소스를 선택하세요.");
      return;
    }

    stop();
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sourceId,
            maxWidth: 1920,
            maxHeight: 1080,
            maxFrameRate: 12
          }
        } as MediaTrackConstraints
      } as MediaStreamConstraints);

      streamRef.current = stream;

      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        previewRef.current.muted = true;
        await previewRef.current.play().catch(() => undefined);
      }

      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !ctx) {
        setError("캔버스 초기화에 실패했습니다.");
        return;
      }

      intervalRef.current = window.setInterval(() => {
        const video = previewRef.current;
        if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
          return;
        }

        ctx.drawImage(video, 0, 0, DRAW_WIDTH, DRAW_HEIGHT);
        const frame = ctx.getImageData(0, 0, DRAW_WIDTH, DRAW_HEIGHT).data;
        const luminance = new Float32Array(DRAW_WIDTH * DRAW_HEIGHT);
        let brightnessSum = 0;
        let diffSum = 0;
        let centerDiffSum = 0;
        let centerCount = 0;

        for (let index = 0; index < luminance.length; index += 1) {
          const pixelIndex = index * 4;
          const value =
            frame[pixelIndex] * 0.299 +
            frame[pixelIndex + 1] * 0.587 +
            frame[pixelIndex + 2] * 0.114;
          luminance[index] = value;
          brightnessSum += value;

          if (lastFrameRef.current) {
            const delta = Math.abs(value - lastFrameRef.current[index]);
            diffSum += delta;

            const x = index % DRAW_WIDTH;
            const y = Math.floor(index / DRAW_WIDTH);
            if (x > DRAW_WIDTH * 0.35 && x < DRAW_WIDTH * 0.65 && y > DRAW_HEIGHT * 0.3 && y < DRAW_HEIGHT * 0.7) {
              centerDiffSum += delta;
              centerCount += 1;
            }
          }
        }

        const averageBrightness = brightnessSum / luminance.length;
        const previousBrightness =
          lastFrameRef.current?.reduce((sum, value) => sum + value, 0) ??
          averageBrightness * luminance.length;
        const brightnessDrop = previousBrightness / luminance.length - averageBrightness;
        const globalDiff = lastFrameRef.current ? diffSum / luminance.length : 0;
        const centerDiff = centerCount > 0 ? centerDiffSum / centerCount : 0;

        lastFrameRef.current = luminance;

        const detectedEvent = eventByMetrics(globalDiff, centerDiff, brightnessDrop);
        setLastSignal(
          `diff ${globalDiff.toFixed(1)} · center ${centerDiff.toFixed(1)} · drop ${brightnessDrop.toFixed(1)}`
        );

        if (!detectedEvent) {
          return;
        }

        const now = Date.now();
        if (now - lastEmitAtRef.current < 9000) {
          return;
        }

        lastEmitAtRef.current = now;
        void window.sibot.command({
          type: "event/inject",
          eventType: detectedEvent
        });
      }, sampleIntervalMs);

      setActive(true);
    } catch {
      stop();
      setError("화면 캡처를 시작하지 못했습니다. 권한 또는 소스 선택 상태를 확인하세요.");
    }
  };

  return {
    previewRef,
    sources,
    active,
    error,
    lastSignal,
    refreshSources,
    start,
    stop
  };
};

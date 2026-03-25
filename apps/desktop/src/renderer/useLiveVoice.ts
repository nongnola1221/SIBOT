import { useEffect, useRef, useState } from "react";

type RecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => RecognitionLike;

const resolveRecognition = () => {
  const candidateWindow = window as typeof window & {
    webkitSpeechRecognition?: RecognitionCtor;
    SpeechRecognition?: RecognitionCtor;
  };

  return candidateWindow.SpeechRecognition ?? candidateWindow.webkitSpeechRecognition ?? null;
};

export interface VoiceDeviceOption {
  deviceId: string;
  label: string;
}

export const useLiveVoice = () => {
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<VoiceDeviceOption[]>([]);

  const refreshDevices = async (requestPermission = true) => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDevices([]);
      return;
    }

    if (requestPermission) {
      try {
        const probeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        probeStream.getTracks().forEach((track) => track.stop());
      } catch {
        // continue with whatever labels are already available
      }
    }

    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const microphones = mediaDevices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId || `default-${index}`,
          label: device.label || `마이크 ${index + 1}`
        }));

      setDevices(microphones);
    } catch {
      setDevices([]);
    }
  };

  useEffect(() => {
    setSupported(Boolean(resolveRecognition()));
    void refreshDevices(false);
  }, []);

  useEffect(() => {
    return () => {
      shouldKeepListeningRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const startListening = async () => {
    const Recognition = resolveRecognition();

    if (!Recognition) {
      setSupported(false);
      setError("이 환경에서는 Web Speech API를 사용할 수 없습니다.");
      return;
    }

    shouldKeepListeningRef.current = true;
    setError("");

    if (recognitionRef.current) {
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "ko-KR";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const transcript = event.results[index]?.[0]?.transcript?.trim();
          if (!transcript) {
            continue;
          }

          setLastTranscript(transcript);
          void window.sibot.command({
            type: "speech/process-transcript",
            text: transcript
          });
        }
      };

      recognition.onerror = (event) => {
        setError(event.error ?? "음성 인식 오류");
      };

      recognition.onend = () => {
        recognitionRef.current = null;

        if (shouldKeepListeningRef.current) {
          window.setTimeout(() => {
            void startListening();
          }, 350);
          return;
        }

        setListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError("음성 인식을 시작하지 못했습니다.");
    }
  };

  const stopListening = () => {
    shouldKeepListeningRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  return {
    supported,
    listening,
    lastTranscript,
    error,
    devices,
    refreshDevices,
    startListening,
    stopListening
  };
};

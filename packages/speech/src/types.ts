import type { SibotMode, Utterance } from "@sibot/shared";

export interface SpeechSynthesisOptions {
  volume: number;
  rate: number;
  mode: SibotMode;
}

export interface SpeechTranscript {
  text: string;
  final: boolean;
  createdAt: number;
}

export interface STTProvider {
  readonly id: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  setTranscriptHandler(handler: (transcript: SpeechTranscript) => void): void;
  simulateTranscript?(text: string): Promise<void>;
}

export interface TTSProvider {
  readonly id: string;
  speak(utterance: Utterance, options: SpeechSynthesisOptions): Promise<void>;
  stop(): Promise<void>;
}

export interface WakeWordProvider {
  readonly id: string;
  configure(words: string[]): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  setWakeWordHandler(handler: (word: string) => void): void;
  simulateWakeWord?(word: string): Promise<void>;
}


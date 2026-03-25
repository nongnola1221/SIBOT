import type { TTSProvider, SpeechSynthesisOptions } from "../types";
import type { Utterance } from "@sibot/shared";

export class MockTTSProvider implements TTSProvider {
  readonly id = "mock-tts";
  private currentTimer: NodeJS.Timeout | null = null;

  async speak(utterance: Utterance, _options: SpeechSynthesisOptions) {
    await this.stop();

    await new Promise<void>((resolve) => {
      this.currentTimer = setTimeout(() => {
        this.currentTimer = null;
        resolve();
      }, Math.min(1400, Math.max(350, utterance.text.length * 45)));
    });
  }

  async stop() {
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
  }
}


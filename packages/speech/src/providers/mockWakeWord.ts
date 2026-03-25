import type { WakeWordProvider } from "../types";

export class MockWakeWordProvider implements WakeWordProvider {
  readonly id = "mock-wake-word";
  private handler: (word: string) => void = () => undefined;

  async configure(_words: string[]) {
    return;
  }

  async start() {
    return;
  }

  async stop() {
    return;
  }

  setWakeWordHandler(handler: (word: string) => void) {
    this.handler = handler;
  }

  async simulateWakeWord(word: string) {
    this.handler(word);
  }
}


import type { STTProvider, SpeechTranscript } from "../types";

export class MockSTTProvider implements STTProvider {
  readonly id = "mock-stt";
  private handler: (transcript: SpeechTranscript) => void = () => undefined;

  async start() {
    return;
  }

  async stop() {
    return;
  }

  setTranscriptHandler(handler: (transcript: SpeechTranscript) => void) {
    this.handler = handler;
  }

  async simulateTranscript(text: string) {
    this.handler({
      text,
      final: true,
      createdAt: Date.now()
    });
  }
}


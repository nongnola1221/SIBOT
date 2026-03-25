import { spawn, type ChildProcess } from "node:child_process";
import type { TTSProvider, SpeechSynthesisOptions } from "../types";
import type { Utterance } from "@sibot/shared";

const escapePowerShellSingleQuoted = (value: string) => value.replace(/'/g, "''");

export class SystemTTSProvider implements TTSProvider {
  readonly id = "system-tts";
  private currentChild: ChildProcess | null = null;

  async speak(utterance: Utterance, options: SpeechSynthesisOptions) {
    await this.stop();

    const text = utterance.text.replace(/\s+/g, " ").trim();
    if (!text) {
      return;
    }

    try {
      if (process.platform === "win32") {
        await this.speakWithWindows(text, options);
        return;
      }

      if (process.platform === "darwin") {
        await this.speakWithMac(text, options);
        return;
      }

      await this.speakWithLinux(text);
    } catch {
      return;
    }
  }

  async stop() {
    if (!this.currentChild) {
      return;
    }

    this.currentChild.kill();
    this.currentChild = null;
  }

  private speakWithWindows(text: string, options: SpeechSynthesisOptions) {
    const volume = Math.max(0, Math.min(100, Math.round(options.volume * 100)));
    const rate = Math.max(-5, Math.min(5, Math.round((options.rate - 1) * 8)));
    const script = [
      "Add-Type -AssemblyName System.Speech",
      "$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer",
      `$speaker.Volume = ${volume}`,
      `$speaker.Rate = ${rate}`,
      `$speaker.Speak('${escapePowerShellSingleQuoted(text)}')`
    ].join("; ");

    return this.runProcess("powershell.exe", ["-NoProfile", "-Command", script]);
  }

  private speakWithMac(text: string, options: SpeechSynthesisOptions) {
    const rate = Math.max(120, Math.min(320, Math.round(190 * options.rate)));
    return this.runProcess("say", ["-r", String(rate), text]);
  }

  private speakWithLinux(text: string) {
    return this.runProcess("spd-say", [text]);
  }

  private runProcess(command: string, args: string[]) {
    return new Promise<void>((resolve) => {
      const child = spawn(command, args, {
        stdio: ["ignore", "ignore", "ignore"]
      });

      this.currentChild = child;

      child.once("error", () => {
        this.currentChild = null;
        resolve();
      });

      child.once("exit", () => {
        this.currentChild = null;
        resolve();
      });
    });
  }
}


import { spawn, type ChildProcess } from "node:child_process";
import type { STTProvider, SpeechTranscript } from "../types";

const WINDOWS_STT_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$recognizers = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
$preferred = $recognizers | Where-Object { $_.Culture.Name -eq 'ko-KR' } | Select-Object -First 1
if (-not $preferred) {
  $preferred = $recognizers | Where-Object { $_.Culture.Name -eq 'en-US' } | Select-Object -First 1
}
if (-not $preferred -and $recognizers.Count -gt 0) {
  $preferred = $recognizers[0]
}
if (-not $preferred) {
  throw 'No installed SpeechRecognitionEngine recognizer found.'
}

$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($preferred)
$engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$engine.SetInputToDefaultAudioDevice()

$engine.add_SpeechRecognized({
  param($sender, $eventArgs)
  try {
    $text = $eventArgs.Result.Text
    $confidence = [double]$eventArgs.Result.Confidence
    if ([string]::IsNullOrWhiteSpace($text) -or $confidence -lt 0.35) {
      return
    }

    $payload = [pscustomobject]@{
      type = 'transcript'
      text = $text
      final = $true
      confidence = [math]::Round($confidence, 3)
      createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    } | ConvertTo-Json -Compress

    [Console]::Out.WriteLine($payload)
    [Console]::Out.Flush()
  } catch {
  }
})

$ready = [pscustomobject]@{
  type = 'status'
  state = 'ready'
  culture = $preferred.Culture.Name
} | ConvertTo-Json -Compress
[Console]::Out.WriteLine($ready)
[Console]::Out.Flush()

$engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)

try {
  while ($true) {
    Start-Sleep -Milliseconds 400
  }
} finally {
  try { $engine.RecognizeAsyncCancel() } catch {}
  try { $engine.RecognizeAsyncStop() } catch {}
}
`;

export class WindowsSystemSTTProvider implements STTProvider {
  readonly id = "windows-system-stt";

  private child: ChildProcess | null = null;
  private stdoutBuffer = "";
  private handler: (transcript: SpeechTranscript) => void = () => undefined;

  async start() {
    if (process.platform !== "win32") {
      return;
    }

    if (this.child) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "powershell.exe",
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", WINDOWS_STT_SCRIPT],
        {
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        }
      );

      this.child = child;
      this.stdoutBuffer = "";

      let resolved = false;
      let stderrBuffer = "";
      const startupTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 1200);

      child.stdout.on("data", (chunk: Buffer) => {
        this.stdoutBuffer += chunk.toString("utf8");
        this.flushStdout((line) => {
          const payload = this.parseLine(line);
          if (!payload) {
            return;
          }

          if (payload.type === "status" && payload.state === "ready" && !resolved) {
            resolved = true;
            clearTimeout(startupTimer);
            resolve();
            return;
          }

          if (payload.type === "transcript" && typeof payload.text === "string") {
            this.handler({
              text: payload.text,
              final: Boolean(payload.final),
              createdAt:
                typeof payload.createdAt === "number" ? payload.createdAt : Date.now()
            });
          }
        });
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrBuffer += chunk.toString("utf8");
      });

      child.once("error", (error) => {
        clearTimeout(startupTimer);
        this.child = null;
        if (!resolved) {
          reject(error);
        }
      });

      child.once("exit", (code) => {
        clearTimeout(startupTimer);
        this.child = null;
        if (!resolved) {
          reject(
            new Error(
              stderrBuffer.trim() ||
                `Windows STT process exited before startup with code ${code ?? -1}`
            )
          );
        }
      });
    });
  }

  async stop() {
    if (!this.child) {
      return;
    }

    this.child.kill();
    this.child = null;
    this.stdoutBuffer = "";
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

  private flushStdout(onLine: (line: string) => void) {
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      onLine(trimmed);
    }
  }

  private parseLine(line: string): Record<string, unknown> | null {
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

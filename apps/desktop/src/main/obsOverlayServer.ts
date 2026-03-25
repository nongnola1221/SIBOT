import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { RuntimeSnapshot } from "@sibot/shared";

const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SIBOT OBS Overlay</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: "IBM Plex Sans KR", "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: transparent;
        color: #f7fbff;
      }
      #app {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 12px;
        width: 100vw;
        min-height: 100vh;
        padding: 12px;
      }
      .msg {
        display: inline-flex;
        flex-direction: column;
        gap: 6px;
        max-width: min(100%, 460px);
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(9, 16, 22, 0.78);
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(18px);
        box-shadow: 0 14px 40px rgba(0,0,0,.22);
      }
      .name {
        color: #70f3d6;
        text-transform: uppercase;
        letter-spacing: .08em;
        font-size: 11px;
      }
      .subtitle .msg {
        width: 100%;
        max-width: 100%;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      const root = document.getElementById("app");

      async function refresh() {
        try {
          const response = await fetch("/api/overlay", { cache: "no-store" });
          const payload = await response.json();
          const { utterances, settings } = payload;

          document.body.className = settings.overlayStyle === "subtitle" ? "subtitle" : "";
          root.innerHTML = "";

          utterances.forEach((utterance) => {
            const article = document.createElement("article");
            article.className = "msg";

            if (settings.overlayShowNickname) {
              const name = document.createElement("span");
              name.className = "name";
              name.textContent = settings.aiName;
              article.appendChild(name);
            }

            const body = document.createElement("span");
            body.textContent = utterance.text;
            article.appendChild(body);
            root.appendChild(article);
          });
        } catch {}
      }

      refresh();
      setInterval(refresh, 350);
    </script>
  </body>
</html>`;

export class ObsOverlayServer {
  private server: http.Server | null = null;
  private port: number | null = null;
  private snapshot: RuntimeSnapshot | null = null;

  updateSnapshot(snapshot: RuntimeSnapshot) {
    this.snapshot = snapshot;
  }

  async ensureListening(port: number) {
    if (this.server && this.port === port) {
      return;
    }

    await this.stop();

    await new Promise<void>((resolve) => {
      const server = http.createServer((request, response) => {
        this.handleRequest(request, response);
      });

      server.on("error", () => {
        this.server = null;
        this.port = null;
        resolve();
      });

      server.listen(port, "127.0.0.1", () => {
        this.server = server;
        this.port = port;
        resolve();
      });
    });
  }

  async stop() {
    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.server?.close(() => {
        resolve();
      });
    });

    this.server = null;
    this.port = null;
  }

  getOverlayUrl() {
    return this.port ? `http://127.0.0.1:${this.port}/overlay` : null;
  }

  private handleRequest(request: IncomingMessage, response: ServerResponse) {
    const pathname = (request.url ?? "/").split("?")[0];

    response.setHeader("Access-Control-Allow-Origin", "*");

    if (pathname === "/overlay" || pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }

    if (pathname === "/api/overlay") {
      const snapshot = this.snapshot;
      const payload = snapshot
        ? {
            settings: {
              aiName: snapshot.settings.aiName,
              overlayDurationMs: snapshot.settings.overlayDurationMs,
              overlayHistoryCount: snapshot.settings.overlayHistoryCount,
              overlayShowNickname: snapshot.settings.overlayShowNickname,
              overlayStyle: snapshot.settings.overlayStyle
            },
            utterances: snapshot.recentUtterances
              .filter(
                (utterance) =>
                  Date.now() - utterance.createdAt <= snapshot.settings.overlayDurationMs
              )
              .slice(0, snapshot.settings.overlayHistoryCount)
              .reverse()
              .map((utterance) => ({
                id: utterance.id,
                text: utterance.text,
                createdAt: utterance.createdAt
              }))
          }
        : { settings: null, utterances: [] };

      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(payload));
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}


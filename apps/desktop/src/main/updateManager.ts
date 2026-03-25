import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { app, shell } from "electron";
import type { UpdateStatus } from "@sibot/shared";

interface ReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

interface GitHubReleaseResponse {
  tag_name?: string;
  html_url?: string;
  assets?: ReleaseAsset[];
}

const CURRENT_VERSION = app.getVersion();
const RELEASE_API_URL = "https://api.github.com/repos/nongnola1221/SIBOT/releases/latest";

const normalizeVersion = (value: string) => value.replace(/^v/i, "").trim();

const compareVersions = (left: string, right: string) => {
  const leftParts = normalizeVersion(left).split(".").map((part) => Number(part) || 0);
  const rightParts = normalizeVersion(right).split(".").map((part) => Number(part) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }

  return 0;
};

export class UpdateManager {
  private status: UpdateStatus = {
    phase: "idle",
    currentVersion: CURRENT_VERSION,
    message: "아직 업데이트 확인 전"
  };

  constructor(private readonly onChange: (status: UpdateStatus) => void) {}

  getStatus() {
    return this.status;
  }

  async check() {
    this.setStatus({
      phase: "checking",
      currentVersion: CURRENT_VERSION,
      checkedAt: Date.now(),
      message: "GitHub Release 확인 중"
    });

    try {
      const response = await fetch(RELEASE_API_URL, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "SIBOT-Desktop"
        }
      });

      if (!response.ok) {
        throw new Error(`release lookup failed: ${response.status}`);
      }

      const release = (await response.json()) as GitHubReleaseResponse;
      const latestVersion = normalizeVersion(release.tag_name ?? CURRENT_VERSION);
      const downloadAsset =
        release.assets?.find((asset) => asset.name?.toLowerCase().endsWith(".exe")) ??
        release.assets?.[0];
      const isNewer = compareVersions(latestVersion, CURRENT_VERSION) > 0;

      if (isNewer) {
        this.setStatus({
          phase: "update-available",
          currentVersion: CURRENT_VERSION,
          latestVersion,
          checkedAt: Date.now(),
          downloadUrl: downloadAsset?.browser_download_url,
          releaseUrl: release.html_url,
          message: `새 버전 ${latestVersion} 다운로드 가능`
        });
        return this.status;
      }

      this.setStatus({
        phase: "up-to-date",
        currentVersion: CURRENT_VERSION,
        latestVersion,
        checkedAt: Date.now(),
        releaseUrl: release.html_url,
        message: "현재 최신 버전 사용 중"
      });
      return this.status;
    } catch {
      this.setStatus({
        phase: "error",
        currentVersion: CURRENT_VERSION,
        checkedAt: Date.now(),
        message: "업데이트 확인 실패"
      });
      return this.status;
    }
  }

  async downloadUpdate() {
    const readyStatus =
      this.status.phase === "update-available" || this.status.phase === "downloaded"
        ? this.status
        : await this.check();

    if (!readyStatus.downloadUrl || !readyStatus.latestVersion) {
      this.setStatus({
        ...readyStatus,
        phase: "error",
        errorMessage: "다운로드 가능한 설치 파일을 찾지 못했습니다.",
        message: "업데이트 설치 파일을 찾지 못했습니다."
      });
      return this.status;
    }

    const targetFileName = this.resolveInstallerName(readyStatus.downloadUrl, readyStatus.latestVersion);
    const updatesDir = path.join(app.getPath("userData"), "updates");
    const tempFilePath = path.join(updatesDir, `${targetFileName}.download`);
    const installerPath = path.join(updatesDir, targetFileName);

    await mkdir(updatesDir, { recursive: true });
    await rm(tempFilePath, { force: true }).catch(() => undefined);

    this.setStatus({
      ...readyStatus,
      phase: "downloading",
      installerPath,
      downloadProgress: 0,
      downloadedBytes: 0,
      message: `업데이트 ${readyStatus.latestVersion} 다운로드 중`
    });

    try {
      const response = await fetch(readyStatus.downloadUrl, {
        headers: {
          "User-Agent": "SIBOT-Desktop"
        }
      });

      if (!response.ok || !response.body) {
        throw new Error(`download failed: ${response.status}`);
      }

      const totalBytes = Number(response.headers.get("content-length") ?? 0) || undefined;
      let downloadedBytes = 0;
      const downloadStream = Readable.fromWeb(response.body as any);

      downloadStream.on("data", (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        const nextProgress = totalBytes ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : undefined;

        this.setStatus({
          ...this.status,
          phase: "downloading",
          installerPath,
          downloadedBytes,
          totalBytes,
          downloadProgress: nextProgress,
          message: totalBytes
            ? `업데이트 다운로드 중 ${nextProgress ?? 0}%`
            : "업데이트 다운로드 중"
        });
      });

      await pipeline(downloadStream, createWriteStream(tempFilePath));
      await rm(installerPath, { force: true }).catch(() => undefined);
      await rename(tempFilePath, installerPath);

      this.setStatus({
        ...this.status,
        phase: "downloaded",
        installerPath,
        downloadProgress: 100,
        message: `업데이트 ${readyStatus.latestVersion} 설치 준비 완료`
      });
      return this.status;
    } catch {
      await rm(tempFilePath, { force: true }).catch(() => undefined);
      this.setStatus({
        ...this.status,
        phase: "error",
        errorMessage: "설치 파일 다운로드에 실패했습니다.",
        message: "업데이트 다운로드 실패"
      });
      return this.status;
    }
  }

  async installUpdate() {
    if (!this.status.installerPath) {
      this.setStatus({
        ...this.status,
        phase: "error",
        errorMessage: "실행할 설치 파일이 없습니다.",
        message: "먼저 업데이트를 다운로드하세요."
      });
      return false;
    }

    this.setStatus({
      ...this.status,
      phase: "installing",
      message: "설치 파일을 실행하는 중"
    });

    const openResult = await shell.openPath(this.status.installerPath);

    if (openResult) {
      this.setStatus({
        ...this.status,
        phase: "error",
        errorMessage: openResult,
        message: "설치 파일 실행 실패"
      });
      return false;
    }

    if (app.isPackaged && process.platform === "win32") {
      setTimeout(() => {
        app.quit();
      }, 1500);
    }

    return true;
  }

  private setStatus(status: UpdateStatus) {
    this.status = status;
    this.onChange(this.status);
  }

  private resolveInstallerName(downloadUrl: string, version: string) {
    try {
      const url = new URL(downloadUrl);
      const fromPath = path.basename(url.pathname);
      if (fromPath.toLowerCase().endsWith(".exe")) {
        return fromPath;
      }
    } catch {
      // fall through
    }

    return `SIBOT-${normalizeVersion(version)}-setup.exe`;
  }
}

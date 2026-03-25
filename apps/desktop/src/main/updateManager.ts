import { app } from "electron";
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

  private setStatus(status: UpdateStatus) {
    this.status = status;
    this.onChange(this.status);
  }
}

import type { GameProfile } from "@sibot/shared";

export const GAME_PROFILES: GameProfile[] = [
  {
    id: "overwatch2",
    name: "Overwatch 2",
    shortName: "OW2",
    processNames: ["overwatch.exe", "overwatch2.exe"],
    windowTitleHints: ["overwatch", "오버워치"],
    supportedEvents: [
      "death",
      "soloOverextend",
      "abilityUnusedDeath",
      "ultUnusedOnDeath",
      "isolatedDive",
      "failedCloseRangeDuel",
      "ignoredCover",
      "poorUltTiming",
      "idleAdlibWindow"
    ],
    detectorNotes: "프로세스명 + 활성 창 제목 기반 감지",
    primaryColor: "#ff9f43"
  },
  {
    id: "valorant",
    name: "VALORANT",
    shortName: "VAL",
    processNames: ["valorant.exe", "valorant-win64-shipping.exe"],
    windowTitleHints: ["valorant"],
    supportedEvents: [
      "death",
      "lowAccuracyBurst",
      "missedEasyKill",
      "whiffBurst",
      "dryPeekFailure",
      "utilHeldOnDeath",
      "lostAdvantageDuel",
      "idleAdlibWindow"
    ],
    detectorNotes: "VALORANT 프로세스와 윈도우 캡션 힌트 매칭",
    primaryColor: "#ff4655"
  },
  {
    id: "pubg",
    name: "PUBG: BATTLEGROUNDS",
    shortName: "PUBG",
    processNames: ["tslgame.exe"],
    windowTitleHints: ["pubg", "battlegrounds"],
    supportedEvents: [
      "death",
      "soloOverextend",
      "missedEasyKill",
      "idleAdlibWindow"
    ],
    detectorNotes: "TSLGame 프로세스 기반",
    primaryColor: "#f8b400"
  },
  {
    id: "league",
    name: "League of Legends",
    shortName: "LoL",
    processNames: ["league of legends.exe", "leagueclient.exe"],
    windowTitleHints: ["league of legends", "리그 오브 레전드"],
    supportedEvents: ["death", "soloOverextend", "missedEasyKill", "idleAdlibWindow"],
    detectorNotes: "클라이언트/게임 실행 파일 매칭",
    primaryColor: "#0ac8b9"
  }
];


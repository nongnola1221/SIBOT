import { useEffect, useMemo, useRef, useState } from "react";
import type {
  RuntimeCommand,
  RuntimeSnapshot,
  UpdateStatus,
  UserSettings
} from "@sibot/shared";

export type RuntimeConnectionPhase =
  | "loading"
  | "ready"
  | "bridge-missing"
  | "timeout"
  | "error";

export const useSibotRuntime = () => {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [connectionPhase, setConnectionPhase] = useState<RuntimeConnectionPhase>("loading");
  const [connectionMessage, setConnectionMessage] = useState("SIBOT 런타임 연결 중...");
  const snapshotSeenRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    const bridge = typeof window !== "undefined" ? window.sibot : undefined;

    if (!bridge) {
      setConnectionPhase("bridge-missing");
      setConnectionMessage("앱 브리지(preload)가 로드되지 않았습니다.");
      return () => {
        disposed = true;
      };
    }

    const timeoutId = window.setTimeout(() => {
      if (!disposed && !snapshotSeenRef.current) {
        setConnectionPhase("timeout");
        setConnectionMessage("런타임 응답이 지연되고 있습니다. 다시 연결을 시도해보세요.");
      }
    }, 3000);

    bridge
      .getSnapshot()
      .then((initial) => {
        if (!disposed && initial) {
          snapshotSeenRef.current = true;
          setSnapshot(initial);
          setConnectionPhase("ready");
          setConnectionMessage("런타임 연결 완료");
        }
      })
      .catch(() => {
        if (!disposed) {
          setConnectionPhase("error");
          setConnectionMessage("초기 스냅샷을 불러오지 못했습니다.");
        }
      });

    bridge
      .getUpdateStatus()
      .then((initial) => {
        if (!disposed && initial) {
          setUpdateStatus(initial);
        }
      })
      .catch(() => undefined);

    const unsubscribe = bridge.onSnapshot((next) => {
      if (!disposed) {
        snapshotSeenRef.current = true;
        setSnapshot(next);
        setConnectionPhase("ready");
        setConnectionMessage("런타임 연결 완료");
      }
    });

    const unsubscribeUpdate = bridge.onUpdateStatus((next) => {
      if (!disposed) {
        setUpdateStatus(next);
      }
    });

    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
      unsubscribe();
      unsubscribeUpdate();
    };
  }, []);

  const bridge = typeof window !== "undefined" ? window.sibot : undefined;

  const retryConnection = async () => {
    if (!bridge) {
      setConnectionPhase("bridge-missing");
      setConnectionMessage("앱 브리지가 없어 다시 연결할 수 없습니다.");
      return null;
    }

    setConnectionPhase("loading");
    setConnectionMessage("런타임 재연결 시도 중...");

    try {
      const next = await bridge.getSnapshot();
      if (next) {
        snapshotSeenRef.current = true;
        setSnapshot(next);
        setConnectionPhase("ready");
        setConnectionMessage("런타임 연결 완료");
      } else {
        setConnectionPhase("timeout");
        setConnectionMessage("런타임 스냅샷이 아직 준비되지 않았습니다.");
      }

      return next;
    } catch {
      setConnectionPhase("error");
      setConnectionMessage("런타임 재연결에 실패했습니다.");
      return null;
    }
  };

  return useMemo(
    () => ({
      bridgeAvailable: Boolean(bridge),
      connectionPhase,
      connectionMessage,
      snapshot,
      updateStatus,
      retryConnection,
      updateSettings: (patch: Partial<UserSettings>) => bridge?.updateSettings(patch) ?? Promise.resolve(),
      sendCommand: (command: RuntimeCommand) => bridge?.command(command) ?? Promise.resolve(null),
      checkForUpdates: () => bridge?.checkForUpdates() ?? Promise.resolve(null),
      downloadUpdate: () => bridge?.downloadUpdate() ?? Promise.resolve(null),
      installUpdate: () => bridge?.installUpdate() ?? Promise.resolve(false),
      openExternal: (url: string) => bridge?.openExternal(url) ?? Promise.resolve(false)
    }),
    [bridge, connectionMessage, connectionPhase, snapshot, updateStatus]
  );
};

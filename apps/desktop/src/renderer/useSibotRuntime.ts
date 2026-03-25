import { useEffect, useMemo, useState } from "react";
import type {
  RuntimeCommand,
  RuntimeSnapshot,
  UpdateStatus,
  UserSettings
} from "@sibot/shared";

export const useSibotRuntime = () => {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    let disposed = false;

    window.sibot.getSnapshot().then((initial) => {
      if (!disposed && initial) {
        setSnapshot(initial);
      }
    });

    window.sibot.getUpdateStatus().then((initial) => {
      if (!disposed && initial) {
        setUpdateStatus(initial);
      }
    });

    const unsubscribe = window.sibot.onSnapshot((next) => {
      if (!disposed) {
        setSnapshot(next);
      }
    });

    const unsubscribeUpdate = window.sibot.onUpdateStatus((next) => {
      if (!disposed) {
        setUpdateStatus(next);
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
      unsubscribeUpdate();
    };
  }, []);

  return useMemo(
    () => ({
      snapshot,
      updateStatus,
      updateSettings: (patch: Partial<UserSettings>) => window.sibot.updateSettings(patch),
      sendCommand: (command: RuntimeCommand) => window.sibot.command(command),
      checkForUpdates: () => window.sibot.checkForUpdates(),
      openExternal: (url: string) => window.sibot.openExternal(url)
    }),
    [snapshot, updateStatus]
  );
};

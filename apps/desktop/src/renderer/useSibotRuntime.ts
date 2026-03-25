import { useEffect, useMemo, useState } from "react";
import type { RuntimeCommand, RuntimeSnapshot, UserSettings } from "@sibot/shared";

export const useSibotRuntime = () => {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);

  useEffect(() => {
    let disposed = false;

    window.sibot.getSnapshot().then((initial) => {
      if (!disposed && initial) {
        setSnapshot(initial);
      }
    });

    const unsubscribe = window.sibot.onSnapshot((next) => {
      if (!disposed) {
        setSnapshot(next);
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  return useMemo(
    () => ({
      snapshot,
      updateSettings: (patch: Partial<UserSettings>) => window.sibot.updateSettings(patch),
      sendCommand: (command: RuntimeCommand) => window.sibot.command(command)
    }),
    [snapshot]
  );
};


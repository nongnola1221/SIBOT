import { useEffect, useState, type CSSProperties } from "react";
import type { RuntimeSnapshot } from "@sibot/shared";

export const App = () => {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);

  useEffect(() => {
    let disposed = false;

    window.sibot.getSnapshot().then((next) => {
      if (!disposed && next) {
        setSnapshot(next);
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

  if (!snapshot || !snapshot.settings.overlayEnabled) {
    return <div className="overlay-shell" />;
  }

  const utterances = snapshot.recentUtterances
    .filter((utterance) => Date.now() - utterance.createdAt <= snapshot.settings.overlayDurationMs)
    .slice(0, snapshot.settings.overlayHistoryCount)
    .reverse();

  return (
    <div
      className={`overlay-shell overlay-shell--${snapshot.settings.overlayStyle}`}
      style={
        {
          ["--overlay-font-scale" as string]: snapshot.settings.overlayFontScale,
          ["--overlay-opacity" as string]: snapshot.settings.overlayOpacity
        } as CSSProperties
      }
    >
      {utterances.map((utterance) => (
        <article key={utterance.id} className="overlay-message">
          {snapshot.settings.overlayShowNickname ? (
            <span className="overlay-message__name">{snapshot.settings.aiName}</span>
          ) : null}
          <span>{utterance.text}</span>
        </article>
      ))}
    </div>
  );
};

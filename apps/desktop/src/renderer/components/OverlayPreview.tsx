import type { RuntimeSnapshot } from "@sibot/shared";

interface OverlayPreviewProps {
  snapshot: RuntimeSnapshot;
}

export const OverlayPreview = ({ snapshot }: OverlayPreviewProps) => {
  const utterances = snapshot.recentUtterances.slice(0, snapshot.settings.overlayHistoryCount).reverse();

  return (
    <div className={`overlay-preview overlay-preview--${snapshot.settings.overlayStyle}`}>
      {utterances.length === 0 ? (
        <div className="overlay-preview__empty">아직 발화가 없습니다.</div>
      ) : (
        utterances.map((utterance) => (
          <div key={utterance.id} className="overlay-preview__bubble">
            {snapshot.settings.overlayShowNickname ? (
              <span className="overlay-preview__name">{snapshot.settings.aiName}</span>
            ) : null}
            <span>{utterance.text}</span>
          </div>
        ))
      )}
    </div>
  );
};


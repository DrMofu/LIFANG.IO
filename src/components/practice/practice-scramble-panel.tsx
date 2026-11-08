"use client";
import { useLanguage } from "@/components/i18n/language-provider";
import { AlgorithmStepToken,type AlgorithmStepStatus } from "@/components/ui/algorithm-step-token";
import { MoveToken } from "@/components/ui/move-token";
import type { ScrambleStepStatus } from "@/lib/training/practice-model";

type PracticeScramblePanelProps = {
  moves: string[];
} & ({
  mode: "guided";
  index: number;
  statuses: ScrambleStepStatus[];
  wrong: boolean;
  undoDisplay: string[];
  undoExpected: string | undefined;
  onCancel(): void;
} | {
  mode: "manual";
  dailyProgress: number | null;
  dailyTarget: number;
  changeDisabled: boolean;
  onChange(): void;
});

export function PracticeScramblePanel(props: PracticeScramblePanelProps) {
  const { t } = useLanguage();
  return (
    <div className="stage-hint scramble-stage-hint ui-info-panel" role="status" aria-label={t("打乱公式")}>
      <div className="ui-section-head sh-head-scramble">
        <div className="ui-section-title-line">
          <div className="ui-section-title">{t("打乱公式")}</div>
          <span className="ui-section-kicker" aria-hidden="true">SCRAMBLE</span>
        </div>
        {props.mode === "guided" && props.undoDisplay.length > 0 && (
          <div className={`sh-notice sh-notice-inline${props.undoExpected ? " error" : ""}`}>
            <span className="sh-notice-label">{t("撤销提示：请依次转")}</span>
            <span className="sh-undo-list">
              {[...props.undoDisplay].reverse().map((move, index) => <MoveToken key={`${move}-${index}`} move={move} />)}
            </span>
          </div>
        )}
        <div className="sh-actions">
          {props.mode === "guided" ? (
            <>
              <div className="sh-counter">
                <span className="sh-counter-num">{props.index + 1}</span><span className="sh-counter-sep">/</span><span className="sh-counter-total">{props.moves.length}</span>
              </div>
              <button className="sh-cancel" onClick={props.onCancel} aria-label={t("取消打乱")}>{t("取消")}</button>
            </>
          ) : (
            <>
              {props.dailyProgress !== null && <div className="sh-counter">
                <span className="sh-counter-num">{props.dailyProgress + 1}</span><span className="sh-counter-sep">/</span><span className="sh-counter-total">{props.dailyTarget}</span>
              </div>}
              <button className="sh-cancel" onClick={props.onChange} disabled={props.changeDisabled} aria-label={t("更换打乱公式")}>{t("换一条")}</button>
            </>
          )}
        </div>
      </div>
      <div className="sh-grid">
        {props.moves.map((move, index) => {
          const status: AlgorithmStepStatus = props.mode === "manual" ? "pending"
            : index === props.index && (props.wrong || props.undoExpected) ? "wrong"
              : props.statuses[index] === "correct" ? "correct"
                : props.statuses[index] === "partial" ? "partial" : "pending";
          return <AlgorithmStepToken key={`${move}-${index}`} move={move} index={index} status={status} active={props.mode === "guided" && index === props.index} />;
        })}
      </div>
    </div>
  );
}

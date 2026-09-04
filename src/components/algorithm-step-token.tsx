import { MoveToken } from "@/components/move-token";

export type AlgorithmStepStatus = "pending" | "partial" | "correct" | "wrong";

type AlgorithmStepTokenProps = {
  move: string;
  index: number;
  status?: AlgorithmStepStatus;
  active?: boolean;
  showIndex?: boolean;
  className?: string;
};

export function AlgorithmStepToken({
  move,
  index,
  status = "pending",
  active = false,
  showIndex = true,
  className,
}: AlgorithmStepTokenProps) {
  return (
    <span
      className={[
        "algo-tok",
        status === "partial" ? "partial" : "",
        status === "correct" ? "done" : "",
        status === "wrong" ? "wrong" : "",
        active ? "next" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      {showIndex ? <span className="algo-tok-index">{index + 1}</span> : null}
      <MoveToken move={move} />
    </span>
  );
}

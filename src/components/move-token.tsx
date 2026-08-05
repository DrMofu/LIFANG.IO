type MoveTokenProps = {
  move: string;
  className?: string;
};

export function MoveToken({ move, className }: MoveTokenProps) {
  const face = move[0] ?? "";
  const suffix = move.slice(1);
  const hasPrimeTurn = suffix.includes("'");
  const hasDoubleTurn = suffix.includes("2");

  return (
    <span
      className={[
        "move-token",
        hasPrimeTurn ? "move-token-prime" : "",
        hasDoubleTurn ? "move-token-double" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      <span className="move-token-face">{face}</span>
      <span className="move-token-suffix">
        {[...suffix].map((character, index) => character === "'"
          ? <span className="move-token-prime-mark" key={`${character}-${index}`}>{character}</span>
          : <span className="move-token-turn-count" key={`${character}-${index}`}>{character}</span>)}
      </span>
    </span>
  );
}

"use client";
import { useLanguage } from "@/components/i18n/language-provider";
import { MoveToken } from "@/components/ui/move-token";
import { groupAlgorithmMoves,invertMoveNotation,parseAlgorithm,parseMoveNotation } from "@/lib/cube/algorithms";
import { FORMULAS } from "@/lib/formulas/formulas-data";

const MAX_STRUCTURE_NOTATION_MOVE_COUNT = 5;

const TRIGGER_NAME_BY_ALGORITHM = new Map(
  FORMULAS.triggers.items.flatMap((item) => {
    const triggers: Array<readonly [string, string]> = [
      ...(item.algo ? [[item.algo, item.name] as const] : []),
      ...(item.algos?.map((variant) => [variant.algo, variant.name] as const) ?? []),
    ];
    return triggers.map(([algorithm, name]) => [parseAlgorithm(algorithm).join("\u0000"), name] as const);
  }),
);

export function renderAlgorithmWithGroups(algo: string) {
  const parts = algo
    .split(/(\s+|[()])/)
    .filter((part) => part.length > 0 && !/^\s+$/.test(part));

  return parts.map((part, index) => {
    if (part === "(" || part === ")") {
      return (
        <span key={`${part}-${index}`} className={`algo-group-mark algo-group-${part === "(" ? "open" : "close"}`}>
          {part}
        </span>
      );
    }
    const move = parseMoveNotation(part);
    const tokenClassName = [
      parts[index - 1] === "(" ? "move-token-after-open" : "",
      parts[index + 1] === ")" ? "move-token-before-close" : "",
    ].filter(Boolean).join(" ");
    return move ? (
      <MoveToken key={`${part}-${index}`} move={part} className={tokenClassName} />
    ) : (
      <span key={`${part}-${index}`} className="algo-group-text">
        {part}
      </span>
    );
  });
}

export function FormulaDescription({ description }: { description?: string }) {
  const { t } = useLanguage();
  if (!description) return null;
  return <span className="formula-description">{t(description)}</span>;
}

function sequenceIsInverseOf(sequence: string[], source: string[]) {
  return sequence.length === source.length && sequence.every(
    (move, index) => move === invertMoveNotation(source[source.length - index - 1]),
  );
}

function getTriggerName(moves: string[]) {
  return TRIGGER_NAME_BY_ALGORITHM.get(
    moves
      .map((move) => parseMoveNotation(move)?.notation ?? move)
      .join("\u0000"),
  );
}

function formatAlgorithmPart(moves: string[]) {
  return getTriggerName(moves) ?? moves.join(" ");
}

function getCommutatorOrConjugateNotation(moves: string[]) {
  const normalizedMoves = moves.map((move) => parseMoveNotation(move)?.notation ?? move);
  const halfLength = normalizedMoves.length / 2;

  if (Number.isInteger(halfLength)) {
    for (let aLength = 1; aLength < halfLength; aLength += 1) {
      const bLength = halfLength - aLength;
      const a = normalizedMoves.slice(0, aLength);
      const b = normalizedMoves.slice(aLength, halfLength);
      const aInverse = normalizedMoves.slice(halfLength, halfLength + aLength);
      const bInverse = normalizedMoves.slice(halfLength + aLength);

      if (sequenceIsInverseOf(aInverse, a) && sequenceIsInverseOf(bInverse, b)) {
        return `[${formatAlgorithmPart(moves.slice(0, aLength))}, ${formatAlgorithmPart(moves.slice(aLength, aLength + bLength))}]`;
      }
    }
  }

  for (let aLength = 1; aLength * 2 < normalizedMoves.length; aLength += 1) {
    const a = normalizedMoves.slice(0, aLength);
    const aInverse = normalizedMoves.slice(-aLength);

    if (sequenceIsInverseOf(aInverse, a)) {
      return `[${formatAlgorithmPart(moves.slice(0, aLength))}: ${formatAlgorithmPart(moves.slice(aLength, -aLength))}]`;
    }
  }

  return undefined;
}

export function groupAlgorithmRows(algo: string) {
  return groupAlgorithmMoves(algo).map((row) => {
    const moves = row.moves.map(({ move }) => move);
    const triggerName = getTriggerName(moves);

    return {
      ...row,
      triggerName,
      structureNotation:
        triggerName || moves.length > MAX_STRUCTURE_NOTATION_MOVE_COUNT
          ? undefined
          : getCommutatorOrConjugateNotation(moves),
    };
  });
}

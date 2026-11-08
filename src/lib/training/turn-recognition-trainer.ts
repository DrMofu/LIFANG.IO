export type TurnRecognitionOptions = {
  includeSlices: boolean;
  includeWideMoves: boolean;
};

const BASIC_TURNS = ["U", "U'", "D", "D'", "F", "F'", "B", "B'", "L", "L'", "R", "R'"];
const SLICE_TURNS = ["M", "M'", "E", "E'", "S", "S'"];
const WIDE_TURNS = ["u", "u'", "d", "d'", "f", "f'", "b", "b'", "l", "l'", "r", "r'"];

function turnLayer(move: string) {
  return move[0] ?? move;
}

export function turnRecognitionPool(options: TurnRecognitionOptions) {
  return [
    ...BASIC_TURNS,
    ...(options.includeSlices ? SLICE_TURNS : []),
    ...(options.includeWideMoves ? WIDE_TURNS : []),
  ];
}

export function nextTurnRecognitionMove(
  options: TurnRecognitionOptions,
  previousMove: string | null,
  random = Math.random,
) {
  const pool = turnRecognitionPool(options);
  const previousLayer = previousMove ? turnLayer(previousMove) : null;
  const candidates = pool.length > 1 && previousMove
    ? pool.filter((move) => turnLayer(move) !== previousLayer)
    : pool;
  return candidates[Math.floor(random() * candidates.length)] ?? BASIC_TURNS[0];
}

export function createTurnRecognitionSequence(
  options: TurnRecognitionOptions,
  count: number,
  previousMove: string | null = null,
  random = Math.random,
) {
  const moves: string[] = [];
  let previous = previousMove;
  for (let index = 0; index < Math.max(0, count); index += 1) {
    const move = nextTurnRecognitionMove(options, previous, random);
    moves.push(move);
    previous = move;
  }
  return moves;
}

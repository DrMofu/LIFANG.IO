import { MoveToken } from "@/components/move-token";

const FORMULA_KEYPAD_GROUPS = [
  { id: "face", label: "FACE", moves: ["U", "U'", "D", "D'", "L", "L'", "R", "R'", "F", "F'", "B", "B'"] },
  { id: "rotate", label: "ROTATE", moves: ["x", "x'", "y", "y'", "z", "z'"] },
  { id: "wide", label: "WIDE", moves: ["u", "u'", "d", "d'", "l", "l'", "r", "r'", "f", "f'", "b", "b'"] },
  { id: "slice", label: "SLICE", moves: ["M", "M'", "E", "E'", "S", "S'"] },
] as const;

type FormulaKeypadGroupId = (typeof FORMULA_KEYPAD_GROUPS)[number]["id"];

type FormulaKeypadProps = {
  ariaLabel: string;
  hasMoves?: boolean;
  onMove(move: string): void;
  onDelete?(): void;
  onClear?(): void;
  deleteLabel?: string;
  clearLabel?: string;
  moveLabel?: string;
  groupLabels?: Partial<Record<FormulaKeypadGroupId, string>>;
  selectedMove?: string | null;
  showEditControls?: boolean;
};

export function FormulaKeypad({
  ariaLabel,
  hasMoves,
  onMove,
  onDelete,
  onClear,
  deleteLabel = "删除",
  clearLabel = "清空",
  moveLabel = "转动",
  groupLabels,
  selectedMove,
  showEditControls = true,
}: FormulaKeypadProps) {
  return (
    <div className="formula-keypad" aria-label={ariaLabel}>
      {FORMULA_KEYPAD_GROUPS.map((group) => (
        <div className="formula-keypad-group" key={group.id}>
          <div className="formula-keypad-label">{groupLabels?.[group.id] ?? group.label}</div>
          <div className="formula-keypad-grid">
            {group.moves.map((move) => {
              const selected = selectedMove === move;
              return (
                <button
                  key={move}
                  className={`formula-keypad-btn${selected ? " is-selected" : ""}`}
                  type="button"
                  aria-label={`${moveLabel} ${move}`}
                  aria-pressed={selectedMove === undefined ? undefined : selected}
                  onClick={() => onMove(move)}
                >
                  <MoveToken move={move} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {showEditControls ? (
        <div className="formula-keypad-group">
          <div className="formula-keypad-label">EDIT</div>
          <div className="formula-keypad-actions">
            <button
              className="formula-keypad-delete"
              type="button"
              onClick={onDelete}
              disabled={!hasMoves || !onDelete}
            >
              {deleteLabel}
            </button>
            <button
              className="formula-keypad-clear"
              type="button"
              onClick={onClear}
              disabled={!hasMoves || !onClear}
            >
              {clearLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

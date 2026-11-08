// Keep the latest move for 45ms so facelet updates can reconcile with animation.
// Each page supplies its own renderer and decides whether to flush or discard.
export class PendingMoveQueue {
  private pending: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private renderMove: ((move: string) => void) | null = null;

  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  push = (move: string, renderMove: (move: string) => void) => {
    const previous = this.pending;
    this.clearTimer();
    if (previous !== null) this.renderMove?.(previous);
    this.renderMove = renderMove;
    this.pending = move;
    this.timer = setTimeout(this.flush, 45);
  };

  flush = () => {
    const move = this.pending;
    const renderMove = this.renderMove;
    this.discard();
    if (move !== null) renderMove?.(move);
  };

  discard = () => {
    this.clearTimer();
    this.pending = null;
    this.renderMove = null;
  };

  hasPending = () => this.pending !== null;
}

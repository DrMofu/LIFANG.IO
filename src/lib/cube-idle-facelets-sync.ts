import { isCubeSerialAfter, normalizeCubeSerial } from "./cube-serial";

/** Keep only a snapshot that includes every move, and apply it between animations. */
export class CubeIdleFaceletsSync {
  private latestSerial: number | null = null;
  private pending: string | null = null;

  reset() {
    this.latestSerial = null;
    this.pending = null;
  }

  recordMove(serial: number) {
    this.latestSerial = normalizeCubeSerial(serial);
    this.pending = null;
  }

  receive(facelets: string, serial: number) {
    const normalized = normalizeCubeSerial(serial);
    if (this.latestSerial !== null && normalized !== this.latestSerial && !isCubeSerialAfter(this.latestSerial, normalized)) return;
    this.latestSerial = normalized;
    this.pending = facelets;
  }

  flush(isBusy: boolean, apply: (facelets: string) => boolean) {
    if (this.pending === null) return false;
    if (isBusy) return true;
    if (apply(this.pending)) this.pending = null;
    return this.pending !== null;
  }
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { CubeIdleFaceletsSync } from "./cube-idle-facelets-sync";

test("MOVE followed by FACELETS never interrupts pending or running animation", () => {
  const sync = new CubeIdleFaceletsSync();
  const applied: string[] = [];
  const apply = (value: string) => { applied.push(value); return true; };
  sync.recordMove(10);
  sync.receive("state-10", 10);
  assert.equal(sync.flush(true, apply), true);
  assert.deepEqual(applied, []);
  sync.recordMove(11);
  sync.receive("state-11", 11);
  assert.equal(sync.flush(true, apply), true);
  assert.deepEqual(applied, []);
  assert.equal(sync.flush(false, apply), false);
  assert.deepEqual(applied, ["state-11"]);
});

test("a newer turn invalidates the queued snapshot and rejects late older snapshots", () => {
  const sync = new CubeIdleFaceletsSync();
  sync.receive("old", 20);
  sync.recordMove(21);
  sync.receive("late-old", 20);
  assert.equal(sync.flush(false, () => assert.fail("must not rewind to an older state")), false);
  sync.receive("latest", 21);
  sync.flush(false, (value) => { assert.equal(value, "latest"); return true; });
});

test("serial rollover still rejects stale state and accepts the latest correction", () => {
  const sync = new CubeIdleFaceletsSync();
  sync.recordMove(255);
  sync.recordMove(0);
  sync.receive("stale", 255);
  assert.equal(sync.flush(false, () => assert.fail("stale snapshot")), false);
  sync.receive("corrected", 0);
  sync.flush(false, (value) => { assert.equal(value, "corrected"); return true; });
});

test("reconnect clears the old serial and applies the initial hardware state", () => {
  const sync = new CubeIdleFaceletsSync();
  sync.recordMove(50);
  sync.receive("previous connection", 50);
  sync.reset();
  sync.receive("new connection", 0);
  sync.flush(false, (value) => { assert.equal(value, "new connection"); return true; });
});

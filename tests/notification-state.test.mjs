import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const filename = fileURLToPath(new URL("../src/lib/notification-state.ts", import.meta.url));
const compiled = new Module(filename);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText, filename);
const { notificationReducer: reduce, INITIAL_NOTIFICATION_STATE: initial, getVisibleNotification: visible, NOTICE_DURATION_MS, formatNoticeMessage } = compiled.exports;
const notice = (id, kind = "info", key = "default", owner = "page") => ({ id, kind, key, owner, message: id });
const show = (state, entry) => reduce(state, { type: "show", notice: entry });
const start = (state, entry) => reduce(state, { type: "start", notice: entry });

test("single-sentence notices omit the final period in both languages", () => {
  assert.equal(formatNoticeMessage("请先连接智能魔方，再使用智能求解。"), "请先连接智能魔方，再使用智能求解");
  assert.equal(formatNoticeMessage("Upload complete."), "Upload complete");
  assert.equal(formatNoticeMessage("Finished in 1.25 seconds."), "Finished in 1.25 seconds");
  assert.equal(formatNoticeMessage(" 已上传当前存档到云端。 "), "已上传当前存档到云端");
});

test("notice punctuation preserves exclamations, questions, ellipses and multiple sentences", () => {
  for (const text of ["打破最佳成绩！", "New best!", "是否继续？", "Continue?", "正在上传…", "Loading...", "上传失败。请重试。", "Upload failed. Please retry."]) {
    assert.equal(formatNoticeMessage(text), text);
  }
});

test("ordinary results use 3.5 seconds and stale expiry cannot dismiss a newer repeat", () => {
  assert.equal(NOTICE_DURATION_MS, 3500);
  let state = show(initial, notice("first", "warning"));
  state = show(state, notice("repeat", "warning"));
  state = reduce(state, { type: "expire", id: "first" });
  assert.equal(visible(state).id, "repeat");
  assert.equal(visible(reduce(state, { type: "expire", id: "repeat" })), null);
});

test("different events respect priority; equal priority uses the newest result", () => {
  let state = show(initial, notice("error", "error", "solve"));
  state = show(state, notice("success", "success", "copy"));
  assert.equal(visible(state).id, "error");
  assert.equal(visible(show(state, notice("latest-error", "error", "copy"))).id, "latest-error");
});

test("a retry replaces the error from the same event", () => {
  let state = show(initial, notice("failed", "error", "upload"));
  state = start(state, notice("retry", "info", "upload"));
  assert.equal(visible(state).id, "retry");
  state = reduce(state, { type: "finish", owner: "page", taskId: "retry", notice: notice("uploaded", "success") });
  assert.equal(visible(state).id, "uploaded");
  assert.equal(state.tasks.length, 0);
});

test("progress has no expiry, resists ordinary success, and returns after a warning", () => {
  let state = start(initial, notice("uploading"));
  state = reduce(state, { type: "expire", id: "uploading" });
  state = show(state, notice("copied", "success", "copy"));
  assert.equal(visible(state).id, "uploading");
  state = show(state, notice("warning", "warning", "gyro"));
  assert.equal(visible(state).id, "warning");
  state = reduce(state, { type: "expire", id: "warning" });
  assert.equal(visible(state).id, "uploading");
});

test("obsolete task results cannot complete a replacement task", () => {
  let state = start(initial, notice("old", "info", "upload"));
  state = start(state, notice("new", "info", "upload"));
  state = reduce(state, { type: "finish", owner: "page", taskId: "old", notice: notice("stale", "error") });
  assert.equal(visible(state).id, "new");
  assert.equal(state.tasks.length, 1);
});

test("an older concurrent task finishing does not replace the newer progress", () => {
  let state = start(initial, notice("old", "info", "upload"));
  state = start(state, notice("new", "info", "refresh"));
  state = reduce(state, { type: "finish", owner: "page", taskId: "old", notice: notice("old-success", "success") });
  assert.equal(visible(state).id, "new");
});

test("the current task result replaces its progress even if another task remains", () => {
  let state = start(initial, notice("old", "info", "upload"));
  state = start(state, notice("new", "info", "refresh"));
  state = reduce(state, { type: "finish", owner: "page", taskId: "new", notice: notice("refreshed", "success") });
  assert.equal(visible(state).id, "refreshed");
  state = reduce(state, { type: "expire", id: "refreshed" });
  assert.equal(visible(state).id, "old");
});

test("a modal hides and discards transient results but preserves active tasks", () => {
  let state = start(initial, notice("uploading"));
  state = show(state, notice("warning", "warning"));
  state = reduce(state, { type: "block", blocked: true });
  state = show(state, notice("hidden", "error"));
  assert.equal(visible(state), null);
  state = reduce(state, { type: "block", blocked: false });
  assert.equal(visible(state).id, "uploading");
  state = reduce(state, { type: "finish", owner: "page", taskId: "uploading", notice: notice("success", "success") });
  state = reduce(state, { type: "block", blocked: false });
  assert.equal(visible(state).id, "success");
});

test("cancellation ends progress without an error; results cannot finish another owner's task", () => {
  let state = start(initial, notice("uploading"));
  state = reduce(state, { type: "finish", owner: "other", taskId: "uploading", notice: notice("wrong", "error") });
  assert.equal(visible(state).id, "uploading");
  state = reduce(state, { type: "finish", owner: "page", taskId: "uploading" });
  assert.equal(visible(state), null);
});

test("page cleanup clears its messages and tasks without clearing another owner", () => {
  let state = start(initial, notice("page-task"));
  state = start(state, notice("other-task", "info", "default", "other"));
  state = show(state, notice("page-error", "error"));
  state = reduce(state, { type: "dismiss", owner: "page" });
  assert.equal(visible(state).id, "other-task");
  assert.equal(state.notice, null);
  assert.equal(state.tasks.length, 1);
});

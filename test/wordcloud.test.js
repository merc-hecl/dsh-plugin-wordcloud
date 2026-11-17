import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { apply } from "../src/host.js";
import { collect } from "../src/statistics.js";

function user(id, text, kind = "user") {
  return { role: "user", id, source: { kind }, content: [{ type: "text", text }] };
}
const event = (type, data) => ({ type, data });
const turn = (n, ...entries) => [
  event("turn/start", { turn: n }),
  ...entries.map((data) => event("user/message", data)),
  event("turn/end", { turn: n }),
];
const log = (events, inheritedEventCount = 0) => ({ events, inheritedEventCount });
function corpus(logs) {
  return {
    async listSessions() {
      return Object.keys(logs).map((id) => ({ header: { id } }));
    },
    async readSession(id) {
      if (!logs[id]) throw new Error("unreadable");
      return logs[id];
    },
  };
}

test("counts distinct authored messages with their actual rounds and ignores inherited copies and quotes", async () => {
  const first = user("first", "检查构建。检查构建。\n\n> 引用毒饵\n隐蔽毒饵\n\n<blockquote>网页毒饵</blockquote>");
  first.content.push({ type: "quote", text: "结构毒饵" }, { type: "file", text: "附件毒饵" });
  const prefix = [
    event("agent/inbox/spliced", { inserted: [first] }),
    ...turn(1, first, user("schedule", "注入毒饵", "schedule")),
    event("assistant/message", { message: { role: "assistant", content: [{ type: "text", text: "回复毒饵" }] } }),
  ];
  const logs = {
    parent: log(prefix),
    branch: log([...prefix, ...turn(12, user("later", "检查构建。"))], prefix.length),
    queued: log([event("agent/inbox/spliced", { inserted: [user("pending", "检查构建。")] })]),
    damaged: null,
  };
  const result = await collect(corpus(logs), new AbortController().signal, () => {});
  assert.deepEqual([result.sessions, result.messages, result.skipped], [3, 3, 1]);
  assert.deepEqual(result.words.find((row) => row.text === "构建"), {
    text: "构建", count: 3, unplaced: 1, turns: [[1, 1], [12, 1]],
  });
  assert.deepEqual(result.words.map((row) => row.text).sort(), ["检查", "构建"].sort());
  assert.ok(!JSON.stringify(result).includes("毒饵"));
});

test("segments Japanese, Thai, and mixed Chinese and English words", async () => {
  const text = "変更内容を確認する。ภาษาไทยไม่มีช่องว่าง。检查 API 文档。";
  const events = [...turn(1, user("one", text)), ...turn(2, user("two", text))];
  const result = await collect(corpus({ one: log(events) }), new AbortController().signal, () => {});
  const words = new Set(result.words.map((row) => row.text));
  for (const word of ["変更", "確認", "ภาษา", "ช่อง", "检查", "api", "文档"]) assert.ok(words.has(word), word);
  assert.ok(!words.has("変"));
});

test("a saved overdue schedule runs on startup, persists results, and can be switched off", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "dsh-wordcloud-"));
  const previousHome = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  const dir = join(home, "storages");
  const file = join(dir, "wordcloud.json");
  await mkdir(dir);
  await writeFile(file, JSON.stringify({ version: 1, interval: 1, nextAt: Date.now() - 1000, result: null, failedAt: null }));
  let route, dispose;
  t.after(async () => {
    await dispose?.();
    if (previousHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousHome;
    await rm(home, { recursive: true, force: true });
  });
  await apply({
    connection: { fetch: { register(value) { route = value; } } },
    effect(initializer) { dispose = initializer(); },
    sessionQuery: corpus({ one: log(turn(1, user("msg", "检查构建"))) }),
  });
  const request = (method, body) => route.fetch(new Request("http://localhost/api/wordcloud", {
    method, ...(body && { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
  }));
  const deadline = Date.now() + 3000;
  let state;
  do {
    state = await (await request("GET")).json();
    if (state.result) break;
    await setTimeout(15);
  } while (Date.now() < deadline);
  assert.ok(state.result, "overdue schedule should finish");
  assert.equal(state.result.messages, 1);
  assert.ok(state.nextAt > Date.now());
  assert.equal((await request("PATCH", { interval: 0 })).status, 200);
  const stored = JSON.parse(await readFile(file, "utf8"));
  assert.equal(stored.nextAt, null);
  assert.deepEqual(stored.result, state.result);
});

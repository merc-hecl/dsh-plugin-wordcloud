import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { collect } from "./statistics.js";

export const name = "wordcloud";
export const inject = ["connection", "sessionQuery"];

const hour = 3_600_000;
const intervals = [0, 1, 24, 168];
const empty = { version: 1, interval: 0, nextAt: null, result: null, failedAt: null };

async function load(file) {
  let state;
  try { state = JSON.parse(await readFile(file, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return empty;
    throw error;
  }
  if (state?.version !== 1 || !intervals.includes(state.interval) ||
      (state.interval > 0 && !Number.isFinite(state.nextAt))) throw new Error("Invalid wordcloud state");
  return state;
}

async function save(file, state) {
  const temp = `${file}.${randomUUID()}.tmp`;
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  try {
    await writeFile(temp, JSON.stringify(state) + "\n", { mode: 0o600, flag: "wx" });
    await rename(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
}

export async function apply(ctx) {
  const file = join(resolve(process.env.DSH_HOME?.trim() || join(homedir(), ".dsh")), "storages", "wordcloud.json");
  const stop = new AbortController();
  let timer, job, progress, problem;
  let queue = Promise.resolve();
  const initial = load(file);
  // Keep a damaged file intact and surface it through the panel.
  let state;
  initial.then((value) => { state = value; arm(); }, () => { problem = "storage"; });
  ctx.effect(() => () => {
    stop.abort();
    clearTimeout(timer);
    return Promise.allSettled([job, queue]);
  }, "wordcloud: shutdown");

  function commit(update) {
    const write = queue.then(async () => {
      const updated = update(state);
      if (updated === state) return;
      await save(file, updated);
      state = updated;
    });
    queue = write.catch(() => {});
    return write;
  }

  function arm(retry = false) {
    clearTimeout(timer);
    if (stop.signal.aborted || job || !state?.nextAt) return;
    timer = setTimeout(start, retry ? Math.max(60_000, state.nextAt - Date.now()) : Math.max(0, state.nextAt - Date.now()));
    timer.unref();
  }

  function start() {
    if (job || stop.signal.aborted) return;
    clearTimeout(timer);
    problem = null;
    progress = { visited: 0, total: null };
    job = run().finally(() => {
      job = null;
      progress = null;
      arm(problem === "storage");
    });
  }

  async function run() {
    let result;
    try {
      result = await collect(ctx.sessionQuery, stop.signal, (visited, total) => { progress = { visited, total }; });
    } catch {
      if (stop.signal.aborted) return;
    }
    if (stop.signal.aborted) return;
    const finished = Date.now();
    try {
      await commit((prev) => ({
        ...prev,
        nextAt: prev.nextAt && prev.nextAt <= finished ? finished + hour * prev.interval : prev.nextAt,
        result: result ? { ...result, at: finished } : prev.result,
        failedAt: result ? null : finished,
      }));
    } catch {
      problem = "storage";
    }
  }

  const json = (data, status = 200) => Response.json(data, {
    status, headers: { "Cache-Control": "no-store" },
  });
  const snapshot = () => ({
    interval: state.interval, nextAt: state.nextAt, result: state.result,
    problem: problem ?? (state.failedAt ? "scan" : null), progress,
  });
  ctx.connection.fetch.register({
    path: "/api/wordcloud",
    methods: ["GET", "POST", "PATCH"],
    requestBody: "buffered",
    async fetch(request) {
      try { await initial; }
      catch { return json({ problem: "storage" }, 500); }
      if (request.method === "POST") {
        start();
        return json(snapshot(), 202);
      }
      if (request.method === "PATCH") {
        const body = await request.json().catch(() => null);
        if (!intervals.includes(body?.interval)) return json({ problem: "interval" }, 400);
        const interval = body.interval;
        try {
          await commit((prev) => prev.interval === interval ? prev : {
            ...prev, interval, nextAt: interval ? Date.now() + hour * interval : null,
          });
        } catch {
          return json({ problem: "storage" }, 500);
        }
        arm(problem === "storage");
      }
      return json(snapshot());
    },
  });
}

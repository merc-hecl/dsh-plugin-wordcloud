import { fromMarkdown } from "mdast-util-from-markdown";
import { setImmediate } from "node:timers/promises";
import { tokenize } from "./tokenize.js";

const limit = 60;
const useful = (word) => /\p{L}/u.test(word) && word.length <= 40;

// An explicit quote carries no author information in Markdown. Exclude the
// whole block, including lazy continuation lines, rather than guessing who wrote it.
function* authoredText(node) {
  switch (node.type) {
    case "blockquote":
    case "code":
    case "html":
    case "definition":
    case "image":
    case "imageReference":
      yield "\n";
      return;
    case "text":
    case "inlineCode":
      yield node.value;
      return;
    case "link":
      if (/^(?:https?:|dsh:|file:)/i.test(node.url) &&
          node.children.length === 1 && node.children[0].value === node.url) return;
      break;
  }
  for (const child of node.children ?? []) yield* authoredText(child);
  if (["paragraph", "heading", "listItem", "break"].includes(node.type)) yield "\n";
}

function wordsIn(content) {
  const words = new Set();
  for (const block of content) {
    if (block.type !== "text") continue;
    const body = block.text.replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote\s*>/gi, "\n");
    const text = [...authoredText(fromMarkdown(body))].join("").normalize("NFKC").toLowerCase()
      .replace(/\b(?:https?:\/\/|www\.)\S+/gi, " ");
    for (const clause of text.split(/[^\p{L}\p{M}\p{N}\p{Zs}'’-]+/u)) {
      for (const word of tokenize(clause)) if (useful(word)) words.add(word);
    }
  }
  return words;
}

function isHuman(message) {
  return message?.role === "user" && message.source?.kind === "user";
}

function* ownedMessages({ events, inheritedEventCount }) {
  const inherited = new Set();
  const messages = new Map();
  let turn = null;
  for (let index = 0; index < events.length; index++) {
    const { type, data } = events[index];
    if (type === "turn/start") turn = data.turn;
    else if (type === "turn/end") turn = null;
    else if (type === "user/message" || type === "agent/inbox/spliced") {
      const entered = type === "user/message";
      for (const message of entered ? [data] : data.inserted) {
        if (!isHuman(message)) continue;
        if (index < inheritedEventCount) inherited.add(message.id);
        else if (!inherited.has(message.id) && (entered || messages.get(message.id)?.turn == null))
          messages.set(message.id, { content: message.content, turn: entered ? turn : null });
      }
    }
  }
  yield* messages.values();
}

function add(map, terms, turn) {
  for (const term of terms) {
    const entry = map.get(term);
    if (!entry) map.set(term, { count: 1, first: turn, others: null });
    else {
      entry.count++;
      if (entry.first !== turn || entry.others) {
        const histogram = entry.others ??= new Map([[entry.first, entry.count - 1]]);
        histogram.set(turn, (histogram.get(turn) ?? 0) + 1);
      }
    }
  }
}

function ranked(map) {
  const top = [...map].sort(([a, x], [b, y]) => y.count - x.count || a.localeCompare(b, "zh"));
  return top.slice(0, limit).map(([text, entry]) => {
    const histogram = entry.others ?? new Map([[entry.first, entry.count]]);
    return {
      text, count: entry.count, unplaced: histogram.get(null) ?? 0,
      turns: [...histogram].filter(([turn]) => turn !== null).sort(([a], [b]) => a - b),
    };
  });
}

export async function collect(query, signal, progress) {
  const records = await query.listSessions(signal);
  const words = new Map();
  let sessions = 0, messages = 0, skipped = 0, visited = 0;
  for (const { header } of records) {
    signal.throwIfAborted();
    let log;
    try { log = await query.readSession(header.id); }
    catch { skipped++; }
    if (log) {
      let count = 0;
      for (const { content, turn } of ownedMessages(log)) {
        add(words, wordsIn(content), turn);
        if (++count % 40 === 0) await setImmediate(undefined, { signal });
      }
      if (count) sessions++;
      messages += count;
    }
    progress(++visited, records.length);
    await setImmediate(undefined, { signal });
  }
  if (skipped && skipped === records.length) throw new Error("No session could be read");
  return { sessions, messages, skipped, words: ranked(words) };
}

import { francAll } from "franc";
import { tag } from "jieba-wasm";
import * as stopword from "stopword";

const wordSegmenter = new Intl.Segmenter("und", { granularity: "word" });
const japaneseSegmenter = new Intl.Segmenter("ja", { granularity: "word" });
const kana = /[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]/u;
const hanOnly = /^\p{Script=Han}+$/u;
const hanKanaRuns = /[\p{Script=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]+|[^\p{Script=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]+/gu;
const chineseFunctionWord = /^[cupreoymq]/;

const scripts = Object.entries({
  Latin: null, Cyrillic: null, Arabic: null, Devanagari: null,
  Hangul: "kor", Thai: "tha", Bengali: "ben", Greek: "ell", Hebrew: "heb",
  Armenian: "hye", Gujarati: "guj", Gurmukhi: "panGu", Myanmar: "mya",
}).map(([script, language]) => ({ script, pattern: new RegExp(`\\p{Script=${script}}`, "u"), language }));

const englishShort = "a an the i you he she it we they me my your his her its our their to of in on for at from by with " +
  "and or but as is are was were be been do does did can could would should will have has had this that these those " +
  "ok okay please thanks";
const extraStopwords = {
  ara: "لأن فضلك فضلا رجاء",
  eng: `${englishShort} actually again already anyway just maybe really so yes ` +
    "i'm you're he's she's it's we're they're i've you've we've they've i'll you'll we'll they'll " +
    "isn't aren't wasn't weren't don't doesn't didn't can't couldn't won't wouldn't shouldn't " +
    "haven't hasn't hadn't let's that's what's there's",
  deu: "bitte",
  fas: "لطفا این کنید",
  fra: "puis parce encore c'est j'ai j'en j'y qu'il qu'elle qu'on s'il s'ils s'il-vous-plaît",
  hin: "कृपया क्योंकि",
  jpn: "ください くだ さい よろしく",
  kor: "다시 주세요",
  rus: "пожалуйста ещё еще",
  spa: "favor aún aun si aunque sin sobre también pero y ni o",
  ukr: "будь ласка тому знову",
  zho: "一个 一下 这个 那个 这些 那些 一些 我们 你们 他们 自己 什么 怎么 如何 以及 如果 因为 所以 这样 可以 " +
    "這個 那個 這些 那些 我們 你們 他們 什麼 怎麼 為什麼 因為 所以 這樣 可以 " +
    "现在 現在 已经 已經 继续 繼續 没有 沒有 看看 再 但是 不过 不過 还是 還是 还有 還有 " +
    "能不能 是不是 这次 這次 上次 后 後 然后 然後 目前 刚才 剛才 给 給 让 讓 能 想 可 会 會",
};

function lookupForm(word) {
  const normalized = word.normalize("NFKC").toLowerCase().replaceAll("’", "'");
  if (/\p{Script=Greek}/u.test(normalized)) return normalized.normalize("NFD").replace(/\p{M}/gu, "");
  if (/\p{Script=Arabic}/u.test(normalized)) return normalized.replace(/[\u0640\u064B-\u0652\u0670]/gu, "");
  return normalized;
}

const englishFallback = new Set(englishShort.split(" "));
const dictionaries = new Map();
for (const [code, words] of Object.entries(stopword)) {
  if (!Array.isArray(words) || code === "_123") continue;
  const language = ({ porBr: "por", lggNd: "lgg" })[code] ?? code;
  const dictionary = dictionaries.get(language) ?? new Set();
  for (const word of words) dictionary.add(lookupForm(word));
  for (const word of (extraStopwords[language] ?? "").split(" ")) {
    if (word) dictionary.add(lookupForm(word));
  }
  dictionaries.set(language, dictionary);
}

const wordLanguages = new Map();
for (const [language, dictionary] of dictionaries) {
  if (language === "zho" || language === "jpn") continue;
  for (const word of dictionary) {
    const languages = wordLanguages.get(word) ?? [];
    languages.push(language);
    wordLanguages.set(word, languages);
  }
}

function inferLanguage(words) {
  const evidence = new Map();
  for (const word of new Set(words)) {
    const languages = wordLanguages.get(word);
    if (!languages) continue;
    // Shared spellings are weaker evidence than words specific to one language.
    const weight = 1 / Math.sqrt(languages.length);
    for (const language of languages) {
      const entry = evidence.get(language) ?? { language, score: 0, matches: 0 };
      entry.score += weight;
      entry.matches++;
      evidence.set(language, entry);
    }
  }
  const [best, next] = [...evidence.values()].sort((a, b) => b.score - a.score);
  if (!best || best.matches < 2) return;
  if (best.score - (next?.score ?? 0) >= 0.5) return best.language;

  // Use the text model to break close calls only when the words corroborate it.
  const [[code, score], [, runnerUp] = [null, 0]] = francAll(words.slice(0, 60).join(" "), { minLength: 16 });
  const language = ({ arb: "ara", pes: "fas", zlm: "msa" })[code] ?? code;
  const match = evidence.get(language);
  if (match?.matches >= 2 && best.score - match.score < 0.5 && score - runnerUp >= 0.08) return language;
}

function* wordsFrom(text, segmenter) {
  for (const { segment, isWordLike } of segmenter.segment(text)) {
    if (isWordLike) yield segment;
  }
}

export function* tokenize(clause) {
  const hasKana = kana.test(clause);
  const groups = new Map();
  for (const [span] of clause.matchAll(hanKanaRuns)) {
    if (hanOnly.test(span) || kana.test(span)) {
      // Kana in the same clause also provides context for standalone kanji runs.
      if (hasKana) {
        for (const word of wordsFrom(span, japaneseSegmenter)) {
          if (!dictionaries.get("jpn").has(lookupForm(word))) yield word;
        }
      } else {
        for (const { word, tag: kind } of tag(span, true)) {
          if (!chineseFunctionWord.test(kind) && !dictionaries.get("zho").has(word)) yield word;
        }
      }
      continue;
    }
    for (const word of wordsFrom(span, wordSegmenter)) {
      const script = scripts.find(({ pattern }) => pattern.test(word));
      const words = groups.get(script) ?? [];
      words.push(word);
      groups.set(script, words);
    }
  }

  for (const [script, words] of groups) {
    const normalized = words.map(lookupForm);
    const language = script?.language ?? inferLanguage(normalized);
    const stop = dictionaries.get(language) ?? (script?.script === "Latin" ? englishFallback : null);
    for (let i = 0; i < words.length; i++) {
      if (!stop?.has(normalized[i])) yield words[i];
    }
  }
}

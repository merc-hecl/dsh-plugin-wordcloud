// Adapted from the release script in merc-hecl/dsh-minicad.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { generateMarkDown, getGitDiff, getRepoConfig, parseCommits } from "changelogen";

const stableTag = /^v\d+\.\d+\.\d+$/;
const types = Object.fromEntries(Object.entries({
  feat: "Enhancements",
  perf: "Performance",
  fix: "Fixes",
  refactor: "Refactors",
  docs: "Documentation",
  build: "Build",
  chore: "Chore",
  test: "Tests",
  style: "Styles",
  ci: "CI",
}).map(([type, title]) => [type, { title }]));

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const [tag, output, ...extra] = process.argv.slice(2);
if (!stableTag.test(tag ?? "") || !output || extra.length) {
  throw new Error("Usage: node scripts/release-notes.mjs <vX.Y.Z> <output.md>");
}
if (git("rev-parse", "--is-shallow-repository") === "true") {
  throw new Error("Release notes require full Git history (fetch-depth: 0)");
}

const pkg = JSON.parse(git("show", `refs/tags/${tag}:package.json`));
if (tag !== `v${pkg.version}`) throw new Error("Release tag must match package.json version");

const tags = git("tag", "--merged", tag, "--sort=-version:refname", "--list", "v*")
  .split(/\r?\n/).filter((entry) => stableTag.test(entry));
const previous = tags[tags.indexOf(tag) + 1];
const config = {
  from: previous,
  to: tag,
  newVersion: pkg.version,
  types,
  scopeMap: {},
  repo: getRepoConfig(pkg.repository.url),
  templates: { tagBody: "v{{newVersion}}" },
  noAuthors: true,
};

const changes = await getGitDiff(previous, tag);
const commits = parseCommits(changes, config)
  .map((commit) => ({ ...commit, type: commit.type.toLowerCase(), author: undefined }))
  .filter((commit) => types[commit.type]);
const notes = (await generateMarkDown(commits, config))
  .replace(/^## [^\n]+\n*/, "")
  .replace(/^#### ⚠️ Breaking Changes$/m, "#### Breaking Changes")
  .trim();

const contributors = new Set();
for (const commit of changes) {
  const names = [commit.author?.name, ...Array.from(
    commit.body.matchAll(/^Co-authored-by:\s*(.+?)\s*<[^>]+>\s*$/gim), (match) => match[1],
  )];
  for (const name of names) {
    const label = name?.trim();
    if (label && !label.includes("[bot]")) contributors.add(`- ${label.replace(/[\\\x60*_[\]<>]/g, "\\$&")}`);
  }
}

const sections = contributors.size ? [notes, "### Contributors", [...contributors].join("\n")] : [notes];
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${sections.filter(Boolean).join("\n\n")}\n`, "utf8");

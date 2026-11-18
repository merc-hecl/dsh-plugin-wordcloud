# DSH Word Cloud

[简体中文](README.md) · English

Open **Word Cloud** in the DeepSeek Harness sidebar to see word frequencies in user messages. Select a word to see which conversation turns it appears in most often and their shares. Run an analysis manually or schedule it hourly, every 24 hours, or every 7 days.

## Install

Node.js 22.19 or later is required. Once a release is available, use **Plugins → Install** on desktop and enter `dsh-plugin-wordcloud`. On web, put `pnpm` on PATH and run the following command.

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-plugin-wordcloud -w
```

Enable the plugin on desktop and restart DSH if prompted. On web, restart DSH after installing.

For offline installation, download the `.tgz` from [GitHub Releases](https://github.com/merc-hecl/dsh-plugin-wordcloud/releases). Extract the entire archive, including `node_modules`, and install it in DSH with `link:<absolute path to the extracted package directory>`.

You can also build the package from source at the project root.

```sh
npm ci
npm pack
```

- On **desktop**, open **Plugins → Install**, enter `file:<absolute path to the package>`, and enable the plugin. Restart DSH if prompted.
- For **web**, make sure `pnpm` is on PATH. Replace the placeholder below with the generated `.tgz` path and restart DSH after installing.

```sh
npx @deepseek-ai/dsh plugin --profile web add "file:<absolute path to the package>" -w
```

For local development, run `npm run build` and install with `link:<absolute path to the source directory>`.

Maintainers can follow the [release process](AGENTS.md#releases).

## How counts work

- The plugin reads user message text from conversations available to DSH. Agent replies, automatically injected content, block quotes, and attachments are excluded. Content pasted as plain text is counted.
- Script and context determine which stop-word list filters common conjunctions, particles, and conversational filler. Chinese also uses part-of-speech tags. Filtering is conservative when the language is uncertain.
- The multilingual stop-word lists come from [`stopword`](https://github.com/fergiemcdowall/stopword).
- Each word counts at most once per message. Turn shares use matching messages with a recorded turn and display two decimal places.
- Analysis runs locally. Results and schedule settings are stored in `$DSH_HOME/storages/wordcloud.json`. The default data directory is `~/.dsh`.

## License

[MIT](LICENSE)

# DSH Word Cloud

[简体中文](README.md) · English

Open **Word Cloud** in the DeepSeek Harness sidebar to see word frequencies in user messages. Select a word to see which conversation turns it appears in most often and their shares. Run an analysis manually or schedule it hourly, every 24 hours, or every 7 days.

## Install

Node.js 22.19 or later is required. Build the package from the project root.

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

## How counts work

- The plugin reads user message text from conversations available to DSH. Agent replies, automatically injected content, block quotes, and attachments are excluded. Content pasted as plain text is counted.
- Each word counts at most once per message. Turn shares use matching messages with a recorded turn and display two decimal places.
- Analysis runs locally. Results and schedule settings are stored in `$DSH_HOME/storages/wordcloud.json`. The default data directory is `~/.dsh`.

## License

[MIT](LICENSE)

# DSH 词云

简体中文 · [English](README.en.md)

在 DeepSeek Harness 侧边栏打开 **词云**，查看用户消息的词频。点击词语可查看它最常出现的会话轮次及占比。支持手动统计，也可设为每小时、每 24 小时或每 7 天统计。

统计完成后，点击 **分享** 可以预览词云图片。点击 **保存图片**，在系统保存对话框中选择 PNG 的保存位置。Web 端需要浏览器支持选择保存位置。

## 安装

需要 Node.js 22.19 或更新版本。正式版本发布后，可在桌面端的 **插件 → 安装** 搜索 `dsh-plugin-wordcloud`。Web 端需将 `pnpm` 加入 PATH，再运行以下命令。

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-plugin-wordcloud -w
```

在桌面端启用插件，按提示重启 DSH。Web 端安装后重启 DSH。

离线安装可从 [GitHub Releases](https://github.com/merc-hecl/dsh-plugin-wordcloud/releases) 下载 `.tgz`。完整解压并保留其中的 `node_modules`，然后在 DSH 中用 `link:<解压后的 package 目录的绝对路径>` 安装。

也可以在项目根目录从源码构建安装包。

```sh
npm ci
npm pack
```

- 在**桌面端**打开 **插件 → 安装**，输入 `file:<安装包的绝对路径>`，安装后选择 **立即启用**，按提示重启 DSH。
- 使用 **Web 端**时需将 `pnpm` 加入 PATH。将下方占位路径替换成生成的 `.tgz` 文件路径，安装后重启 DSH。

```sh
npx @deepseek-ai/dsh plugin --profile web add "file:<安装包的绝对路径>" -w
```

本地开发可运行 `npm run build`，再用 `link:<源码目录的绝对路径>` 安装。

维护者可参阅[发布流程](AGENTS.md#releases)。

## 统计口径

- 只统计 DSH 可查询的用户正文。Agent 回复、自动注入、引用块和附件不计入统计。直接粘贴为普通正文的内容会计入统计。
- 按文字系统和上下文选用停用词表，过滤常见连词、助词和口语填充词。中文额外使用词性标注。语言难以判断时采用保守过滤。
- 多语言停用词表来自 [`stopword`](https://github.com/fergiemcdowall/stopword)。
- 同一个词在一条消息中最多计一次。轮次占比以带轮次的命中消息为分母，显示到小数点后两位。
- 统计在本机运行。结果和周期设置保存在 `$DSH_HOME/storages/wordcloud.json`，默认根目录为 `~/.dsh`。

## 许可证

[MIT](LICENSE)

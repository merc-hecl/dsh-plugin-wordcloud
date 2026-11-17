# DSH 词云

简体中文 · [English](README.en.md)

在 DeepSeek Harness 侧边栏打开 **词云**，查看用户消息的词频。点击词语可查看它最常出现的会话轮次及占比。支持手动统计，也可设为每小时、每 24 小时或每 7 天统计。

## 安装

需要 Node.js 22.19 或更新版本。先在项目根目录构建安装包。

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

## 统计口径

- 只统计 DSH 可查询的用户正文。Agent 回复、自动注入、引用块和附件不计入统计。直接粘贴为普通正文的内容会计入统计。
- 同一个词在一条消息中最多计一次。轮次占比以带轮次的命中消息为分母，显示到小数点后两位。
- 统计在本机运行。结果和周期设置保存在 `$DSH_HOME/storages/wordcloud.json`，默认根目录为 `~/.dsh`。

## 许可证

[MIT](LICENSE)

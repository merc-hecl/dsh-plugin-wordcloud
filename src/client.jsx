import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  Button, Menu, IconClockOutlineRegular, IconLoadingOutlineRegular, IconChevronDownOutlineRegular,
  IconChevronLeftOutlineRegular, IconChevronRightOutlineRegular, IconRefreshOutlineRegular,
} from "@deepseek-ai/dsh-client-ui-primitives";
import css from "./client.css";

const id = "wordcloud";
const periods = [0, 1, 24, 168];
const zh = {
  title: "词云", run: "立即统计", running: "统计中…", progress: "统计中 {visited}/{total}",
  schedule: "周期统计", off: "关闭", everyHour: "每小时", everyDay: "每 24 小时", everyWeek: "每 7 天",
  ranking: "词频排行", turnRanking: "轮次排行",
  sessions: "会话", messages: "用户消息", updated: "最近统计", next: "下次统计",
  matches: "命中消息", round: "第 {n} 轮",
  unknown: "未进入轮次", none: "尚无统计", noTerms: "没有可统计的词语",
  previous: "上一页", nextPage: "下一页",
  noTurns: "暂无轮次记录", skipped: "未读取 {n} 个会话",
  scanError: "统计失败", storageError: "无法读取或保存本地统计", requestError: "无法连接词云插件",
  loading: "加载中…", retry: "重试",
};
const en = {
  title: "Word Cloud", run: "Analyze now", running: "Analyzing…", progress: "Analyzing {visited}/{total}",
  schedule: "Schedule", off: "Off", everyHour: "Hourly", everyDay: "Every 24 hours", everyWeek: "Every 7 days",
  ranking: "Word frequency", turnRanking: "Turn ranking",
  sessions: "Sessions", messages: "User messages", updated: "Last analyzed", next: "Next run",
  matches: "Matching messages", round: "Turn {n}",
  unknown: "No turn yet", none: "No analysis yet", noTerms: "No words found",
  previous: "Previous page", nextPage: "Next page",
  noTurns: "No turn data", skipped: "{n} sessions unread",
  scanError: "Analysis failed", storageError: "Could not read or save local statistics", requestError: "Could not connect to Word Cloud",
  loading: "Loading…", retry: "Retry",
};
const periodLabels = ["off", "everyHour", "everyDay", "everyWeek"];
const countFormat = (locale) => new Intl.NumberFormat(locale);
const percentFormat = (locale) => new Intl.NumberFormat(locale, {
  style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const dateFormat = (locale) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

function WordCloudIcon({ className }) {
  const maskId = useId();
  const letter = "M1.5 12.8 5.3 3.1 9.1 12.8M2.8 9.5H7.8";
  return <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16">
      <rect width="16" height="16" fill="white" />
      <path d={letter} stroke="black" strokeWidth="3.1" />
    </mask>
    <path d="M6.65 12.8V9.4M10.3 12.8V6.5M13.7 12.8V4.2" stroke="currentColor"
      strokeWidth="1.25" mask={`url(#${maskId})`} />
    <path d={letter} stroke="currentColor" strokeWidth="1.35" />
  </svg>;
}

function PeriodMenu({ interval, busy, change, t }) {
  const [open, setOpen] = useState(false);
  return <Menu open={open} portal align="end" selectedId={String(interval)}
    onClose={() => setOpen(false)}
    items={periods.map((value, i) => ({ id: String(value), label: t(periodLabels[i]) }))}
    onSelect={(value) => { setOpen(false); change(Number(value)); }}
    anchor={<Button variant="outline" disabled={busy} aria-haspopup="menu" aria-expanded={open}
      icon={<IconClockOutlineRegular />} onClick={() => setOpen(!open)}>
      {t("schedule")} · {t(periodLabels[periods.indexOf(interval)])}<IconChevronDownOutlineRegular />
    </Button>} />;
}

const sparkDirections = [[-1, -.45], [-.45, -1], [.6, -.95], [1, .25], [.35, 1], [-.66, .86]];

function playCloudBurst(layer, word) {
  const bounds = layer.getBoundingClientRect();
  const origin = word.getBoundingClientRect();
  const easing = getComputedStyle(layer).getPropertyValue("--wc-cloud-curve").trim();

  Array.from(layer.children).forEach((spark, index) => {
    const [dx, dy] = sparkDirections[index];
    const x = origin.left - bounds.left + origin.width * (.5 + dx * .43);
    const y = origin.top - bounds.top + origin.height * (.5 + dy * .38);
    const travel = index % 2 === 0 ? 24 : 17;
    for (const animation of spark.getAnimations()) animation.cancel();
    spark.animate([
      { opacity: .95, transform: `translate(${x}px, ${y}px) rotate(15deg) scale(.8)`, easing },
      { opacity: .85, transform: `translate(${x + dx * travel * .78}px, ${y + dy * travel * .78}px) rotate(55deg) scale(1)`, offset: .47 },
      { opacity: 0, transform: `translate(${x + dx * travel}px, ${y + dy * travel}px) rotate(80deg) scale(.65)` },
    ], { duration: 240 });
  });
}

function Cloud({ terms, selected, select, label, format }) {
  const burstLayer = useRef(null);
  const visible = terms.slice(0, 18);
  const groups = [
    { name: "upper", words: visible.slice(5, 11) },
    { name: "center", words: [3, 1, 0, 2, 4].map((index) => visible[index]).filter(Boolean) },
    { name: "lower", words: visible.slice(11) },
  ];
  const floor = Math.log1p(visible.at(-1).count);
  const range = Math.log1p(visible[0].count) - floor;
  return <div className="wc-cloud" role="group" aria-label={label}>
    {groups.filter(({ words }) => words.length).map(({ name, words }) => (
      <div className={`wc-cloud-band wc-cloud-${name}`} key={name}>
        {words.map((term) => {
          const weight = range ? (Math.log1p(term.count) - floor) / range : 0.4;
          const count = format.format(term.count);
          return <Button key={term.text} size="sm" className="wc-word"
            aria-label={`${term.text} · ${count}`} aria-pressed={selected === term.text}
            title={term.text.length > 10 ? term.text : undefined}
            style={{ "--wc-size": `${Math.round(16 + weight * 28)}px`, "--wc-weight": Math.round(500 + weight * 250) }}
            onClick={(event) => {
              select(term.text);
              if (event.detail > 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
                playCloudBurst(burstLayer.current, event.currentTarget);
              }
            }}>
            <span className="wc-word-corners" aria-hidden="true"><i /><i /><i /><i /></span>
            <span className="wc-word-label">{term.text}</span>
            <span className="wc-word-count" aria-hidden="true">{count}</span>
          </Button>;
        })}
      </div>
    ))}
    <div className="wc-cloud-sparks" ref={burstLayer} aria-hidden="true">
      {sparkDirections.map(([x, y]) => <span key={`${x},${y}`} />)}
    </div>
  </div>;
}

function PagedRanking({ titleId, title, summary, className, items, listClassName, renderRow, empty, note, format, t }) {
  const listSpace = useRef(null);
  const [pageSize, setPageSize] = useState(1);
  const [page, setPage] = useState(0);

  useLayoutEffect(() => {
    const element = listSpace.current;
    const measure = () => {
      const rowHeight = parseFloat(getComputedStyle(element).getPropertyValue("--wc-row-height"));
      setPageSize(Math.max(1, Math.floor(element.clientHeight / rowHeight)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const active = Math.min(page, pageCount - 1);
  const start = active * pageSize;
  return <section className={`wc-box wc-ranking ${className}`} aria-labelledby={titleId}>
    <div className="wc-section"><h2 id={titleId}>{title}</h2>{summary}</div>
    <div className="wc-list-space" ref={listSpace}>
      {items.length ? <ol className={listClassName} start={start + 1} aria-labelledby={titleId}>
        {items.slice(start, start + pageSize).map((item, i) => renderRow(item, start + i))}
      </ol> : <p className="wc-meta">{empty}</p>}
    </div>
    <div className="wc-rank-footer">
      <span className="wc-meta">{note}</span>
      {pageCount > 1 && <div className="wc-pagination">
        <Button size="sm" icon={<IconChevronLeftOutlineRegular />} aria-label={t("previous")} title={t("previous")}
          disabled={active === 0} onClick={() => setPage(active - 1)} />
        <span className="wc-meta" aria-live="polite">{format.format(active + 1)} / {format.format(pageCount)}</span>
        <Button size="sm" icon={<IconChevronRightOutlineRegular />} aria-label={t("nextPage")} title={t("nextPage")}
          disabled={active === pageCount - 1} onClick={() => setPage(active + 1)} />
      </div>}
    </div>
  </section>;
}

function Rankings({ terms, selected, select, format, t }) {
  return <PagedRanking titleId="wc-frequency-title" className="wc-rank" title={t("ranking")}
    summary={<span>{t("matches")}</span>} items={terms} listClassName="wc-list" format={format} t={t}
    renderRow={({ text, count }, index) => <li key={text}>
        <Button className="wc-row" size="sm" title={text} aria-pressed={selected === text}
          onClick={() => select(text)}>
          <span className="wc-order">{format.format(index + 1)}</span>
          <span className="wc-label">{text}</span>
          <span className="wc-track" aria-hidden><span style={{ width: `${100 * count / terms[0].count}%` }} /></span>
          <span className="wc-count">{format.format(count)}</span>
        </Button>
      </li>} />;
}

function TurnRanking({ term, format, percent, t }) {
  const total = term.turns.reduce((sum, [, count]) => sum + count, 0);
  const rows = term.turns.toSorted(([turnA, countA], [turnB, countB]) => countB - countA || turnA - turnB);
  return <PagedRanking titleId="wc-turn-title" className="wc-detail" title={t("turnRanking")}
    summary={<span className="wc-selected-term" title={`${term.text} · ${t("matches")} ${format.format(term.count)}`}>
      <b>{term.text}</b> · {format.format(term.count)}
    </span>}
    items={rows} listClassName="wc-turn-list" empty={t("noTurns")} format={format} t={t}
    note={term.unplaced ? `${t("unknown")} · ${format.format(term.unplaced)}` : undefined}
    renderRow={([turn, count]) => <li key={turn} title={`${format.format(count)} / ${format.format(total)}`}>
        <span>{t("round", { n: format.format(turn) })}</span>
        <span className="wc-track" aria-hidden><span style={{ width: `${100 * count / total}%` }} /></span>
        <span className="wc-count">{percent.format(count / total)}</span>
      </li>} />;
}

function Panel({ t, getLanguage }) {
  const [state, setState] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const client = useRef(null);
  const busy = useRef(false);
  const locale = getLanguage();
  const format = countFormat(locale), percent = percentFormat(locale), date = dateFormat(locale);

  async function request(method = "GET", body) {
    const { signal } = client.current;
    if (busy.current) return;
    busy.current = true;
    if (method !== "GET") setPending(true);
    try {
      const response = await fetch("/api/wordcloud", {
        signal, method, ...(body && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      });
      const data = await response.json();
      if (signal.aborted) return;
      if (!response.ok) throw new Error(data.problem === "storage" ? "storageError" : "requestError");
      setState(data);
      setError(null);
    } catch (err) {
      if (!signal.aborted) setError(err.message === "storageError" ? err.message : "requestError");
    } finally {
      if (!signal.aborted) { busy.current = false; setPending(false); }
    }
  }

  useEffect(() => {
    client.current = new AbortController();
    busy.current = false;
    request();
    return () => client.current.abort();
  }, []);
  useEffect(() => {
    if (!state) return;
    const at = state.nextAt ?? Infinity;
    const delay = state.progress ? 500 : Math.min(30_000, Math.max(1000, at - Date.now()));
    const timer = setTimeout(() => request(), delay);
    return () => clearTimeout(timer);
  }, [state, error]);

  const result = state?.result;
  const terms = result?.words ?? [];
  const term = terms.find((entry) => entry.text === selected) ?? terms[0];
  const progress = state?.progress;
  const problem = error ?? (!progress && ({ scan: "scanError", storage: "storageError" })[state?.problem]);

  return <main className="wc-page">
    <div className="wc-wrap">
      <header className="wc-header">
        <h1>{t("title")}</h1>
        {state && <div className="wc-actions">
          <PeriodMenu interval={state.interval} busy={pending} change={(interval) => request("PATCH", { interval })} t={t} />
          <Button variant="primary" icon={progress ? <IconLoadingOutlineRegular /> : <IconRefreshOutlineRegular />}
            disabled={pending || !!progress} onClick={() => request("POST")}>
            {progress ? t(progress.total == null ? "running" : "progress", progress) : t("run")}
          </Button>
        </div>}
      </header>
      {problem && <div className="wc-error" role="alert">{t(problem)}
        {!state && <Button size="sm" variant="outline" onClick={() => request()}>{t("retry")}</Button>}
      </div>}
      {(result || state?.nextAt) && <div className="wc-meta wc-metadata">
        {result && <><span>{t("sessions")} <b>{format.format(result.sessions)}</b></span>
          <span>{t("messages")} <b>{format.format(result.messages)}</b></span>
          <span>{t("updated")} <b>{date.format(result.at)}</b></span>
          {!!result.skipped && <span role="status">{t("skipped", { n: format.format(result.skipped) })}</span>}</>}
        {!!state.nextAt && <span>{t("next")} <b>{date.format(state.nextAt)}</b></span>}
      </div>}
      {result ? (
        term ? <div className="wc-charts">
          <Cloud terms={terms} selected={term.text} select={setSelected} label={t("title")} format={format} />
          <Rankings terms={terms} selected={term.text} select={setSelected} format={format} t={t} />
          <TurnRanking key={term.text} term={term} format={format} percent={percent} t={t} />
        </div> : <div className="wc-empty" role="status">{t("noTerms")}</div>
      ) : !problem && <div className="wc-empty" role="status">
        {t(!state ? "loading" : progress ? "running" : "none")}
      </div>}
    </div>
  </main>;
}

export const inject = ["slots", "locale"];
export function* apply(ctx) {
  ctx.effect(() => ctx.locale.register(id, { zh, en }), "wordcloud: locale");
  ctx.effect(() => {
    const element = document.createElement("style");
    element.dataset.plugin = "dsh-plugin-wordcloud";
    element.textContent = css;
    document.head.append(element);
    return () => element.remove();
  }, "wordcloud: styles");
  const t = ctx.locale.bind(id);
  const getLanguage = () => document.documentElement.lang || "en";
  yield ctx.slots.inject("main", () => ctx.slots.register({
    name: "main", key: id, locale: id, inject: () => ({ getLanguage }),
  }, Panel));
  yield ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist", id, order: 20, locale: id, label: () => t("title"),
  }, WordCloudIcon));
}

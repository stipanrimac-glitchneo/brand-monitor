import { useState, useEffect, useCallback } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement, Tooltip, Legend, CategoryScale, LinearScale,
  BarElement, PointElement, LineElement, Filler
);

const API = import.meta.env.VITE_API_URL || "/api";

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
};

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n;
}

// ─── Platform Config ──────────────────────────────────────────────────────────

const PLATFORM_COLORS = {
  Twitter:   { bg: "rgba(29,155,240,0.15)",  text: "#1d9bf0" },
  Reddit:    { bg: "rgba(255,69,0,0.15)",    text: "#ff4500" },
  News:      { bg: "rgba(167,139,250,0.15)", text: "#a78bfa" },
  YouTube:   { bg: "rgba(255,78,69,0.15)",   text: "#ff4e45" },
  Instagram: { bg: "rgba(225,48,108,0.15)",  text: "#e1306c" },
  LinkedIn:  { bg: "rgba(10,102,194,0.15)",  text: "#0a66c2" },
};

// ─── Stat Icon ────────────────────────────────────────────────────────────────

function StatIcon({ type }) {
  const s = {
    width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: "2",
    strokeLinecap: "round", strokeLinejoin: "round",
  };
  switch (type) {
    case "total":    return <svg {...s}><rect x="3" y="12" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/></svg>;
    case "positive": return <svg {...s}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
    case "negative": return <svg {...s}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>;
    case "neutral":  return <svg {...s}><circle cx="12" cy="12" r="9"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
    case "avg":      return <svg {...s}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    case "reach":    return <svg {...s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    default: return null;
  }
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function SentimentDoughnut({ summary }) {
  const data = {
    labels: ["Positive", "Negative", "Neutral"],
    datasets: [{
      data: [summary.positive, summary.negative, summary.neutral],
      backgroundColor: ["#22c55e", "#ef4444", "#f59e0b"],
      borderColor: ["#22c55e", "#ef4444", "#f59e0b"],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };
  return (
    <div style={{ height: 180, position: "relative" }}>
      <Doughnut data={data} options={{
        ...CHART_OPTS,
        plugins: {
          legend: {
            display: true, position: "bottom",
            labels: { color: "#8b92a8", font: { size: 11 }, padding: 12, boxWidth: 10 },
          },
        },
        cutout: "70%",
      }} />
    </div>
  );
}

function PlatformBar({ summary }) {
  const platforms = Object.keys(summary.byPlatform);
  const data = {
    labels: platforms,
    datasets: [
      { label: "Positive", data: platforms.map(p => summary.byPlatform[p].positive), backgroundColor: "#22c55e", borderRadius: 4 },
      { label: "Negative", data: platforms.map(p => summary.byPlatform[p].negative), backgroundColor: "#ef4444", borderRadius: 4 },
      { label: "Neutral",  data: platforms.map(p => summary.byPlatform[p].neutral),  backgroundColor: "#f59e0b", borderRadius: 4 },
    ],
  };
  return (
    <div style={{ height: 180 }}>
      <Bar data={data} options={{
        ...CHART_OPTS,
        plugins: {
          legend: {
            display: true, position: "bottom",
            labels: { color: "#8b92a8", font: { size: 11 }, padding: 12, boxWidth: 10 },
          },
        },
        scales: {
          x: { stacked: true, ticks: { color: "#8b92a8", font: { size: 10 } }, grid: { color: "rgba(42,47,69,0.5)" } },
          y: { stacked: true, ticks: { color: "#8b92a8", font: { size: 10 }, stepSize: 1 }, grid: { color: "rgba(42,47,69,0.5)" } },
        },
      }} />
    </div>
  );
}

function TrendLine({ summary }) {
  const days = summary.bySentimentOverTime;
  const labels = days.map(d => new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  const data = {
    labels,
    datasets: [
      { label: "Positive", data: days.map(d => d.positive), borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.08)",  fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: "#22c55e" },
      { label: "Negative", data: days.map(d => d.negative), borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.08)",   fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: "#ef4444" },
    ],
  };
  return (
    <div style={{ height: 180 }}>
      <Line data={data} options={{
        ...CHART_OPTS,
        plugins: {
          legend: {
            display: true, position: "bottom",
            labels: { color: "#8b92a8", font: { size: 11 }, padding: 12, boxWidth: 10 },
          },
        },
        scales: {
          x: { ticks: { color: "#8b92a8", font: { size: 10 } }, grid: { color: "rgba(42,47,69,0.5)" } },
          y: { ticks: { color: "#8b92a8", font: { size: 10 }, stepSize: 1 }, grid: { color: "rgba(42,47,69,0.5)" } },
        },
      }} />
    </div>
  );
}

// ─── Mention Card ─────────────────────────────────────────────────────────────

function MentionCard({ mention, selected, onClick }) {
  const pc = PLATFORM_COLORS[mention.platform] || { bg: "var(--surface2)", text: "var(--text-muted)" };
  const initial = mention.author.replace(/[@u/]/g, "").charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`mention-card ${mention.sentiment} ${selected ? "selected" : ""}`}
      onClick={() => onClick(mention)}
    >
      <div className="mention-header">
        <div className="mention-author-row">
          <div className="author-avatar" style={{ background: pc.bg, color: pc.text }}>
            {initial}
          </div>
          <div className="mention-meta">
            <span className="mention-author">{mention.author}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className={`platform-badge ${mention.platform}`}>{mention.platform}</span>
              {mention.source === "live" && <span className="live-badge">LIVE</span>}
            </div>
          </div>
        </div>
        <span className="mention-time">{timeAgo(mention.timestamp)}</span>
      </div>

      <p className="mention-text">{mention.text}</p>

      <div className="score-bar-wrap">
        <div className="score-bar">
          <div className={`score-fill ${mention.sentiment}`} style={{ width: `${mention.sentimentScore}%` }} />
        </div>
        <span className="score-label">{mention.sentimentScore}%</span>
      </div>

      <div className="mention-footer">
        <span className={`sentiment-badge ${mention.sentiment}`}>
          {mention.sentiment === "positive" ? "↑ " : mention.sentiment === "negative" ? "↓ " : "— "}
          {mention.sentiment}
        </span>
        <span className="context-badge">{mention.context}</span>
        {(mention.likes > 0 || mention.shares > 0) && (
          <span className="mention-engagement">
            {mention.likes  > 0 && <span>♥ {formatNum(mention.likes)}</span>}
            {mention.shares > 0 && <span>↗ {formatNum(mention.shares)}</span>}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Recommendation Panel ─────────────────────────────────────────────────────

function RecommendationPanel({ mentionId, brand, selectedMention }) {
  const [rec, setRec] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  useEffect(() => {
    if (!mentionId || !brand) { setRec(null); return; }
    setLoading(true);
    fetch(`${API}/recommendations?mentionId=${mentionId}&brand=${encodeURIComponent(brand)}`)
      .then(r => r.json())
      .then(data => { setRec(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [mentionId, brand]);

  const copyTemplate = (text, idx) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  return (
    <div className="rec-panel">
      <div className="rec-header">
        <div className="rec-header-top">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <div className="rec-title">Response Advisor</div>
        </div>
        <div className="rec-subtitle">
          {selectedMention ? `Analyzing: ${selectedMention.author}` : "Click a mention to get recommendations"}
        </div>
      </div>

      <div className="rec-body">
        {!selectedMention && (
          <div className="rec-empty">
            <div className="rec-empty-icon">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div>Select any mention from the feed</div>
            <div className="rec-empty-sub">Get AI-powered response recommendations and communication strategies.</div>
          </div>
        )}

        {loading && (
          <div className="loading" style={{ padding: "1.5rem" }}>
            <div className="spinner" style={{ width: 28, height: 28 }} />
            <span style={{ fontSize: "0.85rem" }}>Analyzing mention...</span>
          </div>
        )}

        {rec && !loading && (
          <>
            <div className="rec-meta">
              <span className="rec-tag">{rec.recommendation.category}</span>
              <span className={`rec-tag urgency-${rec.recommendation.urgency}`}>{rec.recommendation.urgency} Priority</span>
              <span className="rec-tag">Tone: {rec.recommendation.tone}</span>
            </div>

            <div>
              <div className="rec-section-title">Response Templates</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rec.recommendation.templates.map((t, i) => (
                  <div key={i} className="template-card">
                    <button
                      className={`copy-btn ${copiedIdx === i ? "copied" : ""}`}
                      onClick={() => copyTemplate(t, i)}
                    >
                      {copiedIdx === i ? "✓ Copied" : "Copy"}
                    </button>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="rec-section-title">Communication Strategy</div>
              <div className="do-dont">
                <div className="do-list">
                  <div className="do-list-title">Do</div>
                  <ul>{rec.recommendation.doList.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>
                <div className="dont-list">
                  <div className="dont-list-title">Don't</div>
                  <ul>{rec.recommendation.dontList.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>
              </div>
            </div>

            {(rec.mention.positiveWords.length > 0 || rec.mention.negativeWords.length > 0) && (
              <div>
                <div className="rec-section-title">Key Signals</div>
                <div className="word-list">
                  {rec.mention.positiveWords.map((w, i) => <span key={i} className="word-chip positive">{w}</span>)}
                  {rec.mention.negativeWords.map((w, i) => <span key={`n${i}`} className="word-chip negative">{w}</span>)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

const SENTIMENTS = ["all", "positive", "negative", "neutral"];
const CONTEXTS   = ["all", "complaint", "praise", "question", "discussion"];

export default function App() {
  const [brandInput, setBrandInput] = useState("Acme Corp");
  const [brand, setBrand] = useState("");
  const [mentions, setMentions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMention, setSelectedMention] = useState(null);
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterSentiment, setFilterSentiment] = useState("all");
  const [filterContext, setFilterContext] = useState("all");
  const [platforms, setPlatforms] = useState([]);

  const fetchData = useCallback(async (brandName) => {
    setLoading(true);
    setError(null);
    setSelectedMention(null);
    try {
      const [mentionsRes, summaryRes, platformsRes] = await Promise.all([
        fetch(`${API}/mentions?brand=${encodeURIComponent(brandName)}&platform=${filterPlatform}&sentiment=${filterSentiment}&context=${filterContext}`),
        fetch(`${API}/summary?brand=${encodeURIComponent(brandName)}`),
        fetch(`${API}/platforms`),
      ]);
      const mentionsData  = await mentionsRes.json();
      const summaryData   = await summaryRes.json();
      const platformsData = await platformsRes.json();
      setMentions(mentionsData.mentions);
      setSummary(summaryData.summary);
      setPlatforms(platformsData.platforms);
    } catch {
      setError("Could not connect to the API. Make sure the backend is running on port 3001.");
    } finally {
      setLoading(false);
    }
  }, [filterPlatform, filterSentiment, filterContext]);

  useEffect(() => { fetchData("Acme Corp"); setBrand("Acme Corp"); }, []);
  useEffect(() => { if (brand) fetchData(brand); }, [filterPlatform, filterSentiment, filterContext]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!brandInput.trim()) return;
    setBrand(brandInput.trim());
    fetchData(brandInput.trim());
  };

  const sentimentPct = summary ? {
    positive: Math.round((summary.positive / summary.total) * 100),
    negative: Math.round((summary.negative / summary.total) * 100),
    neutral:  Math.round((summary.neutral  / summary.total) * 100),
  } : null;

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#fff" }}>
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
          </div>
          <div>
            <div className="header-title">Brand Monitor</div>
            <div className="header-subtitle">Sentiment Intelligence</div>
          </div>
        </div>
        <div className="header-status">
          <div className="status-dot" />
          Live Monitoring
          {brand && <span className="header-brand-tag">{brand}</span>}
        </div>
      </header>

      {/* ── Search & Filters ── */}
      <div className="search-section">
        <div className="search-row">
          <form onSubmit={handleSearch} style={{ display: "contents" }}>
            <div className="search-input-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="search-input"
                type="text"
                value={brandInput}
                onChange={e => setBrandInput(e.target.value)}
                placeholder="Enter brand name to monitor..."
              />
            </div>
            <button type="submit" className="search-btn" disabled={loading}>
              {loading ? "Searching…" : "Monitor Brand"}
            </button>
          </form>
          <select className="filter-select" value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
            <option value="all">All Platforms</option>
            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="filter-row">
          <div className="pill-group">
            {SENTIMENTS.map(s => (
              <button
                key={s}
                className={`pill ${s !== "all" ? `pill-${s}` : ""} ${filterSentiment === s ? "active" : ""}`}
                onClick={() => setFilterSentiment(s)}
              >
                {s === "all" ? "All Sentiment" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="filter-divider" />
          <div className="pill-group">
            {CONTEXTS.map(c => (
              <button
                key={c}
                className={`pill ${filterContext === c ? "active" : ""}`}
                onClick={() => setFilterContext(c)}
              >
                {c === "all" ? "All Contexts" : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="main">
        {error && <div className="error-msg" style={{ gridColumn: "1 / -1" }}>⚠ {error}</div>}

        {/* Stats */}
        {summary && (
          <div className="stats-row">
            {[
              { type: "total",    label: "Total Mentions",  value: summary.total,             color: "accent",    sub: "Across all platforms" },
              { type: "positive", label: "Positive",        value: summary.positive,           color: "positive",  sub: `${sentimentPct?.positive}% of mentions` },
              { type: "negative", label: "Negative",        value: summary.negative,           color: "negative",  sub: `${sentimentPct?.negative}% of mentions` },
              { type: "neutral",  label: "Neutral",         value: summary.neutral,            color: "neutral",   sub: `${sentimentPct?.neutral}% of mentions` },
              { type: "avg",      label: "Avg Sentiment",   value: summary.avgSentimentScore,  color: summary.avgSentimentScore >= 60 ? "positive" : summary.avgSentimentScore <= 40 ? "negative" : "neutral", sub: "out of 100" },
              { type: "reach",    label: "Est. Reach",      value: formatNum(summary.reachEstimate), color: "accent", sub: "Impressions + shares" },
            ].map(({ type, label, value, color, sub }) => (
              <div key={type} className={`stat-card stat-card-${type}`}>
                <div className="stat-card-header">
                  <div className={`stat-icon stat-icon-${color}`}><StatIcon type={type} /></div>
                  <div className="stat-label">{label}</div>
                </div>
                <div className={`stat-value ${color}`}>{value}</div>
                <div className="stat-sub">{sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Charts */}
        {summary && (
          <div className="charts-row">
            <div className="card">
              <div className="card-title">Sentiment Distribution</div>
              <SentimentDoughnut summary={summary} />
            </div>
            <div className="card">
              <div className="card-title">By Platform</div>
              <PlatformBar summary={summary} />
            </div>
            <div className="card">
              <div className="card-title">Trend Over Time</div>
              <TrendLine summary={summary} />
            </div>
          </div>
        )}

        {/* Sentiment Signals */}
        {summary && (summary.topPositiveWords.length > 0 || summary.topNegativeWords.length > 0) && (
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card-title">Sentiment Signals</div>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: "0.75rem", color: "var(--positive)", fontWeight: 600, marginBottom: 8 }}>TOP POSITIVE WORDS</div>
                <div className="word-list">
                  {summary.topPositiveWords.map((w, i) => <span key={i} className="word-chip positive">{w.word} ({w.count})</span>)}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: "0.75rem", color: "var(--negative)", fontWeight: 600, marginBottom: 8 }}>TOP NEGATIVE WORDS</div>
                <div className="word-list">
                  {summary.topNegativeWords.map((w, i) => <span key={i} className="word-chip negative">{w.word} ({w.count})</span>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feed */}
        <div className="left-col">
          <div className="section-header">
            <div className="card-title" style={{ fontSize: "0.9rem" }}>Mentions Feed</div>
            {mentions.length > 0 && <span className="mention-count">{mentions.length} results</span>}
          </div>

          {loading && (
            <div className="loading">
              <div className="spinner" />
              <span>Fetching mentions for <strong>{brandInput}</strong>…</span>
            </div>
          )}

          {!loading && mentions.length === 0 && !error && (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <div>No mentions found</div>
              <div className="empty-state-sub">Try adjusting your search or filters.</div>
            </div>
          )}

          {!loading && mentions.map(m => (
            <MentionCard
              key={m.id}
              mention={m}
              selected={selectedMention?.id === m.id}
              onClick={mention => setSelectedMention(selectedMention?.id === mention.id ? null : mention)}
            />
          ))}
        </div>

        {/* Recommendations */}
        <div className="right-col">
          <RecommendationPanel
            mentionId={selectedMention?.id}
            brand={brand}
            selectedMention={selectedMention}
          />
        </div>
      </div>
    </div>
  );
}

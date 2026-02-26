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

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000)    return (n / 1000).toFixed(1) + "K";
  return n;
}

// ─── Platform Config ──────────────────────────────────────────────────────────

const PLATFORM = {
  Twitter:   { color: "#1D9BF0", bg: "rgba(29,155,240,0.12)"   },
  Reddit:    { color: "#FF4500", bg: "rgba(255,69,0,0.12)"     },
  News:      { color: "#BF5AF2", bg: "rgba(191,90,242,0.12)"   },
  YouTube:   { color: "#FF453A", bg: "rgba(255,69,58,0.12)"    },
  Instagram: { color: "#E1306C", bg: "rgba(225,48,108,0.12)"   },
  LinkedIn:  { color: "#0A84FF", bg: "rgba(10,132,255,0.12)"   },
};

// ─── Chart defaults ───────────────────────────────────────────────────────────

const CHART_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
};

const CHART_SCALES = {
  x: { ticks: { color: "rgba(255,255,255,0.35)", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.05)" }, border: { display: false } },
  y: { ticks: { color: "rgba(255,255,255,0.35)", font: { size: 10 }, stepSize: 1 }, grid: { color: "rgba(255,255,255,0.05)" }, border: { display: false } },
};

// ─── Charts ───────────────────────────────────────────────────────────────────

function SentimentDoughnut({ summary }) {
  return (
    <div style={{ height: 190 }}>
      <Doughnut
        data={{
          labels: ["Positive", "Negative", "Neutral"],
          datasets: [{
            data: [summary.positive, summary.negative, summary.neutral],
            backgroundColor: ["#32D74B", "#FF453A", "#FF9F0A"],
            borderWidth: 0,
            hoverOffset: 4,
          }],
        }}
        options={{
          ...CHART_BASE,
          cutout: "72%",
          plugins: {
            legend: {
              display: true,
              position: "bottom",
              labels: { color: "rgba(255,255,255,0.5)", font: { size: 11 }, padding: 16, boxWidth: 8, borderRadius: 4 },
            },
          },
        }}
      />
    </div>
  );
}

function PlatformBar({ summary }) {
  const platforms = Object.keys(summary.byPlatform);
  return (
    <div style={{ height: 190 }}>
      <Bar
        data={{
          labels: platforms,
          datasets: [
            { label: "Positive", data: platforms.map(p => summary.byPlatform[p].positive), backgroundColor: "#32D74B", borderRadius: 4, borderSkipped: false },
            { label: "Negative", data: platforms.map(p => summary.byPlatform[p].negative), backgroundColor: "#FF453A", borderRadius: 4, borderSkipped: false },
            { label: "Neutral",  data: platforms.map(p => summary.byPlatform[p].neutral),  backgroundColor: "#FF9F0A", borderRadius: 4, borderSkipped: false },
          ],
        }}
        options={{
          ...CHART_BASE,
          scales: { x: { ...CHART_SCALES.x, stacked: true }, y: { ...CHART_SCALES.y, stacked: true } },
          plugins: {
            legend: {
              display: true, position: "bottom",
              labels: { color: "rgba(255,255,255,0.5)", font: { size: 11 }, padding: 16, boxWidth: 8 },
            },
          },
        }}
      />
    </div>
  );
}

function TrendLine({ summary }) {
  const days   = summary.bySentimentOverTime;
  const labels = days.map(d => new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  return (
    <div style={{ height: 190 }}>
      <Line
        data={{
          labels,
          datasets: [
            { label: "Positive", data: days.map(d => d.positive), borderColor: "#32D74B", backgroundColor: "rgba(50,215,75,0.08)",  fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: "#32D74B", borderWidth: 2 },
            { label: "Negative", data: days.map(d => d.negative), borderColor: "#FF453A", backgroundColor: "rgba(255,69,58,0.08)",   fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: "#FF453A", borderWidth: 2 },
          ],
        }}
        options={{
          ...CHART_BASE,
          scales: CHART_SCALES,
          plugins: {
            legend: {
              display: true, position: "bottom",
              labels: { color: "rgba(255,255,255,0.5)", font: { size: 11 }, padding: 16, boxWidth: 8 },
            },
          },
        }}
      />
    </div>
  );
}

// ─── Mention Card ─────────────────────────────────────────────────────────────

function MentionCard({ mention, selected, onClick }) {
  const p = PLATFORM[mention.platform] || { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.06)" };
  const initial = mention.author.replace(/[@u/]/g, "").charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`mention-card ${mention.sentiment} ${selected ? "selected" : ""}`}
      onClick={() => onClick(mention)}
    >
      <div className="mc-header">
        <div className="mc-avatar" style={{ background: p.bg, color: p.color }}>{initial}</div>
        <div className="mc-meta">
          <span className="mc-author">{mention.author}</span>
          <div className="mc-tags">
            <span className="mc-platform" style={{ color: p.color, background: p.bg }}>{mention.platform}</span>
            {mention.source === "live" && <span className="mc-live">LIVE</span>}
          </div>
        </div>
        <span className="mc-time">{timeAgo(mention.timestamp)}</span>
      </div>

      <p className="mc-text">{mention.text}</p>

      <div className="mc-footer">
        <span className={`mc-sentiment ${mention.sentiment}`}>
          {mention.sentiment === "positive" ? "↑" : mention.sentiment === "negative" ? "↓" : "—"} {mention.sentiment}
        </span>
        <span className="mc-context">{mention.context}</span>
        <div className="mc-score-bar">
          <div className={`mc-score-fill ${mention.sentiment}`} style={{ width: `${mention.sentimentScore}%` }} />
        </div>
        <span className="mc-score-num">{mention.sentimentScore}%</span>
        {(mention.likes > 0 || mention.shares > 0) && (
          <span className="mc-engagement">
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
  const [rec, setRec]             = useState(null);
  const [loading, setLoading]     = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  useEffect(() => {
    if (!mentionId || !brand) { setRec(null); return; }
    setLoading(true);
    fetch(`${API}/recommendations?mentionId=${mentionId}&brand=${encodeURIComponent(brand)}`)
      .then(r => r.json())
      .then(data => { setRec(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [mentionId, brand]);

  const copy = (text, idx) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  return (
    <div className="rec-panel">
      <div className="rec-head">
        <div className="rec-head-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div>
          <div className="rec-head-title">Response Advisor</div>
          <div className="rec-head-sub">{selectedMention ? `Analyzing · ${selectedMention.author}` : "Select a mention"}</div>
        </div>
      </div>

      <div className="rec-body">
        {!selectedMention && (
          <div className="rec-empty">
            <div className="rec-empty-circle">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p>Select any mention from the feed to get AI-powered response recommendations.</p>
          </div>
        )}

        {loading && (
          <div className="rec-loading">
            <div className="spinner" />
            <span>Analyzing…</span>
          </div>
        )}

        {rec && !loading && (
          <>
            <div className="rec-chips">
              <span className="chip">{rec.recommendation.category}</span>
              <span className={`chip urgency-${rec.recommendation.urgency}`}>{rec.recommendation.urgency} Priority</span>
              <span className="chip">Tone: {rec.recommendation.tone}</span>
            </div>

            <div className="rec-section">
              <div className="rec-section-label">Response Templates</div>
              {rec.recommendation.templates.map((t, i) => (
                <div key={i} className="tpl-card">
                  <button className={`tpl-copy ${copiedIdx === i ? "copied" : ""}`} onClick={() => copy(t, i)}>
                    {copiedIdx === i ? "✓" : "Copy"}
                  </button>
                  {t}
                </div>
              ))}
            </div>

            <div className="rec-section">
              <div className="rec-section-label">Communication Strategy</div>
              <div className="do-dont-grid">
                <div className="do-card">
                  <div className="do-label">Do</div>
                  <ul>{rec.recommendation.doList.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
                <div className="dont-card">
                  <div className="dont-label">Don't</div>
                  <ul>{rec.recommendation.dontList.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              </div>
            </div>

            {(rec.mention.positiveWords.length > 0 || rec.mention.negativeWords.length > 0) && (
              <div className="rec-section">
                <div className="rec-section-label">Key Signals</div>
                <div className="chips-wrap">
                  {rec.mention.positiveWords.map((w, i) => <span key={i}   className="chip chip-pos">{w}</span>)}
                  {rec.mention.negativeWords.map((w, i) => <span key={`n${i}`} className="chip chip-neg">{w}</span>)}
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
  const [brandInput,      setBrandInput]      = useState("Acme Corp");
  const [brand,           setBrand]           = useState("");
  const [mentions,        setMentions]        = useState([]);
  const [summary,         setSummary]         = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);
  const [selectedMention, setSelectedMention] = useState(null);
  const [filterPlatform,  setFilterPlatform]  = useState("all");
  const [filterSentiment, setFilterSentiment] = useState("all");
  const [filterContext,   setFilterContext]   = useState("all");
  const [platforms,       setPlatforms]       = useState([]);

  const fetchData = useCallback(async (brandName) => {
    setLoading(true);
    setError(null);
    setSelectedMention(null);
    try {
      const [mRes, sRes, pRes] = await Promise.all([
        fetch(`${API}/mentions?brand=${encodeURIComponent(brandName)}&platform=${filterPlatform}&sentiment=${filterSentiment}&context=${filterContext}`),
        fetch(`${API}/summary?brand=${encodeURIComponent(brandName)}`),
        fetch(`${API}/platforms`),
      ]);
      const [mData, sData, pData] = await Promise.all([mRes.json(), sRes.json(), pRes.json()]);
      setMentions(mData.mentions);
      setSummary(sData.summary);
      setPlatforms(pData.platforms);
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

  const pct = summary && summary.total > 0 ? {
    positive: Math.round((summary.positive / summary.total) * 100),
    negative: Math.round((summary.negative / summary.total) * 100),
    neutral:  Math.round((summary.neutral  / summary.total) * 100),
  } : { positive: 0, negative: 0, neutral: 0 };

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
          </div>
          <span className="header-title">Brand Monitor</span>
        </div>
        <div className="header-right">
          <span className="live-dot" />
          <span className="header-live-text">Live</span>
          {brand && <span className="header-brand-pill">{brand}</span>}
        </div>
      </header>

      {/* ── Search ── */}
      <div className="search-bar-section">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-field">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="search-input"
              type="text"
              value={brandInput}
              onChange={e => setBrandInput(e.target.value)}
              placeholder="Search brand…"
            />
          </div>
          <button type="submit" className="search-btn" disabled={loading}>
            {loading ? "Loading…" : "Monitor"}
          </button>
        </form>
      </div>

      {/* ── Filters ── */}
      <div className="filters-section">
        <select className="filter-select" value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
          <option value="all">All Platforms</option>
          {platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <div className="seg-ctrl">
          {SENTIMENTS.map(s => (
            <button
              key={s}
              className={`seg ${s !== "all" ? `seg-${s}` : ""} ${filterSentiment === s ? "active" : ""}`}
              onClick={() => setFilterSentiment(s)}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="seg-ctrl">
          {CONTEXTS.map(c => (
            <button
              key={c}
              className={`seg ${filterContext === c ? "active" : ""}`}
              onClick={() => setFilterContext(c)}
            >
              {c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="content">
        {error && <div className="error-banner">{error}</div>}

        {/* Stats */}
        {summary && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Mentions</div>
              <div className="stat-num accent">{summary.total}</div>
              <div className="stat-sub">All platforms</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Positive</div>
              <div className="stat-num positive">{summary.positive}</div>
              <div className="stat-sub">{pct.positive}% of total</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Negative</div>
              <div className="stat-num negative">{summary.negative}</div>
              <div className="stat-sub">{pct.negative}% of total</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Neutral</div>
              <div className="stat-num neutral">{summary.neutral}</div>
              <div className="stat-sub">{pct.neutral}% of total</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Score</div>
              <div className={`stat-num ${summary.avgSentimentScore >= 60 ? "positive" : summary.avgSentimentScore <= 40 ? "negative" : "neutral"}`}>
                {summary.avgSentimentScore}
              </div>
              <div className="stat-sub">out of 100</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Est. Reach</div>
              <div className="stat-num accent">{formatNum(summary.reachEstimate)}</div>
              <div className="stat-sub">impressions</div>
            </div>
          </div>
        )}

        {/* Charts */}
        {summary && (
          <div className="charts-grid">
            <div className="glass-card">
              <div className="glass-card-title">Distribution</div>
              <SentimentDoughnut summary={summary} />
            </div>
            <div className="glass-card">
              <div className="glass-card-title">By Platform</div>
              <PlatformBar summary={summary} />
            </div>
            <div className="glass-card">
              <div className="glass-card-title">Trend</div>
              <TrendLine summary={summary} />
            </div>
          </div>
        )}

        {/* Signals */}
        {summary && (summary.topPositiveWords.length > 0 || summary.topNegativeWords.length > 0) && (
          <div className="glass-card signals-card">
            <div className="glass-card-title">Sentiment Signals</div>
            <div className="signals-grid">
              <div>
                <div className="signals-label positive">Top Positive</div>
                <div className="chips-wrap">
                  {summary.topPositiveWords.map((w, i) => <span key={i} className="chip chip-pos">{w.word} · {w.count}</span>)}
                </div>
              </div>
              <div>
                <div className="signals-label negative">Top Negative</div>
                <div className="chips-wrap">
                  {summary.topNegativeWords.map((w, i) => <span key={i} className="chip chip-neg">{w.word} · {w.count}</span>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Two-column feed */}
        <div className="feed-layout">
          <div className="feed-col">
            <div className="feed-header">
              <span className="feed-title">Mentions</span>
              {mentions.length > 0 && <span className="feed-count">{mentions.length}</span>}
            </div>

            {loading && (
              <div className="state-center">
                <div className="spinner" />
                <span>Fetching mentions…</span>
              </div>
            )}

            {!loading && mentions.length === 0 && !error && (
              <div className="state-center">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <span>No mentions found</span>
                <span className="state-sub">Try a different search or filters</span>
              </div>
            )}

            {!loading && mentions.map(m => (
              <MentionCard
                key={m.id}
                mention={m}
                selected={selectedMention?.id === m.id}
                onClick={m => setSelectedMention(selectedMention?.id === m.id ? null : m)}
              />
            ))}
          </div>

          <div className="advisor-col">
            <RecommendationPanel
              mentionId={selectedMention?.id}
              brand={brand}
              selectedMention={selectedMention}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

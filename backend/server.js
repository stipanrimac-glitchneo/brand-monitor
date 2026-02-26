const express = require("express");
const cors = require("cors");
const path = require("path");
const Sentiment = require("sentiment");
const axios = require("axios");
const { mockMentions, responseTemplates } = require("./mockData");

const app = express();
const sentimentAnalyzer = new Sentiment();

app.use(cors({ origin: "*" }));
app.use(express.json());

// Serve built frontend
const distPath = path.join(__dirname, "../frontend/dist");
app.use(express.static(distPath));

// ─── Sentiment Analysis ───────────────────────────────────────────────────────

function analyzeMention(raw) {
  const analysis = sentimentAnalyzer.analyze(raw.text);
  let sentimentLabel, sentimentScore;

  if (analysis.score > 2) {
    sentimentLabel = "positive";
    sentimentScore = Math.min(100, 50 + analysis.score * 5);
  } else if (analysis.score < -1) {
    sentimentLabel = "negative";
    sentimentScore = Math.max(0, 50 + analysis.score * 5);
  } else {
    sentimentLabel = "neutral";
    sentimentScore = 50;
  }

  const t = raw.text.toLowerCase();
  let context;
  if (t.includes("crash") || t.includes("broken") || t.includes("fix") || t.includes("denied") || t.includes("unacceptable") || t.includes("lost") || t.includes("refused")) {
    context = "complaint";
  } else if (t.includes("?") || t.includes("anyone") || t.includes("thinking of") || t.includes("question")) {
    context = "question";
  } else if (t.includes("incredible") || t.includes("love") || t.includes("amazing") || t.includes("obsessed") || t.includes("thrilled") || t.includes("blown away")) {
    context = "praise";
  } else if (t.includes("announce") || t.includes("raises") || t.includes("named") || t.includes("partnership") || t.includes("sale") || t.includes("analysis") || t.includes("earnings")) {
    context = "discussion";
  } else {
    context = sentimentLabel === "positive" ? "praise" : sentimentLabel === "negative" ? "complaint" : "discussion";
  }

  return {
    ...raw,
    sentiment: sentimentLabel,
    sentimentScore: Math.round(sentimentScore),
    context,
    rawScore: analysis.score,
    positiveWords: analysis.positive,
    negativeWords: analysis.negative,
  };
}

// ─── Data Sources ─────────────────────────────────────────────────────────────

let mentionIdCounter = 10000;
function nextId() { return ++mentionIdCounter; }

// Reddit (no API key needed)
async function fetchReddit(brand) {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(brand)}&sort=new&limit=25&t=week`;
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "BrandMonitor/1.0" },
      timeout: 8000,
    });
    return (data?.data?.children || []).map((child) => {
      const post = child.data;
      return {
        id: nextId(),
        platform: "Reddit",
        author: `u/${post.author}`,
        text: `${post.title}${post.selftext ? " — " + post.selftext.slice(0, 200) : ""}`,
        timestamp: new Date(post.created_utc * 1000).toISOString(),
        url: `https://reddit.com${post.permalink}`,
        likes: post.ups || 0,
        shares: 0,
        source: "live",
      };
    });
  } catch (err) {
    console.error("Reddit fetch error:", err.message);
    return [];
  }
}

// News API
async function fetchNews(brand) {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];
  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(brand)}&sortBy=publishedAt&pageSize=25&language=en&apiKey=${key}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    return (data?.articles || []).map((article) => ({
      id: nextId(),
      platform: "News",
      author: article.author || article.source?.name || "Unknown",
      text: `${article.title}${article.description ? " — " + article.description : ""}`,
      timestamp: article.publishedAt || new Date().toISOString(),
      url: article.url,
      likes: 0,
      shares: 0,
      source: "live",
    }));
  } catch (err) {
    console.error("News API fetch error:", err.message);
    return [];
  }
}

// YouTube API
async function fetchYouTube(brand) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(brand)}&type=video&maxResults=25&order=date&key=${key}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    return (data?.items || []).map((item) => ({
      id: nextId(),
      platform: "YouTube",
      author: item.snippet.channelTitle,
      text: `${item.snippet.title} — ${item.snippet.description?.slice(0, 200) || ""}`,
      timestamp: item.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      likes: 0,
      shares: 0,
      source: "live",
    }));
  } catch (err) {
    console.error("YouTube fetch error:", err.message);
    return [];
  }
}

// Twitter / X API
async function fetchTwitter(brand) {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) return [];
  try {
    const query = encodeURIComponent(`${brand} -is:retweet lang:en`);
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=25&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username`;
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });
    const users = {};
    (data?.includes?.users || []).forEach((u) => { users[u.id] = u.username; });
    return (data?.data || []).map((tweet) => ({
      id: nextId(),
      platform: "Twitter",
      author: `@${users[tweet.author_id] || tweet.author_id}`,
      text: tweet.text,
      timestamp: tweet.created_at,
      url: `https://twitter.com/i/web/status/${tweet.id}`,
      likes: tweet.public_metrics?.like_count || 0,
      shares: tweet.public_metrics?.retweet_count || 0,
      source: "live",
    }));
  } catch (err) {
    console.error("Twitter fetch error:", err.message);
    return [];
  }
}

// Mock data fallback
function fetchMock(brand) {
  return mockMentions.map((m) => ({
    ...m,
    text: m.text.replace(/\{\{BRAND\}\}/g, brand),
    source: "mock",
  }));
}

// Fetch all sources in parallel
async function fetchAllMentions(brand) {
  const [reddit, news, youtube, twitter] = await Promise.all([
    fetchReddit(brand),
    fetchNews(brand),
    fetchYouTube(brand),
    fetchTwitter(brand),
  ]);

  const live = [...reddit, ...news, ...youtube, ...twitter];
  const base = live.length > 0 ? live : fetchMock(brand);
  return base.map(analyzeMention).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/api/mentions", async (req, res) => {
  const brand = req.query.brand || "YourBrand";
  const { platform, sentiment, context } = req.query;

  let mentions = await fetchAllMentions(brand);

  if (platform && platform !== "all") {
    mentions = mentions.filter((m) => m.platform.toLowerCase() === platform.toLowerCase());
  }
  if (sentiment && sentiment !== "all") {
    mentions = mentions.filter((m) => m.sentiment === sentiment);
  }
  if (context && context !== "all") {
    mentions = mentions.filter((m) => m.context === context);
  }

  res.json({ brand, mentions, total: mentions.length });
});

app.get("/api/summary", async (req, res) => {
  const brand = req.query.brand || "YourBrand";
  const mentions = await fetchAllMentions(brand);

  const summary = {
    total: mentions.length,
    positive: mentions.filter((m) => m.sentiment === "positive").length,
    negative: mentions.filter((m) => m.sentiment === "negative").length,
    neutral: mentions.filter((m) => m.sentiment === "neutral").length,
    byPlatform: {},
    bySentimentOverTime: [],
    avgSentimentScore: 0,
    topPositiveWords: [],
    topNegativeWords: [],
    reachEstimate: mentions.reduce((sum, m) => sum + (m.likes || 0) + (m.shares || 0) * 3, 0),
    sources: {
      reddit: mentions.filter((m) => m.platform === "Reddit").length,
      news: mentions.filter((m) => m.platform === "News").length,
      youtube: mentions.filter((m) => m.platform === "YouTube").length,
      twitter: mentions.filter((m) => m.platform === "Twitter").length,
      mock: mentions.filter((m) => m.source === "mock").length,
    },
  };

  mentions.forEach((m) => {
    if (!summary.byPlatform[m.platform]) {
      summary.byPlatform[m.platform] = { positive: 0, negative: 0, neutral: 0, total: 0 };
    }
    summary.byPlatform[m.platform][m.sentiment]++;
    summary.byPlatform[m.platform].total++;
  });

  const days = {};
  mentions.forEach((m) => {
    const day = m.timestamp.split("T")[0];
    if (!days[day]) days[day] = { positive: 0, negative: 0, neutral: 0, date: day };
    days[day][m.sentiment]++;
  });
  summary.bySentimentOverTime = Object.values(days).sort((a, b) => a.date.localeCompare(b.date));

  summary.avgSentimentScore = mentions.length
    ? Math.round(mentions.reduce((sum, m) => sum + m.sentimentScore, 0) / mentions.length)
    : 0;

  const posWords = {}, negWords = {};
  mentions.forEach((m) => {
    (m.positiveWords || []).forEach((w) => { posWords[w] = (posWords[w] || 0) + 1; });
    (m.negativeWords || []).forEach((w) => { negWords[w] = (negWords[w] || 0) + 1; });
  });
  summary.topPositiveWords = Object.entries(posWords).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word, count]) => ({ word, count }));
  summary.topNegativeWords = Object.entries(negWords).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word, count]) => ({ word, count }));

  res.json({ brand, summary });
});

app.get("/api/recommendations", async (req, res) => {
  const brand = req.query.brand || "YourBrand";
  const mentionId = parseInt(req.query.mentionId);

  const allMentions = await fetchAllMentions(brand);
  const mention = allMentions.find((m) => m.id === mentionId);

  if (!mention) {
    return res.status(404).json({ error: "Mention not found" });
  }

  let templateKey;
  if (mention.sentiment === "negative" && mention.context === "complaint") {
    templateKey = "negative_complaint";
  } else if (mention.sentiment === "positive") {
    templateKey = "positive_praise";
  } else if (mention.context === "question") {
    templateKey = "neutral_question";
  } else {
    templateKey = "neutral_discussion";
  }

  const recommendation = responseTemplates[templateKey];
  res.json({
    mention,
    recommendation: {
      ...recommendation,
      templates: recommendation.templates.map((t) =>
        t.replace("[Name]", mention.author.replace(/[@u\/]/g, ""))
      ),
    },
  });
});

app.get("/api/platforms", (req, res) => {
  const platforms = ["Reddit", "News", "YouTube", "Twitter"];
  res.json({ platforms });
});

// Health check — shows which keys are configured
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    keys: {
      newsapi: !!process.env.NEWSAPI_KEY,
      youtube: !!process.env.YOUTUBE_API_KEY,
      twitter: !!process.env.TWITTER_BEARER_TOKEN,
      reddit: true,
    },
  });
});

// Catch-all: serve React app for any non-API route
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Brand Monitor API running on port ${PORT}`);
});

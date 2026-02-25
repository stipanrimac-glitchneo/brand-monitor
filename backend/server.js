const express = require("express");
const cors = require("cors");
const Sentiment = require("sentiment");
const { mockMentions, responseTemplates } = require("./mockData");

const app = express();
const sentimentAnalyzer = new Sentiment();

app.use(cors({ origin: "*" }));
app.use(express.json());

// Inject brand name into text and analyze sentiment
function processMention(mention, brand) {
  const text = mention.text.replace(/\{\{BRAND\}\}/g, brand);
  const analysis = sentimentAnalyzer.analyze(text);

  let sentimentLabel, sentimentScore, context;

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

  // Determine context
  const lowerText = text.toLowerCase();
  if (
    lowerText.includes("crash") ||
    lowerText.includes("broken") ||
    lowerText.includes("fix") ||
    lowerText.includes("denied") ||
    lowerText.includes("unacceptable") ||
    lowerText.includes("lost") ||
    lowerText.includes("refused")
  ) {
    context = "complaint";
  } else if (
    lowerText.includes("?") ||
    lowerText.includes("anyone") ||
    lowerText.includes("thinking of") ||
    lowerText.includes("question")
  ) {
    context = "question";
  } else if (
    lowerText.includes("incredible") ||
    lowerText.includes("love") ||
    lowerText.includes("amazing") ||
    lowerText.includes("obsessed") ||
    lowerText.includes("thrilled") ||
    lowerText.includes("blown away") ||
    lowerText.includes("chef's kiss")
  ) {
    context = "praise";
  } else if (
    lowerText.includes("announce") ||
    lowerText.includes("raises") ||
    lowerText.includes("named") ||
    lowerText.includes("partnership") ||
    lowerText.includes("sale") ||
    lowerText.includes("comparing") ||
    lowerText.includes("analysis") ||
    lowerText.includes("signals") ||
    lowerText.includes("earnings")
  ) {
    context = "discussion";
  } else {
    context = sentimentLabel === "positive" ? "praise" : sentimentLabel === "negative" ? "complaint" : "discussion";
  }

  return {
    ...mention,
    text,
    sentiment: sentimentLabel,
    sentimentScore: Math.round(sentimentScore),
    context,
    rawScore: analysis.score,
    positiveWords: analysis.positive,
    negativeWords: analysis.negative,
  };
}

// GET /api/mentions?brand=BrandName
app.get("/api/mentions", (req, res) => {
  const brand = req.query.brand || "YourBrand";
  const platform = req.query.platform;
  const sentiment = req.query.sentiment;
  const context = req.query.context;

  let processed = mockMentions.map((m) => processMention(m, brand));

  if (platform && platform !== "all") {
    processed = processed.filter(
      (m) => m.platform.toLowerCase() === platform.toLowerCase()
    );
  }
  if (sentiment && sentiment !== "all") {
    processed = processed.filter((m) => m.sentiment === sentiment);
  }
  if (context && context !== "all") {
    processed = processed.filter((m) => m.context === context);
  }

  res.json({ brand, mentions: processed, total: processed.length });
});

// GET /api/summary?brand=BrandName
app.get("/api/summary", (req, res) => {
  const brand = req.query.brand || "YourBrand";
  const processed = mockMentions.map((m) => processMention(m, brand));

  const summary = {
    total: processed.length,
    positive: processed.filter((m) => m.sentiment === "positive").length,
    negative: processed.filter((m) => m.sentiment === "negative").length,
    neutral: processed.filter((m) => m.sentiment === "neutral").length,
    byPlatform: {},
    bySentimentOverTime: [],
    avgSentimentScore: 0,
    topPositiveWords: [],
    topNegativeWords: [],
    reachEstimate: processed.reduce((sum, m) => sum + (m.likes || 0) + (m.shares || 0) * 3, 0),
  };

  // Platform breakdown
  processed.forEach((m) => {
    if (!summary.byPlatform[m.platform]) {
      summary.byPlatform[m.platform] = { positive: 0, negative: 0, neutral: 0, total: 0 };
    }
    summary.byPlatform[m.platform][m.sentiment]++;
    summary.byPlatform[m.platform].total++;
  });

  // Sentiment over time (last 3 days bucketed by day)
  const days = {};
  processed.forEach((m) => {
    const day = m.timestamp.split("T")[0];
    if (!days[day]) days[day] = { positive: 0, negative: 0, neutral: 0, date: day };
    days[day][m.sentiment]++;
  });
  summary.bySentimentOverTime = Object.values(days).sort((a, b) => a.date.localeCompare(b.date));

  // Average sentiment score
  summary.avgSentimentScore = Math.round(
    processed.reduce((sum, m) => sum + m.sentimentScore, 0) / processed.length
  );

  // Word frequency
  const posWords = {}, negWords = {};
  processed.forEach((m) => {
    m.positiveWords.forEach((w) => { posWords[w] = (posWords[w] || 0) + 1; });
    m.negativeWords.forEach((w) => { negWords[w] = (negWords[w] || 0) + 1; });
  });
  summary.topPositiveWords = Object.entries(posWords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));
  summary.topNegativeWords = Object.entries(negWords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));

  res.json({ brand, summary });
});

// GET /api/recommendations?mentionId=1&brand=BrandName
app.get("/api/recommendations", (req, res) => {
  const brand = req.query.brand || "YourBrand";
  const mentionId = parseInt(req.query.mentionId);

  const rawMention = mockMentions.find((m) => m.id === mentionId);
  if (!rawMention) {
    return res.status(404).json({ error: "Mention not found" });
  }

  const mention = processMention(rawMention, brand);

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

// GET /api/platforms
app.get("/api/platforms", (req, res) => {
  const platforms = [...new Set(mockMentions.map((m) => m.platform))];
  res.json({ platforms });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Brand Monitor API running on http://localhost:${PORT}`);
});

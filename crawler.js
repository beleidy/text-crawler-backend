const HCCrawler = require("headless-chrome-crawler");
const RedisCache = require("headless-chrome-crawler/cache/redis");

const RESET_CRAWLING_CACHE = process.env.RESET_CRAWLING_CACHE;
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = parseInt(process.env.REDIS_PORT);

// Create inactive crawler connected to Redis
async function makeCrawler() {
  const cache = new RedisCache({
    host: REDIS_HOST,
    port: REDIS_PORT
  });

  const crawler = await HCCrawler.launch({
    args: ["--no-sandbox"],
    persistCache: true,
    cache,
    depthPriority: false,
    maxDepth: 1,
    waituntil: ["networkidle0", "domcontentloaded", "load"],
    evaluatePage: () => document.body.innerText
  });
  !!parseInt(RESET_CRAWLING_CACHE) && crawler.clearCache();
  crawler.pause();
  return crawler;
}

module.exports = makeCrawler;

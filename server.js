const redis = require("redis");
const HCCrawler = require("headless-chrome-crawler");
const RedisCache = require("headless-chrome-crawler/cache/redis");

const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);

const REDIS_HOST = "localhost";
const REDIS_PORT = 6379;

(async function main() {
  // Connect to Redis
  const redisClient = redis.createClient();
  redisClient.on("error", function(err) {
    console.log("Redis Client Error " + err);
  });

  // Create inactive crawler connected to Redis
  const cache = new RedisCache({
    host: REDIS_HOST,
    port: REDIS_PORT
  });

  const crawler = await HCCrawler.launch({
    args: ["--no-sandbox"],
    persistCache: true,
    cache,
    depthPriority: false,
    maxDepth: 3,
    waituntil: ["networkidle0", "domcontentloaded", "load"],
    evaluatePage: () => document.body.innerText
  });
  crawler.clearCache();
  crawler.pause();

  //
  io.on("connection", socket => {
    socket.on("GetSiteText", fn => {
      // 1. Check with elastic search if it exists
      // 2. If it does, retrieve text and send back to fn
      // 3. If it doesn't add it to the crawler queue
      // 4. Backoff and check with ES again
    });
  });
})();

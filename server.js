const elasticsearch = require("elasticsearch");
const redis = require("redis");
const HCCrawler = require("headless-chrome-crawler");
const RedisCache = require("headless-chrome-crawler/cache/redis");

const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);

const REDIS_HOST = "localhost";
const REDIS_PORT = 6379;
const ES_PORT = 9200;
const ES_HOST = `localhost:${ES_PORT}`;

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

  // Create ES client
  const esClient = new elasticsearch.Client({
    host: ES_HOST,
    log: "trace"
  });
  // Check ES is alive
  try {
    await esClient.ping({ requestTimeout: 30000 });
  } catch (err) {
    console.error("ES error: ", err);
  }

  const indexExists = await esClient.indices.exists({ index: "sites" });
  if (!indexExists) await esClient.indices.create({ index: "sites" });

  await esClient.indices.putMapping({
    index: "sites",
    type: "_doc",
    updateAllTypes: true,
    body: {
      properties: {
        domain: { type: "keyword" },
        uri: { type: "keyword" },
        siteText: { type: "text" },
        lastUpdated: { type: "date" }
      }
    }
  });

  console.log(await checkIfSiteExists("site1"));

  //
  io.on("connection", socket => {
    socket.on("GetSiteText", fn => {
      // 1. Check with elastic search if it exists
      // 2. If it does, retrieve text and send back to fn
      // 3. If it doesn't add it to the crawler queue
      // 4. Backoff and check with ES again
    });
  });

  async function checkIfSiteExists(siteAddress) {
    const response = await esClient.search({
      index: "sites",
      q: `address: ${siteAddress}`
    });
    if (response.hits.total == 0) {
      return false;
    } else {
      return response.hits.hits;
    }
  }
})();

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
    maxDepth: 1,
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

  const uriToFetch = "uri1";

  //
  io.on("connection", socket => {
    socket.on("GetSiteText", uriToFetch => {
      return (await getSiteText(uriToFetch));
    });
  });

  async function getSiteText(uriToFetch) {
    let siteText = await getSiteTextFromES(uriToFetch);
    if (!siteText) crawler.queue(uriToFetch);

    for (const tries = 1; tries < 3; n++) {
      if (!siteText) {
        await sleep(1000 * tries + Math.random() * 500);
        siteText = await getSiteTextFromES(uriToFetch);
      } else {
        break;
      }
    }

    if (!siteText) {
      return false;
    } else {
      return siteText;
    }
  }

  async function getSiteTextFromES(uriToFetch) {
    const response = await esClient.search({
      index: "sites",
      q: `uri: ${uriToFetch}`
    });
    if (response.hits.total == 0) {
      return false;
    } else {
      return response.hits.hits;
    }
  }
})();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const elasticsearch = require("elasticsearch");
const redis = require("redis");
const HCCrawler = require("headless-chrome-crawler");
const RedisCache = require("headless-chrome-crawler/cache/redis");

const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);

const SERVER_PORT = 8000;
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT) || 6379;
const ES_PORT = parseInt(process.env.ES_PORT) || 9200;
const ES_HOST = `${process.env.ES_HOST || "localhost"}:${ES_PORT}`;

server.listen(SERVER_PORT);

app.get("/", function(req, res) {
  res.json({ status: "UP" });
});

(async function main() {
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

  //
  io.on("connection", socket => {
    socket.on("GetSiteText", async (uriToFetch, fn) => {
      const text = await getSiteText(new URL(uriToFetch));
      if (text) fn(text);
    });
  });

  async function getSiteText(uriToFetch) {
    let siteText = await getSiteTextFromES(uriToFetch);
    if (!siteText) {
      crawler.queue([
        {
          url: uriToFetch.toString().replace("http://", "https://"),
          allowedDomins: [uriToFetch.hostname]
        }
      ]);
    }

    for (let tries = 1; tries < 3; tries++) {
      if (!siteText) {
        await sleep(3000 * tries + Math.random() * 500);
        console.log("Trying again ", tries);
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
      type: "_doc",
      body: {
        query: {
          term: {
            uri: uriToFetch.toString().replace("http://", "https://")
          }
        }
      }
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

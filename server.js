require("dotenv").config();
const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);

const makeCrawler = require("./crawler");
const client = require("./elasticsearch");

const SERVER_PORT = process.env.SERVER_PORT;
server.listen(SERVER_PORT);

(async function main() {
  const crawler = makeCrawler();

  await client.ping();

  // Create index if it doesn't exist
  const indexExists = await client.indices.exists({ index: "sites" });
  if (!indexExists) await client.indices.create({ index: "sites" });

  try {
    await client.indices.putMapping({
      index: "sites",
      type: "_doc",
      includeTypeName: true,
      body: {
        properties: {
          domain: { type: "keyword" },
          uri: { type: "keyword" },
          siteText: { type: "text" },
          lastUpdated: { type: "date" }
        }
      }
    });
  } catch (err) {
    console.log(err);
  }

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
    const response = await client.search({
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

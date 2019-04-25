require("dotenv").config();
const util = require("util");
const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const retry = require("async-retry");

const makeCrawler = require("./crawler");
const client = require("./elasticsearch");

const SERVER_PORT = process.env.SERVER_PORT;
server.listen(SERVER_PORT);

(async function main() {
  // Check ES is alive
  // Create sites index if it doesn't exist
  try {
    await client.ping();
    const indexExists = await client.indices.exists({ index: "sites" });
    if (!indexExists.body) {
      await client.indices.create({
        index: "sites",
        body: {
          mappings: {
            properties: {
              domain: { type: "keyword" },
              uri: { type: "keyword" },
              siteText: { type: "text" },
              lastUpdated: { type: "date" }
            }
          }
        }
      });
    }
  } catch (e) {
    console.log(
      "Could not find or create index",
      util.inspect(e, { depth: null, color: true })
    );
  }

  // Create crawler instance
  const crawler = await makeCrawler();

  // Handle incoming socket connection
  io.on("connection", socket => {
    socket.on("GetSiteText", async (uriToFetch, fn) => {
      console.log("received site address to get text");

      async function getSiteText(uriToFetch) {
        console.log("Sending search request to db");
        const { body } = await client.search({
          index: "sites",
          body: {
            query: {
              term: {
                uri: uriToFetch.toString().replace("http://", "https://")
              }
            }
          }
        });
        console.log("Received search response from db");
        if (body.hits.total.value == 0) {
          throw new Error("No search results returned");
        } else {
          return body.hits.hits;
        }
      }

      try {
        await retry(
          async (bail, attempt) => {
            console.log("Attempt number: ", attempt);
            if (attempt == 2) {
              await crawler.queue([
                {
                  url: uriToFetch.toString().replace("http://", "https://"),
                  allowedDomins: [uriToFetch.hostname]
                }
              ]);
            }
            const text = await getSiteText(new URL(uriToFetch));
            fn(text);
          },
          {
            retries: 5
          }
        );
      } catch (e) {
        if (e.message === "No search results returned") {
          console.log("Crawler not getting site in time");
        } else {
          console.log("Unable to search database");
        }
      }
    });
  });
})();

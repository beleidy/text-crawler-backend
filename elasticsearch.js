const util = require("util");
const { Client } = require("@elastic/elasticsearch");

const ES_PORT = parseInt(process.env.ES_PORT);
const ES_HOST = process.env.ES_HOST;

// Create ES client
const client = new Client({
  node: `http://${ES_HOST}:${ES_PORT}`
});

// Add logging
function log(event, err, req) {
  const inspectOptions = {
    depth: null,
    colors: true
  };
  err && console.log(event, " Error: ", util.inspect(err, inspectOptions));
  req && console.log(event, " Request: ", util.inspect(req, inspectOptions));
}

client.on("request", (err, req) => log("request", err, req));
client.on("response", (err, req) => log("response", err, req));
client.on("sniff", (err, req) => log("sniff", err, req));
client.on("resurrect", (err, req) => log("resurrect", err, req));

module.exports = client;

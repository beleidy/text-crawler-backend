# Text crawler (backend)

Text Crawler is an app that returns the text of any site you give it. It is intended as an aid for natural language processing practioners who can programatically collect data from the web. With this in mind, more features will be developed.

## App structure
![text-crawler-architecture](/uploads/6578d22b9b6163c8950c0974c7a982d3/Screenshot_from_2019-04-16_15-46-00.png)

The app has 5 parts. 

1. The Crawlers: These are NodeJS processes that will collect the text. You can scale their deployment as your needs be, to speed up crawling. In order not to crawl the same pages, crawlers use:
2. Redis: Redis is an in memory data structure store. Crawlers place their pages to be scraped in a priority queue and retrieve their next page to be crawled from there
3. Elastic Search: A distributed search engine, with, among other features, full-text search capabilities. 
4. **This repo** The Backend: Serves as the main backend server, receiving site addresses from the front end and adding them to the crawling queue if they're not already available in the database (Elastic Search).
5. The Front-end: Provides an interface for connecting with the crawler

## Installing
### Prerequistes
* NodeJS
* Running [ElasticSearch](https://www.elastic.co/downloads/elasticsearch) instance
* Running [Redis](https://redis.io/download) instance 

### Download
```
git clone https://gitlab.com/text-crawler/text-crawler-backend.git
cd text-crawler-backend
npm install
```

### Before your run
If you are not running the databases on their default ports on `localhost` (Redis: `6379`, ES: `9200` ) then you will need to assign the values of the hosts and port to the enviornment variables:

| Env Variable | Description |
| ------------ | ----------- |
| REDIS_HOST | The host address of the Redis database |
| REDIS_PORT | The port number of the Redis database |
| ES_HOST | The host address of the Elastic Search database |
| ES_PORT | The port number of the Elastic Search database |

### Run the backend
```
node server.js
```

## Other parts of the app
Now that the backend server is running, you will need to get a crawler and the front-end running.

[Crawler Repo](https://gitlab.com/text-crawler/text-crawler-crawler)

[Frontend Repo](https://gitlab.com/text-crawler/text-crawler-frontend)



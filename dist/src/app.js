"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const dotenv = require("dotenv");
const fastify = require("fastify");
const fastifyCors = require("@fastify/cors");
const fastifyHttpProxy = require("@fastify/http-proxy");
const queryParams = require("./utils/query-params.js");
const proxy = require("./services/proxy/proxy.js");
dotenv.config();
const app = fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname,reqId,responseTime,req,res",
        messageFormat: "{msg} {url}"
      }
    },
    serializers: {
      req: function(req) {
        return {
          method: req.method,
          url: req.url
        };
      },
      res: function(res) {
        return {
          statusCode: res.statusCode
        };
      }
    }
  }
});
app.register(fastifyCors, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
});
app.addHook("onRequest", (request, reply, done) => {
  if (process.env.NODE_ENV !== "testing") {
    request.log.info(`${request.method} ${request.url}`);
  }
  done();
});
app.register(fastifyHttpProxy, {
  upstream: process.env.PROXY_TARGET || "http://localhost:3000/local-proxy",
  prefix: "/tb/web_analytics",
  rewritePrefix: "",
  // we'll hardcode this in PROXY_TARGET
  httpMethods: ["GET", "POST", "PUT", "DELETE"],
  preValidation: proxy.validateRequest,
  preHandler: proxy.processRequest,
  rewriteRequest: (req) => {
    req.url = queryParams.filterQueryParams(req.url);
    return req;
  },
  replyOptions: {
    onError: (reply, error) => {
      reply.log.error(error);
      reply.status(502).send({ error: "Proxy error" });
    }
  }
});
app.get("/", async () => {
  return "Hello World - Github Actions Deployment Test";
});
app.post("/local-proxy*", async () => {
  return "Hello World - From the local proxy";
});
exports.default = app;

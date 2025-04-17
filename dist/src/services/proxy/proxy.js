"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const validators = require("./validators.js");
const processors = require("./processors.js");
function processRequest(request, reply, done) {
  try {
    processors.parseUserAgent(request);
  } catch (error) {
    reply.code(500).send(error);
    return;
  }
  done();
}
function validateRequest(request, reply, done) {
  try {
    validators.validateQueryParams(request);
    validators.validateRequestBody(request);
  } catch (error) {
    reply.code(400).send(error);
    return;
  }
  done();
}
exports.processRequest = processRequest;
exports.validateRequest = validateRequest;

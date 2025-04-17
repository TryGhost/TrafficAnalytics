"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const errors = require("@tryghost/errors");
function validateQueryParams(request) {
  const token = request.query.token;
  const name = request.query.name;
  if (!token || token.trim() === "" || !name || name.trim() === "") {
    throw new errors.BadRequestError({
      message: "Token and name query parameters are required"
    });
  }
}
function validateRequestBody(request) {
  if (!request.body || Object.keys(request.body).length === 0 || !request.body.payload) {
    throw new errors.BadRequestError({
      message: "Request body is required"
    });
  }
}
exports.validateQueryParams = validateQueryParams;
exports.validateRequestBody = validateRequestBody;

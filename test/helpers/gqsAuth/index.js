const express = require("express");
const createAuthRouter = require("./router");
const { attachAuthFromSession } = require("./session");

const REQUIRED_AUTH_FIELDS = ["clientId", "clientSecret", "issuerUri", "redirectUri", "sessionSecret"];

function assertAuthConfigured(authConfig) {
  const missing = REQUIRED_AUTH_FIELDS.filter((field) => !authConfig[field]);
  if (missing.length > 0) {
    throw new Error(`gqsAuth fixture: enabled is true but missing: ${missing.join(", ")}`);
  }
}

function authRouter(authConfig = {}) {
  if (!authConfig.enabled) return express.Router();
  assertAuthConfigured(authConfig);
  return createAuthRouter(authConfig);
}

module.exports = { authRouter, attachAuthFromSession };

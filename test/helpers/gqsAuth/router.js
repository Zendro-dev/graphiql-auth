const express = require("express");
const { parseCookies, sign, unsign, serializeCookie } = require("./cookies");
const {
  createSession,
  getSession,
  destroySession,
  readSessionId,
  sessionCookieHeader,
  clearSessionCookieHeader,
} = require("./session");
const { loadClient, getConfiguration } = require("./oidc");

const FLOW_COOKIE = "zendro_giql_oauth_flow";
const FLOW_MAX_AGE = 600;

const REDIRECT_URI_HEADER = "x-zendro-auth-redirect-uri";

function matchesAllowedRedirectUri(uri, allowedPatterns) {
  if (!uri || !Array.isArray(allowedPatterns)) return false;
  try {
    new URL(uri);
  } catch {
    return false;
  }
  return allowedPatterns.some((pattern) =>
    pattern.endsWith("*") ? uri.startsWith(pattern.slice(0, -1)) : uri === pattern
  );
}

function resolveRedirectUri(req, authConfig) {
  const requested = req.headers[REDIRECT_URI_HEADER];
  if (requested && matchesAllowedRedirectUri(requested, authConfig.allowedRedirectUris)) {
    return requested;
  }
  return authConfig.redirectUri;
}

function redirectTargetFor(redirectUri, authConfig) {
  if (redirectUri === authConfig.redirectUri) return authConfig.postLoginRedirectTo || "/";
  try {
    return `${new URL(redirectUri).origin}/`;
  } catch {
    return authConfig.postLoginRedirectTo || "/";
  }
}

function derivePostLogoutRedirectUri(authConfig, redirectUri) {
  if (authConfig.postLogoutRedirectUri) return authConfig.postLogoutRedirectUri;
  const target = redirectTargetFor(redirectUri, authConfig);
  return target.startsWith("/") ? `${new URL(redirectUri).origin}${target}` : target;
}

function currentUrlFor(req, redirectUri) {
  const url = new URL(req.originalUrl, `${req.protocol}://${req.get("host")}`);
  if (redirectUri) {
    const override = new URL(redirectUri);
    url.protocol = override.protocol;
    url.hostname = override.hostname;
    url.port = override.port;
    url.pathname = override.pathname;
  }
  return url;
}

function createAuthRouter(authConfig) {
  const router = express.Router();
  const cookieOpts = (req) => ({ secure: req.protocol === "https" });

  router.get("/login", async (req, res, next) => {
    try {
      const client = await loadClient();
      const config = await getConfiguration(authConfig);
      const redirectUri = resolveRedirectUri(req, authConfig);

      const state = client.randomState();
      const codeVerifier = client.randomPKCECodeVerifier();
      const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

      const flowPayload = JSON.stringify({ state, codeVerifier, redirectUri });
      res.setHeader(
        "Set-Cookie",
        serializeCookie(FLOW_COOKIE, sign(flowPayload, authConfig.sessionSecret), {
          ...cookieOpts(req),
          maxAge: FLOW_MAX_AGE,
        })
      );

      const authUrl = client.buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        scope: "openid",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      res.redirect(authUrl.toString());
    } catch (err) {
      next(err);
    }
  });

  router.get("/callback", async (req, res) => {
    const clearFlowCookie = serializeCookie(FLOW_COOKIE, "", { ...cookieOpts(req), maxAge: 0 });

    const rawFlow = parseCookies(req.headers.cookie)[FLOW_COOKIE];
    const flowPayload = rawFlow && unsign(rawFlow, authConfig.sessionSecret);
    if (!flowPayload) {
      res.setHeader("Set-Cookie", clearFlowCookie);
      return res.status(400).send("Login session expired or invalid. Please try logging in again.");
    }
    const { state, codeVerifier, redirectUri } = JSON.parse(flowPayload);

    try {
      const client = await loadClient();
      const config = await getConfiguration(authConfig);
      const tokens = await client.authorizationCodeGrant(config, currentUrlFor(req, redirectUri), {
        expectedState: state,
        pkceCodeVerifier: codeVerifier,
      });

      const sessionId = createSession(tokens);
      res.setHeader("Set-Cookie", [clearFlowCookie, sessionCookieHeader(sessionId, authConfig.sessionSecret, cookieOpts(req))]);
      res.redirect(redirectTargetFor(redirectUri, authConfig));
    } catch (err) {
      res.setHeader("Set-Cookie", clearFlowCookie);
      return res.status(400).send(`Login failed: ${err.message}`);
    }
  });

  router.get("/session", (req, res) => {
    const sessionId = readSessionId(req, authConfig.sessionSecret);
    res.json({ authenticated: Boolean(getSession(sessionId)) });
  });

  router.get("/logout", async (req, res, next) => {
    const sessionId = readSessionId(req, authConfig.sessionSecret);
    const session = getSession(sessionId);
    destroySession(sessionId);
    res.setHeader("Set-Cookie", clearSessionCookieHeader(cookieOpts(req)));

    const redirectUri = resolveRedirectUri(req, authConfig);

    try {
      const client = await loadClient();
      const config = await getConfiguration(authConfig);
      const endSessionEndpoint = config.serverMetadata().end_session_endpoint;
      if (!endSessionEndpoint) {
        return res.redirect(redirectTargetFor(redirectUri, authConfig));
      }
      const endSessionUrl = client.buildEndSessionUrl(config, {
        post_logout_redirect_uri: derivePostLogoutRedirectUri(authConfig, redirectUri),
        ...(session?.idToken ? { id_token_hint: session.idToken } : {}),
      });
      res.redirect(endSessionUrl.toString());
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = createAuthRouter;

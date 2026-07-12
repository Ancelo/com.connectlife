'use strict';

/**
 * ConnectLife cloud API client (HijuConn gateway).
 *
 * Node.js port of the Python library https://github.com/oyvindwe/connectlife
 * (itself based on github.com/bilan/connectlife-api-connector). ConnectLife is
 * the cloud used by Hisense, Gorenje, ASKO, ATAG and ETNA appliances (the
 * "ConnectLife" mobile app), distinct from the Chinese Hisense/hismarttv cloud.
 *
 * Unofficial, community-built. Not affiliated with or endorsed by ConnectLife.
 *
 * Auth is a 4-step flow: Gigya login -> Gigya getJWT -> HijuConn OAuth authorize
 * -> OAuth token. Gateway calls (device list, property set) are signed with
 * SHA-256 + RSA (PKCS#1 v1.5) using the gateway's public key, plus a per-request
 * nonce (randStr).
 */

const https = require('https');
const zlib = require('zlib');
const crypto = require('crypto');
const { URL } = require('url');

// --- Gigya (identity) ---
const API_KEY = '4_yhTWQmHFpZkQZDSV1uV-_A';
const LOGIN_URL = 'https://accounts.eu1.gigya.com/accounts.login';
const JWT_URL = 'https://accounts.eu1.gigya.com/accounts.getJWT';

// --- HijuConn OAuth ---
const OAUTH_AUTHORIZE = 'https://oauth.hijuconn.com/oauth/authorize';
const OAUTH_TOKEN = 'https://oauth.hijuconn.com/oauth/token';
const CLIENT_ID = '5065059336212';
const CLIENT_SECRET = '07swfKgvJhC3ydOUS9YV_SwVz0i4LKqlOLGNUukYHVMsJRF1b-iWeUGcNlXyYCeK';
const REDIRECT_URI = 'https://api.connectlife.io/swagger/oauth2-redirect.html';

// --- HijuConn gateway ---
const GATEWAY_BASE = 'https://clife-eu-gateway.hijuconn.com';
const DEVICE_LIST_URL = `${GATEWAY_BASE}/clife-svc/pu/get_device_status_list`;
const UPDATE_URL = `${GATEWAY_BASE}/device/pu/property/set`;
const APP_ID = '47110565134383';
const APP_SECRET = 'yOzhz6junYno-nmULM3Wr7PU_dpSZN22ZdluvVWZ4uW5ZwwG8fIGCHTbrhcnU-iv';
const LANGUAGE_ID = '12';
const TIMEZONE = '1.0';
const VERSION = '5.0';
const SIGN_SUFFIX = 'D9519A4B756946F081B7BB5B5E8D1197';
const INVALID_ACCESS_TOKEN_CODE = 100026;
const RANDSTR_CHECK_FAILED_CODE = 101005;

const USER_AGENT = 'connectlife-homey/0.1';

const GATEWAY_PUBLIC_KEY =
  '-----BEGIN PUBLIC KEY-----\n' +
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyyWrNG6q475HIHu7sMVu\n' +
  'vHof6vlgPeixmxa4EL/UsvVvHPz33NnWoQetQqit9TBNzUjMXw0KlY9PXM4iqHUU\n' +
  'U+dSyNDq1jZWIiJ2C2FccppswJtIKL3NRMFvT9PFh6NlP/4FUcQKojgKFbF7Kacc\n' +
  'JPKYHlwaO7qgoIjLxAHlSOXGpucJcOkPzT2EqsSVnW8sn8kenvNmghXDayhgxsh6\n' +
  'AyxK4kehJplEnmX/iYCfNoFXknGcLqFWYccgBz3fybvx30C/0IgU1980L8QsUAv5\n' +
  'esZmN8ugnbRgLRxKRlkQQLxQAiZMZdKTAx665YflT3YMHJvEFE8c2XFgoxHzSMc4\n' +
  'BwIDAQAB\n' +
  '-----END PUBLIC KEY-----\n';

// ConnectLife device-type codes (from the reference). Air conditioner = "009".
const DEVICE_TYPE_AC = '009';

// ===========================================================================
// HTTP
// ===========================================================================

function decompress(buffer, encoding) {
  try {
    const enc = (encoding || '').toLowerCase();
    if (enc === 'gzip') return zlib.gunzipSync(buffer);
    if (enc === 'br') return zlib.brotliDecompressSync(buffer);
    if (enc === 'deflate') {
      try {
        return zlib.inflateSync(buffer);
      } catch (e) {
        return zlib.inflateRawSync(buffer);
      }
    }
  } catch (e) {
    /* fall through */
  }
  return buffer;
}

function httpRequest(method, urlStr, headers, bodyBuffer) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const options = {
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      port: 443,
      headers: Object.assign({ 'User-Agent': USER_AGENT }, headers),
    };
    if (bodyBuffer) options.headers['Content-Length'] = Buffer.byteLength(bodyBuffer);
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = decompress(Buffer.concat(chunks), res.headers['content-encoding']);
        resolve({ statusCode: res.statusCode, body: raw.toString('utf8') });
      });
    });
    req.on('error', reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

function formEncode(obj) {
  return Object.keys(obj)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k])}`)
    .join('&');
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function postForm(url, obj) {
  const res = await httpRequest('POST', url, { 'Content-Type': 'application/x-www-form-urlencoded' }, Buffer.from(formEncode(obj), 'utf8'));
  return { statusCode: res.statusCode, json: safeJsonParse(res.body), body: res.body };
}

async function postJson(url, obj) {
  const res = await httpRequest('POST', url, { 'Content-Type': 'application/json' }, Buffer.from(JSON.stringify(obj), 'utf8'));
  return { statusCode: res.statusCode, json: safeJsonParse(res.body), body: res.body };
}

// ===========================================================================
// Errors
// ===========================================================================

class ConnectLifeError extends Error {}
class ConnectLifeAuthError extends ConnectLifeError {}

// ===========================================================================
// Client
// ===========================================================================

class ConnectLifeApi {
  // Init with { username, password } (full login, used at pairing) and/or
  // { refreshToken } (unattended operation without storing the password).
  constructor({ username = null, password = null, refreshToken = null, onTokens = null } = {}) {
    this._username = username;
    this._password = password;
    this._accessToken = null;
    this._expiresAt = 0;
    this._refreshToken = refreshToken;
    this._refreshExpiresAt = 0;
    // Called whenever tokens change, so the caller can persist the rotated
    // refresh token: onTokens({ refreshToken }).
    this._onTokens = onTokens;
    this._tokenPromise = null;
  }

  getRefreshToken() {
    return this._refreshToken;
  }

  // ---- Auth ----

  async login() {
    this._resetTokens();
    await this._initialAccessToken();
  }

  _resetTokens() {
    this._accessToken = null;
    this._expiresAt = 0;
    this._refreshToken = null;
    this._refreshExpiresAt = 0;
  }

  // Coalesce concurrent token acquisitions (multiple AC devices sharing one
  // client) into a single login/refresh, so we never race the refresh token.
  async _ensureToken() {
    if (this._accessToken && this._expiresAt >= Date.now()) return;
    if (this._tokenPromise) return this._tokenPromise;
    this._tokenPromise = this._doEnsureToken();
    try {
      await this._tokenPromise;
    } finally {
      this._tokenPromise = null;
    }
  }

  async _doEnsureToken() {
    const now = Date.now();
    if (this._accessToken && this._expiresAt >= now) return;

    // Prefer refreshing when we hold a (still-valid) refresh token — this is the
    // only path available when the app was configured refresh-token-only.
    const refreshUsable = this._refreshToken && (!this._refreshExpiresAt || this._refreshExpiresAt > now);
    if (refreshUsable) {
      try {
        await this._refreshAccessToken();
        return;
      } catch (err) {
        // fall through to full login if we have credentials
      }
    }

    if (this._username && this._password) {
      await this._initialAccessToken();
      return;
    }

    throw new ConnectLifeAuthError('ConnectLife session expired and no credentials stored; please re-pair the device.');
  }

  async _initialAccessToken() {
    const { uid, loginToken } = await this._gigyaLogin();
    const idToken = await this._gigyaJwt(loginToken);
    const code = await this._oauthAuthorize(uid, idToken);
    await this._oauthToken({ grant_type: 'authorization_code', code });
  }

  async _gigyaLogin() {
    const { statusCode, json, body } = await postForm(LOGIN_URL, {
      loginID: this._username,
      password: this._password,
      APIKey: API_KEY,
    });
    if (statusCode !== 200 || !json) {
      throw new ConnectLifeAuthError(`Login HTTP ${statusCode}: ${(body || '').slice(0, 200)}`);
    }
    if (json.errorCode || json.errorMessage || json.errorDetails) {
      throw new ConnectLifeAuthError(`Login failed (code ${json.errorCode}): ${json.errorMessage || json.errorDetails || ''}`);
    }
    const uid = json.UID;
    const loginToken = json.sessionInfo && json.sessionInfo.cookieValue;
    if (!uid || !loginToken) throw new ConnectLifeAuthError('Login response missing UID / sessionInfo.cookieValue');
    return { uid, loginToken };
  }

  async _gigyaJwt(loginToken) {
    const { statusCode, json } = await postForm(JWT_URL, { APIKey: API_KEY, login_token: loginToken });
    if (statusCode !== 200 || !json || !json.id_token) {
      throw new ConnectLifeAuthError(`getJWT failed (HTTP ${statusCode})`);
    }
    return json.id_token;
  }

  async _oauthAuthorize(uid, idToken) {
    const { statusCode, json } = await postJson(OAUTH_AUTHORIZE, {
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      idToken,
      response_type: 'code',
      thirdType: 'CDC',
      thirdClientId: uid,
    });
    if (statusCode !== 200 || !json || !json.code) {
      throw new ConnectLifeAuthError(`authorize failed (HTTP ${statusCode})`);
    }
    return json.code;
  }

  async _refreshAccessToken() {
    await this._oauthToken({ grant_type: 'refresh_token', refresh_token: this._refreshToken });
  }

  async _oauthToken(extra) {
    const { statusCode, json } = await postForm(OAUTH_TOKEN, Object.assign({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    }, extra));
    if (statusCode !== 200 || !json || !json.access_token) {
      throw new ConnectLifeAuthError(`token exchange failed (HTTP ${statusCode})`);
    }
    this._setTokenState(json);
  }

  _setTokenState(resp) {
    this._accessToken = resp.access_token;
    const expiresIn = Number(resp.expires_in) || 3600;
    // Renew 90s before expiry.
    this._expiresAt = Date.now() + (expiresIn - 90) * 1000;
    if (resp.refresh_token) this._refreshToken = resp.refresh_token;
    this._refreshExpiresAt = this._parseRefreshExpiry(resp.refreshTokenExpiredTime);
    if (this._onTokens) {
      try {
        this._onTokens({ refreshToken: this._refreshToken });
      } catch (e) {
        /* persistence is best-effort */
      }
    }
  }

  _parseRefreshExpiry(value) {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return value; // assume ms epoch
    if (typeof value === 'string') {
      if (/^\d+$/.test(value)) return Number(value);
      const t = Date.parse(value);
      return Number.isNaN(t) ? 0 : t;
    }
    return 0;
  }

  // ---- Gateway signing ----

  _gatewayRequestData(payload) {
    const data = Object.assign({
      accessToken: this._accessToken,
      appId: APP_ID,
      appSecret: APP_SECRET,
      languageId: LANGUAGE_ID,
      randStr: crypto.randomBytes(16).toString('hex'), // 32 hex chars, unique per request
      timeStamp: String(Date.now()),
      timezone: TIMEZONE,
      version: VERSION,
    }, payload);
    data.sign = this._signGateway(data);
    return data;
  }

  _signGateway(data) {
    const items = Object.keys(data)
      .filter((k) => k !== 'sign')
      .sort()
      .map((k) => {
        let v = data[k];
        if (v !== null && typeof v === 'object') v = JSON.stringify(v); // compact, matches Python separators
        return `${k}=${v}`;
      });
    const digest = crypto.createHash('sha256').update(items.join('&') + SIGN_SUFFIX).digest();
    const encrypted = crypto.publicEncrypt(
      { key: GATEWAY_PUBLIC_KEY, padding: crypto.constants.RSA_PKCS1_PADDING },
      digest
    );
    return encrypted.toString('base64');
  }

  async _requestGateway(url, { payload = {}, method = 'POST', retryReauth = true, retryRandstr = true } = {}) {
    await this._ensureToken();
    const data = this._gatewayRequestData(payload);

    let res;
    if (method === 'GET') {
      res = await httpRequest('GET', `${url}?${formEncode(data)}`, {}, null);
    } else {
      res = await httpRequest('POST', url, { 'Content-Type': 'application/json' }, Buffer.from(JSON.stringify(data), 'utf8'));
    }
    if (res.statusCode !== 200) {
      throw new ConnectLifeError(`Gateway HTTP ${res.statusCode}: ${res.body.slice(0, 200)}`);
    }
    const body = safeJsonParse(res.body);
    const response = body && body.response;
    if (!response || typeof response !== 'object') {
      throw new ConnectLifeError('Gateway response missing "response"');
    }

    const resultCode = response.resultCode;
    if (resultCode === 0 || resultCode === '0' || resultCode === undefined || resultCode === null) {
      return response;
    }

    const errorCode = response.errorCode;
    const errorDesc = response.errorDesc || 'Unknown gateway error';

    if (retryReauth && errorCode === INVALID_ACCESS_TOKEN_CODE) {
      await this.login();
      return this._requestGateway(url, { payload, method, retryReauth: false, retryRandstr });
    }
    if (retryRandstr && errorCode === RANDSTR_CHECK_FAILED_CODE) {
      return this._requestGateway(url, { payload, method, retryReauth, retryRandstr: false });
    }

    const ErrType = errorCode === INVALID_ACCESS_TOKEN_CODE ? ConnectLifeAuthError : ConnectLifeError;
    throw new ErrType(`Gateway error code=${errorCode} desc='${errorDesc}'`);
  }

  // ---- Public ----

  async getAppliances() {
    const response = await this._requestGateway(DEVICE_LIST_URL, { payload: {}, method: 'GET' });
    const list = response.deviceList;
    if (!Array.isArray(list)) throw new ConnectLifeError('Gateway response missing "deviceList"');
    return list; // raw appliance objects (deviceId, puid, deviceTypeCode, statusList, ...)
  }

  async updateAppliance(puid, properties) {
    await this._requestGateway(UPDATE_URL, {
      payload: { puid, properties },
      method: 'POST',
      retryReauth: true,
      retryRandstr: true,
    });
  }
}

module.exports = {
  ConnectLifeApi,
  ConnectLifeError,
  ConnectLifeAuthError,
  DEVICE_TYPE_AC,
};

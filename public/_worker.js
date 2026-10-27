/**
 * ============================================================
 *  福报指数测试 · 网站门禁（Cloudflare Pages 高级模式）
 * ============================================================
 *
 * 这个文件相当于网站的「保安」：
 *   1. 所有请求都先经过它；
 *   2. 未通过密码验证的访客，只能看到登录页；
 *   3. 密码验证成功后，发一个「签名的会话 Cookie」；
 *   4. 之后的页面、JS、CSS 等所有资源请求，都要凭 Cookie 放行。
 *
 * 为什么用 _worker.js 而不是 functions/ 目录？
 *   Cloudflare Pages 默认「静态资源优先」，functions/ 目录里的
 *   函数拦截不到静态文件请求（JS、CSS 仍会被直接返回）。只有
 *   高级模式 _worker.js 能真正保护全部资源，所以本项目采用它。
 *
 * 密码与密钥都保存在 Cloudflare 的 Secret 环境变量里：
 *   - QUIZ_PASSWORD   访问密码（所有访客共用）
 *   - SESSION_SECRET  会话签名密钥（用于给 Cookie 防伪签名）
 *   它们只存在于 Cloudflare 服务端，不会出现在前端代码、
 *   GitHub 仓库或构建产物中。
 *
 * 会话设计说明（如实声明）：
 *   - Cookie 不设 Max-Age，属于「浏览器会话 Cookie」：关闭浏览器
 *     窗口后通常会失效，但部分浏览器/「恢复标签页」功能可能会
 *     保留它，不能保证 100% 立即清除；
 *   - 同时令牌本身带 12 小时有效期，由服务端强制校验；
 *   - 单个签名 Cookie 不具备「服务端撤销某个会话」的能力。
 *     如需让所有会话立刻失效，更换 SESSION_SECRET 并重新部署即可。
 */

const COOKIE_NAME = "fq_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 令牌有效期：12 小时
const MAX_ATTEMPTS = 5;                   // 连续允许输错次数
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 错误计数窗口：10 分钟

const enc = new TextEncoder();

/* ================= 基础工具 ================= */

function b64urlEncode(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(text) {
  const norm = text.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 0 ? "" : "=".repeat(4 - (norm.length % 4));
  const raw = atob(norm + pad);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** 恒定时间字符串比较（比较签名用），避免时序侧信道 */
function constantTimeEqualStr(a, b) {
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] !== undefined ? aBytes[i] : 0) ^ (bBytes[i] !== undefined ? bBytes[i] : 0);
  }
  return diff === 0;
}

/** 校验密码：先各自做 SHA-256 哈希再逐字节比较，同样是恒定时间 */
async function passwordMatches(candidate, actual) {
  const h1 = await crypto.subtle.digest("SHA-256", enc.encode(candidate));
  const h2 = await crypto.subtle.digest("SHA-256", enc.encode(actual));
  const a = new Uint8Array(h1);
  const b = new Uint8Array(h2);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64urlEncode(new Uint8Array(sig));
}

/** 生成会话令牌：base64url(载荷) + "." + HMAC-SHA256 签名 */
async function createToken(secret, now) {
  const payloadObj = { exp: now + SESSION_TTL_SECONDS, iat: now, v: 1 };
  const payload = b64urlEncode(enc.encode(JSON.stringify(payloadObj)));
  const sig = await hmacSign(payload, secret);
  return payload + "." + sig;
}

/** 校验会话令牌：签名必须匹配，且未过期、载荷合法 */
async function verifyToken(secret, token, now) {
  if (typeof token !== "string" || token.length === 0) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const expectedSig = await hmacSign(parts[0], secret);
  if (!constantTimeEqualStr(expectedSig, parts[1])) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
    return typeof payload.exp === "number" && payload.exp > now && payload.v === 1;
  } catch {
    return false;
  }
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

/** 判断是否为「页面导航」请求（浏览器地址栏、链接跳转等） */
function wantsHTML(request) {
  const accept = request.headers.get("Accept") || "";
  return accept.includes("text/html");
}

function htmlResponse(body, status, extraHeaders) {
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    // 受保护页面不允许被共享缓存（CDN/代理）缓存
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
  });
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  return new Response(body, { status, headers });
}

function jsonResponse(obj, status, extraHeaders) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
  });
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  return new Response(JSON.stringify(obj), { status, headers });
}

/* ================= 简易防暴力尝试（按 IP 计数） =================
 * 注意：Cloudflare 的运行实例是临时的，这个内存计数器只在单个
 * 实例内生效，属于「尽力而为」的基础防护，不是分布式限流。
 * 如需更强的防暴力能力，可在 Cloudflare 控制台为 /api/login
 * 额外配置 WAF 速率限制规则（见 README）。
 */

const failedAttempts = new Map();

function isRateLimited(ip) {
  const entry = failedAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failedAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const entry = failedAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    failedAttempts.set(ip, { count: 1, resetAt: Date.now() + ATTEMPT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearFailures(ip) {
  failedAttempts.delete(ip);
}

/* ================= 页面模板 ================= */

/** 登录页：由服务端直接生成，不依赖任何需要门禁放行的静态资源 */
function loginPageHTML() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>访问验证 · 福报指数</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
    background: linear-gradient(160deg, #f2f7ef 0%, #e2eede 55%, #cfe4cc 100%);
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  .card {
    width: 100%; max-width: 380px; background: rgba(255,255,255,0.92);
    border-radius: 20px; padding: 40px 28px; text-align: center;
    box-shadow: 0 12px 40px rgba(62,107,79,0.15);
  }
  .logo { font-size: 40px; }
  h1 {
    font-family: "Noto Serif SC", "Songti SC", SimSun, serif;
    color: #2f5d43; font-size: 26px; margin: 12px 0 6px; letter-spacing: 4px;
  }
  p.tip { color: #6b7f70; font-size: 14px; margin-bottom: 24px; }
  input {
    width: 100%; padding: 13px 16px; border: 1.5px solid #c7d9c8; border-radius: 12px;
    font-size: 16px; outline: none; text-align: center; letter-spacing: 2px; background: #fbfdfa;
  }
  input:focus { border-color: #4a7c59; }
  button {
    width: 100%; margin-top: 14px; padding: 13px; border: none; border-radius: 12px;
    background: #3e6b4f; color: #fff; font-size: 16px; letter-spacing: 4px; cursor: pointer;
  }
  button:disabled { opacity: 0.6; }
  .msg { min-height: 20px; font-size: 13px; margin-top: 12px; color: #6b7f70; }
  .msg.err { color: #b4543f; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">&#129700;</div>
    <h1>福报指数</h1>
    <p class="tip">本站为受限访问站点，请输入访问密码</p>
    <form id="f">
      <input id="p" type="password" placeholder="请输入访问密码" autocomplete="current-password" autofocus />
      <button id="b" type="submit">验 证 进 入</button>
    </form>
    <div class="msg" id="m"></div>
  </div>
<script>
(function () {
  var form = document.getElementById('f');
  var input = document.getElementById('p');
  var btn = document.getElementById('b');
  var msg = document.getElementById('m');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (btn.disabled) return;
    btn.disabled = true;
    msg.className = 'msg';
    msg.textContent = '正在验证…';
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: input.value })
    }).then(function (r) {
      if (r.ok) { location.replace('/'); return; }
      if (r.status === 429) {
        msg.textContent = '尝试次数过多，请约 10 分钟后再试。';
      } else {
        msg.textContent = '密码不正确，请重试。';
      }
      msg.className = 'msg err';
      btn.disabled = false;
    }).catch(function () {
      msg.textContent = '网络异常，请稍后重试。';
      msg.className = 'msg err';
      btn.disabled = false;
    });
  });
})();
</script>
</body>
</html>`;
}

/** 缺少环境变量配置时的提示页（不泄露缺的是哪一个） */
function configErrorHTML() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>站点暂不可用</title>
</head>
<body style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f2f7ef;font-family:sans-serif;color:#4a6b55;">
  <div style="text-align:center;padding:24px;">
    <div style="font-size:40px;">&#129700;</div>
    <h1 style="font-size:20px;margin:16px 0 8px;">站点暂不可用</h1>
    <p style="font-size:14px;">站点配置不完整，请联系站长在 Cloudflare 后台完成环境变量配置。</p>
  </div>
</body>
</html>`;
}

/* ================= 主逻辑 ================= */

async function handleLogin(request, env, now) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  if (isRateLimited(ip)) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  let password = "";
  try {
    const body = await request.json();
    if (body && typeof body.password === "string") password = body.password;
  } catch {
    // 请求体解析失败，按空密码处理
  }

  if (
    password.length === 0 ||
    password.length > 256 ||
    !(await passwordMatches(password, env.QUIZ_PASSWORD))
  ) {
    recordFailure(ip);
    return jsonResponse({ error: "bad_password" }, 401);
  }

  clearFailures(ip);
  const token = await createToken(env.SESSION_SECRET, now);
  const cookie = COOKIE_NAME + "=" + token + "; HttpOnly; Secure; SameSite=Lax; Path=/";
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": cookie });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const now = Math.floor(Date.now() / 1000);

  // 1. 缺少必需配置：不泄露细节，只提示站点暂不可用
  if (!env.QUIZ_PASSWORD || !env.SESSION_SECRET) {
    return htmlResponse(configErrorHTML(), 503);
  }

  // 2. 登录接口（只接受 POST）
  if (path === "/api/login") {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "POST", "Cache-Control": "private, no-store" },
      });
    }
    return handleLogin(request, env, now);
  }

  // 3. 退出登录：清除 Cookie 后回到登录页
  if (path === "/logout") {
    const clearCookie = COOKIE_NAME + "=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
    if (request.method === "POST") {
      return jsonResponse({ ok: true }, 200, { "Set-Cookie": clearCookie });
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": clearCookie,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // 4. 其余所有请求都需要有效会话
  const token = getCookie(request, COOKIE_NAME);
  const authed = await verifyToken(env.SESSION_SECRET, token, now);

  if (!authed) {
    if (wantsHTML(request) || path === "/") {
      // 浏览器导航请求：直接展示登录页
      return htmlResponse(loginPageHTML(), 200);
    }
    // 静态资源等非页面请求：拒绝并明确返回 401
    return new Response("未授权访问", {
      status: 401,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  }

  // 5. 已验证：转发给静态资源，并覆盖为不允许共享缓存的响应头
  const asset = await env.ASSETS.fetch(request);
  if (asset.status === 404 && wantsHTML(request)) {
    // 单页应用兜底：导航请求找不到具体文件时，回退到首页 index.html
    const fallback = await env.ASSETS.fetch(
      new Request(new URL("/", request.url), { headers: request.headers })
    );
    if (fallback.status !== 404) {
      const res = new Response(fallback.body, fallback);
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }
  }
  const response = new Response(asset.body, asset);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      // 只记录错误信息，绝不输出密码、密钥或令牌
      console.error("worker error:", err && err.message);
      return new Response("服务器开小差了，请稍后重试。", {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      });
    }
  },
};

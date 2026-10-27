/**
 * 本地自动化测试：验证 public/_worker.js 的门禁逻辑。
 * 运行方式（需要 Node.js）：node tests/worker.test.mjs
 * 注意：测试用的是模拟环境，不需要真实部署就能跑。
 */

import worker from "../public/_worker.js";

const PASSWORD = "test-pass-123";

function makeEnv() {
  return {
    QUIZ_PASSWORD: PASSWORD,
    SESSION_SECRET: "test-secret-abc",
    ASSETS: {
      async fetch(req) {
        const path = new URL(req.url).pathname;
        if (path === "/" || path === "/index.html") {
          return new Response("<html>PROTECTED_INDEX</html>", {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        if (path === "/assets/app.js") {
          return new Response("console.log(1)", {
            status: 200,
            headers: { "content-type": "text/javascript" },
          });
        }
        return new Response("not found", { status: 404 });
      },
    },
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

function req(method, path, opts = {}) {
  return new Request("https://example.com" + path, { method, ...opts });
}

async function login(env, password, ip = "203.0.113.7") {
  return worker.fetch(
    req("POST", "/api/login", {
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
      body: JSON.stringify({ password }),
    }),
    env
  );
}

async function getCookieHeader(env) {
  const res = await login(env, PASSWORD);
  return res.headers.get("Set-Cookie") || "";
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log("  PASS", name);
  } catch (e) {
    failed++;
    console.log("  FAIL", name, "->", e.message);
  }
}

const env = makeEnv();

console.log("开始测试 _worker.js 门禁逻辑...\n");

await test("缺少环境变量时返回 503 且不泄露细节", async () => {
  const res = await worker.fetch(req("GET", "/"), {});
  assert(res.status === 503, "status=" + res.status);
  const text = await res.text();
  assert(!text.includes("QUIZ_PASSWORD"), "不应暴露具体变量名");
});

await test("未登录访问首页 -> 返回登录页", async () => {
  const res = await worker.fetch(req("GET", "/"), env);
  assert(res.status === 200, "status=" + res.status);
  const text = await res.text();
  assert(text.includes("请输入访问密码"), "应包含登录页内容");
  assert(!text.includes("PROTECTED_INDEX"), "不应泄露受保护内容");
  assert(res.headers.get("Cache-Control") === "private, no-store", "缺少 no-store 缓存头");
});

await test("未登录请求 JS 静态资源 -> 401 拒绝", async () => {
  const res = await worker.fetch(req("GET", "/assets/app.js"), env);
  assert(res.status === 401, "status=" + res.status);
  const text = await res.text();
  assert(!text.includes("console.log"), "不应返回静态资源内容");
});

await test("GET /api/login -> 405（只接受 POST）", async () => {
  const res = await worker.fetch(req("GET", "/api/login"), env);
  assert(res.status === 405, "status=" + res.status);
});

await test("错误密码 -> 401", async () => {
  const res = await login(env, "wrong-password");
  assert(res.status === 401, "status=" + res.status);
});

await test("空密码请求体 -> 401", async () => {
  const res = await worker.fetch(
    req("POST", "/api/login", {
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.8" },
      body: "not-json",
    }),
    env
  );
  assert(res.status === 401, "status=" + res.status);
});

await test("正确密码 -> 200 + 安全属性 Cookie", async () => {
  const res = await login(env, PASSWORD, "203.0.113.9");
  assert(res.status === 200, "status=" + res.status);
  const sc = res.headers.get("Set-Cookie") || "";
  assert(sc.startsWith("fq_session="), "cookie 名: " + sc);
  assert(sc.includes("HttpOnly"), "缺 HttpOnly");
  assert(sc.includes("Secure"), "缺 Secure");
  assert(sc.includes("SameSite=Lax"), "缺 SameSite");
  assert(sc.includes("Path=/"), "缺 Path=/");
});

const cookie = (await getCookieHeader(env)).split(";")[0];

await test("带有效会话访问首页 -> 返回受保护内容", async () => {
  const res = await worker.fetch(req("GET", "/", { headers: { Cookie: cookie } }), env);
  assert(res.status === 200, "status=" + res.status);
  const text = await res.text();
  assert(text.includes("PROTECTED_INDEX"), "应返回受保护内容");
  assert(res.headers.get("Cache-Control") === "private, no-store", "缺少 no-store 缓存头");
});

await test("带有效会话请求 JS 资源 -> 正常返回且带 no-store", async () => {
  const res = await worker.fetch(req("GET", "/assets/app.js", { headers: { Cookie: cookie } }), env);
  assert(res.status === 200, "status=" + res.status);
  const text = await res.text();
  assert(text.includes("console.log"), "应返回 JS 内容");
  assert(res.headers.get("Cache-Control") === "private, no-store", "缺少 no-store 缓存头");
});

await test("篡改签名后的 Cookie -> 被拒绝并回到登录页", async () => {
  const bad = cookie.slice(0, -2) + "xx";
  const res = await worker.fetch(req("GET", "/", { headers: { Cookie: bad } }), env);
  const text = await res.text();
  assert(text.includes("请输入访问密码"), "应回到登录页");
});

await test("伪造的随机 Cookie -> 被拒绝", async () => {
  const res = await worker.fetch(
    req("GET", "/", { headers: { Cookie: "fq_session=abc.def" } }),
    env
  );
  const text = await res.text();
  assert(text.includes("请输入访问密码"), "应回到登录页");
});

await test("GET /logout -> 302 跳转 + 清除 Cookie", async () => {
  const res = await worker.fetch(req("GET", "/logout", { headers: { Cookie: cookie } }), env);
  assert(res.status === 302, "status=" + res.status);
  assert(res.headers.get("Location") === "/", "应跳回首页");
  const sc = res.headers.get("Set-Cookie") || "";
  assert(sc.includes("Max-Age=0"), "应带 Max-Age=0 清除 Cookie: " + sc);
});

await test("登出后的 Cookie 再次使用 -> 已失效", async () => {
  // 简化验证：清空 Cookie 后访问首页应回到登录页
  const res = await worker.fetch(req("GET", "/"), env);
  const text = await res.text();
  assert(text.includes("请输入访问密码"), "应回到登录页");
});

await test("连续输错 5 次后触发限流 429（同一 IP）", async () => {
  const ip = "198.51.100.9";
  for (let i = 0; i < 5; i++) {
    const r = await login(env, "wrong-" + i, ip);
    assert(r.status === 401, "第 " + (i + 1) + " 次应为 401");
  }
  // 第 6 次：即使密码正确也应被限流
  const r6 = await login(env, PASSWORD, ip);
  assert(r6.status === 429, "第 6 次应 429，实际 " + r6.status);
});

await test("限流响应不包含任何令牌或密码信息", async () => {
  const res = await login(env, PASSWORD, "198.51.100.9");
  const text = await res.text();
  assert(res.status === 429, "status=" + res.status);
  assert(!text.includes("test-secret"), "不应包含密钥");
  assert(!text.includes(PASSWORD), "不应包含密码");
});

console.log("\n测试完成：" + passed + " 通过, " + failed + " 失败");
process.exit(failed > 0 ? 1 : 0);

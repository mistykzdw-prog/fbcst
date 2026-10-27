# 福报指数测试网站

一个带**固定密码门禁**的「福报指数」测试网站，部署在 Cloudflare Pages 上。

- 前端：React + TypeScript + Vite（答题、计分、五维雷达图结果页）
- 门禁：Cloudflare Pages 高级模式 `_worker.js`（服务端验证密码，密码不出现在前端代码中）

## 项目结构

```
├── index.html              页面入口
├── package.json            依赖与构建脚本（构建命令：npm run build）
├── public/
│   └── _worker.js          ★ 服务端门禁：密码验证、会话 Cookie、限流
├── src/
│   ├── main.tsx            React 入口
│   ├── App.tsx             页面流程：封面 → 答题 → 结果
│   ├── quiz.ts             ★ 题目、五个维度、计分与等级逻辑（想改题目看这里）
│   ├── RadarChart.tsx      五维雷达图（纯 SVG）
│   └── index.css           全部样式
└── tests/
    └── worker.test.mjs     门禁逻辑自动化测试（可选，本地验证用）
```

## 日常维护

### 如何修改访问密码

1. 打开 Cloudflare 控制台 → **Workers 和 Pages** → 进入本项目；
2. **设置（Settings）→ 环境变量（Variables and Secrets）**；
3. 找到 `QUIZ_PASSWORD`，点击编辑，填入新密码；
4. **生产环境和预览环境都要改**（页面里有两个环境标签页）；
5. 保存后进入 **部署（Deployments）**，对最新一次部署点击 **重试部署（Retry deployment）**，新密码才会生效。

### 如何修改题目 / 文案 / 等级

编辑 `src/quiz.ts`（题目、选项分值、五个维度的解读文案、等级分数线都在这一个文件里），改完提交到 GitHub 即自动重新部署。

### 如何重新部署

- 普通方式：往 GitHub 仓库提交/上传任何改动，Cloudflare 会自动重新构建部署；
- 手动重试：Cloudflare 控制台 → 项目 → **部署** → 找到最新部署 → **重试部署**。

### 如何退出登录（清除会话）

- 访客在网站内点击「退出访问」链接即可（本质是访问 `/logout`）；
- 也可以直接在浏览器地址栏打开 `你的域名/logout`。

## 排查构建失败

1. Cloudflare 控制台 → 项目 → **部署**，点击失败的那次部署，查看**构建日志**；
2. 常见原因：
   - 日志里出现 `Command failed`：看具体是 `tsc`（代码类型错误）还是 `vite build`（打包错误）报错，把报错行截图发给 AI 协助即可；
   - Node 版本过旧：在 **设置 → 环境变量** 添加 `NODE_VERSION` = `22`（普通变量即可，不是 Secret）；
3. 修好后点击 **重试部署**，不要删除项目重建。

## 安全设计说明（如实声明）

- **密码存放**：`QUIZ_PASSWORD` 和 `SESSION_SECRET` 都是 Cloudflare 的 Secret 环境变量，只存在于服务端，不在前端代码、GitHub 仓库或构建产物中；
- **会话**：验证通过后发放 HMAC-SHA256 签名的令牌 Cookie（HttpOnly / Secure / SameSite=Lax / Path=/），服务端强制校验签名与 12 小时有效期；
- **浏览器会话 Cookie 的局限**：Cookie 未设 Max-Age，属「浏览器会话 Cookie」，关闭浏览器后通常失效；但部分浏览器的「恢复标签页 / 启动时恢复」功能可能保留它，不能保证所有浏览器关闭后立即清除（服务端 12 小时过期兜底）；
- **无单会话撤销能力**：签名 Cookie 方案无法只撤销某一个访客的会话；如需让所有人立刻重新登录，更换 `SESSION_SECRET` 并重新部署即可；
- **防暴力尝试**：对 `/api/login` 按 IP 做了内存计数限流（10 分钟内最多错 5 次）。注意 Cloudflare 实例是临时的，这是「尽力而为」的基础防护；如需更强防护，可在 Cloudflare 控制台 → 网站 → 安全（WAF）→ 速率限制规则，为 `/api/login` 添加规则（免费版可用）；
- **缓存安全**：所有受保护响应都带 `Cache-Control: private, no-store`，不会被共享缓存（CDN/代理）缓存。

## 本地开发（可选，普通使用不需要）

需要先安装 Node.js 18+：

```bash
npm install
npm run dev      # 本地预览（门禁在本地 dev 模式不生效，仅供改样式看效果）
npm run build    # 构建产物输出到 dist/
node tests/worker.test.mjs   # 运行门禁逻辑自动化测试
```

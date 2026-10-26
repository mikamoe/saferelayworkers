# SafeRelay - 部署指南

> ⚡ **推荐一键部署：约 3 分钟。** 你只需要准备 3 个值，其余（创建 Worker、创建 KV、部署代码）Cloudflare 全自动完成。
> Turnstile、话题模式、AI 检测都是**可选**功能，不配也能正常用——默认的本地题库验证开箱即用。

---

## 准备：只要 3 个值

| 值 | 从哪拿 | 用途 |
| --- | --- | --- |
| **Bot Token** | 在 Telegram 找 [@BotFather](https://t.me/BotFather)，`/newbot` 创建机器人 | 机器人身份 |
| **Admin UID** | 找 [@userinfobot](https://t.me/userinfobot) 发任意消息，它会回你的数字 ID | 管理员身份 |
| **Webhook 密钥** | 任意随机字符串，建议用 [UUID 生成器](https://www.uuidgenerator.net/) 生成一个 | 激活 Webhook 时的口令 |

---

## ⚡ 一键部署（推荐）

### 第 1 步：点按钮，Cloudflare 自动部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mikamoe/SafeRelay)

登录 Cloudflare 并连接 GitHub 后，Cloudflare 会把仓库克隆到你的 GitHub 账号并自动部署。仓库里的 `wrangler.jsonc` 已声明 KV 绑定（不带 ID），**KV 命名空间会在部署时自动创建并绑定**，不需要你手动建 KV，也不需要粘贴代码。

部署完成后记下你的 Worker 地址，形如 `https://saferelay.<你的子域>.workers.dev`。

> 之后更新代码：在克隆出的仓库里合并上游新版本即可，Cloudflare 会自动重新部署；在控制台里填的变量不会被覆盖（配置里已开 `keep_vars`）。

### 第 2 步：填 3 个变量

进入 `Cloudflare → Workers & Pages → saferelay → 设置（Settings）→ 变量和机密（Variables and Secrets）`，添加：

| 变量 | 类型 | 填什么 |
| :--: | :--: | --- |
| `ENV_BOT_TOKEN` | 密钥 | BotFather 给的 Token |
| `ENV_BOT_SECRET` | 密钥 | 你准备的随机密钥 |
| `ENV_ADMIN_UID` | 文本 | 你的 Telegram 数字 ID |

保存后会自动重新部署，等它完成即可。

### 第 3 步：激活 Webhook（一条命令）

把下面命令里的域名和密钥换成你的，执行一次：

```bash
curl -X POST "https://<你的 Worker 地址>/registerWebhook" -H "X-SafeRelay-Admin-Secret: <ENV_BOT_SECRET>"
```

Windows PowerShell 用这条：

```powershell
Invoke-WebRequest -Method POST -Uri "https://<你的 Worker 地址>/registerWebhook" -Headers @{ "X-SafeRelay-Admin-Secret" = "<ENV_BOT_SECRET>" }
```

> 不要用浏览器直接打开这个地址（必须是 POST 请求），也不要把密钥写进 URL。
>
> 🔔 **从旧版本升级必读（1.2.0）**：本版给 Webhook 订阅新增了 `my_chat_member` 事件（用于「用户屏蔽机器人」通知）。**更新代码后必须重新执行一次本步的激活命令**，否则屏蔽通知不会到达；新部署不受影响，激活一次即可。

### 第 4 步：测试

在 Telegram 给你的机器人发 `/start`，能收到验证题 = 部署完成 ✅

默认是英文界面；想用中文，发 `/language` 切换（按用户保存）。想让所有人默认中文，再加一个变量 `DEFAULT_LANG=zh` 即可。

### 1.2.0 的通知与话题行为

- **🆕 新用户接入**：访客通过验证后会立即收到一张接入卡片——私聊模式发到管理员私聊；话题模式会立刻为该访客建好话题并把卡片发进话题。卡片上有 ⭐ 信任 / 🚫 封禁按钮，点一下即可处理。
- **🔕 屏蔽通知**：访客屏蔽机器人后，管理员会收到通知（话题模式下发进该访客已有的话题）。依赖 `my_chat_member` 事件，升级用户务必按上方提示重新激活一次 Webhook。
- **🎛 话题内面板**：话题模式开启后，所有管理员命令和面板都在论坛群组话题里执行和回复；此时在私聊里发 `/menu` 或 `/help`，机器人会回一条引导消息（带打开群组 General 话题的按钮）。在某个访客的话题里发 `/ban`、`/reset`、`/trust` 等命令且不带 ID 时，默认作用于该话题的访客。

---

## 🛠 手动部署（备用路径）

不想用一键部署，也可以全程在控制台手动完成，同样只需要 3 个变量：

1. **创建 KV**：`存储和数据库 → Workers KV → 创建`，名字随意（如 `tgbot_kv`）。
2. **创建 Worker**：`Workers & Pages → 创建 → 从 Hello World 开始`，名字填 `saferelay`，部署。
3. **粘贴代码**：进入该 Worker → `编辑代码`，把 [worker.js](./worker.js) 全文粘贴覆盖，部署。
4. **绑定 KV**：`设置 → 绑定 → 添加`，变量名必须填 `KV`（大写），选第 1 步的命名空间。
5. **填变量 + 激活**：同上面第 2、3 步。

命令行用户也可以用 Wrangler 一条龙：`npx wrangler deploy`（仓库的 `wrangler.jsonc` 已配好，KV 会自动创建）。

---

## 🎛 可选功能（按需再看，不配不影响使用）

### Turnstile 网页验证（可选，默认关）

默认验证是本地题库（答一道简单题），无需任何配置。想要 Cloudflare Turnstile 网页验证时再配：

1. `Cloudflare → 应用程序安全 → Turnstile → 添加小组件`，主机名填你的 Worker 域名，创建后拿到 **站点密钥** 和 **密钥**。
2. 给 Worker 加两个密钥变量：`CF_TURNSTILE_SITE_KEY`、`CF_TURNSTILE_SECRET_KEY`。
3. 给机器人发 `/menu → 🛡️ 验证模式`，切到 Turnstile 或双重验证。

### 话题模式（可选）

把每位访客的对话整理成论坛群组里的话题：

1. 准备一个开启了 **Topics** 的超级群组，把机器人拉进去并设为管理员（需要「管理话题」权限），并在 BotFather 关闭机器人的 **Group Privacy**。
2. 给 Worker 加文本变量 `GROUP_ID`（群组 ID，形如 `-1001234567890`）。
3. 发 `/menu → 💬 转发模式`，切到「话题转发」。

### AI 垃圾检测（可选）

1. 加两个密钥变量：`CF_ACCOUNT_ID`（控制台 `Workers & Pages` 页右侧可见）和 `CF_AI_TOKEN`（头像 → My Profile → API Tokens → 用 Workers AI 模板创建）。
2. 发 `/menu → 🪄 AI 检测 → 开启`。免费额度 10,000 Neurons/天，个人使用一般够用。

### 其他可选变量

| 变量 | 说明 |
| --- | --- |
| `ADMIN_IDS` | 多管理员 ID，英文逗号分隔（如 `111,222`）；不能替代必填的 `ENV_ADMIN_UID` |
| `DEFAULT_LANG` | 默认语言：`en`（默认）/ `zh`；别名 `BOT_LANG`。用户仍可 `/language` 单独切换 |
| `VERIFY_SIGNING_SECRET` | 验证链接签名密钥；不设时默认用 `ENV_BOT_SECRET` |
| `TURNSTILE_ALLOWED_HOSTNAMES` | Turnstile 允许的域名白名单，逗号或空格分隔 |
| `TURNSTILE_ACTION` | Turnstile 动作名，一般保持默认 |

---

## ❓ 常见问题

**机器人不回复？** 按顺序查：① Webhook 激活了吗（重跑第 3 步命令，看返回是否成功）；② `ENV_BOT_TOKEN` 填对了吗；③ `Workers & Pages → saferelay → 日志（Logs）` 看报错。

**变量改完没生效？** 保存变量后等自动部署完成（约十几秒）再试；KV 是最终一致性存储，个别状态变更最长可能要约 1 分钟才在全球生效。

**如何更新代码？** 一键部署用户：在克隆仓库里同步上游后自动部署。手动部署用户：把新版 `worker.js` 粘贴覆盖并部署。两种都不用重新激活 Webhook，也不用重填变量。

**话题不创建 / AI 不生效？** 先确认对应可选变量已设置、机器人权限足够，再看日志里 `topic` / `ai_` 开头的条目。

---

## ⚠️ 注意事项

1. **KV 绑定名必须为 `KV`**（一键部署已自动处理；手动绑定时别写错）。
2. **消息映射保存 48 小时**，超过后无法回复旧消息。
3. **广播有 24 小时冷却**，每次最多 500 人，可分批继续。
4. **联合封禁**（`/menu` 里开启）会把访客 ID 发给第三方封禁服务查询，介意隐私就不要开。

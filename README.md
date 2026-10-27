# 首页导航

Vue 3 + Vite + Cloudflare Workers 构建的个人网站导航。界面参考 iCloud 首页，保留透明顶栏、网站图标卡片与「自定义」入口。

- 单人使用，密码与 Turnstile 验证，30 天登录会话。
- D1 保存网站、图标、排列顺序；切回页面时获取其他设备的更新。
- 网站增删改、拖拽排序；编辑模式下也可使用 Alt + 左右方向键排序。
- 自动读取公网网站标题与图标；完整 Lucide 图标库可搜索、选色。
- 手机使用原参考页的单栏逻辑：315px 卡片、四列 54px 图标；桌面为 660px 卡片、六列 70px 图标，断点 760px。
- Grid Layout Plus 负责栏目布局，Vue Draggable / SortableJS 负责网站图标排序。数据保留栏目类型与布局信息，方便后续扩展其他栏目。
- 设置中支持 JSON 导入、导出和修改密码。

## 本地开发

需要 Node.js 24.22 或更新的受支持版本。依赖版本由 `package-lock.json` 固定。

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run dev
```

在 `.dev.vars` 设置本地密码和随机会话密钥。开发模式使用 Cloudflare 官方 Turnstile 测试组件；生产构建使用真实组件，服务器始终调用 Siteverify，不存在跳过验证的登录入口。

开发服务器启动后，通过控制台显示的 Local Explorer / D1 为本地数据库执行 `worker/schema.sql`。它只影响本地数据。Cloudflare CLI 的 `cf d1 raw --local` 和 Vite 开发服务器可能使用不同的持久化目录，应对准开发服务器绑定的数据库。

```sh
npm run build
npm run check
npm test
```

`cf build` 同时生成 Worker 绑定类型，之后进行 TypeScript 检查。

## 部署

本项目使用 Cloudflare 官方 `cf` CLI 与 `cloudflare.config.ts`。配置中的 D1 ID、自定义域名、Turnstile sitekey 属于当前实例；部署独立实例时替换为自己的资源。

1. 创建 D1 数据库，在远程数据库执行 `worker/schema.sql`。
2. 为目标域名创建 managed Turnstile 组件，更新配置中的公开 sitekey。
3. 配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`，令牌需具有相应 Workers、D1 与域名操作权限。
4. 在仓库外准备受保护的 JSON secrets 文件，包含 `ADMIN_PASSWORD`、`SESSION_SECRET`、`TURNSTILE_SECRET`。不要提交此文件。
5. 执行：

```sh
npx cf deploy --dry-run
npx cf deploy --secrets-file /absolute/private/path/secrets.json
```

部署会绑定配置中的自定义域名，`workers.dev` 与版本预览地址默认关闭。网站数据通过登录后的接口写入 D1，仓库不包含个人网站清单。

初始密码仅用于首次配置。通过头像菜单修改密码后，数据库中的 PBKDF2 派生值覆盖初始密码，并撤销旧会话。丢失修改后的密码时，可由账户所有者删除 D1 `settings` 中的 `password` 记录、更新 `epoch` 值，恢复为 Worker 的 `ADMIN_PASSWORD`；此操作会撤销已有会话。

## 内网网站

Worker 位于 Cloudflare，无法访问家庭局域网。首次导入可在本地读取内网网站标题和图标，写入私有数据库；部署后的自动获取仅访问公网 HTTPS 网站。新增内网地址时可以手动改名并选择 Lucide 图标。打开内网网站仍要求当前设备能访问相应局域网或 VPN。

修改采用版本检查：两台设备同时编辑时，后保存的一方会收到冲突提示，不会覆盖另一台设备已经保存的配置。

## 参考与资源

- 页面尺寸、背景混合与透明卡片参数参考用户提供的 iCloud 离线页面。
- `public/wallpaper.svg` 来自 [iCloud 参考页面](https://www.icloud.com.cn/system/icloud.com/2638Build27/wallpaper.svg)；Apple 相关素材的权利归原权利人。本仓库并非 Apple 官方产品。
- 头像由用户提供。重新部署独立实例时可替换 `public/avatar.png`。
- [Lucide](https://lucide.dev/) 图标由 `@lucide/vue` 提供，遵循其 ISC 许可证。
- [Cloudflare 官方开发技能](https://github.com/cloudflare/skills)、[Cloudflare CLI](https://developers.cloudflare.com/cf/)、[Turnstile 服务端验证](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)。

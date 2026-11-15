# Keyin.li 404 反馈接口

Astro 继续静态构建 `404.html`，GitHub Pages 负责返回错误页面。Cloudflare Worker 提供 `POST /report`，以 D1 保存报告并记录两种通知的处理状态。

## 线上配置

1. 使用自己的 Cloudflare 账号创建 D1 数据库 `keyin-404-reports`。在此目录把 `wrangler.example.jsonc` 复制为 `wrangler.jsonc`，填写真实数据库 ID。若使用其他站点域名，将其加入 `ALLOWED_ORIGINS`，用英文逗号分隔。
2. 从此目录运行 `npx wrangler d1 migrations apply keyin-404-reports --remote`。使用 `npx wrangler secret put RATE_LIMIT_SECRET` 设置至少 32 字节的随机密钥。
3. 使用同一命令设置 `RESEND_API_KEY`、`RESEND_FROM`、`WXPUSHER_APP_TOKEN`、`WXPUSHER_UID`。Resend 发件人应满足服务的发件域名或测试收件地址要求。邮箱收件人来自网站的 `src/data/site.ts`。WxPusher 接收者需关注对应应用。通过服务后台录入密钥。
4. 运行 `npx wrangler deploy`。给 Astro 构建环境设置公开变量 `PUBLIC_404_FEEDBACK_URL`，值为部署后的完整 HTTPS 地址及 `/report`。在 GitHub Pages 现有 Actions 构建步骤中传入该变量，再重新构建发布。
5. 从实际不存在的站点路径发送一次报告，在 D1 查看记录，同时检查邮箱和微信的实际收件。

## 数据与状态

- 仅在点击反馈后提交。URL 和来源去掉查询参数、片段与凭据，服务端额外遮盖常见敏感路径值。只保存浏览器主要版本、设备类别和屏幕尺寸。
- 数据库拒绝重复请求键。相同请求重试时返回原报告编号。每个来源地址的短期加密摘要在 15 分钟窗口内最多保存 5 条报告，数据库不保存原始 IP。
- 页面成功状态以报告入库为准。通知并行执行，各自记录 `pending`、`unconfigured`、`failed` 或 `accepted`。`accepted` 表示通知服务接受请求。失败报告仍可在数据库查询，本版本没有自动重发。
- 404 页复用站点配置中的真实微信二维码，实际资源为 public/contact/wechat-qr.jpg。


## 上线前验证

部署后确认 `/report` 为实际 Worker URL，Astro 构建时可读到 `PUBLIC_404_FEEDBACK_URL`，并将要测试的站点来源加入 `ALLOWED_ORIGINS`。本地预览需单独允许实际的本地地址和端口。缺少 URL 时，404 页面保留邮箱与微信联系方式并提示在线反馈未接通。接通后先验证预检与一次用户触发的 POST，再分别查看 D1 中的保存结果、两个通知状态及实际收件。凭据只应配置在 Worker 端。
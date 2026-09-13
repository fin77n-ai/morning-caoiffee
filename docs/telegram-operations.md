# Telegram 验收与发送恢复

## 固定证据预览

```sh
node scripts/telegram-digest.js --fresh-reader --input test/fixtures/editor-evidence.json --output work/editor-acceptance
```

需要已配置的 DeepSeek key；最多选题、写稿、校订三次调用。不会发送 Telegram，也不会更新发送账本。输入是 2026-09-06 预览中留存的有限引文，**不是今天的新闻，也不是完整原网页**。

人工核对 `digest.txt` 与 `edition.json`：

- 兼容工具名单不能被扩写为“完全离线运行”。天气条目的引文缺少卫星和每小时细节时，不得附加这些描述。
- 每个事实只表达一个主张，限定条件、数字和归属由该事实自己的引文支持。一个主张可以在改写后变得更窄。
- 模型发布、越狱报告和客户案例不得揉成同一事件；可以拆开，也允许只保留最有价值的一件。
- 首事实是短标题，最多 72 字符；后续每个事实最多 120 字符。不能靠截句通过限制。
- 字符串引文匹配与同模型复核仍不能证明语义准确；测试中的模拟模型也不能取代这一步。

## 阅读密度验收

正文目标 500-800 中文字；主新闻 150-250 字，解释新增变化、具体例子及有证据的限制；短内容每条 60-100 字。最多一条主新闻、三条短讯、一个可选发现；无足够材料时缩短。主新闻最多六个、短内容最多三个独立事实，每个仍需自己的引文。6000 token 是模型输出 JSON 的上限，包含引文和字段，不是正文长度目标。

GitHub 项目根地址优先读取官方渲染 README 接口，失败回退网页；日常简介不等于新发布。`articleReadings.readFailures` 可区分 HTTP 错误、超时、非公网地址和提取失败。本机 DNS 被网络工具映射到非公网地址时，应在正常公网环境运行预览，不关闭 SSRF 保护。

终审只收到已匹配引文及对应主张，不再收到全文。人工核对是否保留正确的归属、日期、许可、比较范围和限定条件；这仍不能替代语义验收。

## 成稿校验诊断

`edition.json` 的 `validationFailures` 区分 `write`（初稿）和 `review`（终审后仍不合格），包含具体错误及对应事实、引文样本。最多记录 24 项；每项最多 6 个事实，正文样本最多 240 字符、引文最多 500 字符，同时保留原始长度。样本可能截短，仅用于诊断，不能当作完整证据或已通过审稿的内容。

`repairs` 记录 `promote_reviewed_fact`：终审标题为 73-120 字符时，程序可把同一故事里不超过 72 字符的完整事实提为标题，原标题完整移入正文，再跑证据、历史、重复事件及长度校验。`headlineFactIndex` 是该事实在终审稿中的原始位置（从 0 开始），`sample` 保存调整前的有限样本。超过 120 字符、没有可用短事实或引文不合格，仍然省略；不额外调用模型、不截句。调整成功的故事仍可能被最终整版长度预算移除，以 `stories` 为实际保留结果。

以“它／其／该／这／上述”等明显回指开头的短句不会提为标题；这只是保守筛选，不能保证所有短句独立可读，人工验收仍需检查调整后的语序。

先看 `omissions` 了解省略原因，再按候选 ID 对照样本与 `articleReadings` 的来源。完整文章只在本地忽略的 `work/digest-snapshots/` 留存；公开预览不新增完整文章。对比多次预览时，初稿失败数不能直接当作最终丢稿数。

## 发送后故障

Actions 的 `telegram-delivery-recovery` artifact 包含 `delivery.json`：待发正文、事件事实及哈希、尝试时间、送达时间、Telegram 的 `message_id`/`date`。不包含 bot token、chat id 或完整 Telegram 响应。预览 artifact 独立保存，两者保留 14 天。

| status | 含义 | 处理 |
| --- | --- | --- |
| delivery_unknown | 已进入尝试发送阶段，但没有可靠回执，可能已送达 | 先在 Telegram 核对正文与时间，禁止直接重跑发送 |
| send_failed | Telegram 返回明确的 4xx 拒绝 | 按日志处理拒绝原因后再决定重试 |
| delivered | 取得成功响应，但后续本地账本或恢复记录操作失败 | 利用 receipt 和 stories/text 恢复账本，不重新发送 |
| history_saved_locally | 两份本地账本都已写入 | 继续检查 Actions 的 Persist sent history 步骤；此状态不表示 Git 推送已成功 |

恢复时先核对 Telegram，再核对最新 main 中 `data/story-history.json` 和 `data/sent-history.json`。从 `delivery.json` 合并缺失的事件、事实和 URL，保留 main 中随后新增的记录及较新的时间。仅提交修复后的账本。正文、事件及原送达时间都在恢复记录中，无需重新调用模型或 Telegram。

如果只是 Git 推送失败，可在对应运行日志中核对提交及失败原因；不要将“重新运行所有作业”当作恢复账本的捷径。无法确定送达时保持 unknown，不能通过手工改状态推定成功。

如果 runner 被强制结束或磁盘不可写，artifact 上传仍可能无法完成。预写记录降低了结果不明的风险，不能把 Telegram 与 Git 变成原子事务。

## Telegram 折叠详情

短标题和来源链接保持可见，正文解释使用 Telegram 原生 `expandable_blockquote`，默认折叠、点击展开；客户端决定开头可见行数，短段落可能直接完整显示。没有正文的条目不生成空折叠区。不需要按钮回调、常驻服务或新页面。

`digest.txt` 是展开后的纯文本；`edition.json` 保存同一份 `text` 和 `entities`，偏移与长度均按 UTF-16 计算，包含 emoji 时也须准确。发送时原样传入 Bot API，恢复记录也保留这对字段。折叠不减少消息总长度，仍执行 900 中文字 / 3200 字符的完整内容预算。关闭链接预览，避免来源卡片占屏。

依据：[Telegram MessageEntity](https://core.telegram.org/bots/api#messageentity)。自动测试验证字段与传输；最终折叠高度、按钮样式需要在实际 Telegram 客户端确认，离线预览不能替代实机验收。

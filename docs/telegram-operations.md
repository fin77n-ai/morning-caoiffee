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

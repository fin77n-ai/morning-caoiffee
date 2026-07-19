const fs = require('fs');
const path = require('path');

const { normalize } = require('./optimizeContent');

const HISTORY_PATH = path.join(__dirname, '..', 'data', 'sent-history.json');
const RETENTION_DAYS = 7;

// 读取近 N 天已发条目的归一化 key。任何读取失败都 fail-open 返回空集：宁可重复，不可沉默。
function loadRecentKeys(days = RETENTION_DAYS, historyPath = HISTORY_PATH) {
  try {
    const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    const cutoff = Date.now() - days * 86400000;
    const keys = new Set();
    for (const [day, entries] of Object.entries(history)) {
      if (Date.parse(day) < cutoff) continue;
      for (const key of entries || []) keys.add(key);
    }
    return keys;
  } catch {
    return new Set();
  }
}

// 发送成功后调用：把本期早报里真实出现的 URL 记入当天，顺手清掉过期天。
function recordSentDigest(digest, historyPath = HISTORY_PATH) {
  const urls = digest.match(/https?:\/\/[^\s)>\]]+/g) || [];
  const keys = [...new Set(urls.map((url) => normalize(url.replace(/[.,;:!?]*$/, ''))))].filter(Boolean);

  let history = {};
  try {
    history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
  } catch {
    history = {};
  }

  const today = new Date().toISOString().slice(0, 10);
  history[today] = [...new Set([...(history[today] || []), ...keys])];

  const cutoff = Date.now() - RETENTION_DAYS * 86400000;
  for (const day of Object.keys(history)) {
    if (Date.parse(day) < cutoff) delete history[day];
  }

  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n', 'utf-8');
  return keys.length;
}

module.exports = { loadRecentKeys, recordSentDigest, HISTORY_PATH };

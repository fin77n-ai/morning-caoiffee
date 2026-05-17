function wrapInTemplate(contentHtml, dateStr) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Morning cAoIffee ☕</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB',sans-serif;
      background:#0F172A;color:#F1F5F9;line-height:1.6;
      -webkit-font-smoothing:antialiased;
    }
    .wrapper{max-width:660px;margin:0 auto;padding:24px 16px}

    /* ── Header ── */
    .header{
      padding:40px 32px 32px;
      background:linear-gradient(160deg,#1E293B 0%,#0F172A 100%);
      border:1px solid #334155;border-bottom:2px solid #06B6D4;
      border-radius:16px 16px 0 0;text-align:center;
    }
    .header-eyebrow{
      font-size:11px;font-weight:700;letter-spacing:.14em;
      text-transform:uppercase;color:#06B6D4;margin-bottom:14px;
    }
    .header h1{
      font-size:26px;font-weight:800;color:#F1F5F9;
      letter-spacing:-.02em;margin-bottom:8px;
    }
    .header .date{font-size:13px;color:#64748B}

    /* ── Content shell ── */
    .content{
      background:#0F172A;border:1px solid #334155;border-top:none;
      border-radius:0 0 16px 16px;padding:36px 32px;
    }

    /* ── Section ── */
    .section{margin-bottom:36px}
    .section:last-child{margin-bottom:0}
    .section-title{
      font-size:11px;font-weight:700;letter-spacing:.12em;
      text-transform:uppercase;color:#06B6D4;
      padding-bottom:10px;margin-bottom:16px;
      border-bottom:1px solid #1E293B;
    }

    /* ── Story card ── */
    .card{
      background:#1E293B;border:1px solid #334155;
      border-left:3px solid #06B6D4;border-radius:10px;
      padding:16px 18px;margin-bottom:10px;
    }
    .card:last-child{margin-bottom:0}
    .badge{
      display:inline-block;font-size:10px;font-weight:600;
      letter-spacing:.07em;text-transform:uppercase;
      color:#06B6D4;background:rgba(6,182,212,.12);
      padding:2px 8px;border-radius:4px;margin-bottom:8px;
    }
    .card h3{font-size:14px;font-weight:600;margin-bottom:7px;line-height:1.45}
    .card h3 a{color:#E2E8F0;text-decoration:none}
    .card h3 a:hover{color:#06B6D4;text-decoration:underline}
    .card p{font-size:13px;color:#94A3B8;line-height:1.68}

    /* ── Term card (purple accent) ── */
    .term-card{
      background:#1E293B;border:1px solid #334155;
      border-left:3px solid #7C3AED;border-radius:10px;
      padding:18px 20px;
    }
    .term-card h2{font-size:14px;font-weight:700;color:#A78BFA;margin-bottom:10px}
    .term-card p{font-size:13px;color:#94A3B8;line-height:1.7}

    /* ── Curiosity card (amber accent) ── */
    .curiosity-card{
      background:#1E293B;border:1px solid #334155;
      border-left:3px solid #F59E0B;border-radius:10px;
      padding:18px 20px;
    }
    .curiosity-card p{font-size:13px;color:#94A3B8;line-height:1.7}
    .curiosity-card .question{
      font-size:15px;font-weight:700;color:#FCD34D;
      margin-bottom:10px;line-height:1.4;
    }

    /* ── Podcast card (green accent) ── */
    .podcast-card{
      background:#1E293B;border:1px solid #334155;
      border-left:3px solid #10B981;border-radius:10px;
      padding:18px 20px;
    }
    .podcast-card h3{font-size:14px;font-weight:600;color:#6EE7B7;margin-bottom:8px}
    .podcast-card p{font-size:13px;color:#94A3B8;line-height:1.68}

    /* ── Footer ── */
    .footer{text-align:center;padding:20px;color:#334155;font-size:12px}

    a{color:#06B6D4}
  </style>
</head>
<body>
  <div class="wrapper">

    <div class="header">
      <div class="header-eyebrow">☕ Morning cAoIffee</div>
      <h1>你的每日 AI 早报</h1>
      <div class="date">${dateStr}</div>
    </div>

    <div class="content">
      ${contentHtml}
    </div>

    <div class="footer">Brewed with ☕ &amp; 🤖</div>
  </div>
</body>
</html>`;
}

module.exports = { wrapInTemplate };

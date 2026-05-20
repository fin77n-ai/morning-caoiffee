function wrapInTemplate(contentHtml, dateStr) {
  return `<!DOCTYPE html>
<html lang="zh-CN" style="color-scheme:dark only">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">
  <title>Morning cAoIffee ☕</title>
  <style>
    :root{color-scheme:dark only}
    body,table,td,div,p,h1,h2,h3{color-scheme:dark only}
    a{color:#06B6D4;text-decoration:none}
    a:hover{text-decoration:underline}
    /* Outlook.com 暗色模式钩子 */
    [data-ogsc] body,[data-ogsb] body{background-color:#0F172A !important;color:#F1F5F9 !important}
    [data-ogsc] .card,[data-ogsb] .card,
    [data-ogsc] .term-card,[data-ogsb] .term-card,
    [data-ogsc] .curiosity-card,[data-ogsb] .curiosity-card,
    [data-ogsc] .podcast-card,[data-ogsb] .podcast-card{background-color:#1E293B !important}
    [data-ogsc] h1,[data-ogsc] h2,[data-ogsc] h3{color:#F1F5F9 !important}
    /* 移动端微调 */
    @media only screen and (max-width:600px){
      .wrapper-td{padding:12px 8px !important}
      .header-td{padding:28px 20px 24px !important}
      .content-td{padding:24px 18px !important}
    }
  </style>
</head>
<body style="background-color:#0F172A;color:#F1F5F9;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB',sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0F172A;">
    <tr>
      <td align="center" class="wrapper-td" style="padding:24px 16px;background-color:#0F172A;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="660" style="max-width:660px;width:100%;">
          <tr>
            <td class="header-td" style="background:linear-gradient(160deg,#1E293B 0%,#0F172A 100%);background-color:#1E293B;border:1px solid #334155;border-bottom:2px solid #06B6D4;border-radius:16px 16px 0 0;padding:40px 32px 32px;text-align:center;">
              <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#06B6D4;margin-bottom:14px;">☕ Morning cAoIffee</div>
              <h1 style="font-size:26px;font-weight:800;color:#F1F5F9;letter-spacing:-.02em;margin:0 0 8px 0;">你的每日 AI 早报</h1>
              <div style="font-size:13px;color:#64748B;">${dateStr}</div>
            </td>
          </tr>
          <tr>
            <td class="content-td" style="background-color:#0F172A;border:1px solid #334155;border-top:none;border-radius:0 0 16px 16px;padding:36px 32px;color:#F1F5F9;">
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding:20px;color:#334155;font-size:12px;background-color:#0F172A;">Brewed with ☕ &amp; 🤖</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { wrapInTemplate };

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
    a{color:#7DD3FC;text-decoration:none}
    a:hover{text-decoration:underline}
    /* Outlook.com 暗色模式钩子 */
    [data-ogsc] body,[data-ogsb] body{background-color:#050816 !important;color:#F8FAFC !important}
    [data-ogsc] .card,[data-ogsb] .card,
    [data-ogsc] .term-card,[data-ogsb] .term-card,
    [data-ogsc] .curiosity-card,[data-ogsb] .curiosity-card,
    [data-ogsc] .podcast-card,[data-ogsb] .podcast-card{background-color:#10172B !important}
    [data-ogsc] h1,[data-ogsc] h2,[data-ogsc] h3{color:#F8FAFC !important}
    /* 移动端微调 */
    @media only screen and (max-width:600px){
      .wrapper-td{padding:10px 8px !important}
      .header-td{padding:28px 20px 22px !important}
      .content-td{padding:24px 18px !important}
      .digest-title{font-size:25px !important}
      .card{padding:15px 16px !important}
    }
  </style>
</head>
<body style="background-color:#050816;color:#F8FAFC;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB',sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#050816;background-image:url('cid:cyberpunk-ai-background');background-size:100% auto;background-position:center top;background-repeat:repeat-y;">
    <tr>
      <td align="center" class="wrapper-td" style="padding:26px 16px;background-color:transparent;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="660" style="max-width:660px;width:100%;">
          <tr>
            <td class="header-td" style="background-color:rgba(10,15,36,.62);background-image:linear-gradient(135deg,rgba(9,17,31,.58) 0%,rgba(16,22,58,.52) 48%,rgba(36,11,61,.56) 100%);border:1px solid #2DD4BF;border-bottom:3px solid #F0FD4F;border-radius:14px 14px 0 0;padding:36px 32px 30px;text-align:left;box-shadow:0 0 28px rgba(34,211,238,.22);">
              <div style="font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#67E8F9;margin-bottom:12px;">Night City Dispatch · Morning cAoIffee</div>
              <h1 class="digest-title" style="font-size:31px;font-weight:900;color:#F8FAFC;letter-spacing:0;margin:0 0 8px 0;line-height:1.16;text-shadow:0 0 12px rgba(34,211,238,.45);">你的每日 AI 早报</h1>
              <div style="font-size:13px;color:#D8B4FE;">${dateStr} · 5 分钟读完 · signal locked</div>
              <div style="margin-top:14px;">
                <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:.12em;color:#050816;background-color:#F0FD4F;border-radius:3px;padding:4px 7px;margin:0 6px 6px 0;">DOWNTOWN NODE</span>
                <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:.12em;color:#050816;background-color:#22D3EE;border-radius:3px;padding:4px 7px;margin:0 6px 6px 0;">NEON FEED</span>
                <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:.12em;color:#050816;background-color:#F472B6;border-radius:3px;padding:4px 7px;margin:0 0 6px 0;">RAIN CHANNEL</span>
              </div>
              <div style="margin-top:22px;border-top:1px solid rgba(103,232,249,.45);border-bottom:1px solid rgba(240,253,79,.35);padding:10px 0 8px 0;">
                <div style="height:6px;background-color:#22D3EE;width:42%;display:inline-block;vertical-align:middle;box-shadow:0 0 12px rgba(34,211,238,.65);"></div>
                <div style="height:6px;background-color:#F0FD4F;width:18%;display:inline-block;vertical-align:middle;margin-left:8px;box-shadow:0 0 12px rgba(240,253,79,.55);"></div>
                <div style="height:6px;background-color:#F472B6;width:26%;display:inline-block;vertical-align:middle;margin-left:8px;box-shadow:0 0 12px rgba(244,114,182,.55);"></div>
                <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11px;letter-spacing:.1em;color:#94A3B8;margin-top:8px;">0101 // AI SIGNAL // NEON MORNING FEED</div>
              </div>
            </td>
          </tr>
          <tr>
            <td class="content-td" style="background-color:rgba(7,11,26,.54);background-image:linear-gradient(180deg,rgba(244,114,182,.04) 0%,rgba(7,11,26,0) 18%);border:1px solid rgba(39,54,79,.82);border-top:none;border-radius:0 0 14px 14px;padding:34px 32px;color:#F8FAFC;">
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding:20px;color:#64748B;font-size:12px;background-color:#050816;">Brewed under neon rain with questionable optimism</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { wrapInTemplate };

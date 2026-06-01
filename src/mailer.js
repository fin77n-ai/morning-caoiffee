const nodemailer = require('nodemailer');
const path = require('path');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendMail(htmlContent) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const info = await transporter.sendMail({
    from: `"Morning cAoIffee ☕" <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_TO,
    subject: `☕ Morning cAoIffee — ${today}`,
    html: htmlContent,
    attachments: [
      {
        filename: 'cyberpunk-ai-long-background.png',
        path: path.join(__dirname, '..', 'assets', 'cyberpunk-ai-long-background.png'),
        cid: 'cyberpunk-ai-background',
      },
    ],
  });

  console.log(`Email sent: ${info.messageId}`);
}

module.exports = { sendMail };

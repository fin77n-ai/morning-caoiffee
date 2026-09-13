const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');

test('email flow builds recipient, HTML and the inline PNG through the real MIME transport', async t => {
  const values = { GMAIL_USER: 'sender@example.test', GMAIL_APP_PASSWORD: 'test-only', GMAIL_TO: 'reader@example.test' };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[require.resolve('../src/mailer')];
  });
  // Exercise the actual mailer and MIME encoder without opening an SMTP connection.
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  let info;
  t.mock.method(nodemailer, 'createTransport', options => {
    assert.equal(options.service, 'gmail');
    assert.equal(options.auth.user, values.GMAIL_USER);
    return { sendMail: async message => {
      assert.match(message.subject, /^☕ Morning cAoIffee — /);
      info = await transport.sendMail(message);
      return info;
    } };
  });
  const { sendMail } = require('../src/mailer');
  await sendMail('<h1>Morning preview</h1><img src="cid:cyberpunk-ai-background">');
  assert.deepEqual(info.envelope, { from: values.GMAIL_USER, to: [values.GMAIL_TO] });
  const mime = info.message.toString().replace(/\r\n/g, '\n');
  assert.match(mime, /Content-Type: multipart\/related/);
  assert.match(mime, /<h1>Morning preview<\/h1>/);
  assert.match(mime, /cid:cyberpunk-ai-background/);
  const boundary = mime.match(/boundary="([^"]+)"/)[1];
  const image = mime.split(`--${boundary}`).find(part => part.includes('Content-ID: <cyberpunk-ai-background>'));
  assert.ok(image, 'inline image part is present');
  assert.match(image, /Content-Type: image\/png/);
  const encoded = image.slice(image.indexOf('\n\n') + 2).trim();
  assert.deepEqual(Buffer.from(encoded, 'base64'), fs.readFileSync(path.join(__dirname, '../assets/cyberpunk-ai-long-background.png')));
});

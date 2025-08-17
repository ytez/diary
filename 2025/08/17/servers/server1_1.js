const fs = require('fs');
const https = require('https');
const url = require('url');
const util = require('util');

//--- 証明書と秘密鍵の読み込み
const options = {
  key: fs.readFileSync('key1.pem'),
  cert: fs.readFileSync('cert1.pem'),
};

//--- サーバ作成
https.createServer(options, (req, res) => {
  let data = '';

  const headers = req.headers;
  const auth_b64 = headers['authorization'].slice('Basic '.length);
  const [username, password] = Buffer.from(auth_b64, 'base64').toString('utf-8').split(':', 2);
  data += util.format('UserAgent: %s\n', headers['user-agent']);
  data += util.format('Username: %s\n', username);
  data += util.format('Password: %s\n', password);
  data += util.format('Host: %s\n', headers['host']);
  
  const url_parsed = url.parse(req.url, true);
  data += util.format('Query: %s\n', url_parsed.query);

  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(data);
}).listen(443, () => {
  console.log('HTTPS Server running at https://localhost/');
});
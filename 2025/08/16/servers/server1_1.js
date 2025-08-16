const https = require('https');
const fs = require('fs');

//--- 証明書と秘密鍵の読み込み
const options = {
  key: fs.readFileSync('key1.pem'),
  cert: fs.readFileSync('cert1.pem'),
};

//--- サーバ作成
https.createServer(options, (req, res) => {
  res.writeHead(200);
  res.end('Hello HTTPS!\n');
}).listen(8001, () => {
  console.log('HTTPS Server running at https://192.168.90.224:8001/');
});

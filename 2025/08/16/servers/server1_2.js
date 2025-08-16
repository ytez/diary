const https = require('https');
const fs = require('fs');
const path = require('path');

//--- 証明書と秘密鍵の読み込み
const options = {
  key: fs.readFileSync('key1.pem'),
  cert: fs.readFileSync('cert1.pem'),
};

//--- サーバ作成
https.createServer(options, (req, res) => {
  const requestedPath = decodeURIComponent(req.url);
  //--- パストラバーサル脆弱性
  const filePath = path.join(__dirname, 'public', requestedPath);
  const extension = path.parse(filePath).ext;
  let contentType = 'text/plain';
  switch (extension) {
    case '.html':
      contentType = 'text/html';
      break;
    case '.js':
      contentType = 'application/javascript'
      break;
  }

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found.\n');
      return;
    }

    res.writeHead(200, {'Content-Type': contentType});
    res.end(data);
  });

}).listen(8001, () => {
  console.log('HTTPS Server running at https://192.168.90.224:8001/');
});

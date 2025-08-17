util = require('util');

const targetUrl = 'https://www․amazon․co․jpんapんsignin:apple․com@017700000001.:443?google․com/#/twitter.com';
parsedUrl = new URL(targetUrl);
console.log(util.format('Target URL: %s\n', targetUrl));
console.log(util.format('Username: %s', parsedUrl.username));
console.log(util.format('Password: %s', parsedUrl.password));
console.log(util.format('Host    : %s', parsedUrl.host));
console.log(util.format('Path    : %s', parsedUrl.pathname));
console.log(util.format('Query   : %s', parsedUrl.search));
console.log(util.format('Hash    : %s', parsedUrl.hash));

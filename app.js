const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.end('test123456! Hello from CI/CD Web! Build: ' + (process.env.BUILD_ID || 'local'));
});

server.listen(port, () => console.log('Server running on port', port));

// Healthcheck do contêiner: considera saudável SOMENTE quando o banco responde (200).
// 503 (banco indisponível) faz o contêiner ser marcado como unhealthy.
const http = require('http');

const req = http.get('http://127.0.0.1:3000/health', (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on('error', () => process.exit(1));
req.setTimeout(3000, () => {
  req.destroy();
  process.exit(1);
});

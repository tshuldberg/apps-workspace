// Simple static file server for the Pokemon game
const server = Bun.serve({
  port: 8080,
  async fetch(req) {
    let path = new URL(req.url).pathname;
    if (path === '/') path = '/index.html';
    const file = Bun.file(import.meta.dir + path);
    if (await file.exists()) return new Response(file);
    return new Response('Not found', { status: 404 });
  },
});
console.log(`Pokemon Red running at http://localhost:${server.port}`);

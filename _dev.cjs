// 开发服务器入口（供 .claude/launch.json 调用，保证 cwd 正确）
process.chdir(__dirname);
import('vite').then(async ({ createServer }) => {
  const server = await createServer({ root: __dirname });
  await server.listen();
  server.printUrls();
});

import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages 部署必须设置 base
  // 格式：'/仓库名/'（注意前后都有斜杠）
  // 如果你的仓库名不是 surface-pulse，把这里改成你实际的仓库名
  base: '/surface-pulse/',

  server: {
    host: true,   // 暴露到局域网，让手机/iPad 可以通过 IP 访问
    port: 5173,
  },
  build: {
    outDir: 'dist',   // 打包输出到 dist 文件夹
    target: 'es2020',
  },
});

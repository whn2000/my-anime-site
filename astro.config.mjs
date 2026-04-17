import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server', // 核心设置：开启服务端模式
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
});
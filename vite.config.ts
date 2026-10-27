import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite 构建配置：
// - React 插件用于编译 .tsx 组件
// - public/ 目录下的文件（包括 _worker.js）会被原样复制到 dist/ 构建产物中
export default defineConfig({
  plugins: [react()],
});

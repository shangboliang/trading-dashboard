import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f1115", // 深色主背景，贴合截图风格
        panel: "#1e222d",      // 面板/卡片背景
        border: "#2b313f",     // 边框颜色
        textMain: "#d1d4dc",   // 主要文本颜色
        textMuted: "#787b86",  // 次要文本/辅助说明颜色
        win: "#22ab94",        // 盈利/胜利 绿色
        loss: "#f23645",       // 亏损/失败 红色
      },
    },
  },
  plugins: [],
};
export default config;
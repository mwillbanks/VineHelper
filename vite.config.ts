import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [viteStaticCopy({
    targets: [
      {
        src: "src/resource/image",
        dest: "src/resource/"
      },
      {
        src: "src/resource/audio",
        dest: "src/resource/"
      },
    ]
  }), webExtension({
    browser: process.env.TARGET || "chrome",
  })],
});

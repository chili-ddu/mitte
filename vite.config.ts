import { defineConfig } from 'vite';

// GitHub Pages: 사용자명.github.io/저장소명/ 아래에 놓이므로 base 가 필요하다.
// 배포 워크플로가 VITE_BASE=/저장소명/ 을 넘기고, 로컬 개발·빌드는 '/'.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
});

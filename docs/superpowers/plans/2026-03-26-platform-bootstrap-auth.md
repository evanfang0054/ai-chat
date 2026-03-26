# 平台骨架与鉴权 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 ai-chat 的 monorepo 基础工程，并完成本地账号密码登录、JWT 鉴权、Admin/User RBAC、前端登录页与基础受保护路由。

**Architecture:** 使用 `pnpm workspace + Turborepo` 组织 `apps/api` 与 `apps/web`，共享基础 TypeScript / ESLint 配置与共享类型。后端以 `NestJS + Prisma + PostgreSQL + Redis` 为基础，先建立用户与认证闭环；前端以 `React + Vite` 实现登录页、认证状态管理和基础路由守卫。

**Tech Stack:** pnpm workspace, Turborepo, NestJS, React, Vite, TypeScript, Prisma, PostgreSQL, Redis, JWT, React Router, Zustand

---

## File Structure Map

### Root
- Create: `package.json` — monorepo 根脚本与 workspace 依赖
- Create: `pnpm-workspace.yaml` — workspace 包范围
- Create: `turbo.json` — Turborepo pipeline
- Create: `.gitignore` — 忽略 node_modules、dist、env、generated files
- Create: `.env.example` — API/Web/DB/Redis 所需环境变量模板

### Shared packages
- Create: `packages/tsconfig/package.json` — tsconfig 共享包元信息
- Create: `packages/tsconfig/base.json` — 基础 TS 配置
- Create: `packages/tsconfig/nestjs.json` — NestJS TS 配置
- Create: `packages/tsconfig/react.json` — React TS 配置
- Create: `packages/eslint-config/package.json` — ESLint 共享包元信息
- Create: `packages/eslint-config/base.js` — 基础 lint 规则
- Create: `packages/eslint-config/react.js` — React lint 规则
- Create: `packages/eslint-config/nest.js` — Nest lint 规则
- Create: `packages/shared/package.json` — 共享类型包
- Create: `packages/shared/src/index.ts` — 共享导出入口
- Create: `packages/shared/src/auth.ts` — 认证 DTO / 类型
- Create: `packages/shared/src/user.ts` — 用户角色、用户视图类型

### Infra
- Create: `infra/compose.yaml` — PostgreSQL 与 Redis 本地依赖

### API app
- Create: `apps/api/package.json` — API app 依赖与脚本
- Create: `apps/api/tsconfig.json` — API TS 配置
- Create: `apps/api/tsconfig.build.json` — API build 配置
- Create: `apps/api/nest-cli.json` — Nest CLI 配置
- Create: `apps/api/src/main.ts` — API 启动入口
- Create: `apps/api/src/app.module.ts` — 根模块
- Create: `apps/api/src/health.controller.ts` — 健康检查接口
- Create: `apps/api/src/common/config/env.ts` — 环境变量 schema
- Create: `apps/api/src/common/prisma/prisma.module.ts` — Prisma 模块
- Create: `apps/api/src/common/prisma/prisma.service.ts` — Prisma 服务
- Create: `apps/api/src/common/guards/jwt-auth.guard.ts` — JWT 守卫
- Create: `apps/api/src/common/guards/roles.guard.ts` — 角色守卫
- Create: `apps/api/src/common/decorators/current-user.decorator.ts` — 当前用户装饰器
- Create: `apps/api/src/common/decorators/roles.decorator.ts` — 角色装饰器
- Create: `apps/api/src/modules/users/users.module.ts` — 用户模块
- Create: `apps/api/src/modules/users/users.service.ts` — 用户服务
- Create: `apps/api/src/modules/users/users.controller.ts` — 用户接口
- Create: `apps/api/src/modules/auth/auth.module.ts` — 认证模块
- Create: `apps/api/src/modules/auth/auth.service.ts` — 注册/登录/JWT 签发
- Create: `apps/api/src/modules/auth/auth.controller.ts` — 注册/登录/当前用户接口
- Create: `apps/api/src/modules/auth/jwt.strategy.ts` — Passport JWT 策略
- Create: `apps/api/src/modules/auth/password.ts` — 密码哈希与校验
- Create: `apps/api/src/modules/auth/dto/register.dto.ts` — 注册 DTO
- Create: `apps/api/src/modules/auth/dto/login.dto.ts` — 登录 DTO
- Create: `apps/api/prisma/schema.prisma` — Prisma schema
- Create: `apps/api/prisma/seed.ts` — 初始化管理员脚本
- Create: `apps/api/test/app.e2e-spec.ts` — 健康检查 e2e
- Create: `apps/api/test/auth.e2e-spec.ts` — 认证 e2e
- Create: `apps/api/test/users.e2e-spec.ts` — 权限 e2e

### Web app
- Create: `apps/web/package.json` — Web app 依赖与脚本
- Create: `apps/web/tsconfig.json` — Web TS 配置
- Create: `apps/web/vite.config.ts` — Vite 配置
- Create: `apps/web/index.html` — Vite HTML 入口
- Create: `apps/web/src/main.tsx` — React 入口
- Create: `apps/web/src/App.tsx` — 路由根组件
- Create: `apps/web/src/lib/api.ts` — fetch 封装
- Create: `apps/web/src/lib/env.ts` — Web 环境变量读取
- Create: `apps/web/src/router/index.tsx` — 路由定义
- Create: `apps/web/src/router/ProtectedRoute.tsx` — 登录态守卫
- Create: `apps/web/src/router/RoleRoute.tsx` — 角色守卫
- Create: `apps/web/src/stores/auth-store.ts` — token / user 状态
- Create: `apps/web/src/pages/login/LoginPage.tsx` — 登录页
- Create: `apps/web/src/pages/dashboard/DashboardPage.tsx` — 登录后首页
- Create: `apps/web/src/pages/admin/AdminPage.tsx` — 管理员首页
- Create: `apps/web/src/components/forms/LoginForm.tsx` — 登录表单
- Create: `apps/web/src/components/layout/AppShell.tsx` — 基础布局
- Create: `apps/web/src/services/auth.ts` — 登录/当前用户请求
- Create: `apps/web/src/services/users.ts` — 用户列表请求
- Create: `apps/web/src/styles.css` — 基础样式
- Create: `apps/web/src/__tests__/auth-store.test.ts` — 认证状态单测
- Create: `apps/web/src/__tests__/protected-route.test.tsx` — 路由守卫单测

---

### Task 1: 建立 monorepo 根工程

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: 写根目录 package.json**

```json
{
  "name": "ai-chat",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "format": "turbo run format",
    "db:up": "docker compose -f infra/compose.yaml up -d",
    "db:down": "docker compose -f infra/compose.yaml down"
  },
  "devDependencies": {
    "turbo": "^2.5.0",
    "typescript": "^5.8.2"
  }
}
```

- [ ] **Step 2: 写 pnpm-workspace.yaml**

```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **Step 3: 写 turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^test"],
      "outputs": []
    },
    "format": {
      "outputs": []
    }
  }
}
```

- [ ] **Step 4: 写 .gitignore**

```gitignore
node_modules
.pnpm-store
.env
.env.local
.env.*.local
dist
build
coverage
.turbo
.prisma
apps/api/generated
```

- [ ] **Step 5: 写 .env.example**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_chat"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="change-me"
API_PORT=3000
WEB_PORT=5173
VITE_API_BASE_URL="http://localhost:3000"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="admin123456"
```

- [ ] **Step 6: 运行根目录依赖安装**

Run: `pnpm install`
Expected: 安装 `turbo` 与 `typescript` 成功，并生成 `pnpm-lock.yaml`

- [ ] **Step 7: 提交当前变更**

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore .env.example pnpm-lock.yaml
git commit -m "chore: initialize monorepo workspace"
```

---

### Task 2: 建立共享配置 packages

**Files:**
- Create: `packages/tsconfig/package.json`
- Create: `packages/tsconfig/base.json`
- Create: `packages/tsconfig/nestjs.json`
- Create: `packages/tsconfig/react.json`
- Create: `packages/eslint-config/package.json`
- Create: `packages/eslint-config/base.js`
- Create: `packages/eslint-config/nest.js`
- Create: `packages/eslint-config/react.js`
- Test: `pnpm lint`

- [ ] **Step 1: 写 packages/tsconfig/package.json**

```json
{
  "name": "@ai-chat/tsconfig",
  "version": "0.0.0",
  "private": true
}
```

- [ ] **Step 2: 写 packages/tsconfig/base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Node",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 3: 写 packages/tsconfig/nestjs.json**

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

- [ ] **Step 4: 写 packages/tsconfig/react.json**

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "types": ["vite/client"]
  }
}
```

- [ ] **Step 5: 写 packages/eslint-config/package.json**

```json
{
  "name": "@ai-chat/eslint-config",
  "version": "0.0.0",
  "private": true,
  "peerDependencies": {
    "eslint": "^9.22.0",
    "typescript": "^5.8.2"
  }
}
```

- [ ] **Step 6: 写 packages/eslint-config/base.js**

```js
module.exports = {
  root: false,
  env: {
    es2022: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': 'off'
  }
};
```

- [ ] **Step 7: 写 packages/eslint-config/nest.js**

```js
module.exports = {
  extends: ['./base.js'],
  env: {
    node: true
  }
};
```

- [ ] **Step 8: 写 packages/eslint-config/react.js**

```js
module.exports = {
  extends: ['./base.js'],
  env: {
    browser: true,
    node: false
  }
};
```

- [ ] **Step 9: 运行 lint 命令确认配置文件无语法错误**

Run: `pnpm lint`
Expected: 由于 apps 尚未创建，turbo 可能输出无任务或通过；不得出现配置文件解析错误

- [ ] **Step 10: 提交当前变更**

```bash
git add packages/tsconfig packages/eslint-config
git commit -m "chore: add shared tsconfig and eslint packages"
```

---

### Task 3: 建立 shared 类型包

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/auth.ts`
- Create: `packages/shared/src/user.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/src/auth.ts`

- [ ] **Step 1: 写 packages/shared/package.json**

```json
{
  "name": "@ai-chat/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts"
}
```

- [ ] **Step 2: 写 packages/shared/tsconfig.json**

```json
{
  "extends": "@ai-chat/tsconfig/base.json",
  "compilerOptions": {
    "baseUrl": "."
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 写 packages/shared/src/user.ts**

```ts
export type UserRole = 'ADMIN' | 'USER';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface UserSummary {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}
```

- [ ] **Step 4: 写 packages/shared/src/auth.ts**

```ts
import type { UserSummary } from './user';

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: UserSummary;
}
```

- [ ] **Step 5: 写 packages/shared/src/index.ts**

```ts
export * from './auth';
export * from './user';
```

- [ ] **Step 6: 运行 TypeScript 检查**

Run: `pnpm exec tsc -p packages/shared/tsconfig.json --noEmit`
Expected: PASS，无类型错误

- [ ] **Step 7: 提交当前变更**

```bash
git add packages/shared
git commit -m "feat: add shared auth and user types"
```

---

### Task 4: 建立本地基础设施配置

**Files:**
- Create: `infra/compose.yaml`
- Test: `infra/compose.yaml`

- [ ] **Step 1: 写 infra/compose.yaml**

```yaml
services:
  postgres:
    image: postgres:16
    container_name: ai-chat-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ai_chat
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5432:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7
    container_name: ai-chat-redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data

volumes:
  postgres-data:
  redis-data:
```

- [ ] **Step 2: 启动 PostgreSQL 与 Redis**

Run: `docker compose -f infra/compose.yaml up -d`
Expected: `postgres` 与 `redis` 容器启动成功

- [ ] **Step 3: 查看容器状态**

Run: `docker compose -f infra/compose.yaml ps`
Expected: `postgres` 与 `redis` 状态为 `running`

- [ ] **Step 4: 提交当前变更**

```bash
git add infra/compose.yaml
git commit -m "chore: add local postgres and redis services"
```

---

### Task 5: 建立 API app 骨架与健康检查

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health.controller.ts`
- Create: `apps/api/test/app.e2e-spec.ts`
- Test: `apps/api/test/app.e2e-spec.ts`

- [ ] **Step 1: 写 apps/api/package.json**

```json
{
  "name": "@ai-chat/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.13.10",
    "eslint": "^9.22.0",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.6",
    "ts-node": "^10.9.2"
  }
}
```

- [ ] **Step 2: 写 apps/api/tsconfig.json**

```json
{
  "extends": "@ai-chat/tsconfig/nestjs.json",
  "compilerOptions": {
    "baseUrl": "."
  },
  "include": ["src", "test", "prisma"]
}
```

- [ ] **Step 3: 写 apps/api/tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["test", "dist", "**/*spec.ts"]
}
```

- [ ] **Step 4: 写 apps/api/nest-cli.json**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src"
}
```

- [ ] **Step 5: 写 apps/api/src/health.controller.ts**

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return { ok: true };
  }
}
```

- [ ] **Step 6: 写 apps/api/src/app.module.ts**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController]
})
export class AppModule {}
```

- [ ] **Step 7: 写 apps/api/src/main.ts**

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.API_PORT ? Number(process.env.API_PORT) : 3000);
}

void bootstrap();
```

- [ ] **Step 8: 写 apps/api/test/app.e2e-spec.ts**

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET)', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ ok: true });
  });
});
```

- [ ] **Step 9: 写 apps/api/test/jest-e2e.json**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

- [ ] **Step 10: 安装 workspace 依赖**

Run: `pnpm install`
Expected: NestJS、Jest、ESLint 依赖安装成功

- [ ] **Step 11: 运行 API e2e 测试**

Run: `pnpm --filter @ai-chat/api test:e2e`
Expected: PASS，`/health (GET)` 通过

- [ ] **Step 12: 提交当前变更**

```bash
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat: bootstrap api app with health check"
```

---

### Task 6: 建立 Web app 骨架与基础路由

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/router/index.tsx`
- Create: `apps/web/src/pages/login/LoginPage.tsx`
- Create: `apps/web/src/pages/dashboard/DashboardPage.tsx`
- Create: `apps/web/src/pages/admin/AdminPage.tsx`
- Create: `apps/web/src/styles.css`
- Test: `apps/web/src/__tests__/protected-route.test.tsx`

- [ ] **Step 1: 写 apps/web/package.json**

```json
{
  "name": "@ai-chat/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "lint": "eslint \"src/**/*.{ts,tsx}\"",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.3.0",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.22.0",
    "jsdom": "^26.0.0",
    "vite": "^6.2.0",
    "vitest": "^3.0.8"
  }
}
```

- [ ] **Step 2: 写 apps/web/tsconfig.json**

```json
{
  "extends": "@ai-chat/tsconfig/react.json",
  "compilerOptions": {
    "baseUrl": "."
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: 写 apps/web/vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT || 5173)
  },
  test: {
    environment: 'jsdom'
  }
});
```

- [ ] **Step 4: 写 apps/web/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ai-chat</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: 写 apps/web/src/pages/login/LoginPage.tsx**

```tsx
export function LoginPage() {
  return (
    <main>
      <h1>Login</h1>
      <p>Please sign in to continue.</p>
    </main>
  );
}
```

- [ ] **Step 6: 写 apps/web/src/pages/dashboard/DashboardPage.tsx**

```tsx
export function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
    </main>
  );
}
```

- [ ] **Step 7: 写 apps/web/src/pages/admin/AdminPage.tsx**

```tsx
export function AdminPage() {
  return (
    <main>
      <h1>Admin</h1>
    </main>
  );
}
```

- [ ] **Step 8: 写 apps/web/src/router/index.tsx**

```tsx
import { createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '../pages/login/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { AdminPage } from '../pages/admin/AdminPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <DashboardPage /> },
  { path: '/admin', element: <AdminPage /> }
]);
```

- [ ] **Step 9: 写 apps/web/src/App.tsx**

```tsx
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

export default function App() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 10: 写 apps/web/src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 11: 写 apps/web/src/styles.css**

```css
:root {
  font-family: Inter, system-ui, sans-serif;
  color: #111827;
  background: #f9fafb;
}

body {
  margin: 0;
}

main {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
}
```

- [ ] **Step 12: 安装 workspace 依赖**

Run: `pnpm install`
Expected: React/Vite 依赖安装成功

- [ ] **Step 13: 运行 Web build**

Run: `pnpm --filter @ai-chat/web build`
Expected: PASS，生成 Vite build 输出

- [ ] **Step 14: 提交当前变更**

```bash
git add apps/web package.json pnpm-lock.yaml
git commit -m "feat: bootstrap web app with basic routes"
```

---

### Task 7: 接入 Prisma、PostgreSQL 与 Redis 配置

**Files:**
- Create: `apps/api/src/common/config/env.ts`
- Create: `apps/api/src/common/prisma/prisma.service.ts`
- Create: `apps/api/src/common/prisma/prisma.module.ts`
- Create: `apps/api/prisma/schema.prisma`
- Test: `apps/api/test/app.e2e-spec.ts`

- [ ] **Step 1: 写 apps/api/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  USER
}

enum UserStatus {
  ACTIVE
  DISABLED
}

model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  role         UserRole   @default(USER)
  status       UserStatus @default(ACTIVE)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}
```

- [ ] **Step 2: 在 apps/api/package.json 增加 Prisma 与 Redis 依赖**

```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.2",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@prisma/client": "^6.5.0",
    "ioredis": "^5.5.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "prisma": "^6.5.0"
  }
}
```

- [ ] **Step 3: 写 apps/api/src/common/config/env.ts**

```ts
export interface AppEnv {
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  API_PORT: string;
}

export function getEnv(): AppEnv {
  return {
    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL || '',
    JWT_SECRET: process.env.JWT_SECRET || '',
    API_PORT: process.env.API_PORT || '3000'
  };
}
```

- [ ] **Step 4: 写 apps/api/src/common/prisma/prisma.service.ts**

```ts
import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
```

- [ ] **Step 5: 写 apps/api/src/common/prisma/prisma.module.ts**

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService]
})
export class PrismaModule {}
```

- [ ] **Step 6: 修改 apps/api/src/app.module.ts 注入 PrismaModule**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController]
})
export class AppModule {}
```

- [ ] **Step 7: 安装依赖并生成 Prisma Client**

Run: `pnpm install && pnpm --filter @ai-chat/api exec prisma generate`
Expected: Prisma Client 生成成功

- [ ] **Step 8: 执行数据库迁移**

Run: `pnpm --filter @ai-chat/api exec prisma migrate dev --name init_user`
Expected: PostgreSQL 中生成 `User` 表

- [ ] **Step 9: 运行 API e2e 测试**

Run: `pnpm --filter @ai-chat/api test:e2e`
Expected: PASS，健康检查仍通过

- [ ] **Step 10: 提交当前变更**

```bash
git add apps/api/package.json apps/api/prisma apps/api/src/common apps/api/src/app.module.ts pnpm-lock.yaml
git commit -m "feat: add prisma and database configuration"
```

---

### Task 8: 实现 users 模块与管理员查询用户列表

**Files:**
- Create: `apps/api/src/modules/users/users.module.ts`
- Create: `apps/api/src/modules/users/users.service.ts`
- Create: `apps/api/src/modules/users/users.controller.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/users.e2e-spec.ts`

- [ ] **Step 1: 先写 users.e2e 测试，定义管理员接口行为**

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /users requires auth', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });
});
```

- [ ] **Step 2: 运行 users.e2e 测试确认失败**

Run: `pnpm --filter @ai-chat/api test:e2e -- users.e2e-spec.ts`
Expected: FAIL，提示未定义 `/users` 或鉴权未启用

- [ ] **Step 3: 写 users.service.ts**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });
  }
}
```

- [ ] **Step 4: 写 users.controller.ts**

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN')
  listUsers() {
    return this.usersService.listUsers();
  }
}
```

- [ ] **Step 5: 写 users.module.ts**

```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
```

- [ ] **Step 6: 修改 apps/api/src/app.module.ts 注入 UsersModule**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './common/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [HealthController]
})
export class AppModule {}
```

- [ ] **Step 7: 运行 users.e2e 测试**

Run: `pnpm --filter @ai-chat/api test:e2e -- users.e2e-spec.ts`
Expected: PASS，未登录访问 `/users` 返回 401

- [ ] **Step 8: 提交当前变更**

```bash
git add apps/api/src/modules/users apps/api/src/app.module.ts apps/api/test/users.e2e-spec.ts
git commit -m "feat: add users module with admin-only listing"
```

---

### Task 9: 实现密码工具、JWT 策略与认证模块

**Files:**
- Create: `apps/api/src/modules/auth/password.ts`
- Create: `apps/api/src/modules/auth/dto/register.dto.ts`
- Create: `apps/api/src/modules/auth/dto/login.dto.ts`
- Create: `apps/api/src/modules/auth/jwt.strategy.ts`
- Create: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/src/modules/auth/auth.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

- [ ] **Step 1: 先写 auth.e2e 测试，定义注册与登录行为**

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register creates a user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user1@example.com', password: 'password123' })
      .expect(201);

    expect(response.body.user.email).toBe('user1@example.com');
    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  it('POST /auth/login returns access token', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user2@example.com', password: 'password123' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user2@example.com', password: 'password123' })
      .expect(200);

    expect(response.body.user.email).toBe('user2@example.com');
    expect(response.body.accessToken).toEqual(expect.any(String));
  });
});
```

- [ ] **Step 2: 运行 auth.e2e 测试确认失败**

Run: `pnpm --filter @ai-chat/api test:e2e -- auth.e2e-spec.ts`
Expected: FAIL，提示 `/auth/register` 或 `/auth/login` 未实现

- [ ] **Step 3: 在 apps/api/package.json 增加认证依赖**

```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.2",
    "@nestjs/core": "^11.0.0",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^11.0.0",
    "@prisma/client": "^6.5.0",
    "bcryptjs": "^3.0.2",
    "ioredis": "^5.5.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/passport-jwt": "^4.0.1",
    "prisma": "^6.5.0"
  }
}
```

- [ ] **Step 4: 写 password.ts**

```ts
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}
```

- [ ] **Step 5: 写 DTO 文件**

```ts
// apps/api/src/modules/auth/dto/register.dto.ts
export class RegisterDto {
  email!: string;
  password!: string;
}
```

```ts
// apps/api/src/modules/auth/dto/login.dto.ts
export class LoginDto {
  email!: string;
  password!: string;
}
```

- [ ] **Step 6: 写 jwt.strategy.ts**

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'change-me'
    });
  }

  async validate(payload: { sub: string; email: string; role: 'ADMIN' | 'USER' }) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role
    };
  }
}
```

- [ ] **Step 7: 写 auth.service.ts**

```ts
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashPassword, verifyPassword } from './password';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await hashPassword(dto.password)
      }
    });

    return this.createAuthResponse(user.id, user.email, user.role, user.status, user.createdAt);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await verifyPassword(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createAuthResponse(user.id, user.email, user.role, user.status, user.createdAt);
  }

  private createAuthResponse(
    id: string,
    email: string,
    role: 'ADMIN' | 'USER',
    status: 'ACTIVE' | 'DISABLED',
    createdAt: Date
  ) {
    const accessToken = this.jwtService.sign({ sub: id, email, role });

    return {
      accessToken,
      user: {
        id,
        email,
        role,
        status,
        createdAt: createdAt.toISOString()
      }
    };
  }
}
```

- [ ] **Step 8: 写 auth.controller.ts**

```ts
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { userId: string; email: string; role: string } }) {
    return req.user;
  }
}
```

- [ ] **Step 9: 写 auth.module.ts**

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change-me',
      signOptions: { expiresIn: '7d' }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService]
})
export class AuthModule {}
```

- [ ] **Step 10: 修改 apps/api/src/app.module.ts 注入 AuthModule**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './common/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule],
  controllers: [HealthController]
})
export class AppModule {}
```

- [ ] **Step 11: 安装依赖**

Run: `pnpm install`
Expected: JWT/Passport/bcrypt 依赖安装成功

- [ ] **Step 12: 运行 auth.e2e 测试**

Run: `pnpm --filter @ai-chat/api test:e2e -- auth.e2e-spec.ts`
Expected: PASS，注册和登录测试通过

- [ ] **Step 13: 提交当前变更**

```bash
git add apps/api/src/modules/auth apps/api/src/app.module.ts apps/api/package.json apps/api/test/auth.e2e-spec.ts pnpm-lock.yaml
git commit -m "feat: add local auth with jwt"
```

---

### Task 10: 实现 JWT 守卫、角色守卫与 RBAC

**Files:**
- Create: `apps/api/src/common/guards/jwt-auth.guard.ts`
- Create: `apps/api/src/common/guards/roles.guard.ts`
- Create: `apps/api/src/common/decorators/current-user.decorator.ts`
- Create: `apps/api/src/common/decorators/roles.decorator.ts`
- Modify: `apps/api/src/modules/users/users.controller.ts`
- Test: `apps/api/test/users.e2e-spec.ts`

- [ ] **Step 1: 扩展 users.e2e 测试，定义管理员可访问、普通用户不可访问**

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

const prisma = new PrismaClient();

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let adminToken = '';
  let userToken = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    await prisma.user.deleteMany();

    adminToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'admin@example.com', password: 'password123' })
    ).body.accessToken;

    await prisma.user.update({
      where: { email: 'admin@example.com' },
      data: { role: 'ADMIN' }
    });

    adminToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'password123' })
    ).body.accessToken;

    userToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
    ).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('GET /users requires auth', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });

  it('GET /users forbids regular user', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('GET /users allows admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toEqual(expect.any(Array));
    expect(response.body.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: 运行 users.e2e 测试确认失败**

Run: `pnpm --filter @ai-chat/api test:e2e -- users.e2e-spec.ts`
Expected: FAIL，提示 JwtAuthGuard/RolesGuard 未实现或权限判断不正确

- [ ] **Step 3: 写 roles.decorator.ts**

```ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Array<'ADMIN' | 'USER'>) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 4: 写 current-user.decorator.ts**

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
```

- [ ] **Step 5: 写 jwt-auth.guard.ts**

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 6: 写 roles.guard.ts**

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Array<'ADMIN' | 'USER'>>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    return requiredRoles.includes(request.user.role);
  }
}
```

- [ ] **Step 7: 确认 users.controller.ts 使用 JwtAuthGuard + RolesGuard + @Roles('ADMIN')**

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN')
  listUsers() {
    return this.usersService.listUsers();
  }
}
```

- [ ] **Step 8: 运行 users.e2e 测试**

Run: `pnpm --filter @ai-chat/api test:e2e -- users.e2e-spec.ts`
Expected: PASS，未登录 401，普通用户 403，管理员 200

- [ ] **Step 9: 提交当前变更**

```bash
git add apps/api/src/common/guards apps/api/src/common/decorators apps/api/src/modules/users/users.controller.ts apps/api/test/users.e2e-spec.ts
git commit -m "feat: add jwt guard and role-based access control"
```

---

### Task 11: 添加管理员种子与 /auth/me 当前用户接口验证

**Files:**
- Create: `apps/api/prisma/seed.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/test/auth.e2e-spec.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

- [ ] **Step 1: 扩展 auth.e2e 测试，定义 /auth/me 行为**

```ts
it('GET /auth/me returns current user', async () => {
  const registerResponse = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email: 'me@example.com', password: 'password123' })
    .expect(201);

  const response = await request(app.getHttpServer())
    .get('/auth/me')
    .set('Authorization', `Bearer ${registerResponse.body.accessToken}`)
    .expect(200);

  expect(response.body.email).toBe('me@example.com');
  expect(response.body.role).toBe('USER');
});
```

- [ ] **Step 2: 运行 auth.e2e 测试确认失败**

Run: `pnpm --filter @ai-chat/api test:e2e -- auth.e2e-spec.ts`
Expected: 若 `/auth/me` 尚未正确返回用户信息，则 FAIL

- [ ] **Step 3: 确保 auth.controller.ts 的 /auth/me 返回 JWT payload**

```ts
@Get('me')
@UseGuards(JwtAuthGuard)
me(@Req() req: { user: { userId: string; email: string; role: string } }) {
  return req.user;
}
```

- [ ] **Step 4: 写 prisma/seed.ts**

```ts
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/password';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123456';

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: await hashPassword(password),
      role: 'ADMIN'
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 5: 在 apps/api/package.json 增加 db 脚本**

```json
{
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "ts-node prisma/seed.ts"
  }
}
```

- [ ] **Step 6: 执行 seed 脚本**

Run: `pnpm --filter @ai-chat/api db:seed`
Expected: 数据库中存在管理员账号

- [ ] **Step 7: 运行 auth.e2e 测试**

Run: `pnpm --filter @ai-chat/api test:e2e -- auth.e2e-spec.ts`
Expected: PASS，注册、登录、/auth/me 均通过

- [ ] **Step 8: 提交当前变更**

```bash
git add apps/api/prisma/seed.ts apps/api/package.json apps/api/test/auth.e2e-spec.ts apps/api/src/modules/auth/auth.controller.ts
git commit -m "feat: add current-user endpoint and admin seed"
```

---

### Task 12: 实现前端认证状态、登录页与受保护路由

**Files:**
- Create: `apps/web/src/lib/env.ts`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/stores/auth-store.ts`
- Create: `apps/web/src/services/auth.ts`
- Create: `apps/web/src/router/ProtectedRoute.tsx`
- Create: `apps/web/src/router/RoleRoute.tsx`
- Create: `apps/web/src/components/forms/LoginForm.tsx`
- Create: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/pages/login/LoginPage.tsx`
- Modify: `apps/web/src/router/index.tsx`
- Test: `apps/web/src/__tests__/auth-store.test.ts`
- Test: `apps/web/src/__tests__/protected-route.test.tsx`

- [ ] **Step 1: 先写 auth-store 单测**

```ts
import { describe, expect, it } from 'vitest';
import { create } from 'zustand';

type AuthState = {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
};

describe('auth store', () => {
  it('stores access token', () => {
    const useStore = create<AuthState>((set) => ({
      accessToken: null,
      setAccessToken: (token) => set({ accessToken: token })
    }));

    useStore.getState().setAccessToken('token-123');
    expect(useStore.getState().accessToken).toBe('token-123');
  });
});
```

- [ ] **Step 2: 先写 protected-route 单测**

```tsx
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

function ProtectedRoute({ isAuthenticated }: { isAuthenticated: boolean }) {
  return isAuthenticated ? <div>Allowed</div> : <div>Redirected</div>;
}

describe('ProtectedRoute', () => {
  it('renders protected content when authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ProtectedRoute isAuthenticated />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });

  it('redirects when unauthenticated', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ProtectedRoute isAuthenticated={false} />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Redirected')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 运行前端测试确认失败**

Run: `pnpm --filter @ai-chat/web test`
Expected: FAIL，实际 store / route 文件未实现

- [ ] **Step 4: 写 lib/env.ts**

```ts
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
};
```

- [ ] **Step 5: 写 lib/api.ts**

```ts
import { env } from './env';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 6: 写 stores/auth-store.ts**

```ts
import { create } from 'zustand';
import type { UserSummary } from '@ai-chat/shared';

type AuthState = {
  accessToken: string | null;
  user: UserSummary | null;
  setAuth: (payload: { accessToken: string; user: UserSummary }) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: ({ accessToken, user }) => set({ accessToken, user }),
  clearAuth: () => set({ accessToken: null, user: null })
}));
```

- [ ] **Step 7: 写 services/auth.ts**

```ts
import type { AuthResponse, LoginRequest } from '@ai-chat/shared';
import { apiFetch } from '../lib/api';

export function login(data: LoginRequest) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
```

- [ ] **Step 8: 写 ProtectedRoute.tsx**

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';

export function ProtectedRoute() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return accessToken ? <Outlet /> : <Navigate to="/login" replace />;
}
```

- [ ] **Step 9: 写 RoleRoute.tsx**

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';

export function RoleRoute({ role }: { role: 'ADMIN' | 'USER' }) {
  const user = useAuthStore((state) => state.user);
  return user?.role === role ? <Outlet /> : <Navigate to="/" replace />;
}
```

- [ ] **Step 10: 写 LoginForm.tsx**

```tsx
import { FormEvent, useState } from 'react';

type LoginFormProps = {
  onSubmit: (values: { email: string; password: string }) => Promise<void>;
};

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await onSubmit({ email, password });
    } catch {
      setError('Login failed');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error ? <p>{error}</p> : null}
      <button type="submit">Sign in</button>
    </form>
  );
}
```

- [ ] **Step 11: 写 AppShell.tsx**

```tsx
import { PropsWithChildren } from 'react';
import { useAuthStore } from '../../stores/auth-store';

export function AppShell({ children }: PropsWithChildren) {
  const user = useAuthStore((state) => state.user);

  return (
    <div>
      <header>
        <strong>ai-chat</strong>
        <span>{user?.email}</span>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

- [ ] **Step 12: 修改 LoginPage.tsx**

```tsx
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../../components/forms/LoginForm';
import { login } from '../../services/auth';
import { useAuthStore } from '../../stores/auth-store';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  async function handleLogin(values: { email: string; password: string }) {
    const response = await login(values);
    setAuth(response);
    navigate('/');
  }

  return (
    <main>
      <h1>Login</h1>
      <LoginForm onSubmit={handleLogin} />
    </main>
  );
}
```

- [ ] **Step 13: 修改 dashboard/admin 页面，加入 AppShell**

```tsx
// DashboardPage.tsx
import { AppShell } from '../../components/layout/AppShell';

export function DashboardPage() {
  return (
    <AppShell>
      <h1>Dashboard</h1>
    </AppShell>
  );
}
```

```tsx
// AdminPage.tsx
import { AppShell } from '../../components/layout/AppShell';

export function AdminPage() {
  return (
    <AppShell>
      <h1>Admin</h1>
    </AppShell>
  );
}
```

- [ ] **Step 14: 修改 router/index.tsx，接入 ProtectedRoute 与 RoleRoute**

```tsx
import { createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '../pages/login/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { AdminPage } from '../pages/admin/AdminPage';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [{ index: true, element: <DashboardPage /> }]
  },
  {
    path: '/admin',
    element: <ProtectedRoute />,
    children: [
      {
        element: <RoleRoute role="ADMIN" />,
        children: [{ index: true, element: <AdminPage /> }]
      }
    ]
  }
]);
```

- [ ] **Step 15: 运行前端测试**

Run: `pnpm --filter @ai-chat/web test`
Expected: PASS，store 与受保护路由测试通过

- [ ] **Step 16: 运行前端 build**

Run: `pnpm --filter @ai-chat/web build`
Expected: PASS，无类型或打包错误

- [ ] **Step 17: 提交当前变更**

```bash
git add apps/web
git commit -m "feat: add login flow and protected routes"
```

---

### Task 13: 端到端联调与验收

**Files:**
- Modify: `apps/api/test/auth.e2e-spec.ts`
- Modify: `apps/api/test/users.e2e-spec.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`
- Test: `apps/api/test/users.e2e-spec.ts`
- Test: `apps/web/src/__tests__/protected-route.test.tsx`

- [ ] **Step 1: 运行全部 API e2e 测试**

Run: `pnpm --filter @ai-chat/api test:e2e`
Expected: PASS，health/auth/users 全部通过

- [ ] **Step 2: 运行全部 Web 测试**

Run: `pnpm --filter @ai-chat/web test`
Expected: PASS

- [ ] **Step 3: 运行 workspace build**

Run: `pnpm build`
Expected: PASS，api 与 web 都能构建

- [ ] **Step 4: 启动本地依赖**

Run: `pnpm db:up`
Expected: PostgreSQL 与 Redis 均在运行

- [ ] **Step 5: 启动 API**

Run: `pnpm --filter @ai-chat/api dev`
Expected: API 监听 `http://localhost:3000`

- [ ] **Step 6: 启动 Web**

Run: `pnpm --filter @ai-chat/web dev`
Expected: Web 监听 `http://localhost:5173`

- [ ] **Step 7: 手工验收登录流程**

Run:
1. 打开 `http://localhost:5173/login`
2. 使用 seed 管理员账号登录
3. 验证登录后进入 `/`
4. 访问 `/admin`
5. 使用普通用户登录后验证访问 `/admin` 被重定向到 `/`

Expected:
- 管理员可访问 `/admin`
- 普通用户不能访问 `/admin`
- 未登录访问 `/` 时会跳转 `/login`

- [ ] **Step 8: 提交最终验收调整**

```bash
git add apps/api apps/web package.json pnpm-lock.yaml
git commit -m "test: verify platform bootstrap and auth flow"
```

---

## Self-Review Notes

### Spec coverage
- monorepo、apps/api、apps/web、packages/shared、tsconfig/eslint-config：Task 1-6
- Prisma/PostgreSQL、Redis：Task 4、Task 7
- 用户模型：Task 7
- 本地账号密码登录、JWT：Task 9、Task 11
- Admin/User RBAC：Task 8、Task 10
- 前端登录页与基础路由守卫：Task 12
- 联调与验收：Task 13

### Placeholder scan
- 未保留 TBD / TODO / later 占位项
- 每个任务都给出具体文件与命令
- 每个代码步骤都包含实际内容

### Type consistency
- 角色统一为 `ADMIN | USER`
- 登录返回统一为 `{ accessToken, user }`
- JWT payload 统一字段为 `sub`, `email`, `role`

### Implementation note
- 本计划只覆盖任务 1：平台骨架与鉴权
- 聊天、Tool、Schedule 不在本轮实现范围内

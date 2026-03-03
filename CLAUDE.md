# BuildVideo 项目规范

## 技术栈
- Next.js 15 (App Router) + TypeScript + Prisma ORM + NextAuth.js v5
- 前端样式：glass 设计系统（`glass-surface`, `glass-chip-*`, `glass-btn-*`, `glass-text-*`）
- 图标：`AppIcon` from `@/components/ui/icons`
- i18n：`next-intl`，消息文件在 `messages/zh/` 和 `messages/en/`

## 代码规范

### API 路由模板
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'

export const GET = apiHandler(async (request: NextRequest) => {
  const authResult = await requireAdminAuth()
  if (isErrorResponse(authResult)) return authResult
  // ...
  return NextResponse.json({ success: true, data: { ... } })
})
```

### 页面组件模板
- `'use client'` 声明
- `useTranslations('admin')` 获取翻译
- `useParams()` 返回值可能为 null，必须用 `(params?.id ?? '') as string`
- 加载状态用 `<AppIcon name="loader" className="animate-spin" />`

### Prisma 字段命名
- Episode 排序字段：`episodeNumber`（不是 ~~episodeIndex~~）
- NovelPromotionCharacter 有 `appearances` 关联
- NovelPromotionLocation 有 `images` 关联（`isSelected` 标记主图）
- 全局资产模型：`GlobalCharacter`, `GlobalLocation`, `GlobalVoice`

### 前端样式速查
| 场景 | 类名 |
|------|------|
| 卡片容器 | `glass-surface rounded-2xl p-5` |
| 表格容器 | `glass-surface rounded-2xl overflow-hidden` |
| 标签-信息 | `glass-chip glass-chip-info px-2 py-0.5 text-[10px]` |
| 标签-成功 | `glass-chip glass-chip-success` |
| 标签-危险 | `glass-chip glass-chip-danger` |
| 标签-警告 | `glass-chip glass-chip-warning` |
| 标签-默认 | `glass-chip glass-chip-default` |
| 主按钮 | `glass-btn-base glass-btn-soft px-3 py-1.5 text-xs rounded-lg` |
| 幽灵按钮 | `glass-btn-base glass-btn-ghost` |
| 危险按钮 | `glass-btn-base glass-btn-danger` |
| 输入框 | `glass-input-base w-full px-4 py-2.5 rounded-xl` |
| 链接色 | `text-[var(--glass-tone-info-fg)] hover:underline` |

## 部署流程

### 仓库结构
- 私有仓库（开发）：`gdd-rock/buildvideo` → origin
- 公开仓库（开源）：`BuildVideoAI/buildvideo` → public remote
- 服务器拉取：`waoowaooAI/waoowaoo` → 服务器 origin（已添加 `private` remote 指向 gdd-rock）

### 一键部署命令
```bash
bash scripts/deploy.sh
```

### 手动部署步骤
1. 本地：`git push origin main`
2. 服务器：`ssh ubuntu@43.153.123.138`
3. `cd /home/ubuntu/waoowaoo && git fetch private main && git reset --hard private/main`
4. `docker compose up -d --build app`
5. 验证：`docker ps` 确认容器状态

### 服务器信息
- IP: 43.153.123.138
- 用户: ubuntu
- 项目路径: `/home/ubuntu/waoowaoo`
- Docker 容器: buildvideo-app (端口 13000), buildvideo-mysql (13306), buildvideo-redis (16379)
- 域名: https://buildvideo.ai（宝塔 Nginx 反向代理到 13000）

## 管理后台路由

| 路由 | 功能 |
|------|------|
| `/admin` | 仪表盘 |
| `/admin/users` | 用户列表 |
| `/admin/users/[id]` | 用户详情（设置/余额/项目/任务/交易） |
| `/admin/users/[id]/assets` | 用户资产（角色图片/场景图片/音色） |
| `/admin/projects` | 项目列表 |
| `/admin/projects/[id]` | 项目详情（剧集/角色/场景/用量） |
| `/admin/tasks` | 任务监控 |
| `/admin/logs` | 系统日志 |

## 踩坑记录
- `useParams()` 在 Next.js 15 可返回 null，必须做空值防护
- Prisma schema 中 Episode 字段是 `episodeNumber` 不是 `episodeIndex`
- 图片 URL 在管理后台可直接用 `imageUrl` 原始值，不需要走 `attachMediaFields*` 签名流程
- Docker 构建错误信息在 stdout，不在 stderr（SSH 命令需要 `2>&1` 捕获）

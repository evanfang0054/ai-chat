# Browser E2E Matrix

- P0: 登录成功并进入 `/chat`
- P1: 聊天发送消息并看到流式结果 / tool 卡片
- P2: 创建 schedule、启用、查看 next run 和最新结果
- P3: runs 页查看失败原因、stage、tool summary，并执行 retry
- P4: access token 过期后通过 refresh token 自动恢复请求
- P5: 空态、失败态、恢复态、受保护路由、权限边界

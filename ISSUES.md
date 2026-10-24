# 分层测试任务书（8 个）

给 Cursor Cloud Agents 的并发负载。每个任务都要独立产出 PR，不许互相依赖。

1. **单文件组件** `feat: ProductCard`
   验收：`npm test -- product-card`，组件对 0 库存渲染「已售罄」且按钮 disabled。
2. **跨文件功能** `feat: cart 逻辑`
   验收：`npm test -- cart`，addToCart 受库存钳制、不改入参、未知 sku 抛错。
3. **依赖与构建** `chore: 引入 zod 校验`
   验收：`npm run build` 通过，`npm test -- schema` 覆盖合法/非法 payload。
4. **跑测试驱动** `fix: pricing 满减边界`
   验收：`npm test -- pricing` 覆盖恰好等于门槛、低于门槛、会员叠加三种边界。
5. **截图验证 UI** `feat: 结算页`
   验收：agent 自建 `npm run dev`，用浏览器/Computer Use 截图结算页，截图入库 `docs/screenshots/`。
6. **读文档** `docs: 补 API 契约`
   验收：读 `README.md` 与现有代码后写 `docs/api.md`，字段与实现一致（含 agentNotes 语义）。
7. **并发改同一模块** `feat: 购物车优惠券` + `feat: 购物车库存锁`（两个 agent 同时改 `src/lib/cart.ts`）
   验收：两个 PR 都能自测通过，记录合并冲突与解决方式。
8. **长跑轮询** `chore: 依赖升级审计`
   验收：跑 `npm outdated`、逐条升级、`npm test` 全绿，产出升级报告 `docs/deps-audit.md`。

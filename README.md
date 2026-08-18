# ✨ 魔法3P

基于炸金花 + 「想象牌」机制的轻量网页小游戏，朋友聚会专用。手机浏览器优先，兼容 PC。

> **魔法3P：每人只有1张手牌，桌上再开1张公共底牌，剩下第3张全靠想象；系统自动往最大的牌想。所有人只和庄家比，庄家赢够70%就过关！**

## 运行

```bash
npm install
npm run dev
```

浏览器打开提示的地址（默认 http://localhost:5173）。手机与电脑需在同一局域网时，可用 `http://<电脑IP>:5173` 访问（dev server 已开启 host 监听）。

## 测试与构建

```bash
npm test     # 规则单元测试（牌型/想象牌/70%规则/牌堆消耗）
npm run build
```

## 规则速览

- 每人最终 3 张牌 = **1 张手牌 + 1 张公共底牌 + 1 张想象牌**
- 想象牌由系统枚举 52 张候选自动选出「最大牌型」的那张，不消耗牌堆
- 牌型大小：**豹子 > 同花顺 > 顺子 > 金花 > 对子 > 散牌**（注意：本游戏 顺子 > 金花）
- 顺子 QKA 最大、A23 最小
- 闲家只和庄家比；庄家胜率 ≥ 70%（不四舍五入）即过关
- 不过关则继续发下一轮，直到过关或牌堆不足以发下一轮（💥 挑战失败）

## 核心代码

| 文件 | 职责 |
| --- | --- |
| `src/game/cards.ts` | 牌/牌堆/洗牌 |
| `src/game/evaluate.ts` | `evaluateHand()` / `compareHands()` 牌型判定与比较 |
| `src/game/magic.ts` | `findBestMagicCard()` 最佳想象牌算法 |
| `src/game/state.ts` | `playRound()` / `calculateDealerWinRate()` / `isDealerPassed()` |
| `src/App.tsx` | 界面与动画 |

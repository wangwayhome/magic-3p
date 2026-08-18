// 想象牌（魔法牌）核心算法
// 枚举全部 52 张候选牌，找出能让「手牌 + 底牌 + 想象牌」组成最大牌型的那一张。
// 想象牌是虚拟牌：不消耗牌堆、不受已发牌限制、多人可以想象同一张。

import { Card, fullDeck } from './cards';
import { HandEval, HandType, compareEval, evaluateHand } from './evaluate';

export interface MagicResult {
  handCard: Card;
  communityCard: Card;
  magicCard: Card;
  finalCards: Card[];
  handType: HandType;
  handTypeName: string;
  compareValues: number[];
  /** 展示用描述，如「豹子5」「顺子567」 */
  detail: string;
  /** 完整牌型评估结果（用于比较） */
  eval: HandEval;
}

/**
 * 自动计算最佳想象牌：往最大了想。
 * 1. 拿到个人手牌 + 公共底牌
 * 2. 枚举 52 张候选想象牌
 * 3. 每种组合 evaluateHand()
 * 4. 取最大牌型（同牌型按比较值取大）
 */
export function findBestMagicCard(
  handCard: Card,
  communityCard: Card,
): MagicResult {
  let best: MagicResult | null = null;

  for (const candidate of fullDeck()) {
    const finalCards = [handCard, communityCard, candidate];
    const ev = evaluateHand(finalCards);

    if (!best || compareEval(ev, best.eval) > 0) {
      best = {
        handCard,
        communityCard,
        magicCard: candidate,
        finalCards,
        handType: ev.type,
        handTypeName: ev.typeName,
        compareValues: ev.values,
        detail: ev.detail,
        eval: ev,
      };
    }
  }

  // fullDeck() 非空，best 必然存在
  return best!;
}

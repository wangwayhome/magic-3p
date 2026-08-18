// 炸金花牌型判定与比较
// 牌型大小：豹子 > 同花顺 > 金花 > 顺子 > 对子 > 散牌
// 注意：金花 > 顺子，必须严格遵守

import { Card, rankLabel } from './cards';

export const HAND_TYPES = {
  BAOZI: 6, // 豹子
  TONGHUASHUN: 5, // 同花顺
  JINHUA: 4, // 金花
  SHUNZI: 3, // 顺子
  DUIZI: 2, // 对子
  SANPAI: 1, // 散牌
} as const;

export type HandType = (typeof HAND_TYPES)[keyof typeof HAND_TYPES];

export const TYPE_NAMES: Record<HandType, string> = {
  6: '豹子',
  5: '同花顺',
  4: '金花',
  3: '顺子',
  2: '对子',
  1: '散牌',
};

export interface HandEval {
  /** 牌型等级 6..1 */
  type: HandType;
  /** 中文牌型名 */
  typeName: string;
  /** 同牌型内部比较用的数值序列（字典序比较） */
  values: number[];
  /** 展示用描述，如「豹子5」「顺子567」「同花顺QKA」 */
  detail: string;
}

/** 顺子的展示标签：567 / QKA / A23 */
function seqLabel(straightHigh: number): string {
  if (straightHigh === 3) return 'A23'; // A23 特殊最小顺子
  return [straightHigh - 2, straightHigh - 1, straightHigh]
    .map(rankLabel)
    .join('');
}

/** 判定三张牌的牌型 */
export function evaluateHand(cards: Card[]): HandEval {
  if (cards.length !== 3) {
    throw new Error('evaluateHand 需要恰好 3 张牌');
  }

  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const flush =
    cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;

  // 顺子判定：普通连续，或 A23（high 记为 3，是最小顺子）
  let straightHigh = 0;
  if (ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1) {
    straightHigh = ranks[0];
  } else if (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2) {
    straightHigh = 3;
  }

  // 1. 豹子
  if (ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
    return {
      type: HAND_TYPES.BAOZI,
      typeName: TYPE_NAMES[6],
      values: [ranks[0]],
      detail: `豹子${rankLabel(ranks[0])}`,
    };
  }

  // 2. 同花顺
  if (straightHigh > 0 && flush) {
    return {
      type: HAND_TYPES.TONGHUASHUN,
      typeName: TYPE_NAMES[5],
      values: [straightHigh],
      detail: `同花顺${seqLabel(straightHigh)}`,
    };
  }

  // 3. 金花（本游戏：金花 > 顺子）
  if (flush) {
    return {
      type: HAND_TYPES.JINHUA,
      typeName: TYPE_NAMES[4],
      values: ranks,
      detail: `金花${ranks.map(rankLabel).join('')}`,
    };
  }

  // 4. 顺子
  if (straightHigh > 0) {
    return {
      type: HAND_TYPES.SHUNZI,
      typeName: TYPE_NAMES[3],
      values: [straightHigh],
      detail: `顺子${seqLabel(straightHigh)}`,
    };
  }

  // 5. 对子（排序后对子必然相邻）
  if (ranks[0] === ranks[1] || ranks[1] === ranks[2]) {
    let pair: number;
    let kicker: number;
    if (ranks[0] === ranks[1]) {
      pair = ranks[0];
      kicker = ranks[2];
    } else {
      pair = ranks[1];
      kicker = ranks[0];
    }
    return {
      type: HAND_TYPES.DUIZI,
      typeName: TYPE_NAMES[2],
      values: [pair, kicker],
      detail: `对子${rankLabel(pair)}`,
    };
  }

  // 6. 散牌
  return {
    type: HAND_TYPES.SANPAI,
    typeName: TYPE_NAMES[1],
    values: ranks,
    detail: '散牌',
  };
}

/** 比较两个牌型结果：>0 表示 a 大，<0 表示 b 大，=0 表示完全一样大 */
export function compareEval(a: HandEval, b: HandEval): number {
  if (a.type !== b.type) return a.type - b.type;
  const len = Math.max(a.values.length, b.values.length);
  for (let i = 0; i < len; i++) {
    const av = a.values[i] ?? 0;
    const bv = b.values[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/** 直接比较两组三张牌 */
export function compareHands(handA: Card[], handB: Card[]): number {
  return compareEval(evaluateHand(handA), evaluateHand(handB));
}

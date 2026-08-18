// 《魔法3P》规则单元测试
// 覆盖提示词第二十一节的全部必测特殊情况 + 牌型顺序 + 70% 规则 + 牌堆消耗

import { describe, expect, it } from 'vitest';
import { Card, Suit, fullDeck, shuffle } from './cards';
import {
  HAND_TYPES,
  compareEval,
  compareHands,
  evaluateHand,
} from './evaluate';
import { findBestMagicCard } from './magic';
import {
  calculateDealerWinRate,
  canDealRound,
  cardsNeeded,
  isDealerPassed,
  playRound,
} from './state';

const c = (rank: number, suit: Suit): Card => ({ rank, suit });

describe('牌型判定', () => {
  it('六种牌型都能正确识别', () => {
    expect(evaluateHand([c(14, '♠'), c(14, '♥'), c(14, '♣')]).typeName).toBe('豹子');
    expect(evaluateHand([c(11, '♠'), c(12, '♠'), c(13, '♠')]).typeName).toBe('同花顺');
    expect(evaluateHand([c(5, '♠'), c(6, '♥'), c(7, '♦')]).typeName).toBe('顺子');
    expect(evaluateHand([c(4, '♠'), c(8, '♠'), c(11, '♠')]).typeName).toBe('金花');
    expect(evaluateHand([c(6, '♠'), c(6, '♥'), c(9, '♣')]).typeName).toBe('对子');
    expect(evaluateHand([c(3, '♠'), c(7, '♥'), c(11, '♣')]).typeName).toBe('散牌');
  });

  it('用户示例牌均按指定牌型识别', () => {
    const examples: Array<[Card[], string]> = [
      [[c(14, '♠'), c(14, '♥'), c(14, '♣')], '豹子'], // AAA
      [[c(7, '♠'), c(7, '♥'), c(7, '♣')], '豹子'], // 777
      [[c(11, '♠'), c(12, '♠'), c(13, '♠')], '同花顺'], // ♠JQK
      [[c(5, '♥'), c(6, '♥'), c(7, '♥')], '同花顺'], // ♥567
      [[c(4, '♠'), c(8, '♠'), c(11, '♠')], '金花'], // ♠48J
      [[c(5, '♠'), c(6, '♥'), c(7, '♦')], '顺子'], // 异花567
      [[c(11, '♠'), c(12, '♥'), c(13, '♦')], '顺子'], // 异花JQK
      [[c(6, '♠'), c(6, '♥'), c(9, '♣')], '对子'], // 669
      [[c(14, '♠'), c(14, '♥'), c(3, '♣')], '对子'], // AA3
      [[c(3, '♠'), c(5, '♥'), c(7, '♣')], '散牌'], // 357
      [[c(2, '♠'), c(7, '♥'), c(11, '♣')], '散牌'], // 27J
    ];

    for (const [cards, expectedType] of examples) {
      expect(evaluateHand(cards).typeName).toBe(expectedType);
    }
  });

  it('牌型顺序：豹子 > 同花顺 > 金花 > 顺子 > 对子 > 散牌', () => {
    const baozi = evaluateHand([c(2, '♠'), c(2, '♥'), c(2, '♣')]); // 最小豹子222
    const tonghua = evaluateHand([c(14, '♠'), c(2, '♠'), c(3, '♠')]); // 最小同花顺A23
    const jinhua = evaluateHand([c(4, '♠'), c(8, '♠'), c(11, '♠')]); // 金花48J
    const shunzi = evaluateHand([c(12, '♠'), c(13, '♥'), c(14, '♦')]); // 最大顺子QKA
    const duizi = evaluateHand([c(14, '♠'), c(14, '♥'), c(13, '♣')]); // 最大对子AAK
    const sanpai = evaluateHand([c(14, '♠'), c(12, '♥'), c(10, '♦')]); // 散牌AQ10（不连续，避免成为顺子）

    expect(compareEval(baozi, tonghua)).toBeGreaterThan(0);
    expect(compareEval(tonghua, jinhua)).toBeGreaterThan(0);
    // 关键：即使金花点数较小，也必须大于最大顺子
    expect(compareEval(jinhua, shunzi)).toBeGreaterThan(0);
    expect(compareEval(shunzi, duizi)).toBeGreaterThan(0);
    expect(compareEval(duizi, sanpai)).toBeGreaterThan(0);
  });

  it('顺子比较：QKA 最大，A23 最小', () => {
    const qka = evaluateHand([c(12, '♠'), c(13, '♥'), c(14, '♦')]);
    const jqk = evaluateHand([c(11, '♠'), c(12, '♥'), c(13, '♦')]);
    const tjq = evaluateHand([c(10, '♠'), c(11, '♥'), c(12, '♦')]);
    const s234 = evaluateHand([c(2, '♠'), c(3, '♥'), c(4, '♦')]);
    const a23 = evaluateHand([c(14, '♠'), c(2, '♥'), c(3, '♦')]);

    expect(qka.type).toBe(HAND_TYPES.SHUNZI);
    expect(a23.type).toBe(HAND_TYPES.SHUNZI);
    expect(compareEval(qka, jqk)).toBeGreaterThan(0);
    expect(compareEval(jqk, tjq)).toBeGreaterThan(0);
    expect(compareEval(s234, a23)).toBeGreaterThan(0);
  });

  it('豹子比较：AAA > KKK > QQQ > 222', () => {
    const aaa = evaluateHand([c(14, '♠'), c(14, '♥'), c(14, '♣')]);
    const kkk = evaluateHand([c(13, '♠'), c(13, '♥'), c(13, '♣')]);
    const s222 = evaluateHand([c(2, '♠'), c(2, '♥'), c(2, '♣')]);
    expect(compareEval(aaa, kkk)).toBeGreaterThan(0);
    expect(compareEval(kkk, s222)).toBeGreaterThan(0);
  });

  it('金花逐张比较：A95 > KQ9（同花不连续）', () => {
    const a95 = evaluateHand([c(14, '♠'), c(9, '♠'), c(5, '♠')]);
    const kq9 = evaluateHand([c(13, '♥'), c(12, '♥'), c(9, '♥')]);
    expect(a95.typeName).toBe('金花');
    expect(kq9.typeName).toBe('金花');
    expect(compareEval(a95, kq9)).toBeGreaterThan(0);
    // 最大牌相同则比第二张：A K 5 > A Q J
    const ak5 = evaluateHand([c(14, '♠'), c(13, '♠'), c(5, '♠')]);
    const aqj = evaluateHand([c(14, '♥'), c(12, '♥'), c(11, '♥')]);
    expect(compareEval(ak5, aqj)).toBeGreaterThan(0);
  });

  it('对子比较：先比对子点数，再比单牌（AA3 > KKQ，AAK > AAQ）', () => {
    const aa3 = evaluateHand([c(14, '♠'), c(14, '♥'), c(3, '♣')]);
    const kkq = evaluateHand([c(13, '♠'), c(13, '♥'), c(12, '♣')]);
    const aak = evaluateHand([c(14, '♠'), c(14, '♥'), c(13, '♣')]);
    const aaq = evaluateHand([c(14, '♠'), c(14, '♥'), c(12, '♣')]);
    expect(compareEval(aa3, kkq)).toBeGreaterThan(0);
    expect(compareEval(aak, aaq)).toBeGreaterThan(0);
  });

  it('散牌逐张比较：AJ8 > AT9', () => {
    const aj8 = evaluateHand([c(14, '♠'), c(11, '♥'), c(8, '♣')]);
    const at9 = evaluateHand([c(14, '♦'), c(10, '♥'), c(9, '♣')]);
    expect(compareEval(aj8, at9)).toBeGreaterThan(0);
  });

  it('compareHands 可直接比较两组三张牌', () => {
    const a = [c(5, '♠'), c(5, '♥'), c(5, '♦')];
    const b = [c(14, '♠'), c(13, '♠'), c(12, '♠')];
    expect(compareHands(a, b)).toBeGreaterThan(0); // 豹子5 > 同花顺QKA
  });
});

describe('findBestMagicCard（提示词第二十一节必测用例）', () => {
  it('5♠ + 7♥ → 想象6 → 顺子567（而不是对子557/577）', () => {
    const r = findBestMagicCard(c(5, '♠'), c(7, '♥'));
    expect(r.handTypeName).toBe('顺子');
    expect(r.magicCard.rank).toBe(6);
    expect(r.detail).toBe('顺子567');
  });

  it('5♠ + 7♠ → 想象6♠ → 同花顺567', () => {
    const r = findBestMagicCard(c(5, '♠'), c(7, '♠'));
    expect(r.handTypeName).toBe('同花顺');
    expect(r.magicCard.rank).toBe(6);
    expect(r.magicCard.suit).toBe('♠');
  });

  it('5♠ + 5♥ → 想象第三张5 → 豹子5', () => {
    const r = findBestMagicCard(c(5, '♠'), c(5, '♥'));
    expect(r.handTypeName).toBe('豹子');
    expect(r.magicCard.rank).toBe(5);
    expect(r.detail).toBe('豹子5');
  });

  it('A♠ + K♠ → 想象Q♠ → 同花顺QKA', () => {
    const r = findBestMagicCard(c(14, '♠'), c(13, '♠'));
    expect(r.handTypeName).toBe('同花顺');
    expect(r.magicCard.rank).toBe(12);
    expect(r.magicCard.suit).toBe('♠');
    expect(r.detail).toBe('同花顺QKA');
  });

  it('5♠ + 7♥ 不同花时无法同花顺，最优是普通顺子', () => {
    const r = findBestMagicCard(c(5, '♠'), c(7, '♥'));
    expect(r.handType).toBe(HAND_TYPES.SHUNZI); // 顺子，不是同花顺
  });

  it('返回结构包含全部要求字段', () => {
    const r = findBestMagicCard(c(5, '♠'), c(7, '♥'));
    expect(r.handCard).toBeDefined();
    expect(r.communityCard).toBeDefined();
    expect(r.magicCard).toBeDefined();
    expect(r.finalCards).toHaveLength(3);
    expect(r.handType).toBeGreaterThan(0);
    expect(r.handTypeName).toBeTruthy();
    expect(Array.isArray(r.compareValues)).toBe(true);
  });

  it('任意两张牌都能算出结果（想象牌不消耗牌堆、可重复）', () => {
    for (const h of fullDeck()) {
      for (const m of fullDeck()) {
        if (h.rank === m.rank && h.suit === m.suit) continue;
        const r = findBestMagicCard(h, m);
        expect(r.finalCards).toHaveLength(3);
      }
    }
  });
});

describe('70% 过关规则', () => {
  const mk = (wins: number, total: number) =>
    Array.from({ length: total }, (_, i) => ({
      name: `P${i + 1}`,
      dealerWin: i < wins,
      tie: false,
    }));

  it('7/10 = 70% → 过关', () => {
    expect(calculateDealerWinRate(mk(7, 10))).toBeCloseTo(0.7);
    expect(isDealerPassed(mk(7, 10))).toBe(true);
  });

  it('8/10 = 80% → 过关', () => {
    expect(isDealerPassed(mk(8, 10))).toBe(true);
  });

  it('6/10 = 60% → 不过关', () => {
    expect(isDealerPassed(mk(6, 10))).toBe(false);
  });

  it('不四舍五入：2/3 ≈ 66.7% → 不过关', () => {
    expect(isDealerPassed(mk(2, 3))).toBe(false);
  });

  it('恰好 0.7 → 过关', () => {
    expect(isDealerPassed(0.7)).toBe(true);
    expect(isDealerPassed(0.69999)).toBe(false);
  });
});

describe('发牌与牌堆消耗', () => {
  it('完整牌堆 52 张且无重复', () => {
    const d = fullDeck();
    expect(d).toHaveLength(52);
    expect(new Set(d.map((x) => `${x.rank}${x.suit}`)).size).toBe(52);
  });

  it('洗牌不改变牌的集合', () => {
    const d = fullDeck();
    const s = shuffle(d);
    expect(new Set(s.map((x) => `${x.rank}${x.suit}`)).size).toBe(52);
    expect(d).toHaveLength(52); // 原数组不变
  });

  it('10 名闲家每轮消耗 12 张实体牌（想象牌不消耗）', () => {
    const names = Array.from({ length: 10 }, (_, i) => `P${i + 1}`);
    const { remaining } = playRound(fullDeck(), names);
    expect(cardsNeeded(10)).toBe(12);
    expect(52 - remaining.length).toBe(12);
  });

  it('每轮：庄家1张 + 每闲家1张 + 公共底牌1张，全员共享同一底牌', () => {
    const { round } = playRound(fullDeck(), ['A', 'B', 'C']);
    expect(round.players).toHaveLength(3);
    for (const p of round.players) {
      expect(p.magic.communityCard).toEqual(round.community);
    }
    expect(round.dealer.magic.communityCard).toEqual(round.community);
  });

  it('canDealRound 正确判断牌堆是否足够', () => {
    expect(canDealRound(fullDeck().slice(0, 4), 3)).toBe(false); // 需要5张
    expect(canDealRound(fullDeck().slice(0, 5), 3)).toBe(true);
  });

  it('牌不够时 playRound 抛错（💥 挑战失败的触发条件）', () => {
    expect(() => playRound(fullDeck().slice(0, 3), ['A', 'B'])).toThrow();
  });

  it('平局不计入庄家胜利', () => {
    // 构造必平局：庄家与闲家手牌点数相同、共享底牌 → 最佳想象牌结果相同
    const deck = [c(5, '♠'), c(5, '♥'), c(9, '♣')]; // 庄家5♠ 闲家5♥ 底牌9♣
    const { round } = playRound(deck, ['P1']);
    expect(round.matches[0].tie).toBe(true);
    expect(round.dealerWins).toBe(0);
    expect(round.winRate).toBe(0);
  });

  it('庄闲结算严格按金花大于顺子：庄家金花击败闲家顺子', () => {
    // 庄家4♠ + 公共8♠ 可组成金花；闲家6♥ + 公共8♠ 最优为顺子678
    const deck = [c(4, '♠'), c(6, '♥'), c(8, '♠')];
    const { round } = playRound(deck, ['P1']);

    expect(round.dealer.magic.handType).toBe(HAND_TYPES.JINHUA);
    expect(round.players[0].magic.handType).toBe(HAND_TYPES.SHUNZI);
    expect(round.matches[0]).toEqual({
      name: 'P1',
      dealerWin: true,
      tie: false,
    });
  });
});

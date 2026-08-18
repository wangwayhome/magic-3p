// 一局游戏流程：发牌、庄家 VS 全体闲家、70% 过关判定

import { Card } from './cards';
import { compareEval } from './evaluate';
import { MagicResult, findBestMagicCard } from './magic';

export interface SeatResult {
  name: string;
  isDealer: boolean;
  handCard: Card;
  magic: MagicResult;
}

export interface MatchResult {
  name: string;
  /** 庄家是否获胜（严格大于才算赢，平局不算） */
  dealerWin: boolean;
  /** 是否平局（牌型完全相同） */
  tie: boolean;
}

export interface RoundData {
  community: Card;
  dealer: SeatResult;
  players: SeatResult[];
  matches: MatchResult[];
  dealerWins: number;
  losses: number;
  ties: number;
  total: number;
  /** 精确胜率（不做四舍五入） */
  winRate: number;
  passed: boolean;
}

/** 过关线：庄家胜率 >= 70% */
export const PASS_LINE = 0.7;

/** 可提前进入下一轮所需的最少已开闲家牌数（达到 70%，不足一人时向上取整） */
export function openedCardsNeeded(playerCount: number): number {
  return Math.ceil(playerCount * PASS_LINE);
}

/** 已开闲家牌是否达到可提前进入下一轮的门槛 */
export function hasOpenedEnough(
  openedCount: number,
  playerCount: number,
): boolean {
  return playerCount > 0 && openedCount >= openedCardsNeeded(playerCount);
}

/** 计算庄家胜率 = 庄家赢的局数 / 闲家总数 */
export function calculateDealerWinRate(results: MatchResult[]): number {
  if (results.length === 0) return 0;
  return results.filter((r) => r.dealerWin).length / results.length;
}

/** 判断庄家是否过关（胜率 >= 0.7，不做四舍五入） */
export function isDealerPassed(
  winRateOrResults: number | MatchResult[],
): boolean {
  const rate =
    typeof winRateOrResults === 'number'
      ? winRateOrResults
      : calculateDealerWinRate(winRateOrResults);
  return rate >= PASS_LINE;
}

/** 一轮需要消耗的实体牌：庄家1张 + 每闲家1张 + 公共底牌1张 */
export function cardsNeeded(playerCount: number): number {
  return playerCount + 2;
}

/** 剩余牌堆是否足够发下一轮 */
export function canDealRound(deck: Card[], playerCount: number): boolean {
  return deck.length >= cardsNeeded(playerCount);
}

/**
 * 进行一轮：
 * 1. 给庄家发 1 张手牌
 * 2. 给每名闲家发 1 张手牌
 * 3. 翻开 1 张公共底牌
 * 4. 所有人（含庄家）自动计算最佳想象牌
 * 5. 庄家分别和每名闲家比牌
 */
export function playRound(
  deck: Card[],
  playerNames: string[],
): { round: RoundData; remaining: Card[] } {
  if (!canDealRound(deck, playerNames.length)) {
    throw new Error(
      `牌堆剩余 ${deck.length} 张，不足以完成本轮发牌（需要 ${cardsNeeded(
        playerNames.length,
      )} 张）`,
    );
  }

  const d = [...deck];
  const dealerCard = d.shift()!;
  const playerCards = playerNames.map(() => d.shift()!);
  const community = d.shift()!;

  const dealer: SeatResult = {
    name: '庄家',
    isDealer: true,
    handCard: dealerCard,
    magic: findBestMagicCard(dealerCard, community),
  };

  const players: SeatResult[] = playerNames.map((name, i) => ({
    name,
    isDealer: false,
    handCard: playerCards[i],
    magic: findBestMagicCard(playerCards[i], community),
  }));

  // 闲家只和庄家比，闲家之间不互相比
  const matches: MatchResult[] = players.map((p) => {
    const cmp = compareEval(dealer.magic.eval, p.magic.eval);
    return { name: p.name, dealerWin: cmp > 0, tie: cmp === 0 };
  });

  const dealerWins = matches.filter((m) => m.dealerWin).length;
  const ties = matches.filter((m) => m.tie).length;
  const total = players.length;
  const winRate = calculateDealerWinRate(matches);

  return {
    round: {
      community,
      dealer,
      players,
      matches,
      dealerWins,
      ties,
      losses: total - dealerWins - ties,
      total,
      winRate,
      passed: isDealerPassed(winRate),
    },
    remaining: d,
  };
}

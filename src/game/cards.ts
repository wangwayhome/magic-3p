// 基础牌的定义与牌堆工具

export type Suit = '♠' | '♥' | '♣' | '♦';

export interface Card {
  /** 2-14：J=11, Q=12, K=13, A=14 */
  rank: number;
  suit: Suit;
}

export const SUITS: Suit[] = ['♠', '♥', '♣', '♦'];

/** 一副完整的 52 张牌 */
export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** Fisher-Yates 洗牌（不修改原数组） */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 点数显示：A K Q J 10 ... 2 */
export function rankLabel(rank: number): string {
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}

/** 例如 ♠5 */
export function cardLabel(card: Card): string {
  return `${card.suit}${rankLabel(card.rank)}`;
}

/** 是否红色花色（♥ / ♦） */
export function isRed(card: Card): boolean {
  return card.suit === '♥' || card.suit === '♦';
}

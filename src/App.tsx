import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Card, fullDeck, isRed, rankLabel, shuffle } from './game/cards';
import { MagicResult } from './game/magic';
import {
  PASS_LINE,
  RoundData,
  canDealRound,
  cardsNeeded,
  playRound,
} from './game/state';

const DEFAULT_NAMES = [
  'William',
  '小明',
  '阿豪',
  '老王',
  'Lily',
  '大壮',
  'Ken',
  '小雪',
  'Boss',
  '阿强',
];

/**
 * 单轮动画阶段：
 * deal      刚发牌（底牌未翻）
 * community 公共底牌翻开
 * dream     庄家开始做梦（庄家想象牌发光）
 * reveal    庄家想象牌揭晓
 * await     等待庄家逐个点开闲家手牌
 * result    全部开牌，显示结算
 */
type Stage = 'deal' | 'community' | 'dream' | 'reveal' | 'await' | 'result';

interface SeatVM {
  name: string;
  isDealer: boolean;
  handCard: Card;
  magic: MagicResult;
}

interface HistoryEntry {
  round: number;
  winRate: number;
  passed: boolean;
}

/* ---------- 扑克牌组件 ---------- */

function CardView(props: {
  card?: Card;
  size?: 'lg' | 'md' | 'sm';
  back?: boolean;
  glow?: boolean;
  flip?: boolean;
  dim?: boolean;
  label?: string;
}) {
  const { card, size = 'md', back, glow, flip, dim, label } = props;
  const cls = [
    'pcard',
    size,
    back || !card ? 'back' : 'face',
    glow ? 'glow' : '',
    flip ? 'flip-in' : '',
    dim ? 'dim' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="card-wrap">
      <div className={cls}>
        {back || !card ? (
          <div className="back-face">
            <span className="back-sparkle">✨</span>
            <span className="back-q">?</span>
          </div>
        ) : (
          <>
            <div className={`corner ${isRed(card) ? 'red' : 'black'}`}>
              {rankLabel(card.rank)}
              <br />
              {card.suit}
            </div>
            <div className={`center-suit ${isRed(card) ? 'red' : 'black'}`}>
              {card.suit}
            </div>
          </>
        )}
      </div>
      {label ? <div className="card-label">{label}</div> : null}
    </div>
  );
}

/* ---------- 座位组件 ---------- */

function SeatView(props: {
  seat: SeatVM;
  community: Card;
  communityShown: boolean;
  /** 手牌是否已翻开（闲家默认盖住，庄家点击才翻） */
  handRevealed: boolean;
  /** 想象牌是否已揭晓 */
  magicRevealed: boolean;
  /** 是否可点击开牌 */
  openable?: boolean;
  onOpen?: () => void;
  matchBadge?: 'dealer-win' | 'player-win' | 'tie';
}) {
  const {
    seat,
    community,
    communityShown,
    handRevealed,
    magicRevealed,
    openable,
    onOpen,
    matchBadge,
  } = props;

  const dreaming = handRevealed && !magicRevealed;
  const typeClass = `t${seat.magic.handType}`;

  return (
    <div
      className={[
        'seat',
        seat.isDealer ? 'dealer' : '',
        openable ? 'openable' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={openable ? onOpen : undefined}
    >
      <div className="seat-head">
        <span className="seat-name">
          {seat.isDealer ? '👑 ' : '🧙 '}
          {seat.name}
        </span>
        {magicRevealed && matchBadge && (
          <span className={`badge ${matchBadge}`}>
            {matchBadge === 'dealer-win'
              ? '庄家胜'
              : matchBadge === 'tie'
                ? '平局'
                : '玩家胜'}
          </span>
        )}
      </div>

      <div className="seat-cards">
        <CardView
          card={seat.handCard}
          size="md"
          back={!handRevealed}
          flip={handRevealed && !seat.isDealer}
          label="手牌"
        />
        <CardView
          card={community}
          size="md"
          back={!communityShown}
          dim
          label="底牌"
        />
        {handRevealed ? (
          <CardView
            card={seat.magic.magicCard}
            size="md"
            back={!magicRevealed}
            glow={dreaming}
            flip={magicRevealed}
            label="梦幻牌"
          />
        ) : (
          <CardView size="md" back dim label="梦幻牌" />
        )}
      </div>

      {dreaming && <div className="dreaming-text">正在做梦……</div>}

      {openable && (
        <div className="open-hint">👆 庄家点我开牌</div>
      )}

      {magicRevealed && (
        <div className="final-row">
          <span className="final-cards">
            {seat.magic.finalCards.map((c, i) => (
              <CardView key={i} card={c} size="sm" />
            ))}
          </span>
          <span className={`type-badge ${typeClass}`}>
            {seat.magic.handType >= 6 ? '✨✨✨ ' : '✨ '}
            {seat.magic.detail}
            {seat.magic.handType >= 6 ? ' ✨✨✨' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------- 主应用 ---------- */

export default function App() {
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup');
  const [stage, setStage] = useState<Stage>('deal');
  const [playerCount, setPlayerCount] = useState(4);
  const [names, setNames] = useState<string[]>([]);
  const [deck, setDeck] = useState<Card[]>([]);
  const [roundNum, setRoundNum] = useState(0);
  const [round, setRound] = useState<RoundData | null>(null);
  const [playerOpened, setPlayerOpened] = useState<boolean[]>([]);
  const [playerMagicShown, setPlayerMagicShown] = useState<boolean[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const timersRef = useRef<number[]>([]);
  const magicShownRef = useRef<boolean[]>([]);
  magicShownRef.current = playerMagicShown;

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  const recordRound = (r: RoundData, num: number) => {
    setHistory((h) =>
      h.some((x) => x.round === num)
        ? h
        : [...h, { round: num, winRate: r.winRate, passed: r.passed }],
    );
  };

  const dealNext = (currentDeck: Card[], ns: string[]) => {
    const { round: r, remaining } = playRound(currentDeck, ns);
    setDeck(remaining);
    setRound(r);
    setRoundNum((n) => n + 1);
    setPlayerOpened(ns.map(() => false));
    setPlayerMagicShown(ns.map(() => false));
    setStage('deal');
  };

  const startGame = (count: number) => {
    clearTimers();
    const ns = DEFAULT_NAMES.slice(0, count);
    const shuffled = shuffle(fullDeck());
    setNames(ns);
    setHistory([]);
    setRoundNum(0);
    setPhase('playing');
    dealNext(shuffled, ns);
  };

  const backHome = () => {
    clearTimers();
    setPhase('setup');
    setRound(null);
    setRoundNum(0);
    setHistory([]);
  };

  // 单轮动画时间轴（到庄家开牌为止，闲家由庄家手动点开）
  useEffect(() => {
    if (!round || phase !== 'playing' || roundNum === 0) return;
    clearTimers();
    const push = (fn: () => void, ms: number) =>
      timersRef.current.push(window.setTimeout(fn, ms));

    push(() => setStage('community'), 500);
    push(() => setStage('dream'), 1300);
    push(() => setStage('reveal'), 2300);
    push(() => setStage('await'), 2900);

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNum, phase]);

  const finishRound = () => {
    if (!round) return;
    setStage('result');
    recordRound(round, roundNum);
  };

  /** 某个闲家想象牌揭晓后，检查是否全员开完 */
  const afterMagicShown = (index: number) => {
    const arr = magicShownRef.current;
    const all = arr.length > 0 && arr.every(Boolean);
    if (all) {
      timersRef.current.push(window.setTimeout(finishRound, 700));
    }
    void index;
  };

  /** 庄家点开第 i 个闲家 */
  const openPlayer = (i: number) => {
    if (stage !== 'await' || !round) return;
    if (playerOpened[i]) return;
    setPlayerOpened((prev) => {
      const next = [...prev];
      next[i] = true;
      return next;
    });
    // 手牌翻开后稍作停顿，再做梦、揭晓想象牌
    timersRef.current.push(
      window.setTimeout(() => {
        setPlayerMagicShown((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
        afterMagicShown(i);
      }, 1000),
    );
  };

  /** 一键开全部（含跳过动画） */
  const openAll = () => {
    if (!round) return;
    clearTimers();
    setPlayerOpened(names.map(() => true));
    setPlayerMagicShown(names.map(() => true));
    finishRound();
  };

  /* ---------- 结算推导 ---------- */
  const showResult = stage === 'result' && !!round;
  const canContinue =
    showResult && round && !round.passed && canDealRound(deck, names.length);
  const terminalWin = showResult && round!.passed;
  const terminalLoss =
    showResult && !round!.passed && !canDealRound(deck, names.length);

  /* ---------- 首页 ---------- */
  if (phase === 'setup') {
    return (
      <div className="app">
        <div className="setup">
          <h1 className="title">✨ 魔法3P ✨</h1>
          <p className="tagline">
            每人只有 1 张手牌，桌上再开 1 张公共底牌，剩下第 3 张全靠想象；
            系统自动往最大的牌想。所有人只和庄家比，庄家赢够 70% 就过关！
            <br />
            🎴 闲家手牌全程盖住，由庄家逐个点开，翻开才见分晓。
          </p>
          <div className="rules-mini">
            牌型：豹子 &gt; 同花顺 &gt; 金花 &gt; 顺子 &gt; 对子 &gt; 散牌
            <br />
            <span className="rules-note">（注意：本游戏 金花 &gt; 顺子）</span>
          </div>

          <div className="setup-block">
            <div className="setup-label">闲家人数</div>
            <div className="count-picker">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  className={n === playerCount ? 'active' : ''}
                  onClick={() => setPlayerCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="setup-hint">
              每轮消耗实体牌：{playerCount} 张手牌 + 1 张公共底牌 ={' '}
              {cardsNeeded(playerCount)} 张（想象牌不耗牌堆）
            </div>
          </div>

          <button className="primary big" onClick={() => startGame(playerCount)}>
            🎴 开始做梦
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 游戏页 ---------- */
  if (!round) return null;

  const communityShown = stage !== 'deal';
  const dealerMagicRevealed =
    stage === 'reveal' || stage === 'await' || stage === 'result';
  const dealerDreaming = stage === 'dream';
  const openedCount = playerOpened.filter(Boolean).length;

  const badgeFor = (name: string): 'dealer-win' | 'player-win' | 'tie' => {
    const m = round.matches.find((x) => x.name === name);
    if (!m) return 'tie';
    if (m.dealerWin) return 'dealer-win';
    return m.tie ? 'tie' : 'player-win';
  };

  return (
    <div className="app">
      <header className="hud">
        <div className="hud-left">
          <span className="hud-title">✨ 魔法3P</span>
          <span className="hud-info">
            第 {roundNum} 轮 · 余牌 {deck.length}/52
          </span>
        </div>
        <div className="hud-right">
          {stage === 'await' && openedCount < names.length && (
            <button className="ghost" onClick={openAll}>
              全部开牌 ⏩
            </button>
          )}
          {stage !== 'result' && stage !== 'await' && (
            <button className="ghost" onClick={openAll}>
              跳过动画 ⏩
            </button>
          )}
          <button className="ghost" onClick={backHome}>
            返回首页
          </button>
        </div>
      </header>

      <div className="deck-bar">
        <div
          className="deck-fill"
          style={{ width: `${(deck.length / 52) * 100}%` }}
        />
      </div>

      {/* 公共底牌 */}
      <div className="community">
        <div className="community-title">🃏 公共底牌（全员共享）</div>
        <CardView
          card={round.community}
          size="lg"
          back={stage === 'deal'}
          flip={stage !== 'deal'}
        />
      </div>

      {/* 庄家 */}
      <SeatView
        seat={round.dealer}
        community={round.community}
        communityShown={communityShown}
        handRevealed
        magicRevealed={dealerMagicRevealed}
        matchBadge={undefined}
      />
      {dealerDreaming && (
        <div className="dreaming-text dealer-dream">庄家正在做梦……</div>
      )}

      {stage === 'await' && openedCount < names.length && (
        <div className="await-hint">
          👑 庄家有请：点开闲家的牌（已开 {openedCount}/{names.length}）
        </div>
      )}

      {/* 闲家 */}
      <div className="players-grid">
        {round.players.map((p, i) => (
          <SeatView
            key={p.name}
            seat={p}
            community={round.community}
            communityShown={communityShown}
            handRevealed={playerOpened[i] ?? false}
            magicRevealed={playerMagicShown[i] ?? false}
            openable={stage === 'await' && !(playerOpened[i] ?? false)}
            onOpen={() => openPlayer(i)}
            matchBadge={badgeFor(p.name)}
          />
        ))}
      </div>

      {/* 结算面板 */}
      {showResult && (
        <div className="result-panel">
          <h2>👑 庄家本轮战绩（第 {roundNum} 轮）</h2>
          <ul className="match-list">
            {round.matches.map((m) => (
              <li key={m.name} className={m.dealerWin ? 'win' : 'lose'}>
                VS {m.name} {m.dealerWin ? '✅' : m.tie ? '➖' : '❌'}
                {m.tie ? <span className="tie-note">（平局不计庄家赢）</span> : null}
              </li>
            ))}
          </ul>
          <div className="stats">
            胜：{round.dealerWins} 负：{round.losses}
            {round.ties > 0 ? ` 平：${round.ties}` : ''} · 胜率：
            {Math.round(round.winRate * 100)}%
          </div>

          {terminalWin && (
            <>
              <div className="big-verdict win">🏆 庄家过关！</div>
              <p className="verdict-sub">
                🎉 庄家挑战成功 —— 共 {roundNum} 轮过关，剩余 {deck.length} 张牌
              </p>
              <button className="primary big" onClick={backHome}>
                🔄 再来一局
              </button>
            </>
          )}

          {canContinue && (
            <>
              <div className="big-verdict">
                胜率 {Math.round(round.winRate * 100)}%，还差{' '}
                {Math.round((PASS_LINE - round.winRate) * 100)}%
              </div>
              <p className="verdict-sub">未达到 70%，庄家继续挑战！</p>
              <button className="primary big" onClick={() => dealNext(deck, names)}>
                💤 继续做梦
              </button>
              <p className="hint">
                剩余实体牌 {deck.length} 张，下一轮需要 {cardsNeeded(names.length)} 张
              </p>
            </>
          )}

          {terminalLoss && (
            <>
              <div className="big-verdict lose">💥 庄家挑战失败</div>
              <p className="verdict-sub">
                剩余实体牌不足以完成下一轮发牌（需要 {cardsNeeded(names.length)}{' '}
                张，仅剩 {deck.length} 张）
              </p>
              <button className="primary big" onClick={backHome}>
                🔄 再来一局
              </button>
            </>
          )}

          {history.length > 1 && (
            <div className="history">
              {history.map((h) => (
                <span key={h.round} className={`history-chip ${h.passed ? 'p' : 'f'}`}>
                  第{h.round}轮 {Math.round(h.winRate * 100)}%
                  {h.passed ? '✅' : '❌'}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect, useRef } from "react";

const PRESETS = {
  Easy: { size: 8, bombs: 10 },
  Medium: { size: 10, bombs: 15 },
  Hard: { size: 12, bombs: 20 },
};

type CellType = {
  index: number;
  isRevealed: boolean;
  isMine: boolean;
  neighborCount: number;
  isFlagged: boolean;
};

const generateBombs = (size: number, count: number): number[] => {
  const bombs: number[] = [];
  while (bombs.length < count) {
    const pos = Math.floor(Math.random() * size * size);
    if (!bombs.includes(pos)) bombs.push(pos);
  }
  return bombs;
};

const generateCells = (size: number, bombs: number[]): CellType[] => {
  const cells: CellType[] = [];
  for (let i = 0; i < size * size; i++) {
    cells.push({
      index: i,
      isRevealed: false,
      isMine: bombs.includes(i),
      neighborCount: 0,
      isFlagged: false,
    });
  }
  cells.forEach(cell => {
    if (cell.isMine) return;
    const r = Math.floor(cell.index / size);
    const c = cell.index % size;
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (bombs.includes(nr * size + nc)) count++;
        }
      }
    }
    cell.neighborCount = count;
  });
  return cells;
};

const MineSweeper: React.FC = () => {
  const [difficulty, setDifficulty] = useState<keyof typeof PRESETS>("Medium");
  const { size: BOARD_SIZE, bombs: BOMB_COUNT } = PRESETS[difficulty];

  const [cells, setCells] = useState<CellType[]>([]);
  const [gameEnded, setGameEnded] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [wins, setWins] = useState(0);
  const [time, setTime] = useState(0);
  const [points, setPoints] = useState(0);
  const [started, setStarted] = useState(false);
  const [mounted, setMounted] = useState(false);

  const timerRef = useRef<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<Record<string, number[]>>({});

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("msLeaderboard");
    if (stored) {
      try { setLeaderboard(JSON.parse(stored)); } catch {}
    }
    initGame();
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem("msLeaderboard", JSON.stringify(leaderboard));
  }, [leaderboard, mounted]);

  const initGame = (diff?: keyof typeof PRESETS) => {
    const d = diff || difficulty;
    setDifficulty(d);
    const { size, bombs } = PRESETS[d];
    const bPositions = generateBombs(size, bombs);
    setCells(generateCells(size, bPositions));
    setGameEnded(false);
    setTime(0);
    setStarted(false);
  };

  useEffect(() => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    if (started && !gameEnded) {
      timerRef.current = window.setInterval(() => {
        setTime(prev => {
          const nt = prev + 1;
          if (nt % 15 === 0) setPoints(p => p - 1);
          return nt;
        });
      }, 1000);
    }
    return () => { if (timerRef.current !== null) clearInterval(timerRef.current); };
  }, [started, gameEnded]);

  const revealEmpty = (arr: CellType[], idx: number): CellType[] => {
    const newCells = arr.map(c => ({ ...c }));
    const stack = [idx];
    while (stack.length) {
      const i = stack.pop()!;
      const cell = newCells[i];
      if (cell.isRevealed) continue;
      cell.isRevealed = true;
      cell.isFlagged = false;
      if (cell.neighborCount === 0) {
        const r = Math.floor(i / BOARD_SIZE);
        const c = i % BOARD_SIZE;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
              const ni = nr * BOARD_SIZE + nc;
              if (!newCells[ni].isRevealed) stack.push(ni);
            }
          }
        }
      }
    }
    return newCells;
  };

  const checkWin = (arr: CellType[]) => arr.every(c => c.isRevealed || c.isMine);

  const endGame = (won: boolean) => {
    setGameEnded(true);
    if (won) {
      const bonus = BOMB_COUNT * 10;
      setPoints(p => p + bonus);
      setWins(w => w + 1);
      alert(`You Won! +${bonus} bonus points.`);
    } else {
      const curr = points;
      const scores = leaderboard[difficulty] || [];
      const updated = [curr, ...scores].sort((a,b) => b - a).slice(0,5);
      setLeaderboard(lb => ({ ...lb, [difficulty]: updated }));
      alert("Game Over! Score recorded.");
      setPoints(0);
      setCells(arr => arr.map(c => ({ ...c, isRevealed: c.isMine || c.isRevealed })));
    }
  };

  const revealCell = (idx: number) => {
    if (gameEnded) return;
    if (!started) setStarted(true);
    const beforeCount = cells.filter(c => c.isRevealed).length;
    const cell = cells[idx];
    if (cell.isRevealed) return;
    if (cell.isMine) {
      endGame(false);
    } else {
      const updated = cell.neighborCount > 0
        ? cells.map(c => c.index === idx ? { ...c, isRevealed: true } : c)
        : revealEmpty(cells, idx);
      setCells(updated);
      const afterCount = updated.filter(c => c.isRevealed).length;
      setPoints(p => p + (afterCount - beforeCount));
      if (checkWin(updated)) endGame(true);
    }
  };

  const toggleFlag = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    if (gameEnded) return;
    if (!started) setStarted(true);
    setCells(arr => arr.map(c =>
      c.index === idx && !c.isRevealed ? { ...c, isFlagged: !c.isFlagged } : c
    ));
  };

  return (
    <div
      className="flex flex-col justify-center items-center p-8 min-h-screen"
      style={{ background: 'conic-gradient(from 180deg at 50% 50%, #ec4899, #8b5cf6, #6366f1, #ec4899)' }}
    >
      <h1 className="text-3xl font-bold mb-4">Minesweeper</h1>
      <div className="flex justify-center gap-2 mb-4">
        {Object.keys(PRESETS).map(diff => (
          <button
            key={diff}
            onClick={() => initGame(diff as keyof typeof PRESETS)}
            className={`px-3 py-1 rounded ${difficulty === diff ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}
          >{diff}</button>
        ))}
      </div>
      <div className="flex justify-center gap-2 mb-4">
        <button onClick={() => initGame()} className="px-4 py-2 bg-blue-500 text-white rounded">Restart</button>
        <button onClick={() => setShowRules(r => !r)} className="px-4 py-2 bg-gray-500 text-white rounded">
          {showRules ? 'Hide Rules' : 'Show Rules'}
        </button>
      </div>
      {showRules && (
        <div className="mb-4 p-4 bg-gray-100 rounded max-w-md text-left">
          <h2 className="font-semibold mb-2">Rules</h2>
          <ul className="list-disc list-inside">
            <li>Left-click to open a cell. Mine = Loss.</li>
            <li>Numbers show adjacent mines; 0 auto-opens neighbors.</li>
            <li>Right-click to flag/unflag. Flags can be cleared by opening.</li>
          </ul>
        </div>
      )}
      <div className="flex w-full justify-center items-center gap-8">
        <div className="w-1/4 text-center">
          <h2 className="font-semibold mb-2">Leaderboard ({difficulty})</h2>
          {mounted && (
            <ol className="list-decimal list-inside">
              {(leaderboard[difficulty] || []).map((score, i) => (
                <li key={i}>{score} pts</li>
              ))}
            </ol>
          )}
        </div>
        <div className="flex-1">
          <div className="mb-4">
            <span className="mr-4">Wins: {wins}</span>
            <span className="mr-4">Time: {Math.floor(time/60)}:{('0'+time%60).slice(-2)}</span>
            <span>Points: {points}</span>
          </div>
          <div className="inline-grid" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 40px)` }}>
            {cells.map(cell => (
              <div
                key={cell.index}
                onClick={() => revealCell(cell.index)}
                onContextMenu={e => toggleFlag(e, cell.index)}
                className={`w-10 h-10 border flex items-center justify-center cursor-pointer select-none ${cell.isRevealed ? 'bg-gray-200 text-black' : 'bg-gray-400'} ${cell.isMine && cell.isRevealed ? 'bg-red-500 text-white' : ''}`}
              >
                {cell.isRevealed ? (cell.isMine ? '💣' : cell.neighborCount || '') : (cell.isFlagged ? '🚩' : '')}
              </div>
            ))}
          </div>
          {gameEnded && <div className="mt-4 font-semibold text-xl">{checkWin(cells) ? 'You Won! 🎉' : 'Game Over 💥'}</div>}
        </div>
      </div>
    </div>
  );
};

export default MineSweeper;

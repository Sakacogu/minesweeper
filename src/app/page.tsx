"use client";

import React, { useEffect, useRef, useState } from "react";

const PRESETS = {
  Easy:   { size: 8,  bombs: 10 },
  Medium: { size: 10, bombs: 15 },
  Hard:   { size: 12, bombs: 20 },
} as const;

type CellType = {
  index: number;
  isRevealed: boolean;
  isMine: boolean;
  neighborCount: number;
  isFlagged: boolean;
};

type LBEntry = { name: string; score: number };

const generateBombs = (size: number, count: number) => {
  const bombs: number[] = [];
  while (bombs.length < count) {
    const p = Math.floor(Math.random() * size * size);
    if (!bombs.includes(p)) bombs.push(p);
  }
  return bombs;
};

const generateCells = (size: number, bombs: number[]) => {
  const cells: CellType[] = [];
  for (let i = 0; i < size * size; i++)
    cells.push({
      index: i,
      isRevealed: false,
      isMine: bombs.includes(i),
      neighborCount: 0,
      isFlagged: false,
    });

  cells.forEach((cell) => {
    if (cell.isMine) return;
    const r = Math.floor(cell.index / size);
    const c = cell.index % size;
    let cnt = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr,
          nc = c + dc;
        if (
          nr >= 0 &&
          nr < size &&
          nc >= 0 &&
          nc < size &&
          bombs.includes(nr * size + nc)
        )
          cnt++;
      }
    cell.neighborCount = cnt;
  });

  return cells;
};

const computeTile = (size: number) =>
  window.innerWidth < 740 ? Math.floor(320 / size) : Math.floor(480 / size);

const MineSweeper: React.FC = () => {
  const [difficulty, setDifficulty] = useState<keyof typeof PRESETS>("Medium");
  const [boardSize, setBoardSize]  = useState(PRESETS[difficulty].size);
  const [cells, setCells]          = useState<CellType[]>([]);
  const [wins, setWins]            = useState(0);
  const [time, setTime]            = useState(0);
  const [points, setPoints]        = useState(0);
  const [started, setStarted]      = useState(false);
  const [gameEnded, setGameEnded]  = useState(false);

  const [showRules, setShowRules]       = useState(false);
  const [tile, setTile]                 = useState(40);
  const [lbMobileOpen, setLbMobileOpen] = useState(false);
  const [username, setUsername]         = useState("");

  const timerRef           = useRef<number | null>(null);
  const [leaderboard, setLeaderboard]   = useState<Record<string, LBEntry[]>>(
    {}
  );
  const [hydrated, setHydrated]         = useState(false);

  useEffect(() => {
    const update = () => setTile(computeTile(boardSize));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [boardSize]);

  useEffect(() => {
    setHydrated(true);
    try {
      const storedLB = localStorage.getItem("msLeaderboard");
      if (storedLB) setLeaderboard(JSON.parse(storedLB));
      const storedName = localStorage.getItem("msUsername");
      if (storedName) setUsername(storedName);
    } catch {}
    initGame();
  }, []);

  useEffect(() => {
    if (hydrated)
      localStorage.setItem("msLeaderboard", JSON.stringify(leaderboard));
  }, [leaderboard, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem("msUsername", username);
  }, [username, hydrated]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (started && !gameEnded) {
      timerRef.current = window.setInterval(() => {
        setTime((t) => {
          const nt = t + 1;
          if (nt % 15 === 0) setPoints((p) => p - 1);
          return nt;
        });
      }, 1000);
    }
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [started, gameEnded]);

  const initGame = (diff?: keyof typeof PRESETS) => {
    const d = diff || difficulty;
    setDifficulty(d);
    const size = PRESETS[d].size;
    setBoardSize(size);
    setCells(generateCells(size, generateBombs(size, PRESETS[d].bombs)));
    setTime(0);
    setPoints(0);
    setStarted(false);
    setGameEnded(false);
    setLbMobileOpen(false);
  };

  const revealEmpty = (grid: CellType[], idx: number, size: number) => {
    const nc = grid.map((c) => ({ ...c }));
    const stack = [idx];
    while (stack.length) {
      const i = stack.pop()!;
      if (nc[i].isRevealed) continue;
      nc[i].isRevealed = true;
      nc[i].isFlagged  = false;

      if (nc[i].neighborCount === 0) {
        const r = Math.floor(i / size);
        const c = i % size;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc_ = c + dc;
            if (nr >= 0 && nr < size && nc_ >= 0 && nc_ < size) {
              const ni = nr * size + nc_;
              if (ni < nc.length && !nc[ni].isRevealed) stack.push(ni);
            }
          }
      }
    }
    return nc;
  };

  const checkWin = (arr: CellType[]) =>
    arr.every((c) => c.isRevealed || c.isMine);

  const endGame = (won: boolean) => {
    setGameEnded(true);
    const bonus = PRESETS[difficulty].bombs * 10;
    if (won) {
      setPoints((p) => p + bonus);
      setWins((w) => w + 1);
    } else {
      const entry: LBEntry = { name: username || "Anonymous", score: points };
      const scores  = leaderboard[difficulty] || [];
      const updated = [entry, ...scores]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      setLeaderboard((lb) => ({ ...lb, [difficulty]: updated }));
      setPoints(0);
      setCells((g) =>
        g.map((c) => ({ ...c, isRevealed: c.isMine || c.isRevealed }))
      );
    }
  };

  const revealCell = (idx: number) => {
    if (gameEnded) return;
    if (!started) setStarted(true);

    const cell = cells[idx];
    if (cell.isRevealed) return;

    if (cell.isMine) {
      endGame(false);
      return;
    }

    const before = cells.filter((c) => c.isRevealed).length;

    const updated =
      cell.neighborCount > 0
        ? cells.map((c) =>
            c.index === idx ? { ...c, isRevealed: true } : c
          )
        : revealEmpty(cells, idx, boardSize);

    setCells(updated);
    const after = updated.filter((c) => c.isRevealed).length;
    setPoints((p) => p + (after - before));

    if (checkWin(updated)) endGame(true);
  };

  const toggleFlag = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    if (gameEnded) return;
    if (!started) setStarted(true);
    setCells((g) =>
      g.map((c) =>
        c.index === idx && !c.isRevealed
          ? { ...c, isFlagged: !c.isFlagged }
          : c
      )
    );
  };

  return (
    <div
      className="flex flex-col items-center p-4 sm:p-8 min-h-screen"
      style={{
        background:
          "conic-gradient(from 180deg at 50% 50%, #ec4899, #8b5cf6, #6366f1, #ec4899)",
      }}
    >
      <h1 className="text-2xl sm:text-3xl font-bold mb-4">Minesweeper</h1>

      <div className="flex gap-2 flex-wrap justify-center mb-2">
        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((d) => (
          <button
            key={d}
            onClick={() => initGame(d)}
            className={`px-3 py-1 rounded ${
              difficulty === d
                ? "bg-green-500 text-white"
                : "bg-gray-500 text-white"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex gap-2 justify-center mb-4">
        <button
          onClick={() => initGame()}
          className="px-4 py-1 bg-blue-500 text-white rounded"
        >
          Restart
        </button>
        <button
          onClick={() => setShowRules((r) => !r)}
          className="px-4 py-1 bg-gray-500 text-white rounded"
        >
          {showRules ? "Hide Rules" : "Show Rules"}
        </button>
        <button
          className="lg:hidden px-4 py-1 bg-purple-600 text-white rounded"
          onClick={() => setLbMobileOpen((o) => !o)}
        >
          {lbMobileOpen ? "Hide Scores" : "Show Scores"}
        </button>
      </div>

      {showRules && (
        <div className="mb-4 p-4 bg-gray-900 text-white rounded max-w-md">
          <h2 className="font-semibold mb-2">Rules</h2>
          <ul className="list-disc list-inside text-sm sm:text-base">
            <li>Left‑click reveals a cell.</li>
            <li>Right‑click flags/unflags a suspected mine.</li>
            <li>Numbers show adjacent mines; blanks auto‑expand.</li>
          </ul>
        </div>
      )}

      <div className="relative w-full max-w-4xl">

        <div className="hidden lg:flex flex-col absolute right-0 items-end">
          <label className="text-sm mb-1 text-white self-start">Username</label>
          <input
            className="px-2 py-1 rounded border text-sm self-center"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="hidden lg:block absolute left-0">
          <h2 className="font-semibold mb-2">
            Leaderboard ({difficulty})
          </h2>
          <ol className="list-decimal list-inside text-sm">
            {(leaderboard[difficulty] || []).map((s, i) => (
              <li key={i}>
                {s.name} – {s.score} pts
              </li>
            ))}
          </ol>
        </div>

        {lbMobileOpen && (
          <div className="lg:hidden absolute left-1/2 -translate-x-1/2 z-10 bg-gray-800 text-white p-4 rounded shadow-lg w-64">
            <h2 className="font-semibold mb-2 text-center">Leaderboard</h2>
            <ol className="list-decimal list-inside text-sm mb-4">
              {(leaderboard[difficulty] || []).map((s, i) => (
                <li key={i}>
                  {s.name} – {s.score} pts
                </li>
              ))}
            </ol>
            <label className="text-sm mb-1 block">Your name</label>
            <input
              className="w-full px-2 py-1 rounded border text-sm text-black"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your name"
            />
          </div>
        )}

        <div className="mx-auto" style={{ width: boardSize * tile }}>
          <div className="mb-2 text-center flex justify-between text-xs sm:text-sm">
            <span>Wins: {wins}</span>
            <span>
              Time: {Math.floor(time / 60)}:{("0" + (time % 60)).slice(-2)}
            </span>
            <span>Points: {points}</span>
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${boardSize}, ${tile}px)`,
              gridTemplateRows: `repeat(${boardSize}, ${tile}px)`,
            }}
          >
            {cells.map((cell) => (
              <div
                key={cell.index}
                onClick={() => revealCell(cell.index)}
                onContextMenu={(e) => toggleFlag(e, cell.index)}
                className={`
                  border flex items-center justify-center select-none cursor-pointer
                  text-xs sm:text-base
                  ${
                    cell.isRevealed
                      ? "bg-gray-200 text-black"
                      : "bg-gray-400 text-black"
                  }
                  ${cell.isMine && cell.isRevealed ? "bg-red-500 text-white" : ""}
                `}
              >
                {cell.isRevealed
                  ? cell.isMine
                    ? "💣"
                    : cell.neighborCount || ""
                  : cell.isFlagged
                  ? "🚩"
                  : ""}
              </div>
            ))}
          </div>

          {gameEnded && (
            <div className="mt-4 text-center font-semibold">
              {checkWin(cells) ? "You Won! 🎉" : "Game Over 💥"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MineSweeper;

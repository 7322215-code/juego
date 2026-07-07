(() => {
  "use strict";

  /* ---------------- Config ---------------- */
  const GRID = 20;
  const CELL = 24; // 20 * 24 = 480, matches canvas size
  const BASE_INTERVAL = 130; // ms per step at start
  const MIN_INTERVAL = 70;
  const SPEEDUP_EVERY = 5; // foods eaten
  const SPEEDUP_STEP = 6; // ms faster each speedup
  const HS_KEY = "culebra-crt-highscore";

  /* ---------------- DOM ---------------- */
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const highscoreEl = document.getElementById("highscore");
  const overlay = document.getElementById("overlay");
  const bootTextEl = document.getElementById("boot-text");
  const titleEl = document.getElementById("title");
  const hintEl = document.getElementById("hint");
  const startBtn = document.getElementById("start-btn");
  const msgEl = document.getElementById("msg");
  const installBtn = document.getElementById("install-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const statusText = document.getElementById("status-text");

  /* ---------------- State ---------------- */
  let snake, dir, queuedDir, food, score, highscore, interval, lastStep, raf;
  let state = "boot"; // boot | idle | playing | paused | gameover

  highscore = parseInt(localStorage.getItem(HS_KEY) || "0", 10);
  highscoreEl.textContent = String(highscore).padStart(6, "0");

  function resetGame() {
    const mid = Math.floor(GRID / 2);
    snake = [
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
      { x: mid - 3, y: mid },
    ];
    dir = { x: 1, y: 0 };
    queuedDir = dir;
    score = 0;
    interval = BASE_INTERVAL;
    scoreEl.textContent = "000000";
    placeFood();
  }

  function placeFood() {
    let pos;
    do {
      pos = { x: randInt(GRID), y: randInt(GRID) };
    } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
    food = pos;
  }

  function randInt(max) {
    return Math.floor(Math.random() * max);
  }

  /* ---------------- Boot sequence ---------------- */
  const BOOT_LINES = [
    "> INICIANDO CULEBRA.EXE",
    "> CARGANDO NUCLEO GRAFICO... OK",
    "> MEMORIA FOSFORO... OK",
  ];

  function typeBoot(callback) {
    let lineIdx = 0;
    let charIdx = 0;
    bootTextEl.textContent = "";

    function tick() {
      if (lineIdx >= BOOT_LINES.length) {
        callback();
        return;
      }
      const line = BOOT_LINES[lineIdx];
      bootTextEl.textContent += line[charIdx];
      charIdx++;
      if (charIdx >= line.length) {
        bootTextEl.textContent += "\n";
        lineIdx++;
        charIdx = 0;
        setTimeout(tick, 140);
      } else {
        setTimeout(tick, 16);
      }
    }
    tick();
  }

  function showStartScreen() {
    state = "idle";
    titleEl.hidden = false;
    hintEl.hidden = false;
    startBtn.hidden = false;
    startBtn.textContent = "PRESS START";
    msgEl.hidden = true;
    overlay.hidden = false;
  }

  /* ---------------- Drawing ---------------- */
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // food (pulsing amber dot)
    const pulse = 2 + Math.sin(Date.now() / 180) * 2;
    ctx.fillStyle = "#ffb000";
    ctx.shadowColor = "#ffb000";
    ctx.shadowBlur = 12 + pulse;
    roundRect(
      food.x * CELL + 4,
      food.y * CELL + 4,
      CELL - 8,
      CELL - 8,
      6
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // snake
    snake.forEach((seg, i) => {
      const isHead = i === 0;
      ctx.fillStyle = isHead ? "#9fffc0" : "#39ff6a";
      ctx.shadowColor = "#39ff6a";
      ctx.shadowBlur = isHead ? 14 : 6;
      roundRect(seg.x * CELL + 2, seg.y * CELL + 2, CELL - 4, CELL - 4, 5);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // head eyes
    const head = snake[0];
    ctx.fillStyle = "#06120a";
    const ex = head.x * CELL;
    const ey = head.y * CELL;
    const r = 2;
    let eye1, eye2;
    if (dir.x === 1) { eye1 = [ex + 16, ey + 6]; eye2 = [ex + 16, ey + 16]; }
    else if (dir.x === -1) { eye1 = [ex + 6, ey + 6]; eye2 = [ex + 6, ey + 16]; }
    else if (dir.y === 1) { eye1 = [ex + 6, ey + 16]; eye2 = [ex + 16, ey + 16]; }
    else { eye1 = [ex + 6, ey + 6]; eye2 = [ex + 16, ey + 6]; }
    ctx.beginPath();
    ctx.arc(eye1[0], eye1[1], r, 0, Math.PI * 2);
    ctx.arc(eye2[0], eye2[1], r, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- Loop ---------------- */
  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (state !== "playing") {
      if (state !== "boot") draw();
      return;
    }
    if (ts - lastStep < interval) {
      draw();
      return;
    }
    lastStep = ts;
    step();
    draw();
  }

  function step() {
    dir = queuedDir;
    const head = snake[0];
    const next = { x: head.x + dir.x, y: head.y + dir.y };

    // wall collision
    if (next.x < 0 || next.x >= GRID || next.y < 0 || next.y >= GRID) {
      return gameOver();
    }
    // self collision
    if (snake.some((s) => s.x === next.x && s.y === next.y)) {
      return gameOver();
    }

    snake.unshift(next);

    if (next.x === food.x && next.y === food.y) {
      score += 10;
      scoreEl.textContent = String(score).padStart(6, "0");
      placeFood();
      const eaten = score / 10;
      if (eaten % SPEEDUP_EVERY === 0 && interval > MIN_INTERVAL) {
        interval = Math.max(MIN_INTERVAL, interval - SPEEDUP_STEP);
      }
    } else {
      snake.pop();
    }
  }

  function gameOver() {
    state = "gameover";
    if (score > highscore) {
      highscore = score;
      localStorage.setItem(HS_KEY, String(highscore));
      highscoreEl.textContent = String(highscore).padStart(6, "0");
    }
    titleEl.hidden = false;
    titleEl.innerHTML = 'FIN DE JUEGO<span class="blink">_</span>';
    hintEl.hidden = true;
    msgEl.hidden = false;
    msgEl.textContent = `PUNTAJE: ${score}`;
    startBtn.hidden = false;
    startBtn.textContent = "REINTENTAR";
    overlay.hidden = false;
  }

  function startGame() {
    bootTextEl.hidden = true;
    resetGame();
    overlay.hidden = true;
    state = "playing";
    lastStep = performance.now();
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      titleEl.hidden = false;
      titleEl.innerHTML = 'PAUSA<span class="blink">_</span>';
      hintEl.hidden = true;
      msgEl.hidden = true;
      startBtn.hidden = false;
      startBtn.textContent = "CONTINUAR";
      overlay.hidden = false;
    } else if (state === "paused") {
      overlay.hidden = true;
      state = "playing";
      lastStep = performance.now();
    }
  }

  /* ---------------- Input ---------------- */
  function setDirection(name) {
    const map = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const next = map[name];
    if (!next) return;
    // ignore reversals into own body
    if (snake.length > 1 && next.x === -dir.x && next.y === -dir.y) return;
    queuedDir = next;
  }

  const KEY_MAP = {
    ArrowUp: "up", w: "up", W: "up",
    ArrowDown: "down", s: "down", S: "down",
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
  };

  window.addEventListener("keydown", (e) => {
    if (KEY_MAP[e.key]) {
      e.preventDefault();
      if (state === "playing") setDirection(KEY_MAP[e.key]);
      else if (state === "idle" || state === "gameover") startGame();
    } else if (e.key === "p" || e.key === "P") {
      if (state === "playing" || state === "paused") togglePause();
    } else if (e.key === "r" || e.key === "R") {
      if (state !== "boot") startGame();
    } else if (e.key === " " || e.key === "Enter") {
      if (state === "idle" || state === "gameover") startGame();
      else if (state === "playing" || state === "paused") togglePause();
    }
  });

  startBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else startGame();
  });

  pauseBtn.addEventListener("click", () => {
    if (state === "playing" || state === "paused") togglePause();
  });

  document.querySelectorAll(".dpad-btn[data-dir]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state === "playing") setDirection(btn.dataset.dir);
    });
  });

  // swipe gestures on the game area
  let touchStart = null;
  const gameArea = document.querySelector(".game-area");
  gameArea.addEventListener(
    "touchstart",
    (e) => {
      const t = e.changedTouches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    },
    { passive: true }
  );
  gameArea.addEventListener(
    "touchend",
    (e) => {
      if (!touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) {
        // treat as a tap
        if (state === "idle" || state === "gameover") startGame();
        else if (state === "playing" || state === "paused") togglePause();
        touchStart = null;
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) {
        setDirection(dx > 0 ? "right" : "left");
      } else {
        setDirection(dy > 0 ? "down" : "up");
      }
      touchStart = null;
    },
    { passive: true }
  );

  /* ---------------- Boot ---------------- */
  resetGame();
  draw();
  typeBoot(() => {
    state = "boot-done";
    showStartScreen();
  });
  raf = requestAnimationFrame(loop);

  /* ---------------- PWA: service worker ---------------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        statusText.textContent = "MODO SIN CACHE";
      });
    });
  }

  /* ---------------- PWA: install prompt ---------------- */
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    installBtn.hidden = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });

  window.addEventListener("appinstalled", () => {
    installBtn.hidden = true;
  });
})();
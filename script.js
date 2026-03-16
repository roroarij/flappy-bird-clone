const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreNode = document.getElementById("score");
const bestScoreNode = document.getElementById("best-score");
const overlayNode = document.getElementById("overlay");
const startButton = document.getElementById("start-button");

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;
const GROUND_HEIGHT = 110;
const PIPE_WIDTH = 78;
const PIPE_GAP = 180;
const PIPE_SPACING = 240;
const PIPE_SPEED = 2.8;
const PIPE_INTERVAL_MS = 1450;
const GRAVITY = 0.42;
const FLAP_STRENGTH = -7.4;
const MAX_FALL_SPEED = 10;
const CLOUD_SPEED = 0.24;
const BIRD_X = 112;
const STORAGE_KEY = "flappy-best-score";

const gameState = {
  phase: "ready",
  bird: {
    x: BIRD_X,
    y: GAME_HEIGHT * 0.38,
    velocity: 0,
    radius: 18,
    rotation: 0
  },
  pipes: [],
  clouds: [],
  score: 0,
  bestScore: Number(localStorage.getItem(STORAGE_KEY) || 0),
  lastPipeAt: 0,
  lastFrameAt: 0
};

bestScoreNode.textContent = String(gameState.bestScore);

function resetGame() {
  gameState.phase = "ready";
  gameState.bird.y = GAME_HEIGHT * 0.38;
  gameState.bird.velocity = 0;
  gameState.bird.rotation = 0;
  gameState.pipes = [];
  gameState.clouds = buildClouds();
  gameState.score = 0;
  gameState.lastPipeAt = 0;
  scoreNode.textContent = "0";
  overlayNode.classList.remove("hidden");
  startButton.textContent = "Start Game";
}

function buildClouds() {
  return Array.from({ length: 5 }, (_, index) => ({
    x: 40 + index * 90,
    y: 70 + (index % 3) * 70,
    width: 54 + (index % 2) * 20,
    height: 24 + (index % 3) * 6
  }));
}

function startGame() {
  if (gameState.phase === "running") {
    flap();
    return;
  }

  resetGame();
  gameState.phase = "running";
  overlayNode.classList.add("hidden");
  flap();
}

function endGame() {
  gameState.phase = "gameover";
  startButton.textContent = "Play Again";
  overlayNode.classList.remove("hidden");
  if (gameState.score > gameState.bestScore) {
    gameState.bestScore = gameState.score;
    localStorage.setItem(STORAGE_KEY, String(gameState.bestScore));
    bestScoreNode.textContent = String(gameState.bestScore);
  }
}

function flap() {
  if (gameState.phase !== "running") {
    return;
  }

  gameState.bird.velocity = FLAP_STRENGTH;
}

function spawnPipe() {
  const minTop = 90;
  const maxTop = GAME_HEIGHT - GROUND_HEIGHT - PIPE_GAP - 120;
  const gapTop = minTop + Math.random() * (maxTop - minTop);

  gameState.pipes.push({
    x: GAME_WIDTH + PIPE_WIDTH,
    gapTop,
    scored: false
  });
}

function update(delta) {
  updateClouds(delta);

  if (gameState.phase !== "running") {
    floatBird(delta);
    return;
  }

  const frameScale = delta / 16.67;
  gameState.bird.velocity = Math.min(
    gameState.bird.velocity + GRAVITY * frameScale,
    MAX_FALL_SPEED
  );
  gameState.bird.y += gameState.bird.velocity * frameScale;
  gameState.bird.rotation = Math.min(1.1, gameState.bird.velocity / 10);

  if (gameState.lastPipeAt <= 0 || performance.now() - gameState.lastPipeAt > PIPE_INTERVAL_MS) {
    spawnPipe();
    gameState.lastPipeAt = performance.now();
  }

  for (const pipe of gameState.pipes) {
    pipe.x -= PIPE_SPEED * frameScale;

    if (!pipe.scored && pipe.x + PIPE_WIDTH < gameState.bird.x) {
      pipe.scored = true;
      gameState.score += 1;
      scoreNode.textContent = String(gameState.score);
    }
  }

  gameState.pipes = gameState.pipes.filter((pipe) => pipe.x + PIPE_WIDTH > -20);

  if (isCollision()) {
    endGame();
  }
}

function updateClouds(delta) {
  const shift = CLOUD_SPEED * (delta / 16.67);
  for (const cloud of gameState.clouds) {
    cloud.x -= shift;
    if (cloud.x + cloud.width < -20) {
      cloud.x = GAME_WIDTH + 30;
    }
  }
}

function floatBird(delta) {
  const time = performance.now() / 420;
  gameState.bird.y += Math.sin(time) * 0.12 * (delta / 16.67);
  gameState.bird.rotation = Math.sin(time * 0.8) * 0.08;
}

function isCollision() {
  const birdTop = gameState.bird.y - gameState.bird.radius;
  const birdBottom = gameState.bird.y + gameState.bird.radius;

  if (birdTop <= 0 || birdBottom >= GAME_HEIGHT - GROUND_HEIGHT) {
    return true;
  }

  return gameState.pipes.some((pipe) => {
    const withinPipeX =
      gameState.bird.x + gameState.bird.radius > pipe.x &&
      gameState.bird.x - gameState.bird.radius < pipe.x + PIPE_WIDTH;

    if (!withinPipeX) {
      return false;
    }

    return birdTop < pipe.gapTop || birdBottom > pipe.gapTop + PIPE_GAP;
  });
}

function draw() {
  drawSky();
  drawClouds();
  drawPipes();
  drawGround();
  drawBird();
}

function drawSky() {
  const skyGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  skyGradient.addColorStop(0, "#8fe2ff");
  skyGradient.addColorStop(0.6, "#bbf5ff");
  skyGradient.addColorStop(1, "#e3f8cb");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.fillStyle = "rgba(255, 244, 191, 0.95)";
  ctx.beginPath();
  ctx.arc(GAME_WIDTH - 72, 84, 30, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds() {
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  for (const cloud of gameState.clouds) {
    roundedRect(cloud.x, cloud.y, cloud.width, cloud.height, cloud.height / 2);
    roundedRect(
      cloud.x + cloud.width * 0.2,
      cloud.y - cloud.height * 0.45,
      cloud.width * 0.45,
      cloud.height * 0.9,
      cloud.height / 2
    );
    roundedRect(
      cloud.x + cloud.width * 0.5,
      cloud.y - cloud.height * 0.25,
      cloud.width * 0.36,
      cloud.height * 0.7,
      cloud.height / 2
    );
  }
}

function drawPipes() {
  for (const pipe of gameState.pipes) {
    drawPipe(pipe.x, 0, pipe.gapTop, true);
    drawPipe(
      pipe.x,
      pipe.gapTop + PIPE_GAP,
      GAME_HEIGHT - GROUND_HEIGHT - (pipe.gapTop + PIPE_GAP),
      false
    );
  }
}

function drawPipe(x, y, height, upsideDown) {
  ctx.save();
  if (upsideDown) {
    ctx.translate(0, y + height);
    ctx.scale(1, -1);
    y = 0;
  }

  const pipeGradient = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
  pipeGradient.addColorStop(0, "#2f9f43");
  pipeGradient.addColorStop(0.5, "#78d64b");
  pipeGradient.addColorStop(1, "#2f9f43");

  ctx.fillStyle = pipeGradient;
  ctx.fillRect(x, y, PIPE_WIDTH, height);

  ctx.fillStyle = "#1b6a2d";
  ctx.fillRect(x, y, 8, height);
  ctx.fillRect(x + PIPE_WIDTH - 8, y, 8, height);

  ctx.fillStyle = "#8ae35c";
  ctx.fillRect(x - 6, y + 24, PIPE_WIDTH + 12, 24);
  ctx.fillStyle = "#2f9f43";
  ctx.fillRect(x - 6, y + 40, PIPE_WIDTH + 12, 8);

  ctx.restore();
}

function drawGround() {
  ctx.fillStyle = "#c88f42";
  ctx.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);

  ctx.fillStyle = "#68bf52";
  ctx.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, 18);

  ctx.strokeStyle = "rgba(93, 63, 38, 0.35)";
  ctx.lineWidth = 4;
  for (let x = 0; x < GAME_WIDTH + 24; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, GAME_HEIGHT - 34);
    ctx.lineTo(x + 18, GAME_HEIGHT - 20);
    ctx.stroke();
  }
}

function drawBird() {
  const { x, y, radius, rotation } = gameState.bird;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  ctx.fillStyle = "#f4b942";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius + 6, radius, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff4d3";
  ctx.beginPath();
  ctx.ellipse(-4, 5, radius * 0.55, radius * 0.45, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f08a24";
  ctx.beginPath();
  ctx.moveTo(radius - 2, 2);
  ctx.lineTo(radius + 16, -2);
  ctx.lineTo(radius - 2, -8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(6, -7, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#183642";
  ctx.beginPath();
  ctx.arc(8, -7, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d9822b";
  ctx.beginPath();
  ctx.ellipse(-2, 2, 10, 6, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fill();
}

function frame(timestamp) {
  const delta = gameState.lastFrameAt ? timestamp - gameState.lastFrameAt : 16.67;
  gameState.lastFrameAt = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

function handleInput(event) {
  if (event.type === "keydown" && event.code !== "Space") {
    return;
  }

  event.preventDefault();

  if (gameState.phase === "ready" || gameState.phase === "gameover") {
    startGame();
    return;
  }

  flap();
}

document.addEventListener("keydown", handleInput);
canvas.addEventListener("pointerdown", handleInput);
startButton.addEventListener("click", startGame);

resetGame();
requestAnimationFrame(frame);

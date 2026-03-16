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
const MAX_TRIP_INTENSITY = 1;

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
  tripIntensity: 0,
  tripPulse: 0,
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
  gameState.tripIntensity = 0;
  gameState.tripPulse = 0;
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
  updateTrip(delta);

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
      triggerTrip();
      scoreNode.textContent = String(gameState.score);
    }
  }

  gameState.pipes = gameState.pipes.filter((pipe) => pipe.x + PIPE_WIDTH > -20);

  if (isCollision()) {
    endGame();
  }
}

function updateTrip(delta) {
  const frameScale = delta / 16.67;
  gameState.tripPulse = Math.max(0, gameState.tripPulse - 0.022 * frameScale);
}

function triggerTrip() {
  const scoreScale = Math.min(MAX_TRIP_INTENSITY, gameState.score / 12);
  gameState.tripIntensity = scoreScale;
  gameState.tripPulse = 1;
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
  const trip = getTripState();

  ctx.save();
  applyTripTransform(trip);
  drawSky(trip);
  drawClouds(trip);
  drawPipes(trip);
  drawGround(trip);
  drawBird(trip);
  drawHallucinations(trip);
  ctx.restore();
}

function getTripState() {
  const time = performance.now() / 1000;
  const pulse = gameState.tripPulse;
  const intensity = Math.min(MAX_TRIP_INTENSITY, gameState.tripIntensity + pulse * 0.4);
  return {
    time,
    pulse,
    intensity,
    hueShift: (gameState.score * 34 + time * 120) % 360,
    wobble: intensity * 14 + pulse * 20
  };
}

function applyTripTransform(trip) {
  const waveX = Math.sin(trip.time * 2.1) * trip.wobble;
  const waveY = Math.cos(trip.time * 1.4) * (trip.intensity * 9 + trip.pulse * 12);
  ctx.translate(GAME_WIDTH / 2 + waveX, GAME_HEIGHT / 2 + waveY);
  ctx.rotate(Math.sin(trip.time * 1.2) * trip.intensity * 0.08);
  ctx.scale(1 + trip.intensity * 0.06, 1 + trip.intensity * 0.04);
  ctx.translate(-GAME_WIDTH / 2, -GAME_HEIGHT / 2);
  ctx.filter = `hue-rotate(${trip.hueShift}deg) saturate(${1.1 + trip.intensity * 2.4}) contrast(${1.02 + trip.intensity * 0.28}) brightness(${1 + trip.pulse * 0.22})`;
}

function drawSky(trip) {
  const skyGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  skyGradient.addColorStop(0, `hsl(${(trip.hueShift + 210) % 360} 95% 72%)`);
  skyGradient.addColorStop(0.55, `hsl(${(trip.hueShift + 320) % 360} 100% 78%)`);
  skyGradient.addColorStop(1, `hsl(${(trip.hueShift + 90) % 360} 96% 72%)`);
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.fillStyle = `hsla(${(trip.hueShift + 40) % 360} 100% 78% / 0.95)`;
  ctx.beginPath();
  ctx.arc(
    GAME_WIDTH - 72 + Math.sin(trip.time * 2.6) * trip.wobble,
    84 + Math.cos(trip.time * 2.2) * trip.wobble,
    30 + trip.intensity * 10,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawClouds(trip) {
  for (const cloud of gameState.clouds) {
    ctx.fillStyle = `hsla(${(trip.hueShift + cloud.x) % 360} 100% 88% / 0.78)`;
    const driftY = Math.sin(trip.time * 3 + cloud.x / 50) * trip.wobble * 0.45;
    const widthWarp = 1 + Math.sin(trip.time * 2.5 + cloud.y / 40) * trip.intensity * 0.22;
    roundedRect(
      cloud.x,
      cloud.y + driftY,
      cloud.width * widthWarp,
      cloud.height,
      cloud.height / 2
    );
    roundedRect(
      cloud.x + cloud.width * 0.2,
      cloud.y - cloud.height * 0.45 + driftY,
      cloud.width * 0.45,
      cloud.height * 0.9,
      cloud.height / 2
    );
    roundedRect(
      cloud.x + cloud.width * 0.5,
      cloud.y - cloud.height * 0.25 + driftY,
      cloud.width * 0.36,
      cloud.height * 0.7,
      cloud.height / 2
    );
  }
}

function drawPipes(trip) {
  for (const pipe of gameState.pipes) {
    const warp = Math.sin(trip.time * 4 + pipe.x / 60) * trip.wobble;
    drawPipe(pipe.x + warp, 0, pipe.gapTop, true, trip, pipe.x);
    drawPipe(
      pipe.x - warp,
      pipe.gapTop + PIPE_GAP,
      GAME_HEIGHT - GROUND_HEIGHT - (pipe.gapTop + PIPE_GAP),
      false,
      trip,
      pipe.x
    );
  }
}

function drawPipe(x, y, height, upsideDown, trip, seed) {
  ctx.save();
  if (upsideDown) {
    ctx.translate(0, y + height);
    ctx.scale(1, -1);
    y = 0;
  }

  const pipeGradient = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
  pipeGradient.addColorStop(0, `hsl(${(trip.hueShift + seed / 2) % 360} 80% 38%)`);
  pipeGradient.addColorStop(0.5, `hsl(${(trip.hueShift + 100 + seed / 3) % 360} 95% 62%)`);
  pipeGradient.addColorStop(1, `hsl(${(trip.hueShift + 220 + seed / 2) % 360} 80% 38%)`);

  ctx.fillStyle = pipeGradient;
  ctx.fillRect(x, y, PIPE_WIDTH, height);

  ctx.fillStyle = `hsl(${(trip.hueShift + 160) % 360} 88% 22%)`;
  ctx.fillRect(x, y, 8, height);
  ctx.fillRect(x + PIPE_WIDTH - 8, y, 8, height);

  ctx.fillStyle = `hsl(${(trip.hueShift + 70) % 360} 100% 64%)`;
  ctx.fillRect(x - 6, y + 24, PIPE_WIDTH + 12, 24);
  ctx.fillStyle = `hsl(${(trip.hueShift + 300) % 360} 85% 42%)`;
  ctx.fillRect(x - 6, y + 40, PIPE_WIDTH + 12, 8);

  ctx.restore();
}

function drawGround(trip) {
  ctx.fillStyle = `hsl(${(trip.hueShift + 20) % 360} 85% 58%)`;
  ctx.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);

  ctx.fillStyle = `hsl(${(trip.hueShift + 140) % 360} 95% 58%)`;
  ctx.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, 18);

  ctx.strokeStyle = `hsla(${(trip.hueShift + 260) % 360} 90% 30% / 0.45)`;
  ctx.lineWidth = 4;
  for (let x = 0; x < GAME_WIDTH + 24; x += 26) {
    ctx.beginPath();
    const groove = Math.sin(trip.time * 6 + x / 18) * trip.wobble * 0.35;
    ctx.moveTo(x, GAME_HEIGHT - 34 + groove);
    ctx.lineTo(x + 18, GAME_HEIGHT - 20 - groove);
    ctx.stroke();
  }
}

function drawBird(trip) {
  const { x, y, radius, rotation } = gameState.bird;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation + Math.sin(trip.time * 8) * trip.intensity * 0.18);
  ctx.scale(1 + trip.pulse * 0.18, 1 - trip.pulse * 0.08);

  ctx.shadowColor = `hsla(${(trip.hueShift + 300) % 360} 100% 68% / 0.8)`;
  ctx.shadowBlur = 12 + trip.intensity * 26;

  ctx.fillStyle = `hsl(${(trip.hueShift + 30) % 360} 100% 60%)`;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius + 6, radius, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsl(${(trip.hueShift + 80) % 360} 100% 84%)`;
  ctx.beginPath();
  ctx.ellipse(-4, 5, radius * 0.55, radius * 0.45, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsl(${(trip.hueShift + 180) % 360} 100% 58%)`;
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

  ctx.fillStyle = `hsl(${(trip.hueShift + 260) % 360} 100% 20%)`;
  ctx.beginPath();
  ctx.arc(8, -7, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsl(${(trip.hueShift + 330) % 360} 90% 52%)`;
  ctx.beginPath();
  ctx.ellipse(-2, 2, 10, 6, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawHallucinations(trip) {
  if (trip.intensity <= 0.01) {
    return;
  }

  const orbCount = 4 + Math.floor(gameState.score / 2);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < orbCount; index += 1) {
    const angle = trip.time * (0.8 + index * 0.09) + index * 1.7;
    const orbit = 60 + index * 26 + trip.intensity * 90;
    const x = GAME_WIDTH / 2 + Math.cos(angle) * orbit;
    const y = GAME_HEIGHT / 2 + Math.sin(angle * 1.4) * orbit * 0.65;
    const radius = 14 + trip.intensity * 24 + (index % 3) * 8;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `hsla(${(trip.hueShift + index * 45) % 360} 100% 70% / 0.38)`);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
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

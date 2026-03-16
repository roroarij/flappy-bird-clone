const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreNode = document.getElementById("score");
const bestScoreNode = document.getElementById("best-score");
const overlayNode = document.getElementById("overlay");
const startButton = document.getElementById("start-button");
const sceneCanvas = document.createElement("canvas");
const sceneCtx = sceneCanvas.getContext("2d");

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

sceneCanvas.width = GAME_WIDTH;
sceneCanvas.height = GAME_HEIGHT;

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
  renderScene(sceneCtx, trip);
  renderTripComposite(trip);
}

function getTripState() {
  const time = performance.now() / 1000;
  const pulse = gameState.tripPulse;
  const intensity = Math.min(MAX_TRIP_INTENSITY, gameState.tripIntensity + pulse * 0.4);
  const mutation = Math.min(1, gameState.score / 10);
  const mutationStage = Math.min(4, Math.floor(gameState.score / 3));
  return {
    time,
    pulse,
    intensity,
    mutation,
    mutationStage,
    hueShift: (gameState.score * 34 + time * 120) % 360,
    wobble: intensity * 10 + pulse * 14,
    tunnel: intensity * 24 + pulse * 36,
    kaleidoscopeSides: 3 + Math.floor(intensity * 6)
  };
}

function renderScene(target, trip) {
  target.save();
  target.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  applyTripTransform(target, trip);
  drawSky(target, trip);
  drawClouds(target, trip);
  drawPipes(target, trip);
  drawGround(target, trip);
  drawBird(target, trip);
  drawHallucinations(target, trip);
  target.restore();
}

function renderTripComposite(trip) {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  if (trip.intensity < 0.12) {
    ctx.drawImage(sceneCanvas, 0, 0);
    return;
  }

  drawTrails(trip);
  drawMirageSlices(trip);

  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.drawImage(sceneCanvas, 0, 0);
  ctx.restore();

  drawTunnel(trip);
  drawKaleidoscopeBloom(trip);
}

function applyTripTransform(target, trip) {
  const waveX = Math.sin(trip.time * 1.8) * trip.wobble;
  const waveY = Math.cos(trip.time * 1.1) * (trip.intensity * 7 + trip.pulse * 9);
  target.translate(GAME_WIDTH / 2 + waveX, GAME_HEIGHT / 2 + waveY);
  target.rotate(Math.sin(trip.time * 0.9) * trip.intensity * 0.04);
  target.scale(1 + trip.intensity * 0.03, 1 + trip.intensity * 0.025);
  target.translate(-GAME_WIDTH / 2, -GAME_HEIGHT / 2);
  target.filter = `hue-rotate(${trip.hueShift}deg) saturate(${1.1 + trip.intensity * 2.6}) contrast(${1.02 + trip.intensity * 0.32}) brightness(${1 + trip.pulse * 0.24})`;
}

function drawSky(target, trip) {
  const skyGradient = target.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  skyGradient.addColorStop(0, `hsl(${(trip.hueShift + 210) % 360} 95% 72%)`);
  skyGradient.addColorStop(0.55, `hsl(${(trip.hueShift + 320) % 360} 100% 78%)`);
  skyGradient.addColorStop(1, `hsl(${(trip.hueShift + 90) % 360} 96% 72%)`);
  target.fillStyle = skyGradient;
  target.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  target.fillStyle = `hsla(${(trip.hueShift + 40) % 360} 100% 78% / 0.95)`;
  target.beginPath();
  target.arc(
    GAME_WIDTH - 72 + Math.sin(trip.time * 2.6) * trip.wobble,
    84 + Math.cos(trip.time * 2.2) * trip.wobble,
    30 + trip.intensity * 10,
    0,
    Math.PI * 2
  );
  target.fill();
}

function drawClouds(target, trip) {
  for (const cloud of gameState.clouds) {
    target.fillStyle = `hsla(${(trip.hueShift + cloud.x) % 360} 100% 88% / 0.78)`;
    const driftY = Math.sin(trip.time * 3 + cloud.x / 50) * trip.wobble * 0.45;
    const widthWarp = 1 + Math.sin(trip.time * 2.5 + cloud.y / 40) * trip.intensity * 0.22;
    roundedRect(
      target,
      cloud.x,
      cloud.y + driftY,
      cloud.width * widthWarp,
      cloud.height,
      cloud.height / 2
    );
    roundedRect(
      target,
      cloud.x + cloud.width * 0.2,
      cloud.y - cloud.height * 0.45 + driftY,
      cloud.width * 0.45,
      cloud.height * 0.9,
      cloud.height / 2
    );
    roundedRect(
      target,
      cloud.x + cloud.width * 0.5,
      cloud.y - cloud.height * 0.25 + driftY,
      cloud.width * 0.36,
      cloud.height * 0.7,
      cloud.height / 2
    );
  }
}

function drawPipes(target, trip) {
  for (const pipe of gameState.pipes) {
    const warp = Math.sin(trip.time * 2.8 + pipe.x / 60) * trip.wobble * 0.6;
    drawPipe(target, pipe.x + warp, 0, pipe.gapTop, true, trip, pipe.x);
    drawPipe(
      target,
      pipe.x - warp,
      pipe.gapTop + PIPE_GAP,
      GAME_HEIGHT - GROUND_HEIGHT - (pipe.gapTop + PIPE_GAP),
      false,
      trip,
      pipe.x
    );
  }
}

function drawPipe(target, x, y, height, upsideDown, trip, seed) {
  target.save();
  if (upsideDown) {
    target.translate(0, y + height);
    target.scale(1, -1);
    y = 0;
  }

  const pipeGradient = target.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
  pipeGradient.addColorStop(0, `hsl(${(trip.hueShift + seed / 2) % 360} 80% 38%)`);
  pipeGradient.addColorStop(0.5, `hsl(${(trip.hueShift + 100 + seed / 3) % 360} 95% 62%)`);
  pipeGradient.addColorStop(1, `hsl(${(trip.hueShift + 220 + seed / 2) % 360} 80% 38%)`);

  target.fillStyle = pipeGradient;
  target.fillRect(x, y, PIPE_WIDTH, height);

  target.fillStyle = `hsl(${(trip.hueShift + 160) % 360} 88% 22%)`;
  target.fillRect(x, y, 8, height);
  target.fillRect(x + PIPE_WIDTH - 8, y, 8, height);

  target.fillStyle = `hsl(${(trip.hueShift + 70) % 360} 100% 64%)`;
  target.fillRect(x - 6, y + 24, PIPE_WIDTH + 12, 24);
  target.fillStyle = `hsl(${(trip.hueShift + 300) % 360} 85% 42%)`;
  target.fillRect(x - 6, y + 40, PIPE_WIDTH + 12, 8);

  target.restore();
}

function drawGround(target, trip) {
  target.fillStyle = `hsl(${(trip.hueShift + 20) % 360} 85% 58%)`;
  target.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);

  target.fillStyle = `hsl(${(trip.hueShift + 140) % 360} 95% 58%)`;
  target.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, 18);

  target.strokeStyle = `hsla(${(trip.hueShift + 260) % 360} 90% 30% / 0.45)`;
  target.lineWidth = 4;
  for (let x = 0; x < GAME_WIDTH + 24; x += 26) {
    target.beginPath();
    const groove = Math.sin(trip.time * 6 + x / 18) * trip.wobble * 0.35;
    target.moveTo(x, GAME_HEIGHT - 34 + groove);
    target.lineTo(x + 18, GAME_HEIGHT - 20 - groove);
    target.stroke();
  }
}

function drawBird(target, trip) {
  const { x, y, radius, rotation } = gameState.bird;
  const morph = trip.mutation;
  const stage = trip.mutationStage;
  const bodyStretchX = 1 + Math.sin(trip.time * 5.5) * morph * 0.34 + trip.pulse * 0.18;
  const bodyStretchY = 1 + Math.cos(trip.time * 4.6) * morph * 0.24 - trip.pulse * 0.06;
  const eyeOffsetX = 6 + Math.sin(trip.time * 7.2) * morph * 10;
  const eyeOffsetY = -7 + Math.cos(trip.time * 6.4) * morph * 7;
  const beakLength = 16 + morph * 18 + Math.sin(trip.time * 8.5) * 6;
  const cheekRadiusX = 10 + morph * 8;
  const cheekRadiusY = 6 + morph * 5;

  target.save();
  target.translate(x, y);
  target.rotate(rotation + Math.sin(trip.time * 8) * trip.intensity * 0.18 + Math.sin(trip.time * 4.2) * morph * 0.16);
  target.scale(bodyStretchX, bodyStretchY);

  target.shadowColor = `hsla(${(trip.hueShift + 300) % 360} 100% 68% / 0.8)`;
  target.shadowBlur = 12 + trip.intensity * 26 + morph * 18;

  if (morph > 0.08) {
    drawBirdEchoes(target, trip, radius, morph);
  }

  if (stage >= 2) {
    drawBirdAura(target, trip, radius, morph, stage);
  }

  target.fillStyle = `hsl(${(trip.hueShift + 30) % 360} 100% 60%)`;
  target.beginPath();
  target.ellipse(0, 0, radius + 6 + morph * 8, radius + morph * 3, Math.sin(trip.time * 3.8) * morph * 0.4, 0, Math.PI * 2);
  target.fill();

  target.fillStyle = `hsl(${(trip.hueShift + 80) % 360} 100% 84%)`;
  target.beginPath();
  target.ellipse(-4 - morph * 3, 5 + morph * 2, radius * (0.55 + morph * 0.12), radius * (0.45 + morph * 0.1), -0.2 + Math.sin(trip.time * 4.8) * morph * 0.35, 0, Math.PI * 2);
  target.fill();

  target.fillStyle = `hsl(${(trip.hueShift + 180) % 360} 100% 58%)`;
  target.beginPath();
  target.moveTo(radius - 2 + morph * 2, 2 + morph * 4);
  target.lineTo(radius + beakLength, -2 - morph * 5);
  target.lineTo(radius - 2 + morph * 2, -8 - morph * 6);
  target.closePath();
  target.fill();

  target.fillStyle = "#ffffff";
  target.beginPath();
  target.arc(eyeOffsetX, eyeOffsetY, 7 + morph * 3, 0, Math.PI * 2);
  target.fill();

  target.fillStyle = `hsl(${(trip.hueShift + 260) % 360} 100% 20%)`;
  target.beginPath();
  target.arc(
    eyeOffsetX + 2 + Math.sin(trip.time * 9.4) * morph * 3,
    eyeOffsetY + Math.cos(trip.time * 8.6) * morph * 2,
    3 + morph * 1.5,
    0,
    Math.PI * 2
  );
  target.fill();

  if (stage >= 1) {
    drawBirdSecondaryEye(target, trip, morph, eyeOffsetX, eyeOffsetY);
  }

  target.fillStyle = `hsl(${(trip.hueShift + 330) % 360} 90% 52%)`;
  target.beginPath();
  target.ellipse(-2 - morph * 3, 2 + morph * 2, cheekRadiusX, cheekRadiusY, -0.4 + Math.sin(trip.time * 5.2) * morph * 0.6, 0, Math.PI * 2);
  target.fill();

  if (stage >= 3) {
    drawBirdTendrils(target, trip, radius, morph);
  }

  if (stage >= 4) {
    drawBirdHalo(target, trip, radius, morph);
  }

  if (morph > 0.22) {
    drawBirdCrest(target, trip, radius, morph);
  }

  target.restore();
}

function drawBirdEchoes(target, trip, radius, morph) {
  const echoCount = 2 + Math.floor(morph * 4);
  target.save();
  target.globalCompositeOperation = "screen";
  for (let index = 0; index < echoCount; index += 1) {
    const direction = index % 2 === 0 ? -1 : 1;
    const offsetX = direction * (8 + index * 6 + morph * 12);
    const offsetY = Math.sin(trip.time * 6 + index) * (4 + morph * 10);
    target.fillStyle = `hsla(${(trip.hueShift + index * 48) % 360} 100% 70% / ${0.12 + morph * 0.08})`;
    target.beginPath();
    target.ellipse(offsetX, offsetY, radius + 5 + morph * 6, radius * 0.78, trip.time * 0.8 + index, 0, Math.PI * 2);
    target.fill();
  }
  target.restore();
}

function drawBirdCrest(target, trip, radius, morph) {
  const crestCount = 3 + Math.floor(morph * 3);
  target.save();
  target.globalCompositeOperation = "screen";
  for (let index = 0; index < crestCount; index += 1) {
    const angle = -1.8 + index * (0.45 + morph * 0.08) + Math.sin(trip.time * 5.4 + index) * 0.08;
    const length = radius + 10 + morph * 20 + index * 4;
    const tipX = Math.cos(angle) * length;
    const tipY = Math.sin(angle) * length - 10;
    target.strokeStyle = `hsla(${(trip.hueShift + 210 + index * 34) % 360} 100% 72% / ${0.4 + morph * 0.2})`;
    target.lineWidth = 2 + morph * 3;
    target.beginPath();
    target.moveTo(-4, -8);
    target.quadraticCurveTo(tipX * 0.45, tipY * 0.45, tipX, tipY);
    target.stroke();
  }
  target.restore();
}

function drawBirdSecondaryEye(target, trip, morph, eyeOffsetX, eyeOffsetY) {
  const secondEyeX = eyeOffsetX - 12 - morph * 8 + Math.sin(trip.time * 6.6) * 4;
  const secondEyeY = eyeOffsetY + 8 + Math.cos(trip.time * 7.8) * 4;
  target.fillStyle = "rgba(255,255,255,0.9)";
  target.beginPath();
  target.arc(secondEyeX, secondEyeY, 4 + morph * 2.4, 0, Math.PI * 2);
  target.fill();

  target.fillStyle = `hsl(${(trip.hueShift + 220) % 360} 100% 18%)`;
  target.beginPath();
  target.arc(secondEyeX + 1, secondEyeY, 1.8 + morph, 0, Math.PI * 2);
  target.fill();
}

function drawBirdAura(target, trip, radius, morph, stage) {
  const ringCount = 1 + stage;
  target.save();
  target.globalCompositeOperation = "screen";
  for (let ring = 0; ring < ringCount; ring += 1) {
    const ringRadius = radius + 10 + ring * 8 + morph * 12;
    target.strokeStyle = `hsla(${(trip.hueShift + 40 + ring * 34) % 360} 100% 70% / ${0.16 + ring * 0.05})`;
    target.lineWidth = 1.5 + morph * 2;
    target.beginPath();
    target.ellipse(
      Math.sin(trip.time * 3 + ring) * morph * 5,
      Math.cos(trip.time * 2.4 + ring) * morph * 4,
      ringRadius,
      ringRadius * (0.6 + Math.sin(trip.time * 4 + ring) * 0.08),
      trip.time * 0.6 + ring,
      0,
      Math.PI * 2
    );
    target.stroke();
  }
  target.restore();
}

function drawBirdTendrils(target, trip, radius, morph) {
  const tendrilCount = 3 + Math.floor(morph * 3);
  target.save();
  target.globalCompositeOperation = "screen";
  for (let index = 0; index < tendrilCount; index += 1) {
    const startX = -radius * 0.3 + index * 4;
    const startY = radius * 0.4;
    const curl = Math.sin(trip.time * 4.8 + index) * (10 + morph * 12);
    const length = radius + 18 + index * 5;
    target.strokeStyle = `hsla(${(trip.hueShift + 300 + index * 25) % 360} 100% 68% / ${0.34 + morph * 0.16})`;
    target.lineWidth = 1.5 + morph * 2;
    target.beginPath();
    target.moveTo(startX, startY);
    target.bezierCurveTo(
      startX - 10,
      startY + length * 0.3,
      startX + curl,
      startY + length * 0.7,
      startX + curl * 0.6,
      startY + length
    );
    target.stroke();
  }
  target.restore();
}

function drawBirdHalo(target, trip, radius, morph) {
  target.save();
  target.globalCompositeOperation = "screen";
  const spikes = 10;
  for (let index = 0; index < spikes; index += 1) {
    const angle = (Math.PI * 2 * index) / spikes + trip.time * 0.8;
    const inner = radius + 18 + morph * 8;
    const outer = inner + 16 + Math.sin(trip.time * 7 + index) * 10;
    target.strokeStyle = `hsla(${(trip.hueShift + 120 + index * 18) % 360} 100% 72% / 0.42)`;
    target.lineWidth = 2;
    target.beginPath();
    target.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    target.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    target.stroke();
  }
  target.restore();
}

function drawHallucinations(target, trip) {
  if (trip.intensity <= 0.01) {
    return;
  }

  const orbCount = 4 + Math.floor(gameState.score / 2);
  target.save();
  target.globalCompositeOperation = "screen";
  for (let index = 0; index < orbCount; index += 1) {
    const angle = trip.time * (0.8 + index * 0.09) + index * 1.7;
    const orbit = 60 + index * 26 + trip.intensity * 90;
    const x = GAME_WIDTH / 2 + Math.cos(angle) * orbit;
    const y = GAME_HEIGHT / 2 + Math.sin(angle * 1.4) * orbit * 0.65;
    const radius = 14 + trip.intensity * 24 + (index % 3) * 8;
    const gradient = target.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `hsla(${(trip.hueShift + index * 45) % 360} 100% 70% / 0.38)`);
    gradient.addColorStop(1, "transparent");
    target.fillStyle = gradient;
    target.beginPath();
    target.arc(x, y, radius, 0, Math.PI * 2);
    target.fill();
  }
  target.restore();
}

function drawTrails(trip) {
  const layers = 2 + Math.floor(trip.intensity * 5);
  for (let index = 0; index < layers; index += 1) {
    const spread = (index + 1) * (2 + trip.intensity * 10);
    ctx.save();
    ctx.globalAlpha = 0.07 + trip.intensity * 0.08;
    ctx.filter = `blur(${2 + index * 2}px) hue-rotate(${trip.hueShift + index * 36}deg) saturate(${1.5 + trip.intensity * 2.2})`;
    ctx.drawImage(sceneCanvas, -spread, 0);
    ctx.drawImage(sceneCanvas, spread, 0);
    ctx.drawImage(sceneCanvas, 0, spread * 0.45);
    ctx.restore();
  }
}

function drawMirageSlices(trip) {
  if (trip.intensity < 0.22) {
    return;
  }

  const bands = 5 + Math.floor(trip.intensity * 12);
  const sliceHeight = GAME_HEIGHT / bands;
  for (let index = 0; index < bands; index += 1) {
    const offset = Math.sin(trip.time * 3.2 + index * 0.8) * (trip.tunnel * 0.6);
    ctx.save();
    ctx.globalAlpha = 0.12 + trip.intensity * 0.08;
    ctx.drawImage(
      sceneCanvas,
      0,
      index * sliceHeight,
      GAME_WIDTH,
      sliceHeight,
      offset,
      index * sliceHeight,
      GAME_WIDTH,
      sliceHeight
    );
    ctx.restore();
  }
}

function drawTunnel(trip) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let ring = 0; ring < 8; ring += 1) {
    const progress = ring / 8;
    const radius = 80 + progress * (120 + trip.tunnel * 3);
    const wobble = Math.sin(trip.time * 2.5 + ring) * trip.tunnel;
    ctx.strokeStyle = `hsla(${(trip.hueShift + ring * 32) % 360} 100% 65% / ${0.08 + progress * 0.1})`;
    ctx.lineWidth = 2 + trip.intensity * 6 * (1 - progress);
    ctx.beginPath();
    ctx.ellipse(
      GAME_WIDTH / 2 + Math.cos(trip.time * 1.4 + ring) * wobble * 0.2,
      GAME_HEIGHT / 2 + Math.sin(trip.time * 1.1 + ring) * wobble * 0.14,
      radius,
      radius * (0.45 + Math.sin(trip.time + ring) * 0.08),
      trip.time * 0.4 + ring,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawKaleidoscopeBloom(trip) {
  if (trip.intensity < 0.35) {
    return;
  }

  ctx.save();
  ctx.translate(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.08 + trip.intensity * 0.12;

  for (let side = 0; side < trip.kaleidoscopeSides; side += 1) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * side) / trip.kaleidoscopeSides + trip.time * 0.12);
    ctx.scale(1, 0.72 + trip.intensity * 0.18);
    ctx.drawImage(
      sceneCanvas,
      GAME_WIDTH * 0.2,
      GAME_HEIGHT * 0.15,
      GAME_WIDTH * 0.6,
      GAME_HEIGHT * 0.7,
      -GAME_WIDTH * 0.16,
      -GAME_HEIGHT * 0.22,
      GAME_WIDTH * 0.32,
      GAME_HEIGHT * 0.44
    );
    ctx.restore();
  }

  ctx.restore();
}

function roundedRect(target, x, y, width, height, radius) {
  target.beginPath();
  target.moveTo(x + radius, y);
  target.arcTo(x + width, y, x + width, y + height, radius);
  target.arcTo(x + width, y + height, x, y + height, radius);
  target.arcTo(x, y + height, x, y, radius);
  target.arcTo(x, y, x + width, y, radius);
  target.closePath();
  target.fill();
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

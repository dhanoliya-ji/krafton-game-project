console.log('Latency Arena — script loaded');

const wsUrl = 'ws://localhost:8080';
let ws = null;

const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');
const p1Score = document.getElementById('p1Score');
const p2Score = document.getElementById('p2Score');
const playersCount = document.getElementById('playersCount');
const coinCount = document.getElementById('coinCount');
const gameStateEl = document.getElementById('gameState');
const themeSwitch = document.getElementById('themeSwitch');

// Modal Elements
const gameOverModal = document.getElementById('gameOverModal');
const winnerText = document.getElementById('winnerText');
const closeModalBtn = document.getElementById('closeModalBtn');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let players = new Map();
let coins = [];
let isGameOver = false;
let particles = []; // For confetti

function log(msg){ console.log(`[System] ${msg}`); }

function connect(){
  if (ws && ws.readyState === WebSocket.OPEN) return;
  ws = new WebSocket(wsUrl);

  ws.onopen = ()=>{ 
    statusEl.textContent = 'Connected'; 
    statusEl.style.color = 'var(--success)';
  };
  
  ws.onmessage = ev=>{
    try{
      const data = JSON.parse(ev.data);
      if (data.type === 'PLAYER_JOINED' || data.type === 'SPECTATOR'){
        players = new Map(data.players.map(p=>[p.id,p]));
      } else if (data.type === 'GAME_STATE'){
        if(isGameOver) return; 
        players = new Map(data.players.map(p=>[p.id,p]));
        coins = data.coins || [];
        updateScores();
        coinCount.textContent = coins.length;
        gameStateEl.textContent = data.gameStatus;
        playersCount.textContent = data.players.length;
      } else if (data.type === 'GAME_START'){
        log('Match started');
        isGameOver = false;
        particles = []; 
        gameOverModal.classList.remove('active');
      } else if (data.type === 'GAME_OVER'){
        handleGameOver(data.winnerName);
      }
    }catch(e){ console.error('invalid msg',e); }
  };

  ws.onclose = ()=>{ 
    statusEl.textContent='Disconnected'; 
    statusEl.style.color = 'var(--danger)';
  };
  ws.onerror = e=>{ console.error(e); };
}

// --- CONFETTI SYSTEM ---
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 8 + 4;
    this.speedX = Math.random() * 6 - 3;
    this.speedY = Math.random() * -5 - 2; 
    this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    this.gravity = 0.2;
  }
  update() {
    this.y += this.speedY;
    this.x += this.speedX;
    this.speedY += this.gravity;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function spawnConfetti() {
  for (let i = 0; i < 100; i++) {
    particles.push(new Particle(canvas.width / 2, canvas.height / 2));
  }
}

function handleGameOver(winnerName) {
  isGameOver = true;
  spawnConfetti();
  winnerText.textContent = `${winnerName} Wins!`;
  gameOverModal.classList.add('active');
}

closeModalBtn.addEventListener('click', () => {
  gameOverModal.classList.remove('active');
});

startBtn.addEventListener('click', ()=>{
  if (!ws || ws.readyState !== WebSocket.OPEN) { connect(); return; }
  ws.send(JSON.stringify({type:'START_GAME',timestamp:Date.now()}));
  gameOverModal.classList.remove('active');
});

function updateScores(){
  const p1 = Array.from(players.values()).find(p=>p.name==='Player 1');
  const p2 = Array.from(players.values()).find(p=>p.name==='Player 2');
  if (p1) p1Score.textContent = String(p1.score||0).padStart(2,'0');
  if (p2) p2Score.textContent = String(p2.score||0).padStart(2,'0');
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  
  // 1. Draw Coins (Circles)
  for (let c of coins){
    ctx.beginPath();
    ctx.fillStyle = '#facc15'; // Gold Color
    ctx.arc(c.x, c.y, 10, 0, Math.PI * 2); // Radius 10
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Shine effect
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.arc(c.x - 3, c.y - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // 2. Draw Players (Cubes/Squares)
  for (let p of players.values()){
    const size = 40; 
    const x = p.x - (size/2);
    const y = p.y - (size/2);

    // Color based on player name/ID
    const isP2 = (p.name === 'Player 2');
    const color = isP2 ? '#ef4444' : '#3b82f6'; // Red or Blue

    ctx.save();
    
    // Shadow
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 12;

    // Draw Cube Body
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);

    // Draw Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, size, size);

    ctx.restore();

    // Name Tag
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-main');
    ctx.font = '600 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, p.x, p.y - 28);
  }

  // 3. Draw Confetti if Game Over
  if (isGameOver) {
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw(ctx);
    }
  }

  requestAnimationFrame(draw);
}

themeSwitch.addEventListener('click', ()=>{
  document.body.classList.toggle('light-theme');
  const isDark = !document.body.classList.contains('light-theme');
  themeSwitch.textContent = isDark ? 'Toggle Light Mode' : 'Toggle Dark Mode';
});

// Input handling
const keys = {};
document.addEventListener('keydown', e=>keys[e.key]=true);
document.addEventListener('keyup', e=>keys[e.key]=false);

let lastInput = 0; 
const RATE = 50;

function sendInput(){
  const now = Date.now();
  if (!ws || ws.readyState !== WebSocket.OPEN){ requestAnimationFrame(sendInput); return; }
  if (now - lastInput < RATE){ requestAnimationFrame(sendInput); return; }

  const p1 = Array.from(players.values()).find(p=>p.name==='Player 1');
  const p2 = Array.from(players.values()).find(p=>p.name==='Player 2');
  
  if (p1){ 
    let dx=0,dy=0; 
    if (keys['w']||keys['W']) dy-=1; 
    if (keys['s']||keys['S']) dy+=1; 
    if (keys['a']||keys['A']) dx-=1; 
    if (keys['d']||keys['D']) dx+=1; 
    if (dx||dy) ws.send(JSON.stringify({type:'INPUT',playerId:p1.id,direction:{dx,dy},timestamp:now})); 
  }
  if (p2){ 
    let dx=0,dy=0; 
    if (keys['ArrowUp']) dy-=1; 
    if (keys['ArrowDown']) dy+=1; 
    if (keys['ArrowLeft']) dx-=1; 
    if (keys['ArrowRight']) dx+=1; 
    if (dx||dy) ws.send(JSON.stringify({type:'INPUT',playerId:p2.id,direction:{dx,dy},timestamp:now})); 
  }

  lastInput = now; 
  requestAnimationFrame(sendInput);
}

connect();
draw();
sendInput();
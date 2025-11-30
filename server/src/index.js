const WebSocket = require('ws');

const PORT = 8080;
const LATENCY_MS = 200; // Assignment requirement

// Playfield size must match canvas in client (now 960x520)
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 520;
const PLAYER_RADIUS = 18; // match client drawing radius

// Message queues for latency simulation
const outgoingQueues = new Map(); // ws -> [{message, sendAt}]

const wss = new WebSocket.Server({ port: PORT });

console.log(`WebSocket server running on ws://localhost:${PORT} (with ${LATENCY_MS}ms latency)`);

// Process outgoing message queues (latency simulation)
setInterval(() => {
  const now = Date.now();
  for (let [ws, queue] of outgoingQueues) {
    if (ws.readyState === WebSocket.OPEN) {
      queue = queue.filter(item => {
        if (item.sendAt <= now) {
          try { ws.send(JSON.stringify(item.message)); } catch (e) { /* ignore send errors */ }
          return false;
        }
        return true;
      });
      if (queue.length === 0) {
        outgoingQueues.delete(ws);
      } else {
        outgoingQueues.set(ws, queue);
      }
    }
  }
}, 10);

// Game State Management
let gameState = {
  players: new Map(),
  coins: [],
  gameStatus: 'WAITING',
  lastTick: Date.now()
};

// Player colors
const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

function randomPosition() {
  return {
    x: PLAYER_RADIUS + Math.random() * (CANVAS_WIDTH - 2 * PLAYER_RADIUS),
    y: PLAYER_RADIUS + Math.random() * (CANVAS_HEIGHT - 2 * PLAYER_RADIUS)
  };
}

function generateId() {
  return 'id_' + Math.random().toString(36).substr(2, 9);
}

// Reset game state but keep players
function resetGame() {
  gameState.coins = [];
  gameState.gameStatus = 'WAITING';
  gameState.lastTick = Date.now();
  for (const p of gameState.players.values()) {
    p.score = 0;
    // positions recalculated for 960x520 playfield (same relative positions as before)
    p.x = p.name === 'Player 1' ? Math.round(0.3125 * CANVAS_WIDTH) : Math.round(0.6875 * CANVAS_WIDTH);
    p.y = Math.round(0.55 * CANVAS_HEIGHT);
  }
  console.log('Game reset, waiting for START');
}

function checkStartGame() {
  if (gameState.players.size >= 2 && gameState.gameStatus === 'WAITING') {
    gameState.gameStatus = 'PLAYING';
    console.log('🎮 GAME STARTED!');

    const startMsg = { type: 'GAME_START', timestamp: Date.now() };
    for (let [ws] of outgoingQueues) {
      if (ws.readyState === WebSocket.OPEN) {
        const queue = outgoingQueues.get(ws) || [];
        queue.push({ message: startMsg, sendAt: Date.now() + LATENCY_MS });
        outgoingQueues.set(ws, queue);
      }
    }
  }
}

// Coin spawning
setInterval(() => {
  if (gameState.gameStatus !== 'PLAYING') return;
  if (gameState.coins.length >= 5) return;

  const coinId = generateId();
  const coinPos = randomPosition();
  gameState.coins.push({ id: coinId, x: coinPos.x, y: coinPos.y });
  console.log(`🪙 Coin spawned: ${coinId} at (${Math.round(coinPos.x)}, ${Math.round(coinPos.y)})`);
}, 1000);

// Game loop - broadcast state
setInterval(() => {
  if (gameState.players.size > 0) {
    const gameStateSnapshot = {
      type: 'GAME_STATE',
      players: Array.from(gameState.players.values()),
      coins: gameState.coins,
      gameStatus: gameState.gameStatus,
      timestamp: Date.now()
    };

    for (let [ws] of outgoingQueues) {
      if (ws.readyState === WebSocket.OPEN) {
        const queue = outgoingQueues.get(ws) || [];
        queue.push({ message: gameStateSnapshot, sendAt: Date.now() + LATENCY_MS });
        outgoingQueues.set(ws, queue);
      }
    }
  }
}, 50);

// Track if we already created the two players for the first connection
let primaryConnection = null;

wss.on('connection', (ws) => {
  console.log('New client connected');
  outgoingQueues.set(ws, []);

  if (!primaryConnection) {
    primaryConnection = ws;

    const p1Id = generateId();
    const p1Color = colors[0];
    const player1 = {
      id: p1Id,
      x: Math.round(0.3125 * CANVAS_WIDTH), // ~300 for 960 width
      y: Math.round(0.55 * CANVAS_HEIGHT),  // ~286 for 520 height
      score: 0,
      color: p1Color,
      name: 'Player 1'
    };

    const p2Id = generateId();
    const p2Color = colors[1];
    const player2 = {
      id: p2Id,
      x: Math.round(0.6875 * CANVAS_WIDTH), // ~660 for 960 width
      y: Math.round(0.55 * CANVAS_HEIGHT),
      score: 0,
      color: p2Color,
      name: 'Player 2'
    };

    gameState.players.set(p1Id, player1);
    gameState.players.set(p2Id, player2);
    console.log(`Created Player 1 (${p1Id}) and Player 2 (${p2Id}) for primary connection`);

    const welcomeMsg = {
      type: 'PLAYER_JOINED',
      player: player1,
      players: Array.from(gameState.players.values())
    };
    const queue = outgoingQueues.get(ws) || [];
    queue.push({ message: welcomeMsg, sendAt: Date.now() + LATENCY_MS });
    outgoingQueues.set(ws, queue);
  } else {
    const spectatorMsg = {
      type: 'SPECTATOR',
      players: Array.from(gameState.players.values())
    };
    const queue = outgoingQueues.get(ws) || [];
    queue.push({ message: spectatorMsg, sendAt: Date.now() + LATENCY_MS });
    outgoingQueues.set(ws, queue);
    console.log('Additional client connected as spectator');
  }

  ws.on('message', (message) => {
    setTimeout(() => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received from client (after 200ms latency):', JSON.stringify(data));

        // START / RESTART from client bar
        if (data.type === 'START_GAME') {
          resetGame();
          checkStartGame();
          return;
        }

        if (data.type === 'INPUT' && data.playerId) {
          const player = gameState.players.get(data.playerId);
          if (player && gameState.gameStatus === 'PLAYING') {
            const speed = 5;

            player.x += data.direction.dx * speed;
            player.y += data.direction.dy * speed;

            // Clamp to canvas bounds
            player.x = Math.max(PLAYER_RADIUS, Math.min(CANVAS_WIDTH - PLAYER_RADIUS, player.x));
            player.y = Math.max(PLAYER_RADIUS, Math.min(CANVAS_HEIGHT - PLAYER_RADIUS, player.y));

            // Coin collision + score + win
            const coinRadius = 10;
            const collisionThreshold = PLAYER_RADIUS + coinRadius; // 28 for current values
            for (let i = gameState.coins.length - 1; i >= 0; i--) {
              const coin = gameState.coins[i];
              const dist = Math.sqrt(
                Math.pow(player.x - coin.x, 2) +
                Math.pow(player.y - coin.y, 2)
              );

              if (dist < collisionThreshold) {
                player.score += 10;
                gameState.coins.splice(i, 1);
                console.log(`Player ${player.name} collected coin ${coin.id}! Score: ${player.score}`);

                if (player.score >= 100 && gameState.gameStatus === 'PLAYING') {
                  gameState.gameStatus = 'FINISHED';

                  const gameOverMsg = {
                    type: 'GAME_OVER',
                    winnerId: player.id,
                    winnerName: player.name,
                    finalScores: Array.from(gameState.players.values()).map(p => ({
                      id: p.id,
                      name: p.name,
                      score: p.score
                    })),
                    timestamp: Date.now()
                  };

                  console.log(`GAME OVER! Winner: ${player.name} with ${player.score} points`);

                  for (let [clientWs] of outgoingQueues) {
                    if (clientWs.readyState === WebSocket.OPEN) {
                      const q = outgoingQueues.get(clientWs) || [];
                      q.push({ message: gameOverMsg, sendAt: Date.now() + LATENCY_MS });
                      outgoingQueues.set(clientWs, q);
                    }
                  }
                }
              }
            }

            console.log(`Player ${player.name} moved to (${Math.round(player.x)}, ${Math.round(player.y)})`);
          }
        }
      } catch (e) {
        console.error('Invalid message:', message.toString());
      }
    }, LATENCY_MS);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    outgoingQueues.delete(ws);

    if (ws === primaryConnection) {
      primaryConnection = null;
      gameState.players.clear();
      gameState.coins = [];
      gameState.gameStatus = 'WAITING';
      console.log('Primary connection closed, game reset');
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

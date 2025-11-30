# Latency Arena

**Latency Arena** is a minimalist real-time multiplayer arcade game where two players compete to collect coins in a responsive arena. The game features live synchronization via WebSockets, smooth canvas rendering, and a polished UI with theme support.

## 🎮 How to Play

### Objective
The goal is simple: Navigate the arena and collect **Coins** (Yellow Circles). The first player to reach **100 Coins** wins the match!

### Controls

| Player | Movement Keys | Color |
| :--- | :--- | :--- |
| **Player 1** | `W` `A` `S` `D` | 🔵 Blue Cube |
| **Player 2** | `↑` `↓` `←` `→` | 🔴 Red Cube |

* **Start Game:** Click the "Start Round" button in the top bar to begin synchronization.
* **Theme:** Use the "Toggle Light/Dark Mode" button in the right sidebar to switch visual themes.

## ✨ Features

* **Real-Time Multiplayer:** Player positions and coin spawns are synced instantly via WebSockets.
* **Responsive Arena:** The game canvas scales to fit different screen sizes while maintaining the aspect ratio.
* **Visual Feedback:**
    * Smooth rendering loop using HTML5 Canvas.
    * Dynamic confetti celebration effect upon victory.
    * Clean, minimalist "Dashboard" UI design.
* **Victory System:** Custom overlay modal announces the winner without interrupting the browser experience.

## 🛠️ Installation & Setup

### Prerequisites
1.  A modern web browser (Chrome, Firefox, Edge).
2.  A WebSocket backend server running on `localhost:8080`.

### Running the Server
1.  Go to the server directory.
2.  Run the command:
    ```bash
    npm start
    ```

### Running the Client
1.  Clone or download this repository.
2.  Ensure your backend server is running and listening on `ws://localhost:8080`.
    * *Note: This client expects the server to handle events like `PLAYER_JOINED`, `GAME_STATE`, and `GAME_OVER`.*
3.  Open `index.html` in your web browser.
4.  If the server is active, you will see the status change to **Connected**.

## 📂 Project Structure

* **`index.html`**: The main entry point containing the game layout, scoreboard, and UI containers.
* **`styles.css`**: Contains all styling variables, grid layouts, responsive rules, and theme definitions (Dark/Light mode).
* **`src/main.js`**: Handles the core game logic:
    * WebSocket connection and event handling.
    * Canvas rendering loop (`requestAnimationFrame`).
    * Input handling (keyboard listeners).
    * Particle system for victory confetti.

## ⚙️ Customization

* **Game Speed/Rate:** Adjusted in `main.js` via the `RATE` constant (default 50ms input throttling).
* **Colors & Themes:** Edit the CSS variables in `styles.css` under `:root` and `body.light-theme` to change the palette.
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const messageBox = document.getElementById('message');
const finalScoreDisplay = document.getElementById('final-score');
const liveScoreDisplay = document.getElementById('live-score');
const settingsMenu = document.getElementById('settings-menu');
const settingsBtn = document.getElementById('settings-btn');

// Game Constants
const TILE_SIZE = 20; // Size of each grid square in pixels
let GRID_SIZE; // Calculated dynamically based on canvas size

// CONFIGURABLE SETTINGS (Defaults)
let GAME_SPEED_MS = 150; 
let ACCENT_COLOR = '#00ff00';      // Default Green Accent
let SNAKE_BODY_COLOR = '#00cc00';  // Default Darker Green Body
let FOOD_COLOR = '#ff4d4d';        // Default Red Food
const BIG_FOOD_COLOR = '#ffff00'; // Big food color remains constant

// NEW CONSTANTS for Big Food
const BIG_FOOD_SCORE = 20;
const BIG_FOOD_DURATION = 5000; // 5 seconds in milliseconds

// Game State Variables
let snake;
let food;
let bigFood = null; // Position of the special bonus food
let bigFoodTimeoutId = null; // Timer ID to make big food disappear
let scoreTarget = 100; // Next score threshold for special food spawn

let dx; 
let dy;      
let score = 0;
let gameInterval;
let isGameOver = false;
let changingDirection = false; 

// --- Utility Functions ---

/** Utility to adjust a hex color (used for dynamic shadow) */
function adjustColor(hex, amount) {
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);

    R = Math.min(255, Math.max(0, R + amount));
    G = Math.min(255, Math.max(0, G + amount));
    B = Math.min(255, Math.max(0, B + amount));

    const RR = ((R.toString(16).length == 1) ? "0" + R.toString(16) : R.toString(16));
    const GG = ((G.toString(16).length == 1) ? "0" + G.toString(16) : G.toString(16));
    const BB = ((B.toString(16).length == 1) ? "0" + B.toString(16) : B.toString(16));

    return "#" + RR + GG + BB;
}

function resizeCanvas() {
    // Find the minimum of the entire viewport width and height to maintain a square canvas
    let targetSide = Math.min(window.innerWidth, window.innerHeight);

    // Ensure the canvas size is a clean multiple of TILE_SIZE (20)
    let newSide = Math.floor(targetSide / TILE_SIZE) * TILE_SIZE;

    // Ensure a minimum size for playability
    newSide = Math.max(300, newSide); 

    // Apply new dimensions to the canvas element
    canvas.width = newSide;
    canvas.height = newSide;
    
    // Update the global GRID_SIZE variable
    GRID_SIZE = canvas.width / TILE_SIZE;
    
    // Dynamically center the message box to cover the entire canvas
    messageBox.style.width = `${canvas.width}px`;
    messageBox.style.height = `${canvas.height}px`;
    messageBox.style.top = `50%`;
    messageBox.style.left = `50%`;
    messageBox.style.transform = 'translate(-50%, -50%)';
}

// --- Settings Management & UI Color Updates ---

function toggleSettingsMenu() {
    // Hide game over if settings is opened
    messageBox.classList.remove('active'); 
    settingsMenu.classList.toggle('hidden');
}

/**
 * Applies the current color variables to all relevant UI elements (Score, Buttons).
 */
function applyColorsToUI() {
    // Live Score
    liveScoreDisplay.style.color = ACCENT_COLOR;
    liveScoreDisplay.style.textShadow = `0 0 5px ${ACCENT_COLOR}99`; // 99 is opacity 60%

    // Settings Button
    settingsBtn.style.color = ACCENT_COLOR;
    settingsBtn.style.borderColor = ACCENT_COLOR;
    settingsBtn.style.boxShadow = `0 0 10px ${ACCENT_COLOR}33`; // 33 is opacity 20%
    
    // Restart buttons
    const restartBtns = document.querySelectorAll('.restart-button, .restart-setting-btn');
    const shadowColor = adjustColor(ACCENT_COLOR, -50); 
    
    restartBtns.forEach(btn => {
        btn.style.backgroundColor = ACCENT_COLOR;
        btn.style.color = '#0d1117'; // Keep text dark for contrast
        btn.style.setProperty('--shadow-color', shadowColor); // Set CSS Variable
        if (btn.classList.contains('restart-button')) {
            btn.style.boxShadow = `0 4px ${shadowColor}`;
        }
    });
    
    // Set CSS variable on settings menu for glow effect
    settingsMenu.style.setProperty('--accent-color', ACCENT_COLOR);
}


function applySettings() {
    // 1. Get Speed and update variable
    const speedElement = document.getElementById('speed-setting');
    GAME_SPEED_MS = parseInt(speedElement.value);

    // 2. Get Colors from Select elements
    ACCENT_COLOR = document.getElementById('accent-color-setting').value;
    SNAKE_BODY_COLOR = document.getElementById('body-color-setting').value;
    FOOD_COLOR = document.getElementById('food-color-setting').value;
    
    // 3. Apply color updates to UI elements 
    applyColorsToUI();

    // 4. Re-initialize the game with new speed/colors
    init(false); 
}

// --- Game Initialization and State Reset ---

function init(isResize = true) {
    if (isResize) {
        resizeCanvas(); 
    } else {
        // When only changing settings, ensure the game is paused briefly
        clearInterval(gameInterval);
    }

    // Initial snake position (middle of the canvas)
    const startX = Math.floor(GRID_SIZE / 2) * TILE_SIZE;
    const startY = Math.floor(GRID_SIZE / 2) * TILE_SIZE;

    snake = [
        { x: startX, y: startY },
        { x: startX - TILE_SIZE, y: startY },
        { x: startX - (2 * TILE_SIZE), y: startY }
    ];
    
    dx = TILE_SIZE; 
    dy = 0;
    score = 0;
    isGameOver = false;
    changingDirection = false;
    messageBox.classList.remove('active');
    
    liveScoreDisplay.textContent = `SCORE: ${score}`; 
    
    // Reset special food state
    bigFood = null;
    scoreTarget = 100;
    clearTimeout(bigFoodTimeoutId);
    bigFoodTimeoutId = null;
    
    // Set the interval based on the current speed setting
    clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, GAME_SPEED_MS);
    
    createNormalFood();
    
    // Apply colors to the UI elements using the new function
    applyColorsToUI();
    drawGame();
}

/**
 * Checks if a given position is on the snake, normal food, or big food.
 * @param {object} pos - {x, y} position to check.
 */
function isPositionOccupied(pos) {
    const onSnake = snake.some(segment => segment.x === pos.x && segment.y === pos.y);
    const onNormalFood = food && food.x === pos.x && food.y === pos.y;
    const onBigFood = bigFood && bigFood.x === pos.x && bigFood.y === pos.y;
    return onSnake || onNormalFood || onBigFood;
}

/**
 * Creates normal food (10 points).
 */
function createNormalFood() {
    let newFood;
    do {
        const foodX = Math.floor(Math.random() * GRID_SIZE) * TILE_SIZE;
        const foodY = Math.floor(Math.random() * GRID_SIZE) * TILE_SIZE;
        newFood = { x: foodX, y: foodY };
    } while (isPositionOccupied(newFood)); 
    
    food = newFood;
}

/**
 * Starts the 5-second timer for the big food to disappear.
 */
function startBigFoodTimer() {
    clearTimeout(bigFoodTimeoutId); // Clear any existing timer
    bigFoodTimeoutId = setTimeout(() => {
        bigFood = null; // Make the big food disappear
        bigFoodTimeoutId = null;
        // Optional: Force redraw to remove it instantly
        drawGame(); 
    }, BIG_FOOD_DURATION);
}

/**
 * Creates the special big food (20 points, 5 second limit).
 */
function createSpecialFood() {
    let newFood;
    do {
        const foodX = Math.floor(Math.random() * GRID_SIZE) * TILE_SIZE;
        const foodY = Math.floor(Math.random() * GRID_SIZE) * TILE_SIZE;
        newFood = { x: foodX, y: foodY };
    } while (isPositionOccupied(newFood));
    
    bigFood = newFood;
    startBigFoodTimer(); // Start the 5-second countdown
}


// --- Game Loop and Core Logic ---

function gameLoop() {
    if (isGameOver) {
        clearInterval(gameInterval);
        showGameOver();
        return;
    }

    changingDirection = false;
    moveSnake(); 

    if (hasGameEnded()) {
        isGameOver = true;
        return;
    }
    
    let foodEaten = false;

    // 1. Check for collision with BIG food first (if it exists)
    if (bigFood && snake[0].x === bigFood.x && snake[0].y === bigFood.y) {
        score += BIG_FOOD_SCORE;
        bigFood = null; 
        clearTimeout(bigFoodTimeoutId);
        foodEaten = true;
        // Since the score changed, check for the next special food spawn
        if (score >= scoreTarget) {
            createSpecialFood();
            scoreTarget += 100;
        }

    // 2. Check for collision with NORMAL food
    } else if (snake[0].x === food.x && snake[0].y === food.y) {
        score += 10;
        foodEaten = true;
        createNormalFood();
        // Check for special food spawn
        if (score >= scoreTarget) {
            createSpecialFood();
            scoreTarget += 100;
        }
    } 
    
    // Update live score display immediately after score change
    liveScoreDisplay.textContent = `SCORE: ${score}`;

    // Handle snake length
    if (!foodEaten) {
        snake.pop(); // Remove tail only if no food was eaten
    } 

    drawGame();
}

/**
 * Moves the snake and handles screen wrapping.
 */
function moveSnake() {
    // Calculate the new potential head position
    let head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // --- Screen Wrapping Logic (Flushes with the edge of the canvas) ---
    
    // Horizontal wrapping
    if (head.x < 0) {
        head.x = canvas.width - TILE_SIZE; // Moves to the far right
    } else if (head.x >= canvas.width) {
        head.x = 0; // Moves to the far left
    }

    // Vertical wrapping
    if (head.y < 0) {
        head.y = canvas.height - TILE_SIZE; // Moves to the far bottom
    } else if (head.y >= canvas.height) {
        head.y = 0; // Moves to the far top
    }
    
    // Add the new head to the beginning of the snake array
    snake.unshift(head);
}

/**
 * Checks if the game has ended (only due to self-collision).
 */
function hasGameEnded() {
    const head = snake[0];

    // Check for self-collision (excluding the head itself)
    for (let i = 1; i < snake.length; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) return true;
    }

    // Game only ends if it hits itself
    return false;
}

function showGameOver() {
    finalScoreDisplay.textContent = `Score: ${score}`;
    messageBox.classList.add('active');
    settingsMenu.classList.add('hidden'); // Hide settings when game over
}

function restartGame() {
    // Ensure the correct speed and colors are applied before restarting
    // This reads speed and calls init(false)
    applySettings(); 
}

// --- Drawing Functions ---

function drawGame() {
    // 1. Clear the canvas (draw background)
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Normal Food
    ctx.fillStyle = FOOD_COLOR; // Use variable
    ctx.fillRect(food.x, food.y, TILE_SIZE, TILE_SIZE);
    
    // 3. NEW: Draw Big Food (Yellow/Gold)
    if (bigFood) {
        ctx.fillStyle = BIG_FOOD_COLOR; // Gold color for bonus
        
        // Draw the base square
        ctx.fillRect(bigFood.x, bigFood.y, TILE_SIZE, TILE_SIZE);
        
        // Add a small pulsing circle overlay to highlight it
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(bigFood.x + TILE_SIZE / 2, bigFood.y + TILE_SIZE / 2, TILE_SIZE * 0.45, 0, 2 * Math.PI);
        ctx.fill();
    }

    // 4. Draw Snake
    snake.forEach((segment, index) => {
        if (index === 0) {
            ctx.fillStyle = ACCENT_COLOR; // Use variable for head/accent
        } else {
            ctx.fillStyle = SNAKE_BODY_COLOR; // Use variable for body
        }
        
        ctx.fillRect(segment.x, segment.y, TILE_SIZE, TILE_SIZE);
    });
}

// --- Input Handling ---

function changeDirection(event) {
    // Do not allow direction change if settings menu is open
    if (changingDirection || isGameOver || !settingsMenu.classList.contains('hidden')) return;
    changingDirection = true;

    let newDx = dx;
    let newDy = dy;
    
    // Normalize the key to lowercase to handle both WASD and arrow keys easily
    const key = event.key.toLowerCase(); 

    switch (key) {
        // GO LEFT (ArrowLeft or A)
        case 'arrowleft':
        case 'a':
            if (dx === TILE_SIZE) break;
            newDx = -TILE_SIZE;
            newDy = 0;
            break;
        // GO UP (ArrowUp or W)
        case 'arrowup':
        case 'w':
            if (dy === TILE_SIZE) break;
            newDx = 0;
            newDy = -TILE_SIZE;
            break;
        // GO RIGHT (ArrowRight or D)
        case 'arrowright':
        case 'd':
            if (dx === -TILE_SIZE) break;
            newDx = TILE_SIZE;
            newDy = 0;
            break;
        // GO DOWN (ArrowDown or S)
        case 'arrowdown':
        case 's':
            if (dy === -TILE_SIZE) break;
            newDx = 0;
            newDy = TILE_SIZE;
            break;
        // RESTART (Space)
        case ' ': 
            if (isGameOver) restartGame();
            return;
        default:
            changingDirection = false;
            return;
    }

    dx = newDx;
    dy = newDy;
}

// --- Event Listeners ---

// Keyboard input for movement and restart
document.addEventListener('keydown', changeDirection);

// Listener to handle screen resizing (critical for fullscreen effect)
// This initiates a full restart/resize
window.addEventListener('resize', init);

// Start the game when the window loads
// On load, resize, then apply settings (which sets speed and calls init)
window.onload = () => {
    init(true); // Resize and set initial state
};


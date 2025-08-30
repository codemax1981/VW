import { scene, camera, renderer, lightingSystem, initRenderer, updateRenderer } from './game/renderer.js';
import { generateInitialWorld, updateWorld } from './game/world.js';
import { updatePlayer } from './game/player.js';
import { initInput, isFlying, mouseLocked } from './game/input.js';
import { updateUI } from './game/ui.js';

let gameIsRunning = false;
let lastTime = 0;
let stats = {
    fps: 0,
    chunks: 0,
    blocks: 0,
    quality: 'high'
};

// Initialize the core components and start the render loop
function init() {
    initRenderer();
    initInput();
    setupQualityControls();
    setupPauseControls(); // Added setup for pause/resume
    animate();
}

// The main game loop
function animate(currentTime) {
    requestAnimationFrame(animate);
    
    const deltaTime = lastTime ? (currentTime - lastTime) / 1000 : 0;
    lastTime = currentTime;
    
    if (deltaTime > 0) {
        stats.fps = Math.round(1 / deltaTime);
    }

    if (gameIsRunning && mouseLocked) {
        updatePlayer(isFlying);
        updateRenderer(deltaTime);
        const worldStats = updateWorld();
        stats.chunks = worldStats.renderedChunks;
        stats.blocks = worldStats.totalBlocks;
        updateEnhancedUI();
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// New function to handle resuming the game on click
function setupPauseControls() {
    document.body.addEventListener('click', () => {
        // If the game is running but pointer is not locked, re-request lock
        if (gameIsRunning && !mouseLocked) {
            document.body.requestPointerLock();
        }
    });
}

// Setup keyboard controls for graphics quality
function setupQualityControls() {
    window.addEventListener('keydown', (e) => {
        if (!gameIsRunning) return;
        
        let qualityChanged = false;
        let newQuality = '';
        
        switch(e.key) {
            case 'F1':
                setGraphicsQuality('low');
                newQuality = 'Low';
                qualityChanged = true;
                break;
            case 'F2':
                setGraphicsQuality('medium');
                newQuality = 'Medium';
                qualityChanged = true;
                break;
            case 'F3':
                setGraphicsQuality('high');
                newQuality = 'High';
                qualityChanged = true;
                break;
            case 'F4':
                setGraphicsQuality('ultra');
                newQuality = 'Ultra';
                qualityChanged = true;
                break;
        }
        
        if (qualityChanged) {
            stats.quality = newQuality.toLowerCase();
            showNotification(`Graphics Quality: ${newQuality}`);
        }
    });
}

// Set graphics quality
function setGraphicsQuality(quality) {
    const settings = {
        low: {
            shadowMapSize: 512,
            pixelRatio: 1,
            shadowType: THREE.BasicShadowMap,
            renderDistance: 6
        },
        medium: {
            shadowMapSize: 1024,
            pixelRatio: Math.min(window.devicePixelRatio, 1.5),
            shadowType: THREE.PCFShadowMap,
            renderDistance: 8
        },
        high: {
            shadowMapSize: 2048,
            pixelRatio: Math.min(window.devicePixelRatio, 2),
            shadowType: THREE.PCFSoftShadowMap,
            renderDistance: 10
        },
        ultra: {
            shadowMapSize: 4096,
            pixelRatio: window.devicePixelRatio,
            shadowType: THREE.PCFSoftShadowMap,
            renderDistance: 12
        }
    };

    const config = settings[quality] || settings.high;
    
    if (renderer) {
        renderer.setPixelRatio(config.pixelRatio);
        renderer.shadowMap.type = config.shadowType;
    }
    
    if (lightingSystem) {
        lightingSystem.setShadowQuality(quality);
    }
}

// Enhanced UI update function
function updateEnhancedUI() {
    updateUI(stats.chunks, stats.blocks);
    
    const timeEl = document.getElementById('timeOfDay');
    const qualityEl = document.getElementById('graphicsQuality');

    if (timeEl) {
        timeEl.textContent = getTimeOfDay();
    }
    if (qualityEl) {
        qualityEl.textContent = stats.quality.charAt(0).toUpperCase() + stats.quality.slice(1);
    }
}

// Get formatted time of day from lighting system
function getTimeOfDay() {
    if (lightingSystem) {
        const time = lightingSystem.timeOfDay;
        const hours = Math.floor(time * 24);
        const minutes = Math.floor((time * 24 - hours) * 60);
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        let phase = '';
        if (hours >= 5 && hours < 7) phase = ' (Dawn)';
        else if (hours >= 7 && hours < 17) phase = ' (Day)';
        else if (hours >= 17 && hours < 19) phase = ' (Dusk)';
        else phase = ' (Night)';
        
        return timeStr + phase;
    }
    return '12:00';
}

// Show temporary notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px 30px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 16px;
        z-index: 10000;
        pointer-events: none;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transition = 'opacity 0.5s';
        notification.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notification), 500);
    }, 2000);
}

// Create additional UI elements for help text
function createHelpUI() {
    const helpText = document.createElement('div');
    helpText.id = 'controlsHelp';
    helpText.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        color: white;
        font-family: monospace;
        font-size: 12px;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        opacity: 0.7;
        pointer-events: none;
    `;
    helpText.innerHTML = `
        <div>Graphics: F1 (Low) | F2 (Medium) | F3 (High) | F4 (Ultra)</div>
        <div>Movement: WASD | Space (Jump) | Shift (Sprint) | F (Fly)</div>
    `;
    document.body.appendChild(helpText);
    
    setTimeout(() => {
        helpText.style.transition = 'opacity 2s';
        helpText.style.opacity = '0';
        setTimeout(() => helpText.remove(), 2000);
    }, 10000);
}

// Handles the transition from menu to game
async function startGame() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('loadingScreen').classList.remove('hidden');

    await generateInitialWorld();

    document.getElementById('loadingScreen').classList.add('hidden');

    document.getElementById('ui').classList.remove('hidden');
    document.getElementById('crosshair').classList.remove('hidden');
    document.getElementById('blockSelector').classList.remove('hidden');
    
    createHelpUI();
    
    document.body.requestPointerLock();
    gameIsRunning = true;
    
    showNotification('Welcome! Press F1-F4 to change graphics quality');
}

// Entry Point
document.getElementById('startGameBtn').addEventListener('click', () => {
    if (typeof THREE === 'undefined') {
        alert('Three.js library is not loaded. Please check your internet connection.');
        return;
    }
    startGame();
});

// Start the engine as soon as the page loads
init();

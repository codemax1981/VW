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
    setupPauseControls();
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

// Enhanced pause controls with ESC key support
function setupPauseControls() {
    document.body.addEventListener('click', () => {
        // If the game is running but pointer is not locked, re-request lock
        if (gameIsRunning && !mouseLocked) {
            document.body.requestPointerLock();
        }
    });
    
    // ESC key to pause/unpause
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && gameIsRunning) {
            if (mouseLocked) {
                document.exitPointerLock();
            } else {
                document.body.requestPointerLock();
            }
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
            showNotification(`Graphics Quality: ${newQuality}`, 'success');
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

// Enhanced notification system with types
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    // Add type-specific styling
    let backgroundColor;
    switch(type) {
        case 'success':
            backgroundColor = 'linear-gradient(135deg, rgba(0, 255, 136, 0.9), rgba(0, 200, 100, 0.95))';
            break;
        case 'warning':
            backgroundColor = 'linear-gradient(135deg, rgba(255, 193, 7, 0.9), rgba(255, 152, 0, 0.95))';
            break;
        case 'error':
            backgroundColor = 'linear-gradient(135deg, rgba(244, 67, 54, 0.9), rgba(198, 40, 40, 0.95))';
            break;
        default:
            backgroundColor = 'linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(30, 30, 30, 0.95))';
    }
    
    notification.style.background = backgroundColor;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        notification.style.opacity = '0';
        notification.style.transform = 'translate(-50%, -50%) scale(0.8)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 500);
    }, 3000);
}

// Create enhanced help UI with better styling
function createHelpUI() {
    const helpText = document.createElement('div');
    helpText.id = 'controlsHelp';
    helpText.innerHTML = `
        <div><strong>Graphics:</strong> F1 (Low) | F2 (Medium) | F3 (High) | F4 (Ultra)</div>
        <div><strong>Movement:</strong> WASD | Space (Jump) | Shift (Sprint) | F (Fly)</div>
        <div><strong>World:</strong> Explore flat plains and rare mountains!</div>
    `;
    document.body.appendChild(helpText);
    
    setTimeout(() => {
        helpText.style.transition = 'opacity 2s ease-out';
        helpText.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(helpText)) {
                helpText.remove();
            }
        }, 2000);
    }, 12000);
}

// Enhanced game start with progress simulation
async function startGame() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('loadingScreen').classList.remove('hidden');
    
    // Add some loading delay to show the enhanced loading screen
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
        await generateInitialWorld();
        
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 300));
        
        document.getElementById('loadingScreen').classList.add('hidden');
        document.getElementById('ui').classList.remove('hidden');
        document.getElementById('crosshair').classList.remove('hidden');
        document.getElementById('blockSelector').classList.remove('hidden');
        
        createHelpUI();
        
        document.body.requestPointerLock();
        gameIsRunning = true;
        
        showNotification('Welcome to your infinite world!', 'success');
        
        // Show mountain hint after a delay
        setTimeout(() => {
            showNotification('Rare mountains await discovery in the distance...', 'info');
        }, 5000);
        
    } catch (error) {
        console.error('Error generating world:', error);
        showNotification('Failed to generate world. Please try again.', 'error');
        document.getElementById('loadingScreen').classList.add('hidden');
        document.getElementById('mainMenu').classList.remove('hidden');
    }
}

// Entry Point with better error handling
document.getElementById('startGameBtn').addEventListener('click', () => {
    if (typeof THREE === 'undefined') {
        showNotification('Three.js library failed to load. Check your connection.', 'error');
        return;
    }
    startGame();
});

// Start the engine as soon as the page loads
init();
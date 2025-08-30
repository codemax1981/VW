// --- js/game/ui.js ---

import { player } from './player.js';
import { chunks } from './world.js'; // <-- UPDATED: Only imports chunks
import { CHUNK_SIZE, WORLD_HEIGHT } from './config.js'; // <-- UPDATED: Imports constants from config

let frameCount = 0;
let lastTime = performance.now();
let lastFrameTime = performance.now(); // For delta time
let fps = 60;

// --- START: Frame Time Graph variables ---
const canvas = document.getElementById('frameTimeGraph');
const ctx = canvas ? canvas.getContext('2d') : null;
const frameTimes = [];
const MAX_FRAME_HISTORY = canvas ? canvas.width : 120;
const TARGET_MS = 1000 / 60; // ~16.67ms for 60fps
// --- END: Frame Time Graph variables ---

/**
 * Draws the frame time graph on the canvas.
 * Newest frames are on the right, scrolling left.
 */
function drawFrameTimeGraph() {
    if (!ctx || !canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    
    // Clear and draw background
    ctx.clearRect(0, 0, width, height);
    
    // Max frame time for graph scaling (50ms = 20fps).
    // This provides a consistent scale to judge performance spikes.
    const maxMs = 50; 

    // Draw the target 60fps line (~16.7ms)
    const targetY = height - (TARGET_MS / maxMs * height);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, targetY);
    ctx.lineTo(width, targetY);
    ctx.stroke();
    
    // Draw bars for each frame time, starting from the right
    for (let i = 0; i < frameTimes.length; i++) {
        const x = width - (frameTimes.length - i);
        const ft = frameTimes[i];
        const barHeight = Math.min(height, (ft / maxMs) * height);
        
        // Color based on performance
        if (ft > TARGET_MS * 2) { // > 33.3ms ( < 30fps )
            ctx.fillStyle = '#D32F2F'; // Red
        } else if (ft > TARGET_MS) { // > 16.7ms ( < 60fps )
            ctx.fillStyle = '#FBC02D'; // Yellow
        } else {
            ctx.fillStyle = '#7CB342'; // Green
        }
        ctx.fillRect(x, height - barHeight, 1, barHeight);
    }
}

export function updateUI(renderedChunks, totalBlocks) {
    const currentTime = performance.now();
    frameCount++;
    if (currentTime >= lastTime + 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        frameCount = 0;
        lastTime = currentTime;
    }

    // --- Frame time calculation and graph update ---
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;
    if (ctx) {
        frameTimes.push(deltaTime);
        if (frameTimes.length > MAX_FRAME_HISTORY) {
            frameTimes.shift(); // Remove oldest frame time
        }
        drawFrameTimeGraph();
    }

    document.getElementById('fps').textContent = fps;
    document.getElementById('position').textContent =
        `${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}, ${player.position.z.toFixed(1)}`;
    document.getElementById('chunk').textContent =
        `${Math.floor(player.position.x / CHUNK_SIZE)}, ${Math.floor(player.position.z / CHUNK_SIZE)}`;
    document.getElementById('renderedChunks').textContent = renderedChunks;
    document.getElementById('totalBlocks').textContent = totalBlocks;

    const memoryUsage = (Object.keys(chunks).length * CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT * 1) / (1024 * 1024);
    document.getElementById('memoryUsage').textContent = `${memoryUsage.toFixed(1)}MB`;
}

export function updateBlockSelector(selectedBlock) {
    document.querySelectorAll('.block-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.block === selectedBlock);
    });
}
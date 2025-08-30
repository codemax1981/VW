// --- js/game/renderer.js ---
// UPDATED VERSION with integrated lighting system

import LightingSystem from './lighting.js';

let scene, camera, renderer;
let lightingSystem;

function initRenderer() {
    // Create scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Create renderer with enhanced shadow settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    renderer.setClearColor(0x87CEEB);
    
    // Enhanced shadow configuration
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    renderer.shadowMap.autoUpdate = true;
    renderer.shadowMap.needsUpdate = true;
    
    // Tone mapping for better colors
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    // Enable physically correct lighting
    renderer.physicallyCorrectLights = true;
    
    document.getElementById('gameContainer').appendChild(renderer.domElement);

    // Initialize lighting system
    lightingSystem = new LightingSystem();
    lightingSystem.init();
    
    // Make renderer globally accessible for lighting system
    window.renderer = renderer;
    
    // Window resize listener
    window.addEventListener('resize', () => {
        if (camera && renderer) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    });

    // Graphics quality settings
    setupQualityControls();
}

function setupQualityControls() {
    // Add keyboard shortcuts for quality settings
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F1') {
            setGraphicsQuality('low');
            console.log('Graphics: Low Quality');
        } else if (e.key === 'F2') {
            setGraphicsQuality('medium');
            console.log('Graphics: Medium Quality');
        } else if (e.key === 'F3') {
            setGraphicsQuality('high');
            console.log('Graphics: High Quality');
        } else if (e.key === 'F4') {
            setGraphicsQuality('ultra');
            console.log('Graphics: Ultra Quality');
        }
    });
}

function setGraphicsQuality(quality) {
    const settings = {
        low: {
            shadowMapSize: 512,
            pixelRatio: 1,
            shadowType: THREE.BasicShadowMap,
            antialias: false
        },
        medium: {
            shadowMapSize: 1024,
            pixelRatio: Math.min(window.devicePixelRatio, 1.5),
            shadowType: THREE.PCFShadowMap,
            antialias: true
        },
        high: {
            shadowMapSize: 2048,
            pixelRatio: Math.min(window.devicePixelRatio, 2),
            shadowType: THREE.PCFSoftShadowMap,
            antialias: true
        },
        ultra: {
            shadowMapSize: 4096,
            pixelRatio: window.devicePixelRatio,
            shadowType: THREE.PCFSoftShadowMap,
            antialias: true
        }
    };

    const config = settings[quality] || settings.high;
    
    // Update renderer settings
    renderer.setPixelRatio(config.pixelRatio);
    renderer.shadowMap.type = config.shadowType;
    
    // Update lighting system shadow quality
    if (lightingSystem) {
        lightingSystem.setShadowQuality(quality);
    }
}

// Update function to be called in the game loop
function updateRenderer(deltaTime) {
    if (lightingSystem) {
        lightingSystem.update(deltaTime);
    }
}

export { scene, camera, renderer, lightingSystem, initRenderer, updateRenderer, setGraphicsQuality };
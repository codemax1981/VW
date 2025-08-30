// --- js/game/lighting.js ---
// New file to handle advanced lighting and shadows

import { scene, camera } from './renderer.js';
import { player } from './player.js';

class LightingSystem {
    constructor() {
        this.sun = null;
        this.ambient = null;
        this.timeOfDay = 0.3; // 0 = midnight, 0.5 = noon, 1 = midnight
        this.shadowCascades = [];
        this.cascadeSplits = [10, 30, 100]; // Distance splits for cascades
        this.helpers = [];
        this.debugShadows = false;
    }

    init() {
        // Ambient light - changes with time of day
        this.ambient = new THREE.HemisphereLight(0x87CEEB, 0x545454, 0.4);
        scene.add(this.ambient);

        // Directional light (sun) with cascaded shadows
        this.sun = new THREE.DirectionalLight(0xffffff, 1.0);
        this.sun.castShadow = true;
        
        // High quality shadow settings
        this.sun.shadow.mapSize.width = 2048;
        this.sun.shadow.mapSize.height = 2048;
        this.sun.shadow.bias = -0.0005;
        this.sun.shadow.normalBias = 0.02;
        
        scene.add(this.sun);
        scene.add(this.sun.target);

        // Fog light for atmospheric scattering
        this.fogLight = new THREE.PointLight(0xffaa00, 0.3, 200);
        scene.add(this.fogLight);

        // Initialize cascaded shadow maps
        this.setupCascadedShadows();
    }

    setupCascadedShadows() {
        // Setup shadow camera frustum
        const shadowCam = this.sun.shadow.camera;
        shadowCam.near = 0.1;
        shadowCam.far = 200;
        shadowCam.left = -50;
        shadowCam.right = 50;
        shadowCam.top = 50;
        shadowCam.bottom = -50;
    }

    update(deltaTime) {
        // Update time of day (full cycle in 10 minutes)
        this.timeOfDay += deltaTime / 600; // 600 seconds = 10 minutes
        if (this.timeOfDay > 1) this.timeOfDay -= 1;

        // Calculate sun position
        const sunAngle = this.timeOfDay * Math.PI * 2;
        const sunHeight = Math.sin(sunAngle);
        const sunDistance = 100;
        
        this.sun.position.set(
            Math.cos(sunAngle) * sunDistance,
            Math.abs(sunHeight) * sunDistance + 20,
            Math.sin(sunAngle * 0.5) * sunDistance * 0.3
        );
        
        // Point sun at player position
        this.sun.target.position.copy(player.position);
        
        // Update shadow camera to follow player
        this.updateShadowCamera();
        
        // Update lighting colors based on time
        this.updateDayNightCycle();
        
        // Update fog light position
        this.fogLight.position.copy(player.position);
        this.fogLight.position.y += 10;
    }

    updateShadowCamera() {
        const shadowCam = this.sun.shadow.camera;
        const playerPos = player.position;
        
        // Make shadow camera follow player for better shadow quality
        const cameraSize = 40; // Size of shadow frustum
        shadowCam.left = playerPos.x - cameraSize;
        shadowCam.right = playerPos.x + cameraSize;
        shadowCam.top = playerPos.z + cameraSize;
        shadowCam.bottom = playerPos.z - cameraSize;
        
        shadowCam.updateProjectionMatrix();
        
        // Update shadow bias based on sun angle for better quality
        const sunHeight = Math.abs(this.sun.position.y);
        this.sun.shadow.bias = -0.0005 * (1 + (100 - sunHeight) / 100);
    }

    updateDayNightCycle() {
        const t = this.timeOfDay;
        let brightness, ambientStrength, fogColor, skyColor;
        
        // Calculate day/night phases
        if (t < 0.25) { // Night to sunrise (midnight to 6am)
            const phase = t / 0.25;
            brightness = 0.1 + phase * 0.3;
            ambientStrength = 0.2 + phase * 0.2;
            fogColor = new THREE.Color(0x0a0a20).lerp(new THREE.Color(0xffaa55), phase);
            skyColor = new THREE.Color(0x000033).lerp(new THREE.Color(0xff6b35), phase);
        } else if (t < 0.5) { // Sunrise to noon (6am to noon)
            const phase = (t - 0.25) / 0.25;
            brightness = 0.4 + phase * 0.6;
            ambientStrength = 0.4 + phase * 0.2;
            fogColor = new THREE.Color(0xffaa55).lerp(new THREE.Color(0x87CEEB), phase);
            skyColor = new THREE.Color(0xff6b35).lerp(new THREE.Color(0x87CEEB), phase);
        } else if (t < 0.75) { // Noon to sunset (noon to 6pm)
            const phase = (t - 0.5) / 0.25;
            brightness = 1.0 - phase * 0.4;
            ambientStrength = 0.6 - phase * 0.2;
            fogColor = new THREE.Color(0x87CEEB).lerp(new THREE.Color(0xff7755), phase);
            skyColor = new THREE.Color(0x87CEEB).lerp(new THREE.Color(0xff4500), phase);
        } else { // Sunset to night (6pm to midnight)
            const phase = (t - 0.75) / 0.25;
            brightness = 0.6 - phase * 0.5;
            ambientStrength = 0.4 - phase * 0.2;
            fogColor = new THREE.Color(0xff7755).lerp(new THREE.Color(0x0a0a20), phase);
            skyColor = new THREE.Color(0xff4500).lerp(new THREE.Color(0x000033), phase);
        }
        
        // Apply lighting changes
        this.sun.intensity = brightness;
        this.ambient.intensity = ambientStrength;
        
        // Update ambient colors
        this.ambient.color.copy(skyColor);
        this.ambient.groundColor.copy(fogColor.clone().multiplyScalar(0.5));
        
        // Update fog
        scene.fog.color.copy(fogColor);
        
        // Update renderer clear color
        if (window.renderer) {
            window.renderer.setClearColor(skyColor);
        }
        
        // Sun color changes
        if (t < 0.3 || t > 0.7) {
            this.sun.color.setHSL(0.08, 0.8, 0.95); // Warm orange during sunrise/sunset
        } else {
            this.sun.color.setHSL(0.15, 0.1, 1.0); // White during day
        }
        
        // Update fog light for night time
        this.fogLight.intensity = Math.max(0, 0.5 * (1 - brightness));
    }

    // Toggle shadow quality
    setShadowQuality(quality) {
        const sizes = {
            low: 512,
            medium: 1024,
            high: 2048,
            ultra: 4096
        };
        
        const size = sizes[quality] || 2048;
        this.sun.shadow.mapSize.width = size;
        this.sun.shadow.mapSize.height = size;
        
        // Force shadow map update
        if (this.sun.shadow.map) {
            this.sun.shadow.map.dispose();
            this.sun.shadow.map = null;
        }
    }

    // Add dynamic lights (torches, etc.)
    addPointLight(position, color = 0xffaa00, intensity = 1, distance = 15) {
        const light = new THREE.PointLight(color, intensity, distance);
        light.position.copy(position);
        light.castShadow = true;
        light.shadow.mapSize.width = 512;
        light.shadow.mapSize.height = 512;
        light.shadow.camera.near = 0.5;
        light.shadow.camera.far = distance;
        scene.add(light);
        return light;
    }

    dispose() {
        if (this.sun) {
            scene.remove(this.sun);
            if (this.sun.shadow.map) this.sun.shadow.map.dispose();
        }
        if (this.ambient) scene.remove(this.ambient);
        if (this.fogLight) scene.remove(this.fogLight);
        this.helpers.forEach(helper => scene.remove(helper));
    }
}

export default LightingSystem;
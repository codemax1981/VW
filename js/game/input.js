// --- js/game/input.js ---

import { camera } from './renderer.js';
import { getVoxelIntersection, setBlock } from './world.js';
import { BLOCKS } from './config.js';
import { player } from './player.js';
import { updateBlockSelector } from './ui.js';

export let keys = {};
export let mouseLocked = false;
export let selectedBlock = 'stone'; // UPDATED default block
export let isFlying = false;
let mouseX = 0, mouseY = 0;

function breakBlock(position) {
    setBlock(position.x, position.y, position.z, BLOCKS.air);
}

function placeBlock(position, normal) {
    const newPos = position.clone().add(normal);
    const playerBlockPos = player.position.clone().floor();
    if (newPos.equals(playerBlockPos) || newPos.equals(playerBlockPos.clone().add(new THREE.Vector3(0, 1, 0)))) {
        return;
    }
    setBlock(newPos.x, newPos.y, newPos.z, BLOCKS[selectedBlock]);
}

export function initInput() {
    document.addEventListener('pointerlockchange', () => {
        mouseLocked = document.pointerLockElement === document.body;
        
        // Handle showing/hiding the pause menu
        const pauseMenu = document.getElementById('pauseMenu');
        if (mouseLocked) {
            pauseMenu.classList.add('hidden');
        } else {
            // Only show pause menu if the game has actually started (main menu is hidden)
            if (!document.getElementById('mainMenu').classList.contains('hidden')) return;
            pauseMenu.classList.remove('hidden');
        }
    });

    document.addEventListener('keydown', (event) => {
        keys[event.code] = true;
        
        const blockTypes = ['stone', 'cobblestone', 'dirt', 'grass', 'logs', 'leaves', 'planks', 'glass', 'bricks'];
        const blockKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];
        const keyIndex = blockKeys.indexOf(event.code);

        if (keyIndex !== -1) {
            selectedBlock = blockTypes[keyIndex];
            updateBlockSelector(selectedBlock);
        }
        if (event.code === 'KeyF') isFlying = !isFlying;
    });

    document.addEventListener('keyup', (event) => {
        keys[event.code] = false;
    });

    document.addEventListener('mousemove', (event) => {
        if (mouseLocked) {
            mouseX += event.movementX * 0.002;
            mouseY += event.movementY * 0.002;
            mouseY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseY));
            camera.rotation.order = 'YXZ';
            camera.rotation.y = -mouseX;
            camera.rotation.x = -mouseY;
        }
    });

    document.addEventListener('mousedown', (event) => {
        if (!mouseLocked) return;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = getVoxelIntersection(raycaster);
        if (intersects) {
            if (event.button === 0) breakBlock(intersects.position);
            else if (event.button === 2) placeBlock(intersects.position, intersects.normal);
        }
    });

    document.addEventListener('contextmenu', (event) => event.preventDefault());

    document.querySelectorAll('.block-item').forEach(item => {
        item.addEventListener('click', () => {
            selectedBlock = item.dataset.block;
            updateBlockSelector(selectedBlock);
        });
    });
}
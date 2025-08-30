// --- js/game/player.js ---

import { camera } from './renderer.js';
import { keys } from './input.js';
import { getBlock } from './world.js';
import { WORLD_HEIGHT, BLOCKS } from './config.js';

// --- Start of Source-like Movement Constants ---
// These values are crucial for tuning the feel of the movement.
const GRAVITY = 0.01;
const MAX_SPEED_GROUND = 0.3;      // Max speed while on the ground
const MAX_SPEED_AIR = 0.02;          // Max speed for air strafing (higher is more powerful)
const ACCEL_GROUND = 0.2;           // How quickly you accelerate on the ground
const ACCEL_AIR = 1.3;              // How quickly you can change direction in the air (high for strafing)
const FRICTION = 0.2;               // How quickly you slow down on the ground
const JUMP_IMPULSE = 0.2;           // The initial vertical velocity of a jump
// --- End of Source-like Movement Constants ---

export const player = {
    position: new THREE.Vector3(0, WORLD_HEIGHT / 2, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    onGround: false,
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    worldUp: new THREE.Vector3(0, 1, 0),
    width: 0.6,
    height: 1.8
};

/**
 * The core acceleration function. It adds velocity in a desired direction
 * up to a maximum speed, respecting the current velocity. This is what
 * allows for air strafing and bunny hopping.
 * @param {THREE.Vector3} wishDir - The direction the player wants to move.
 * @param {number} wishSpeed - The maximum speed the player wants to reach.
 * @param {number} accel - The acceleration rate.
 */
function accelerate(wishDir, wishSpeed, accel) {
    const currentSpeed = player.velocity.dot(wishDir);
    const addSpeed = wishSpeed - currentSpeed;

    if (addSpeed <= 0) {
        return;
    }

    let accelSpeed = accel * wishSpeed;
    if (accelSpeed > addSpeed) {
        accelSpeed = addSpeed;
    }

    player.velocity.add(wishDir.clone().multiplyScalar(accelSpeed));
}

/**
 * Applies friction to the player's velocity when on the ground.
 */
function applyFriction() {
    const speed = player.velocity.length();
    if (speed < 0.001) { // Stop if moving very slowly
        player.velocity.x = 0;
        player.velocity.z = 0;
        return;
    }

    const control = speed < FRICTION ? FRICTION : speed;
    const drop = control * FRICTION;

    const newSpeed = Math.max(0, speed - drop);
    if (newSpeed !== speed) {
        const scale = newSpeed / speed;
        player.velocity.x *= scale;
        player.velocity.z *= scale;
    }
}

function getWishDirection() {
    const wishDir = new THREE.Vector3();
    if (keys['KeyW']) wishDir.add(player.forward);
    if (keys['KeyS']) wishDir.sub(player.forward);
    if (keys['KeyA']) wishDir.sub(player.right);
    if (keys['KeyD']) wishDir.add(player.right);
    wishDir.y = 0; // We only want horizontal movement from keys
    if (wishDir.lengthSq() > 0) {
        return wishDir.normalize();
    }
    return wishDir;
}

export function updatePlayer(isFlying) {
    // Standard flight mode is separate from Source movement
    if (isFlying) {
        const speed = 0.3;
        const movement = new THREE.Vector3();
        if (keys['KeyW']) movement.add(player.forward);
        if (keys['KeyS']) movement.sub(player.forward);
        if (keys['KeyA']) movement.sub(player.right);
        if (keys['KeyD']) movement.add(player.right);
        if (keys['Space']) movement.add(player.worldUp);
        if (keys['ShiftLeft']) movement.sub(player.worldUp);
        if (movement.length() > 0) {
            movement.normalize().multiplyScalar(speed);
        }
        player.velocity.copy(movement);
        player.position.add(player.velocity);
        camera.position.copy(player.position);
        camera.position.y += player.height * 0.9;
        return; // Exit here if flying
    }

    // --- Start of Source-like Physics Update ---

    // Get player's view direction for movement calculations
    player.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    player.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    
    // Get desired movement direction from keyboard input
    const wishDir = getWishDirection();

    if (player.onGround) {
        applyFriction();
        accelerate(wishDir, MAX_SPEED_GROUND, ACCEL_GROUND);
        // Handle jumping
        if (keys['Space']) {
            player.velocity.y = JUMP_IMPULSE;
            player.onGround = false;
        }
    } else {
        // Air movement: less control, but allows for strafing
        accelerate(wishDir, MAX_SPEED_AIR, ACCEL_AIR);
    }
    
    // Apply gravity
    player.velocity.y -= GRAVITY;

    // --- Collision Detection and Response (same as before) ---
    // This part takes the calculated velocity and moves the player,
    // resolving any collisions with the world.
    let newPosition = player.position.clone().add(player.velocity);
    const playerBox = new THREE.Box3();

    // Check Y-axis collision
    player.onGround = false;
    if (player.velocity.y <= 0) {
        playerBox.setFromCenterAndSize(
            new THREE.Vector3(player.position.x, newPosition.y + player.height / 2, player.position.z),
            new THREE.Vector3(player.width, player.height, player.width)
        );
        const feetY = Math.floor(playerBox.min.y);
        const startX = Math.floor(playerBox.min.x);
        const endX = Math.floor(playerBox.max.x);
        const startZ = Math.floor(playerBox.min.z);
        const endZ = Math.floor(playerBox.max.z);

        for (let x = startX; x <= endX; x++) {
            for (let z = startZ; z <= endZ; z++) {
                const block = getBlock(x, feetY, z);
                if (block !== BLOCKS.air && block !== BLOCKS.water) {
                    player.velocity.y = 0;
                    newPosition.y = feetY + 1;
                    player.onGround = true; // We've landed!
                    break;
                }
            }
            if (player.onGround) break;
        }
    }
    player.position.y = newPosition.y;

    // Check X-axis collision
    if (player.velocity.x !== 0) {
        playerBox.setFromCenterAndSize(
            new THREE.Vector3(newPosition.x, player.position.y + player.height / 2, player.position.z),
            new THREE.Vector3(player.width, player.height, player.width)
        );
        const checkX = player.velocity.x > 0 ? Math.floor(playerBox.max.x) : Math.floor(playerBox.min.x);
        const startY = Math.floor(playerBox.min.y);
        const endY = Math.floor(playerBox.max.y);
        for (let y = startY; y <= endY; y++) {
            if (getBlock(checkX, y, Math.floor(player.position.z)) !== BLOCKS.air) {
                player.velocity.x = 0;
                newPosition.x = player.position.x;
                break;
            }
        }
    }
    player.position.x = newPosition.x;

    // Check Z-axis collision
    if (player.velocity.z !== 0) {
        playerBox.setFromCenterAndSize(
            new THREE.Vector3(player.position.x, player.position.y + player.height / 2, newPosition.z),
            new THREE.Vector3(player.width, player.height, player.width)
        );
        const checkZ = player.velocity.z > 0 ? Math.floor(playerBox.max.z) : Math.floor(playerBox.min.z);
        const startY = Math.floor(playerBox.min.y);
        const endY = Math.floor(playerBox.max.y);
        for (let y = startY; y <= endY; y++) {
            if (getBlock(Math.floor(player.position.x), y, checkZ) !== BLOCKS.air) {
                player.velocity.z = 0;
                newPosition.z = player.position.z;
                break;
            }
        }
    }
    player.position.z = newPosition.z;

    // Update camera to new player position (at eye level)
    camera.position.copy(player.position);
    camera.position.y += player.height * 0.9;
}
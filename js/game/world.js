// --- js/game/world.js ---

import { scene, camera } from './renderer.js';
import { player } from './player.js';
import { CHUNK_SIZE, WORLD_HEIGHT, RENDER_DISTANCE, BLOCKS, BLOCK_COLORS } from './config.js';

export let chunks = {};

// --- START: 2D Perlin Noise Generator ---
// A self-contained, seeded Perlin noise generator for creating natural terrain.
const perlin2D = (() => {
    const p = new Uint8Array(512);
    // Initialize with a random seed to make each world unique
    let seed = Math.floor(Math.random() * 65536);
    const random = () => {
        var t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 256; i++) p[i + 256] = p[i];

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(t, a, b) { return a + t * (b - a); }
    function grad(hash, x, y) {
        const h = hash & 7;
        const u = h < 4 ? x : y;
        const v = h < 4 ? y : x;
        return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
    }

    return (x, y) => {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = fade(x);
        const v = fade(y);
        const A = p[X] + Y, AA = p[A], AB = p[A + 1];
        const B = p[X + 1] + Y, BA = p[B], BB = p[B + 1];
        
        // The result is in the range [-1, 1]
        return lerp(v, lerp(u, grad(p[AA], x, y), grad(p[BA], x - 1, y)),
                       lerp(u, grad(p[AB], x, y - 1), grad(p[BB], x - 1, y - 1)));
    };
})();
// --- END: 2D Perlin Noise Generator ---

// UPDATED: Now an async function to allow non-blocking world generation
export async function generateInitialWorld() {
    const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);

    for (let x = playerChunkX - RENDER_DISTANCE; x <= playerChunkX + RENDER_DISTANCE; x++) {
        for (let z = playerChunkZ - RENDER_DISTANCE; z <= playerChunkZ + RENDER_DISTANCE; z++) {
            generateChunk(x, z);
        }
        // Yield to the event loop to allow the loading animation to render
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

function generateChunk(chunkX, chunkZ) {
    const chunkKey = `${chunkX},${chunkZ}`;
    if (chunks[chunkKey]) return;

    const chunk = {
        x: chunkX, z: chunkZ,
        blocks: new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE),
        mesh: null, needsUpdate: true
    };

    const GROUND_LEVEL = 32;

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const worldX = chunkX * CHUNK_SIZE + x;
            const worldZ = chunkZ * CHUNK_SIZE + z;
            
            // --- TERRAIN GENERATION LOGIC ---
            let mountainFactor = perlin2D(worldX * 0.003, worldZ * 0.003);
            mountainFactor = (mountainFactor - 0.1) * 1.5;
            mountainFactor = Math.max(0, mountainFactor);

            const baseHills = perlin2D(worldX * 0.015, worldZ * 0.015) * 6;
            const mountainDetail = perlin2D(worldX * 0.03, worldZ * 0.03) * 20;
            
            const mountainHeight = mountainFactor * mountainFactor * (25 + mountainDetail);
            const totalHeight = GROUND_LEVEL + baseHills + mountainHeight;

            // --- FIXED BLOCK PLACEMENT LOGIC ---
            for (let y = 0; y < WORLD_HEIGHT; y++) {
                const index = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
                
                const surfaceY = Math.floor(totalHeight);

                // Check for the surface block FIRST to avoid being overwritten by dirt
                if (y === surfaceY) {
                    if (mountainHeight < 5) {
                        chunk.blocks[index] = BLOCKS.grass;
                        
                        // Tree generation - only on flat, non-mountainous areas
                        if (mountainHeight === 0 && Math.random() < 0.008) {
                            generateTree(chunk, x, y + 1, z);
                        }
                    } else {
                        // Stone or cobblestone on steep mountain areas
                        chunk.blocks[index] = Math.random() < 0.7 ? BLOCKS.stone : BLOCKS.cobblestone;
                    }
                } 
                // Then, check for the dirt layer below the surface
                else if (y < surfaceY && y > surfaceY - 4) {
                    chunk.blocks[index] = BLOCKS.dirt;
                } 
                // Finally, place stone for everything else below the dirt layer
                else if (y < surfaceY - 3) {
                    chunk.blocks[index] = BLOCKS.stone;
                }
            }
        }
    }
    chunks[chunkKey] = chunk;
}

function generateTree(chunk, x, y, z) {
    // Generate different tree types
    const treeType = Math.random();
    
    if (treeType < 0.7) {
        // Regular oak tree
        generateOakTree(chunk, x, y, z);
    } else if (treeType < 0.9) {
        // Tall birch-like tree
        generateTallTree(chunk, x, y, z);
    } else {
        // Large oak tree
        generateLargeTree(chunk, x, y, z);
    }
}

function generateOakTree(chunk, x, y, z) {
    const treeHeight = 4 + Math.floor(Math.random() * 3);
    
    // Trunk
    for (let i = 0; i < treeHeight; i++) {
        if (y + i < WORLD_HEIGHT) {
            const index = x + z * CHUNK_SIZE + (y + i) * CHUNK_SIZE * CHUNK_SIZE;
            chunk.blocks[index] = BLOCKS.logs;
        }
    }
    
    // Leaves
    const leafY = y + treeHeight - 1;
    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            for (let dy = 0; dy <= 2; dy++) {
                if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 3) continue;
                const leafX = x + dx, leafZ = z + dz, leafYPos = leafY + dy;
                if (leafX >= 0 && leafX < CHUNK_SIZE && leafZ >= 0 && leafZ < CHUNK_SIZE && leafYPos < WORLD_HEIGHT) {
                    const index = leafX + leafZ * CHUNK_SIZE + leafYPos * CHUNK_SIZE * CHUNK_SIZE;
                    if (chunk.blocks[index] === BLOCKS.air && Math.random() < 0.8) {
                        chunk.blocks[index] = BLOCKS.leaves;
                    }
                }
            }
        }
    }
}

function generateTallTree(chunk, x, y, z) {
    const treeHeight = 8 + Math.floor(Math.random() * 4);
    
    // Trunk
    for (let i = 0; i < treeHeight; i++) {
        if (y + i < WORLD_HEIGHT) {
            const index = x + z * CHUNK_SIZE + (y + i) * CHUNK_SIZE * CHUNK_SIZE;
            chunk.blocks[index] = BLOCKS.logs;
        }
    }
    
    // Smaller leaf crown for tall trees
    const leafY = y + treeHeight - 2;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            for (let dy = 0; dy <= 3; dy++) {
                const leafX = x + dx, leafZ = z + dz, leafYPos = leafY + dy;
                if (leafX >= 0 && leafX < CHUNK_SIZE && leafZ >= 0 && leafZ < CHUNK_SIZE && leafYPos < WORLD_HEIGHT) {
                    const index = leafX + leafZ * CHUNK_SIZE + leafYPos * CHUNK_SIZE * CHUNK_SIZE;
                    if (chunk.blocks[index] === BLOCKS.air && Math.random() < 0.9) {
                        chunk.blocks[index] = BLOCKS.leaves;
                    }
                }
            }
        }
    }
}

function generateLargeTree(chunk, x, y, z) {
    const treeHeight = 6 + Math.floor(Math.random() * 3);
    
    // Thicker trunk (2x2)
    for (let dx = 0; dx <= 1; dx++) {
        for (let dz = 0; dz <= 1; dz++) {
            for (let i = 0; i < treeHeight; i++) {
                const trunkX = x + dx, trunkZ = z + dz;
                if (trunkX < CHUNK_SIZE && trunkZ < CHUNK_SIZE && y + i < WORLD_HEIGHT) {
                    const index = trunkX + trunkZ * CHUNK_SIZE + (y + i) * CHUNK_SIZE * CHUNK_SIZE;
                    chunk.blocks[index] = BLOCKS.logs;
                }
            }
        }
    }
    
    // Large leaf crown
    const leafY = y + treeHeight - 2;
    for (let dx = -3; dx <= 4; dx++) {
        for (let dz = -3; dz <= 4; dz++) {
            for (let dy = 0; dy <= 4; dy++) {
                const distance = Math.sqrt(dx * dx + dz * dz + dy * dy * 0.5);
                if (distance > 4) continue;
                
                const leafX = x + dx, leafZ = z + dz, leafYPos = leafY + dy;
                if (leafX >= 0 && leafX < CHUNK_SIZE && leafZ >= 0 && leafZ < CHUNK_SIZE && leafYPos < WORLD_HEIGHT) {
                    const index = leafX + leafZ * CHUNK_SIZE + leafYPos * CHUNK_SIZE * CHUNK_SIZE;
                    if (chunk.blocks[index] === BLOCKS.air && Math.random() < 0.7) {
                        chunk.blocks[index] = BLOCKS.leaves;
                    }
                }
            }
        }
    }
}

export function getBlock(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return BLOCKS.air;
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const chunk = chunks[`${chunkX},${chunkZ}`];
    if (!chunk) return BLOCKS.air;
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const index = localX + localZ * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
    return chunk.blocks[index] || BLOCKS.air;
}

export function setBlock(x, y, z, blockType) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const chunkKey = `${chunkX},${chunkZ}`;
    let chunk = chunks[chunkKey];
    if (!chunk) {
        generateChunk(chunkX, chunkZ);
        chunk = chunks[chunkKey];
    }
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const index = localX + localZ * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
    chunk.blocks[index] = blockType;
    chunk.needsUpdate = true;
    if (localX === 0 && chunks[`${chunkX-1},${chunkZ}`]) chunks[`${chunkX-1},${chunkZ}`].needsUpdate = true;
    if (localX === CHUNK_SIZE-1 && chunks[`${chunkX+1},${chunkZ}`]) chunks[`${chunkX+1},${chunkZ}`].needsUpdate = true;
    if (localZ === 0 && chunks[`${chunkX},${chunkZ-1}`]) chunks[`${chunkX},${chunkZ-1}`].needsUpdate = true;
    if (localZ === CHUNK_SIZE-1 && chunks[`${chunkX},${chunkZ+1}`]) chunks[`${chunkX},${chunkZ+1}`].needsUpdate = true;
}

export function getVoxelIntersection(raycaster) {
    for (let t = 0; t < 10; t += 0.1) {
        const point = raycaster.ray.at(t, new THREE.Vector3());
        const pos = point.clone().floor();
        if (getBlock(pos.x, pos.y, pos.z) !== BLOCKS.air) {
            const prevPoint = raycaster.ray.at(t - 0.1, new THREE.Vector3());
            const diff = point.sub(prevPoint).multiplyScalar(10); // Heuristic normal
            let normal;
            if (Math.abs(diff.x) > Math.abs(diff.y) && Math.abs(diff.x) > Math.abs(diff.z)) {
                normal = new THREE.Vector3(diff.x > 0 ? -1 : 1, 0, 0);
            } else if (Math.abs(diff.y) > Math.abs(diff.z)) {
                normal = new THREE.Vector3(0, diff.y > 0 ? -1 : 1, 0);
            } else {
                normal = new THREE.Vector3(0, 0, diff.z > 0 ? -1 : 1);
            }
            return { position: pos, normal: normal };
        }
    }
    return null;
}

// Enhanced material configuration with better shadow support
function createChunkMesh(chunk) {
    if (chunk.mesh) {
        scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        chunk.mesh.material.dispose();
    }
    const faces = greedyMeshChunk(chunk);
    if (faces.length === 0) {
        chunk.needsUpdate = false;
        return;
    }
    const vertices = [], colors = [], indices = [];
    let indexOffset = 0;
    for (const face of faces) {
        const color = new THREE.Color(BLOCK_COLORS[face.blockType]);
        // Enhanced lighting calculation for better shadows
        let brightness;
        if (face.normal[1] === 1) {
            brightness = 1.0; // Top face - full brightness
        } else if (face.normal[1] === -1) {
            brightness = 0.5; // Bottom face - darkest
        } else if (face.normal[0] !== 0) {
            brightness = 0.75; // East/West faces
        } else {
            brightness = 0.85; // North/South faces
        }
        color.multiplyScalar(brightness);
        
        for (const vertex of face.vertices) {
            vertices.push(vertex[0] + chunk.x * CHUNK_SIZE, vertex[1], vertex[2] + chunk.z * CHUNK_SIZE);
            colors.push(color.r, color.g, color.b);
        }
        indices.push(indexOffset, indexOffset + 1, indexOffset + 2, indexOffset, indexOffset + 2, indexOffset + 3);
        indexOffset += 4;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    // Enhanced material with better shadow support
    const material = new THREE.MeshLambertMaterial({ 
        vertexColors: true,
        shadowSide: THREE.FrontSide // Only front faces cast shadows for performance
    });
    
    chunk.mesh = new THREE.Mesh(geometry, material);
    chunk.mesh.receiveShadow = true;
    chunk.mesh.castShadow = true;
    
    // Optimize shadow rendering for distant chunks
    const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);
    const distance = Math.max(Math.abs(chunk.x - playerChunkX), Math.abs(chunk.z - playerChunkZ));
    
    // Only cast shadows for nearby chunks to improve performance
    chunk.mesh.castShadow = distance <= 3;
    
    scene.add(chunk.mesh);
    chunk.needsUpdate = false;
}

// Add this new function to place torch lights in the world
export function placeTorch(x, y, z) {
    // Import the lighting system
    import('./renderer.js').then(({ lightingSystem }) => {
        if (lightingSystem) {
            const position = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
            const torchLight = lightingSystem.addPointLight(
                position,
                0xffaa00, // Warm orange color
                0.8,       // Intensity
                12         // Range
            );
            
            // Store torch reference (you might want to track these)
            if (!window.torches) window.torches = [];
            window.torches.push({ position: { x, y, z }, light: torchLight });
        }
    });
}

function greedyMeshChunk(chunk) {
    const faces = [];
    const dims = [CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE];
    for (let axis = 0; axis < 3; axis++) {
        const u = (axis + 1) % 3, v = (axis + 2) % 3;
        const x = [0,0,0], q = [0,0,0];
        q[axis] = 1;
        for (x[axis] = -1; x[axis] < dims[axis];) {
            const mask = new Int32Array(dims[u] * dims[v]);
            let n = 0;
            for (x[v] = 0; x[v] < dims[v]; x[v]++) {
                for (x[u] = 0; x[u] < dims[u]; x[u]++) {
                    const blockA = (x[axis] >= 0) ? getBlockInChunk(chunk, x[0], x[1], x[2]) : 0;
                    const blockB = (x[axis] < dims[axis] - 1) ? getBlockInChunk(chunk, x[0]+q[0], x[1]+q[1], x[2]+q[2]) : 0;
                    if ((blockA !== 0) === (blockB !== 0)) mask[n++] = 0;
                    else if (blockA !== 0) mask[n++] = blockA;
                    else mask[n++] = -blockB;
                }
            }
            x[axis]++;
            n = 0;
            for (let j = 0; j < dims[v]; j++) {
                for (let i = 0; i < dims[u];) {
                    if (mask[n] !== 0) {
                        const currentMask = mask[n];
                        let w = 1; while (i + w < dims[u] && mask[n + w] === currentMask) w++;
                        let h = 1, done = false;
                        while (j + h < dims[v]) {
                            for (let k = 0; k < w; k++) if (mask[n + k + h * dims[u]] !== currentMask) { done = true; break; }
                            if (done) break;
                            h++;
                        }
                        x[u] = i; x[v] = j;
                        const du = [0,0,0], dv = [0,0,0];
                        du[u] = w; dv[v] = h;
                        const normal = [0,0,0];
                        normal[axis] = currentMask > 0 ? 1 : -1;
                        const v1 = [x[0], x[1], x[2]];
                        const v2 = [x[0] + du[0], x[1] + du[1], x[2] + du[2]];
                        const v3 = [x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2]];
                        const v4 = [x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]];
                        faces.push({
                            vertices: currentMask > 0 ? [v1, v2, v3, v4] : [v1, v4, v3, v2],
                            normal: normal, blockType: Math.abs(currentMask)
                        });
                        for (let l = 0; l < h; l++) for (let k = 0; k < w; k++) mask[n + k + l * dims[u]] = 0;
                        i += w; n += w;
                    } else { i++; n++; }
                }
            }
        }
    }
    return faces;
}

function getBlockInChunk(chunk, x, y, z) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) return BLOCKS.air;
    const index = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
    return chunk.blocks[index] || BLOCKS.air;
}

export function updateWorld() {
    const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);
    for (let x = playerChunkX - RENDER_DISTANCE; x <= playerChunkX + RENDER_DISTANCE; x++) {
        for (let z = playerChunkZ - RENDER_DISTANCE; z <= playerChunkZ + RENDER_DISTANCE; z++) {
            if (!chunks[`${x},${z}`]) generateChunk(x, z);
        }
    }
    const chunksToRemove = [];
    let renderedChunks = 0, totalBlocks = 0;
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const [key, chunk] of Object.entries(chunks)) {
        const distance = Math.max(Math.abs(chunk.x - playerChunkX), Math.abs(chunk.z - playerChunkZ));
        if (distance > RENDER_DISTANCE + 2) {
            chunksToRemove.push(key);
            if (chunk.mesh) {
                scene.remove(chunk.mesh);
                chunk.mesh.geometry.dispose();
                chunk.mesh.material.dispose();
            }
        } else {
            const chunkBounds = new THREE.Box3(
                new THREE.Vector3(chunk.x * CHUNK_SIZE, 0, chunk.z * CHUNK_SIZE),
                new THREE.Vector3((chunk.x + 1) * CHUNK_SIZE, WORLD_HEIGHT, (chunk.z + 1) * CHUNK_SIZE)
            );
            if (frustum.intersectsBox(chunkBounds)) {
                if (chunk.needsUpdate || !chunk.mesh) createChunkMesh(chunk);
                if (chunk.mesh) {
                    chunk.mesh.visible = true;
                    renderedChunks++;
                    totalBlocks += chunk.mesh.geometry.attributes.position.count / 4;
                }
            } else if (chunk.mesh) {
                chunk.mesh.visible = false;
            }
        }
    }
    for (const key of chunksToRemove) {
        if (chunks[key] && chunks[key].mesh) {
            scene.remove(chunks[key].mesh);
            chunks[key].mesh.geometry.dispose();
            chunks[key].mesh.material.dispose();
        }
        delete chunks[key];
    }
    return { renderedChunks, totalBlocks };
}
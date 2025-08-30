// --- js/game/world.js ---

import { scene, camera } from './renderer.js';
import { player } from './player.js';
import { CHUNK_SIZE, WORLD_HEIGHT, RENDER_DISTANCE, BLOCKS, BLOCK_COLORS } from './config.js';

export let chunks = {};

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

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const worldX = chunkX * CHUNK_SIZE + x;
            const worldZ = chunkZ * CHUNK_SIZE + z;
            const height = Math.floor(32 + 15 * (Math.sin(worldX * 0.05) * Math.cos(worldZ * 0.05)));

            for (let y = 0; y < WORLD_HEIGHT; y++) {
                const index = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
                
                if (y < height - 4) {
                    chunk.blocks[index] = BLOCKS.stone;
                } else if (y < height) {
                    chunk.blocks[index] = BLOCKS.dirt;
                } else if (y === height) {
                    if (height < 35) {
                        chunk.blocks[index] = BLOCKS.dirt;
                    } else {
                        chunk.blocks[index] = BLOCKS.grass;
                        if (Math.random() < 0.02) {
                            generateTree(chunk, x, y + 1, z);
                        }
                    }
                }
            }
        }
    }
    chunks[chunkKey] = chunk;
}

function generateTree(chunk, x, y, z) {
    const treeHeight = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < treeHeight; i++) {
        if (y + i < WORLD_HEIGHT) {
            const index = x + z * CHUNK_SIZE + (y + i) * CHUNK_SIZE * CHUNK_SIZE;
            chunk.blocks[index] = BLOCKS.logs;
        }
    }
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

// --- Additional changes for js/game/world.js ---
// Add these modifications to your existing world.js file

// In the createChunkMesh function, update the material creation to support shadows:
// Replace this line:
// const material = new THREE.MeshLambertMaterial({ vertexColors: true });

// With this enhanced material configuration:
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
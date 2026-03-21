import * as THREE from 'three';
import { onBeforeCompileCurve } from './environment.js?v=5';
import { createCarMesh } from './car.js?v=5';

export class EntityManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
        this.coins = [];
        this.boosters = [];
        this.traffic = [];
        
        this.obsGeom = new THREE.BoxGeometry(2, 1.5, 4);
        this.obsMat = new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.7 });
        
        this.coinGeom = new THREE.TorusGeometry(0.5, 0.15, 8, 16);
        this.coinMat = new THREE.MeshStandardMaterial({ 
            color: 0xffd700, 
            metalness: 1.0, 
            roughness: 0.1,
            emissive: 0xffaa00,
            emissiveIntensity: 0.4
        });

        this.boosterGeom = new THREE.TorusKnotGeometry(0.5, 0.15, 64, 8);
        this.boosterMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            metalness: 0.8,
            roughness: 0.1,
            emissive: 0x00ffff,
            emissiveIntensity: 0.8
        });

        this.obsMat.onBeforeCompile = onBeforeCompileCurve;
        this.coinMat.onBeforeCompile = onBeforeCompileCurve;
        this.boosterMat.onBeforeCompile = onBeforeCompileCurve;

        this.lanes = [-4, 0, 4];
        this.lastSpawnZ = -200;
        this.relaxedMode = false;
        this.relaxedTimer = 0;
    }

    spawn(playerZ, level) {
        if (playerZ - 100 < this.lastSpawnZ) {
            // Check relaxed mode
            if (this.relaxedMode) {
                this.relaxedTimer--;
                if (this.relaxedTimer <= 0) {
                    this.relaxedMode = false;
                }
            } else {
                if (Math.random() < 0.02) { // 2% chance to start a relaxed section
                    this.relaxedMode = true;
                    this.relaxedTimer = 15; // 15 spawns of relaxed mode
                }
            }

            const r = Math.random();
            const effectiveLevel = Math.min(level, 8); // Cap difficulty at level 8
            let obsChance = this.relaxedMode ? 0 : 0.2 + (effectiveLevel * 0.05); // Reduced obstacle chance
            let trafficChance = this.relaxedMode ? 0 : obsChance + 0.15; // Traffic chance
            let coinChance = this.relaxedMode ? 0.7 : trafficChance + 0.3;
            let boosterChance = this.relaxedMode ? 1.0 : coinChance + 0.1; 
            
            if (r < obsChance) {
                this.spawnObstacle();
            } else if (r < trafficChance) {
                this.spawnTraffic();
            } else if (r < coinChance) {
                this.spawnCoin();
            } else if (r < boosterChance) {
                this.spawnBooster();
            }
            
            // Safe gap
            this.lastSpawnZ -= Math.max(20, 40 - effectiveLevel * 1.5); // Increased gap for easier gameplay
        }
    }

    spawnObstacle() {
        let obs = this.obstacles.find(o => !o.visible);
        if (!obs) {
            obs = new THREE.Mesh(this.obsGeom, this.obsMat);
            obs.castShadow = true;
            obs.receiveShadow = true;
            this.scene.add(obs);
            this.obstacles.push(obs);
        }
        
        const lane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
        obs.position.set(lane, 0.75, this.lastSpawnZ);
        obs.visible = true;
    }

    spawnTraffic() {
        let car = this.traffic.find(t => !t.visible);
        if (!car) {
            const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffffff, 0x888888];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            const carTypes = ['falcon', 'storm', 'thunder', 'desert', 'neon'];
            const randomType = carTypes[Math.floor(Math.random() * carTypes.length)];
            
            car = createCarMesh(randomColor, randomType);
            
            // Apply curve shader to all meshes in the car
            car.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material = child.material.clone(); // Clone to avoid affecting player car
                    child.material.onBeforeCompile = onBeforeCompileCurve;
                }
            });
            
            this.scene.add(car);
            this.traffic.push(car);
        }
        
        const lane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
        car.position.set(lane, 0, this.lastSpawnZ);
        car.userData.speed = 15 + Math.random() * 10; // Traffic speed
        car.visible = true;
    }

    spawnCoin() {
        let coin = this.coins.find(c => !c.visible);
        if (!coin) {
            coin = new THREE.Mesh(this.coinGeom, this.coinMat);
            
            // Add a point light for glow
            const light = new THREE.PointLight(0xffd700, 0.5, 3);
            coin.add(light);
            
            this.scene.add(coin);
            this.coins.push(coin);
        }
        
        const lane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
        coin.position.set(lane, 1.0, this.lastSpawnZ);
        coin.visible = true;
    }

    spawnBooster() {
        let booster = this.boosters.find(b => !b.visible);
        if (!booster) {
            booster = new THREE.Mesh(this.boosterGeom, this.boosterMat);
            
            const light = new THREE.PointLight(0x00ffff, 0.8, 4);
            booster.add(light);
            
            this.scene.add(booster);
            this.boosters.push(booster);
        }
        
        const lane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
        booster.position.set(lane, 1.0, this.lastSpawnZ);
        booster.visible = true;
    }

    clearNearbyObstacles(playerZ) {
        const safeDistance = 100; // Clear obstacles within 100 units ahead
        
        this.obstacles.forEach(obs => {
            if (obs.visible && obs.position.z < playerZ && obs.position.z > playerZ - safeDistance) {
                obs.visible = false;
            }
        });
        
        this.traffic.forEach(car => {
            if (car.visible && car.position.z < playerZ && car.position.z > playerZ - safeDistance) {
                car.visible = false;
            }
        });
    }

    update(playerZ, dt) {
        // Rotate coins
        this.coins.forEach(coin => {
            if (coin.visible) {
                coin.rotation.y += 2 * dt;
                if (coin.position.z > playerZ + 10) {
                    coin.visible = false;
                }
            }
        });

        // Rotate boosters
        this.boosters.forEach(booster => {
            if (booster.visible) {
                booster.rotation.y += 3 * dt;
                booster.rotation.x += 2 * dt;
                if (booster.position.z > playerZ + 10) {
                    booster.visible = false;
                }
            }
        });

        // Hide passed obstacles
        this.obstacles.forEach(obs => {
            if (obs.visible && obs.position.z > playerZ + 10) {
                obs.visible = false;
            }
        });

        // Update traffic
        this.traffic.forEach(car => {
            if (car.visible) {
                car.position.z -= car.userData.speed * dt; // Move forward
                if (car.position.z > playerZ + 20) {
                    car.visible = false;
                }
            }
        });
    }

    reset() {
        this.obstacles.forEach(o => o.visible = false);
        this.coins.forEach(c => c.visible = false);
        this.boosters.forEach(b => b.visible = false);
        this.traffic.forEach(t => t.visible = false);
        this.lastSpawnZ = -200; // No obstacles at the beginning
        this.relaxedMode = false;
        this.relaxedTimer = 0;
    }
}

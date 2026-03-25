import * as THREE from 'three';
import { createCarMesh } from './car.js?v=5';
import { Environment } from './environment.js?v=5';
import { EntityManager } from './entities.js?v=5';
import { AudioManager } from './audio.js?v=5';

export class GameEngine {
    constructor(container, callbacks) {
        this.callbacks = callbacks;
        this.audio = new AudioManager();
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 50, 150);

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(aspect < 1 ? 80 : 60, aspect, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.dirLight.position.set(50, 100, 50);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.camera.left = -20;
        this.dirLight.shadow.camera.right = 20;
        this.dirLight.shadow.camera.top = 50;
        this.dirLight.shadow.camera.bottom = -50;
        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);

        this.environment = new Environment(this.scene);
        this.entities = new EntityManager(this.scene);

        this.player = createCarMesh(0xff0000, 'falcon');
        this.scene.add(this.player);

        this.state = 'menu'; // menu, garage, playing, gameover, paused
        this.level = 1;
        this.speed = 0;
        this.baseSpeed = 30;
        this.playerZ = 0;
        this.playerX = 0;
        this.targetX = 0;
        
        this.score = 0;
        this.coins = 0;

        this.keys = { left: false, right: false, up: false, down: false };

        window.addEventListener('resize', () => this.onResize());
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));

        this.lastTime = performance.now();
        this.animate();
    }

    setGraphicsQuality(quality) {
        if (quality === 'HIGH') {
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.shadowMap.enabled = true;
            this.dirLight.castShadow = true;
            this.scene.fog.near = 50;
            this.scene.fog.far = 150;
        } else { // MEDIUM
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            this.renderer.shadowMap.enabled = true;
            this.dirLight.castShadow = true;
            this.scene.fog.near = 40;
            this.scene.fog.far = 100;
        }
    }

    setCar(hex, carId) {
        if (this.player) {
            this.scene.remove(this.player);
            this.player.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        }
        this.player = createCarMesh(hex, carId);
        this.scene.add(this.player);
        this.player.position.set(this.playerX, 0, this.playerZ);
    }

    start(level, carStats) {
        this.level = level;
        this.carStats = carStats || { speed: 1, acceleration: 1, handling: 1, boost: 1 };
        
        this.baseSpeed = 20 + (level * 10) + (this.carStats.speed * 5);
        this.speed = 0;
        this.playerZ = 0;
        this.playerX = 0;
        this.targetX = 0;
        this.score = 0;
        this.coins = 0;
        this.state = 'countdown';
        
        this.isBoosting = false;
        this.boostTimer = 0;
        this.maxBoostCharge = 100;
        this.boostCharge = this.maxBoostCharge;
        this.isMagnetActive = false;
        this.magnetTimer = 0;
        this.isScreeching = false;
        this.hasContinued = false;
        
        this.player.position.set(0, 0, 0);
        this.player.rotation.set(0, 0, 0);
        
        // Reset camera immediately
        const aspect = window.innerWidth / window.innerHeight;
        const camOffset = aspect < 1 ? new THREE.Vector3(0, 6, 12) : new THREE.Vector3(0, 4, 8);
        this.camera.position.set(0, camOffset.y, camOffset.z);
        this.camera.lookAt(0, 0, -10);
        
        this.environment.setLevel(level, this.dirLight, this.scene.children.find(c => c.type === 'AmbientLight'));
        this.entities.reset();
        this.audio.startEngine();
        this.audio.playBGM();

        // Speed lines setup
        if (!this.speedLines) {
            const lineGeom = new THREE.BufferGeometry();
            const lineCount = 100;
            const pos = new Float32Array(lineCount * 6);
            for (let i = 0; i < lineCount; i++) {
                const x = (Math.random() - 0.5) * 40;
                const y = Math.random() * 20;
                const z = (Math.random() - 0.5) * 100;
                pos[i*6] = x; pos[i*6+1] = y; pos[i*6+2] = z;
                pos[i*6+3] = x; pos[i*6+4] = y; pos[i*6+5] = z + 10;
            }
            lineGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
            this.speedLines = new THREE.LineSegments(lineGeom, lineMat);
            this.scene.add(this.speedLines);
        }
        this.speedLines.material.opacity = 0;
    }

    stop(isQuit = false) {
        if (!isQuit) {
            // Add screen shake effect to HUD
            document.body.classList.add('shake-screen');
            setTimeout(() => {
                document.body.classList.remove('shake-screen');
            }, 500);
        }

        this.state = 'gameover';
        this.audio.stopEngine();
        this.audio.stopBGM();
        
        if (!isQuit) {
            this.audio.playCrash();
            // Delay game over screen slightly for impact
            setTimeout(() => {
                this.callbacks.onGameOver(this.score, this.coins, this.hasContinued);
            }, 500);
        } else {
            this.callbacks.onGameOver(this.score, this.coins, this.hasContinued);
        }
        
        if (this.speedLines) {
            this.speedLines.material.opacity = 0;
        }
    }

    continueGame() {
        this.state = 'countdown';
        this.speed = this.baseSpeed;
        this.hasContinued = true;
        this.boostCharge = this.maxBoostCharge;
        this.isBoosting = false;
        this.isMagnetActive = false;
        this.audio.startEngine();
        this.audio.playBGM();
        
        // Clear nearby obstacles to prevent immediate crash
        this.entities.clearNearbyObstacles(this.playerZ);
        
        // Add brief invincibility
        this.invincible = true;
        this.player.material.transparent = true;
        this.player.material.opacity = 0.5;
        
        setTimeout(() => {
            this.invincible = false;
            this.player.material.opacity = 1.0;
        }, 3000);
    }

    onKeyDown(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = true;
        if (e.key === 'ArrowUp' || e.key === 'w') this.keys.up = true;
        if (e.key === 'ArrowDown' || e.key === 's') this.keys.down = true;
        if (e.key === 'h' || e.key === 'H' || e.key === ' ') this.audio.playHorn();
        if (e.key === 'Shift' || e.key === 'b' || e.key === 'B') this.activateBoost();
    }

    onKeyUp(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = false;
        if (e.key === 'ArrowUp' || e.key === 'w') this.keys.up = false;
        if (e.key === 'ArrowDown' || e.key === 's') this.keys.down = false;
    }

    setTouch(dir, active) {
        if (dir === 'left') this.keys.left = active;
        if (dir === 'right') this.keys.right = active;
        if (dir === 'up') this.keys.up = active;
        if (dir === 'down') this.keys.down = active;
    }

    onResize() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.aspect = aspect;
        this.camera.fov = aspect < 1 ? 80 : 60;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const now = performance.now();
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        if (this.state === 'playing') {
            this.update(dt);
        } else if (this.state === 'countdown') {
            // Keep camera fixed behind car during countdown
            const aspect = window.innerWidth / window.innerHeight;
            const camOffset = aspect < 1 ? new THREE.Vector3(0, 6, 12) : new THREE.Vector3(0, 4, 8);
            this.camera.position.set(this.playerX * 0.5, this.player.position.y + camOffset.y, this.playerZ + camOffset.z);
            this.camera.lookAt(this.player.position.x, this.player.position.y, this.player.position.z - 10);
        } else if (this.state === 'garage') {
            // Slowly rotate car in garage
            this.player.rotation.y += dt * 0.5;
            // Position camera for garage view
            const aspect = window.innerWidth / window.innerHeight;
            // In landscape, UI is on the right, so center car on the left
            const yOffset = 0.5; 
            const zOffset = 5.0;
            const xOffset = 1.5; // Move camera to the right so car appears on the left
            this.camera.position.set(this.playerX + xOffset, 2.5, this.playerZ + zOffset);
            this.camera.lookAt(this.playerX + xOffset, yOffset, this.playerZ);
        } else if (this.state === 'menu') {
            // Subtle moving background for menu
            this.playerZ -= 5 * dt;
            this.environment.update(this.playerZ, dt);
            
            // Camera pan
            const aspect = window.innerWidth / window.innerHeight;
            const camOffset = aspect < 1 ? new THREE.Vector3(0, 6, 12) : new THREE.Vector3(0, 4, 8);
            this.camera.position.set(Math.sin(performance.now() * 0.0005) * 2, this.player.position.y + camOffset.y, this.playerZ + camOffset.z);
            this.camera.lookAt(0, 0, this.playerZ - 10);
        }

        // Light follow
        this.dirLight.position.set(this.playerX + 50, 100, this.playerZ + 50);
        this.dirLight.target.position.set(this.playerX, 0, this.playerZ);
        this.dirLight.target.updateMatrixWorld();

        this.renderer.render(this.scene, this.camera);
    }

    update(dt) {
        // Booster logic
        if (this.isBoosting) {
            this.boostTimer -= dt;
            this.audio.updateChargingSound(false, 0);
            if (this.boostTimer <= 0) {
                this.isBoosting = false;
                this.boostCharge = 0; // Reset charge after boost ends
                // Remove spark effect
                const spark = this.player.getObjectByName('spark');
                if (spark) this.player.remove(spark);
            }
        } else {
            // Passive boost charging
            this.boostCharge += dt * 5; // Takes 20 seconds to fill
            if (this.boostCharge >= this.maxBoostCharge) {
                this.boostCharge = this.maxBoostCharge;
                this.audio.updateChargingSound(false, 1);
            } else {
                this.audio.updateChargingSound(true, this.boostCharge / this.maxBoostCharge);
            }
        }

        // Magnet logic
        if (this.isMagnetActive) {
            this.magnetTimer -= dt;
            if (this.magnetTimer <= 0) {
                this.isMagnetActive = false;
                const magnetAura = this.player.getObjectByName('magnetAura');
                if (magnetAura) this.player.remove(magnetAura);
            } else {
                // Pull coins towards player
                const pullRadius = 15;
                const pullSpeed = 30;
                for (let coin of this.entities.coins) {
                    if (!coin.visible) continue;
                    const dist = coin.position.distanceTo(this.player.position);
                    if (dist < pullRadius) {
                        const dir = new THREE.Vector3().subVectors(this.player.position, coin.position).normalize();
                        coin.position.add(dir.multiplyScalar(pullSpeed * dt));
                    }
                }
            }
        }

        // Acceleration
        let targetSpeed = 0;
        if (this.keys.up || this.isBoosting) {
            targetSpeed = this.baseSpeed + (Math.abs(this.playerZ) / 200);
            if (this.isBoosting) targetSpeed += 50 + (this.carStats.boost * 15);
        } else if (this.keys.down) {
            targetSpeed = -this.baseSpeed * 0.4; // Reverse speed is slower
        }
        
        // Engine torque feel
        const accelRate = this.isBoosting ? 6 : (1.5 + this.carStats.acceleration * 0.3);
        
        // Apply friction if no keys pressed
        if (!this.keys.up && !this.keys.down) {
            // Natural rolling friction and air resistance
            const friction = 0.95 - (this.speed * 0.0005);
            this.speed *= Math.pow(Math.max(0.8, friction), dt * 60);
        } else {
            this.speed += (targetSpeed - this.speed) * dt * accelRate;
        }
        
        this.playerZ -= this.speed * dt;
        
        // Only increase score if moving forward
        if (this.speed > 0) {
            this.score = Math.floor(Math.abs(this.playerZ));
        }

        // Steering
        const laneWidth = 5.33;
        const maxSteer = laneWidth * 1.4; // ~7.46
        
        const steerSpeed = 15 + (this.carStats.handling * 2);
        
        if (this.keys.left) {
            this.targetX -= steerSpeed * dt;
            if (!this.isScreeching && this.speed > 20) {
                this.audio.playScreech();
                this.isScreeching = true;
            }
        } else if (this.keys.right) {
            this.targetX += steerSpeed * dt;
            if (!this.isScreeching && this.speed > 20) {
                this.audio.playScreech();
                this.isScreeching = true;
            }
        } else {
            this.isScreeching = false;
        }

        this.targetX = Math.max(-maxSteer, Math.min(maxSteer, this.targetX));

        const handlingRate = 8 + (this.carStats.handling * 1.5);
        this.playerX += (this.targetX - this.playerX) * dt * handlingRate;
        
        // Add suspension bobbing effect
        const suspensionOffset = Math.sin(this.playerZ * 0.5) * 0.05 * (this.speed / 50);
        this.player.position.set(this.playerX, suspensionOffset, this.playerZ);
        
        // Tilt and wheel rotation
        const steerVel = this.playerX - this.targetX;
        this.player.rotation.y = steerVel * 0.05;
        this.player.rotation.z = steerVel * 0.02;

        if (this.player.userData.wheels) {
            this.player.userData.wheels.forEach(w => {
                w.rotation.x -= this.speed * dt * 0.5;
            });
        }

        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        const camOffset = aspect < 1 ? new THREE.Vector3(0, 6, 12) : new THREE.Vector3(0, 4, 8);
        const targetCamPos = new THREE.Vector3(this.playerX * 0.5, this.player.position.y + camOffset.y, this.playerZ + camOffset.z);
        
        this.camera.position.lerp(targetCamPos, dt * 5);
        
        if (this.isBoosting) {
            // Screen shake applied directly to camera for more impact
            const shakeIntensity = 0.3;
            this.camera.position.x += (Math.random() - 0.5) * shakeIntensity;
            this.camera.position.y += (Math.random() - 0.5) * shakeIntensity;
            // FOV change
            const targetFov = (window.innerWidth / window.innerHeight) < 1 ? 110 : 100;
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 8); // Wider FOV, faster transition
        } else {
            const targetFov = (window.innerWidth / window.innerHeight) < 1 ? 80 : 60;
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 5);
        }
        this.camera.updateProjectionMatrix();

        this.camera.lookAt(this.player.position.x, this.player.position.y, this.player.position.z - 10);

        // Speed lines animation
        if (this.speedLines) {
            this.speedLines.position.z = this.playerZ;
            if (this.isBoosting) {
                this.speedLines.material.opacity = Math.min(this.speedLines.material.opacity + dt * 4, 1.0); // Faster fade in, higher max opacity
                const positions = this.speedLines.geometry.attributes.position.array;
                for (let i = 2; i < positions.length; i += 6) {
                    positions[i] -= this.speed * dt * 8; // Faster speed lines
                    positions[i+3] -= this.speed * dt * 8;
                    if (positions[i] < -50) {
                        positions[i] += 100;
                        positions[i+3] += 100;
                    }
                }
                this.speedLines.geometry.attributes.position.needsUpdate = true;
            } else {
                this.speedLines.material.opacity = Math.max(this.speedLines.material.opacity - dt * 3, 0);
            }
        }

        // Update systems
        this.environment.update(this.playerZ, dt);
        this.entities.spawn(this.playerZ, this.level);
        this.entities.update(this.playerZ, dt);
        this.audio.updateEngineSpeed(Math.min(this.speed / 100, 1.0));

        this.checkCollisions();
        const maxBoostTimer = 3 + (this.carStats.boost * 0.5);
        this.callbacks.onUpdate(this.score, this.coins, this.isBoosting, this.boostTimer, maxBoostTimer, this.boostCharge, this.maxBoostCharge);
    }

    checkCollisions() {
        const carBox = new THREE.Box3().setFromObject(this.player);
        // Shrink hitbox slightly for fairness
        carBox.expandByScalar(-0.2);

        // Obstacles
        for (let obs of this.entities.obstacles) {
            if (!obs.visible) continue;
            const obsBox = new THREE.Box3().setFromObject(obs);
            if (carBox.intersectsBox(obsBox)) {
                if (this.isBoosting) {
                    // Destroy obstacle if boosting
                    obs.visible = false;
                    this.audio.playCrash(); // Play crash sound but don't stop
                    this.score += 50;
                } else {
                    this.stop();
                    return;
                }
            }
        }

        // Traffic
        for (let car of this.entities.traffic) {
            if (!car.visible) continue;
            const trafficBox = new THREE.Box3().setFromObject(car);
            if (carBox.intersectsBox(trafficBox)) {
                if (this.isBoosting) {
                    // Destroy traffic if boosting
                    car.visible = false;
                    this.audio.playCrash();
                    this.score += 100;
                } else {
                    this.stop();
                    return;
                }
            }
        }

        // Coins
        for (let coin of this.entities.coins) {
            if (!coin.visible) continue;
            const coinBox = new THREE.Box3().setFromObject(coin);
            if (carBox.intersectsBox(coinBox)) {
                coin.visible = false;
                this.coins += 10;
                this.audio.playCoin();
            }
        }

        // Boosters
        for (let booster of this.entities.boosters) {
            if (!booster.visible) continue;
            const boosterBox = new THREE.Box3().setFromObject(booster);
            if (carBox.intersectsBox(boosterBox)) {
                booster.visible = false;
                this.activateBoost(true);
            }
        }

        // Magnets
        for (let magnet of this.entities.magnets) {
            if (!magnet.visible) continue;
            const magnetBox = new THREE.Box3().setFromObject(magnet);
            if (carBox.intersectsBox(magnetBox)) {
                magnet.visible = false;
                this.activateMagnet();
            }
        }
    }

    activateMagnet() {
        this.isMagnetActive = true;
        this.magnetTimer = 10; // 10 seconds duration
        this.audio.playCoin(); // Play a sound for magnet pickup
        
        // Add visual aura effect
        if (!this.player.getObjectByName('magnetAura')) {
            const auraGeom = new THREE.TorusGeometry(1.5, 0.1, 8, 32);
            const auraMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
            const aura = new THREE.Mesh(auraGeom, auraMat);
            aura.name = 'magnetAura';
            aura.rotation.x = Math.PI / 2;
            aura.position.y = 0.5;
            this.player.add(aura);
        }
    }

    activateBoost(force = false) {
        if (!force && this.boostCharge < this.maxBoostCharge) return;
        this.isBoosting = true;
        this.boostCharge = 0;
        this.boostTimer = 3 + (this.carStats.boost * 0.5); // Boost duration based on upgrade
        this.audio.playBooster();
        
        // Add visual spark effect
        if (!this.player.getObjectByName('spark')) {
            const sparkGeom = new THREE.SphereGeometry(2, 8, 8);
            const sparkMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.5 });
            const spark = new THREE.Mesh(sparkGeom, sparkMat);
            spark.name = 'spark';
            this.player.add(spark);
        }
    }
}

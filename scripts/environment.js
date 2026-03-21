import * as THREE from 'three';

export const curveUniforms = {
    uCurveX: { value: 0.0 },
    uCurveY: { value: 0.0 }
};

export const onBeforeCompileCurve = (shader) => {
    shader.uniforms.uCurveX = curveUniforms.uCurveX;
    shader.uniforms.uCurveY = curveUniforms.uCurveY;
    
    shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        uniform float uCurveX;
        uniform float uCurveY;
        `
    );
    
    shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        
        vec4 mvPosition2 = modelViewMatrix * vec4( transformed, 1.0 );
        float dist = -mvPosition2.z;
        
        if (dist > 0.0) {
            float curveFactor = dist * dist * 0.0001;
            transformed.x += uCurveX * curveFactor;
            transformed.y += uCurveY * curveFactor;
        }
        `
    );
};

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.roadSegments = [];
        this.segmentLength = 100;
        this.numSegments = 5;
        
        this.roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8, metalness: 0.2 });
        this.grassMat = new THREE.MeshStandardMaterial({ color: 0x2d4c1e, roughness: 1.0 });
        this.lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        this.roadMat.onBeforeCompile = onBeforeCompileCurve;
        this.grassMat.onBeforeCompile = onBeforeCompileCurve;
        this.lineMat.onBeforeCompile = onBeforeCompileCurve;

        // Prop Materials
        this.trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
        this.leavesMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });
        this.palmLeavesMat = new THREE.MeshStandardMaterial({ color: 0x32cd32, roughness: 0.6 });
        this.autumnLeavesMat = new THREE.MeshStandardMaterial({ color: 0xd2691e, roughness: 0.8 }); // Chocolate/Orange
        
        // Create a simple window texture for buildings
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#111122';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#ffffaa'; // Window light
        for(let i=4; i<64; i+=12) {
            for(let j=4; j<64; j+=16) {
                if(Math.random() > 0.3) ctx.fillRect(i, j, 6, 8);
            }
        }
        const buildingTex = new THREE.CanvasTexture(canvas);
        buildingTex.wrapS = THREE.RepeatWrapping;
        buildingTex.wrapT = THREE.RepeatWrapping;
        buildingTex.repeat.set(2, 4);

        this.buildingMat = new THREE.MeshStandardMaterial({ 
            color: 0x333344, 
            roughness: 0.5,
            map: buildingTex,
            emissiveMap: buildingTex,
            emissive: 0xffffff,
            emissiveIntensity: 0.5
        });
        
        this.cactusMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.9 });
        this.rockMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
        this.volcanoRockMat = new THREE.MeshStandardMaterial({ color: 0x2a0a0a, roughness: 1.0, emissive: 0x330000 });
        this.asteroidMat = new THREE.MeshStandardMaterial({ color: 0x666677, roughness: 0.8, metalness: 0.4 });
        
        const propMats = [this.trunkMat, this.leavesMat, this.palmLeavesMat, this.autumnLeavesMat, this.buildingMat, this.cactusMat, this.rockMat, this.volcanoRockMat, this.asteroidMat];
        propMats.forEach(mat => mat.onBeforeCompile = onBeforeCompileCurve);

        this.particles = null;

        this.init();
    }

    init() {
        for (let i = 0; i < this.numSegments; i++) {
            this.createSegment(i * -this.segmentLength);
        }
    }

    createSegment(zPos) {
        const group = new THREE.Group();
        group.position.z = zPos;

        // Road
        const roadGeom = new THREE.PlaneGeometry(12, this.segmentLength);
        const road = new THREE.Mesh(roadGeom, this.roadMat);
        road.rotation.x = -Math.PI / 2;
        road.receiveShadow = true;
        group.add(road);

        // Grass Left
        const grassGeom = new THREE.PlaneGeometry(50, this.segmentLength);
        const grassL = new THREE.Mesh(grassGeom, this.grassMat);
        grassL.rotation.x = -Math.PI / 2;
        grassL.position.x = -31;
        grassL.receiveShadow = true;
        group.add(grassL);

        // Grass Right
        const grassR = new THREE.Mesh(grassGeom, this.grassMat);
        grassR.rotation.x = -Math.PI / 2;
        grassR.position.x = 31;
        grassR.receiveShadow = true;
        group.add(grassR);

        // Lane Markings
        for (let i = 0; i < this.segmentLength; i += 4) {
            const lineGeom = new THREE.PlaneGeometry(0.2, 2);
            const lineL = new THREE.Mesh(lineGeom, this.lineMat);
            lineL.rotation.x = -Math.PI / 2;
            lineL.position.set(-2, 0.01, i - this.segmentLength/2);
            
            const lineR = new THREE.Mesh(lineGeom, this.lineMat);
            lineR.rotation.x = -Math.PI / 2;
            lineR.position.set(2, 0.01, i - this.segmentLength/2);
            
            group.add(lineL, lineR);
        }

        // Add Scenery
        this.addSceneryToSegment(group);

        this.scene.add(group);
        this.roadSegments.push(group);
    }

    addSceneryToSegment(group) {
        const numProps = 6; // Props per side per segment
        for (let i = 0; i < numProps; i++) {
            const zOffset = (i / numProps) * this.segmentLength - this.segmentLength / 2;
            
            // Left side
            this.createProp(group, -12 - Math.random() * 20, zOffset + (Math.random() * 5 - 2.5));
            // Right side
            this.createProp(group, 12 + Math.random() * 20, zOffset + (Math.random() * 5 - 2.5));
        }
    }

    createProp(group, x, z) {
        // Tree
        const treeGroup = new THREE.Group();
        const trunkGeom = new THREE.CylinderGeometry(0.5, 0.7, 3);
        const trunk = new THREE.Mesh(trunkGeom, this.trunkMat);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        
        const leavesGeom = new THREE.ConeGeometry(3, 6, 8);
        const leaves = new THREE.Mesh(leavesGeom, this.leavesMat);
        leaves.position.y = 5;
        leaves.castShadow = true;
        treeGroup.add(trunk, leaves);
        treeGroup.position.set(x, 0, z);
        treeGroup.name = "tree";
        treeGroup.visible = false;
        group.add(treeGroup);

        // Palm Tree
        const palmGroup = new THREE.Group();
        const palmTrunkGeom = new THREE.CylinderGeometry(0.4, 0.6, 6);
        const palmTrunk = new THREE.Mesh(palmTrunkGeom, this.trunkMat);
        palmTrunk.position.y = 3;
        palmTrunk.rotation.z = (Math.random() - 0.5) * 0.2;
        palmTrunk.castShadow = true;
        
        const palmLeavesGeom = new THREE.SphereGeometry(2.5, 5, 5);
        const palmLeaves = new THREE.Mesh(palmLeavesGeom, this.palmLeavesMat);
        palmLeaves.position.y = 6;
        palmLeaves.scale.y = 0.5;
        palmLeaves.castShadow = true;
        palmGroup.add(palmTrunk, palmLeaves);
        palmGroup.position.set(x, 0, z);
        palmGroup.name = "palm";
        palmGroup.visible = false;
        group.add(palmGroup);

        // Building
        const height = 20 + Math.random() * 40;
        const width = 8 + Math.random() * 8;
        const depth = 8 + Math.random() * 8;
        const buildingGeom = new THREE.BoxGeometry(width, height, depth);
        const building = new THREE.Mesh(buildingGeom, this.buildingMat);
        building.position.set(x * 1.5, height / 2, z); // Push buildings further back
        building.castShadow = true;
        building.receiveShadow = true;
        building.name = "building";
        building.visible = false;
        group.add(building);

        // Neon Building
        const neonBuildingMat = new THREE.MeshStandardMaterial({ 
            color: 0x111122, 
            emissive: Math.random() > 0.5 ? 0x00ffff : 0xff00ff,
            emissiveIntensity: 0.3,
            roughness: 0.2,
            metalness: 0.8
        });
        neonBuildingMat.onBeforeCompile = onBeforeCompileCurve;
        const neonBuilding = new THREE.Mesh(buildingGeom, neonBuildingMat);
        neonBuilding.position.set(x * 1.5, height / 2, z);
        neonBuilding.name = "neon_building";
        neonBuilding.visible = false;
        group.add(neonBuilding);

        // Cactus
        const cactusGroup = new THREE.Group();
        const cactusGeom = new THREE.CylinderGeometry(0.4, 0.4, 4);
        const cactusMain = new THREE.Mesh(cactusGeom, this.cactusMat);
        cactusMain.position.y = 2;
        cactusMain.castShadow = true;
        cactusGroup.add(cactusMain);
        cactusGroup.position.set(x, 0, z);
        cactusGroup.name = "cactus";
        cactusGroup.visible = false;
        group.add(cactusGroup);
        
        // Rock
        const rockGeom = new THREE.DodecahedronGeometry(2 + Math.random() * 2);
        const rock = new THREE.Mesh(rockGeom, this.rockMat);
        rock.position.set(x, 1, z);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        rock.name = "rock";
        rock.visible = false;
        group.add(rock);

        // Autumn Tree
        const autumnTreeGroup = new THREE.Group();
        const autumnTrunk = new THREE.Mesh(trunkGeom, this.trunkMat);
        autumnTrunk.position.y = 1.5;
        autumnTrunk.castShadow = true;
        const autumnLeaves = new THREE.Mesh(leavesGeom, this.autumnLeavesMat);
        autumnLeaves.position.y = 5;
        autumnLeaves.castShadow = true;
        autumnTreeGroup.add(autumnTrunk, autumnLeaves);
        autumnTreeGroup.position.set(x, 0, z);
        autumnTreeGroup.name = "autumn_tree";
        autumnTreeGroup.visible = false;
        group.add(autumnTreeGroup);

        // Volcano Rock
        const volcanoRock = new THREE.Mesh(rockGeom, this.volcanoRockMat);
        volcanoRock.position.set(x, 1, z);
        volcanoRock.rotation.set(Math.random(), Math.random(), Math.random());
        volcanoRock.castShadow = true;
        volcanoRock.name = "volcano_rock";
        volcanoRock.visible = false;
        group.add(volcanoRock);

        // Asteroid
        const asteroid = new THREE.Mesh(rockGeom, this.asteroidMat);
        asteroid.position.set(x, 5 + Math.random() * 10, z);
        asteroid.rotation.set(Math.random(), Math.random(), Math.random());
        asteroid.castShadow = true;
        asteroid.name = "asteroid";
        asteroid.visible = false;
        group.add(asteroid);
    }

    setLevel(level, dirLight, ambientLight) {
        // Reset road segments positions
        this.roadSegments.forEach((seg, i) => {
            seg.position.z = i * -this.segmentLength;
        });

        // Remove old particles
        if (this.particles) {
            this.scene.remove(this.particles);
            this.particles = null;
        }

        let bgColor = 0x87ceeb;
        let fogDensity = 150;
        let fogNear = 50;

        switch(level) {
            case 1: // Sunny Highway
                bgColor = 0x87ceeb;
                this.grassMat.color.setHex(0x2d4c1e);
                this.roadMat.roughness = 0.8;
                this.roadMat.metalness = 0.2;
                dirLight.intensity = 0.8;
                ambientLight.intensity = 0.6;
                break;
            case 2: // Desert Road
                bgColor = 0xedc9af;
                this.grassMat.color.setHex(0xc2b280);
                this.roadMat.roughness = 0.9;
                dirLight.color.setHex(0xffddaa);
                dirLight.intensity = 1.0;
                ambientLight.intensity = 0.7;
                break;
            case 3: // Rainy Road
                bgColor = 0x555566;
                this.grassMat.color.setHex(0x1a2e11);
                this.roadMat.roughness = 0.1; // Wet road
                this.roadMat.metalness = 0.8;
                dirLight.intensity = 0.3;
                ambientLight.intensity = 0.4;
                this.createRain();
                break;
            case 4: // Foggy Road
                bgColor = 0xcccccc;
                this.grassMat.color.setHex(0x334433);
                fogDensity = 60;
                fogNear = 10;
                dirLight.intensity = 0.2;
                ambientLight.intensity = 0.8;
                break;
            case 5: // Night Highway
                bgColor = 0x050510;
                this.grassMat.color.setHex(0x0a1107);
                dirLight.intensity = 0.1;
                ambientLight.intensity = 0.1;
                fogDensity = 80;
                break;
            case 6: // City Highway
                bgColor = 0x110022;
                this.grassMat.color.setHex(0x111111);
                dirLight.intensity = 0.2;
                ambientLight.intensity = 0.3;
                fogDensity = 120;
                break;
            case 7: // Mountain Pass (simulate with darker colors and fog for now)
                bgColor = 0x445566;
                this.grassMat.color.setHex(0x3d4c3e);
                dirLight.intensity = 0.6;
                fogDensity = 100;
                break;
            case 8: // Speed Storm
                bgColor = 0x221133;
                this.grassMat.color.setHex(0x110011);
                this.roadMat.roughness = 0.2;
                dirLight.intensity = 0.4;
                ambientLight.intensity = 0.2;
                fogDensity = 90;
                this.createRain(true);
                break;
            case 9: // Neon Cyberpunk
                bgColor = 0x0a0a1a;
                this.grassMat.color.setHex(0x050510);
                this.roadMat.roughness = 0.3;
                this.roadMat.metalness = 0.9;
                dirLight.color.setHex(0xff00ff);
                dirLight.intensity = 0.8;
                ambientLight.intensity = 0.4;
                fogDensity = 120;
                break;
            case 10: // Snowy Tundra
                bgColor = 0xeeeeff;
                this.grassMat.color.setHex(0xffffff);
                this.roadMat.roughness = 0.7;
                this.roadMat.metalness = 0.1;
                dirLight.color.setHex(0xffffff);
                dirLight.intensity = 0.9;
                ambientLight.intensity = 0.8;
                fogDensity = 80;
                this.createSnow();
                break;
            case 11: // Volcanic Ash
                bgColor = 0x330000;
                this.grassMat.color.setHex(0x1a0000);
                this.roadMat.roughness = 0.9;
                this.roadMat.metalness = 0.1;
                dirLight.color.setHex(0xffaa00);
                dirLight.intensity = 0.6;
                ambientLight.intensity = 0.3;
                fogDensity = 70;
                this.createAsh();
                break;
            case 12: // Autumn Forest
                bgColor = 0xcc7722;
                this.grassMat.color.setHex(0x8b4513);
                this.roadMat.roughness = 0.8;
                this.roadMat.metalness = 0.1;
                dirLight.color.setHex(0xffcc88);
                dirLight.intensity = 0.8;
                ambientLight.intensity = 0.6;
                fogDensity = 100;
                break;
            case 13: // Galactic Void
                bgColor = 0x000000;
                this.grassMat.color.setHex(0x000000);
                this.roadMat.roughness = 0.5;
                this.roadMat.metalness = 0.5;
                dirLight.color.setHex(0x8888ff);
                dirLight.intensity = 0.5;
                ambientLight.intensity = 0.2;
                fogDensity = 200;
                this.createStars();
                break;
            case 14: // Beach
                bgColor = 0x87ceeb; // Sky blue
                this.grassMat.color.setHex(0xf4a460); // Sandy color
                this.roadMat.roughness = 0.7;
                this.roadMat.metalness = 0.1;
                dirLight.color.setHex(0xffffff);
                dirLight.intensity = 0.9;
                ambientLight.intensity = 0.6;
                fogDensity = 150;
                break;
            default:
                bgColor = 0x87ceeb;
        }

        this.scene.background = new THREE.Color(bgColor);
        this.scene.fog.color.setHex(bgColor);
        this.scene.fog.far = fogDensity;
        this.scene.fog.near = fogNear;

        this.currentLevel = level;
        this.weatherTimer = 0;
        this.baseFogDensity = fogDensity;
        this.baseFogNear = fogNear;
        
        // Dynamic weather state
        this.dynamicWeatherType = 'none'; // 'none', 'rain', 'snow', 'fog'
        this.weatherTransition = 0; // 0 to 1
        this.weatherDuration = 0;
        this.weatherTarget = 'none';

        // Toggle scenery
        this.roadSegments.forEach(seg => {
            seg.children.forEach(child => {
                if (child.name) {
                    child.visible = false; // Reset all
                    
                    if (level === 1 && child.name === "tree") child.visible = true; // Sunny Highway
                    else if (level === 2 && (child.name === "cactus" || child.name === "rock")) child.visible = true; // Desert
                    else if (level === 3 && child.name === "tree") child.visible = true; // Rainy
                    else if (level === 4 && child.name === "tree") child.visible = true; // Foggy
                    else if (level === 5 && child.name === "tree") child.visible = true; // Night
                    else if (level === 6 && child.name === "building") child.visible = true; // City
                    else if (level === 7 && (child.name === "tree" || child.name === "rock")) child.visible = true; // Mountain
                    else if (level === 8 && child.name === "tree") child.visible = true; // Storm
                    else if (level === 9 && child.name === "neon_building") child.visible = true; // Cyberpunk
                    else if (level === 10 && (child.name === "tree" || child.name === "rock")) child.visible = true; // Snow
                    else if (level === 11 && child.name === "volcano_rock") child.visible = true; // Volcano
                    else if (level === 12 && child.name === "autumn_tree") child.visible = true; // Autumn
                    else if (level === 13 && child.name === "asteroid") child.visible = true; // Galactic
                    else if (level === 14 && (child.name === "palm" || child.name === "rock")) child.visible = true; // Beach
                    
                    // Add palm trees to level 1 and 2 occasionally
                    if ((level === 1 || level === 2 || level === 14) && child.name === "palm" && Math.random() > 0.5) {
                        child.visible = true;
                    }
                }
            });
        });
    }

    createRain(isStorm = false) {
        const particleCount = isStorm ? 3000 : 1500;
        const geom = new THREE.BufferGeometry();
        const pos = new Float32Array(particleCount * 6);
        for(let i=0; i<particleCount*6; i+=6) {
            const x = (Math.random() - 0.5) * 100;
            const y = Math.random() * 50;
            const z = (Math.random() - 0.5) * 100;
            pos[i] = x;
            pos[i+1] = y;
            pos[i+2] = z;
            pos[i+3] = x + 0.5; // Slanted rain
            pos[i+4] = y - 2.0; // Length of rain drop
            pos[i+5] = z;
        }
        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.LineBasicMaterial({
            color: 0xaaaaaa,
            transparent: true,
            opacity: 0.6
        });
        this.particles = new THREE.LineSegments(geom, mat);
        this.particles.userData = { type: 'rain', speed: isStorm ? 2 : 1 };
        this.scene.add(this.particles);
    }

    createSnow() {
        const particleCount = 2000;
        const geom = new THREE.BufferGeometry();
        const pos = new Float32Array(particleCount * 3);
        for(let i=0; i<particleCount*3; i+=3) {
            pos[i] = (Math.random() - 0.5) * 100;
            pos[i+1] = Math.random() * 50;
            pos[i+2] = (Math.random() - 0.5) * 100;
        }
        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.3,
            transparent: true,
            opacity: 0.8
        });
        this.particles = new THREE.Points(geom, mat);
        this.particles.userData = { type: 'snow', speed: 0.5 };
        this.scene.add(this.particles);
    }

    createAsh() {
        const particleCount = 1500;
        const geom = new THREE.BufferGeometry();
        const pos = new Float32Array(particleCount * 3);
        for(let i=0; i<particleCount*3; i+=3) {
            pos[i] = (Math.random() - 0.5) * 100;
            pos[i+1] = Math.random() * 50;
            pos[i+2] = (Math.random() - 0.5) * 100;
        }
        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0x553333,
            size: 0.4,
            transparent: true,
            opacity: 0.7
        });
        this.particles = new THREE.Points(geom, mat);
        this.particles.userData = { type: 'ash', speed: 0.3 };
        this.scene.add(this.particles);
    }

    createStars() {
        const particleCount = 3000;
        const geom = new THREE.BufferGeometry();
        const pos = new Float32Array(particleCount * 3);
        for(let i=0; i<particleCount*3; i+=3) {
            pos[i] = (Math.random() - 0.5) * 200;
            pos[i+1] = Math.random() * 100;
            pos[i+2] = (Math.random() - 0.5) * 200;
        }
        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.2,
            transparent: true,
            opacity: 0.9
        });
        this.particles = new THREE.Points(geom, mat);
        this.particles.userData = { type: 'stars', speed: 0 };
        this.scene.add(this.particles);
    }

    update(playerZ, dt) {
        this.weatherTimer += dt;
        
        // Generic dynamic weather transitions
        const hasSpecificWeather = [3, 4, 8, 10, 11, 13].includes(this.currentLevel);
        
        if (!hasSpecificWeather) {
            if (this.weatherDuration <= 0) {
                // Pick a new weather target
                const r = Math.random();
                if (r < 0.6) this.weatherTarget = 'none';
                else if (r < 0.75) this.weatherTarget = 'rain';
                else if (r < 0.9) this.weatherTarget = 'fog';
                else this.weatherTarget = 'snow';
                
                this.weatherDuration = 20 + Math.random() * 30; // 20-50 seconds
            } else {
                this.weatherDuration -= dt;
            }

            // Transition towards target
            if (this.dynamicWeatherType !== this.weatherTarget) {
                this.weatherTransition -= dt * 0.2; // 5 seconds to fade out
                if (this.weatherTransition <= 0) {
                    this.weatherTransition = 0;
                    this.dynamicWeatherType = this.weatherTarget;
                    
                    // Remove old particles
                    if (this.particles && this.particles.userData.type !== 'stars' && this.particles.userData.type !== 'ash') {
                        this.scene.remove(this.particles);
                        this.particles = null;
                    }
                    
                    // Add new particles if needed
                    if (!this.particles) {
                        if (this.dynamicWeatherType === 'rain') {
                            this.createRain();
                            if (this.particles) this.particles.material.opacity = 0;
                        } else if (this.dynamicWeatherType === 'snow') {
                            this.createSnow();
                            if (this.particles) this.particles.material.opacity = 0;
                        }
                    }
                }
            } else {
                this.weatherTransition += dt * 0.2;
                if (this.weatherTransition > 1) this.weatherTransition = 1;
            }
        }

        // Apply generic dynamic weather effects
        let currentFogFar = this.baseFogDensity;
        let currentFogNear = this.baseFogNear;
        
        if (this.dynamicWeatherType === 'fog') {
            currentFogFar -= 80 * this.weatherTransition;
            currentFogNear -= 20 * this.weatherTransition;
        } else if (this.dynamicWeatherType === 'rain' || this.dynamicWeatherType === 'snow') {
            currentFogFar -= 40 * this.weatherTransition;
            currentFogNear -= 10 * this.weatherTransition;
            if (this.particles && this.particles.material && this.particles.userData.type === this.dynamicWeatherType) {
                this.particles.material.opacity = 0.6 * this.weatherTransition;
            }
        }

        // Level specific dynamic weather effects
        if (this.currentLevel === 3 || this.currentLevel === 8) { // Rainy Road or Speed Storm
            const intensity = (Math.sin(this.weatherTimer * 0.5) + 1) / 2; // 0 to 1
            currentFogFar = this.baseFogDensity - (intensity * 40);
            currentFogNear = Math.max(5, this.baseFogNear - (intensity * 20));
            
            if (this.particles && this.particles.material) {
                this.particles.material.opacity = 0.3 + (intensity * 0.5);
                this.particles.userData.speed = (this.currentLevel === 8 ? 2 : 1) + (intensity * 1.5);
            }
            
            // Lightning effect
            if (Math.random() < 0.005 * (intensity + 0.5)) {
                this.scene.background.setHex(0xffffff);
                this.scene.fog.color.setHex(0xffffff);
                setTimeout(() => {
                    this.scene.background.setHex(this.currentLevel === 8 ? 0x221133 : 0x555566);
                    this.scene.fog.color.setHex(this.currentLevel === 8 ? 0x221133 : 0x555566);
                }, 100);
            }
        } else if (this.currentLevel === 10) { // Snowy Tundra
            const intensity = (Math.sin(this.weatherTimer * 0.3) + 1) / 2; // 0 to 1
            currentFogFar = this.baseFogDensity - (intensity * 30);
            currentFogNear = Math.max(5, this.baseFogNear - (intensity * 10));
            
            if (this.particles && this.particles.material) {
                this.particles.material.opacity = 0.5 + (intensity * 0.5);
                this.particles.userData.speed = 0.5 + (intensity * 1.0);
            }
        } else if (this.currentLevel === 4) { // Foggy Road
            const intensity = (Math.sin(this.weatherTimer * 0.2) + 1) / 2; // 0 to 1
            currentFogFar = this.baseFogDensity - (intensity * 30);
            currentFogNear = Math.max(5, this.baseFogNear - (intensity * 5));
        } else if (this.currentLevel === 11) { // Volcanic Ash
            const intensity = (Math.sin(this.weatherTimer * 0.4) + 1) / 2; // 0 to 1
            currentFogFar = this.baseFogDensity - (intensity * 20);
            
            if (this.particles && this.particles.material) {
                this.particles.material.opacity = 0.6 + (intensity * 0.4);
                this.particles.userData.speed = 0.3 + (intensity * 0.5);
            }
        }
        
        this.scene.fog.far = Math.max(20, currentFogFar);
        this.scene.fog.near = Math.max(5, currentFogNear);

        // Update curve uniforms based on player position
        // This creates a winding road effect
        curveUniforms.uCurveX.value = Math.sin(playerZ * 0.003) * 3.0;
        curveUniforms.uCurveY.value = Math.cos(playerZ * 0.002) * 1.5 + 0.5;

        this.roadSegments.forEach(seg => {
            if (seg.position.z > playerZ + this.segmentLength) {
                seg.position.z -= this.segmentLength * this.numSegments;
            }
        });

        if (this.particles) {
            this.particles.position.z = playerZ;
            const type = this.particles.userData.type;
            const speedMultiplier = this.particles.userData.speed || 1;
            
            if (type !== 'stars') {
                const positions = this.particles.geometry.attributes.position.array;
                if (type === 'rain') {
                    for(let i=0; i<positions.length; i+=6) {
                        // Move both vertices down
                        positions[i+1] -= 40 * speedMultiplier * dt;
                        positions[i+4] -= 40 * speedMultiplier * dt;
                        
                        // Move both vertices sideways
                        positions[i] += 10 * dt;
                        positions[i+3] += 10 * dt;
                        
                        // Reset if below ground or out of bounds
                        if (positions[i+4] < 0 || positions[i] > 50) {
                            const x = (Math.random() - 0.5) * 100;
                            const y = 50 + Math.random() * 10;
                            const z = positions[i+2]; // keep z
                            
                            positions[i] = x;
                            positions[i+1] = y;
                            positions[i+3] = x + 0.5;
                            positions[i+4] = y - 2.0;
                        }
                    }
                } else {
                    for(let i=1; i<positions.length; i+=3) {
                        positions[i] -= 20 * speedMultiplier * dt;
                        if (positions[i] < 0) positions[i] = 50;
                        
                        if (type === 'snow' || type === 'ash') {
                            positions[i-1] += Math.sin(this.weatherTimer * 0.5 + positions[i]) * 5 * dt;
                            if (positions[i-1] > 50) positions[i-1] -= 100;
                            else if (positions[i-1] < -50) positions[i-1] += 100;
                        }
                    }
                }
                this.particles.geometry.attributes.position.needsUpdate = true;
            } else {
                this.particles.rotation.y += 0.05 * dt;
            }
        }
    }
}

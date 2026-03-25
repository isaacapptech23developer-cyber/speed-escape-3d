import * as THREE from 'three';

export function createCarMesh(colorHex, carId = 'falcon') {
    const group = new THREE.Group();

    // Materials
    const bodyMat = new THREE.MeshPhysicalMaterial({
        color: colorHex,
        metalness: carId === 'neon' ? 0.9 : 0.7,
        roughness: carId === 'neon' ? 0.1 : 0.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        emissive: carId === 'neon' ? colorHex : 0x000000,
        emissiveIntensity: carId === 'neon' ? 0.5 : 0
    });
    
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x111111,
        metalness: 0.9,
        roughness: 0.1,
        transmission: 0.5,
        transparent: true
    });

    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 });
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 });

    // Lower Body
    let lowerBodyGeom;
    if (carId === 'storm') {
        lowerBodyGeom = new THREE.BoxGeometry(2.1, 0.4, 4.8);
    } else if (carId === 'thunder') {
        lowerBodyGeom = new THREE.BoxGeometry(2.2, 0.35, 5.0);
    } else if (carId === 'desert') {
        lowerBodyGeom = new THREE.BoxGeometry(2.4, 0.6, 4.2);
    } else if (carId === 'neon') {
        lowerBodyGeom = new THREE.BoxGeometry(2.0, 0.3, 4.6);
    } else {
        lowerBodyGeom = new THREE.BoxGeometry(2, 0.5, 4.5);
    }
    const lowerBody = new THREE.Mesh(lowerBodyGeom, bodyMat);
    lowerBody.position.y = carId === 'desert' ? 0.6 : 0.4;
    lowerBody.castShadow = true;
    group.add(lowerBody);

    // Cabin (Glass)
    let cabinGeom;
    if (carId === 'storm') {
        cabinGeom = new THREE.BoxGeometry(1.5, 0.5, 2.0);
    } else if (carId === 'thunder') {
        cabinGeom = new THREE.BoxGeometry(1.4, 0.4, 1.8);
    } else if (carId === 'desert') {
        cabinGeom = new THREE.BoxGeometry(1.8, 0.7, 2.0);
    } else if (carId === 'neon') {
        cabinGeom = new THREE.BoxGeometry(1.6, 0.4, 2.4);
    } else {
        cabinGeom = new THREE.BoxGeometry(1.6, 0.6, 2.2);
    }
    const cabin = new THREE.Mesh(cabinGeom, glassMat);
    cabin.position.set(0, carId === 'desert' ? 1.25 : 0.95, carId === 'thunder' ? 0.2 : -0.2);
    cabin.castShadow = true;
    group.add(cabin);

    // Roof
    let roofGeom;
    if (carId === 'storm') {
        roofGeom = new THREE.BoxGeometry(1.55, 0.05, 2.05);
    } else if (carId === 'thunder') {
        roofGeom = new THREE.BoxGeometry(1.45, 0.05, 1.85);
    } else if (carId === 'desert') {
        roofGeom = new THREE.BoxGeometry(1.85, 0.05, 2.05);
    } else if (carId === 'neon') {
        roofGeom = new THREE.BoxGeometry(1.65, 0.05, 2.45);
    } else {
        roofGeom = new THREE.BoxGeometry(1.65, 0.05, 2.25);
    }
    const roof = new THREE.Mesh(roofGeom, bodyMat);
    roof.position.set(0, carId === 'desert' ? 1.6 : 1.25, carId === 'thunder' ? 0.2 : -0.2);
    roof.castShadow = true;
    group.add(roof);

    // Spoiler
    if (carId !== 'desert') {
        let spoilerGeom;
        if (carId === 'thunder') {
            spoilerGeom = new THREE.BoxGeometry(2.2, 0.1, 0.6);
        } else if (carId === 'neon') {
            spoilerGeom = new THREE.BoxGeometry(2.0, 0.1, 0.5);
        } else {
            spoilerGeom = new THREE.BoxGeometry(1.8, 0.1, 0.4);
        }
        const spoiler = new THREE.Mesh(spoilerGeom, bodyMat);
        spoiler.position.set(0, carId === 'thunder' ? 0.9 : 1.1, carId === 'thunder' ? 2.2 : 2.0);
        spoiler.castShadow = true;
        group.add(spoiler);
        
        const strutGeom = new THREE.BoxGeometry(0.1, 0.3, 0.1);
        const strutL = new THREE.Mesh(strutGeom, darkMat);
        strutL.position.set(-0.6, carId === 'thunder' ? 0.65 : 0.85, carId === 'thunder' ? 2.2 : 2.0);
        const strutR = new THREE.Mesh(strutGeom, darkMat);
        strutR.position.set(0.6, carId === 'thunder' ? 0.65 : 0.85, carId === 'thunder' ? 2.2 : 2.0);
        group.add(strutL, strutR);
    }

    // Headlights
    const hlGeom = new THREE.BoxGeometry(0.4, 0.15, 0.1);
    const hlL = new THREE.Mesh(hlGeom, headlightMat);
    hlL.position.set(-0.7, 0.5, -2.26);
    const hlR = new THREE.Mesh(hlGeom, headlightMat);
    hlR.position.set(0.7, 0.5, -2.26);
    group.add(hlL, hlR);

    // Taillights
    const tlGeom = new THREE.BoxGeometry(0.5, 0.15, 0.1);
    const tlL = new THREE.Mesh(tlGeom, taillightMat);
    tlL.position.set(-0.6, 0.5, 2.26);
    const tlR = new THREE.Mesh(tlGeom, taillightMat);
    tlR.position.set(0.6, 0.5, 2.26);
    group.add(tlL, tlR);

    // Wheels
    const wheelRadius = 0.35;
    const wheelThickness = 0.3;
    const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 16);
    wheelGeom.rotateZ(Math.PI / 2);
    
    const rimGeom = new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, wheelThickness + 0.02, 8);
    rimGeom.rotateZ(Math.PI / 2);

    const wheelPositions = [
        [-1.0, 0.35, -1.4], // Front Left
        [ 1.0, 0.35, -1.4], // Front Right
        [-1.0, 0.35,  1.4], // Rear Left
        [ 1.0, 0.35,  1.4]  // Rear Right
    ];

    const wheels = [];

    wheelPositions.forEach(pos => {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(pos[0], pos[1], pos[2]);
        
        const tire = new THREE.Mesh(wheelGeom, wheelMat);
        tire.castShadow = true;
        
        const rim = new THREE.Mesh(rimGeom, rimMat);
        
        wheelGroup.add(tire);
        wheelGroup.add(rim);
        group.add(wheelGroup);
        wheels.push(wheelGroup);
    });

    // Add a reference to wheels for animation
    group.userData.wheels = wheels;

    return group;
}

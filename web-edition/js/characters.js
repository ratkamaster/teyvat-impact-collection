// Party Characters Definition and 3D Model Generators
class Character {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.title = config.title;
        this.element = config.element;
        this.avatarColor = config.avatarColor;
        this.maxHp = config.maxHp;
        this.hp = config.maxHp;
        this.atk = config.atk;
        this.def = config.def;
        this.critRate = 0.25;
        this.critDmg = 1.6;

        this.energy = 30;
        this.maxEnergy = 60;
        this.skillCooldown = 0;
        this.maxSkillCooldown = config.skillCd || 6.0;

        this.model = null;
        this.weaponMesh = null;
        this.config = config;
    }

    isSkillReady() {
        return this.skillCooldown <= 0;
    }

    isBurstReady() {
        return this.energy >= this.maxEnergy;
    }

    update(delta) {
        if (this.skillCooldown > 0) {
            this.skillCooldown = Math.max(0, this.skillCooldown - delta);
        }
    }

    addEnergy(amount) {
        this.energy = Math.min(this.maxEnergy, this.energy + amount);
    }
}

class CharacterFactory {
    static createParty() {
        return [
            new Character({
                id: 1,
                name: 'Kaelen',
                title: 'Flame of Dawn',
                element: Elements.PYRO,
                avatarColor: '#ff5c28',
                maxHp: 12500,
                atk: 1450,
                def: 820,
                skillCd: 6.0
            }),
            new Character({
                id: 2,
                name: 'Marina',
                title: 'Starlit Tide',
                element: Elements.HYDRO,
                avatarColor: '#1ec6ff',
                maxHp: 11200,
                atk: 1180,
                def: 780,
                skillCd: 7.5
            }),
            new Character({
                id: 3,
                name: 'Raiko',
                title: 'Eternal Lightning',
                element: Elements.ELECTRO,
                avatarColor: '#c469ff',
                maxHp: 11900,
                atk: 1540,
                def: 790,
                skillCd: 6.5
            }),
            new Character({
                id: 4,
                name: 'Ventus',
                title: 'Wandering Zephyr',
                element: Elements.ANEMO,
                avatarColor: '#4af5b0',
                maxHp: 10800,
                atk: 1290,
                def: 760,
                skillCd: 5.5
            })
        ];
    }

    // Build stylized 3D anime-inspired avatar mesh with weapons and clothing
    static buildMeshForCharacter(char) {
        const group = new THREE.Group();

        // Palette based on element
        let outfitColor, hairColor, weaponColor, accentColor;
        switch (char.element) {
            case Elements.PYRO:
                outfitColor = 0x2b2024;
                hairColor = 0xcc2914;
                weaponColor = 0xff4500;
                accentColor = 0xe5a93b;
                break;
            case Elements.HYDRO:
                outfitColor = 0x1a2e40;
                hairColor = 0x2979ff;
                weaponColor = 0x00e5ff;
                accentColor = 0xbbdefb;
                break;
            case Elements.ELECTRO:
                outfitColor = 0x221330;
                hairColor = 0x8e24aa;
                weaponColor = 0xd500f9;
                accentColor = 0xe1bee7;
                break;
            case Elements.ANEMO:
                outfitColor = 0x1b3b2b;
                hairColor = 0x00bfa5;
                weaponColor = 0x69f0ae;
                accentColor = 0xa7ffeb;
                break;
            default:
                outfitColor = 0x333333;
                hairColor = 0xdddddd;
                weaponColor = 0xffffff;
                accentColor = 0xffd700;
        }

        const skinMat = new THREE.MeshLambertMaterial({ color: 0xffdfc4 });
        const outfitMat = new THREE.MeshLambertMaterial({ color: outfitColor });
        const hairMat = new THREE.MeshLambertMaterial({ color: hairColor });
        const accentMat = new THREE.MeshLambertMaterial({ color: accentColor });
        const weaponMat = new THREE.MeshStandardMaterial({
            color: weaponColor,
            emissive: weaponColor,
            emissiveIntensity: 0.35,
            metalness: 0.8,
            roughness: 0.2
        });

        // 1. Torso
        const torsoGeom = new THREE.CylinderGeometry(0.28, 0.22, 0.7, 8);
        const torso = new THREE.Mesh(torsoGeom, outfitMat);
        torso.position.y = 1.05;
        group.add(torso);

        // 2. Belt / Sash
        const beltGeom = new THREE.CylinderGeometry(0.29, 0.29, 0.1, 8);
        const belt = new THREE.Mesh(beltGeom, accentMat);
        belt.position.y = 0.75;
        group.add(belt);

        // 3. Head
        const headGeom = new THREE.SphereGeometry(0.26, 12, 12);
        const head = new THREE.Mesh(headGeom, skinMat);
        head.position.y = 1.6;
        group.add(head);

        // Anime Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const eyeGeom = new THREE.BoxGeometry(0.04, 0.05, 0.02);
        const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
        leftEye.position.set(-0.09, 1.62, 0.24);
        const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
        rightEye.position.set(0.09, 1.62, 0.24);
        group.add(leftEye);
        group.add(rightEye);

        // Anime Hair
        const hairTopGeom = new THREE.SphereGeometry(0.29, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const hairTop = new THREE.Mesh(hairTopGeom, hairMat);
        hairTop.position.y = 1.68;
        group.add(hairTop);

        // Hair spikes / fringe
        const hairSpikeGeom = new THREE.ConeGeometry(0.09, 0.35, 4);
        for (let i = -2; i <= 2; i++) {
            const spike = new THREE.Mesh(hairSpikeGeom, hairMat);
            spike.position.set(i * 0.08, 1.65, 0.22);
            spike.rotation.x = 0.4;
            spike.rotation.z = -i * 0.15;
            group.add(spike);
        }

        // 4. Cape / Scarf
        const capeGeom = new THREE.BoxGeometry(0.48, 0.85, 0.04);
        const cape = new THREE.Mesh(capeGeom, accentMat);
        cape.position.set(0, 0.95, -0.22);
        cape.rotation.x = 0.12;
        group.add(cape);
        group.capeMesh = cape;

        // 5. Legs
        const legGeom = new THREE.CylinderGeometry(0.09, 0.07, 0.7, 6);
        const leftLeg = new THREE.Mesh(legGeom, outfitMat);
        leftLeg.position.set(-0.14, 0.35, 0);
        const rightLeg = new THREE.Mesh(legGeom, outfitMat);
        rightLeg.position.set(0.14, 0.35, 0);
        group.add(leftLeg);
        group.add(rightLeg);
        group.leftLeg = leftLeg;
        group.rightLeg = rightLeg;

        // 6. Arms
        const armGeom = new THREE.CylinderGeometry(0.07, 0.06, 0.6, 6);
        const leftArm = new THREE.Mesh(armGeom, skinMat);
        leftArm.position.set(-0.35, 1.05, 0);
        const rightArm = new THREE.Mesh(armGeom, skinMat);
        rightArm.position.set(0.35, 1.05, 0);
        group.add(leftArm);
        group.add(rightArm);
        group.leftArm = leftArm;
        group.rightArm = rightArm;

        // 7. Weapon (Claymore, Katana, Sword, Catalyst)
        const weaponGroup = new THREE.Group();
        if (char.element === Elements.PYRO) {
            // Greatsword / Claymore
            const bladeGeom = new THREE.BoxGeometry(0.14, 1.25, 0.04);
            const blade = new THREE.Mesh(bladeGeom, weaponMat);
            blade.position.y = 0.7;
            const hiltGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6);
            const hilt = new THREE.Mesh(hiltGeom, accentMat);
            weaponGroup.add(blade);
            weaponGroup.add(hilt);
        } else {
            // Katana / Sword
            const bladeGeom = new THREE.BoxGeometry(0.07, 1.0, 0.02);
            const blade = new THREE.Mesh(bladeGeom, weaponMat);
            blade.position.y = 0.55;
            const hiltGeom = new THREE.CylinderGeometry(0.035, 0.035, 0.25, 6);
            const hilt = new THREE.Mesh(hiltGeom, accentMat);
            weaponGroup.add(blade);
            weaponGroup.add(hilt);
        }

        weaponGroup.position.set(0.42, 0.8, 0.2);
        weaponGroup.rotation.x = Math.PI / 4;
        group.add(weaponGroup);
        group.weaponMesh = weaponGroup;

        // 8. Wind Glider Wings (Hidden by default, shown during glide)
        const gliderGroup = new THREE.Group();
        const wingMat = new THREE.MeshBasicMaterial({ color: 0x26c6da, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
        const leftWingGeom = new THREE.PlaneGeometry(1.6, 0.7);
        const leftWing = new THREE.Mesh(leftWingGeom, wingMat);
        leftWing.position.set(-0.9, 0, 0);
        leftWing.rotation.z = 0.2;
        const rightWingGeom = new THREE.PlaneGeometry(1.6, 0.7);
        const rightWing = new THREE.Mesh(rightWingGeom, wingMat);
        rightWing.position.set(0.9, 0, 0);
        rightWing.rotation.z = -0.2;
        gliderGroup.add(leftWing);
        gliderGroup.add(rightWing);
        gliderGroup.position.set(0, 1.4, -0.3);
        gliderGroup.visible = false;
        group.add(gliderGroup);
        group.glider = gliderGroup;

        // Shadow caster
        group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        return group;
    }
}

window.CharacterFactory = CharacterFactory;

// World Environment: Terrain, Ruins, Chests, Anemoculus, Monuments, and Water
class GameWorld {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.interactables = [];
        this.colliders = [];
        this.windCurrents = [];

        this.buildTerrain();
        this.buildSkyAndAtmosphere();
        this.buildFloraAndRuins();
        this.buildInteractables();
    }

    // Mathematical height function for rolling hills
    getHeight(x, z) {
        // Flat center for combat arena, rolling hills around
        const d = Math.sqrt(x * x + z * z);
        let h = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 3.5;
        h += Math.sin(x * 0.12 + 1.2) * 1.5;

        // Flatten the center area
        if (d < 25) {
            const factor = d / 25;
            h *= (factor * factor);
        }

        // River/pond dip at x: 25-45, z: -10-20
        const lakeDist = Math.hypot(x - 30, z - 10);
        if (lakeDist < 16) {
            h -= (16 - lakeDist) * 0.25;
        }

        return Math.max(-0.5, h);
    }

    buildTerrain() {
        const size = 300;
        const segments = 90;
        const geom = new THREE.PlaneGeometry(size, size, segments, segments);
        geom.rotateX(-Math.PI / 2);

        const pos = geom.attributes.position;
        const colors = [];
        const baseGrass = new THREE.Color(0x5cb85c);
        const hillGrass = new THREE.Color(0x76c758);
        const stonePath = new THREE.Color(0x9e9e9e);
        const sand = new THREE.Color(0xe0d0a4);

        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vz = pos.getZ(i);
            const vy = this.getHeight(vx, vz);
            pos.setY(i, vy);

            // Vertex coloring based on height and position
            const col = new THREE.Color();
            if (vy < 0.2) {
                col.copy(sand);
            } else if (vy > 4.0) {
                col.copy(stonePath).lerp(hillGrass, 0.4);
            } else {
                col.copy(baseGrass).lerp(hillGrass, Math.random() * 0.35);
            }
            colors.push(col.r, col.g, col.b);
        }

        geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geom.computeVertexNormals();

        const mat = new THREE.MeshLambertMaterial({
            vertexColors: true,
            roughness: 0.8
        });

        const terrain = new THREE.Mesh(geom, mat);
        terrain.receiveShadow = true;
        this.scene.add(terrain);
        this.terrainMesh = terrain;

        // Water plane for lake
        const waterGeom = new THREE.CircleGeometry(16, 32);
        waterGeom.rotateX(-Math.PI / 2);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x00b4d8,
            transparent: true,
            opacity: 0.75,
            roughness: 0.1,
            metalness: 0.4
        });
        const water = new THREE.Mesh(waterGeom, waterMat);
        water.position.set(30, 0.1, 10);
        this.scene.add(water);
        this.waterMesh = water;
    }

    buildSkyAndAtmosphere() {
        // Sky dome with Genshin-style vibrant blue / pastel horizon
        const skyGeom = new THREE.SphereGeometry(350, 24, 24);
        const skyMat = new THREE.MeshBasicMaterial({
            color: 0x64b5f6,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeom, skyMat);
        this.scene.add(sky);

        // Warm directional sunlight
        const sun = new THREE.DirectionalLight(0xfff7e6, 1.3);
        sun.position.set(60, 100, 40);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 250;
        const d = 50;
        sun.shadow.camera.left = -d;
        sun.shadow.camera.right = d;
        sun.shadow.camera.top = d;
        sun.shadow.camera.bottom = -d;
        this.scene.add(sun);

        // Ambient daylight fill
        const hemi = new THREE.HemisphereLight(0xdbeeff, 0x5a8f4c, 0.7);
        this.scene.add(hemi);

        // Soft fog
        this.scene.fog = new THREE.FogExp2(0xbbe1fa, 0.005);
    }

    buildFloraAndRuins() {
        // Tree foliage and trunk materials
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
        const foliageMat = new THREE.MeshLambertMaterial({ color: 0x388e3c });
        const pineMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
        const ruinMat = new THREE.MeshLambertMaterial({ color: 0xb0bec5 });

        // Scatter trees around terrain (avoiding center arena)
        for (let i = 0; i < 65; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 18 + Math.random() * 90;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            const y = this.getHeight(x, z);

            const treeGroup = new THREE.Group();
            const trunkGeom = new THREE.CylinderGeometry(0.3, 0.5, 3.5, 6);
            const trunk = new THREE.Mesh(trunkGeom, trunkMat);
            trunk.position.y = 1.75;
            trunk.castShadow = true;
            treeGroup.add(trunk);

            if (i % 2 === 0) {
                // Round Anime Tree (Oak)
                const foliageGeom = new THREE.DodecahedronGeometry(2.2, 1);
                const foliage = new THREE.Mesh(foliageGeom, foliageMat);
                foliage.position.y = 4.2;
                foliage.castShadow = true;
                treeGroup.add(foliage);
            } else {
                // Pine Tree (Layered Cones)
                for (let l = 0; l < 3; l++) {
                    const coneGeom = new THREE.ConeGeometry(2.0 - l * 0.45, 2.0, 6);
                    const cone = new THREE.Mesh(coneGeom, pineMat);
                    cone.position.y = 3.2 + l * 1.3;
                    cone.castShadow = true;
                    treeGroup.add(cone);
                }
            }

            treeGroup.position.set(x, y, z);
            treeGroup.rotation.y = Math.random() * Math.PI * 2;
            const scale = 0.8 + Math.random() * 0.5;
            treeGroup.scale.set(scale, scale, scale);
            this.scene.add(treeGroup);
        }

        // Ancient Teyvat Ruin Pillars & Arch
        this.buildRuinArch(0, this.getHeight(0, -22), -22);
        this.buildPillars(18, this.getHeight(18, 12), 12);
        this.buildPillars(-20, this.getHeight(-20, 16), 16);
    }

    buildRuinArch(x, y, z) {
        const group = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: 0x90a4ae });

        const pillarGeom = new THREE.CylinderGeometry(0.7, 0.8, 6, 8);
        const p1 = new THREE.Mesh(pillarGeom, mat);
        p1.position.set(-3.5, 3, 0);
        const p2 = new THREE.Mesh(pillarGeom, mat);
        p2.position.set(3.5, 3, 0);

        const beamGeom = new THREE.BoxGeometry(8.5, 1.0, 1.4);
        const beam = new THREE.Mesh(beamGeom, mat);
        beam.position.set(0, 6.2, 0);

        group.add(p1);
        group.add(p2);
        group.add(beam);
        group.position.set(x, y, z);
        this.scene.add(group);
    }

    buildPillars(x, y, z) {
        const mat = new THREE.MeshLambertMaterial({ color: 0x90a4ae });
        const group = new THREE.Group();
        for (let i = 0; i < 3; i++) {
            const h = 3 + Math.random() * 3;
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, h, 8), mat);
            pillar.position.set(i * 3.5, h / 2, Math.random() * 2);
            pillar.castShadow = true;
            group.add(pillar);
        }
        group.position.set(x, y, z);
        this.scene.add(group);
    }

    buildInteractables() {
        // 1. Treasure Chests!
        this.createChest(12, this.getHeight(12, -15), -15, 'Exquisite Chest', 20, 2000);
        this.createChest(-16, this.getHeight(-16, -18), -18, 'Common Chest', 10, 1000);
        this.createChest(25, this.getHeight(25, 28), 28, 'Luxurious Chest', 40, 5000);

        // 2. Floating Anemoculus (Collectibles)
        this.createAnemoculus(0, this.getHeight(0, -22) + 7.5, -22);
        this.createAnemoculus(18, this.getHeight(18, 12) + 5.5, 12);
        this.createAnemoculus(-20, this.getHeight(-20, 16) + 4.5, 16);
        this.createAnemoculus(30, this.getHeight(30, -35) + 3.0, -35);

        // 3. Teleport Waypoint
        this.createTeleportWaypoint(0, this.getHeight(0, 5), 5);

        // 4. Anemo Elemental Monument (Hit with Anemo to trigger Updraft / Wind Current!)
        this.createElementalMonument(-12, this.getHeight(-12, 5), 5, Elements.ANEMO);
    }

    createChest(x, y, z, name, primogems, mora) {
        const group = new THREE.Group();
        const chestMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.6 });
        const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.3 });

        // Chest Body
        const bodyGeom = new THREE.BoxGeometry(1.4, 0.7, 0.9);
        const body = new THREE.Mesh(bodyGeom, chestMat);
        body.position.y = 0.35;
        body.castShadow = true;
        group.add(body);

        // Lid
        const lidGeom = new THREE.CylinderGeometry(0.48, 0.48, 1.4, 12, 1, false, 0, Math.PI);
        lidGeom.rotateZ(Math.PI / 2);
        const lid = new THREE.Mesh(lidGeom, chestMat);
        lid.position.set(0, 0.7, 0);
        group.add(lid);
        group.lid = lid;

        // Golden clasp & bands
        const bandGeom = new THREE.BoxGeometry(1.45, 0.12, 0.95);
        const band = new THREE.Mesh(bandGeom, goldTrimMat);
        band.position.y = 0.5;
        group.add(band);

        group.position.set(x, y, z);
        this.scene.add(group);

        this.interactables.push({
            type: 'chest',
            name: name,
            mesh: group,
            position: new THREE.Vector3(x, y, z),
            radius: 2.8,
            primogems: primogems,
            mora: mora,
            isOpened: false,
            interact: () => {
                if (group.lid) {
                    group.lid.rotation.x = -Math.PI / 2.5;
                    group.lid.position.y += 0.3;
                }
                if (window.soundEngine) window.soundEngine.playChestOpen();
                if (this.game.particleSystem) {
                    this.game.particleSystem.spawnExplosion(new THREE.Vector3(x, y + 1, z), 0xffd700, 30);
                }
                this.game.addPrimogems(primogems);
                this.game.addMora(mora);
                this.game.showNotification(`Opened ${name}! +${primogems} 💎 Primogems, +${mora} 🪙 Mora!`);
            }
        });
    }

    createAnemoculus(x, y, z) {
        const group = new THREE.Group();
        const coreMat = new THREE.MeshBasicMaterial({ color: 0x64ffda });
        const wingMat = new THREE.MeshBasicMaterial({ color: 0x1de9b6, transparent: true, opacity: 0.65 });

        // Glowing core
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 1), coreMat);
        group.add(core);

        // Rotating outer diamond ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 16), wingMat);
        group.add(ring);
        group.ring = ring;

        group.position.set(x, y, z);
        group.baseY = y;
        this.scene.add(group);

        this.interactables.push({
            type: 'anemoculus',
            name: 'Anemoculus',
            mesh: group,
            position: new THREE.Vector3(x, y, z),
            radius: 2.2,
            isCollected: false,
            update: (t) => {
                group.position.y = group.baseY + Math.sin(t * 2.5) * 0.25;
                group.rotation.y += 0.02;
                ring.rotation.x += 0.03;
            },
            interact: () => {
                if (window.soundEngine) window.soundEngine.playCollect();
                if (this.game.particleSystem) {
                    this.game.particleSystem.spawnBurst(group.position, Elements.ANEMO, 25, 4);
                }
                this.game.addPrimogems(20);
                this.game.showNotification('Discovered Anemoculus! +20 💎 Primogems! Max Stamina Increased!');
                this.scene.remove(group);
            }
        });
    }

    createTeleportWaypoint(x, y, z) {
        const group = new THREE.Group();
        const stoneMat = new THREE.MeshLambertMaterial({ color: 0x78909c });
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

        // Base Pedestal
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 0.8, 8), stoneMat);
        base.position.y = 0.4;
        group.add(base);

        // Floating glowing obelisk
        const obelisk = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), beaconMat);
        obelisk.position.y = 2.4;
        group.add(obelisk);
        group.obelisk = obelisk;

        group.position.set(x, y, z);
        group.baseY = y;
        this.scene.add(group);

        this.interactables.push({
            type: 'waypoint',
            name: 'Teleport Waypoint',
            mesh: group,
            position: new THREE.Vector3(x, y, z),
            radius: 3.0,
            isActivated: false,
            update: (t) => {
                obelisk.rotation.y += 0.015;
                obelisk.position.y = 2.4 + Math.sin(t * 2.0) * 0.15;
            },
            interact: () => {
                if (window.soundEngine) window.soundEngine.playReaction();
                this.game.showNotification('Teleport Waypoint Activated! Party fully healed!');
                this.game.healPartyFull();
            }
        });
    }

    createElementalMonument(x, y, z, element) {
        const group = new THREE.Group();
        const stoneMat = new THREE.MeshLambertMaterial({ color: 0x607d8b });
        const gemMat = new THREE.MeshBasicMaterial({ color: 0x00fa9a });

        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.6, 6), stoneMat);
        pedestal.position.y = 0.8;
        group.add(pedestal);

        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), gemMat);
        gem.position.y = 2.1;
        group.add(gem);
        group.gem = gem;

        group.position.set(x, y, z);
        this.scene.add(group);

        this.interactables.push({
            type: 'monument',
            element: element,
            name: 'Anemo Monument',
            mesh: group,
            position: new THREE.Vector3(x, y, z),
            radius: 3.5,
            isLit: false,
            hitByElement: (hitElem) => {
                if (hitElem === element) {
                    gemMat.color.setHex(0x00ff7f);
                    this.createWindUpdraft(x, y, z);
                    if (this.game.showNotification) {
                        this.game.showNotification('🍃 Wind Current Activated! Jump to glide up high!');
                    }
                }
            }
        });
    }

    createWindUpdraft(x, y, z) {
        // Wind updraft triggers high glide jump
        const updraft = {
            position: new THREE.Vector3(x, y, z),
            radius: 3.5,
            lift: 22.0
        };
        this.windCurrents.push(updraft);

        // Visual swirl effect
        setInterval(() => {
            if (this.game && this.game.particleSystem) {
                this.game.particleSystem.spawnVortex(new THREE.Vector3(x, y, z), 1.0);
            }
        }, 1200);
    }

    update(time) {
        this.interactables.forEach(item => {
            if (item.update && !item.isCollected) {
                item.update(time);
            }
        });
    }
}

window.GameWorld = GameWorld;

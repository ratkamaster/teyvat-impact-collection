// Particle System for Elemental Combat Effects
class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.maxParticles = 600;

        // Shared geometry and materials for performance
        this.geom = new THREE.SphereGeometry(0.12, 6, 6);
        this.boxGeom = new THREE.BoxGeometry(0.15, 0.15, 0.15);

        // Pre-create pooled meshes
        this.materials = {
            pyro: new THREE.MeshBasicMaterial({ color: 0xff4500 }),
            hydro: new THREE.MeshBasicMaterial({ color: 0x00bfff, transparent: true, opacity: 0.85 }),
            electro: new THREE.MeshBasicMaterial({ color: 0xba55d3 }),
            anemo: new THREE.MeshBasicMaterial({ color: 0x00fa9a, transparent: true, opacity: 0.8 }),
            cryo: new THREE.MeshBasicMaterial({ color: 0xe0ffff }),
            gold: new THREE.MeshBasicMaterial({ color: 0xffd700 }),
            white: new THREE.MeshBasicMaterial({ color: 0xffffff })
        };
    }

    spawnBurst(pos, element, count = 15, speed = 4) {
        const mat = this.materials[element.toLowerCase()] || this.materials.white;

        for (let i = 0; i < count; i++) {
            if (this.particles.length >= this.maxParticles) break;

            const mesh = new THREE.Mesh(this.geom, mat);
            mesh.position.copy(pos);
            mesh.position.x += (Math.random() - 0.5) * 0.4;
            mesh.position.y += Math.random() * 0.5;
            mesh.position.z += (Math.random() - 0.5) * 0.4;

            const scale = 0.5 + Math.random() * 0.8;
            mesh.scale.set(scale, scale, scale);

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const spd = (0.5 + Math.random() * 0.8) * speed;

            const vel = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * spd,
                Math.cos(phi) * spd + 1.5,
                Math.sin(phi) * Math.sin(theta) * spd
            );

            this.scene.add(mesh);
            this.particles.push({
                mesh: mesh,
                velocity: vel,
                gravity: -7.0,
                life: 1.0,
                maxLife: 0.4 + Math.random() * 0.4,
                fade: true
            });
        }
    }

    spawnExplosion(pos, hexColor, count = 25) {
        const mat = new THREE.MeshBasicMaterial({ color: hexColor });
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= this.maxParticles) break;

            const mesh = new THREE.Mesh(this.boxGeom, mat);
            mesh.position.copy(pos);

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const spd = 4 + Math.random() * 6;

            const vel = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * spd,
                Math.abs(Math.cos(phi)) * spd + 2,
                Math.sin(phi) * Math.sin(theta) * spd
            );

            this.scene.add(mesh);
            this.particles.push({
                mesh: mesh,
                velocity: vel,
                gravity: -9.8,
                life: 1.0,
                maxLife: 0.5 + Math.random() * 0.4,
                rotSpeed: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
                fade: true
            });
        }
    }

    spawnSlashArc(pos, rotY, element) {
        // Creates sweeping elemental slash visual
        const mat = this.materials[element.toLowerCase()] || this.materials.white;
        const arcGeom = new THREE.TorusGeometry(1.6, 0.08, 6, 16, Math.PI * 0.65);
        const arcMesh = new THREE.Mesh(arcGeom, mat);
        arcMesh.rotation.x = Math.PI / 2;
        arcMesh.rotation.z = rotY - Math.PI * 0.35;
        arcMesh.position.copy(pos);
        arcMesh.position.y += 0.8;

        this.scene.add(arcMesh);
        this.particles.push({
            mesh: arcMesh,
            velocity: new THREE.Vector3(0, 0, 0),
            gravity: 0,
            life: 1.0,
            maxLife: 0.22,
            scaleSpeed: 2.5,
            fade: true
        });
    }

    spawnVortex(pos, duration = 2.0) {
        // Swirling Anemo Tornado
        for (let i = 0; i < 40; i++) {
            const mesh = new THREE.Mesh(this.geom, this.materials.anemo);
            const angle = Math.random() * Math.PI * 2;
            const r = 0.5 + Math.random() * 2.2;
            mesh.position.set(pos.x + Math.cos(angle) * r, pos.y + Math.random() * 3.5, pos.z + Math.sin(angle) * r);
            this.scene.add(mesh);

            this.particles.push({
                mesh: mesh,
                center: pos.clone(),
                radius: r,
                angle: angle,
                angularSpeed: 6.0 + Math.random() * 4.0,
                verticalSpeed: 1.5 + Math.random() * 2.0,
                isVortex: true,
                life: 1.0,
                maxLife: duration
            });
        }
    }

    spawnThunderStrike(pos) {
        // Vertical lightning beam
        const boltGeom = new THREE.CylinderGeometry(0.08, 0.25, 12, 6);
        const boltMesh = new THREE.Mesh(boltGeom, this.materials.electro);
        boltMesh.position.set(pos.x, pos.y + 6, pos.z);
        this.scene.add(boltMesh);

        this.particles.push({
            mesh: boltMesh,
            velocity: new THREE.Vector3(0, 0, 0),
            gravity: 0,
            life: 1.0,
            maxLife: 0.2,
            fade: true
        });

        this.spawnExplosion(pos, 0xba55d3, 20);
    }

    update(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= delta / p.maxLife;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                if (p.mesh.geometry && !p.mesh.geometry.isShared) {
                    p.mesh.geometry.dispose();
                }
                this.particles.splice(i, 1);
                continue;
            }

            if (p.isVortex) {
                p.angle += p.angularSpeed * delta;
                p.mesh.position.x = p.center.x + Math.cos(p.angle) * p.radius;
                p.mesh.position.z = p.center.z + Math.sin(p.angle) * p.radius;
                p.mesh.position.y += p.verticalSpeed * delta;
                if (p.mesh.position.y > p.center.y + 4.5) {
                    p.mesh.position.y = p.center.y + 0.2;
                }
            } else {
                p.velocity.y += p.gravity * delta;
                p.mesh.position.x += p.velocity.x * delta;
                p.mesh.position.y += p.velocity.y * delta;
                p.mesh.position.z += p.velocity.z * delta;

                if (p.rotSpeed) {
                    p.mesh.rotation.x += p.rotSpeed.x * delta;
                    p.mesh.rotation.y += p.rotSpeed.y * delta;
                }

                if (p.scaleSpeed) {
                    p.mesh.scale.multiplyScalar(1 + p.scaleSpeed * delta);
                }
            }

            if (p.fade && p.mesh.material) {
                const s = Math.max(0, p.life);
                p.mesh.scale.set(s, s, s);
            }
        }
    }
}

window.ParticleSystem = ParticleSystem;

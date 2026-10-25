// Enemies System: Slimes, Hilichurls, and Ruin Guard Boss
class Enemy {
    constructor(game, config) {
        this.game = game;
        this.type = config.type || 'slime';
        this.name = config.name || 'Slime';
        this.level = config.level || 20;
        this.element = config.element || null; // Slime native element

        this.maxHp = config.maxHp || 4500;
        this.hp = this.maxHp;
        this.atk = config.atk || 450;
        this.speed = config.speed || 3.0;

        this.position = new THREE.Vector3().copy(config.position);
        this.velocity = new THREE.Vector3();
        this.isDead = false;
        this.isBoss = config.isBoss || false;

        // Elemental Status
        this.elementalAura = this.element; // native aura or applied
        this.auraTimer = 0;
        this.electroTicksLeft = 0;
        this.electroTickDamage = 0;
        this.electroTimer = 0;
        this.freezeTimer = 0;

        // Combat AI state
        this.state = 'idle';
        this.stateTimer = 0;
        this.attackCooldown = 0;
        this.target = null;

        this.mesh = this.buildMesh(config);
        this.game.scene.add(this.mesh);
    }

    applyAura(element, durationMs = 8000) {
        this.elementalAura = element;
        this.auraTimer = durationMs / 1000;
        this.updateAuraBadge();
    }

    clearAura() {
        this.elementalAura = this.element || null;
        this.auraTimer = 0;
        this.updateAuraBadge();
    }

    freeze(duration = 3.0) {
        this.freezeTimer = duration;
        this.state = 'frozen';
    }

    startElectroChargedTicks(tickDamage) {
        this.electroTicksLeft = 3;
        this.electroTickDamage = tickDamage;
        this.electroTimer = 0.6;
    }

    takeDamage(amount, element, isCrit = false) {
        if (this.isDead) return;

        this.hp = Math.max(0, this.hp - amount);
        this.updateHealthBar();

        if (this.mesh) {
            // Flash red on hit
            this.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    const orig = child.material.color.getHex();
                    child.material.color.setHex(0xffffff);
                    setTimeout(() => {
                        if (child.material) child.material.color.setHex(orig);
                    }, 80);
                }
            });
        }

        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        this.isDead = true;
        this.state = 'dead';

        // Reward player with Primogems, Mora, and Party Energy!
        const moraReward = this.isBoss ? 5000 : 800;
        const primoReward = this.isBoss ? 40 : 5;
        this.game.addMora(moraReward);
        this.game.addPrimogems(primoReward);
        this.game.addPartyEnergy(this.isBoss ? 40 : 15);

        if (this.game.particleSystem) {
            this.game.particleSystem.spawnExplosion(this.position, 0xffd700, 30);
        }

        // Death notification
        if (this.game.showNotification) {
            this.game.showNotification(`+${primoReward} 💎 Primogems, +${moraReward} 🪙 Mora!`);
        }

        // Remove from scene after brief sink animation
        let sink = 0;
        const sinkInterval = setInterval(() => {
            sink += 0.05;
            this.mesh.position.y -= 0.05;
            if (sink >= 1.5) {
                clearInterval(sinkInterval);
                this.game.scene.remove(this.mesh);
            }
        }, 30);
    }

    updateHealthBar() {
        if (this.hpBarMesh) {
            const pct = Math.max(0, this.hp / this.maxHp);
            this.hpBarMesh.scale.x = pct;
        }
    }

    updateAuraBadge() {
        if (!this.auraMesh) return;
        if (this.elementalAura) {
            this.auraMesh.visible = true;
            let col = 0xffffff;
            if (this.elementalAura === Elements.PYRO) col = 0xff4500;
            if (this.elementalAura === Elements.HYDRO) col = 0x00bfff;
            if (this.elementalAura === Elements.ELECTRO) col = 0xda70d6;
            if (this.elementalAura === Elements.ANEMO) col = 0x00fa9a;
            if (this.elementalAura === Elements.CRYO) col = 0x80d8ff;
            this.auraMesh.material.color.setHex(col);
        } else {
            this.auraMesh.visible = false;
        }
    }

    update(delta, playerPos) {
        if (this.isDead) return;

        // Aura decay
        if (this.auraTimer > 0) {
            this.auraTimer -= delta;
            if (this.auraTimer <= 0) {
                this.clearAura();
            }
        }

        // Electro-Charged ticks
        if (this.electroTicksLeft > 0) {
            this.electroTimer -= delta;
            if (this.electroTimer <= 0) {
                this.electroTicksLeft--;
                this.electroTimer = 0.8;
                this.takeDamage(this.electroTickDamage, Elements.ELECTRO, false);
                if (this.game.particleSystem) {
                    this.game.particleSystem.spawnBurst(this.position, Elements.ELECTRO, 6, 2);
                }
            }
        }

        // Frozen state
        if (this.freezeTimer > 0) {
            this.freezeTimer -= delta;
            return;
        }

        if (this.attackCooldown > 0) {
            this.attackCooldown -= delta;
        }

        // Distance to player
        const dist = this.position.distanceTo(playerPos);

        if (this.type === 'slime') {
            this.updateSlimeAI(delta, playerPos, dist);
        } else if (this.type === 'hilichurl') {
            this.updateHilichurlAI(delta, playerPos, dist);
        } else if (this.type === 'ruin_guard') {
            this.updateRuinGuardAI(delta, playerPos, dist);
        }

        // Apply velocity and simple terrain gravity
        this.position.addScaledVector(this.velocity, delta);
        this.velocity.multiplyScalar(0.9); // friction

        // Clamp to ground level
        const groundY = this.game.getTerrainHeight(this.position.x, this.position.z);
        if (this.position.y < groundY) {
            this.position.y = groundY;
            this.velocity.y = 0;
        }

        this.mesh.position.copy(this.position);
    }

    updateSlimeAI(delta, playerPos, dist) {
        if (dist < 18) {
            // Face player
            const dir = new THREE.Vector3().subVectors(playerPos, this.position);
            dir.y = 0;
            dir.normalize();
            this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

            // Bouncing hop towards player
            this.stateTimer += delta;
            if (this.stateTimer > 1.2) {
                this.stateTimer = 0;
                this.velocity.copy(dir).multiplyScalar(this.speed * 1.5);
                this.velocity.y = 5.0; // Hop in the air

                // Attack player if close
                if (dist < 2.2 && this.attackCooldown <= 0) {
                    this.game.damageActiveCharacter(this.atk, this.element || Elements.PHYSICAL);
                    this.attackCooldown = 2.0;
                }
            }
        }
    }

    updateHilichurlAI(delta, playerPos, dist) {
        if (dist < 20) {
            // Chase player
            const dir = new THREE.Vector3().subVectors(playerPos, this.position);
            dir.y = 0;
            dir.normalize();
            this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

            if (dist > 2.2) {
                this.position.x += dir.x * this.speed * delta;
                this.position.z += dir.z * this.speed * delta;
                // Animate running legs
                if (this.mesh.leftLeg) {
                    this.mesh.leftLeg.rotation.x = Math.sin(Date.now() * 0.01) * 0.5;
                    this.mesh.rightLeg.rotation.x = -Math.sin(Date.now() * 0.01) * 0.5;
                }
            } else {
                // Melee swing
                if (this.attackCooldown <= 0) {
                    this.attackCooldown = 2.2;
                    if (this.mesh.club) {
                        this.mesh.club.rotation.x = Math.PI / 2;
                        setTimeout(() => { if (this.mesh.club) this.mesh.club.rotation.x = 0; }, 250);
                    }
                    this.game.damageActiveCharacter(this.atk, Elements.PHYSICAL);
                    if (window.soundEngine) window.soundEngine.playHit();
                }
            }
        }
    }

    updateRuinGuardAI(delta, playerPos, dist) {
        if (dist < 32) {
            const dir = new THREE.Vector3().subVectors(playerPos, this.position);
            dir.y = 0;
            dir.normalize();
            this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

            this.stateTimer += delta;

            // Attack sequence: Whirlwind spin or Stomp
            if (this.state === 'whirlwind') {
                this.mesh.rotation.y += delta * 12.0; // Rapid spin
                this.position.x += dir.x * (this.speed * 1.8) * delta;
                this.position.z += dir.z * (this.speed * 1.8) * delta;

                if (dist < 3.5 && this.attackCooldown <= 0) {
                    this.game.damageActiveCharacter(this.atk * 1.2, Elements.PHYSICAL);
                    this.attackCooldown = 0.5;
                }

                if (this.stateTimer > 4.0) {
                    this.state = 'idle';
                    this.stateTimer = 0;
                }
            } else {
                if (dist > 3.0) {
                    this.position.x += dir.x * this.speed * delta;
                    this.position.z += dir.z * this.speed * delta;
                }

                if (this.stateTimer > 5.0) {
                    // Trigger Whirlwind spin attack!
                    this.state = 'whirlwind';
                    this.stateTimer = 0;
                    if (this.game.showNotification) {
                        this.game.showNotification('⚠️ Ruin Guard is spinning! Keep your distance!');
                    }
                } else if (dist < 3.2 && this.attackCooldown <= 0) {
                    // Stomp attack
                    this.attackCooldown = 2.5;
                    this.game.damageActiveCharacter(this.atk, Elements.PHYSICAL);
                    if (this.game.particleSystem) {
                        this.game.particleSystem.spawnExplosion(this.position, 0x8d6e63, 20);
                    }
                    if (window.soundEngine) window.soundEngine.playHit();
                }
            }
        }
    }

    buildMesh(config) {
        const group = new THREE.Group();

        if (this.type === 'slime') {
            let col = 0xff4500;
            if (this.element === Elements.HYDRO) col = 0x00bfff;
            if (this.element === Elements.ELECTRO) col = 0x9c27b0;

            const slimeMat = new THREE.MeshStandardMaterial({
                color: col,
                roughness: 0.2,
                metalness: 0.1,
                transparent: true,
                opacity: 0.9
            });

            // Slime Body (Squash-stretch sphere)
            const bodyGeom = new THREE.SphereGeometry(0.7, 12, 12);
            const body = new THREE.Mesh(bodyGeom, slimeMat);
            body.scale.set(1.2, 0.9, 1.2);
            body.position.y = 0.6;
            group.add(body);

            // Horns / antenna
            const hornGeom = new THREE.ConeGeometry(0.15, 0.4, 6);
            const leftHorn = new THREE.Mesh(hornGeom, slimeMat);
            leftHorn.position.set(-0.3, 1.3, 0);
            leftHorn.rotation.z = 0.3;
            const rightHorn = new THREE.Mesh(hornGeom, slimeMat);
            rightHorn.position.set(0.3, 1.3, 0);
            rightHorn.rotation.z = -0.3;
            group.add(leftHorn);
            group.add(rightHorn);

            // Cute Slime Eyes
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

            [-0.22, 0.22].forEach(x => {
                const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
                eye.position.set(x, 0.7, 0.7);
                const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), pupilMat);
                pupil.position.set(x, 0.7, 0.8);
                group.add(eye);
                group.add(pupil);
            });
        } else if (this.type === 'hilichurl') {
            const bodyMat = new THREE.MeshLambertMaterial({ color: 0x424242 });
            const maskMat = new THREE.MeshLambertMaterial({ color: 0xfffdd0 });
            const clubMat = new THREE.MeshLambertMaterial({ color: 0x5d4037 });

            // Torso
            const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.8, 8), bodyMat);
            torso.position.y = 1.1;
            group.add(torso);

            // Mask Face
            const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.5, 8), maskMat);
            mask.position.set(0, 1.7, 0.1);
            group.add(mask);

            // Wooden Club
            const club = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.06, 1.2, 6), clubMat);
            club.position.set(0.5, 1.2, 0.3);
            group.add(club);
            group.club = club;

            // Legs
            const legGeom = new THREE.CylinderGeometry(0.1, 0.08, 0.7, 6);
            const leftLeg = new THREE.Mesh(legGeom, bodyMat);
            leftLeg.position.set(-0.16, 0.35, 0);
            const rightLeg = new THREE.Mesh(legGeom, bodyMat);
            rightLeg.position.set(0.16, 0.35, 0);
            group.add(leftLeg);
            group.add(rightLeg);
            group.leftLeg = leftLeg;
            group.rightLeg = rightLeg;
        } else if (this.type === 'ruin_guard') {
            // Boss Ruin Guard: Heavy Golem
            const armorMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.7, metalness: 0.5 });
            const jointMat = new THREE.MeshStandardMaterial({ color: 0x263238 });
            const eyeCoreMat = new THREE.MeshBasicMaterial({ color: 0xffd600 }); // Glowing core

            // Massive Torso
            const torso = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 1.8), armorMat);
            torso.position.y = 2.6;
            group.add(torso);

            // Glowing Eye Weak Point
            const eyeCore = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12), eyeCoreMat);
            eyeCore.rotation.x = Math.PI / 2;
            eyeCore.position.set(0, 2.6, 0.95);
            group.add(eyeCore);

            // Left & Right Arms
            const armGeom = new THREE.CylinderGeometry(0.35, 0.35, 2.2, 8);
            const leftArm = new THREE.Mesh(armGeom, jointMat);
            leftArm.position.set(-1.6, 2.2, 0);
            const rightArm = new THREE.Mesh(armGeom, jointMat);
            rightArm.position.set(1.6, 2.2, 0);
            group.add(leftArm);
            group.add(rightArm);

            // Heavy Legs
            const legGeom = new THREE.CylinderGeometry(0.45, 0.4, 1.6, 8);
            const leftLeg = new THREE.Mesh(legGeom, armorMat);
            leftLeg.position.set(-0.7, 0.8, 0);
            const rightLeg = new THREE.Mesh(legGeom, armorMat);
            rightLeg.position.set(0.7, 0.8, 0);
            group.add(leftLeg);
            group.add(rightLeg);
        }

        // Floating HP bar
        const hpBgGeom = new THREE.PlaneGeometry(1.4, 0.16);
        const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
        const hpBg = new THREE.Mesh(hpBgGeom, hpBgMat);
        const barHeight = this.isBoss ? 4.2 : 2.2;
        hpBg.position.set(0, barHeight, 0);

        const hpBarGeom = new THREE.PlaneGeometry(1.36, 0.12);
        const hpBarMat = new THREE.MeshBasicMaterial({ color: 0xff3d00, side: THREE.DoubleSide });
        const hpBar = new THREE.Mesh(hpBarGeom, hpBarMat);
        hpBar.position.set(0, 0, 0.01);
        hpBg.add(hpBar);
        this.hpBarMesh = hpBar;

        // Aura Indicator
        const auraGeom = new THREE.SphereGeometry(0.15, 8, 8);
        const auraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const auraMesh = new THREE.Mesh(auraGeom, auraMat);
        auraMesh.position.set(0, barHeight + 0.3, 0);
        auraMesh.visible = false;
        group.add(auraMesh);
        this.auraMesh = auraMesh;

        group.add(hpBg);
        this.hpBillboard = hpBg;

        group.position.copy(this.position);
        return group;
    }
}

window.Enemy = Enemy;

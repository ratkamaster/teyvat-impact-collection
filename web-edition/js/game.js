// Main Game Engine & Controller
class ImpactGame {
    constructor() {
        this.container = document.getElementById('game-container');
        this.primogems = 1600; // Starting with 10 pulls!
        this.mora = 50000;

        // Active State
        this.party = CharacterFactory.createParty();
        this.activeCharIndex = 0;
        this.activeChar = this.party[0];

        // Movement & Physics
        this.keys = {};
        this.mouse = { x: 0, y: 0, isLocked: false };
        this.cameraAngle = { theta: 0, phi: 0.35 };
        this.cameraDistance = 5.5;

        this.playerPos = new THREE.Vector3(0, 2, 0);
        this.playerVel = new THREE.Vector3();
        this.isGrounded = false;
        this.isGliding = false;
        this.isSprinting = false;
        this.stamina = 100;
        this.maxStamina = 100;
        this.dashCooldown = 0;

        // Attack combos
        this.attackCombo = 0;
        this.lastAttackTime = 0;
        this.isAttacking = false;

        // Subsystems
        this.enemies = [];
        this.activeInteractable = null;
        this.clock = new THREE.Clock();

        this.initThree();
        this.initWorld();
        this.initPartyMeshes();
        this.initEnemies();
        this.initControls();
        this.initUI();

        // Start Loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.container.appendChild(this.renderer.domElement);

        this.particleSystem = new ParticleSystem(this.scene);
        this.elementEngine = new ElementalEngine(this);
        this.gacha = new GachaSystem(this);

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    initWorld() {
        this.world = new GameWorld(this.scene, this);
        this.playerPos.y = this.world.getHeight(0, 0) + 0.1;
    }

    initPartyMeshes() {
        this.partyGroup = new THREE.Group();
        this.scene.add(this.partyGroup);

        this.party.forEach(char => {
            char.mesh = CharacterFactory.buildMeshForCharacter(char);
            char.mesh.visible = false;
            this.partyGroup.add(char.mesh);
        });

        // Set active character visible
        this.activeChar.mesh.visible = true;
    }

    initEnemies() {
        // Slimes in nearby valley
        this.enemies.push(new Enemy(this, {
            type: 'slime',
            element: Elements.HYDRO,
            name: 'Hydro Slime',
            maxHp: 3800,
            atk: 320,
            speed: 3.2,
            position: new THREE.Vector3(12, this.getTerrainHeight(12, 10), 10)
        }));

        this.enemies.push(new Enemy(this, {
            type: 'slime',
            element: Elements.PYRO,
            name: 'Pyro Slime',
            maxHp: 4200,
            atk: 380,
            speed: 3.5,
            position: new THREE.Vector3(16, this.getTerrainHeight(16, 14), 14)
        }));

        this.enemies.push(new Enemy(this, {
            type: 'slime',
            element: Elements.ELECTRO,
            name: 'Electro Slime',
            maxHp: 4000,
            atk: 360,
            speed: 3.8,
            position: new THREE.Vector3(-14, this.getTerrainHeight(-14, 12), 12)
        }));

        // Hilichurl Patrols
        this.enemies.push(new Enemy(this, {
            type: 'hilichurl',
            name: 'Hilichurl Fighter',
            maxHp: 5600,
            atk: 480,
            speed: 4.2,
            position: new THREE.Vector3(-22, this.getTerrainHeight(-22, -15), -15)
        }));

        this.enemies.push(new Enemy(this, {
            type: 'hilichurl',
            name: 'Hilichurl Berserker',
            maxHp: 6200,
            atk: 520,
            speed: 4.5,
            position: new THREE.Vector3(-26, this.getTerrainHeight(-26, -18), -18)
        }));

        // Ruin Guard Boss at Ancient Ruins
        this.enemies.push(new Enemy(this, {
            type: 'ruin_guard',
            name: 'Field Tiller (Ruin Guard)',
            isBoss: true,
            maxHp: 28000,
            atk: 950,
            speed: 2.8,
            position: new THREE.Vector3(0, this.getTerrainHeight(0, -32), -32)
        }));
    }

    getTerrainHeight(x, z) {
        return this.world ? this.world.getHeight(x, z) : 0;
    }

    initControls() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (window.soundEngine && !window.soundEngine.ctx) {
                window.soundEngine.init();
            }

            // Party Switch [1, 2, 3, 4]
            if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
                const idx = parseInt(e.code.replace('Digit', '')) - 1;
                this.switchCharacter(idx);
            }

            // Skill [E]
            if (e.code === 'KeyE') {
                this.castSkill();
            }

            // Burst [Q]
            if (e.code === 'KeyQ') {
                this.castBurst();
            }

            // Interact [F]
            if (e.code === 'KeyF') {
                this.triggerInteraction();
            }

            // Wish Banner [G]
            if (e.code === 'KeyG') {
                this.toggleWishModal();
            }

            // Help [H]
            if (e.code === 'KeyH') {
                this.toggleHelpModal();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Mouse Controls & Pointer Lock
        this.container.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left Click: Attack or Lock Pointer
                if (!document.pointerLockElement) {
                    this.container.requestPointerLock();
                } else {
                    this.performAttack();
                }
            } else if (e.button === 2) { // Right Click: Dash
                this.performDash();
            }
        });

        this.container.addEventListener('contextmenu', e => e.preventDefault());

        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.container) {
                this.cameraAngle.theta -= e.movementX * 0.0035;
                this.cameraAngle.phi += e.movementY * 0.0035;
                // Clamp vertical look
                this.cameraAngle.phi = Math.max(-0.2, Math.min(1.2, this.cameraAngle.phi));
            }
        });

        window.addEventListener('wheel', (e) => {
            this.cameraDistance = Math.max(3.0, Math.min(10.0, this.cameraDistance + e.deltaY * 0.005));
        });
    }

    switchCharacter(idx) {
        if (idx === this.activeCharIndex || idx < 0 || idx >= this.party.length) return;
        const targetChar = this.party[idx];
        if (targetChar.hp <= 0) {
            this.showNotification(`${targetChar.name} has fallen!`);
            return;
        }

        // Hide old, show new
        this.activeChar.mesh.visible = false;
        this.activeCharIndex = idx;
        this.activeChar = targetChar;
        this.activeChar.mesh.visible = true;

        // Visual flash & sound
        if (window.soundEngine) window.soundEngine.playReaction();
        if (this.particleSystem) {
            this.particleSystem.spawnBurst(this.playerPos, this.activeChar.element, 15, 3);
        }

        this.updateHUD();
        this.showNotification(`Switched to ${this.activeChar.name}!`);
    }

    performAttack() {
        if (this.isAttacking) return;
        this.isAttacking = true;

        const now = Date.now();
        if (now - this.lastAttackTime > 1200) {
            this.attackCombo = 0;
        }
        this.attackCombo = (this.attackCombo + 1) % 3;
        this.lastAttackTime = now;

        if (window.soundEngine) window.soundEngine.playSwordSwing();

        // Swing weapon animation
        if (this.activeChar.mesh && this.activeChar.mesh.weaponMesh) {
            const weapon = this.activeChar.mesh.weaponMesh;
            weapon.rotation.z = Math.PI / 2;
            weapon.rotation.x = -Math.PI / 4;
            setTimeout(() => {
                weapon.rotation.z = 0;
                weapon.rotation.x = Math.PI / 4;
            }, 180);
        }

        // Slash trail visual
        const rotY = this.cameraAngle.theta;
        const slashPos = this.playerPos.clone().add(new THREE.Vector3(
            -Math.sin(rotY) * 1.2,
            0.5,
            -Math.cos(rotY) * 1.2
        ));
        this.particleSystem.spawnSlashArc(slashPos, rotY, this.activeChar.element);

        // Check Hit on Enemies
        let hitAny = false;
        this.enemies.forEach(enemy => {
            if (enemy.isDead) return;
            const dist = enemy.position.distanceTo(this.playerPos);
            if (dist < 3.2) {
                // Check if in front of player
                const toEnemy = enemy.position.clone().sub(this.playerPos).normalize();
                const forward = new THREE.Vector3(-Math.sin(rotY), 0, -Math.cos(rotY));
                if (toEnemy.dot(forward) > 0.3) {
                    hitAny = true;
                    const isCrit = Math.random() < this.activeChar.critRate;
                    let dmg = Math.round(this.activeChar.atk * (0.8 + this.attackCombo * 0.25));
                    if (isCrit) dmg = Math.round(dmg * this.activeChar.critDmg);

                    // 3rd hit applies elemental infusion!
                    const elem = this.attackCombo === 2 ? this.activeChar.element : Elements.PHYSICAL;
                    this.elementEngine.processHit(enemy, elem, dmg, isCrit);

                    // Gain elemental energy
                    this.activeChar.addEnergy(8);
                    if (window.soundEngine) window.soundEngine.playHit();
                }
            }
        });

        setTimeout(() => {
            this.isAttacking = false;
        }, 220);

        this.updateHUD();
    }

    castSkill() {
        if (!this.activeChar.isSkillReady()) return;
        this.activeChar.skillCooldown = this.activeChar.maxSkillCooldown;

        const forward = new THREE.Vector3(-Math.sin(this.cameraAngle.theta), 0, -Math.cos(this.cameraAngle.theta));

        switch (this.activeChar.element) {
            case Elements.PYRO:
                // Kaelen: Searing Flame Cleave
                if (window.soundEngine) window.soundEngine.playPyroSkill();
                this.particleSystem.spawnExplosion(this.playerPos.clone().add(forward.clone().multiplyScalar(2)), 0xff4500, 35);
                this.hitEnemiesInAoE(this.playerPos.clone().add(forward.clone().multiplyScalar(2)), 4.5, Elements.PYRO, 2.5);
                break;

            case Elements.HYDRO:
                // Marina: Water Surge & Phantom
                if (window.soundEngine) window.soundEngine.playHydroSkill();
                this.particleSystem.spawnBurst(this.playerPos, Elements.HYDRO, 40, 5);
                this.hitEnemiesInAoE(this.playerPos, 5.0, Elements.HYDRO, 2.2);
                break;

            case Elements.ELECTRO:
                // Raiko: Thunder Dash
                if (window.soundEngine) window.soundEngine.playElectroSkill();
                this.playerPos.add(forward.clone().multiplyScalar(7)); // Teleport forward
                this.particleSystem.spawnThunderStrike(this.playerPos);
                this.hitEnemiesInAoE(this.playerPos, 4.0, Elements.ELECTRO, 2.8);
                break;

            case Elements.ANEMO:
                // Ventus: Skyward Vortex
                if (window.soundEngine) window.soundEngine.playAnemoSkill();
                this.particleSystem.spawnVortex(this.playerPos, 2.0);
                this.playerVel.y = 14.0; // Launch high in air!
                this.isGliding = true;
                // Pull nearby enemies inward
                this.enemies.forEach(e => {
                    if (!e.isDead && e.position.distanceTo(this.playerPos) < 10) {
                        const pullDir = this.playerPos.clone().sub(e.position).normalize();
                        e.velocity.add(pullDir.multiplyScalar(8));
                        this.elementEngine.processHit(e, Elements.ANEMO, Math.round(this.activeChar.atk * 1.8), false);
                    }
                });
                break;
        }

        // Check monuments nearby
        if (this.world) {
            this.world.interactables.forEach(item => {
                if (item.type === 'monument' && item.position.distanceTo(this.playerPos) < 6.0) {
                    item.hitByElement(this.activeChar.element);
                }
            });
        }

        this.activeChar.addEnergy(15);
        this.updateHUD();
    }

    castBurst() {
        if (!this.activeChar.isBurstReady()) {
            this.showNotification('Elemental Burst not charged yet!');
            return;
        }
        this.activeChar.energy = 0;

        if (window.soundEngine) window.soundEngine.playBurst();

        // Screen flash effect
        const flash = document.getElementById('burst-flash');
        if (flash) {
            flash.style.opacity = '0.7';
            setTimeout(() => { flash.style.opacity = '0'; }, 300);
        }

        this.showNotification(`💥 ${this.activeChar.name}: ELEMENTAL BURST!`);

        // Massive AoE damage
        const burstPos = this.playerPos.clone().add(new THREE.Vector3(
            -Math.sin(this.cameraAngle.theta) * 3,
            0,
            -Math.cos(this.cameraAngle.theta) * 3
        ));

        if (this.activeChar.element === Elements.PYRO) {
            // Phoenix Inferno
            this.particleSystem.spawnExplosion(burstPos, 0xff2200, 70);
            this.hitEnemiesInAoE(burstPos, 9.0, Elements.PYRO, 5.5);
        } else if (this.activeChar.element === Elements.HYDRO) {
            // Healing Torrential Rain
            this.particleSystem.spawnBurst(burstPos, Elements.HYDRO, 80, 7);
            this.hitEnemiesInAoE(burstPos, 8.5, Elements.HYDRO, 4.2);
            this.healParty(4500);
        } else if (this.activeChar.element === Elements.ELECTRO) {
            // Musou Lightning Cataclysm
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const offset = new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8);
                    this.particleSystem.spawnThunderStrike(burstPos.clone().add(offset));
                }, i * 100);
            }
            this.hitEnemiesInAoE(burstPos, 8.0, Elements.ELECTRO, 6.0);
        } else if (this.activeChar.element === Elements.ANEMO) {
            // Eye of the Storm Vortex
            this.particleSystem.spawnVortex(burstPos, 4.5);
            this.hitEnemiesInAoE(burstPos, 11.0, Elements.ANEMO, 4.5);
        }

        this.updateHUD();
    }

    hitEnemiesInAoE(center, radius, element, multiplier) {
        this.enemies.forEach(enemy => {
            if (enemy.isDead) return;
            if (enemy.position.distanceTo(center) <= radius) {
                const isCrit = Math.random() < this.activeChar.critRate;
                let dmg = Math.round(this.activeChar.atk * multiplier);
                if (isCrit) dmg = Math.round(dmg * this.activeChar.critDmg);
                this.elementEngine.processHit(enemy, element, dmg, isCrit);
            }
        });
    }

    performDash() {
        if (this.dashCooldown > 0 || this.stamina < 20) return;
        this.stamina -= 20;
        this.dashCooldown = 0.6;

        if (window.soundEngine) window.soundEngine.playDash();

        const moveDir = this.getMovementDirection();
        if (moveDir.lengthSq() < 0.01) {
            moveDir.set(-Math.sin(this.cameraAngle.theta), 0, -Math.cos(this.cameraAngle.theta));
        }

        this.playerVel.copy(moveDir.multiplyScalar(16.0));
        this.particleSystem.spawnBurst(this.playerPos, this.activeChar.element, 10, 2);
    }

    getMovementDirection() {
        const dir = new THREE.Vector3();
        const sin = Math.sin(this.cameraAngle.theta);
        const cos = Math.cos(this.cameraAngle.theta);

        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            dir.x -= sin;
            dir.z -= cos;
        }
        if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            dir.x += sin;
            dir.z += cos;
        }
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            dir.x -= cos;
            dir.z += sin;
        }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            dir.x += cos;
            dir.z -= sin;
        }

        if (dir.lengthSq() > 0.001) dir.normalize();
        return dir;
    }

    triggerInteraction() {
        if (this.activeInteractable && this.activeInteractable.interact) {
            this.activeInteractable.interact();
            this.activeInteractable = null;
            document.getElementById('interaction-prompt').style.display = 'none';
        }
    }

    damageActiveCharacter(amount, element) {
        this.activeChar.hp = Math.max(0, this.activeChar.hp - amount);
        this.updateHUD();

        // Screen damage flash
        const hitFlash = document.getElementById('hit-flash');
        if (hitFlash) {
            hitFlash.style.opacity = '0.5';
            setTimeout(() => { hitFlash.style.opacity = '0'; }, 180);
        }

        if (this.activeChar.hp <= 0) {
            this.showNotification(`${this.activeChar.name} has fallen!`);
            // Automatically switch to next available character
            const nextIdx = this.party.findIndex(c => c.hp > 0);
            if (nextIdx !== -1) {
                this.switchCharacter(nextIdx);
            } else {
                this.showNotification('All party members defeated! Reviving at Waypoint...');
                setTimeout(() => { this.respawnParty(); }, 2000);
            }
        }
    }

    healParty(amount) {
        this.party.forEach(c => {
            if (c.hp > 0) {
                c.hp = Math.min(c.maxHp, c.hp + amount);
            }
        });
        this.updateHUD();
        this.showNotification(`Party healed for +${amount} HP!`);
    }

    healPartyFull() {
        this.party.forEach(c => {
            c.hp = c.maxHp;
            c.energy = c.maxEnergy;
        });
        this.updateHUD();
    }

    respawnParty() {
        this.healPartyFull();
        this.playerPos.set(0, this.getTerrainHeight(0, 5) + 0.5, 5);
        this.playerVel.set(0, 0, 0);
    }

    addPrimogems(amt) {
        this.primogems += amt;
        this.updateHUD();
    }

    addMora(amt) {
        this.mora += amt;
        this.updateHUD();
    }

    addPartyEnergy(amt) {
        this.party.forEach(c => c.addEnergy(amt));
        this.updateHUD();
    }

    showNotification(msg) {
        const notif = document.getElementById('notification');
        if (notif) {
            notif.textContent = msg;
            notif.classList.add('show');
            clearTimeout(this.notifTimer);
            this.notifTimer = setTimeout(() => {
                notif.classList.remove('show');
            }, 3000);
        }
    }

    spawnDamageNumber(worldPos, damage, color, isCrit, reactionText, reactionColor) {
        const screenPos = worldPos.clone().project(this.camera);
        if (screenPos.z > 1) return; // Behind camera

        const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

        const el = document.createElement('div');
        el.className = 'damage-number' + (isCrit ? ' crit' : '');
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.color = color;

        if (reactionText) {
            el.innerHTML = `<span style="color:${reactionColor};font-size:0.75em;display:block;">${reactionText}</span>${damage}`;
        } else {
            el.textContent = damage;
        }

        document.getElementById('damage-numbers-container').appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }

    update(delta) {
        // Character cooldowns & party updates
        this.party.forEach(c => c.update(delta));
        if (this.dashCooldown > 0) this.dashCooldown -= delta;

        // Updraft / Wind currents check
        if (this.world && this.world.windCurrents) {
            this.world.windCurrents.forEach(wind => {
                if (this.playerPos.distanceTo(wind.position) < wind.radius) {
                    this.playerVel.y = wind.lift;
                    this.isGliding = true;
                }
            });
        }

        // Movement input
        const moveDir = this.getMovementDirection();
        const isMoving = moveDir.lengthSq() > 0.001;

        // Sprinting
        this.isSprinting = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && isMoving && this.stamina > 5;
        let speed = this.isSprinting ? 9.5 : 5.5;

        if (this.isSprinting) {
            this.stamina = Math.max(0, this.stamina - delta * 18);
        } else if (!this.isGliding && this.stamina < this.maxStamina) {
            this.stamina = Math.min(this.maxStamina, this.stamina + delta * 25);
        }

        // Jumping & Gliding
        if (this.keys['Space']) {
            if (this.isGrounded) {
                this.playerVel.y = 8.5;
                this.isGrounded = false;
                if (window.soundEngine) window.soundEngine.playSwordSwing();
            } else if (this.playerVel.y < 0 && !this.isGliding && this.stamina > 10) {
                // Deploy Glider!
                this.isGliding = true;
            }
        }

        // Gravity & Vertical physics
        if (this.isGliding) {
            this.playerVel.y = -1.8; // Gentle glide descent
            speed = 8.0;
            this.stamina = Math.max(0, this.stamina - delta * 8);
            if (this.stamina <= 0) this.isGliding = false;
        } else if (!this.isGrounded) {
            this.playerVel.y -= 22.0 * delta; // Gravity
        }

        // Apply horizontal speed
        if (isMoving) {
            this.playerPos.x += moveDir.x * speed * delta;
            this.playerPos.z += moveDir.z * speed * delta;

            // Rotate active character towards movement direction
            const angle = Math.atan2(moveDir.x, moveDir.z);
            this.partyGroup.rotation.y = angle;

            // Leg animation
            if (this.activeChar.mesh) {
                const legSwing = Math.sin(Date.now() * 0.012 * (speed / 5.5)) * 0.6;
                if (this.activeChar.mesh.leftLeg) this.activeChar.mesh.leftLeg.rotation.x = legSwing;
                if (this.activeChar.mesh.rightLeg) this.activeChar.mesh.rightLeg.rotation.x = -legSwing;
                if (this.activeChar.mesh.capeMesh) this.activeChar.mesh.capeMesh.rotation.x = 0.15 + (speed / 10) * 0.4;
            }
        } else {
            if (this.activeChar.mesh) {
                if (this.activeChar.mesh.leftLeg) this.activeChar.mesh.leftLeg.rotation.x = 0;
                if (this.activeChar.mesh.rightLeg) this.activeChar.mesh.rightLeg.rotation.x = 0;
            }
        }

        // Apply velocities
        this.playerPos.y += this.playerVel.y * delta;
        this.playerPos.x += this.playerVel.x * delta;
        this.playerPos.z += this.playerVel.z * delta;
        this.playerVel.x *= 0.85;
        this.playerVel.z *= 0.85;

        // Ground clamping
        const groundY = this.getTerrainHeight(this.playerPos.x, this.playerPos.z);
        if (this.playerPos.y <= groundY) {
            this.playerPos.y = groundY;
            this.playerVel.y = 0;
            this.isGrounded = true;
            this.isGliding = false;
        } else {
            this.isGrounded = false;
        }

        // Glider visibility
        if (this.activeChar.mesh && this.activeChar.mesh.glider) {
            this.activeChar.mesh.glider.visible = this.isGliding;
        }

        this.partyGroup.position.copy(this.playerPos);

        // Camera Follow (Smooth Third-Person Orbit)
        const camX = this.playerPos.x + Math.sin(this.cameraAngle.theta) * Math.cos(this.cameraAngle.phi) * this.cameraDistance;
        const camY = this.playerPos.y + Math.sin(this.cameraAngle.phi) * this.cameraDistance + 1.8;
        const camZ = this.playerPos.z + Math.cos(this.cameraAngle.theta) * Math.cos(this.cameraAngle.phi) * this.cameraDistance;
        this.camera.position.set(camX, camY, camZ);
        this.camera.lookAt(this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z);

        // Update Subsystems
        this.particleSystem.update(delta);
        this.world.update(this.clock.getElapsedTime());

        // Update Enemies
        this.enemies.forEach(e => e.update(delta, this.playerPos));

        // Check Interactables
        this.checkInteractables();
        this.updateHUD();
    }

    checkInteractables() {
        let nearest = null;
        let minDist = 3.5;

        this.world.interactables.forEach(item => {
            if (item.isOpened || item.isCollected) return;
            const dist = this.playerPos.distanceTo(item.position);
            if (dist < item.radius && dist < minDist) {
                minDist = dist;
                nearest = item;
            }
        });

        this.activeInteractable = nearest;
        const prompt = document.getElementById('interaction-prompt');
        if (nearest) {
            prompt.style.display = 'flex';
            prompt.innerHTML = `<span class="key-badge">F</span> ${nearest.name}`;
        } else {
            prompt.style.display = 'none';
        }
    }

    updateHUD() {
        // Primogems & Mora
        document.getElementById('primogem-count').textContent = this.primogems;
        document.getElementById('mora-count').textContent = this.mora.toLocaleString();

        // Active Character Info
        document.getElementById('char-name').textContent = this.activeChar.name;
        document.getElementById('char-title').textContent = this.activeChar.title;
        document.getElementById('char-hp-text').textContent = `${Math.round(this.activeChar.hp)} / ${this.activeChar.maxHp}`;
        document.getElementById('char-hp-fill').style.width = `${(this.activeChar.hp / this.activeChar.maxHp) * 100}%`;

        // Stamina Wheel / Bar
        const staminaBar = document.getElementById('stamina-fill');
        if (staminaBar) {
            staminaBar.style.width = `${(this.stamina / this.maxStamina) * 100}%`;
        }

        // Skill [E] Cooldown
        const skillBtn = document.getElementById('skill-btn');
        const skillCdEl = document.getElementById('skill-cd');
        if (this.activeChar.skillCooldown > 0) {
            skillCdEl.textContent = this.activeChar.skillCooldown.toFixed(1);
            skillCdEl.style.display = 'block';
            skillBtn.classList.add('on-cooldown');
        } else {
            skillCdEl.style.display = 'none';
            skillBtn.classList.remove('on-cooldown');
        }

        // Burst [Q] Energy
        const burstBtn = document.getElementById('burst-btn');
        const burstEnergyFill = document.getElementById('burst-energy-fill');
        const energyPct = (this.activeChar.energy / this.activeChar.maxEnergy) * 100;
        burstEnergyFill.style.height = `${energyPct}%`;
        if (this.activeChar.isBurstReady()) {
            burstBtn.classList.add('ready');
        } else {
            burstBtn.classList.remove('ready');
        }

        // Party List on Right
        this.party.forEach((c, idx) => {
            const card = document.getElementById(`party-card-${idx + 1}`);
            if (card) {
                if (idx === this.activeCharIndex) {
                    card.classList.add('active');
                } else {
                    card.classList.remove('active');
                }
                const hpFill = card.querySelector('.party-hp-fill');
                if (hpFill) hpFill.style.width = `${(c.hp / c.maxHp) * 100}%`;
                const burstIcon = card.querySelector('.party-burst-ready');
                if (burstIcon) burstIcon.style.display = c.isBurstReady() ? 'block' : 'none';
            }
        });
    }

    initUI() {
        // Toggle sound
        const soundBtn = document.getElementById('sound-toggle');
        soundBtn.addEventListener('click', () => {
            const muted = window.soundEngine.toggleMute();
            soundBtn.textContent = muted ? '🔇 Sound: OFF' : '🔊 Sound: ON';
        });

        // Wish Button
        document.getElementById('wish-btn').addEventListener('click', () => this.toggleWishModal());
        document.getElementById('close-wish-modal').addEventListener('click', () => this.toggleWishModal());

        // Wish 1x & 10x
        document.getElementById('wish-single-btn').addEventListener('click', () => this.executeWish(1));
        document.getElementById('wish-multi-btn').addEventListener('click', () => this.executeWish(10));
        document.getElementById('close-results-btn').addEventListener('click', () => {
            document.getElementById('wish-results-modal').style.display = 'none';
        });

        // Help Modal
        document.getElementById('help-btn').addEventListener('click', () => this.toggleHelpModal());
        document.getElementById('close-help-modal').addEventListener('click', () => this.toggleHelpModal());
    }

    toggleWishModal() {
        const modal = document.getElementById('wish-modal');
        const isShown = modal.style.display === 'flex';
        modal.style.display = isShown ? 'none' : 'flex';
        if (!isShown && document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    toggleHelpModal() {
        const modal = document.getElementById('help-modal');
        const isShown = modal.style.display === 'flex';
        modal.style.display = isShown ? 'none' : 'flex';
        if (!isShown && document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    executeWish(count) {
        const cost = count * 160;
        if (this.primogems < cost) {
            this.showNotification(`Not enough Primogems! Need ${cost} 💎`);
            return;
        }

        this.primogems -= cost;
        this.updateHUD();

        const results = this.gacha.pullMulti(count);
        const has5Star = results.some(r => r.stars === 5);
        const has4Star = results.some(r => r.stars === 4);

        if (window.soundEngine) {
            window.soundEngine.playWishStar(has5Star);
        }

        // Show Animation Comet Overlay
        const cometOverlay = document.getElementById('wish-comet-overlay');
        const cometStar = document.getElementById('comet-star');
        cometStar.className = 'comet-star ' + (has5Star ? 'gold' : has4Star ? 'purple' : 'blue');
        cometOverlay.style.display = 'flex';

        setTimeout(() => {
            cometOverlay.style.display = 'none';
            this.displayWishResults(results);
        }, 1800);
    }

    displayWishResults(results) {
        const container = document.getElementById('wish-cards-grid');
        container.innerHTML = '';

        results.forEach(item => {
            const card = document.createElement('div');
            card.className = `wish-card star-${item.stars}`;
            const starsStr = '★'.repeat(item.stars);
            card.innerHTML = `
                <div class="wish-card-icon">${item.icon}</div>
                <div class="wish-card-stars">${starsStr}</div>
                <div class="wish-card-name">${item.name}</div>
                <div class="wish-card-type">${item.type.toUpperCase()}</div>
            `;
            container.appendChild(card);
        });

        document.getElementById('wish-results-modal').style.display = 'flex';
    }

    animate() {
        requestAnimationFrame(this.animate);
        const delta = Math.min(this.clock.getDelta(), 0.1);
        this.update(delta);
        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('load', () => {
    window.game = new ImpactGame();
});

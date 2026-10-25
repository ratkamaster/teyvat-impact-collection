// Genshin Impact Elemental Reactions Engine
const Elements = {
    PHYSICAL: 'PHYSICAL',
    PYRO: 'PYRO',
    HYDRO: 'HYDRO',
    ELECTRO: 'ELECTRO',
    ANEMO: 'ANEMO',
    CRYO: 'CRYO'
};

const ElementColors = {
    PHYSICAL: '#ffffff',
    PYRO: '#ff5c28',
    HYDRO: '#1ec6ff',
    ELECTRO: '#c469ff',
    ANEMO: '#4af5b0',
    CRYO: '#96f5ff'
};

const ElementIcons = {
    PYRO: '🔥',
    HYDRO: '💧',
    ELECTRO: '⚡',
    ANEMO: '🍃',
    CRYO: '❄️'
};

class ElementalEngine {
    constructor(game) {
        this.game = game;
    }

    processHit(target, attackElement, damage, isCrit = false) {
        if (!target || target.isDead) return;

        let finalDamage = damage;
        let reactionText = null;
        let reactionColor = '#ffffff';
        let reactionElement = null;

        const currentAura = target.elementalAura;

        // If target has no element or attack is physical, just deal damage
        if (attackElement === Elements.PHYSICAL || !attackElement) {
            this.applyDamage(target, finalDamage, Elements.PHYSICAL, isCrit, null);
            return;
        }

        // Check for Elemental Reactions
        if (currentAura && currentAura !== attackElement) {
            // 1. VAPORIZE (Hydro + Pyro)
            if ((currentAura === Elements.PYRO && attackElement === Elements.HYDRO) ||
                (currentAura === Elements.HYDRO && attackElement === Elements.PYRO)) {
                
                const multiplier = attackElement === Elements.HYDRO ? 2.0 : 1.5;
                finalDamage = Math.round(finalDamage * multiplier);
                reactionText = 'VAPORIZE';
                reactionColor = '#ffaa33';
                target.clearAura();
                if (window.soundEngine) window.soundEngine.playReaction();
            }
            // 2. OVERLOADED (Pyro + Electro)
            else if ((currentAura === Elements.PYRO && attackElement === Elements.ELECTRO) ||
                     (currentAura === Elements.ELECTRO && attackElement === Elements.PYRO)) {
                
                reactionText = 'OVERLOAD';
                reactionColor = '#ff4444';
                target.clearAura();
                
                // Trigger Overload AoE explosion
                if (this.game && this.game.particleSystem) {
                    this.game.particleSystem.spawnExplosion(target.position, '#ff5522', 30);
                }
                if (window.soundEngine) window.soundEngine.playPyroSkill();

                // Knockback and AoE Pyro DMG to surrounding enemies
                if (this.game && this.game.enemies) {
                    this.game.enemies.forEach(other => {
                        if (other !== target && !other.isDead) {
                            const dist = target.position.distanceTo(other.position);
                            if (dist < 5.0) {
                                other.takeDamage(Math.round(damage * 0.75), Elements.PYRO, false);
                                // Knockback
                                const dir = other.position.clone().sub(target.position).normalize();
                                other.velocity.add(dir.multiplyScalar(6));
                            }
                        }
                    });
                }
                // Knockback target
                if (target.velocity) {
                    target.velocity.y += 4;
                }
            }
            // 3. ELECTRO-CHARGED (Hydro + Electro)
            else if ((currentAura === Elements.HYDRO && attackElement === Elements.ELECTRO) ||
                     (currentAura === Elements.ELECTRO && attackElement === Elements.HYDRO)) {
                
                reactionText = 'ELECTRO-CHARGED';
                reactionColor = '#da70d6';
                finalDamage = Math.round(finalDamage * 1.3);
                if (window.soundEngine) window.soundEngine.playElectroSkill();

                // Periodic discharge timer
                target.startElectroChargedTicks(Math.round(damage * 0.4));
            }
            // 4. SWIRL (Anemo + Pyro/Hydro/Electro/Cryo)
            else if (attackElement === Elements.ANEMO && currentAura && currentAura !== Elements.ANEMO) {
                reactionText = `SWIRL (${currentAura})`;
                reactionColor = ElementColors[currentAura] || '#4af5b0';
                reactionElement = currentAura;
                const swirlDmg = Math.round(damage * 0.85);

                if (window.soundEngine) window.soundEngine.playAnemoSkill();

                // Spread the aura element to all nearby enemies!
                if (this.game && this.game.enemies) {
                    this.game.enemies.forEach(other => {
                        if (other !== target && !other.isDead) {
                            const dist = target.position.distanceTo(other.position);
                            if (dist < 6.5) {
                                other.takeDamage(swirlDmg, currentAura, false);
                                other.applyAura(currentAura, 6000);
                            }
                        }
                    });
                }
                target.clearAura();
            }
            // 5. MELT (Pyro + Cryo)
            else if ((currentAura === Elements.CRYO && attackElement === Elements.PYRO) ||
                     (currentAura === Elements.PYRO && attackElement === Elements.CRYO)) {
                
                const mult = attackElement === Elements.PYRO ? 2.0 : 1.5;
                finalDamage = Math.round(finalDamage * mult);
                reactionText = 'MELT';
                reactionColor = '#ffe066';
                target.clearAura();
                if (window.soundEngine) window.soundEngine.playReaction();
            }
            // 6. FROZEN (Hydro + Cryo)
            else if ((currentAura === Elements.HYDRO && attackElement === Elements.CRYO) ||
                     (currentAura === Elements.CRYO && attackElement === Elements.HYDRO)) {
                reactionText = 'FROZEN';
                reactionColor = '#80d8ff';
                target.freeze(3.0);
                target.clearAura();
                if (window.soundEngine) window.soundEngine.playReaction();
            }
        } else if (!currentAura && attackElement !== Elements.PHYSICAL && attackElement !== Elements.ANEMO) {
            // Apply new aura to the target
            target.applyAura(attackElement, 9000);
        }

        // Deal the computed damage
        this.applyDamage(target, finalDamage, attackElement, isCrit, reactionText, reactionColor);
    }

    applyDamage(target, damage, element, isCrit, reactionText, reactionColor) {
        target.takeDamage(damage, element, isCrit);

        // Spawn visual damage numbers
        if (this.game && this.game.spawnDamageNumber) {
            this.game.spawnDamageNumber(
                target.position,
                damage,
                ElementColors[element] || '#ffffff',
                isCrit,
                reactionText,
                reactionColor
            );
        }
    }
}

window.ElementalEngine = ElementalEngine;

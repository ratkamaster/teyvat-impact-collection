// Genshin Impact Wish / Gacha System
class GachaSystem {
    constructor(game) {
        this.game = game;
        this.pity4 = 0;
        this.pity5 = 0;
        this.totalPulls = 0;

        this.pool = {
            star5: [
                { name: 'Raiden Shogun', type: 'character', element: 'ELECTRO', stars: 5, icon: '⚡', desc: 'Plane of Euthymia - Electro Archon' },
                { name: 'Hu Tao', type: 'character', element: 'PYRO', stars: 5, icon: '🔥', desc: '77th Director of the Wangsheng Funeral Parlor' },
                { name: 'Kamisato Ayaka', type: 'character', element: 'CRYO', stars: 5, icon: '❄️', desc: 'Frostflake Heron - Shirasagi Himegimi' },
                { name: 'Staff of Homa', type: 'weapon', stars: 5, icon: '🔱', desc: 'A legendary crimson polearm' },
                { name: 'Mistsplitter Reforged', type: 'weapon', stars: 5, icon: '⚔️', desc: 'A sword that blazes with fierce violet light' }
            ],
            star4: [
                { name: 'Bennett', type: 'character', element: 'PYRO', stars: 4, icon: '🔥', desc: 'Leader of Benny\'s Adventure Team' },
                { name: 'Xingqiu', type: 'character', element: 'HYDRO', stars: 4, icon: '💧', desc: 'Guhua Clan Disciple' },
                { name: 'Xiangling', type: 'character', element: 'PYRO', stars: 4, icon: '🔥', desc: 'Head Chef at Wanmin Restaurant' },
                { name: 'Sucrose', type: 'character', element: 'ANEMO', stars: 4, icon: '🍃', desc: 'Knights of Favonius Alchemist' },
                { name: 'Favonius Sword', type: 'weapon', stars: 4, icon: '🗡️', desc: 'Standard-issue sword of the Knights' },
                { name: 'The Widsith', type: 'weapon', stars: 4, icon: '📖', desc: 'A heavy notebook filled with musical scores' },
                { name: 'Sacrificial Greatsword', type: 'weapon', stars: 4, icon: '⚔️', desc: 'A ceremonial greatsword' }
            ],
            star3: [
                { name: 'Cool Steel', type: 'weapon', stars: 3, icon: '🗡️', desc: 'A reliable steel sword' },
                { name: 'Debate Club', type: 'weapon', stars: 3, icon: '🔨', desc: 'A formidable steel club' },
                { name: 'Harbinger of Dawn', type: 'weapon', stars: 3, icon: '⚔️', desc: 'A sword with a shining gem in the pommel' },
                { name: 'Sharpshooter\'s Oath', type: 'weapon', stars: 3, icon: '🏹', desc: 'A superior hunting bow' },
                { name: 'Black Tassel', type: 'weapon', stars: 3, icon: '🔱', desc: 'An exceptional halberd' }
            ]
        };
    }

    pullSingle() {
        this.totalPulls++;
        this.pity4++;
        this.pity5++;

        // 5-Star probability: base 0.6%, soft pity starts at 74
        let p5 = 0.006;
        if (this.pity5 >= 74) {
            p5 += (this.pity5 - 73) * 0.06;
        }

        const roll = Math.random();

        // 5-Star Drop!
        if (roll < p5 || this.pity5 >= 90) {
            this.pity5 = 0;
            this.pity4 = 0;
            const item = this.pool.star5[Math.floor(Math.random() * this.pool.star5.length)];
            return item;
        }

        // 4-Star Drop (base 5.1% or pity at 10)
        if (roll < p5 + 0.051 || this.pity4 >= 10) {
            this.pity4 = 0;
            const item = this.pool.star4[Math.floor(Math.random() * this.pool.star4.length)];
            return item;
        }

        // 3-Star Drop
        const item = this.pool.star3[Math.floor(Math.random() * this.pool.star3.length)];
        return item;
    }

    pullMulti(count = 10) {
        const results = [];
        for (let i = 0; i < count; i++) {
            results.push(this.pullSingle());
        }
        return results;
    }
}

window.GachaSystem = GachaSystem;

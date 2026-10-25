#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <mmsystem.h>
#include <GL/gl.h>
#include <GL/glu.h>
#include <vector>
#include <cmath>
#include <string>
#include <algorithm>
#include <random>

using std::min;
using std::max;

// Link libraries
#pragma comment(lib, "opengl32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "winmm.lib")

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// --- Math Utilities ---
struct Vec3 {
    float x, y, z;
    Vec3(float _x = 0, float _y = 0, float _z = 0) : x(_x), y(_y), z(_z) {}
    Vec3 operator+(const Vec3& o) const { return Vec3(x + o.x, y + o.y, z + o.z); }
    Vec3 operator-(const Vec3& o) const { return Vec3(x - o.x, y - o.y, z - o.z); }
    Vec3 operator*(float s) const { return Vec3(x * s, y * s, z * s); }
    Vec3& operator+=(const Vec3& o) { x += o.x; y += o.y; z += o.z; return *this; }
    float lengthSq() const { return x * x + y * y + z * z; }
    float length() const { return std::sqrt(lengthSq()); }
    Vec3 normalized() const {
        float l = length();
        return l > 0.0001f ? Vec3(x / l, y / l, z / l) : Vec3(0, 0, 0);
    }
    float dist(const Vec3& o) const { return (*this - o).length(); }
};

// --- In-Memory Procedural Audio ---
class SoundManager {
public:
    std::vector<BYTE> wavSwing, wavHit, wavBoom, wavDash;

    void init() {
        wavSwing = makeWav(22050, 0.12f, [](float t) {
            float freq = 450.0f - t * 2500.0f;
            return std::sin(t * freq * 2.0f * (float)M_PI) * (1.0f - t / 0.12f);
        });
        wavHit = makeWav(22050, 0.15f, [](float t) {
            float freq = 180.0f - t * 900.0f;
            float noise = ((float)(rand() % 2000) / 1000.0f - 1.0f) * 0.3f;
            return (std::sin(t * freq * 2.0f * (float)M_PI) + noise) * (1.0f - t / 0.15f);
        });
        wavBoom = makeWav(22050, 0.4f, [](float t) {
            float noise = ((float)(rand() % 2000) / 1000.0f - 1.0f);
            float low = std::sin(t * 80.0f * 2.0f * (float)M_PI);
            return (low * 0.6f + noise * 0.4f) * (1.0f - t / 0.4f);
        });
        wavDash = makeWav(22050, 0.18f, [](float t) {
            float freq = 600.0f - t * 2200.0f;
            return std::sin(t * freq * 2.0f * (float)M_PI) * (1.0f - t / 0.18f) * 0.5f;
        });
    }

    void playSwing() { PlaySoundA((LPCSTR)wavSwing.data(), NULL, SND_MEMORY | SND_ASYNC); }
    void playHit() { PlaySoundA((LPCSTR)wavHit.data(), NULL, SND_MEMORY | SND_ASYNC); }
    void playBoom() { PlaySoundA((LPCSTR)wavBoom.data(), NULL, SND_MEMORY | SND_ASYNC); }
    void playDash() { PlaySoundA((LPCSTR)wavDash.data(), NULL, SND_MEMORY | SND_ASYNC); }

private:
    template<typename F>
    std::vector<BYTE> makeWav(int sampleRate, float duration, F gen) {
        int numSamples = (int)(sampleRate * duration);
        int dataSize = numSamples * 2;
        int fileSize = 44 + dataSize;
        std::vector<BYTE> buf(fileSize);

        // RIFF Header
        memcpy(&buf[0], "RIFF", 4);
        int s = fileSize - 8; memcpy(&buf[4], &s, 4);
        memcpy(&buf[8], "WAVE", 4);
        memcpy(&buf[12], "fmt ", 4);
        int sub1 = 16; memcpy(&buf[16], &sub1, 4);
        short fmt = 1; memcpy(&buf[20], &fmt, 2);
        short channels = 1; memcpy(&buf[22], &channels, 2);
        memcpy(&buf[24], &sampleRate, 4);
        int byteRate = sampleRate * 2; memcpy(&buf[28], &byteRate, 4);
        short blockAlign = 2; memcpy(&buf[32], &blockAlign, 2);
        short bits = 16; memcpy(&buf[34], &bits, 2);
        memcpy(&buf[36], "data", 4);
        memcpy(&buf[40], &dataSize, 4);

        short* samples = (short*)(&buf[44]);
        for (int i = 0; i < numSamples; i++) {
            float t = (float)i / (float)sampleRate;
            float val = gen(t);
            val = max(-1.0f, min(1.0f, val));
            samples[i] = (short)(val * 30000.0f);
        }
        return buf;
    }
};

// --- Particle VFX ---
struct Particle {
    Vec3 pos, vel, color;
    float life, maxLife, size;
};

// --- Floating Damage Text ---
struct DamageNumber {
    Vec3 pos, color;
    int amount;
    float life, maxLife;
    bool isCrit;
};

// --- Slash Arc VFX ---
struct SlashArc {
    Vec3 pos;
    float yaw;
    Vec3 color;
    float life, maxLife;
};

// --- Enemy Types ---
enum EnemyType { SLIME, GOLEM, RUIN_TITAN };

struct Enemy {
    EnemyType type;
    Vec3 pos, vel;
    float yaw;
    float hp, maxHp;
    float atk;
    float speed;
    float attackCooldown;
    float hitFlash;
    bool isDead;
    float stateTimer;
    bool isSpinning;
};

// --- Game State Enum ---
enum GameState { PLAYING, GAME_OVER, VICTORY };

// --- Element Infusion ---
enum ElementType { ELEM_PYRO, ELEM_HYDRO, ELEM_ELECTRO };

// --- Global Engine Context ---
class GameEngine {
public:
    HWND hWnd;
    HDC hDC;
    HGLRC hRC;
    int screenW = 1280, screenH = 720;
    bool keys[256] = { false };
    bool mouseCaptured = true;
    POINT lastMouse;

    // Camera
    float camYaw = 0.0f;
    float camPitch = 0.35f;
    float camDist = 7.0f;
    float screenShake = 0.0f;

    // Player
    Vec3 playerPos = { 0, 0, 0 };
    Vec3 playerVel = { 0, 0, 0 };
    float playerYaw = 0.0f;
    float playerHp = 10000.0f, playerMaxHp = 10000.0f;
    float stamina = 100.0f, maxStamina = 100.0f;
    bool isGrounded = true;
    bool isDashing = false;
    float dashTimer = 0.0f;
    float invulnerableTimer = 0.0f;

    // Combat
    int attackCombo = 0;
    float attackTimer = 0.0f;
    float skillCooldown = 0.0f, maxSkillCooldown = 6.0f;
    float burstEnergy = 40.0f, maxBurstEnergy = 100.0f;
    ElementType currentElement = ELEM_PYRO;

    // World & Enemies
    int currentWave = 1;
    std::vector<Enemy> enemies;
    std::vector<Particle> particles;
    std::vector<DamageNumber> damageNumbers;
    std::vector<SlashArc> slashArcs;

    GameState state = PLAYING;
    SoundManager audio;
    float globalTime = 0.0f;
    int score = 0;

    void init(HWND window) {
        hWnd = window;
        hDC = GetDC(hWnd);

        PIXELFORMATDESCRIPTOR pfd = {};
        pfd.nSize = sizeof(pfd);
        pfd.nVersion = 1;
        pfd.dwFlags = PFD_DRAW_TO_WINDOW | PFD_SUPPORT_OPENGL | PFD_DOUBLEBUFFER;
        pfd.iPixelType = PFD_TYPE_RGBA;
        pfd.cColorBits = 32;
        pfd.cDepthBits = 24;

        int format = ChoosePixelFormat(hDC, &pfd);
        SetPixelFormat(hDC, format, &pfd);
        hRC = wglCreateContext(hDC);
        wglMakeCurrent(hDC, hRC);

        RECT r;
        GetClientRect(hWnd, &r);
        screenW = max(1, (int)(r.right - r.left));
        screenH = max(1, (int)(r.bottom - r.top));

        glEnable(GL_DEPTH_TEST);
        glDepthFunc(GL_LEQUAL);
        glDisable(GL_CULL_FACE);
        glShadeModel(GL_SMOOTH);

        // Lighting
        glEnable(GL_LIGHTING);
        glEnable(GL_LIGHT0);
        glEnable(GL_COLOR_MATERIAL);
        glColorMaterial(GL_FRONT_AND_BACK, GL_AMBIENT_AND_DIFFUSE);

        float lightPos[] = { 30.0f, 60.0f, 40.0f, 1.0f };
        float lightDiff[] = { 1.0f, 0.95f, 0.88f, 1.0f };
        float lightAmb[] = { 0.55f, 0.58f, 0.65f, 1.0f };
        glLightfv(GL_LIGHT0, GL_POSITION, lightPos);
        glLightfv(GL_LIGHT0, GL_DIFFUSE, lightDiff);
        glLightfv(GL_LIGHT0, GL_AMBIENT, lightAmb);

        audio.init();
        spawnWave(1);
        captureMouse(true);
    }

    void captureMouse(bool capture) {
        mouseCaptured = capture;
        ShowCursor(!capture);
        if (capture) {
            RECT rect;
            GetClientRect(hWnd, &rect);
            POINT pt = { (rect.right - rect.left) / 2, (rect.bottom - rect.top) / 2 };
            ClientToScreen(hWnd, &pt);
            SetCursorPos(pt.x, pt.y);
            lastMouse = pt;
        }
    }

    void spawnWave(int wave) {
        currentWave = wave;
        enemies.clear();

        if (wave == 1) {
            // Wave 1: 5 Elemental Slimes
            for (int i = 0; i < 5; i++) {
                float angle = (float)i * (2.0f * (float)M_PI / 5.0f);
                float dist = 14.0f;
                Enemy e = {};
                e.type = SLIME;
                e.pos = { std::cos(angle) * dist, 0.5f, std::sin(angle) * dist };
                e.hp = e.maxHp = 2200.0f;
                e.atk = 280.0f;
                e.speed = 3.6f;
                enemies.push_back(e);
            }
        } else if (wave == 2) {
            // Wave 2: 3 Stone Golems + 2 Slimes
            for (int i = 0; i < 3; i++) {
                float angle = (float)i * (2.0f * (float)M_PI / 3.0f);
                Enemy e = {};
                e.type = GOLEM;
                e.pos = { std::cos(angle) * 16.0f, 0.0f, std::sin(angle) * 16.0f };
                e.hp = e.maxHp = 6500.0f;
                e.atk = 550.0f;
                e.speed = 4.2f;
                enemies.push_back(e);
            }
            for (int i = 0; i < 2; i++) {
                Enemy e = {};
                e.type = SLIME;
                e.pos = { (i == 0 ? 12.0f : -12.0f), 0.5f, 10.0f };
                e.hp = e.maxHp = 2500.0f;
                e.atk = 320.0f;
                e.speed = 3.8f;
                enemies.push_back(e);
            }
        } else if (wave == 3) {
            // Wave 3: ANCIENT RUIN TITAN (BOSS!)
            Enemy boss = {};
            boss.type = RUIN_TITAN;
            boss.pos = { 0.0f, 0.0f, -18.0f };
            boss.hp = boss.maxHp = 35000.0f;
            boss.atk = 900.0f;
            boss.speed = 3.2f;
            enemies.push_back(boss);
        }
    }

    void spawnExplosion(Vec3 pos, Vec3 color, int count, float speed = 7.0f) {
        for (int i = 0; i < count; i++) {
            Particle p;
            p.pos = pos;
            float theta = ((float)rand() / (float)RAND_MAX) * 2.0f * (float)M_PI;
            float phi = ((float)rand() / (float)RAND_MAX) * (float)M_PI;
            float spd = (((float)rand() / (float)RAND_MAX) * 0.7f + 0.3f) * speed;
            p.vel = { std::sin(phi) * std::cos(theta) * spd,
                      std::abs(std::cos(phi)) * spd + 1.5f,
                      std::sin(phi) * std::sin(theta) * spd };
            p.color = color;
            p.life = p.maxLife = 0.4f + ((float)rand() / (float)RAND_MAX) * 0.4f;
            p.size = 0.25f;
            particles.push_back(p);
        }
    }

    void spawnDamageNumber(Vec3 pos, int amount, Vec3 color, bool isCrit) {
        DamageNumber d;
        d.pos = pos + Vec3((float)(rand() % 100 - 50) * 0.01f, 1.8f, (float)(rand() % 100 - 50) * 0.01f);
        d.color = color;
        d.amount = amount;
        d.life = d.maxLife = 0.8f;
        d.isCrit = isCrit;
        damageNumbers.push_back(d);
    }

    void performAttack() {
        if (attackTimer > 0.0f) return;
        attackTimer = 0.22f;
        attackCombo = (attackCombo + 1) % 3;
        audio.playSwing();

        // Calculate slash position in front of player
        Vec3 forward(-std::sin(playerYaw), 0, -std::cos(playerYaw));
        Vec3 slashPos = playerPos + forward * 1.6f + Vec3(0, 1.0f, 0);

        Vec3 elemColor = (currentElement == ELEM_PYRO) ? Vec3(1.0f, 0.35f, 0.1f) :
                         (currentElement == ELEM_HYDRO) ? Vec3(0.1f, 0.75f, 1.0f) :
                                                          Vec3(0.8f, 0.35f, 1.0f);

        // Add slash arc VFX
        SlashArc arc;
        arc.pos = slashPos;
        arc.yaw = playerYaw;
        arc.color = elemColor;
        arc.life = arc.maxLife = 0.2f;
        slashArcs.push_back(arc);

        // Hit Detection
        for (auto& e : enemies) {
            if (e.isDead) continue;
            if (playerPos.dist(e.pos) < 3.8f) {
                Vec3 toEnemy = (e.pos - playerPos).normalized();
                if (toEnemy.x * forward.x + toEnemy.z * forward.z > 0.25f) {
                    bool isCrit = (rand() % 100) < 30;
                    float baseAtk = 850.0f + attackCombo * 250.0f;
                    if (isCrit) baseAtk *= 1.7f;
                    int dmg = (int)baseAtk;

                    e.hp -= dmg;
                    e.hitFlash = 0.12f;
                    spawnDamageNumber(e.pos, dmg, elemColor, isCrit);
                    spawnExplosion(e.pos + Vec3(0, 1, 0), elemColor, 12, 4.0f);
                    audio.playHit();

                    burstEnergy = min(maxBurstEnergy, burstEnergy + 8.0f);
                    screenShake = isCrit ? 0.25f : 0.1f;

                    if (e.hp <= 0) {
                        e.isDead = true;
                        score += (e.type == RUIN_TITAN) ? 5000 : 800;
                        spawnExplosion(e.pos + Vec3(0, 1.5f, 0), Vec3(1.0f, 0.85f, 0.2f), 30, 8.0f);
                    }
                }
            }
        }
    }

    void castSkill() {
        if (skillCooldown > 0.0f) return;
        skillCooldown = maxSkillCooldown;
        audio.playBoom();
        screenShake = 0.35f;

        Vec3 forward(-std::sin(playerYaw), 0, -std::cos(playerYaw));
        Vec3 burstCenter = playerPos + forward * 2.2f;

        Vec3 elemColor = (currentElement == ELEM_PYRO) ? Vec3(1.0f, 0.25f, 0.05f) :
                         (currentElement == ELEM_HYDRO) ? Vec3(0.0f, 0.6f, 1.0f) :
                                                          Vec3(0.85f, 0.2f, 1.0f);

        spawnExplosion(burstCenter + Vec3(0, 1, 0), elemColor, 45, 9.0f);

        // AoE Damage
        for (auto& e : enemies) {
            if (e.isDead) continue;
            if (burstCenter.dist(e.pos) < 6.0f) {
                int dmg = (int)(2200.0f + (rand() % 600));
                e.hp -= dmg;
                e.hitFlash = 0.15f;
                spawnDamageNumber(e.pos, dmg, elemColor, true);

                // Knockback
                Vec3 push = (e.pos - playerPos).normalized() * 8.0f;
                e.vel += push;

                if (e.hp <= 0) {
                    e.isDead = true;
                    score += 1000;
                    spawnExplosion(e.pos + Vec3(0, 1.5f, 0), Vec3(1.0f, 0.85f, 0.2f), 35, 9.0f);
                }
            }
        }
        burstEnergy = min(maxBurstEnergy, burstEnergy + 15.0f);
    }

    void castBurst() {
        if (burstEnergy < maxBurstEnergy) return;
        burstEnergy = 0.0f;
        audio.playBoom();
        screenShake = 0.7f;

        Vec3 elemColor = (currentElement == ELEM_PYRO) ? Vec3(1.0f, 0.2f, 0.0f) :
                         (currentElement == ELEM_HYDRO) ? Vec3(0.0f, 0.8f, 1.0f) :
                                                          Vec3(0.9f, 0.2f, 1.0f);

        // Grand AoE detonation
        spawnExplosion(playerPos + Vec3(0, 1.0f, 0), elemColor, 100, 14.0f);

        for (auto& e : enemies) {
            if (e.isDead) continue;
            if (playerPos.dist(e.pos) < 12.0f) {
                int dmg = (int)(6500.0f + (rand() % 1500));
                e.hp -= dmg;
                e.hitFlash = 0.25f;
                spawnDamageNumber(e.pos, dmg, Vec3(1.0f, 0.9f, 0.2f), true);

                Vec3 push = (e.pos - playerPos).normalized() * 14.0f;
                push.y = 8.0f;
                e.vel += push;

                if (e.hp <= 0) {
                    e.isDead = true;
                    score += 2500;
                    spawnExplosion(e.pos + Vec3(0, 1.5f, 0), Vec3(1.0f, 0.85f, 0.2f), 40, 10.0f);
                }
            }
        }
    }

    void performDash() {
        if (dashTimer > 0.0f || stamina < 25.0f) return;
        stamina -= 25.0f;
        dashTimer = 0.5f;
        invulnerableTimer = 0.3f;
        audio.playDash();

        Vec3 moveDir(0, 0, 0);
        float sinY = std::sin(camYaw), cosY = std::cos(camYaw);
        if (keys['W']) { moveDir.x -= sinY; moveDir.z -= cosY; }
        if (keys['S']) { moveDir.x += sinY; moveDir.z += cosY; }
        if (keys['A']) { moveDir.x -= cosY; moveDir.z += sinY; }
        if (keys['D']) { moveDir.x += cosY; moveDir.z -= sinY; }

        if (moveDir.lengthSq() < 0.001f) {
            moveDir = Vec3(-sinY, 0, -cosY);
        }
        playerVel = moveDir.normalized() * 18.0f;
        spawnExplosion(playerPos + Vec3(0, 0.5f, 0), Vec3(0.9f, 0.9f, 1.0f), 15, 3.0f);
    }

    void update(float dt) {
        globalTime += dt;

        // Timers
        if (attackTimer > 0.0f) attackTimer -= dt;
        if (skillCooldown > 0.0f) skillCooldown -= dt;
        if (dashTimer > 0.0f) dashTimer -= dt;
        if (invulnerableTimer > 0.0f) invulnerableTimer -= dt;
        if (screenShake > 0.0f) screenShake = max(0.0f, screenShake - dt * 2.0f);

        // Stamina recharge
        if (stamina < maxStamina) stamina = min(maxStamina, stamina + dt * 22.0f);

        // Player Movement
        Vec3 moveDir(0, 0, 0);
        float sinY = std::sin(camYaw), cosY = std::cos(camYaw);
        if (keys['W']) { moveDir.x -= sinY; moveDir.z -= cosY; }
        if (keys['S']) { moveDir.x += sinY; moveDir.z += cosY; }
        if (keys['A']) { moveDir.x -= cosY; moveDir.z += sinY; }
        if (keys['D']) { moveDir.x += cosY; moveDir.z -= sinY; }

        bool isMoving = moveDir.lengthSq() > 0.001f;
        bool isSprinting = (keys[VK_SHIFT] && isMoving && stamina > 5.0f);
        float speed = isSprinting ? 10.5f : 6.2f;

        if (isSprinting) {
            stamina = max(0.0f, stamina - dt * 16.0f);
        }

        if (isMoving) {
            moveDir = moveDir.normalized();
            playerPos.x += moveDir.x * speed * dt;
            playerPos.z += moveDir.z * speed * dt;
            playerYaw = std::atan2(moveDir.x, moveDir.z) + (float)M_PI;
        }

        // Apply Dash velocity & friction
        playerPos.x += playerVel.x * dt;
        playerPos.z += playerVel.z * dt;
        playerVel.x *= 0.88f;
        playerVel.z *= 0.88f;

        // Jump & Gravity
        if (keys[VK_SPACE] && isGrounded) {
            playerVel.y = 8.5f;
            isGrounded = false;
        }

        if (!isGrounded) {
            playerVel.y -= 22.0f * dt;
            playerPos.y += playerVel.y * dt;
            if (playerPos.y <= 0.0f) {
                playerPos.y = 0.0f;
                playerVel.y = 0.0f;
                isGrounded = true;
            }
        }

        // Arena boundary clamp (radius 28)
        float distCenter = std::sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z);
        if (distCenter > 27.0f) {
            playerPos.x = (playerPos.x / distCenter) * 27.0f;
            playerPos.z = (playerPos.z / distCenter) * 27.0f;
        }

        // Element Switch Keys
        if (keys['1']) currentElement = ELEM_PYRO;
        if (keys['2']) currentElement = ELEM_HYDRO;
        if (keys['3']) currentElement = ELEM_ELECTRO;

        // Update Enemies
        bool allDead = true;
        for (auto& e : enemies) {
            if (e.isDead) continue;
            allDead = false;

            if (e.hitFlash > 0.0f) e.hitFlash -= dt;

            // Face player
            Vec3 toPlayer = playerPos - e.pos;
            toPlayer.y = 0;
            float dist = toPlayer.length();
            if (dist > 0.001f) {
                e.yaw = std::atan2(toPlayer.x, toPlayer.z) + (float)M_PI;
            }

            e.stateTimer += dt;

            // Enemy AI logic
            if (e.type == SLIME) {
                if (dist < 20.0f && dist > 1.8f) {
                    Vec3 dir = toPlayer.normalized();
                    e.pos.x += dir.x * e.speed * dt;
                    e.pos.z += dir.z * e.speed * dt;
                    e.pos.y = 0.5f + std::abs(std::sin(globalTime * 6.0f)) * 0.8f; // Cute hop
                } else if (dist <= 1.8f && e.attackCooldown <= 0.0f) {
                    // Attack
                    e.attackCooldown = 1.6f;
                    if (invulnerableTimer <= 0.0f) {
                        playerHp = max(0.0f, playerHp - e.atk);
                        audio.playHit();
                        screenShake = 0.2f;
                    }
                }
            } else if (e.type == GOLEM) {
                if (dist > 2.4f) {
                    Vec3 dir = toPlayer.normalized();
                    e.pos.x += dir.x * e.speed * dt;
                    e.pos.z += dir.z * e.speed * dt;
                } else if (e.attackCooldown <= 0.0f) {
                    e.attackCooldown = 2.0f;
                    if (invulnerableTimer <= 0.0f) {
                        playerHp = max(0.0f, playerHp - e.atk);
                        audio.playHit();
                        screenShake = 0.3f;
                    }
                }
            } else if (e.type == RUIN_TITAN) {
                // Boss Whirlwind or Stomp
                if (e.isSpinning) {
                    e.yaw += dt * 10.0f;
                    Vec3 dir = toPlayer.normalized();
                    e.pos.x += dir.x * (e.speed * 1.5f) * dt;
                    e.pos.z += dir.z * (e.speed * 1.5f) * dt;
                    if (dist < 4.0f && invulnerableTimer <= 0.0f) {
                        playerHp = max(0.0f, playerHp - e.atk * 0.5f * dt);
                        screenShake = 0.15f;
                    }
                    if (e.stateTimer > 4.5f) {
                        e.isSpinning = false;
                        e.stateTimer = 0.0f;
                    }
                } else {
                    if (dist > 3.5f) {
                        Vec3 dir = toPlayer.normalized();
                        e.pos.x += dir.x * e.speed * dt;
                        e.pos.z += dir.z * e.speed * dt;
                    }
                    if (e.stateTimer > 6.0f) {
                        e.isSpinning = true;
                        e.stateTimer = 0.0f;
                    } else if (dist <= 3.5f && e.attackCooldown <= 0.0f) {
                        e.attackCooldown = 2.2f;
                        if (invulnerableTimer <= 0.0f) {
                            playerHp = max(0.0f, playerHp - e.atk);
                            audio.playBoom();
                            screenShake = 0.45f;
                            spawnExplosion(e.pos, Vec3(0.8f, 0.5f, 0.2f), 20, 6.0f);
                        }
                    }
                }
            }

            if (e.attackCooldown > 0.0f) e.attackCooldown -= dt;

            // Apply knockback
            e.pos += e.vel * dt;
            e.vel = e.vel * 0.88f;
        }

        // Check Wave Progression
        if (allDead && state == PLAYING) {
            if (currentWave < 3) {
                spawnWave(currentWave + 1);
            } else {
                state = VICTORY;
                audio.playBoom();
            }
        }

        if (playerHp <= 0.0f && state == PLAYING) {
            state = GAME_OVER;
        }

        // Update Particles
        for (int i = (int)particles.size() - 1; i >= 0; i--) {
            auto& p = particles[i];
            p.life -= dt;
            if (p.life <= 0.0f) {
                particles.erase(particles.begin() + i);
                continue;
            }
            p.pos += p.vel * dt;
            p.vel.y -= 9.8f * dt;
        }

        // Update Damage Numbers
        for (int i = (int)damageNumbers.size() - 1; i >= 0; i--) {
            auto& d = damageNumbers[i];
            d.life -= dt;
            if (d.life <= 0.0f) {
                damageNumbers.erase(damageNumbers.begin() + i);
                continue;
            }
            d.pos.y += 1.5f * dt;
        }

        // Update Slash Arcs
        for (int i = (int)slashArcs.size() - 1; i >= 0; i--) {
            auto& a = slashArcs[i];
            a.life -= dt;
            if (a.life <= 0.0f) {
                slashArcs.erase(slashArcs.begin() + i);
            }
        }
    }

    // --- 3D Geometry Rendering Primitives ---
    void drawBox(float sx, float sy, float sz) {
        float hx = sx * 0.5f, hy = sy * 0.5f, hz = sz * 0.5f;
        glBegin(GL_QUADS);
        // Front
        glNormal3f(0, 0, 1);
        glVertex3f(-hx, -hy, hz); glVertex3f(hx, -hy, hz);
        glVertex3f(hx, hy, hz); glVertex3f(-hx, hy, hz);
        // Back
        glNormal3f(0, 0, -1);
        glVertex3f(hx, -hy, -hz); glVertex3f(-hx, -hy, -hz);
        glVertex3f(-hx, hy, -hz); glVertex3f(hx, hy, -hz);
        // Top
        glNormal3f(0, 1, 0);
        glVertex3f(-hx, hy, hz); glVertex3f(hx, hy, hz);
        glVertex3f(hx, hy, -hz); glVertex3f(-hx, hy, -hz);
        // Bottom
        glNormal3f(0, -1, 0);
        glVertex3f(-hx, -hy, -hz); glVertex3f(hx, -hy, -hz);
        glVertex3f(hx, -hy, hz); glVertex3f(-hx, -hy, hz);
        // Left
        glNormal3f(-1, 0, 0);
        glVertex3f(-hx, -hy, -hz); glVertex3f(-hx, -hy, hz);
        glVertex3f(-hx, hy, hz); glVertex3f(-hx, hy, -hz);
        // Right
        glNormal3f(1, 0, 0);
        glVertex3f(hx, -hy, hz); glVertex3f(hx, -hy, -hz);
        glVertex3f(hx, hy, -hz); glVertex3f(hx, hy, hz);
        glEnd();
    }

    void drawCylinder(float r, float h, int segs = 12) {
        glBegin(GL_QUAD_STRIP);
        for (int i = 0; i <= segs; i++) {
            float a = (float)i * 2.0f * (float)M_PI / (float)segs;
            float cosA = std::cos(a), sinA = std::sin(a);
            glNormal3f(cosA, 0, sinA);
            glVertex3f(cosA * r, h, sinA * r);
            glVertex3f(cosA * r, 0, sinA * r);
        }
        glEnd();
    }

    void drawArena() {
        // Tiled Arena Floor
        glPushMatrix();
        glColor3f(0.22f, 0.25f, 0.32f);
        drawBox(60.0f, 0.2f, 60.0f);

        // Center Elemental Magic Circle
        glColor3f(0.85f, 0.70f, 0.25f);
        glBegin(GL_LINE_LOOP);
        for (int i = 0; i < 36; i++) {
            float a = (float)i * 2.0f * (float)M_PI / 36.0f;
            glVertex3f(std::cos(a) * 8.0f, 0.12f, std::sin(a) * 8.0f);
        }
        glEnd();

        glBegin(GL_LINE_LOOP);
        for (int i = 0; i < 36; i++) {
            float a = (float)i * 2.0f * (float)M_PI / 36.0f;
            glVertex3f(std::cos(a) * 16.0f, 0.12f, std::sin(a) * 16.0f);
        }
        glEnd();

        // Perimeter Pillars
        for (int i = 0; i < 12; i++) {
            float a = (float)i * 2.0f * (float)M_PI / 12.0f;
            float px = std::cos(a) * 27.0f;
            float pz = std::sin(a) * 27.0f;
            glPushMatrix();
            glTranslatef(px, 0.0f, pz);
            glColor3f(0.45f, 0.48f, 0.55f);
            drawCylinder(1.2f, 8.0f, 8);
            // Torch fire on top
            glTranslatef(0.0f, 8.2f, 0.0f);
            glColor3f(1.0f, 0.5f, 0.1f);
            drawBox(0.6f, 0.8f, 0.6f);
            glPopMatrix();
        }
        glPopMatrix();
    }

    void drawPlayer() {
        glPushMatrix();
        glTranslatef(playerPos.x, playerPos.y, playerPos.z);
        glRotatef(playerYaw * 180.0f / (float)M_PI, 0, 1, 0);

        // Color based on Element
        Vec3 elemColor = (currentElement == ELEM_PYRO) ? Vec3(1.0f, 0.3f, 0.1f) :
                         (currentElement == ELEM_HYDRO) ? Vec3(0.1f, 0.7f, 1.0f) :
                                                          Vec3(0.8f, 0.3f, 1.0f);

        // Torso
        glColor3f(0.18f, 0.20f, 0.26f);
        glPushMatrix();
        glTranslatef(0, 1.1f, 0);
        drawBox(0.65f, 0.8f, 0.4f);
        glPopMatrix();

        // Golden Belt
        glColor3f(0.9f, 0.75f, 0.2f);
        glPushMatrix();
        glTranslatef(0, 0.75f, 0);
        drawBox(0.68f, 0.12f, 0.42f);
        glPopMatrix();

        // Head
        glColor3f(1.0f, 0.87f, 0.77f);
        glPushMatrix();
        glTranslatef(0, 1.7f, 0);
        drawBox(0.45f, 0.45f, 0.45f);

        // Anime Hair
        glColor3fv(&elemColor.x);
        glTranslatef(0, 0.22f, 0);
        drawBox(0.52f, 0.25f, 0.52f);
        glPopMatrix();

        // Flowing Cape
        glColor3fv(&elemColor.x);
        glPushMatrix();
        glTranslatef(0, 1.1f, -0.25f);
        glRotatef(12.0f + std::sin(globalTime * 8.0f) * 6.0f, 1, 0, 0);
        drawBox(0.55f, 0.9f, 0.06f);
        glPopMatrix();

        // Legs (Walking Animation)
        bool moving = (keys['W'] || keys['S'] || keys['A'] || keys['D']);
        float legSwing = moving ? std::sin(globalTime * 12.0f) * 25.0f : 0.0f;

        glColor3f(0.15f, 0.17f, 0.22f);
        glPushMatrix();
        glTranslatef(-0.18f, 0.35f, 0);
        glRotatef(legSwing, 1, 0, 0);
        drawBox(0.2f, 0.7f, 0.25f);
        glPopMatrix();

        glPushMatrix();
        glTranslatef(0.18f, 0.35f, 0);
        glRotatef(-legSwing, 1, 0, 0);
        drawBox(0.2f, 0.7f, 0.25f);
        glPopMatrix();

        // Elemental Greatsword
        glPushMatrix();
        glTranslatef(0.48f, 1.0f, 0.25f);
        glRotatef(35.0f, 1, 0, 0);
        if (attackTimer > 0.0f) {
            glRotatef(85.0f, 1, 0, 0);
            glRotatef(-45.0f, 0, 0, 1);
        }
        glColor3f(0.85f, 0.75f, 0.2f); // Hilt
        drawBox(0.12f, 0.3f, 0.12f);
        glTranslatef(0, 0.75f, 0);
        glColor3fv(&elemColor.x); // Glowing blade
        drawBox(0.18f, 1.3f, 0.06f);
        glPopMatrix();

        glPopMatrix();
    }

    void drawEnemies() {
        for (const auto& e : enemies) {
            if (e.isDead) continue;
            glPushMatrix();
            glTranslatef(e.pos.x, e.pos.y, e.pos.z);
            glRotatef(e.yaw * 180.0f / (float)M_PI, 0, 1, 0);

            if (e.hitFlash > 0.0f) {
                glColor3f(1.0f, 1.0f, 1.0f);
            }

            if (e.type == SLIME) {
                if (e.hitFlash <= 0.0f) glColor3f(0.1f, 0.75f, 1.0f);
                drawBox(1.2f, 1.0f, 1.2f);
                // Cute Slime Eyes
                glColor3f(1, 1, 1);
                glPushMatrix();
                glTranslatef(-0.25f, 0.2f, 0.61f);
                drawBox(0.15f, 0.2f, 0.05f);
                glTranslatef(0.5f, 0, 0);
                drawBox(0.15f, 0.2f, 0.05f);
                glPopMatrix();
            } else if (e.type == GOLEM) {
                if (e.hitFlash <= 0.0f) glColor3f(0.45f, 0.35f, 0.30f);
                // Body
                glTranslatef(0, 1.4f, 0);
                drawBox(1.2f, 1.5f, 0.9f);
                // Head
                glColor3f(0.2f, 0.2f, 0.2f);
                glPushMatrix();
                glTranslatef(0, 1.1f, 0);
                drawBox(0.6f, 0.5f, 0.6f);
                // Glowing Eye
                glColor3f(1.0f, 0.2f, 0.1f);
                glTranslatef(0, 0, 0.32f);
                drawBox(0.2f, 0.2f, 0.05f);
                glPopMatrix();
                // Stone Club
                glColor3f(0.3f, 0.3f, 0.3f);
                glPushMatrix();
                glTranslatef(0.9f, 0.2f, 0.4f);
                drawBox(0.35f, 1.8f, 0.35f);
                glPopMatrix();
            } else if (e.type == RUIN_TITAN) {
                // Massive Ruin Titan Boss
                if (e.hitFlash <= 0.0f) glColor3f(0.35f, 0.25f, 0.22f);
                glTranslatef(0, 2.6f, 0);
                // Heavy Core
                drawBox(2.8f, 2.5f, 2.2f);
                // Glowing Golden Cyclops Eye Weak-Point
                glColor3f(1.0f, 0.85f, 0.0f);
                glPushMatrix();
                glTranslatef(0, 0.2f, 1.15f);
                drawBox(0.7f, 0.7f, 0.1f);
                glPopMatrix();
                // Giant Arm Bludgeons
                glColor3f(0.22f, 0.24f, 0.28f);
                glPushMatrix();
                glTranslatef(-2.1f, 0.0f, 0.0f);
                drawBox(0.8f, 3.2f, 0.8f);
                glTranslatef(4.2f, 0.0f, 0.0f);
                drawBox(0.8f, 3.2f, 0.8f);
                glPopMatrix();
            }

            // In-World Floating HP bar
            glDisable(GL_LIGHTING);
            float barY = (e.type == RUIN_TITAN) ? 4.5f : (e.type == GOLEM ? 2.8f : 1.6f);
            float pct = max(0.0f, e.hp / e.maxHp);
            glPushMatrix();
            glTranslatef(0, barY, 0);
            glRotatef(-camYaw * 180.0f / (float)M_PI, 0, 1, 0); // Billboard to camera

            // HP BG
            glColor3f(0.1f, 0.1f, 0.1f);
            drawBox(1.6f, 0.15f, 0.02f);
            // HP Fill
            glColor3f(0.9f, 0.2f, 0.1f);
            glTranslatef(-(1.6f * (1.0f - pct) * 0.5f), 0, 0.01f);
            drawBox(1.6f * pct, 0.12f, 0.02f);
            glPopMatrix();
            glEnable(GL_LIGHTING);

            glPopMatrix();
        }
    }

    void drawSlashArcs() {
        glDisable(GL_LIGHTING);
        for (const auto& a : slashArcs) {
            glPushMatrix();
            glTranslatef(a.pos.x, a.pos.y, a.pos.z);
            glRotatef(a.yaw * 180.0f / (float)M_PI, 0, 1, 0);
            glColor3fv(&a.color.x);
            glLineWidth(4.0f);
            glBegin(GL_LINE_STRIP);
            for (int i = -6; i <= 6; i++) {
                float ang = (float)i * 0.14f;
                float r = 2.0f;
                glVertex3f(std::sin(ang) * r, 0.0f, -std::cos(ang) * r);
            }
            glEnd();
            glPopMatrix();
        }
        glEnable(GL_LIGHTING);
    }

    void drawParticles() {
        glDisable(GL_LIGHTING);
        for (const auto& p : particles) {
            glPushMatrix();
            glTranslatef(p.pos.x, p.pos.y, p.pos.z);
            glColor3fv(&p.color.x);
            drawBox(p.size, p.size, p.size);
            glPopMatrix();
        }
        glEnable(GL_LIGHTING);
    }

    // --- 2D Orthographic HUD Rendering ---
    void renderHUD() {
        glDisable(GL_LIGHTING);
        glDisable(GL_DEPTH_TEST);

        glMatrixMode(GL_PROJECTION);
        glPushMatrix();
        glLoadIdentity();
        glOrtho(0, screenW, screenH, 0, -1, 1);
        glMatrixMode(GL_MODELVIEW);
        glPushMatrix();
        glLoadIdentity();

        // 1. Crosshair in center
        glColor3f(1.0f, 1.0f, 1.0f);
        glLineWidth(2.0f);
        int cx = screenW / 2, cy = screenH / 2;
        glBegin(GL_LINES);
        glVertex2i(cx - 6, cy); glVertex2i(cx + 6, cy);
        glVertex2i(cx, cy - 6); glVertex2i(cx, cy + 6);
        glEnd();

        // 2. Player Health Bar (Bottom Center)
        int hpBarW = 320, hpBarH = 16;
        int hpX = cx - hpBarW / 2, hpY = screenH - 55;
        float hpPct = max(0.0f, playerHp / playerMaxHp);

        // Frame
        glColor3f(0.1f, 0.15f, 0.2f);
        glRecti(hpX - 3, hpY - 3, hpX + hpBarW + 3, hpY + hpBarH + 3);
        // Fill
        glColor3f(0.1f, 0.85f, 0.35f);
        glRecti(hpX, hpY, hpX + (int)(hpBarW * hpPct), hpY + hpBarH);

        // 3. Stamina Bar
        int stamBarW = 200, stamBarH = 8;
        int stamX = cx - stamBarW / 2, stamY = screenH - 32;
        float stamPct = max(0.0f, stamina / maxStamina);
        glColor3f(0.1f, 0.15f, 0.2f);
        glRecti(stamX - 2, stamY - 2, stamX + stamBarW + 2, stamY + stamBarH + 2);
        glColor3f(1.0f, 0.85f, 0.1f);
        glRecti(stamX, stamY, stamX + (int)(stamBarW * stamPct), stamY + stamBarH);

        // 4. Action Skill [E] Icon
        int skillX = screenW - 130, skillY = screenH - 70;
        glColor3f(0.2f, 0.25f, 0.35f);
        glRecti(skillX, skillY, skillX + 45, skillY + 45);
        if (skillCooldown > 0.0f) {
            glColor3f(0.8f, 0.2f, 0.2f);
            float cdPct = skillCooldown / maxSkillCooldown;
            glRecti(skillX, skillY, skillX + 45, skillY + (int)(45 * cdPct));
        } else {
            glColor3f(0.2f, 0.9f, 0.4f);
            glLineWidth(2.0f);
            glBegin(GL_LINE_LOOP);
            glVertex2i(skillX, skillY); glVertex2i(skillX + 45, skillY);
            glVertex2i(skillX + 45, skillY + 45); glVertex2i(skillX, skillY + 45);
            glEnd();
        }

        // 5. Burst [Q] Energy Meter
        int burstX = screenW - 75, burstY = screenH - 70;
        glColor3f(0.15f, 0.18f, 0.25f);
        glRecti(burstX, burstY, burstX + 45, burstY + 45);
        float burstPct = min(1.0f, burstEnergy / maxBurstEnergy);
        glColor3f(1.0f, 0.8f, 0.1f);
        glRecti(burstX, burstY + 45 - (int)(45 * burstPct), burstX + 45, burstY + 45);

        // 6. Boss Health Bar (Top Screen if Ruin Titan exists)
        for (const auto& e : enemies) {
            if (e.type == RUIN_TITAN && !e.isDead) {
                int bW = 500, bH = 18;
                int bX = cx - bW / 2, bY = 30;
                float bPct = max(0.0f, e.hp / e.maxHp);
                glColor3f(0.1f, 0.1f, 0.15f);
                glRecti(bX - 4, bY - 4, bX + bW + 4, bY + bH + 4);
                glColor3f(0.95f, 0.25f, 0.15f);
                glRecti(bX, bY, bX + (int)(bW * bPct), bY + bH);
            }
        }

        // 7. Victory / Defeat Overlay
        if (state == VICTORY) {
            glColor4f(0.0f, 0.0f, 0.0f, 0.7f);
            glRecti(0, 0, screenW, screenH);
            glColor3f(1.0f, 0.85f, 0.1f);
            glRecti(cx - 180, cy - 40, cx + 180, cy + 40);
        } else if (state == GAME_OVER) {
            glColor4f(0.0f, 0.0f, 0.0f, 0.7f);
            glRecti(0, 0, screenW, screenH);
            glColor3f(0.85f, 0.15f, 0.15f);
            glRecti(cx - 180, cy - 40, cx + 180, cy + 40);
        }

        glMatrixMode(GL_MODELVIEW);
        glPopMatrix();
        glMatrixMode(GL_PROJECTION);
        glPopMatrix();

        glMatrixMode(GL_MODELVIEW);
        glEnable(GL_DEPTH_TEST);
        glEnable(GL_LIGHTING);
    }

    void render() {
        glClearColor(0.12f, 0.16f, 0.25f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        glViewport(0, 0, screenW, screenH);
        glMatrixMode(GL_PROJECTION);
        glLoadIdentity();

        float aspect = (float)screenW / (float)(screenH > 0 ? screenH : 1);
        gluPerspective(60.0, (double)aspect, 0.2, 500.0);

        glMatrixMode(GL_MODELVIEW);
        glLoadIdentity();

        // Screen shake
        float shakeX = (screenShake > 0.0f) ? ((rand() % 100 - 50) * 0.005f * screenShake) : 0.0f;
        float shakeY = (screenShake > 0.0f) ? ((rand() % 100 - 50) * 0.005f * screenShake) : 0.0f;

        // Camera Orbit
        float camX = playerPos.x + std::sin(camYaw) * std::cos(camPitch) * camDist + shakeX;
        float camY = playerPos.y + std::sin(camPitch) * camDist + 1.8f + shakeY;
        float camZ = playerPos.z + std::cos(camYaw) * std::cos(camPitch) * camDist;

        gluLookAt(
            (double)camX, (double)camY, (double)camZ,
            (double)playerPos.x, (double)(playerPos.y + 1.4f), (double)playerPos.z,
            0.0, 1.0, 0.0
        );

        // Update light position in world
        float lightPos[] = { 30.0f, 60.0f, 40.0f, 1.0f };
        glLightfv(GL_LIGHT0, GL_POSITION, lightPos);

        // Render World
        drawArena();
        drawPlayer();
        drawEnemies();
        drawSlashArcs();
        drawParticles();

        // Render 2D HUD
        renderHUD();

        SwapBuffers(hDC);
    }
};

GameEngine g_game;

// Windows Event Callback
LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
    case WM_SIZE:
        g_game.screenW = LOWORD(lParam);
        g_game.screenH = HIWORD(lParam);
        return 0;

    case WM_KEYDOWN:
        if (wParam < 256) g_game.keys[wParam] = true;
        if (wParam == VK_ESCAPE) {
            g_game.captureMouse(!g_game.mouseCaptured);
        }
        if (wParam == 'E') g_game.castSkill();
        if (wParam == 'Q') g_game.castBurst();
        if (wParam == 'R' && g_game.state != PLAYING) {
            g_game.playerHp = g_game.playerMaxHp;
            g_game.state = PLAYING;
            g_game.spawnWave(1);
        }
        return 0;

    case WM_KEYUP:
        if (wParam < 256) g_game.keys[wParam] = false;
        return 0;

    case WM_LBUTTONDOWN:
        if (!g_game.mouseCaptured) {
            g_game.captureMouse(true);
        } else {
            g_game.performAttack();
        }
        return 0;

    case WM_RBUTTONDOWN:
        g_game.performDash();
        return 0;

    case WM_MOUSEMOVE:
        if (g_game.mouseCaptured) {
            int mx = LOWORD(lParam);
            int my = HIWORD(lParam);
            POINT center = { g_game.screenW / 2, g_game.screenH / 2 };
            ClientToScreen(hWnd, &center);

            POINT cur;
            GetCursorPos(&cur);
            int dx = cur.x - center.x;
            int dy = cur.y - center.y;

            if (dx != 0 || dy != 0) {
                g_game.camYaw -= (float)dx * 0.0035f;
                g_game.camPitch += (float)dy * 0.0035f;
                g_game.camPitch = max(-0.1f, min(1.2f, g_game.camPitch));
                SetCursorPos(center.x, center.y);
            }
        }
        return 0;

    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProc(hWnd, msg, wParam, lParam);
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE, LPSTR, int) {
    WNDCLASSEX wc = { sizeof(WNDCLASSEX) };
    wc.style = CS_OWNDC | CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = "TeyvatArenaClass";
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    RegisterClassEx(&wc);

    int sw = GetSystemMetrics(SM_CXSCREEN);
    int sh = GetSystemMetrics(SM_CYSCREEN);
    int w = 1280, h = 720;
    int x = (sw - w) / 2, y = (sh - h) / 2;

    HWND hWnd = CreateWindowEx(
        0, "TeyvatArenaClass", "Teyvat Arena 3D - Standalone Edition",
        WS_OVERLAPPEDWINDOW | WS_VISIBLE,
        x, y, w, h, NULL, NULL, hInstance, NULL
    );

    g_game.init(hWnd);

    LARGE_INTEGER freq, lastTime, curTime;
    QueryPerformanceFrequency(&freq);
    QueryPerformanceCounter(&lastTime);

    MSG msg = {};
    while (msg.message != WM_QUIT) {
        if (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        } else {
            QueryPerformanceCounter(&curTime);
            float dt = (float)(curTime.QuadPart - lastTime.QuadPart) / (float)freq.QuadPart;
            lastTime = curTime;
            dt = min(dt, 0.05f); // clamp delta time

            g_game.update(dt);
            g_game.render();
        }
    }

    return 0;
}

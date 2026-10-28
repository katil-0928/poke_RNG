// ==================== Pokémon RNG Game Engine ====================

// --- Game State ---
let totalRolls = 0;
let aShards = 990000; // 테스트를 위해 넉넉히 설정 (추후 필요시 0으로 조정 가능)
let isRolling = false;
let isAutoRollActive = false;
let hasShinyCharm = false; // 빛나는 부적 보유 여부
let forceNextShiny = false; // 치트: 다음 롤 확정 이로치 여부
let cheatKeyBuffer = []; // 's', 'h', 'i' 연속 입력 감지용 버퍼

// Storage & Collections
let inventory = []; // 잡은 포켓몬 인스턴스 배열 [{ uid, id, name, ball, type, tier, isShiny, gender, income, isWorking }]
let pokedexDiscovered = new Set(); // 도감에 등록된 포켓몬 ID (Set)
let workspaceSlots = Array(5).fill(null); // 작업실 5칸 슬롯
let activeWorkspaceSlotIndex = null;
let activeInventoryUid = null;

// DOM Elements
const rollBtn = document.getElementById('roll-button');
const autoRollToggle = document.getElementById('auto-roll-toggle');
const totalRollsDisplay = document.getElementById('total-rolls-value');
const aShardsDisplay = document.getElementById('a-shards-value');

// Main Stage Elements
const ballStage = document.getElementById('ball-stage');
const ballImg = document.getElementById('ball-img');
const pokemonReveal = document.getElementById('pokemon-reveal');
const pokemonCanvas = document.getElementById('pokemon-canvas');
const pokemonSprite = document.getElementById('pokemon-sprite');
const shinyBadge = document.getElementById('shiny-badge');
const shinyFlashOverlay = document.getElementById('shiny-flash-overlay');
const shinyParticlesContainer = document.getElementById('shiny-particles-container');
const shinyCheatIndicator = document.getElementById('shiny-cheat-indicator');

let animInterval = null; // Canvas frame animation interval

const resultBall = document.getElementById('result-ball');
const resultType = document.getElementById('result-type');
const resultTier = document.getElementById('result-tier');
const resultPokemon = document.getElementById('result-pokemon');
const resultGender = document.getElementById('result-gender');

// Overlay Panels
const inventoryBtn = document.getElementById('inventory-btn');
const collectionBtn = document.getElementById('collection-btn');
const workspaceBtn = document.getElementById('workspace-btn');
const settingsBtn = document.getElementById('settings-btn');

const inventoryPanel = document.getElementById('inventory-panel');
const collectionPanel = document.getElementById('collection-panel');
const workspacePanel = document.getElementById('workspace-panel');
const settingsPanel = document.getElementById('settings-panel');
const workspaceSelectModal = document.getElementById('workspace-select-modal');
const inventoryDetailModal = document.getElementById('inventory-detail-modal');

const inventoryGrid = document.getElementById('inventory-grid');
const pokedexGrid = document.getElementById('pokedex-grid');
const wsSelectGrid = document.getElementById('ws-select-grid');

const pokedexTypeFilter = document.getElementById('pokedex-type-filter');
const pokedexTierFilter = document.getElementById('pokedex-tier-filter');
const pokedexGenFilter = document.getElementById('pokedex-gen-filter');
const pokedexDiscoveredEl = document.getElementById('pokedex-discovered');
const pokedexTotalEl = document.getElementById('pokedex-total');

const workspaceIncomeVal = document.getElementById('workspace-income-val');
const workspaceWorkersVal = document.getElementById('workspace-workers-val');

// Detail Modal Elements
const invDetailCanvas = document.getElementById('inv-detail-canvas');
const invDetailSprite = document.getElementById('inv-detail-sprite');
const invDetailName = document.getElementById('inv-detail-name');
const invDetailType = document.getElementById('inv-detail-type');
const invDetailTier = document.getElementById('inv-detail-tier');
const invDetailGender = document.getElementById('inv-detail-gender');
const invReleaseBtn = document.getElementById('inv-release-btn');
const invCancelBtn = document.getElementById('inv-cancel-btn');

let detailAnimInterval = null; // Detail modal canvas animation interval

// Arena System DOM Elements
const areaDisplayBtn = document.getElementById('area-display-btn');
const currentAreaNameEl = document.getElementById('current-area-name');
const areaTimerValEl = document.getElementById('area-timer-value');
const arenaBgLayer = document.getElementById('arena-bg-layer');
const arenaPlatformBase = document.getElementById('arena-platform-base');
const arenaPlatformDecor = document.getElementById('arena-platform-decor');

// --- Helper Functions ---

function getBaseFileName(pokemonId) {
    if (typeof POKEMON_FILE_MAP !== 'undefined' && POKEMON_FILE_MAP[pokemonId]) {
        return POKEMON_FILE_MAP[pokemonId];
    }
    return String(pokemonId);
}

// 1. Get Sprite URL (Guaranteed file existence matching)
function getPokemonSpriteUrl(pokemon, isShiny, gender) {
    const fname = getBaseFileName(pokemon.id);

    if (isShiny) {
        if (typeof EXISTING_SHINY !== 'undefined' && (EXISTING_SHINY.has(fname) || EXISTING_SHINY.has(String(pokemon.id)))) {
            const actualFname = EXISTING_SHINY.has(fname) ? fname : String(pokemon.id);
            return `asset/pokemon/shiny/${actualFname}.png`;
        }
    }
    if (gender === "female") {
        if (typeof EXISTING_FEMALE !== 'undefined' && (EXISTING_FEMALE.has(fname) || EXISTING_FEMALE.has(String(pokemon.id)))) {
            const actualFname = EXISTING_FEMALE.has(fname) ? fname : String(pokemon.id);
            return `asset/pokemon/female/${actualFname}.png`;
        }
    }
    return `asset/pokemon/${fname}.png`;
}

// 2. Get Icon URL (Guaranteed file existence matching)
function getPokemonIconUrl(pokemon, isShiny) {
    const gen = pokemon.gen || 1;
    const fname = getBaseFileName(pokemon.id);
    
    // For form names (e.g., 487-altered), check if shiny icon exists
    if (isShiny) {
        return `asset/pokemon/icons/${gen}/${fname}s.png`;
    }
    return `asset/pokemon/icons/${gen}/${fname}.png`;
}

// 3. Play Animated Pokemon on Canvas (Instant from POKEMON_ATLAS, zero CORS issues)
function playPokemonAnimation(pokemon, isShiny, gender) {
    if (animInterval) {
        clearInterval(animInterval);
        animInterval = null;
    }

    // Always use canvas, keep raw sprite sheet img hidden to avoid sheet mosaic glitches
    pokemonSprite.style.display = 'none';
    pokemonCanvas.style.display = 'block';

    const fname = getBaseFileName(pokemon.id);
    let key = fname;
    let spriteUrl = `asset/pokemon/${fname}.png`;

    if (isShiny) {
        if (typeof POKEMON_ATLAS !== 'undefined' && (POKEMON_ATLAS[`s_${fname}`] || POKEMON_ATLAS[`s_${pokemon.id}`])) {
            key = POKEMON_ATLAS[`s_${fname}`] ? `s_${fname}` : `s_${pokemon.id}`;
            const sName = (typeof EXISTING_SHINY !== 'undefined' && EXISTING_SHINY.has(fname)) ? fname : String(pokemon.id);
            spriteUrl = `asset/pokemon/shiny/${sName}.png`;
        } else {
            spriteUrl = `asset/pokemon/shiny/${fname}.png`;
        }
    } else if (gender === "female") {
        if (typeof POKEMON_ATLAS !== 'undefined' && (POKEMON_ATLAS[`f_${fname}`] || POKEMON_ATLAS[`f_${pokemon.id}`])) {
            key = POKEMON_ATLAS[`f_${fname}`] ? `f_${fname}` : `f_${pokemon.id}`;
            const fName = (typeof EXISTING_FEMALE !== 'undefined' && EXISTING_FEMALE.has(fname)) ? fname : String(pokemon.id);
            spriteUrl = `asset/pokemon/female/${fName}.png`;
        }
    }

    const atlasData = (typeof POKEMON_ATLAS !== 'undefined') ? 
        (POKEMON_ATLAS[key] || POKEMON_ATLAS[fname] || POKEMON_ATLAS[String(pokemon.id)]) : null;

    const ctx = pokemonCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Load sprite sheet image
    const img = new Image();
    img.onload = () => {
        if (atlasData && atlasData.f && atlasData.f.length > 0) {
            const sw = atlasData.s[0];
            const sh = atlasData.s[1];
            const frames = atlasData.f;

            pokemonCanvas.width = sw;
            pokemonCanvas.height = sh;

            let frameIdx = 0;
            function renderFrame() {
                const f = frames[frameIdx]; // [fx, fy, fw, fh, sx, sy]
                ctx.clearRect(0, 0, sw, sh);

                const fx = f[0];
                const fy = f[1];
                const fw = f[2];
                const fh = f[3];
                const sx = f[4];
                const sy = f[5];

                ctx.drawImage(img, fx, fy, fw, fh, sx, sy, fw, fh);
                frameIdx = (frameIdx + 1) % frames.length;
            }

            renderFrame();
            animInterval = setInterval(renderFrame, 80); // ~12.5 FPS smooth animation
        } else {
            // Absolute fallback: draw single clipped frame if atlas missing
            pokemonCanvas.width = 64;
            pokemonCanvas.height = 64;
            ctx.clearRect(0, 0, 64, 64);
            ctx.drawImage(img, 0, 0, 64, 64, 0, 0, 64, 64);
        }
        pokemonCanvas.classList.add('revealed');
    };

    img.onerror = () => {
        // Fallback to default base png if variant image is missing
        if (spriteUrl !== `asset/pokemon/${fname}.png`) {
            img.src = `asset/pokemon/${fname}.png`;
        }
    };

    img.src = spriteUrl;
}

// --- 5-Stage RNG Logic ---

function executeRoll() {
    // 1단계: 몬스터볼 추첨
    // 몬스터볼 50%, 슈퍼볼 25%, 하이퍼볼 15%, 마스터볼 7.5%, 럭셔리볼 2.5%
    const ballRand = Math.random();
    let selectedBall = BALL_LIST[0]; // fallback
    let cumBallRate = 0;
    for (const b of BALL_LIST) {
        cumBallRate += b.rate;
        if (ballRand < cumBallRate) {
            selectedBall = b;
            break;
        }
    }

    // 2단계: 타입 추첨 (18개 타입 모두 동일 확률 1/18)
    const selectedType = TYPE_LIST[Math.floor(Math.random() * TYPE_LIST.length)];

    // 3단계: 등급 추첨
    // 일반 96.47%, 환상 1.365%, 준전설 1.365%, 초전설 0.39%
    const tierRand = Math.random();
    let selectedTier = "일반";
    if (tierRand < 0.0039) {
        selectedTier = "초전설";
    } else if (tierRand < 0.0039 + 0.01365) {
        selectedTier = "준전설";
    } else if (tierRand < 0.0039 + 0.01365 + 0.01365) {
        selectedTier = "환상";
    } else {
        selectedTier = "일반";
    }

    // 앞서 정한 타입과 등급에 해당하는 포켓몬 풀에서 무작위 1마리 선택
    const candidateList = getPokemonByTypeAndTier(selectedType, selectedTier);
    const selectedPokemon = candidateList[Math.floor(Math.random() * candidateList.length)];

    // 4단계: 이로치(Shiny) 추첨
    // 1/4096 (빛나는 부적 보유시 1/1365) 또는 s,h,i 치트 활성화시 100% 확정
    let isShiny = false;
    if (forceNextShiny) {
        isShiny = true;
        forceNextShiny = false;
        if (shinyCheatIndicator) {
            shinyCheatIndicator.classList.remove('active');
        }
        console.log("✨ Guaranteed Shiny triggered!");
    } else {
        const shinyThreshold = hasShinyCharm ? (1 / 1365) : (1 / 4096);
        isShiny = Math.random() < shinyThreshold;
    }

    // 5단계: 성별 추첨
    // 수컷 50%, 암컷 50% (성별 고정 포켓몬은 생략/고정)
    let selectedGender = "무성";
    if (selectedPokemon.gender === "female") {
        selectedGender = "암컷 ♀";
    } else if (selectedPokemon.gender === "male") {
        selectedGender = "수컷 ♂";
    } else if (selectedPokemon.gender === "genderless") {
        selectedGender = "무성";
    } else {
        // 양성 (50:50)
        selectedGender = Math.random() < 0.5 ? "수컷 ♂" : "암컷 ♀";
    }

    return {
        uid: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        ball: selectedBall,
        type: selectedType,
        tier: selectedTier,
        pokemon: selectedPokemon,
        isShiny: isShiny,
        gender: selectedGender,
        income: selectedPokemon.income || 1,
        isWorking: false
    };
}

// --- Shiny Particles Effect (Pokemon Style Sparkles) ---
function triggerShinyEffects() {
    if (!shinyParticlesContainer || !shinyFlashOverlay) return;

    // 1. Flash effect
    shinyFlashOverlay.classList.remove('active');
    void shinyFlashOverlay.offsetWidth; // trigger reflow
    shinyFlashOverlay.classList.add('active');

    // 2. Shiny Glow on Canvas
    if (pokemonCanvas) {
        pokemonCanvas.classList.add('shiny-glow');
    }

    // 3. Generate 16 spinning sparkle stars
    shinyParticlesContainer.innerHTML = '';
    const starCount = 18;

    for (let i = 0; i < starCount; i++) {
        const angle = (i / starCount) * Math.PI * 2 + (Math.random() * 0.3 - 0.15);
        const distMid = 45 + Math.random() * 25;
        const distEnd = 100 + Math.random() * 40;

        const txMid = Math.cos(angle) * distMid;
        const tyMid = Math.sin(angle) * distMid;
        const txEnd = Math.cos(angle) * distEnd;
        const tyEnd = Math.sin(angle) * distEnd;

        const star = document.createElement('div');
        star.className = 'shiny-sparkle';
        star.style.left = '50%';
        star.style.top = '50%';
        star.style.setProperty('--tx-start', '0px');
        star.style.setProperty('--ty-start', '0px');
        star.style.setProperty('--tx-mid', `${txMid}px`);
        star.style.setProperty('--ty-mid', `${tyMid}px`);
        star.style.setProperty('--tx-end', `${txEnd}px`);
        star.style.setProperty('--ty-end', `${tyEnd}px`);
        star.style.animationDelay = `${(i * 35)}ms`;

        shinyParticlesContainer.appendChild(star);
    }
}

// --- Roll Animation & Presentation ---

function roll() {
    if (isRolling) return;
    isRolling = true;
    rollBtn.disabled = true;
    rollBtn.classList.add('rolling');
    rollBtn.textContent = "ROLLING...";

    // 1. Reset Display: Show ball stage, hide pokemon stage
    ballStage.style.display = 'flex';
    pokemonReveal.style.display = 'none';
    pokemonCanvas.classList.remove('revealed');
    pokemonCanvas.classList.remove('shiny-glow');
    pokemonSprite.classList.remove('revealed');
    shinyBadge.style.display = 'none';
    resultPokemon.textContent = "???";
    resultGender.textContent = "???";

    // Clean up shiny effects
    if (shinyFlashOverlay) shinyFlashOverlay.classList.remove('active');
    if (shinyParticlesContainer) shinyParticlesContainer.innerHTML = '';

    // Clear canvas and stop ongoing animation
    if (pokemonCanvas) {
        const ctx = pokemonCanvas.getContext('2d');
        ctx.clearRect(0, 0, pokemonCanvas.width, pokemonCanvas.height);
    }
    if (animInterval) {
        clearInterval(animInterval);
        animInterval = null;
    }

    // 2. Pre-execute 5-Stage RNG
    const result = executeRoll();

    // 3. Step 1: Show selected Ball & Shake
    ballImg.src = `asset/pokeball/${result.ball.id}.png`;
    ballImg.className = "ball-img shake";
    resultBall.textContent = `${result.ball.name} (${(result.ball.rate * 100).toFixed(1)}%)`;
    resultBall.style.color = "#fff";

    // Step 2 & 3: Reveal Type & Tier rapidly
    setTimeout(() => {
        resultType.textContent = result.type;
        resultType.style.color = TYPE_COLORS[result.type] || "#fff";
        resultType.className = "type-badge";
        resultType.style.backgroundColor = TYPE_COLORS[result.type] || "#333";

        resultTier.textContent = result.tier;
        const tierColor = {
            "일반": "var(--tier-일반)",
            "준전설": "var(--tier-준전설)",
            "환상": "var(--tier-환상)",
            "초전설": "var(--tier-초전설)"
        }[result.tier];
        resultTier.style.color = tierColor;
    }, 200);

    // 4. Ball Opening Animation & Pokemon Reveal
    setTimeout(() => {
        ballImg.className = "ball-img";
        ballImg.src = `asset/pokeball/${result.ball.id}_open.png`;

        // Wait a tiny moment after ball opens, then reveal animated Pokemon
        setTimeout(() => {
            triggerReveal(result);
        }, 150);

    }, 450);
}

function triggerReveal(result) {
    // Switch stages: Hide ball, Show pokemon stage
    ballStage.style.display = 'none';
    pokemonReveal.style.display = 'flex';

    const genderKey = result.gender.includes("암컷") ? "female" : "male";
    playPokemonAnimation(result.pokemon, result.isShiny, genderKey);
    
    // 이로치 연출 & 배지
    if (result.isShiny) {
        shinyBadge.style.display = 'inline-block';
        triggerShinyEffects();
    }

    // 정보창 갱신
    resultPokemon.textContent = `#${result.pokemon.id} ${result.pokemon.name}`;
    resultPokemon.style.color = result.isShiny ? "#ffd700" : "var(--text-primary)";
    resultGender.textContent = result.gender;

    // 통계 업데이트
    totalRolls++;
    totalRollsDisplay.textContent = totalRolls.toLocaleString();

    // 인벤토리에 추가 & 도감 등록
    inventory.push(result);
    pokedexDiscovered.add(result.pokemon.id);

    // UI 동기화
    updateInventoryUI();
    updatePokedexStats();

    // 롤 상태 해제
    setTimeout(() => {
        isRolling = false;
        rollBtn.disabled = false;
        rollBtn.classList.remove('rolling');
        rollBtn.textContent = "ROLL";

        // Auto Roll 연동
        if (isAutoRollActive) {
            setTimeout(roll, 350);
        }
    }, 400);
}

// --- Auto Roll ---
autoRollToggle.addEventListener('click', () => {
    isAutoRollActive = !isAutoRollActive;
    if (isAutoRollActive) {
        autoRollToggle.classList.add('active');
        autoRollToggle.textContent = "AUTO ROLL: ON";
        if (!isRolling) roll();
    } else {
        autoRollToggle.classList.remove('active');
        autoRollToggle.textContent = "AUTO ROLL: OFF";
    }
});

rollBtn.addEventListener('click', roll);

// --- Inventory UI ---
function updateInventoryUI() {
    inventoryGrid.innerHTML = '';
    
    if (inventory.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.gridColumn = "1 / -1";
        emptyMsg.style.textAlign = "center";
        emptyMsg.style.color = "var(--text-secondary)";
        emptyMsg.style.padding = "40px 0";
        emptyMsg.textContent = "보관함이 비어있습니다. 포켓몬을 뽑아보세요!";
        inventoryGrid.appendChild(emptyMsg);
        return;
    }

    // 최신 순 정렬
    inventory.slice().reverse().forEach(item => {
        const slot = document.createElement('div');
        slot.className = `inv-slot tier-${item.tier}`;
        if (item.isShiny) slot.classList.add('shiny');
        if (item.isWorking) slot.classList.add('working');

        const iconImg = document.createElement('img');
        const iconSrc = getPokemonIconUrl(item.pokemon, item.isShiny);
        
        // Error fallback for icon
        iconImg.onerror = () => {
            iconImg.src = `asset/pokemon/${item.pokemon.id}.png`;
        };
        iconImg.src = iconSrc;
        slot.appendChild(iconImg);

        const nameLabel = document.createElement('span');
        nameLabel.className = 'inv-slot-name';
        nameLabel.textContent = item.pokemon.name;
        slot.appendChild(nameLabel);

        // Click to open detail modal
        slot.addEventListener('click', () => {
            if (item.isWorking) return; // 작업 중인 포켓몬은 조작 불가
            openInventoryDetail(item);
        });

        inventoryGrid.appendChild(slot);
    });
}

// 4. Play Animated Pokemon in Detail Modal
function playDetailPokemonAnimation(pokemon, isShiny, gender) {
    if (detailAnimInterval) {
        clearInterval(detailAnimInterval);
        detailAnimInterval = null;
    }

    if (!invDetailCanvas) return;
    const ctx = invDetailCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const fname = getBaseFileName(pokemon.id);
    let key = fname;
    let spriteUrl = `asset/pokemon/${fname}.png`;

    if (isShiny) {
        if (typeof POKEMON_ATLAS !== 'undefined' && (POKEMON_ATLAS[`s_${fname}`] || POKEMON_ATLAS[`s_${pokemon.id}`])) {
            key = POKEMON_ATLAS[`s_${fname}`] ? `s_${fname}` : `s_${pokemon.id}`;
            const sName = (typeof EXISTING_SHINY !== 'undefined' && EXISTING_SHINY.has(fname)) ? fname : String(pokemon.id);
            spriteUrl = `asset/pokemon/shiny/${sName}.png`;
        } else {
            spriteUrl = `asset/pokemon/shiny/${fname}.png`;
        }
    } else if (gender === "female") {
        if (typeof POKEMON_ATLAS !== 'undefined' && (POKEMON_ATLAS[`f_${fname}`] || POKEMON_ATLAS[`f_${pokemon.id}`])) {
            key = POKEMON_ATLAS[`f_${fname}`] ? `f_${fname}` : `f_${pokemon.id}`;
            const fName = (typeof EXISTING_FEMALE !== 'undefined' && EXISTING_FEMALE.has(fname)) ? fname : String(pokemon.id);
            spriteUrl = `asset/pokemon/female/${fName}.png`;
        }
    }

    const atlasData = (typeof POKEMON_ATLAS !== 'undefined') ? 
        (POKEMON_ATLAS[key] || POKEMON_ATLAS[fname] || POKEMON_ATLAS[String(pokemon.id)]) : null;

    const img = new Image();
    img.onload = () => {
        if (atlasData && atlasData.f && atlasData.f.length > 0) {
            const sw = atlasData.s[0];
            const sh = atlasData.s[1];
            const frames = atlasData.f;

            invDetailCanvas.width = sw;
            invDetailCanvas.height = sh;

            let frameIdx = 0;
            function renderFrame() {
                const f = frames[frameIdx]; // [fx, fy, fw, fh, sx, sy]
                ctx.clearRect(0, 0, sw, sh);
                ctx.drawImage(img, f[0], f[1], f[2], f[3], f[4], f[5], f[2], f[3]);
                frameIdx = (frameIdx + 1) % frames.length;
            }

            renderFrame();
            detailAnimInterval = setInterval(renderFrame, 80);
        } else {
            invDetailCanvas.width = 64;
            invDetailCanvas.height = 64;
            ctx.clearRect(0, 0, 64, 64);
            ctx.drawImage(img, 0, 0, 64, 64, 0, 0, 64, 64);
        }
    };

    img.onerror = () => {
        if (spriteUrl !== `asset/pokemon/${fname}.png`) {
            img.src = `asset/pokemon/${fname}.png`;
        }
    };

    img.src = spriteUrl;
}

function closeDetailModal() {
    if (detailAnimInterval) {
        clearInterval(detailAnimInterval);
        detailAnimInterval = null;
    }
    if (invDetailCanvas) {
        const ctx = invDetailCanvas.getContext('2d');
        ctx.clearRect(0, 0, invDetailCanvas.width, invDetailCanvas.height);
    }
    inventoryDetailModal.classList.remove('active');
}

function openInventoryDetail(item) {
    activeInventoryUid = item.uid;
    const genderKey = item.gender.includes("암컷") ? "female" : "male";
    playDetailPokemonAnimation(item.pokemon, item.isShiny, genderKey);

    invDetailName.textContent = `#${item.pokemon.id} ${item.pokemon.name} ${item.isShiny ? '⭐' : ''}`;
    invDetailType.textContent = `타입: ${item.pokemon.types.join(' / ')}`;
    invDetailTier.textContent = `등급: ${item.tier} (수익: +${item.income}/s)`;
    invDetailGender.textContent = `성별: ${item.gender}`;

    inventoryDetailModal.classList.add('active');
}

// 놓아주기 (Release)
invReleaseBtn.addEventListener('click', () => {
    if (!activeInventoryUid) return;
    const idx = inventory.findIndex(item => item.uid === activeInventoryUid);
    if (idx !== -1) {
        inventory.splice(idx, 1);
        updateInventoryUI();
    }
    closeDetailModal();
});

invCancelBtn.addEventListener('click', () => {
    closeDetailModal();
});

// --- Pokédex (도감) UI ---

function initPokedexFilters() {
    // Populate type filter options
    TYPE_LIST.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        pokedexTypeFilter.appendChild(opt);
    });

    // Populate tier filter options
    TIER_LIST.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        pokedexTierFilter.appendChild(opt);
    });

    pokedexTypeFilter.addEventListener('change', renderPokedex);
    pokedexTierFilter.addEventListener('change', renderPokedex);
    pokedexGenFilter.addEventListener('change', renderPokedex);
}

function updatePokedexStats() {
    pokedexDiscoveredEl.textContent = `발견: ${pokedexDiscovered.size}`;
    pokedexTotalEl.textContent = `/ ${POKEMON_DB.length}`;
}

function renderPokedex() {
    pokedexGrid.innerHTML = '';
    const selType = pokedexTypeFilter.value;
    const selTier = pokedexTierFilter.value;
    const selGen = pokedexGenFilter.value;

    const filtered = POKEMON_DB.filter(p => {
        if (selType !== "all" && !p.types.includes(selType)) return false;
        if (selTier !== "all" && p.tier !== selTier) return false;
        if (selGen !== "all" && p.gen !== parseInt(selGen)) return false;
        return true;
    });

    filtered.forEach(p => {
        const isDiscovered = pokedexDiscovered.has(p.id);
        const slot = document.createElement('div');
        slot.className = `dex-slot ${isDiscovered ? 'discovered' : 'undiscovered'}`;

        const idLabel = document.createElement('span');
        idLabel.className = 'dex-id';
        idLabel.textContent = `#${p.id}`;
        slot.appendChild(idLabel);

        const img = document.createElement('img');
        if (isDiscovered) {
            img.src = getPokemonIconUrl(p, false);
            img.onerror = () => { img.src = `asset/pokemon/${p.id}.png`; };
        } else {
            // Silhouette or locked
            img.src = `asset/pokemon/${p.id}.png`;
            img.style.filter = "brightness(0) opacity(0.3)";
        }
        slot.appendChild(img);

        const nameLabel = document.createElement('span');
        nameLabel.className = 'dex-name';
        nameLabel.textContent = isDiscovered ? p.name : "???";
        slot.appendChild(nameLabel);

        pokedexGrid.appendChild(slot);
    });
}

// --- Workspace (작업실) Logic ---

// Income Loop (1초마다 자동 수입)
setInterval(() => {
    let currentIncome = 0;
    workspaceSlots.forEach(slotItem => {
        if (slotItem) {
            currentIncome += slotItem.income || 0;
        }
    });

    if (currentIncome > 0) {
        aShards += currentIncome;
        aShardsDisplay.textContent = aShards.toLocaleString();
    }
}, 1000);

function updateWorkspaceUI() {
    let activeWorkers = 0;
    let totalIncome = 0;

    for (let i = 0; i < 5; i++) {
        const item = workspaceSlots[i];
        const previewEl = document.getElementById(`ws-preview-${i}`);
        const nameEl = document.getElementById(`ws-name-${i}`);
        const rateEl = document.getElementById(`ws-rate-${i}`);
        const btn = document.getElementById(`ws-btn-${i}`);

        if (item) {
            activeWorkers++;
            totalIncome += item.income || 0;

            previewEl.innerHTML = '';
            const img = document.createElement('img');
            img.src = getPokemonIconUrl(item.pokemon, item.isShiny);
            img.onerror = () => { img.src = `asset/pokemon/${item.pokemon.id}.png`; };
            previewEl.appendChild(img);

            nameEl.textContent = item.pokemon.name;
            nameEl.style.color = "var(--text-primary)";
            rateEl.textContent = `+${item.income || 0}/s`;

            btn.textContent = "해제";
            btn.classList.add('remove-mode');
        } else {
            previewEl.innerHTML = '<span class="ws-slot-icon">🏠</span>';
            nameEl.textContent = "EMPTY";
            nameEl.style.color = "var(--text-secondary)";
            rateEl.textContent = "+0/s";

            btn.textContent = "배치";
            btn.classList.remove('remove-mode');
        }
    }

    workspaceIncomeVal.textContent = `+${totalIncome} / sec`;
    workspaceWorkersVal.textContent = `${activeWorkers} / 5`;
}

// Workspace Buttons
for (let i = 0; i < 5; i++) {
    const btn = document.getElementById(`ws-btn-${i}`);
    btn.addEventListener('click', () => {
        if (workspaceSlots[i]) {
            // Remove from Workspace
            const removed = workspaceSlots[i];
            workspaceSlots[i] = null;

            // Find in inventory and reset working state
            const invItem = inventory.find(it => it.uid === removed.uid);
            if (invItem) invItem.isWorking = false;

            updateWorkspaceUI();
            updateInventoryUI();
        } else {
            // Open Assign Modal
            activeWorkspaceSlotIndex = i;
            openWorkspaceSelectModal();
        }
    });
}

function openWorkspaceSelectModal() {
    wsSelectGrid.innerHTML = '';
    const available = inventory.filter(item => !item.isWorking);

    if (available.length === 0) {
        const msg = document.createElement('div');
        msg.style.gridColumn = "1 / -1";
        msg.style.textAlign = "center";
        msg.style.color = "var(--text-secondary)";
        msg.style.padding = "30px 0";
        msg.textContent = "배치 가능한 포켓몬이 없습니다. (보관함이 비어있거나 모두 작업 중입니다)";
        wsSelectGrid.appendChild(msg);
    } else {
        available.forEach(item => {
            const slot = document.createElement('div');
            slot.className = `inv-slot tier-${item.tier}`;
            if (item.isShiny) slot.classList.add('shiny');

            const iconImg = document.createElement('img');
            iconImg.src = getPokemonIconUrl(item.pokemon, item.isShiny);
            iconImg.onerror = () => { iconImg.src = `asset/pokemon/${item.pokemon.id}.png`; };
            slot.appendChild(iconImg);

            const nameLabel = document.createElement('span');
            nameLabel.className = 'inv-slot-name';
            nameLabel.textContent = `${item.pokemon.name} (+${item.income}/s)`;
            slot.appendChild(nameLabel);

            slot.addEventListener('click', () => {
                item.isWorking = true;
                workspaceSlots[activeWorkspaceSlotIndex] = item;
                workspaceSelectModal.classList.remove('active');
                updateWorkspaceUI();
                updateInventoryUI();
            });

            wsSelectGrid.appendChild(slot);
        });
    }

    workspaceSelectModal.classList.add('active');
}

// --- Overlay Panel Toggle Listeners ---

const closeBtns = document.querySelectorAll('.close-panel');
closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        inventoryPanel.classList.remove('active');
        collectionPanel.classList.remove('active');
        workspacePanel.classList.remove('active');
        settingsPanel.classList.remove('active');
        workspaceSelectModal.classList.remove('active');
        closeDetailModal();
    });
});

inventoryBtn.addEventListener('click', () => {
    updateInventoryUI();
    inventoryPanel.classList.add('active');
});

collectionBtn.addEventListener('click', () => {
    renderPokedex();
    updatePokedexStats();
    collectionPanel.classList.add('active');
});

workspaceBtn.addEventListener('click', () => {
    updateWorkspaceUI();
    workspacePanel.classList.add('active');
});

settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.add('active');
});

// --- Secret Shiny Cheat Key Listener (Press 's', 'h', 'i' in sequence) ---
window.addEventListener('keydown', (e) => {
    // Ignore input if user is in an input field
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
        return;
    }

    let key = e.key.toLowerCase();
    // Support Korean IME keys matching s, h, i ('ㄴ' -> 's', 'ㅗ' -> 'h', 'ㅑ' -> 'i')
    if (key === 'ㄴ') key = 's';
    if (key === 'ㅗ') key = 'h';
    if (key === 'ㅑ') key = 'i';

    cheatKeyBuffer.push(key);
    if (cheatKeyBuffer.length > 5) {
        cheatKeyBuffer.shift();
    }

    const lastThree = cheatKeyBuffer.slice(-3).join('');
    if (lastThree === 'shi') {
        forceNextShiny = true;
        cheatKeyBuffer = []; // reset buffer
        if (shinyCheatIndicator) {
            shinyCheatIndicator.classList.add('active');
        }
        console.log("✨ [CHEAT ACTIVATED] Next Pokemon roll is guaranteed SHINY!");
    }
});

// ==================== Arena & Zone Rotation System ====================

const ARENA_LIST = [
    { id: 'plains', name: '평원', hasDecor: true },
    { id: 'grass', name: '풀밭', hasDecor: false },
    { id: 'tall_grass', name: '키 큰 풀밭', hasDecor: false },
    { id: 'meadow', name: '꽃밭', hasDecor: true },
    { id: 'forest', name: '숲', hasDecor: false },
    { id: 'snowy_forest', name: '설원 숲', hasDecor: true },
    { id: 'swamp', name: '늪지대', hasDecor: false },
    { id: 'beach', name: '해변', hasDecor: true },
    { id: 'lake', name: '호수', hasDecor: true },
    { id: 'seabed', name: '해저', hasDecor: true },
    { id: 'sea', name: '바다', hasDecor: false },
    { id: 'cave', name: '동굴', hasDecor: true },
    { id: 'ice_cave', name: '빙하 동굴', hasDecor: true },
    { id: 'fairy_cave', name: '페어리 동굴', hasDecor: true },
    { id: 'mountain', name: '산악 지대', hasDecor: true },
    { id: 'volcano', name: '화산', hasDecor: true },
    { id: 'badlands', name: '황무지', hasDecor: true },
    { id: 'desert', name: '사막', hasDecor: true },
    { id: 'wasteland', name: '폐허', hasDecor: true },
    { id: 'abyss', name: '심해', hasDecor: true },
    { id: 'space', name: '우주', hasDecor: false },
    { id: 'ruins', name: '고대 유적', hasDecor: true },
    { id: 'temple', name: '사원', hasDecor: true },
    { id: 'graveyard', name: '공동묘지', hasDecor: true },
    { id: 'dojo', name: '도장', hasDecor: false },
    { id: 'factory', name: '공장', hasDecor: true },
    { id: 'power_plant', name: '발전소', hasDecor: true },
    { id: 'laboratory', name: '연구소', hasDecor: true },
    { id: 'construction_site', name: '공사장', hasDecor: true },
    { id: 'slum', name: '슬럼가', hasDecor: false },
    { id: 'town', name: '마을', hasDecor: false },
    { id: 'metropolis', name: '대도시', hasDecor: true },
    { id: 'island', name: '고도 섬', hasDecor: true },
    { id: 'rockycoast', name: '암석 해안', hasDecor: true },
    { id: 'jungle', name: '정글', hasDecor: true },
    { id: 'well', name: '우물 속', hasDecor: true }
];

let currentArenaIndex = 0;
let arenaTimeRemaining = 300; // 5분 (300초)
let arenaTimerInterval = null;

function formatArenaTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateArena(index) {
    currentArenaIndex = (index + ARENA_LIST.length) % ARENA_LIST.length;
    const arena = ARENA_LIST[currentArenaIndex];

    if (currentAreaNameEl) {
        currentAreaNameEl.textContent = arena.name;
    }

    if (arenaBgLayer) {
        arenaBgLayer.style.backgroundImage = `url('asset/arenas/${arena.id}_bg.png')`;
    }

    if (arenaPlatformBase) {
        arenaPlatformBase.src = `asset/arenas/${arena.id}_b.png`;
    }

    if (arenaPlatformDecor) {
        if (arena.hasDecor) {
            arenaPlatformDecor.src = `asset/arenas/${arena.id}_b_1.png`;
            arenaPlatformDecor.style.display = 'block';
        } else {
            arenaPlatformDecor.src = '';
            arenaPlatformDecor.style.display = 'none';
        }
    }
}

function startArenaTimer() {
    if (arenaTimerInterval) clearInterval(arenaTimerInterval);

    if (areaTimerValEl) {
        areaTimerValEl.textContent = formatArenaTime(arenaTimeRemaining);
    }

    arenaTimerInterval = setInterval(() => {
        arenaTimeRemaining--;
        if (arenaTimeRemaining <= 0) {
            arenaTimeRemaining = 300; // 5분 리셋
            updateArena(currentArenaIndex + 1);
        }
        if (areaTimerValEl) {
            areaTimerValEl.textContent = formatArenaTime(arenaTimeRemaining);
        }
    }, 1000);
}

if (areaDisplayBtn) {
    areaDisplayBtn.addEventListener('click', () => {
        arenaTimeRemaining = 300; // 5분 리셋
        updateArena(currentArenaIndex + 1);
        if (areaTimerValEl) {
            areaTimerValEl.textContent = formatArenaTime(arenaTimeRemaining);
        }
    });
}

// --- Initialize ---
aShardsDisplay.textContent = aShards.toLocaleString();
initPokedexFilters();
updatePokedexStats();
updateWorkspaceUI();
updateInventoryUI();
updateArena(0);
startArenaTimer();

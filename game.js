// ── Constants ────────────────────────────────────────────────────────────────

const PHASE = {
    NAVIGATING: 'navigating',
    ANSWERING:  'answering',
    END:        'end',
};

const CELL = {
    WATER:         'water',
    START:         'start',
    PORT:          'port',
    ISLAND:        'island',
    PARROT_ISLAND: 'parrot-island',
    MONSTER:       'monster',
};

const CSS = {
    GRID_CELL:             'grid-cell',
    CELL_SHIP:             'cell-ship',
    CELL_DEPLETED:         'cell-depleted',
    SHIP_EMOJI:            'ship-emoji',
    SHIP_HIT:              'ship-hit',
    CREATURE_EMOJI:        'creature-emoji',
    PARROT_ON_ISLAND:      'parrot-on-island',
    OPT_BTN:               'opt-btn',
    ANIM_DANCE:            'anim-dance',
    ANIM_DIZZY:            'anim-dizzy',
    FW_PARTICLE:           'fw-particle',
    PARROT_POPUP_BTN:      'parrot-popup-btn',
    LESSON_GROUP:          'lesson-group',
    LESSON_GROUP_LABEL:    'lesson-group-label',
    LESSON_GROUP_BTNS:     'lesson-group-btns',
    LESSON_BTN:            'lesson-btn',
    LESSON_BTN_SOLO:       'lesson-btn-solo',
    LESSON_BTN_CUMULATIVE: 'lesson-btn-cumulative',
};

const ID = {
    PARROT_POPUP:     'parrot-popup',
    PARROT_PUNCHLINE: 'parrot-punchline',
};

// ── State ─────────────────────────────────────────────────────────────────────

let allLessonsData = {};
let currentQuestion = null;
let questionPool = [];
let wrongAnswersQueue = [];
let totalSteps = 0;
let stepsCompleted = 0;
let score = 0;

let gridCols = 0, gridRows = 0;
let shipRow = 0, shipCol = 0;
let portRow = 0, portCol = 0;
let grid = [];
let visitedIslands = new Set();
let originalQuestions = [];
let gamePhase = PHASE.NAVIGATING;
let pendingMove = null;

const MONSTER_EMOJIS = ['🦑', '🦈', '🐙', '🐡', '🦀'];

let PARROT_JOKES = [];

// ── DOM refs ──────────────────────────────────────────────────────────────────

const menuArea      = document.getElementById("menu-area");
const gameArea      = document.getElementById("game-area");
const subtitle      = document.getElementById("subtitle");
const questionArea  = document.getElementById("question-area");
const optionsArea   = document.getElementById("options-area");
const feedbackArea  = document.getElementById("feedback");
const scoreCount    = document.getElementById("score-count");
const stepCount     = document.getElementById("step-count");
const gridContainer = document.getElementById("grid-container");
const gridScroll    = document.getElementById("grid-scroll");
const characterArea = document.getElementById("character-area");
const errorMsg      = document.getElementById("error-msg");

const COMPASS = [
    { id: 'btn-up',    dr: -1, dc:  0 },
    { id: 'btn-down',  dr:  1, dc:  0 },
    { id: 'btn-left',  dr:  0, dc: -1 },
    { id: 'btn-right', dr:  0, dc:  1 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function buildGrid(rows, cols, sR, sC, pR, pC) {
    const g = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({ type: CELL.WATER, emoji: '🌊' }))
    );
    g[sR][sC] = { type: CELL.START, emoji: '⚓' };
    g[pR][pC] = { type: CELL.PORT,  emoji: '🏠' };

    const available = [];
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (g[r][c].type === CELL.WATER) available.push([r, c]);
    shuffleArray(available);

    const numIslands  = Math.max(4, Math.floor(totalSteps / 2));
    const numMonsters = Math.max(3, Math.floor(totalSteps / 3));
    let idx = 0;

    for (let i = 0; i < numIslands && idx < available.length; i++, idx++) {
        const [r, c] = available[idx];
        const isParrot = Math.random() < 0.4;
        g[r][c] = { type: isParrot ? CELL.PARROT_ISLAND : CELL.ISLAND, emoji: '🏝️' };
    }
    for (let i = 0; i < numMonsters && idx < available.length; i++, idx++) {
        const [r, c] = available[idx];
        g[r][c] = { type: CELL.MONSTER, emoji: MONSTER_EMOJIS[i % MONSTER_EMOJIS.length] };
    }
    return g;
}

function renderGrid() {
    gridContainer.innerHTML = '';

    const GAP = 3, PAD = 2;
    const compassEl = document.getElementById('compass');
    const gameLeft = gridScroll.parentElement;
    const availH = gameLeft.clientHeight - compassEl.offsetHeight;
    const availW = gameLeft.clientWidth;
    const byHeight = Math.floor((availH - PAD - (gridRows - 1) * GAP) / gridRows);
    const byWidth  = Math.floor((availW - PAD - (gridCols - 1) * GAP) / gridCols);
    const cellSize = Math.min(54, Math.max(24, Math.min(byHeight, byWidth)));
    const fontSize = Math.round(cellSize * 0.52);
    gridContainer.style.setProperty('--cell-size', `${cellSize}px`);
    gridContainer.style.setProperty('--cell-font', `${fontSize}px`);
    gridContainer.style.gridTemplateColumns = `repeat(${gridCols}, ${cellSize}px)`;

    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            const div = document.createElement('div');
            div.className = CSS.GRID_CELL;

            if (r === shipRow && c === shipCol) {
                div.classList.add(CSS.CELL_SHIP);
                div.innerHTML = `<span class="${CSS.SHIP_EMOJI}">⛵</span>`;
            } else {
                const cd = grid[r][c];
                div.classList.add('cell-' + cd.type);
                if ((cd.type === CELL.ISLAND || cd.type === CELL.PARROT_ISLAND) && visitedIslands.has(`${r},${c}`))
                    div.classList.add(CSS.CELL_DEPLETED);
                if (cd.type === CELL.MONSTER)
                    div.innerHTML = `<span class="${CSS.CREATURE_EMOJI}">${cd.emoji}</span>`;
                else if (cd.type === CELL.PARROT_ISLAND)
                    div.innerHTML = `🏝️<span class="${CSS.PARROT_ON_ISLAND}">🦜</span>`;
                else if (cd.type !== CELL.WATER)
                    div.textContent = cd.emoji;
            }
            gridContainer.appendChild(div);
        }
    }
}

// ── UI updates ────────────────────────────────────────────────────────────────

function updateCompass() {
    const active = gamePhase === PHASE.NAVIGATING;
    COMPASS.forEach(({ id, dr, dc }) => {
        const el = document.getElementById(id);
        const newR = shipRow + dr, newC = shipCol + dc;
        const valid = newR >= 0 && newR < gridRows && newC >= 0 && newC < gridCols;
        el.disabled = !active || !valid;
    });
}

function updateStatusBar() {
    scoreCount.textContent = score;
    stepCount.textContent = stepsCompleted;
}

function showNavPrompt() {
    questionArea.innerHTML =
        `<div class="move-hint">Choose a direction to sail! ⛵</div>` +
        `<div class="legend">🏠 Home port &nbsp;|&nbsp; 🏝️ Island +3🪙 &nbsp;|&nbsp; 🦑 Monster -1🪙</div>`;
}

// ── Navigation ────────────────────────────────────────────────────────────────

function pickDirection(dr, dc) {
    if (gamePhase !== PHASE.NAVIGATING) return;
    if (document.getElementById(ID.PARROT_POPUP)) return;
    const newR = shipRow + dr, newC = shipCol + dc;
    if (newR < 0 || newR >= gridRows || newC < 0 || newC >= gridCols) return;

    pendingMove = { dr, dc, newRow: newR, newCol: newC };
    gamePhase = PHASE.ANSWERING;
    updateCompass();
    loadQuestion();
}

// ── Question logic ────────────────────────────────────────────────────────────

function loadQuestion() {
    feedbackArea.textContent = '';
    feedbackArea.style.color = '';
    optionsArea.innerHTML = '';
    characterArea.textContent = '🏴‍☠️';
    characterArea.className = '';

    if (questionPool.length === 0) {
        if (wrongAnswersQueue.length > 0) {
            questionPool = shuffleArray([...wrongAnswersQueue]);
            wrongAnswersQueue = [];
        } else {
            questionPool = shuffleArray([...originalQuestions]);
        }
    }
    currentQuestion = questionPool.shift();

    const dirEmoji = { '-1,0': '⬆️', '1,0': '⬇️', '0,-1': '⬅️', '0,1': '➡️' };
    const dirKey = `${pendingMove.dr},${pendingMove.dc}`;
    const target = grid[pendingMove.newRow][pendingMove.newCol];

    questionArea.innerHTML =
        `<div class="move-hint">Sailing ${dirEmoji[dirKey]} into ${target.emoji}</div>` +
        `<div class="q-text">${currentQuestion.question}</div>`;

    shuffleArray([...currentQuestion.options]).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = CSS.OPT_BTN;
        btn.textContent = opt;
        btn.onclick = () => checkAnswer(opt, btn);
        optionsArea.appendChild(btn);
    });
}

function checkAnswer(selected, btnEl) {
    const correct = currentQuestion.answer;
    optionsArea.querySelectorAll(`.${CSS.OPT_BTN}`).forEach(b => b.disabled = true);

    if (selected === correct) {
        btnEl.style.backgroundColor = '#9ccc65';
        shipRow = pendingMove.newRow;
        shipCol = pendingMove.newCol;
        stepsCompleted++;

        const cell = grid[shipRow][shipCol];
        const islandKey = `${shipRow},${shipCol}`;
        let coinDelta = 1;
        let cellMsg = '';
        const isNewIsland = (cell.type === CELL.ISLAND || cell.type === CELL.PARROT_ISLAND) && !visitedIslands.has(islandKey);

        if (isNewIsland) {
            visitedIslands.add(islandKey);
            coinDelta = 3;
            cellMsg = ' 🏝️ Island treasure! (+3)';
        } else if (cell.type === CELL.MONSTER) {
            coinDelta = -1;
            cellMsg = ` ${cell.emoji} Sea monster! (-1)`;
        }

        score = Math.max(0, score + coinDelta);
        feedbackArea.style.color = coinDelta >= 0 ? 'green' : '#c62828';
        feedbackArea.textContent = `Correct! ${coinDelta >= 0 ? '+' : ''}${coinDelta} 🪙${cellMsg}`;
        setTimeout(() => {
            characterArea.className = '';
            void characterArea.offsetWidth;
            characterArea.textContent = '🕺🏴‍☠️✨';
            characterArea.classList.add(CSS.ANIM_DANCE);
        }, 10);

        renderGrid();
        updateStatusBar();

        if (cell.type === CELL.MONSTER) triggerShipKnockback();
        if (isNewIsland) triggerFirework(shipRow, shipCol);
        if (isNewIsland && cell.type === CELL.PARROT_ISLAND) showParrotJoke();

        if (shipRow === portRow && shipCol === portCol) {
            showEndScreen();
            return;
        }

        gamePhase = PHASE.NAVIGATING;
        pendingMove = null;
    } else {
        wrongAnswersQueue.push(currentQuestion);
        btnEl.style.backgroundColor = '#ef5350';
        optionsArea.querySelectorAll(`.${CSS.OPT_BTN}`).forEach(b => {
            if (b.textContent === correct) b.style.backgroundColor = '#9ccc65';
        });
        feedbackArea.style.color = '#c62828';
        feedbackArea.textContent = `Oops! Answer: ${correct}. You stay put.`;
        setTimeout(() => {
            characterArea.className = '';
            void characterArea.offsetWidth;
            characterArea.textContent = '😵‍💫🦜💨';
            characterArea.classList.add(CSS.ANIM_DIZZY);
        }, 10);

        gamePhase = PHASE.NAVIGATING;
        pendingMove = null;
    }
    updateCompass();
}

// ── End screen ────────────────────────────────────────────────────────────────

function launchMassiveFirework() {
    const colors = ['#ffeb3b','#ff4081','#00e5ff','#76ff03','#ff6d00','#ea80fc','#ffffff','#ff1744','#00e676'];
    const W = window.innerWidth, H = window.innerHeight;
    const origins = [
        [W * 0.25, H * 0.3], [W * 0.75, H * 0.3], [W * 0.5, H * 0.2],
        [W * 0.15, H * 0.5], [W * 0.85, H * 0.5], [W * 0.5,  H * 0.45],
    ];
    origins.forEach(([cx, cy], wave) => {
        setTimeout(() => {
            for (let i = 0; i < 28; i++) {
                const angle = (i / 28) * Math.PI * 2;
                const dist = 80 + Math.random() * 80;
                const size = 8 + Math.random() * 10;
                const p = document.createElement('div');
                p.className = CSS.FW_PARTICLE;
                p.style.cssText =
                    `left:${cx}px;top:${cy}px;` +
                    `width:${size}px;height:${size}px;` +
                    `background:${colors[i % colors.length]};` +
                    `--dx:${(Math.cos(angle) * dist).toFixed(1)}px;` +
                    `--dy:${(Math.sin(angle) * dist).toFixed(1)}px;` +
                    `animation-duration:${0.9 + Math.random() * 0.5}s`;
                document.body.appendChild(p);
                setTimeout(() => p.remove(), 1500);
            }
        }, wave * 180);
    });
}

function showEndScreen() {
    gamePhase = PHASE.END;
    updateCompass();
    characterArea.className = '';
    setTimeout(() => {
        characterArea.textContent = '🏆💰👑';
        characterArea.classList.add(CSS.ANIM_DANCE);
    }, 10);
    questionArea.innerHTML =
        `<div style="font-size:20px;text-align:center;line-height:1.5">` +
        `🎉 You reached home port!<br>` +
        `<strong>${score} 🪙</strong> collected in <strong>${stepsCompleted}</strong> moves</div>`;
    feedbackArea.textContent = '';
    optionsArea.innerHTML = '';
    launchMassiveFirework();
    setTimeout(launchMassiveFirework, 1200);
    setTimeout(launchMassiveFirework, 2400);
}

// ── Parrot joke popup ─────────────────────────────────────────────────────────

function showParrotJoke() {
    const joke = PARROT_JOKES[Math.floor(Math.random() * PARROT_JOKES.length)];
    const overlay = document.createElement('div');
    overlay.id = ID.PARROT_POPUP;
    overlay.innerHTML = `
        <div id="parrot-popup-inner">
            <div style="font-size:72px;display:inline-block;animation:ship-bob 1s ease-in-out infinite">🦜</div>
            <div style="font-size:17px;color:#00838f;font-weight:bold;margin:8px 0">Squawk! I have a joke!</div>
            <div style="font-size:17px;color:#37474f;margin:12px 0;line-height:1.5">${joke.setup}</div>
            <div id="${ID.PARROT_PUNCHLINE}" style="font-size:17px;color:#ff8f00;font-weight:bold;margin:12px 0;line-height:1.5;display:none">${joke.punchline}</div>
            <button class="${CSS.PARROT_POPUP_BTN}" onclick="revealParrotPunchline()">Tell me the answer! 🦜</button>
        </div>`;
    document.body.appendChild(overlay);
}

function revealParrotPunchline() {
    document.getElementById(ID.PARROT_PUNCHLINE).style.display = 'block';
    const btn = document.querySelector(`.${CSS.PARROT_POPUP_BTN}`);
    btn.textContent = 'Ha! OK OK! 😄';
    btn.onclick = dismissParrotJoke;
}

function dismissParrotJoke() {
    const popup = document.getElementById(ID.PARROT_POPUP);
    if (popup) popup.remove();
}

// ── Effects ───────────────────────────────────────────────────────────────────

function triggerShipKnockback() {
    const el = gridContainer.querySelector(`.${CSS.CELL_SHIP} .${CSS.SHIP_EMOJI}`);
    if (!el) return;
    el.classList.add(CSS.SHIP_HIT);
    el.addEventListener('animationend', () => el.classList.remove(CSS.SHIP_HIT), { once: true });
}

function triggerFirework(row, col) {
    const cells = gridContainer.querySelectorAll(`.${CSS.GRID_CELL}`);
    const cell = cells[row * gridCols + col];
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ['#ffeb3b','#ff4081','#00e5ff','#76ff03','#ff6d00','#ea80fc','#ffffff'];
    for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2;
        const dist = 45 + Math.random() * 35;
        const p = document.createElement('div');
        p.className = CSS.FW_PARTICLE;
        p.style.cssText = `left:${cx}px;top:${cy}px;background:${colors[i % colors.length]};` +
            `--dx:${(Math.cos(angle) * dist).toFixed(1)}px;--dy:${(Math.sin(angle) * dist).toFixed(1)}px`;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 750);
    }
}

// ── Menu ──────────────────────────────────────────────────────────────────────

function buildMenu() {
    menuArea.innerHTML = "";
    const lessons = Object.keys(allLessonsData);
    lessons.forEach((lessonName, index) => {
        const group = document.createElement("div");
        group.className = CSS.LESSON_GROUP;

        const label = document.createElement("div");
        label.className = CSS.LESSON_GROUP_LABEL;
        label.textContent = lessonName;
        group.appendChild(label);

        const btnRow = document.createElement("div");
        btnRow.className = CSS.LESSON_GROUP_BTNS;

        const soloBtn = document.createElement("button");
        soloBtn.className = `${CSS.LESSON_BTN} ${CSS.LESSON_BTN_SOLO}`;
        soloBtn.textContent = "🗺️ This Lesson";
        soloBtn.onclick = () => startLesson(lessonName);
        btnRow.appendChild(soloBtn);

        const cumulativeBtn = document.createElement("button");
        cumulativeBtn.className = `${CSS.LESSON_BTN} ${CSS.LESSON_BTN_CUMULATIVE}`;
        cumulativeBtn.textContent = "🌊 All So Far";
        if (index === 0) {
            cumulativeBtn.disabled = true;
        } else {
            cumulativeBtn.onclick = () => startCumulativeLesson(lessonName, lessons.slice(0, index + 1));
        }
        btnRow.appendChild(cumulativeBtn);

        group.appendChild(btnRow);
        menuArea.appendChild(group);
    });
}

// ── Game init ─────────────────────────────────────────────────────────────────

function initGame(steps, questions) {
    score = 0;
    stepsCompleted = 0;
    totalSteps = steps;
    originalQuestions = questions;
    questionPool = shuffleArray([...questions]);
    wrongAnswersQueue = [];
    visitedIslands = new Set();
    gamePhase = PHASE.NAVIGATING;
    pendingMove = null;

    // Grid: (cols-1)+(rows-1) = steps, so cols=floor(steps/2)+1, rows=ceil(steps/2)+1
    gridCols = Math.floor(steps / 2) + 1;
    gridRows = Math.ceil(steps / 2) + 1;
    shipRow  = gridRows - 1;
    shipCol  = 0;
    portRow  = 0;
    portCol  = gridCols - 1;

    grid = buildGrid(gridRows, gridCols, shipRow, shipCol, portRow, portCol);
    renderGrid();
    updateCompass();
    updateStatusBar();
    showNavPrompt();
    optionsArea.innerHTML = '';
    feedbackArea.textContent = '';
    characterArea.textContent = '🏴‍☠️';
    characterArea.className = '';
}

function startLesson(lessonName) {
    menuArea.style.display = "none";
    gameArea.style.display = "flex";
    subtitle.textContent = `Sailing: ${lessonName}`;
    initGame(allLessonsData[lessonName].length, allLessonsData[lessonName]);
}

function startCumulativeLesson(lessonName, lessonNames) {
    menuArea.style.display = "none";
    gameArea.style.display = "flex";
    subtitle.textContent = `Cumulative Review: ${lessonName}`;
    const pool = lessonNames.flatMap(name => allLessonsData[name]);
    initGame(15, pool);
}

function returnToMenu() {
    gameArea.style.display = "none";
    menuArea.style.display = "grid";
    subtitle.textContent = "Select your map to start the voyage!";
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadAllData() {
    try {
        const [qRes, jRes] = await Promise.all([fetch('questions.json'), fetch('jokes.json')]);
        if (!qRes.ok) throw new Error("Could not load questions.json.");
        if (!jRes.ok) throw new Error("Could not load jokes.json.");
        allLessonsData = await qRes.json();
        PARROT_JOKES = await jRes.json();
        buildMenu();
    } catch (error) {
        menuArea.innerHTML = "";
        errorMsg.innerHTML = "Ahoy! We couldn't load the game data files.<br><br>Ensure your local web server is running.";
        console.error(error);
    }
}

// ── Input ─────────────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
    const map = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] };
    const dir = map[e.key];
    if (dir) { e.preventDefault(); pickDirection(dir[0], dir[1]); }
});

loadAllData();

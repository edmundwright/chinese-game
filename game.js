let allLessonsData = {};
let currentQuizData = [];
let currentQuestionIndex = 0;
let score = 0;
let milestoneReached = 0;
let lastCreatureQuestion = -5;

const SEA_CREATURES = ['🐬', '🐋', '🐙', '🦑', '🦈', '🐠', '🦀', '🐡', '🦭', '🐢'];

// DOM Elements
const menuArea = document.getElementById("menu-area");
const gameArea = document.getElementById("game-area");
const subtitle = document.getElementById("subtitle");
const questionArea = document.getElementById("question-area");
const optionsArea = document.getElementById("options-area");
const feedbackArea = document.getElementById("feedback");
const scoreCount = document.getElementById("score-count");
const currentQNum = document.getElementById("current-q-num");
const totalQNum = document.getElementById("total-q-num");
const nextBtn = document.getElementById("next-btn");
const characterArea = document.getElementById("character-area");
const errorMsg = document.getElementById("error-msg");
const voyageShip = document.getElementById("voyage-ship");

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function updateVoyagePath() {
    const total = currentQuizData.length;
    const pct = total > 0 ? 5 + (currentQuestionIndex / total) * 90 : 5;
    voyageShip.style.left = pct + "%";

    if (milestoneReached < 1 && pct > 35) {
        milestoneReached = 1;
        triggerIslandCelebration('island-1', '⚓ Land Ho! First island!');
    } else if (milestoneReached < 2 && pct > 65) {
        milestoneReached = 2;
        triggerIslandCelebration('island-2', '🌟 Treasure is close!');
    }

    if (currentQuestionIndex > 0) createWakeSparkle(pct);

    if (currentQuestionIndex > 0 && currentQuestionIndex - lastCreatureQuestion >= 3 && Math.random() < 0.5) {
        lastCreatureQuestion = currentQuestionIndex;
        setTimeout(spawnSeaCreature, 500);
    }
}

function triggerIslandCelebration(islandId, message) {
    const island = document.getElementById(islandId);
    if (island) {
        island.classList.remove('island-pop');
        void island.offsetWidth;
        island.classList.add('island-pop');
        island.addEventListener('animationend', () => island.classList.remove('island-pop'), { once: true });
    }
    const voyagePath = document.getElementById('voyage-path');
    const msg = document.createElement('div');
    msg.className = 'milestone-msg';
    msg.innerText = message;
    voyagePath.appendChild(msg);
    setTimeout(() => msg.remove(), 2400);
}

function createWakeSparkle(pct) {
    const path = document.getElementById('voyage-path');
    const sparkle = document.createElement('div');
    sparkle.className = 'wake-sparkle';
    sparkle.innerText = '✨';
    sparkle.style.left = Math.max(2, pct - 4 - Math.random() * 3) + '%';
    sparkle.style.top = (20 + Math.random() * 55) + '%';
    path.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 750);
}

function spawnSeaCreature() {
    const path = document.getElementById('voyage-path');
    const creature = document.createElement('div');
    creature.className = 'sea-creature';
    creature.style.left = (10 + Math.random() * 75) + '%';
    creature.innerText = SEA_CREATURES[Math.floor(Math.random() * SEA_CREATURES.length)];
    path.appendChild(creature);
    setTimeout(() => creature.remove(), 1900);
}

function updateStatusBar() {
    scoreCount.innerText = score;
}

async function loadAllData() {
    try {
        const response = await fetch('questions.json');
        if (!response.ok) throw new Error("Could not load questions.json.");
        allLessonsData = await response.json();
        buildMenu();
    } catch (error) {
        menuArea.innerHTML = "";
        errorMsg.innerHTML = "Ahoy! We couldn't load the 'questions.json' file.<br><br>" +
        "Ensure your local web server is running.";
        console.error(error);
    }
}

function buildMenu() {
    menuArea.innerHTML = "";
    const lessons = Object.keys(allLessonsData);

    lessons.forEach((lessonName, index) => {
        const group = document.createElement("div");
        group.className = "lesson-group";

        const label = document.createElement("div");
        label.className = "lesson-group-label";
        label.innerText = lessonName;
        group.appendChild(label);

        const btnRow = document.createElement("div");
        btnRow.className = "lesson-group-btns";

        const soloBtn = document.createElement("button");
        soloBtn.className = "lesson-btn lesson-btn-solo";
        soloBtn.innerText = "🗺️ This Lesson";
        soloBtn.onclick = () => startLesson(lessonName);
        btnRow.appendChild(soloBtn);

        const cumulativeBtn = document.createElement("button");
        cumulativeBtn.className = "lesson-btn lesson-btn-cumulative";
        if (index === 0) {
            cumulativeBtn.innerText = "🌊 All So Far";
            cumulativeBtn.disabled = true;
            cumulativeBtn.title = "No prior lessons to combine with";
        } else {
            cumulativeBtn.innerText = "🌊 All So Far";
            cumulativeBtn.onclick = () => startCumulativeLesson(lessonName, lessons.slice(0, index + 1));
        }
        btnRow.appendChild(cumulativeBtn);

        group.appendChild(btnRow);
        menuArea.appendChild(group);
    });
}

function initGame() {
    score = 0;
    currentQuestionIndex = 0;
    milestoneReached = 0;
    lastCreatureQuestion = -5;
    updateStatusBar();
    updateVoyagePath();
}

function startLesson(lessonName) {
    menuArea.style.display = "none";
    gameArea.style.display = "flex";
    subtitle.innerText = `Currently Exploring: ${lessonName}`;

    currentQuizData = shuffleArray([...allLessonsData[lessonName]]);
    totalQNum.innerText = currentQuizData.length;
    initGame();
    loadNextQuestion();
}

function startCumulativeLesson(lessonName, lessonNames) {
    menuArea.style.display = "none";
    gameArea.style.display = "flex";
    subtitle.innerText = `Cumulative Review up to: ${lessonName}`;

    const pool = lessonNames.flatMap(name => allLessonsData[name]);
    const shuffled = shuffleArray([...pool]);
    currentQuizData = shuffled.slice(0, 15);
    totalQNum.innerText = currentQuizData.length;
    initGame();
    loadNextQuestion();
}

function returnToMenu() {
    gameArea.style.display = "none";
    menuArea.style.display = "grid";
    subtitle.innerText = "Select your map to start the voyage!";
}

function loadNextQuestion() {
    nextBtn.style.display = "none";
    feedbackArea.innerText = "";
    optionsArea.innerHTML = "";
    characterArea.innerText = "🏴‍☠️";
    characterArea.className = "";
    updateVoyagePath();

    if (currentQuestionIndex >= currentQuizData.length) {
        showEndScreen();
        return;
    }

    currentQNum.innerText = currentQuestionIndex + 1;
    const currentData = currentQuizData[currentQuestionIndex];
    questionArea.innerText = currentData.question;

    const shuffledOptions = shuffleArray([...currentData.options]);
    shuffledOptions.forEach(option => {
        const btn = document.createElement("button");
        btn.className = "opt-btn";
        btn.innerText = option;
        btn.onclick = () => checkAnswer(option, currentData.answer, btn);
        optionsArea.appendChild(btn);
    });
}

function showEndScreen() {
    voyageShip.style.left = "95%";
    questionArea.innerHTML = `🎉 You found the treasure! ${score} coins collected! 🎉`;
    characterArea.innerText = "🏆💰👑";
    characterArea.className = "";
    setTimeout(() => characterArea.classList.add("anim-dance"), 10);
}

function checkAnswer(selected, correct, buttonElement) {
    const allButtons = optionsArea.querySelectorAll(".opt-btn");
    allButtons.forEach(btn => btn.disabled = true);
    characterArea.className = "";

    if (selected === correct) {
        score += 1;

        buttonElement.style.backgroundColor = "#9ccc65";
        feedbackArea.style.color = "green";
        feedbackArea.innerText = `Correct! +1 🪙`;

        setTimeout(() => {
            characterArea.innerText = "🕺🏴‍☠️✨";
            characterArea.classList.add("anim-dance");
        }, 10);
    } else {
        buttonElement.style.backgroundColor = "#ef5350";
        feedbackArea.style.color = "red";
        feedbackArea.innerText = `Oops! The answer was: ${correct}`;

        setTimeout(() => {
            characterArea.innerText = "😵‍💫🦜💨";
            characterArea.classList.add("anim-dizzy");
        }, 10);
    }

    updateStatusBar();
    currentQuestionIndex++;
    nextBtn.style.display = "block";
}

loadAllData();

import { GameEngine } from "./engine.js?v=5";
import { AdMob } from "./admob.js?v=5";

const CARS = [
  {
    id: "falcon",
    name: "Falcon X",
    color: 0xff0000,
    unlockType: "free",
    cost: 0,
    adCost: 0,
    baseStats: { speed: 2, handling: 3, acceleration: 2, boost: 1 },
  },
  {
    id: "storm",
    name: "Storm GT",
    color: 0x0000ff,
    unlockType: "both",
    cost: 800,
    adCost: 1,
    baseStats: { speed: 4, handling: 2, acceleration: 2, boost: 2 },
  },
  {
    id: "thunder",
    name: "Thunder Racer",
    color: 0x111111,
    unlockType: "both",
    cost: 1500,
    adCost: 2,
    baseStats: { speed: 5, handling: 2, acceleration: 4, boost: 4 },
  },
  {
    id: "desert",
    name: "Desert Phantom",
    color: 0xffaa00,
    unlockType: "coins",
    cost: 2000,
    adCost: 0,
    baseStats: { speed: 2, handling: 5, acceleration: 2, boost: 2 },
  },
  {
    id: "neon",
    name: "Neon Velocity",
    color: 0x00ffcc,
    unlockType: "both",
    cost: 3000,
    adCost: 3,
    baseStats: { speed: 5, handling: 4, acceleration: 5, boost: 5 },
  },
];

// Basic state protection
function saveState(key, value) {
  localStorage.setItem(`se3d_${key}`, btoa(value.toString()));
}
function loadState(key, defaultValue) {
  const val = localStorage.getItem(`se3d_${key}`);
  if (!val) return defaultValue;
  try {
    return parseInt(atob(val));
  } catch (e) {
    return defaultValue;
  }
}
function loadArrayState(key, defaultValue) {
  const val = localStorage.getItem(`se3d_${key}`);
  if (!val) return defaultValue;
  try {
    return JSON.parse(atob(val));
  } catch (e) {
    return defaultValue;
  }
}
function saveArrayState(key, value) {
  localStorage.setItem(`se3d_${key}`, btoa(JSON.stringify(value)));
}

let currentCarIndex = 0;
let selectedCarId = localStorage.getItem("se3d_selectedCar") || "falcon";
let totalCoins = loadState("totalCoins", 0);
let highScore = loadState("highScore", 0);
let unlockedLevels = loadState("unlockedLevels", 1);
let unlockedCars = loadArrayState("unlockedCars", ["falcon"]);
let selectedLevel = 1;

let carAdsWatched = loadArrayState("carAdsWatched", {
  storm: 0,
  thunder: 0,
  neon: 0,
});

let carUpgrades = loadArrayState("carUpgrades", {
  falcon: { speed: 0, handling: 0, acceleration: 0, boost: 0 },
  storm: { speed: 0, handling: 0, acceleration: 0, boost: 0 },
  thunder: { speed: 0, handling: 0, acceleration: 0, boost: 0 },
  desert: { speed: 0, handling: 0, acceleration: 0, boost: 0 },
  neon: { speed: 0, handling: 0, acceleration: 0, boost: 0 },
});

const MAX_UPGRADE_LEVEL = 5;
const UPGRADE_COST_BASE = 100;
const UPGRADE_COST_MULT = 1.5;

function getUpgradeCost(level) {
  return Math.floor(UPGRADE_COST_BASE * Math.pow(UPGRADE_COST_MULT, level));
}

function getCarStats(carId) {
  const car = CARS.find((c) => c.id === carId);
  const upgrades = carUpgrades[carId] || {
    speed: 0,
    handling: 0,
    acceleration: 0,
    boost: 0,
  };
  return {
    speed: car.baseStats.speed + upgrades.speed,
    handling: car.baseStats.handling + upgrades.handling,
    acceleration: car.baseStats.acceleration + upgrades.acceleration,
    boost: car.baseStats.boost + upgrades.boost,
  };
}

// Settings
let soundEnabled = localStorage.getItem("se3d_sound") !== "false";
let graphicsQuality = localStorage.getItem("se3d_graphics") || "HIGH";

// Daily Challenge Logic
const DAILY_CHALLENGES = [
  { id: 1, type: "coins", target: 50, reward: 100, desc: "Collect 50 coins in one run" },
  { id: 2, type: "score", target: 1000, reward: 150, desc: "Reach 1000 score in one run" },
  { id: 3, type: "coins", target: 100, reward: 200, desc: "Collect 100 coins in one run" },
  { id: 4, type: "score", target: 2000, reward: 250, desc: "Reach 2000 score in one run" },
  { id: 5, type: "boost", target: 3, reward: 100, desc: "Use boost 3 times in one run" }
];

function getDailyChallenge() {
  const today = new Date().toDateString();
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = today.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DAILY_CHALLENGES.length;
  return DAILY_CHALLENGES[index];
}

const currentChallenge = getDailyChallenge();
let challengeCompletedToday = localStorage.getItem(`se3d_daily_${new Date().toDateString()}`) === "true";
let currentRunBoostCount = 0;
let wasBoostingLastFrame = false;

function updateDailyChallengeUI() {
  document.getElementById("daily-challenge-desc").innerText = currentChallenge.desc;
  document.getElementById("daily-challenge-reward").innerText = `Reward: ${currentChallenge.reward} Coins`;
  
  if (challengeCompletedToday) {
    document.getElementById("daily-challenge-status").style.display = "block";
    document.getElementById("daily-challenge-box").style.borderColor = "#00ff00";
  } else {
    document.getElementById("daily-challenge-status").style.display = "none";
    document.getElementById("daily-challenge-box").style.borderColor = "#00ffff";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  AdMob.init();

  // Find initial car index
  currentCarIndex = CARS.findIndex((c) => c.id === selectedCarId);
  if (currentCarIndex === -1) currentCarIndex = 0;

  let lastCoins = 0;
  const container = document.getElementById("game-canvas-container");
  const engine = new GameEngine(container, {
    onUpdate: (score, coins, isBoosting, boostTimer, maxBoostTimer, boostCharge, maxBoostCharge) => {
      document.getElementById("hud-score").innerText = `Score: ${score}`;
      const coinsEl = document.getElementById("hud-coins");
      if (coins > lastCoins) {
        coinsEl.classList.add("coin-bump");
        setTimeout(() => coinsEl.classList.remove("coin-bump"), 100);
        lastCoins = coins;
      }
      coinsEl.innerText = `Coins: ${coins}`;

      const boostContainer = document.getElementById("hud-boost-container");
      const boostBar = document.getElementById("hud-boost-bar");
      boostContainer.classList.remove("hidden");
      
      if (isBoosting) {
        const percentage = Math.max(0, (boostTimer / maxBoostTimer) * 100);
        boostBar.style.width = `${percentage}%`;
        boostBar.style.background = "#ff5500"; // Draining color
        
        if (!wasBoostingLastFrame) {
          currentRunBoostCount++;
        }
      } else {
        const percentage = Math.max(0, (boostCharge / maxBoostCharge) * 100);
        boostBar.style.width = `${percentage}%`;
        boostBar.style.background = "#00ffff"; // Charging color
      }
      wasBoostingLastFrame = isBoosting;
    },
    onGameOver: async (score, coins, hasContinued) => {
      lastCoins = 0;
      totalCoins += coins;
      if (score > highScore) highScore = score;

      // Check Daily Challenge
      if (!challengeCompletedToday) {
        let completed = false;
        if (currentChallenge.type === "coins" && coins >= currentChallenge.target) completed = true;
        if (currentChallenge.type === "score" && score >= currentChallenge.target) completed = true;
        if (currentChallenge.type === "boost" && currentRunBoostCount >= currentChallenge.target) completed = true;

        if (completed) {
          challengeCompletedToday = true;
          localStorage.setItem(`se3d_daily_${new Date().toDateString()}`, "true");
          totalCoins += currentChallenge.reward;
          showModal("Challenge Complete!", `You completed the daily challenge and earned ${currentChallenge.reward} coins!`, false);
          updateDailyChallengeUI();
        }
      }

      // Unlock logic
      if (totalCoins >= 500 && unlockedLevels < 2) unlockedLevels = 2;
      if (totalCoins >= 1000 && unlockedLevels < 3) unlockedLevels = 3;
      if (totalCoins >= 2000 && unlockedLevels < 4) unlockedLevels = 4;

      saveState("totalCoins", totalCoins);
      saveState("highScore", highScore);
      saveState("unlockedLevels", unlockedLevels);

      document.getElementById("go-score").innerText = `Score: ${score}`;
      document.getElementById("go-coins").innerText =
        `Coins Collected: ${coins}`;

      const btnContinueAd = document.getElementById("btn-continue-ad");
      if (hasContinued) {
        btnContinueAd.style.display = "none";
      } else {
        btnContinueAd.style.display = "block";
      }

      showScreen("game-over");

      await AdMob.showInterstitialAd();
    },
  });

  // Apply initial settings
  engine.audio.enabled = soundEnabled;
  engine.setGraphicsQuality(graphicsQuality);
  document.getElementById("btn-toggle-sound").innerText = soundEnabled
    ? "ON"
    : "OFF";
  document.getElementById("btn-toggle-graphics").innerText = graphicsQuality;

  // Set initial car mesh
  const initialCar = CARS[currentCarIndex];
  engine.setCar(initialCar.color, initialCar.id);

  // UI Elements
  const screens = document.querySelectorAll(".screen");
  function showScreen(id) {
    screens.forEach((s) => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  function updateMenuStats() {
    document.getElementById("menu-high-score").innerText =
      `High Score: ${highScore}`;
    document.getElementById("menu-coins").innerText = `Coins: ${totalCoins}`;

    let levelName = "BEGINNER";
    if (selectedLevel === 2) levelName = "DESERT";
    if (selectedLevel === 3) levelName = "RAINY";
    if (selectedLevel === 4) levelName = "FOGGY";
    if (selectedLevel === 5) levelName = "NIGHT";
    if (selectedLevel === 6) levelName = "CITY";
    if (selectedLevel === 7) levelName = "MOUNTAIN";
    if (selectedLevel === 8) levelName = "STORM";
    if (selectedLevel === 9) levelName = "NEON CYBERPUNK";
    if (selectedLevel === 10) levelName = "SNOWY TUNDRA";
    if (selectedLevel === 11) levelName = "VOLCANIC ASH";
    if (selectedLevel === 12) levelName = "AUTUMN FOREST";
    if (selectedLevel === 13) levelName = "GALACTIC VOID";
    if (selectedLevel === 14) levelName = "TROPICAL BEACH";

    let displayStr = `SELECT LEVEL: ${selectedLevel} (${levelName})`;
    if (selectedLevel >= 5) {
      displayStr += " 🔒 (Under Dev)";
    } else if (selectedLevel > unlockedLevels) {
      displayStr += " 🔒";
    }
    document.getElementById("btn-select-level").innerText = displayStr;
    
    updateDailyChallengeUI();
  }
  updateMenuStats();

  function updateGarageUI() {
    const car = CARS[currentCarIndex];
    document.getElementById("car-name").innerText = car.name;
    document.getElementById("garage-coins-val").innerText = totalCoins;
    engine.setCar(car.color, car.id);

    // Render car previews
    const previewsContainer = document.getElementById("car-previews");
    previewsContainer.innerHTML = "";
    CARS.forEach((c, index) => {
      const isUnlocked = unlockedCars.includes(c.id);
      const isSelected = selectedCarId === c.id;
      const isCurrent = currentCarIndex === index;

      const div = document.createElement("div");
      div.className = `car-preview-item ${isCurrent ? "selected" : ""} ${!isUnlocked ? "locked" : ""}`;
      const colorHex = "#" + c.color.toString(16).padStart(6, "0");
      div.innerHTML = `
                <div style="width: 30px; height: 15px; background-color: ${colorHex}; border-radius: 4px; border: 1px solid #fff; margin-bottom: 5px; box-shadow: 0 0 10px ${colorHex};"></div>
                <div class="preview-name">${c.name}</div>
                ${isSelected ? '<div style="position: absolute; top: 2px; right: 5px; color: #00ffff; font-size: 0.8rem;">✓</div>' : ""}
                ${!isUnlocked ? '<div style="position: absolute; top: 2px; right: 5px; color: #ff0000; font-size: 0.8rem;">🔒</div>' : ""}
            `;
      div.addEventListener("click", () => {
        currentCarIndex = index;
        updateGarageUI();
      });
      previewsContainer.appendChild(div);
    });

    const btnSelect = document.getElementById("btn-car-select");
    const btnBuyCoins = document.getElementById("btn-car-buy-coins");
    const btnBuyAd = document.getElementById("btn-car-buy-ad");
    const btnToggleUpgrades = document.getElementById("btn-toggle-upgrades");
    const statusText = document.getElementById("car-status");
    const upgradesPanel = document.getElementById("car-upgrades");

    btnSelect.classList.add("hidden");
    btnBuyCoins.classList.add("hidden");
    btnBuyAd.classList.add("hidden");
    btnToggleUpgrades.classList.add("hidden");
    upgradesPanel.classList.add("hidden");

    if (unlockedCars.includes(car.id)) {
      statusText.innerText = selectedCarId === car.id ? "Selected" : "Unlocked";
      btnSelect.classList.remove("hidden");
      btnToggleUpgrades.classList.remove("hidden");

      if (selectedCarId === car.id) {
        btnSelect.innerText = "SELECTED";
        btnSelect.style.background = "#333";
        btnSelect.style.color = "#fff";
      } else {
        btnSelect.innerText = "SELECT";
        btnSelect.style.background = "#00ffff";
        btnSelect.style.color = "#000";
      }

      // Update upgrade UI
      const upgrades = carUpgrades[car.id] || {
        speed: 0,
        handling: 0,
        acceleration: 0,
        boost: 0,
      };
      ["speed", "handling", "acceleration", "boost"].forEach((stat) => {
        const lvl = upgrades[stat];
        document.getElementById(`upg-lvl-${stat}`).innerText = lvl;
        const btn = document.getElementById(`btn-upg-${stat}`);
        if (lvl >= MAX_UPGRADE_LEVEL) {
          btn.innerText = "MAX";
          btn.disabled = true;
        } else {
          const cost = getUpgradeCost(lvl);
          btn.innerText = `${cost} C`;
          btn.disabled = totalCoins < cost;
        }
      });
    } else {
      statusText.innerText = "Locked";
      if (car.unlockType === "coins" || car.unlockType === "both") {
        btnBuyCoins.innerText = `UNLOCK (${car.cost})`;
        btnBuyCoins.classList.remove("hidden");
      }
      if (car.unlockType === "ad" || car.unlockType === "both") {
        let watched = carAdsWatched[car.id] || 0;
        btnBuyAd.innerText = `WATCH AD (${watched}/${car.adCost})`;
        btnBuyAd.classList.remove("hidden");
      }
    }

    // Update Stats Bars
    const stats = getCarStats(car.id);
    const MAX_STAT = 10; // Base max 5 + 5 upgrades
    document.getElementById("stat-bar-speed").style.width =
      `${(stats.speed / MAX_STAT) * 100}%`;
    document.getElementById("stat-bar-handling").style.width =
      `${(stats.handling / MAX_STAT) * 100}%`;
    document.getElementById("stat-bar-acceleration").style.width =
      `${(stats.acceleration / MAX_STAT) * 100}%`;
    document.getElementById("stat-bar-boost").style.width =
      `${(stats.boost / MAX_STAT) * 100}%`;
  }

  // Upgrade Buttons
  ["speed", "handling", "acceleration", "boost"].forEach((stat) => {
    document.getElementById(`btn-upg-${stat}`).addEventListener("click", () => {
      const car = CARS[currentCarIndex];
      if (!unlockedCars.includes(car.id)) return;

      if (!carUpgrades[car.id]) {
        carUpgrades[car.id] = {
          speed: 0,
          handling: 0,
          acceleration: 0,
          boost: 0,
        };
      }

      const lvl = carUpgrades[car.id][stat];
      if (lvl >= MAX_UPGRADE_LEVEL) return;

      const cost = getUpgradeCost(lvl);
      if (totalCoins >= cost) {
        totalCoins -= cost;
        carUpgrades[car.id][stat]++;

        saveState("totalCoins", totalCoins);
        saveArrayState("carUpgrades", carUpgrades);

        updateMenuStats();
        updateGarageUI();
      }
    });
  });

  // Play BGM on first interaction
  const startBGM = () => {
    if (engine.state === "menu" || engine.state === "garage") {
      engine.audio.playBGM();
    }
    document.removeEventListener("click", startBGM);
    document.removeEventListener("touchstart", startBGM);
  };
  document.addEventListener("click", startBGM);
  document.addEventListener("touchstart", startBGM);

  function startCountdown(onComplete) {
    const countdownEl = document.getElementById("start-countdown");
    const textEl = document.getElementById("countdown-text");
    countdownEl.classList.remove("hidden");
    
    let count = 3;
    textEl.innerText = count;
    
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        textEl.innerText = count;
      } else if (count === 0) {
        textEl.innerText = "START";
      } else {
        clearInterval(interval);
        countdownEl.classList.add("hidden");
        onComplete();
      }
    }, 1000);
  }

  // Main Menu Buttons
  document.getElementById("btn-start").addEventListener("click", () => {
    if (selectedLevel >= 5) {
      showModal("Locked", "This level is under development.", false);
      return;
    }
    if (selectedLevel > unlockedLevels) {
      let reqCoins = selectedLevel === 2 ? 500 : (selectedLevel === 3 ? 1000 : 2000);
      showModal("Locked", `Reach ${reqCoins} coins to unlock this level.`, false);
      return;
    }
    
    currentRunBoostCount = 0;
    wasBoostingLastFrame = false;
    
    const selectedCar = CARS.find((c) => c.id === selectedCarId);
    engine.setCar(selectedCar.color, selectedCar.id);
    engine.start(selectedLevel, getCarStats(selectedCarId));
    AdMob.hideBanner();
    
    if (!localStorage.getItem("se3d_tutorial_done")) {
      showTutorial(() => {
        showScreen("hud");
        startCountdown(() => {
          engine.state = "playing";
        });
      });
    } else {
      showScreen("hud");
      startCountdown(() => {
        engine.state = "playing";
      });
    }
  });

  const tutorialSteps = [
    { title: "WELCOME", text: "Drive as far as you can and avoid obstacles!", anim: "🚗" },
    { title: "CONTROLS", text: "Use the left and right buttons to steer your car.", anim: "◀ ▶" },
    { title: "SPEED", text: "Use the up and down buttons to accelerate and brake.", anim: "▲ ▼" },
    { title: "COINS", text: "Collect coins to buy and upgrade cars in the garage.", anim: "🪙" },
    { title: "BOOST", text: "Collect blue energy orbs to fill your boost meter!", anim: "⚡" }
  ];
  let currentTutorialStep = 0;
  let tutorialCallback = null;

  function showTutorial(onComplete) {
    tutorialCallback = onComplete;
    currentTutorialStep = 0;
    updateTutorialUI();
    showScreen("tutorial-overlay");
  }

  function updateTutorialUI() {
    const step = tutorialSteps[currentTutorialStep];
    document.getElementById("tutorial-title").innerText = step.title;
    document.getElementById("tutorial-text").innerText = step.text;
    document.getElementById("tutorial-animation").innerText = step.anim;
    document.getElementById("btn-tutorial-next").innerText = currentTutorialStep === tutorialSteps.length - 1 ? "PLAY" : "NEXT";
  }

  document.getElementById("btn-tutorial-next").addEventListener("click", () => {
    currentTutorialStep++;
    if (currentTutorialStep >= tutorialSteps.length) {
      localStorage.setItem("se3d_tutorial_done", "true");
      if (tutorialCallback) tutorialCallback();
    } else {
      updateTutorialUI();
    }
  });

  let garageAutoCycleInterval = null;
  let garageIsHovered = false;

  document.getElementById("car-previews").addEventListener("mouseenter", () => {
    garageIsHovered = true;
  });
  document.getElementById("car-previews").addEventListener("mouseleave", () => {
    garageIsHovered = false;
  });

  document.getElementById("btn-garage").addEventListener("click", () => {
    showScreen("garage-menu");
    engine.state = "garage";
    updateGarageUI();
    
    if (garageAutoCycleInterval) clearInterval(garageAutoCycleInterval);
    garageAutoCycleInterval = setInterval(() => {
      if (engine.state !== "garage" || garageIsHovered) return;
      const car = CARS[currentCarIndex];
      if (selectedCarId === car.id) return; // Stop if selected
      
      currentCarIndex = (currentCarIndex + 1) % CARS.length;
      updateGarageUI();
    }, 2000);
  });

  document.getElementById("btn-settings").addEventListener("click", () => {
    showScreen("settings-menu");
  });

  // New Social/Store Buttons
  document.getElementById("btn-rate").addEventListener("click", () => {
    window.open("https://play.google.com/store/apps/details?id=com.speedescape.game", "_blank");
  });
  
  document.getElementById("btn-share").addEventListener("click", () => {
    if (navigator.share) {
      navigator.share({
        title: 'Speed Escape 3D',
        text: 'Check out this awesome 3D racing game!',
        url: window.location.href,
      }).catch((err) => {
        // Ignore share errors (e.g., user canceled)
      });
    } else {
      showModal("Share", "Share feature is not supported on this browser.", false);
    }
  });

  document.getElementById("btn-feedback").addEventListener("click", () => {
    window.location.href = "mailto:isaacapptech23developer@gmail.com?subject=Speed Escape 3D Feedback";
  });

  // Music Player
  const updateMusicTrackName = () => {
    document.getElementById("music-track-name").innerText = engine.audio.getCurrentTrackName();
  };
  updateMusicTrackName(); // Initial update

  document.getElementById("btn-music-prev").addEventListener("click", () => {
    engine.audio.prevTrack();
    updateMusicTrackName();
  });

  document.getElementById("btn-music-next").addEventListener("click", () => {
    engine.audio.nextTrack();
    updateMusicTrackName();
  });

  document.getElementById("btn-select-level").addEventListener("click", () => {
    generateLevelGrid();
    showScreen("level-menu");
  });

  document.getElementById("btn-level-back").addEventListener("click", () => {
    showScreen("main-menu");
  });

  function getLevelName(level) {
    let levelName = "BEGINNER";
    if (level === 2) levelName = "DESERT";
    if (level === 3) levelName = "RAINY";
    if (level === 4) levelName = "FOGGY";
    if (level === 5) levelName = "NIGHT";
    if (level === 6) levelName = "CITY";
    if (level === 7) levelName = "MOUNTAIN";
    if (level === 8) levelName = "STORM";
    return levelName;
  }

  function generateLevelGrid() {
    const grid = document.getElementById("level-grid");
    grid.innerHTML = "";
    
    // Update unlocks based on coins before generating grid
    if (totalCoins >= 500 && unlockedLevels < 2) unlockedLevels = 2;
    if (totalCoins >= 1000 && unlockedLevels < 3) unlockedLevels = 3;
    if (totalCoins >= 2000 && unlockedLevels < 4) unlockedLevels = 4;
    saveState("unlockedLevels", unlockedLevels);

    for (let i = 1; i <= 8; i++) {
      const btn = document.createElement("button");
      const isUnderDev = i >= 5;
      const isUnlocked = i <= unlockedLevels && !isUnderDev;
      
      btn.className = `level-btn ${isUnlocked ? 'unlocked' : 'locked'}`;
      
      const levelNum = document.createElement("div");
      levelNum.style.fontSize = "1.5rem";
      levelNum.style.fontWeight = "bold";
      levelNum.innerText = i;
      
      const levelName = document.createElement("div");
      levelName.style.fontSize = "0.8rem";
      levelName.innerText = getLevelName(i);
      
      btn.appendChild(levelNum);
      btn.appendChild(levelName);
      
      if (isUnderDev) {
        const lockedIcon = document.createElement("div");
        lockedIcon.innerText = "🔒 Under Dev";
        lockedIcon.style.fontSize = "0.7rem";
        lockedIcon.style.color = "#ff5500";
        btn.appendChild(lockedIcon);
        btn.addEventListener("click", () => {
          showModal("Locked", "This level is under development.", false);
        });
      } else if (!isUnlocked) {
        const lockedIcon = document.createElement("div");
        let reqCoins = i === 2 ? 500 : (i === 3 ? 1000 : 2000);
        lockedIcon.innerText = `🔒 ${reqCoins} Coins`;
        lockedIcon.style.fontSize = "0.7rem";
        lockedIcon.style.color = "#ff0000";
        btn.appendChild(lockedIcon);
        btn.addEventListener("click", () => {
          showModal("Locked", `Reach ${reqCoins} coins to unlock this level.`, false);
        });
      } else {
        btn.addEventListener("click", () => {
          selectedLevel = i;
          updateMenuStats();
          showScreen("main-menu");
        });
      }
      
      grid.appendChild(btn);
    }
  }

  // Settings Buttons
  document.getElementById("btn-settings-back").addEventListener("click", () => {
    showScreen("main-menu");
  });

  document.getElementById("btn-toggle-sound").addEventListener("click", (e) => {
    soundEnabled = !soundEnabled;
    localStorage.setItem("se3d_sound", soundEnabled);
    engine.audio.enabled = soundEnabled;
    e.target.innerText = soundEnabled ? "ON" : "OFF";
  });

  document
    .getElementById("btn-toggle-graphics")
    .addEventListener("click", (e) => {
      if (graphicsQuality === "HIGH") graphicsQuality = "MEDIUM";
      else graphicsQuality = "HIGH";

      localStorage.setItem("se3d_graphics", graphicsQuality);
      engine.setGraphicsQuality(graphicsQuality);
      e.target.innerText = graphicsQuality;
    });

  // Custom Modal Logic
  function showModal(title, message, isConfirm, onConfirm) {
    document.getElementById("modal-title").innerText = title;
    document.getElementById("modal-message").innerText = message;

    const modal = document.getElementById("custom-modal");
    let btnOk = document.getElementById("btn-modal-ok");
    let btnCancel = document.getElementById("btn-modal-cancel");

    // Clone buttons to remove old event listeners
    const newBtnOk = btnOk.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    btnOk = newBtnOk;

    const newBtnCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    btnCancel = newBtnCancel;

    modal.classList.add("active");

    if (isConfirm) {
      btnCancel.classList.remove("hidden");
    } else {
      btnCancel.classList.add("hidden");
    }

    const cleanup = () => {
      modal.classList.remove("active");
    };

    btnOk.addEventListener("click", () => {
      cleanup();
      if (onConfirm) onConfirm(true);
    });

    btnCancel.addEventListener("click", () => {
      cleanup();
      if (onConfirm) onConfirm(false);
    });
  }

  document
    .getElementById("btn-reset-progress")
    .addEventListener("click", () => {
      showModal(
        "Reset Progress",
        "Are you sure you want to reset all progress? This cannot be undone.",
        true,
        (confirmed) => {
          if (confirmed) {
            localStorage.clear();
            location.reload();
          }
        },
      );
    });

  // Garage Buttons
  document.getElementById("btn-garage-back").addEventListener("click", () => {
    if (garageAutoCycleInterval) clearInterval(garageAutoCycleInterval);
    showScreen("main-menu");
    engine.state = "menu";
    engine.player.rotation.set(0, 0, 0);

    // Revert to selected car if they were just previewing
    currentCarIndex = CARS.findIndex((c) => c.id === selectedCarId);
    const selectedCar = CARS[currentCarIndex];
    engine.setCar(selectedCar.color, selectedCar.id);

    updateMenuStats();
    AdMob.showBanner();
  });

  document
    .getElementById("btn-toggle-upgrades")
    .addEventListener("click", () => {
      const upgradesPanel = document.getElementById("car-upgrades");
      if (upgradesPanel.classList.contains("hidden")) {
        upgradesPanel.classList.remove("hidden");
      } else {
        upgradesPanel.classList.add("hidden");
      }
    });

  document.getElementById("btn-car-select").addEventListener("click", () => {
    const car = CARS[currentCarIndex];
    if (unlockedCars.includes(car.id)) {
      selectedCarId = car.id;
      localStorage.setItem("se3d_selectedCar", selectedCarId);
      updateGarageUI();
    }
  });

  document.getElementById("btn-car-buy-coins").addEventListener("click", () => {
    const car = CARS[currentCarIndex];
    if (totalCoins >= car.cost) {
      totalCoins -= car.cost;
      saveState("totalCoins", totalCoins);
      unlockedCars.push(car.id);
      saveArrayState("unlockedCars", unlockedCars);
      selectedCarId = car.id;
      localStorage.setItem("se3d_selectedCar", selectedCarId);
      updateGarageUI();
      updateMenuStats();
    } else {
      showModal(
        "Not Enough Coins",
        "You don't have enough coins to buy this car.",
        false,
      );
    }
  });

  document
    .getElementById("btn-car-buy-ad")
    .addEventListener("click", async () => {
      const car = CARS[currentCarIndex];
      const success = await AdMob.showRewardedAd();
      if (success) {
        if (carAdsWatched[car.id] === undefined) {
          carAdsWatched[car.id] = 0;
        }
        carAdsWatched[car.id]++;
        saveArrayState("carAdsWatched", carAdsWatched);

        if (carAdsWatched[car.id] >= car.adCost) {
          unlockedCars.push(car.id);
          saveArrayState("unlockedCars", unlockedCars);
          selectedCarId = car.id;
          localStorage.setItem("se3d_selectedCar", selectedCarId);
        }
        updateGarageUI();
      }
    });

  // HUD & Game Over
  document.getElementById("btn-pause").addEventListener("click", () => {
    engine.state = "paused";
    engine.audio.stopEngine();
    showScreen("pause-menu");
  });

  document.getElementById("btn-resume").addEventListener("click", () => {
    engine.state = "playing";
    engine.audio.startEngine();
    showScreen("hud");
  });

  document.getElementById("btn-quit").addEventListener("click", () => {
    engine.stop(true);
    engine.state = "menu";
    showScreen("main-menu");
    updateMenuStats();
    AdMob.showBanner();
    engine.audio.playBGM();
  });

  document.getElementById("btn-restart").addEventListener("click", () => {
    showScreen("hud");
    engine.start(selectedLevel, getCarStats(selectedCarId));
    startCountdown(() => {
      engine.state = "playing";
    });
  });

  document.getElementById("btn-continue-ad").addEventListener("click", async () => {
    const success = await AdMob.showRewardedAd();
    if (success) {
      showScreen("hud");
      engine.continueGame();
      startCountdown(() => {
        engine.state = "playing";
      });
    }
  });

  document.getElementById("btn-menu").addEventListener("click", () => {
    showScreen("main-menu");
    engine.state = "menu";
    updateMenuStats();
    AdMob.showBanner();
    engine.audio.playBGM();
  });

  // Touch Controls
  const btnLeft = document.getElementById("btn-left");
  const btnRight = document.getElementById("btn-right");
  const btnForward = document.getElementById("btn-forward");
  const btnReverse = document.getElementById("btn-reverse");

  const handleTouch = (e, dir, active) => {
    e.preventDefault();
    engine.setTouch(dir, active);
  };

  btnLeft.addEventListener("touchstart", (e) => handleTouch(e, "left", true), {
    passive: false,
  });
  btnLeft.addEventListener("touchend", (e) => handleTouch(e, "left", false), {
    passive: false,
  });
  btnLeft.addEventListener("mousedown", (e) => handleTouch(e, "left", true));
  btnLeft.addEventListener("mouseup", (e) => handleTouch(e, "left", false));
  btnLeft.addEventListener("mouseleave", (e) => handleTouch(e, "left", false));

  btnRight.addEventListener(
    "touchstart",
    (e) => handleTouch(e, "right", true),
    { passive: false },
  );
  btnRight.addEventListener("touchend", (e) => handleTouch(e, "right", false), {
    passive: false,
  });
  btnRight.addEventListener("mousedown", (e) => handleTouch(e, "right", true));
  btnRight.addEventListener("mouseup", (e) => handleTouch(e, "right", false));
  btnRight.addEventListener("mouseleave", (e) =>
    handleTouch(e, "right", false),
  );

  btnForward.addEventListener("touchstart", (e) => handleTouch(e, "up", true), { passive: false });
  btnForward.addEventListener("touchend", (e) => handleTouch(e, "up", false), { passive: false });
  btnForward.addEventListener("mousedown", (e) => handleTouch(e, "up", true));
  btnForward.addEventListener("mouseup", (e) => handleTouch(e, "up", false));
  btnForward.addEventListener("mouseleave", (e) => handleTouch(e, "up", false));

  btnReverse.addEventListener("touchstart", (e) => handleTouch(e, "down", true), { passive: false });
  btnReverse.addEventListener("touchend", (e) => handleTouch(e, "down", false), { passive: false });
  btnReverse.addEventListener("mousedown", (e) => handleTouch(e, "down", true));
  btnReverse.addEventListener("mouseup", (e) => handleTouch(e, "down", false));
  btnReverse.addEventListener("mouseleave", (e) => handleTouch(e, "down", false));

  const btnHorn = document.getElementById("btn-horn");
  if (btnHorn) {
    btnHorn.addEventListener("touchstart", (e) => { e.preventDefault(); engine.audio.playHorn(); }, { passive: false });
    btnHorn.addEventListener("mousedown", (e) => { e.preventDefault(); engine.audio.playHorn(); });
  }

  // Initial Ad
  AdMob.showBanner();
});

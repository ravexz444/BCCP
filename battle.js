let equipmentData = {};
let collectionData = {};
let collectionCodes = {};
let enemiesData = {};
let retainersData = {};
let excludedSkills = [];
let skillsDictionary = {};
let playerRetainers = [];  // active retainers
let enemyRetainers = [];

const MAX_LOG_LINES = 500;
let SIMULATIONS = 1;

const elements = ["Ballistic", "Chaos", "Electric", "Fire", "Holy", "Ice", "Mystic", "Physical", "Poison", "Psychic", "Shadow", "All"];
const races = ["Abominable", "Archangel", "Bestial", "Corrupted", "Demonic", "Draconic","Eldritch", "Ethereal", "Lycan", "Necro", "Righteous", "Techno", "Vampiric", "Xeno"];

// ------------------ Load Player Data ------------------
async function loadData() {
  const [equip, coll, codes, excluded, dict] = await Promise.all([
    fetch("equipment_list.json").then(r => r.json()),
    fetch("collection_list.json").then(r => r.json()),
    fetch("collection_codes.json").then(r => r.json()),
    fetch("excluded_skills.json").then(r => r.json()),
    fetch("skills_dictionary.json").then(r => r.json())
  ]);
  equipmentData = equip;
  collectionData = coll;
  collectionCodes = codes;
  excludedSkills = excluded;
  skillsDictionary = dict;
}

function getSkillsForSetup(setup) {
  let skills = [];
  (setup.equipment || []).forEach(eq => {
    const item = equipmentData[eq];
    if (item?.skill) skills.push(...item.skill.map(s => s[0])); // only push skill name
  });
  (setup.collections || []).forEach(c => {
    const item = collectionData[c];
    if (item?.skill) skills.push(...item.skill.map(s => s[0]));
  });
  return categorizeSkills(skills);
}

// ------------------ Skill Filtering ------------------
function filterSkills(skillList) {
  return skillList
    .filter(skill => !excludedSkills.includes(skill)) // remove excluded
    .filter(skill => skillsDictionary[skill]);        // keep only valid
}

function categorizeSkills(skillList) {
  const filtered = filterSkills(skillList);
  return filtered.map(skill => {
    const info = skillsDictionary[skill];
    return {
      name: skill,
      type: info.type,
      element: info.element || null,
      race: info.race || null
    };
  });
}

// ------------------ Load Enemies ------------------
async function loadEnemies() {
  const response = await fetch("enemies_list.json");
  enemiesData = await response.json();

  const container = document.getElementById("enemySelectors");
  for (let i = 0; i < 10; i++) {
    const select = document.createElement("select");
    select.id = `enemy${i + 1}`;
    select.classList.add("enemy-select");
    select.innerHTML = `<option value="">-- Select Enemy --</option>`;
    Object.keys(enemiesData).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
    container.appendChild(select);
    container.appendChild(document.createElement("br"));
  }
}

// ------------------ Helpers ------------------
function logBattle(text) {
  const logDiv = document.getElementById("battle-log");
  const lines = logDiv.innerText.split("\n");
  lines.push(text);
  if (lines.length > MAX_LOG_LINES) {
    lines.splice(0, lines.length - MAX_LOG_LINES);
  }
  logDiv.innerText = lines.join("\n");
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Pick a random skill from list with probability handling
function pickSkill(skillList) {
  const candidates = skillList.filter(s => Math.random() < (s[2] ?? 1.0)); 
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ------------------ Add or Remove Retainers ------------------
function summonRetainer(side, retainer) {
  if (side === "player" && playerRetainers.length < 4) {
    playerRetainers.push(retainer);
    addSkillsFromRetainer("player", retainer);
  } else if (side === "enemy" && enemyRetainers.length < 4) {
    enemyRetainers.push(retainer);
    addSkillsFromRetainer("enemy", retainer);
  }
}

function addSkillsFromRetainer(side, retainer) {
  // retainer.skills is assumed to be an array
  if (side === "player") {
    playerSkills.push(...retainer.skills);
  } else {
    enemySkills.push(...retainer.skills);
  }
}

function removeSkillsFromRetainer(side, retainer) {
  if (side === "player") {
    playerSkills = playerSkills.filter(s => !retainer.skills.includes(s));
  } else {
    enemySkills = enemySkills.filter(s => !retainer.skills.includes(s));
  }
}

const playerWeaponSkills = getWeaponSkills(playerSkills);
const enemyWeaponSkills = getWeaponSkills(enemySkills);

console.log("Player Wpn Skills:", playerWeaponSkills);
console.log("Enemy Wpn Skills:", enemyWeaponSkills);

// ------------------ Battle Simulation ------------------
function simulateBattle(enemy, playerSkills, enemyName, simCount) {
	let wins = 0;

	for (let sim = 0; sim < simCount; sim++) {
		let playerHP = 100; // TODO: from setup
		let enemyHP = enemy.maxhp;

		// --- Round 0 setup (beginning skills) ---
		const playerWpn = getWeaponSkills(playerSkills); // type "Wpn", "RWpn"
		const enemyWpn = getWeaponSkills(enemy.skills);

		if (sim === 0) {
			logBattle(`Round 0 setup: Player(${playerWpn.length}) vs Enemy(${enemyWpn.length})`);
		}

		// --- Rounds 1 to 5 ---
		for (let round = 1; round <= 5; round++) {
			if (playerHP <= 0 || enemyHP <= 0) break;

			if (sim === 0) logBattle(`--- Round ${round} ---`);

			// Priority order (basic skeleton)
			// Atk 1st prio
			enemyHP = applySkills(playerWpn, enemyHP, "Player", sim);

			// Def 1st prio (placeholder)
			playerHP = applySkills([], playerHP, "EnemyDef", sim);

			// Atk 2nd prio
			playerHP = applySkills(enemyWpn, playerHP, enemyName, sim);

			// Def 2nd prio (placeholder)
			enemyHP = applySkills([], enemyHP, "PlayerDef", sim);

			// Atk 3rd prio (not used yet)
			// Def 3rd prio (not used yet)

			if (playerHP <= 0 || enemyHP <= 0) break;
		}

		if (playerHP > 0 && enemyHP <= 0) wins++;
	}

	return { wins, total: simCount };
}

// Apply weapon skills (simplified for now)
function applySkills(skills, targetHP, owner, sim) {
	for (let skill of skills) {
		// TODO: lookup actual damage values from dictionary
		const dmg = randomInRange(4, 8);
		targetHP -= dmg;
		if (sim === 0) logBattle(`${owner} uses ${skill[0]} (${skill[1]}), hits ${dmg}, Target HP: ${targetHP}`);
	}
	return targetHP;
}

// ------------------ Main ------------------
document.addEventListener("DOMContentLoaded", async () => {
  await loadData();

  const setup = JSON.parse(localStorage.getItem("playerSetup")) || {};
  const playerSkills = getSkillsForSetup(setup);

  const logDiv = document.getElementById("battle-log");
  logDiv.innerHTML = `
    <h2>Your Setup</h2>
    <p><b>Equipment:</b> ${setup.equipment?.join(", ") || "None"}</p>
    <p><b>Collections:</b> ${setup.collections?.join(", ") || "None"}</p>
    <h3>Skills:</h3>
    <ul>${playerSkills.map(s => `<li>${s.name} [${s.type}, ${s.element}${s.race ? ", vs " + s.race : ""}]</li>`).join("")}</ul>
  `;

  await loadEnemies();

  document.getElementById("battleBtn").addEventListener("click", () => {
    const simulationCount = parseInt(document.getElementById("simulations").value, 10) || 100;

    const selectors = document.querySelectorAll(".enemy-select");
    const selectedEnemies = Array.from(selectors)
      .map(sel => sel.value)
      .filter(v => v !== "");

    if (selectedEnemies.length === 0) {
      alert("Please select at least one enemy.");
      return;
    }

    logDiv.innerText = ""; // reset
    const results = [];

    for (const enemyName of selectedEnemies) {
      const enemy = enemiesData[enemyName];
      if (!enemy) continue;

      logBattle(`--- Battle vs ${enemyName} ---`);
      const { wins, total } = simulateBattle(enemy, playerSkills, enemyName, simulationCount);
      const winrate = (wins / total * 100).toFixed(1);
      results.push(`${enemyName}: ${wins}/${total} (${winrate}%)`);
    }

    logBattle("\n--- Results ---");
    results.forEach(r => logBattle(r));
  });
});

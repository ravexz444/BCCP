let equipmentData = {};
let collectionData = {};
let collectionCodes = {};
let enemiesData = {};
let retainersData = {};

const MAX_LOG_LINES = 200;
const SIMULATIONS = 100;

// ------------------ Load Player Data ------------------
async function loadData() {
  const [equip, coll, codes] = await Promise.all([
    fetch("equipment_list.json").then(r => r.json()),
    fetch("collection_list.json").then(r => r.json()),
    fetch("collection_codes.json").then(r => r.json())
  ]);
  equipmentData = equip;
  collectionData = coll;
  collectionCodes = codes;
}

function getSkillsForSetup(setup) {
  let skills = [];
  (setup.equipment || []).forEach(eq => {
    const item = equipmentData[eq];
    if (item?.skill) skills.push(...item.skill);
  });
  (setup.collections || []).forEach(c => {
    const item = collectionData[c];
    if (item?.skill) skills.push(...item.skill);
  });
  return skills;
}

// ------------------ Load Enemies ------------------
async function loadEnemies() {
  const response = await fetch("enemies_list.json");
  enemiesData = await response.json();

  const container = document.getElementById("enemySelectors");
  for (let i = 0; i < 10; i++) {
    const select = document.createElement("select");
    select.id = `enemy${i + 1}`;
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
  const candidates = skillList.filter(s => Math.random() < s[2]); // keep those that "trigger"
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ------------------ Battle Simulation ------------------
function simulateBattle(enemy, playerSkills, enemyName) {
  let wins = 0;

  for (let sim = 0; sim < SIMULATIONS; sim++) {
    let playerHP = 100; // TODO: base this on setup if you want
    let enemyHP = enemy.maxhp;
    let turn = 0;

    while (playerHP > 0 && enemyHP > 0) {
      if (turn % 2 === 0) {
        // Player turn
        const skill = pickSkill(playerSkills.map(s => [s[0], s[1], 1.0])); // assume prob=1.0
        if (skill) {
          let dmgRange = skill[1].split("-").map(Number);
          let dmg = randomInRange(dmgRange[0], dmgRange[1]);
          enemyHP -= dmg;
          if (sim === 0) logBattle(`Player uses ${skill[0]}, hits ${dmg}, Enemy HP: ${enemyHP}`);
        }
      } else {
        // Enemy turn
        const skill = pickSkill(enemy.skill);
        if (skill) {
          let dmgRange = skill[1].split("-").map(Number);
          let dmg = randomInRange(dmgRange[0], dmgRange[1]);
          playerHP -= dmg;
          if (sim === 0) logBattle(`${enemyName} uses ${skill[0]}, hits ${dmg}, Player HP: ${playerHP}`);
        }
      }
      turn++;
    }

    if (playerHP > 0) wins++;
  }

  return { wins, total: SIMULATIONS };
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
		<ul>${playerSkills.map(s => `<li>${s[0]} (${s[1]})</li>`).join("")}</ul>
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


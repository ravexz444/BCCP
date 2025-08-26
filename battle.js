let equipmentData = {};
let collectionData = {};
let collectionCodes = {};
let enemiesData = {};
let retainersData = {};
let excludedSkills = [];
let skillsDictionary = {};
let playerRetainers = [];  // active retainers
let enemyRetainers = [];

const MAX_LOG_LINES = 200;
let SIMULATIONS = 100;

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

// ------------------ Battle Simulation ------------------
function simulateBattle(enemy, playerSkills, enemyName, simCount) {
  let wins = 0;

  for (let sim = 0; sim < simCount; sim++) {
    let playerHP = 100; // TODO: link to setup
    let enemyHP = enemy.maxhp;
    let turn = 0;

    while (playerHP > 0 && enemyHP > 0) {
      if (turn % 2 === 0) {
        // Player turn
        const skill = playerSkills[Math.floor(Math.random() * playerSkills.length)];
        if (skill) {
          // For now: fake damage since dictionary doesn’t have numbers
          const dmg = randomInRange(4, 8);
          enemyHP -= dmg;
          if (sim === 0) logBattle(`Player uses ${skill.name} (${skill.type}), hits ${dmg}, Enemy HP: ${enemyHP}`);
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

  return { wins, total: simCount };
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

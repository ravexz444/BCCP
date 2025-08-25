let equipmentData = {};
let collectionData = {};
let collectionCodes = {};

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

async function loadEnemyData(enemyName) {
  const response = await fetch("enemies_list.json");
  const enemies = await response.json();
  const enemy = enemies[enemyName]; // <-- direct lookup by name

  if (enemy) {
    console.log("Enemy loaded:", enemy);

    // Show in battle log
    const battleLog = document.getElementById("battle-log");
    battleLog.innerHTML += `
      <div class="enemy-block">
        <h3>${enemyName}</h3>
        <p><b>Race:</b> ${enemy.race}</p>
        <p><b>HP:</b> ${enemy.maxhp}</p>
        <p><b>Retainers:</b> ${[enemy.ret1, enemy.ret2, enemy.ret3].filter(Boolean).join(", ") || "None"}</p>
        <p><b>Skills:</b></p>
        <ul>
          ${enemy.skill.map(s => `<li>${s[0]} (${s[1]}) [Prob: ${s[2]}]</li>`).join("")}
        </ul>
      </div>
    `;
  }

  return enemy;
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


document.addEventListener("DOMContentLoaded", async () => {
  await loadData();

  const setup = JSON.parse(localStorage.getItem("playerSetup")) || {};
  const skills = getSkillsForSetup(setup);

  const logDiv = document.getElementById("battle-log");
  logDiv.innerHTML = `
    <h2>Your Setup</h2>
    <p><b>Equipment:</b> ${setup.equipment?.join(", ") || "None"}</p>
    <p><b>Collections:</b> ${setup.collections?.join(", ") || "None"}</p>
    <h3>Skills:</h3>
    <ul>${skills.map(s => `<li>${s[0]} (${s[1]})</li>`).join("")}</ul>
  `;

	// Load enemy list
	let enemiesData = {};
	fetch("enemies_list.json")
		.then(res => res.json())
		.then(data => {
			enemiesData = data;
			createEnemySelectors(Object.keys(data));
		});

	// Create 10 dropdowns for enemy selection
	function createEnemySelectors(enemyNames) {
		const container = document.getElementById("enemySelectors");
		for (let i = 0; i < 10; i++) {
			const select = document.createElement("select");
			select.id = `enemy${i + 1}`;
			select.innerHTML = `<option value="">-- Select Enemy --</option>`;
			enemyNames.forEach(name => {
				const opt = document.createElement("option");
				opt.value = name;
				opt.textContent = name;
				select.appendChild(opt);
			});
			container.appendChild(select);
			container.appendChild(document.createElement("br"));
		}
	}

	// Handle Battle Button
	document.getElementById("battleBtn").addEventListener("click", () => {
		const logDiv = document.getElementById("battle-log");
		logDiv.innerHTML = "<h2>Battle Setup</h2>";

		for (let i = 0; i < 10; i++) {
			const enemyName = document.getElementById(`enemy${i + 1}`).value;
			if (enemyName && enemiesData[enemyName]) {
				const e = enemiesData[enemyName];
				logDiv.innerHTML += `
					<div style="border:1px solid #ccc; margin:5px; padding:5px;">
						<h3>${enemyName}</h3>
						<p><b>Race:</b> ${e.race}</p>
						<p><b>Max HP:</b> ${e.maxhp}</p>
						<p><b>Retainers:</b> ${[e.ret1, e.ret2, e.ret3].filter(r => r).join(", ") || "None"}</p>
						<p><b>Skills:</b></p>
						<ul>
							${e.skill.map(s => `<li>${s[0]} (${s[1]}) [Prob: ${s[2]}]</li>`).join("")}
						</ul>
					</div>
				`;
			}
		}
	});
});

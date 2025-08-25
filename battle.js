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

  // Load enemies_list.json
  const res = await fetch("enemies_list.json");
  const enemies = await res.json();
  const enemyNames = Object.keys(enemies);

  const container = document.getElementById("enemySelectors");

  // Create 10 dropdowns
  for (let i = 0; i < 10; i++) {
    const select = document.createElement("select");
    select.id = `enemySelect${i}`;
    select.innerHTML = `
      <option value="">-- Select Enemy ${i + 1} --</option>
      ${enemyNames.map(name => `<option value="${name}">${name}</option>`).join("")}
    `;
    container.appendChild(select);
    container.appendChild(document.createElement("br"));
  }

  // Example: get selected enemies when needed
  document.getElementById("battle-log").insertAdjacentHTML("beforebegin", `
    <button id="checkEnemiesBtn">Check Selected Enemies</button>
  `);

  document.getElementById("checkEnemiesBtn").addEventListener("click", () => {
    let chosen = [];
    for (let i = 0; i < 10; i++) {
      const val = document.getElementById(`enemySelect${i}`).value;
      if (val) chosen.push(val);
    }
    console.log("Selected enemies:", chosen);
    alert("You chose: " + chosen.join(", "));
  });
});

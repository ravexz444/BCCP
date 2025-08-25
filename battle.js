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

  // now you can start battle logic using `skills`
});

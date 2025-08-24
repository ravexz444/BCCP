const equipmentTypes = [
  "Coin", "Bait", "Hex", "Weapon", "Head", "Chest", "Hands", "Feet",
  "Power", "Emblem", "Coffin", "Accessory", "Mount", "Retainer"
];

let equipmentData = {};
let collectionData = {};
let collectionCodes = {}; // shortCode → fullName mapping
let skillGroups = {};     // { GroupName: [skill, ...], ... }
let combinableSkills = new Set(); // filled from combinable_skills.json

function createDropdown(type, index = null) {
  const label = document.createElement("label");
  label.textContent = index ? `${type} ${index}: ` : `${type}: `;

  const select = document.createElement("select");
  select.id = index ? `select-${type}-${index}` : `select-${type}`;

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "-- Select " + type + " --";
  select.appendChild(defaultOption);

  for (const [name, info] of Object.entries(equipmentData)) {
    if (info.type === type) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    }
  }

  select.addEventListener("change", updateSkills);

  const container = document.getElementById("equipment-selectors");
  container.appendChild(label);
  container.appendChild(select);
  container.appendChild(document.createElement("br"));
}

function createCollectionCheckboxes() {
  const container = document.getElementById("collection-selectors");

  for (const code of Object.keys(collectionCodes)) {
    const div = document.createElement("div");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "collection-" + code; // use short code
    checkbox.value = code;
    checkbox.addEventListener("change", updateSkills);

    const label = document.createElement("label");
    label.htmlFor = "collection-" + code;
    label.textContent = `${code}`;

    div.appendChild(checkbox);
    div.appendChild(label);
    container.appendChild(div);
  }
}

// ---- parsing helpers ----
function parseSkillValue(raw) {
  // Accept numbers as-is
  if (typeof raw === "number") return { type: "number", value: raw, unit: "" };

  if (typeof raw !== "string") return { type: "text", raw: String(raw) };

  const s = raw.trim();

  // percent, e.g. "10%"
  let m = s.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
  if (m) return { type: "percent", value: parseFloat(m[1]), unit: "%" };

  // trailing plus, e.g. "18+"
  m = s.match(/^(-?\d+(?:\.\d+)?)\+$/);
  if (m) return { type: "plus", value: parseFloat(m[1]), unit: "+" };

  // range, e.g. "1-3"
  m = s.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { type: "range", range: [parseFloat(m[1]), parseFloat(m[2])], raw: s };

  // plain number string
  m = s.match(/^-?\d+(?:\.\d+)?$/);
  if (m) return { type: "number", value: parseFloat(s), unit: "" };

  // fallback text
  return { type: "text", raw: s };
}

function formatTotal(total, unit) {
  if (total == null) return "";
  // keep integers clean; allow decimals if needed
  const num = Number.isInteger(total) ? total : Number(total.toFixed(2));
  return unit === "%" ? `${num}%` : `${num}`;
}

// ---- grouping + combining ----
function addSkill(categoryMap, category, skillName, rawValue) {
  if (!categoryMap[category]) categoryMap[category] = {};
  if (!categoryMap[category][skillName]) {
    categoryMap[category][skillName] = { total: null, unit: "", parts: [] };
  }

  const entry = categoryMap[category][skillName];
  const parsed = parseSkillValue(rawValue);

  // Combine only if the skill is in combinable list AND parsed is numeric-like
  if (combinableSkills.has(skillName) && (parsed.type === "number" || parsed.type === "percent" || parsed.type === "plus")) {
    const add = parsed.value;
    entry.total = (entry.total ?? 0) + add;
    // prefer % if percent
    if (parsed.type === "percent") entry.unit = "%";
    entry.parts.push(typeof rawValue === "string" ? rawValue : String(rawValue));
  } else {
    // Non-combinable (or non-numeric): keep raw parts; no total
    entry.parts.push(typeof rawValue === "string" ? rawValue : String(rawValue));
  }
}

function summarizeSkills(allSkillsWithValues) {
  const categoryMap = {};

  allSkillsWithValues.forEach(([skillName, value]) => {
    let placed = false;
    for (const [groupName, groupSkills] of Object.entries(skillGroups)) {
      if (groupSkills.includes(skillName)) {
        addSkill(categoryMap, groupName, skillName, value);
        placed = true;
        break;
      }
    }
    if (!placed) addSkill(categoryMap, "Other", skillName, value);
  });

  return categoryMap;
}

function renderSkillSummary(allSkillsWithValues) {
  const categoryMap = summarizeSkills(allSkillsWithValues);
  const container = document.getElementById("skills-summary");
  container.innerHTML = ""; 

  for (const [category, skills] of Object.entries(categoryMap)) {
    const h3 = document.createElement("h3");
    h3.textContent = category;
    container.appendChild(h3);

    const ul = document.createElement("ul");
    for (const [skill, data] of Object.entries(skills)) {
      const li = document.createElement("li");
      if (data.total != null) {
        // Show total and breakdown (if multiple parts)
        const totalText = formatTotal(data.total, data.unit);
        if (data.parts.length > 1) {
          li.innerHTML = `${skill} ${totalText} (${data.parts.join(", ")})</span>`;
        } else {
          li.textContent = `${skill} ${totalText}`;
        }
      } else {
        // Non-combinable: just show raw values (joined if more than one)
        li.textContent = `${skill} ${data.parts.join(", ")}`;
      }
      ul.appendChild(li);
    }
    container.appendChild(ul);
  }
}

// ---- main update ----
function updateSkills() {
  const outputDiv = document.getElementById("skills-output");
  outputDiv.innerHTML = "";

  let chosenItems = [];

  // Equipment + Retainers
  equipmentTypes.forEach(type => {
    if (type === "Accessory" || type === "Retainer") {
      for (let i = 1; i <= 3; i++) {
        const select = document.getElementById(`select-${type}-${i}`);
        if (select && select.value) chosenItems.push(select.value);
      }
    } else {
      const select = document.getElementById(`select-${type}`);
      if (select && select.value) chosenItems.push(select.value);
    }
  });

  // Collections (use codes, map to full names)
  for (const code of Object.keys(collectionCodes)) {
    const checkbox = document.getElementById("collection-" + code);
    if (checkbox && checkbox.checked) {
      const fullName = collectionCodes[code];
      chosenItems.push(fullName);
    }
  }

  // Per-item display + collect for summary
  let allSkillsWithValues = [];
  chosenItems.forEach(itemName => {
    let info = equipmentData[itemName] || collectionData[itemName];
    if (info && info.skill) {
      // Per-item output
      const itemDiv = document.createElement("div");
      itemDiv.innerHTML = `<b>${itemName}</b><br>` +
        info.skill.map(s => `- ${s[0]} (${s[1]})`).join("<br>");
      outputDiv.appendChild(itemDiv);
      outputDiv.appendChild(document.createElement("br"));

      // Collect for summary: [skillName, rawValueStringOrNumber]
      info.skill.forEach(s => allSkillsWithValues.push([s[0], s[1]]));
    }
  });

  renderSkillSummary(allSkillsWithValues);
}

// ---- data loading ----
async function loadAllData() {
  const [equip, coll, codes, groups, combinables] = await Promise.all([
    fetch("equipment_list.json").then(r => r.json()),
    fetch("collection_list.json").then(r => r.json()),
    fetch("collection_codes.json").then(r => r.json()),
    fetch("skill_groups.json").then(r => r.json()),   // your revised format: { "Weapon Attack": [...], ... }
    fetch("combinable_skills.json").then(r => r.json())
  ]);

  equipmentData = equip;
  collectionData = coll;
  collectionCodes = codes;
  skillGroups = groups; // already the dictionary
  combinableSkills = new Set(combinables);

  // Build UI
  equipmentTypes.forEach(type => {
    if (type === "Accessory" || type === "Retainer") {
      for (let i = 1; i <= 3; i++) createDropdown(type, i);
    } else {
      createDropdown(type);
    }
  });
  createCollectionCheckboxes();
}

// run on page load
loadAllData();

const equipmentTypes = [
	"Coin", "Bait", "Hex", "Weapon", "Head", "Chest", "Hands", "Feet",
	"Power", "Emblem", "Coffin", "Accessory", "Mount", "Retainer"
];
const eventRegions = ["LE", "RAA", "RDD", "R01.3","R02.3"];
const premiumRegions = ["PS2024", "PS2025"];

let equipmentData = {};
let collectionData = {};
let collectionCodes = {}; // shortCode → fullName mapping
let skillGroups = {};     // { GroupName: [skill, ...], ... }
let combinableSkills = new Set(); // filled from combinable_skills.json

// ---------------------- Search UI ----------------------
// Search Builder Helper
function parseNumber(val) {
	val = val.replace(/,/g, "").toUpperCase().trim();
	let mult = 1;
	if (val.endsWith("K")) {
		mult = 1000;
		val = val.slice(0, -1);
	} else if (val.endsWith("M")) {
		mult = 1000000;
		val = val.slice(0, -1);
	}
	return parseFloat(val) * mult;
}

function compareValue(op, a, b) {
	switch (op) {
		case "<": return a < b;
		case ">": return a > b;
		case "<=": return a <= b;
		case ">=": return a >= b;
		default: return a === b;
	}
}

function parseQuery(query) {
	const filters = [];
	// split by semicolon first
	const fieldClauses = query.split(";").map(s => s.trim()).filter(Boolean);

	for (const clause of fieldClauses) {
		// field:val1,val2,val3
		const [fieldRaw, valuesRaw] = clause.split(":");
		if (!valuesRaw) continue;
		const field = fieldRaw.toLowerCase().trim();
		const values = valuesRaw.split(",").map(v => v.trim()).filter(Boolean);

		for (const val of values) {
			const neg = val.startsWith("-");
			let value = val.replace(/^-/, "").replace(/^"|"$/g, "");
			filters.push({ field, value, neg });
		}
	}
	return filters;
}

// region filter logic
function matchesRegion(itemRegion, filters) {
	if (!Array.isArray(filters)) filters = [filters];

	for (const filter of filters) {
		const valRaw = filter.value.toLowerCase();
		const neg = filter.neg;

		// Special keywords
		if (["event","premium"].includes(valRaw)) {
			const inList = (valRaw === "event" ? eventRegions : premiumRegions).includes(itemRegion);
			if ((neg && inList) || (!neg && !inList)) return false;
			continue;
		}

		// Numeric comparison: <R07, >=R03, etc
		const m = valRaw.match(/^(<|>|<=|>=)?r(\d+)/i);
		if (m) {
			const op = m[1] || "=";
			const num = parseInt(m[2], 10);
			const itemNum = parseInt(itemRegion.match(/^R(\d+)/)?.[1] || 0, 10);
			if ((neg && compareValue(op, itemNum, num)) || (!neg && !compareValue(op, itemNum, num))) return false;
			continue;
		}

		// Exact / partial match
		const starts = itemRegion.toLowerCase().startsWith(valRaw);
		if ((neg && starts) || (!neg && !starts)) return false;
	}

	return true;
}

// main equipment matcher
function matchEquipment(name, info, filters) {
	for (const f of filters) {
		const v = f.value.toLowerCase();
		let matched = false;

		if (f.field === "xp") {
			const m = v.match(/^(<=|>=|<|>)?(.+)$/);
			if (!m) continue;
			const op = m[1] || "=";
			const num = parseNumber(m[2]);
			matched = compareValue(op, info.xp, num);
		}
		else if (f.field === "region") {
			matched = matchesRegion(info.region, [f]);
		}
		else if (f.field === "mat") {
			matched = info.mat && info.mat.some(([matName]) => {
				const nameLower = matName.toLowerCase();
				return f.neg ? nameLower === v : nameLower.includes(v);
			});
		}
		else if (f.field === "skill") {
			matched = info.skill && info.skill.some(([s]) => {
				const skillLower = s.toLowerCase();
				return f.neg ? skillLower === v : skillLower.includes(v);
			});
		}
		else if (["race", "source", "rarity", "type"].includes(f.field)) {
			const fieldVal = (info[f.field] || "").toLowerCase();
			matched = f.neg ? fieldVal === v : fieldVal.includes(v);
		}
		else if (f.field === "text") {
			const textVal = name.toLowerCase() + " " + (info.type || "").toLowerCase() + " " + (info.rarity || "").toLowerCase();
			matched = f.neg ? textVal.includes(v) : textVal.includes(v);
		}

		if (f.neg && matched) return false;
		if (!f.neg && !matched) return false;
	}

	return true;
}

// Search Builder
function createSearchUI() {
	const container = document.getElementById("equipment-selectors");

	const searchBox = document.createElement("input");
	searchBox.type = "text";
	searchBox.id = "equipmentSearch";
	searchBox.placeholder = "Search equipment...";
	container.appendChild(searchBox);

	const resultsDiv = document.createElement("div");
	resultsDiv.id = "searchResults";
	resultsDiv.style.border = "1px solid #ccc";
	resultsDiv.style.maxHeight = "200px";
	resultsDiv.style.overflowY = "auto";
	container.appendChild(resultsDiv);

	const equippedDiv = document.createElement("div");
	equippedDiv.id = "equippedList";
	container.appendChild(equippedDiv);

	searchBox.addEventListener("input", () => {
		const query = searchBox.value.trim();
		resultsDiv.innerHTML = "";
		if (!query) return;

		const filters = parseQuery(query);
		for (const [name, info] of Object.entries(equipmentData)) {
			if (matchEquipment(name, info, filters)) {
				const btn = document.createElement("button");
				btn.textContent = `${name} (${info.type})`;
				btn.addEventListener("click", () => equipItem(name, info.type));
				resultsDiv.appendChild(btn);
				resultsDiv.appendChild(document.createElement("br"));
			}
		}
	});
}

// Equip by selecting result
let equipped = {}; // { type: [names...] }

function equipItem(name, type) {
	if (!equipped[type]) equipped[type] = [];

	// prevent duplicates
	if (equipped[type].includes(name)) {
		alert(`${name} is already equipped in ${type}.`);
		return;
	}

	// single-slot types (always replace)
	if (type !== "Accessory" && type !== "Retainer") {
		equipped[type] = [name];
		updateEquippedList();
		updateSkills();
		return;
	}

	// multi-slot types (Accessory / Retainer)
	const max = 3;
	if (equipped[type].length < max) {
		// still room → just add
		equipped[type].push(name);
	} else {
		// already at max → ask user which slot to replace
		let current = equipped[type]
			.map((item, idx) => `${idx + 1}: ${item}`)
			.join("\n");

		let choice = prompt(
			`${type} slots are full.\nCurrently equipped:\n${current}\n\nEnter the slot number (1-${max}) to replace with ${name}, or Cancel to abort:`
		);

		if (!choice) return; // user pressed cancel
		let slot = parseInt(choice, 10);
		if (isNaN(slot) || slot < 1 || slot > max) {
			alert("Invalid slot number.");
			return;
		}

		// replace chosen slot
		equipped[type][slot - 1] = name;
	}

	updateEquippedList();
	updateSkills();
}

// Delete equipped list
function updateEquippedList() {
	const equippedDiv = document.getElementById("equippedList");
	equippedDiv.innerHTML = "<h3>Equipped</h3>";

	equipmentTypes.forEach(type => {
		if (equipped[type] && equipped[type].length > 0) {
			// handle multi-slot separately
			if (type === "Accessory" || type === "Retainer") {
				equipped[type].forEach((item, idx) => {
					const line = document.createElement("div");
					line.textContent = `${type} ${idx + 1}: ${item}`;

					// add remove button
					const removeBtn = document.createElement("button");
					removeBtn.textContent = "❌";
					removeBtn.style.marginLeft = "5px";
					removeBtn.addEventListener("click", () => {
						equipped[type].splice(idx, 1);
						updateEquippedList();
						updateSkills();
					});
					line.appendChild(removeBtn);

					equippedDiv.appendChild(line);
				});
			} else {
				// single-slot
				const line = document.createElement("div");
				line.textContent = `${type}: ${equipped[type][0]}`;

				const removeBtn = document.createElement("button");
				removeBtn.textContent = "❌";
				removeBtn.style.marginLeft = "5px";
				removeBtn.addEventListener("click", () => {
					equipped[type] = [];
					updateEquippedList();
					updateSkills();
				});
				line.appendChild(removeBtn);

				equippedDiv.appendChild(line);
			}
		} else {
			const line = document.createElement("div");
			line.textContent = `${type}: -`;
			equippedDiv.appendChild(line);
		}
	});
}

// === Collection Checkbox ===
const collOrder = [
	["1-1", "1-2", "1-3", "1-4", "1-5"],
	["2-1", "2-2", "2-3", "2-4", "2-5"],
	["3-1", "3-2", "3-3", "3-4", "3-5"],
	["4-1", "4-2", "4-3", "4-4", "4-5"],
	["5-1", "5-2", "5-3", "5-4", "5-5"],
	["6-1", "6-2", "6-3", "6-4", "6-5"],
	["7-1", "7-2", "7-3", "7-4", "7-5"],
	["8-1", "8-2", "8-3", "8-4", "8-5"],
	["9-1", "9-2", "9-3", "9-4", "9-5"],
	["10-1", "10-2", "10-3", "10-4", "10-5"],
	["E-1", "E-2"],
	["S-1", "S-2"],
	["1.3-1", "1.3-2", "1.3-3"],
	["2.3-1", "2.3-2", "2.3-3"],
	["D-1", "D-3", "D-5", "D-2", "D-4", "D-6"],
	["A-C", "A-K", "A-F"]
];

function createCollectionCheckboxes() {
	const container = document.getElementById("collection-selectors");

	for (const row of collOrder) {
		const rowDiv = document.createElement("div"); // one row

		for (const code of row) {
			if (!(code in collectionCodes)) {
				console.warn(`Warning: ${code} not found in collectionCodes`);
				continue;
			}

			const div = document.createElement("div");
			div.style.display = "inline-block"; // make them inline like a row

			const checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.id = "collection-" + code;
			checkbox.value = code;
			checkbox.addEventListener("change", updateSkills);

			const label = document.createElement("label");
			label.htmlFor = checkbox.id;
			label.textContent = code;

			div.appendChild(checkbox);
			div.appendChild(label);
			rowDiv.appendChild(div);
		}
		container.appendChild(rowDiv);
	}
}

// === Parse Value ===
function parseSkillValue(raw) {
	if (typeof raw === "number") return { type: "number", value: raw, unit: "" };
	if (typeof raw !== "string") return { type: "text", raw: String(raw) };

	const s = raw.trim();

	let m = s.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
	if (m) return { type: "percent", value: parseFloat(m[1]), unit: "%" };

	m = s.match(/^(-?\d+(?:\.\d+)?)\+$/);
	if (m) return { type: "plus", value: parseFloat(m[1]), unit: "+" };

	m = s.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
	if (m) return { type: "range", range: [parseFloat(m[1]), parseFloat(m[2])], raw: s };

	m = s.match(/^-?\d+(?:\.\d+)?$/);
	if (m) return { type: "number", value: parseFloat(s), unit: "" };

	return { type: "text", raw: s };
}

function formatTotal(total, unit) {
	if (total == null) return "";
	const num = Number.isInteger(total) ? total : Number(total.toFixed(2));
	return unit === "%" ? `${num}%` : `${num}`;
}

// === Skill Grouping ===
function addSkill(categoryMap, category, skillName, rawValue) {
	if (!categoryMap[category]) categoryMap[category] = {};
	if (!categoryMap[category][skillName]) {
		categoryMap[category][skillName] = { total: null, unit: "", parts: [] };
	}

	const entry = categoryMap[category][skillName];
	const parsed = parseSkillValue(rawValue);

	if (combinableSkills.has(skillName) &&
		(parsed.type === "number" || parsed.type === "percent" || parsed.type === "plus")) {

		const add = parsed.value;
		entry.total = (entry.total ?? 0) + add;
		if (parsed.type === "percent") entry.unit = "%";
		entry.parts.push(typeof rawValue === "string" ? rawValue : String(rawValue));
	} else {
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
				const totalText = formatTotal(data.total, data.unit);
				li.innerHTML = data.parts.length > 1 ?
					`${skill} ${totalText} (${data.parts.join(", ")})` :
					`${skill} ${totalText}`;
			} else {
				li.textContent = `${skill} ${data.parts.join(", ")}`;
			}
			ul.appendChild(li);
		}
		container.appendChild(ul);
	}
}

// Extract skill, Update skill list ===
function updateSkills() {
	const outputDiv = document.getElementById("skills-output");
	outputDiv.innerHTML = "";

	const chosenItems = [];

	// 1. Add equipped items (from search UI)
	equipmentTypes.forEach(type => {
		if (equipped[type] && equipped[type].length > 0) {
			equipped[type].forEach(name => chosenItems.push(name));
		}
	});

	// 2. Add checked collections
	for (const code of Object.keys(collectionCodes)) {
		const checkbox = document.getElementById("collection-" + code);
		if (checkbox && checkbox.checked) {
			chosenItems.push(collectionCodes[code]);
		}
	}

	// 3. Build full skill list
	const allSkillsWithValues = [];
	chosenItems.forEach(itemName => {
		const info = equipmentData[itemName] || collectionData[itemName];
		if (info && info.skill) {
			// Show item skills in "skills-output"
			const itemDiv = document.createElement("div");
			itemDiv.innerHTML = `<b>${itemName}</b><br>` +
				info.skill.map(s => `- ${s[0]} (${s[1]})`).join("<br>");
			outputDiv.appendChild(itemDiv);
			outputDiv.appendChild(document.createElement("br"));

			// Collect for summary
			info.skill.forEach(s => allSkillsWithValues.push([s[0], s[1]]));
		}
	});

	// 4. Render grouped summary
	renderSkillSummary(allSkillsWithValues);
}

// Toggle button to hide/unhide
function setupToggle(buttonId, targetId, showText, hideText, startHidden = false) {
	const btn = document.getElementById(buttonId);
	const target = document.getElementById(targetId);

	// Set initial state
	if (startHidden) {
		target.classList.add("hidden");
		btn.textContent = showText;
	} else {
		target.classList.remove("hidden");
		btn.textContent = hideText;
	}

	// Attach toggle event
	btn.addEventListener("click", () => {
		target.classList.toggle("hidden");
		if (target.classList.contains("hidden")) {
			btn.textContent = showText;
		} else {
			btn.textContent = hideText;
		}
	});
}

// ---------------------- SETUP STORAGE ----------------------
function saveSetup(name) {
	const setups = JSON.parse(localStorage.getItem("savedSetups") || "[]")

	// check if name already exists
	const existing = setups.find(s => s.name === name);
	if (existing) {
		const ok = confirm(`A setup with the name "${name}" already exists. Do you want to overwrite it?`);
		if (!ok) return; // user cancelled
	}

	// remove old entry if any
	const newSetups = setups.filter(s => s.name !== name);
	
	// === Save collections ===
	const collections = [];
	for (const code of Object.keys(collectionCodes)) {
		const cb = document.getElementById("collection-" + code);
		if (cb && cb.checked) collections.push(code); // store raw code, not display name
	}

	// === Save equipment ===
	const equipment = {};
	for (const [type, items] of Object.entries(equipped)) {
		if (type === "Retainer" || type === "Accessory") {
			// save each item with index
			(items || []).forEach((it, idx) => {
				if (it) equipment[`${type}-${idx + 1}`] = it;
			});
		} else {
			// other types store as array
			if (Array.isArray(items)) {
				equipment[type] = [...items];
			} else if (typeof items === "string") {
				equipment[type] = [items];
			} else {
				equipment[type] = [];
			}
		}
	}

	newSetups.push({ name, collections, equipment });
	localStorage.setItem("savedSetups", JSON.stringify(newSetups));
	refreshSavedSetups();
}

function loadSetup(name) {
	const setups = JSON.parse(localStorage.getItem("savedSetups") || "[]");
	const setup = setups.find(s => s.name === name);
	if (!setup) return;

	// === Restore collections ===
	document.querySelectorAll("#collection-selectors input[type=checkbox]").forEach(cb => {
		const code = cb.id.replace("collection-", "");
		cb.checked = setup.collections.includes(code);
	});

	// === Restore equipment ===
	equipped = {}; // reset
	for (const [type, items] of Object.entries(setup.equipment)) {
		// Ensure everything is stored as an array
		if (Array.isArray(items)) {
			equipped[type] = [...items]; 
		} else if (typeof items === "string") {
			equipped[type] = [items]; // wrap single string in array
		} else {
			equipped[type] = [];
		}
	}

	updateEquippedList();
	updateSkills();
}

function deleteSetup(name) {
	const setups = JSON.parse(localStorage.getItem("savedSetups") || "[]")
		.filter(s => s.name !== name);
	localStorage.setItem("savedSetups", JSON.stringify(setups));
	refreshSavedSetups();
}

function refreshSavedSetups() {
	const setups = JSON.parse(localStorage.getItem("savedSetups") || "[]");
	const select = document.getElementById("loadSetupSelect");
	select.innerHTML = setups.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
	if (setups.length > 0) select.value = setups[0].name;
}

// ---------------------- ACTIVE SETUP MANAGEMENT ----------------------
function exportToBattle() {
	// Save collections
	const collections = [];
	for (const code of Object.keys(collectionCodes)) {
		const cb = document.getElementById("collection-" + code);
		if (cb && cb.checked) collections.push(code);
	}

	// Save equipment
	const equipment = {};

	for (const [type, items] of Object.entries(equipped)) {
		if (type === "Retainer" || type === "Accessory") {
			// Use indexed keys to preserve order
			items.forEach((item, idx) => {
				equipment[`${type}-${idx + 1}`] = item;
			});
		} else if (Array.isArray(items)) {
			equipment[type] = [...items];
		} else if (typeof items === "string") {
			equipment[type] = [items];
		} else {
			equipment[type] = [];
		}
	}

	localStorage.setItem("activeSetup", JSON.stringify({ collections, equipment }));
	window.location.href = "battle.html";
}

// Battle -> Index
function importFromBattle() {
	const savedActiveSetup = localStorage.getItem("activeSetup");
	if (!savedActiveSetup) return;

	const setup = JSON.parse(savedActiveSetup);

	// Restore collections
	if (setup.collections) {
		for (const code of Object.keys(collectionCodes)) {
			const cb = document.getElementById("collection-" + code);
			if (cb) cb.checked = setup.collections.includes(code);
		}
	}

	// Restore equipment
	equipped = {}; // reset
	const tempAccessory = [];
	const tempRetainer = [];

	for (const [key, value] of Object.entries(setup.equipment)) {
		if (key.startsWith("Accessory-")) {
			if (value) tempAccessory.push(value);
		} else if (key.startsWith("Retainer-")) {
			if (value) tempRetainer.push(value);
		} else {
			// other equipment types stored as array
			if (Array.isArray(value)) {
				equipped[key] = [...value];
			} else if (typeof value === "string") {
				equipped[key] = [value];
			} else {
				equipped[key] = [];
			}
		}
	}

	if (tempAccessory.length) equipped["Accessory"] = tempAccessory;
	if (tempRetainer.length) equipped["Retainer"] = tempRetainer;

	updateEquippedList();
	updateSkills();
}

// ---------------------- DATA LOADING ----------------------
async function loadAllData() {
	const [equip, coll, codes, groups, combinables] = await Promise.all([
		fetch("equipment_list.json").then(r => r.json()),
		fetch("collection_list.json").then(r => r.json()),
		fetch("collection_codes.json").then(r => r.json()),
		fetch("skill_groups.json").then(r => r.json()),
		fetch("combinable_skills.json").then(r => r.json())
	]);

	equipmentData = equip;
	collectionData = coll;
	collectionCodes = codes;
	skillGroups = groups;
	combinableSkills = new Set(combinables);
}

// ---------------------- DOM READY ----------------------
document.addEventListener("DOMContentLoaded", async () => {

	// Setup toggles
	setupToggle("toggleSkillsOutputBtn", "skills-output", "Show Skills Output ▲", "Hide Skills Output ▼", true);
	setupToggle("toggleSkillsSummaryBtn", "skills-summary", "Show Skill Summary ▲", "Hide Skill Summary ▼", true);
	
	await loadAllData();  // ensure dropdowns exist
	

	// Create search function
	createSearchUI();

	createCollectionCheckboxes();

	// Auto-restore Active Setup
	importFromBattle();

	// Go to Battle button + Export Active Setup
	const goBtn = document.getElementById("goBattleBtn");
	if (goBtn) goBtn.addEventListener("click", exportToBattle);

	// Check All / Uncheck All collections
	const checkAllBtn = document.getElementById("checkAllCollections");
	if (checkAllBtn) checkAllBtn.addEventListener("click", () => {
		document.querySelectorAll("#collection-selectors input[type=checkbox]").forEach(cb => cb.checked = true);
		updateSkills();
	});

	const uncheckAllBtn = document.getElementById("uncheckAllCollections");
	if (uncheckAllBtn) uncheckAllBtn.addEventListener("click", () => {
		document.querySelectorAll("#collection-selectors input[type=checkbox]").forEach(cb => cb.checked = false);
		updateSkills();
	});

	// Save Setup Button
	const saveBtn = document.getElementById("saveSetupBtn");
	if (saveBtn) saveBtn.addEventListener("click", () => {
		const name = document.getElementById("setupName").value.trim();
		if (name) saveSetup(name);
	});

	// Load Setup Button
	const loadBtn = document.getElementById("loadSetupBtn");
	if (loadBtn) loadBtn.addEventListener("click", () => {
		const sel = document.getElementById("loadSetupSelect");
		if (sel.value) loadSetup(sel.value);
	});

	// Delete Setup Button
	const deleteBtn = document.getElementById("deleteSetupBtn");
	if (deleteBtn) deleteBtn.addEventListener("click", () => {
		const sel = document.getElementById("loadSetupSelect");
		const setupName = sel.value;
		if (!setupName) {
			alert("Please select a setup to delete.");
			return;
		}
		if (!confirm(`Delete setup "${setupName}"?`)) return;
		deleteSetup(setupName);
	});

	// Initialize saved setups dropdown
	refreshSavedSetups();
});


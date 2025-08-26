const equipmentTypes = [
	"Coin", "Bait", "Hex", "Weapon", "Head", "Chest", "Hands", "Feet",
	"Power", "Emblem", "Coffin", "Accessory", "Mount", "Retainer"
];

let equipmentData = {};
let collectionData = {};
let collectionCodes = {}; // shortCode → fullName mapping
let skillGroups = {};     // { GroupName: [skill, ...], ... }
let combinableSkills = new Set(); // filled from combinable_skills.json

// ---------------------- UI BUILDERS ----------------------
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
		checkbox.id = "collection-" + code;
		checkbox.value = code;
		checkbox.addEventListener("change", updateSkills);

		const label = document.createElement("label");
		label.htmlFor = checkbox.id;
		label.textContent = code;

		div.appendChild(checkbox);
		div.appendChild(label);
		container.appendChild(div);
	}
}

// ---------------------- PARSING HELPERS ----------------------
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

// ---------------------- SKILL GROUPING ----------------------
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

// ---------------------- MAIN LOGIC ----------------------
function updateSkills() {
	const outputDiv = document.getElementById("skills-output");
	outputDiv.innerHTML = "";

	const chosenItems = [];

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

	for (const code of Object.keys(collectionCodes)) {
		const checkbox = document.getElementById("collection-" + code);
		if (checkbox && checkbox.checked) chosenItems.push(collectionCodes[code]);
	}

	const allSkillsWithValues = [];
	chosenItems.forEach(itemName => {
		const info = equipmentData[itemName] || collectionData[itemName];
		if (info && info.skill) {
			const itemDiv = document.createElement("div");
			itemDiv.innerHTML = `<b>${itemName}</b><br>` +
				info.skill.map(s => `- ${s[0]} (${s[1]})`).join("<br>");
			outputDiv.appendChild(itemDiv);
			outputDiv.appendChild(document.createElement("br"));

			info.skill.forEach(s => allSkillsWithValues.push([s[0], s[1]]));
		}
	});

	renderSkillSummary(allSkillsWithValues);
}

// ---------------------- SETUP STORAGE ----------------------
function saveSetup(name) {
	const setups = JSON.parse(localStorage.getItem("savedSetups") || "[]")
		.filter(s => s.name !== name);

	const collections = [];
	for (const code of Object.keys(collectionCodes)) {
		const cb = document.getElementById("collection-" + code);
		if (cb && cb.checked) collections.push(collectionCodes[code]);
	}

	const equipment = [];
	equipmentTypes.forEach(type => {
		if (type === "Accessory" || type === "Retainer") {
			for (let i = 1; i <= 3; i++) {
				const sel = document.getElementById(`select-${type}-${i}`);
				if (sel && sel.value) equipment.push(sel.value);
			}
		} else {
			const sel = document.getElementById(`select-${type}`);
			if (sel && sel.value) equipment.push(sel.value);
		}
	});

	setups.push({ name, collections, equipment });
	localStorage.setItem("savedSetups", JSON.stringify(setups));
	refreshSavedSetups();
}

function loadSetup(name) {
	const setups = JSON.parse(localStorage.getItem("savedSetups") || "[]");
	const setup = setups.find(s => s.name === name);
	if (!setup) return;

	document.querySelectorAll("#collection-selectors input[type=checkbox]").forEach(cb => {
		cb.checked = setup.collections.includes(collectionCodes[cb.id.replace("collection-", "")]);
	});

	equipmentTypes.forEach(type => {
		if (type === "Accessory" || type === "Retainer") {
			for (let i = 1; i <= 3; i++) {
				const sel = document.getElementById(`select-${type}-${i}`);
				if (sel) {
					const matched = setup.equipment.find(e => Array.from(sel.options).some(o => o.value === e));
					sel.value = matched || "";
				}
			}
		} else {
			const sel = document.getElementById(`select-${type}`);
			if (sel) {
				const matched = setup.equipment.find(e => Array.from(sel.options).some(o => o.value === e));
				sel.value = matched || "";
			}
		}
	});

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

	equipmentTypes.forEach(type => {
		if (type === "Accessory" || type === "Retainer") {
			for (let i = 1; i <= 3; i++) createDropdown(type, i);
		} else {
			createDropdown(type);
		}
	});
	createCollectionCheckboxes();
	updateSkills();
}

// ---------------------- DOM READY ----------------------
document.addEventListener("DOMContentLoaded", () => {
	loadAllData();

	// Go to Battle button
	const goBtn = document.getElementById("goBattleBtn");
	if (goBtn) goBtn.addEventListener("click", () => {
		const collections = [];
		for (const code of Object.keys(collectionCodes)) {
			const cb = document.getElementById("collection-" + code);
			if (cb && cb.checked) collections.push(collectionCodes[code]);
		}

		const equipment = [];
		const retainers = [];
		equipmentTypes.forEach(type => {
			if (type === "Accessory") {
				for (let i = 1; i <= 3; i++) {
					const sel = document.getElementById(`select-${type}-${i}`);
					if (sel && sel.value) equipment.push(sel.value);
				}
			} else if (type === "Retainer") {
				for (let i = 1; i <= 3; i++) {
					const sel = document.getElementById(`select-${type}-${i}`);
					if (sel && sel.value) retainers.push(sel.value);
				}
			} else {
				const sel = document.getElementById(`select-${type}`);
				if (sel && sel.value) equipment.push(sel.value);
			}
		});

		localStorage.setItem("playerSetup", JSON.stringify({ collections, retainers, equipment }));
		window.location.href = "battle.html";
	});

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

	// Save Setup
	const saveBtn = document.getElementById("saveSetupBtn");
	if (saveBtn) saveBtn.addEventListener("click", () => {
		const name = document.getElementById("setupName").value.trim();
		if (name) saveSetup(name);
	});

	// Load Setup
	const loadBtn = document.getElementById("loadSetupBtn");
	if (loadBtn) loadBtn.addEventListener("click", () => {
		const sel = document.getElementById("loadSetupSelect");
		if (sel.value) loadSetup(sel.value);
	});

	// Delete Setup
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


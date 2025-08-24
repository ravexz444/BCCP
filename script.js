const equipmentTypes = [
	"Coin", "Bait", "Hex", "Weapon", "Head", "Chest", "Hands", "Feet",
	"Power", "Emblem", "Coffin", "Accessory", "Mount", "Retainer"
];

let equipmentData = {};
let collectionData = {};
let collectionCodes = {}; // shortCode → fullName mapping
let skillGroups = {};

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

	for (const [code, fullName] of Object.entries(collectionCodes)) {
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

	// Collect skills for summary
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
	
			// Collect name + value for summary
			info.skill.forEach(s => allSkillsWithValues.push([s[0], s[1]]));
		}
	});
	
	// Render grouped summary with totals
	renderSkillSummary(allSkillsWithValues);
}

function summarizeSkills(allSkillsWithValues) {
	let categoryMap = {};

	allSkillsWithValues.forEach(([skillName, value]) => {
		let placed = false;

		// Find which group the skill belongs to
		for (const [groupName, groupSkills] of Object.entries(skillGroups)) {
			if (groupSkills.includes(skillName)) {
				addSkill(categoryMap, groupName, skillName, value);
				placed = true;
				break;
			}
		}

		// If not found in any group → Other
		if (!placed) {
			addSkill(categoryMap, "Other", skillName, value);
		}
	});

	return categoryMap;
}

function renderSkillSummary(allSkillsWithValues) {
	const categoryMap = summarizeSkills(allSkillsWithValues);
	const container = document.getElementById("skills-summary");
	container.innerHTML = "";

	const header = document.createElement("h2");
	header.textContent = "Skill Summary";
	container.appendChild(header);

	for (const [category, skills] of Object.entries(categoryMap)) {
		const h3 = document.createElement("h3");
		h3.textContent = category;
		container.appendChild(h3);

		const ul = document.createElement("ul");

		for (const [skill, data] of Object.entries(skills)) {
			const li = document.createElement("li");

			if (data.parts.length > 1) {
				// Show total and breakdown
				li.innerHTML = `${skill} ${data.total}<br><span style="margin-left:1em">(${data.parts.join(", ")})</span>`;
			} else {
				li.textContent = `${skill} ${data.total}`;
			}

			ul.appendChild(li);
		}
		container.appendChild(ul);
	}
}

function addSkill(categoryMap, category, skillName, value) {
	if (!categoryMap[category]) categoryMap[category] = {};

	if (combinableSkills.has(skillName)) {
		if (!categoryMap[category][skillName]) {
			categoryMap[category][skillName] = { total: 0, parts: [] };
		}
		categoryMap[category][skillName].total += value;
		categoryMap[category][skillName].parts.push(value);
	} else {
		// for non-combinable just store normally
		if (!categoryMap[category][skillName]) {
			categoryMap[category][skillName] = { total: value, parts: [value] };
		} else {
			// if it appears twice but is not combinable, keep them separate
			categoryMap[category][skillName].parts.push(value);
		}
	}
}

for (let [category, skills] of Object.entries(categoryMap)) {
	console.log(category);
	for (let [skill, data] of Object.entries(skills)) {
		if (data.parts.length > 1) {
			console.log(`  ${skill} ${data.total}`);
			console.log(`    ${skill} ${data.parts.join(", ")}`);
		} else {
			console.log(`  ${skill} ${data.total}`);
		}
	}
}

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
	combinableSkills = new Set(combinables); // quick lookup

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

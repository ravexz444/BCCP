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

	// Display skills
	chosenItems.forEach(itemName => {
		let info = equipmentData[itemName] || collectionData[itemName];
		if (info && info.skill) {
			const itemDiv = document.createElement("div");
			itemDiv.innerHTML = `<b>${itemName}</b><br>` +
				info.skill.map(s => `- ${s[0]} (${s[1]})`).join("<br>");
			outputDiv.appendChild(itemDiv);
			outputDiv.appendChild(document.createElement("br"));
		}
	});
}

async function loadAllData() {
	const [equip, coll, codes, skgroup] = await Promise.all([
		fetch("equipment_list.json").then(r => r.json()),
		fetch("collection_list.json").then(r => r.json()),
		fetch("collection_codes.json").then(r => r.json()),
		fetch("skill_groups.json").then(r => r.json())
	]);

	equipmentData = equip;
	collectionData = coll;
	collectionCodes = codes;
	skillGroups = skgroup;

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

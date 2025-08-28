let equipmentData = {}; 
let collectionData = {}; 
let collectionCodes = {}; 
let enemiesData = {}; 
let retainersData = {}; 
let excludedSkills = []; 
let skillsDictionary = {}; 
let playerRetainers = []; // active retainers 
let enemyRetainers = [];

const MAX_LOG_LINES = 500;
const player = "player";
const player_race = "";
const elements = ["Ballistic", "Chaos", "Electric", "Fire", "Holy", "Ice", "Mystic", "Physical", "Poison", "Psychic", "Shadow", "All"];
const races = ["Abominable", "Archangel", "Bestial", "Corrupted", "Demonic", "Draconic","Eldritch", "Ethereal", "Lycan", "Necro", "Righteous", "Techno", "Vampiric", "Xeno"];

// ------------------ Load All Data ------------------
async function loadAllData() {
	const [
		equip, 
		coll,
		codes, 
		excluded, 
		dict, 
		enemies, 
		retainers,
		grim
	] = await Promise.all([
		fetch("equipment_list.json").then(r => r.json()),
		fetch("collection_list.json").then(r => r.json()),
		fetch("collection_codes.json").then(r => r.json()),
		fetch("excluded_skills.json").then(r => r.json()),
		fetch("skills_dictionary.json").then(r => r.json()),
		fetch("enemies_list.json").then(r => r.json()),
		fetch("retainers_list.json").then(r => r.json()),
		fetch("grimoire.json").then(r => r.json())
	]);

	equipment_list = equip;
	collection_list = coll;
	collection_codes = codes;
	excluded_skills = excluded;
	skills_dictionary = dict;
	enemies_list = enemies;
	retainers_list = retainers;
	grimoire = grim;

	// Build enemy selectors right after loading
	buildEnemySelectors();
}

// ------------------ List of Functions ------------------
// === Prepare enemies list in droplist ===
function buildEnemySelectors() {
	const container = document.getElementById("manualEnemySelector");
	container.innerHTML = ""; // clear old if reload

	// Heading - Manual
	const manualHeading = document.createElement("h3");
	manualHeading.textContent = "Manual Selector";
	container.appendChild(manualHeading);
	
	// --- Manual 10 selects ---
	for (let i = 0; i < 10; i++) {
		const select = document.createElement("select");
		select.id = `enemy${i + 1}`;
		select.classList.add("enemy-select");
		select.innerHTML = `<option value="">-- Select Enemy --</option>`;

		Object.keys(enemies_list).forEach(name => {
			const opt = document.createElement("option");
			opt.value = name;
			opt.textContent = name;
			select.appendChild(opt);
		});

		container.appendChild(select);
		container.appendChild(document.createElement("br"));
	}

	// Heading - Batch
	const batchHeading = document.createElement("h3");
	batchHeading.textContent = "Batch Selector";
	container.appendChild(batchHeading);
	
	// --- Batch selector ---
	const batchDiv = document.createElement("div");
	batchDiv.id = "batchEnemySelector";

	// Label - Type
	const typeLabel = document.createElement("label");
	typeLabel.htmlFor = "batchEnemyGroup";
	typeLabel.textContent = "Type: ";
	batchDiv.appendChild(typeLabel);

	// Enemy type select
	const typeSelect = document.createElement("select");
	typeSelect.id = "batchEnemyGroup";
	typeSelect.innerHTML = `
 		<option value="">-- Select Enemy Group --</option>
		<option value="nonBoss">Non-Boss</option>
		<option value="boss">Boss</option>
		<option value="all">All</option>
	`;
	batchDiv.appendChild(typeSelect);

	// Spacing
	batchDiv.appendChild(document.createTextNode(" "));
	
	// Label - Region
	const regionLabel = document.createElement("label");
	regionLabel.htmlFor = "batchEnemyRegion";
	regionLabel.textContent = "Region: ";
	batchDiv.appendChild(regionLabel);
	
	// Region select
	const regionSelect = document.createElement("select");
	regionSelect.id = "batchEnemyRegion";

	// First blank option
	const blankOpt = document.createElement("option");
	blankOpt.value = "";
	blankOpt.textContent = "-- Select Enemy Region --";
	regionSelect.appendChild(blankOpt);
	
	Object.keys(grimoire).forEach(region => {
		const opt = document.createElement("option");
		opt.value = region;
		opt.textContent = region;
		regionSelect.appendChild(opt);
	});
	batchDiv.appendChild(regionSelect);

	container.appendChild(document.createElement("br"));
	container.appendChild(batchDiv);
}

// Boss counts
const defaultBossCount = 6;
const specialBossCounts = {
	"RAA": 9,
	"RDD": 8
};

// Get enemies for region
function getEnemiesForRegion(region, type = "all") {
	const enemies = grimoire[region] || [];
	// Use special count if defined, else default
	const bossCount = specialBossCounts[region] ?? defaultBossCount;

	if (type === "nonBoss") {
		if (bossCount >= enemies.length) return []; // all bosses, no non-bosses
		return enemies.slice(0, enemies.length - bossCount);
	} else if (type === "boss") {
		return enemies.slice(enemies.length - bossCount);
	}
	// type === "all"
	return enemies;
}

// === Search skill for all equipments and collections ===
function init_setup(setup) {
	let player_skills = [];

	// --- Equipment skills ---
	for (let [slot, equipName] of Object.entries(setup.equipment || {})) {
		if (equipment_list[equipName]) {
			for (let skill of equipment_list[equipName].skill) {
				player_skills.push([skill[0], skill[1], skill[2]]);
			}
		}
	}

	// --- Collection skills ---
	for (let coll of setup.collections || []) {
		if (collection_list[coll]) {
			for (let skill of collection_list[coll].skill) {
				player_skills.push([skill[0], skill[1], skill[2]]);
			}
		}
	}

	// --- Retainers ---
	const eq = setup.equipment || {};
	const ret1 = eq["Retainer-1"] || "";
	const ret2 = eq["Retainer-2"] || "";
	const ret3 = eq["Retainer-3"] || "";
	
	return { player_skills, ret1, ret2, ret3 };
}

// === Parse skills' value ===
function parse_value(value) {
    try {
        if (typeof value === "number") {
            return value; // Already a number
        } else if (typeof value === "string") {
            value = value.replace(/\s+/g, ""); // Remove spaces

            // Case 1: Simple numbers ("3", "0.1")
            if (!value.includes("-") && !value.includes("%")) {
                let num = parseFloat(value);
                return Number.isInteger(num) ? parseInt(num) : num;
            }

            // Case 2: Percentage range ("3%-4%")
            if (value.includes("%") && value.includes("-")) {
                try {
                    let [low, high] = value.split("-").map(x => parseFloat(x.replace("%", "")) / 100);
                    return +(Math.random() * (high - low) + low).toFixed(4); // keep 4 decimals
                } catch (e) {
                    console.error(`Error parsing percentage range: ${value}`);
                    return 0;
                }
            }

            // Case 3: Single percentage ("10%")
            if (value.endsWith("%")) {
                return parseFloat(value.replace("%", "")) / 100;
            }

            // Case 4: Integer range ("4-6")
            if (value.includes("-") && !value.includes("%")) {
                let [low, high] = value.split("-").map(x => parseInt(x));
                return Math.floor(Math.random() * (high - low + 1)) + low;
            }
        }
    } catch (err) {
        console.error(`Error: Invalid value '${value}' in parse_value()`);
        return 0;
    }

    return 0; // Default return
}

// === Add retainer's skill to user's skill ===
function check_skills_list(user_skills, user_rets) {
    // Start with player's main skills
    let user_skills_list = [...user_skills]; // Copy list

    // Add retainer skills if their status is True
    for (let ret of user_rets) {
        if (ret) { // Ensure the retainer name is not empty
            let ret_skills = (retainers_list[ret] && retainers_list[ret]["skill"]) || [];
            user_skills_list.push(...ret_skills);
        }
    }

    return user_skills_list;
}

// === RNG check with Attunement ===
function check_proc(base_chance, attunement) { 
    let modified_chance = Math.min(1, base_chance + attunement);
    return Math.random() < modified_chance;
}

// === Calculate how many Evade, Flying, Dispel procs per Round ===
function calc_charges(skills_list, check_type, user_attunement) {  
    let calculated_charges = 0;

    for (let [name, value, prob] of skills_list) {
        let skill_type = (skills_dictionary[name] && skills_dictionary[name]["type"]) || null;

        if (skill_type === check_type) {
            if (check_proc(prob, user_attunement)) {
                calculated_charges += 1;
            }
        }
    }

    return calculated_charges;
}

// === Calculate damage based on elemental, racial, and general modifiers ===
function dmg_calc(name, damage, skill_element,
                  user_atk_elem_mod, user_atk_race_mod, opp_def_elem_mod, opp_def_race_mod,
                  user_race, opp_race, opp, opp_hp) {
	
	
	// Calc damage modifiers
	let dmg_mod = 1;
	if (user_atk_elem_mod["All"] !== 0 || opp_def_elem_mod["All"] !== 0) {
		dmg_mod += user_atk_elem_mod["All"] - opp_def_elem_mod["All"];
	}
	if (user_atk_elem_mod[skill_element] !== 0 || opp_def_elem_mod[skill_element] !== 0) {
		dmg_mod += user_atk_elem_mod[skill_element] - opp_def_elem_mod[skill_element];
	}
	if ((user_atk_race_mod[opp_race] || 0) !== 0 || (opp_def_race_mod[user_race] || 0) !== 0) {
		dmg_mod += (user_atk_race_mod[opp_race] || 0) - (opp_def_race_mod[user_race] || 0);
	}
	dmg_mod = Math.max(0.1, dmg_mod);

	// Calc damage
	let total_damage = Math.round(damage * dmg_mod);
	let offset_damage = Math.round(damage * (dmg_mod - 1));
	opp_hp -= total_damage;

	if (offset_damage === 0) {
		console.log(`${name} deals ${total_damage} ${skill_element} damage to ${opp}`);
	} else if (offset_damage > 0) {
		console.log(`${name} deals ${total_damage} ${skill_element} damage to ${opp} (${offset_damage} Increased) ${(dmg_mod * 100).toFixed(0)}%`);
	} else {
		console.log(`${name} deals ${total_damage} ${skill_element} damage to ${opp} (${offset_damage} Prevented) ${(dmg_mod * 100).toFixed(0)}%`);
	}

	return opp_hp; // Return updated opponent HP
}

// === Calculate heal based on healing modifiers ===
function heal_calc(name, heal_amount,
                  user_heal_mod,
                  user, user_hp) {
	

	// Heal damage modifiers
	let heal_mod = 1;
	heal_mod += user_heal_mod;
	heal_mod = Math.max(0.1, heal_mod);

	let total_heal = Math.round(heal_amount * heal_mod);
	let offset_heal = Math.round(heal_amount * (heal_mod - 1));
	user_hp += total_heal;

	if (offset_heal === 0) {
		console.log(`${name} healed ${user} for ${total_heal} HP`);
	} else if (offset_heal > 0) {
		console.log(`${name} healed ${user} for ${total_heal} HP (${offset_heal} Increased) ${(heal_mod * 100).toFixed(0)}%`);
	} else {
		console.log(`${name} healed ${user} for ${total_heal} HP (${offset_heal} Prevented) ${(heal_mod * 100).toFixed(0)}%`);
	}

	return user_hp; // Return updated user HP
}

// === Applies start-of-battle effects ===
function start_battle_effects(
	user_skills_list,
	user, user_hp, user_race, user_persistent_effects,
	opp, opp_hp, opp_race, opp_persistent_effects,
	user_heal_mod, user_atk_elem_mod, user_def_elem_mod, user_atk_race_mod, user_def_race_mod, user_proc_set,
	opp_heal_mod, opp_atk_elem_mod, opp_def_elem_mod, opp_atk_race_mod, opp_def_race_mod, opp_proc_set
) {

	// ---- Bane ----
	for (let [name, value, prob] of user_skills_list) {
		let skill_type = (skills_dictionary[name] || {}).type;
		if (skill_type === "Bane" && check_proc(prob, 0)) {
			let skill_element = (skills_dictionary[name] || {}).element;
			let skill_race = (skills_dictionary[name] || {}).race;
			let new_value = parse_value(value);

			if (skill_element) {
				user_atk_elem_mod[skill_element] += new_value;
				console.log(`${user} gained ${name} ${(new_value * 100).toFixed(0)}% (Total: Bonus ${user} ${skill_element} offense ${((user_atk_elem_mod[skill_element] - opp_def_elem_mod[skill_element]) * 100).toFixed(0)}%)`);
			} else {
				user_atk_race_mod[skill_race] += new_value;
				console.log(`${user} gained ${name} ${(new_value * 100).toFixed(0)}% (Total: Bonus ${user} ${skill_race} offense ${(user_atk_race_mod[skill_race] * 100).toFixed(0)}%)`);
			}
		}
	}

	// ---- Ward ----
	for (let [name, value, prob] of user_skills_list) {
		let skill_type = (skills_dictionary[name] || {}).type;
		if (skill_type === "Ward" && check_proc(prob, 0)) {
			let skill_element = (skills_dictionary[name] || {}).element;
			let skill_race = (skills_dictionary[name] || {}).race;
			let new_value = parse_value(value);

			if (skill_element) {
				user_def_elem_mod[skill_element] += new_value;
				console.log(`${user} gained ${name} ${(new_value * 100).toFixed(0)}% (Total: Bonus ${user} ${skill_element} defense ${((user_def_elem_mod[skill_element] - opp_atk_elem_mod[skill_element]) * 100).toFixed(0)}%)`);
			} else {
				user_def_race_mod[skill_race] += new_value;
				console.log(`${user} gained ${name} ${(new_value * 100).toFixed(0)}% (Total: Bonus ${user} ${skill_race} defense ${(user_def_race_mod[skill_race] * 100).toFixed(0)}%)`);
			}
		}
	}

	// ---- Vuln ----
	for (let [name, value, prob] of user_skills_list) {
		let skill_type = (skills_dictionary[name] || {}).type;
		if (skill_type === "Vuln" && check_proc(prob, 0)) {
			let skill_element = (skills_dictionary[name] || {}).element;
			let new_value = parse_value(value);
			user_def_elem_mod[skill_element] -= new_value;
			console.log(`${user} gained ${name} ${(new_value * 100).toFixed(0)}% (Total: Bonus ${user} ${skill_element} defense ${((user_def_elem_mod[skill_element] - opp_atk_elem_mod[skill_element]) * 100).toFixed(0)}%)`);
			user_persistent_effects["vulnerability"].push([name, new_value]);
		}
	}

	// ---- Ancient Blood ----
	for (let [name, value, prob] of user_skills_list) {
		let skill_type = (skills_dictionary[name] || {}).type;
		if (skill_type === "Ancient Blood" && check_proc(prob, 0)) {
			let new_value = parse_value(value);
			user_heal_mod += new_value;
			console.log(`${user} gained Ancient Blood ${(new_value * 100).toFixed(0)}% (Total: Bonus ${user} heal ${(user_heal_mod * 100).toFixed(0)}%)`);
		}
	}

	// ---- Necrosis ----
	for (let [name, value, prob] of user_skills_list) {
		let skill_type = (skills_dictionary[name] || {}).type;
		if (skill_type === "Necrosis" && check_proc(prob, 0)) {
			let new_value = parse_value(value);
			opp_heal_mod -= new_value;
			console.log(`${opp} gained Necrosis ${(new_value * 100).toFixed(0)}% (Total: Bonus ${opp} heal ${(opp_heal_mod * 100).toFixed(0)}%)`);
			user_persistent_effects["necrosis"].push([name, new_value]);
		}
	}

	// ---- Attunement ----
	let user_attunement = 0;
	for (let [name, value, prob] of user_skills_list) {
		let skill_type = (skills_dictionary[name] || {}).type;
		if (skill_type === "Attunement" && check_proc(prob, 0)) {
			let new_value = parse_value(value);
			user_attunement += new_value;
			console.log(`${user} gained Attunement ${(new_value * 100).toFixed(0)}% (Total: Bonus ${user} proc ${(user_attunement * 100).toFixed(0)}%)`);
		}
	}

	// ---- AoB ----
	for (let [name, value, prob] of user_skills_list) {
		let skill_type = (skills_dictionary[name] || {}).type;
		if (skill_type === "AoB" && check_proc(prob, user_attunement)) {
			let skill_element = (skills_dictionary[name] || {}).element;
			let new_value = parse_value(value);
			opp_hp = dmg_calc(
				name, new_value, skill_element,
				user_atk_elem_mod, user_atk_race_mod, opp_def_elem_mod, opp_def_race_mod,
				user_race, opp_race, opp, opp_hp
			);
		}
	}

	return [
		user_hp, user_persistent_effects, user_attunement,
		opp_hp, opp_persistent_effects,
		user_heal_mod, user_atk_elem_mod, user_def_elem_mod, user_atk_race_mod, user_def_race_mod, user_proc_set,
		opp_heal_mod, opp_atk_elem_mod, opp_def_elem_mod, opp_atk_race_mod, opp_def_race_mod, opp_proc_set
	];
}

// === Applies first-priority effects ===
function first_prio_effects(
	user_skills_list, opp_skills_list, opp_skills,
	user, user_hp, user_race, user_rets, user_persistent_effects, user_attunement,
	opp, opp_hp, opp_race, opp_rets, opp_persistent_effects,
	user_heal_mod, user_atk_elem_mod, user_def_elem_mod, user_atk_race_mod, user_def_race_mod, user_proc_set,
	opp_heal_mod, opp_atk_elem_mod, opp_def_elem_mod, opp_atk_race_mod, opp_def_race_mod, opp_proc_set,
	user_dispel_charges, opp_evade_charges, opp_flying_charges, stun_next_turn
) {

	// ---- Curse ----
	for (let [name, value, prob] of user_skills_list) {
		let skill_type = (skills_dictionary[name] || {}).type;
		if (skill_type === "Curse" && check_proc(prob, user_attunement)) {
			let effect_key = [name, value, prob];
			if (user_proc_set.has(JSON.stringify(effect_key))) continue;
			user_proc_set.add(JSON.stringify(effect_key));

			if (opp_evade_charges > 0) {
				opp_evade_charges -= 1;
				console.log(`${opp} evaded ${name}`);
			} else {
				let skill_element = (skills_dictionary[name] || {}).element;
				let new_value = parse_value(value);
				opp_persistent_effects["curse"].push([name, new_value]);
				opp_def_elem_mod[skill_element] -= new_value;
				console.log(`${opp} gained ${name} ${(new_value * 100).toFixed(0)}% (Total: Bonus ${opp} ${skill_element} defense ${((opp_def_elem_mod[skill_element] - user_atk_elem_mod[skill_element]) * 100).toFixed(0)}%)`);
			}
		}
	}

	// ---- Shield ----
	for (let [name, value, prob] of user_skills_list) {
		let skill_type = (skills_dictionary[name] || {}).type;
		if (skill_type === "Shield" && check_proc(prob, user_attunement)) {
			let effect_key = [name, value, prob];
			if (user_proc_set.has(JSON.stringify(effect_key))) continue;
			user_proc_set.add(JSON.stringify(effect_key));

			let skill_element = (skills_dictionary[name] || {}).element;
			let skill_race = (skills_dictionary[name] || {}).race;
			let new_value = parse_value(value);

			if (skill_element) {
				user_def_elem_mod[skill_element] += new_value;
				console.log(`${user} gained ${name} ${(new_value * 100).toFixed(0)}% (Total: Bonus ${user} ${skill_element} defense ${((user_def_elem_mod[skill_element] - opp_atk_elem_mod[skill_element]) * 100).toFixed(0)}%)`);
			} else {
				user_def_race_mod[skill_race] += new_value;
				console.log(`${user} gained ${name} ${(new_value * 100).toFixed(0)}% (Total: Bonus ${user} ${skill_race} defense ${(user_def_race_mod[skill_race] * 100).toFixed(0)}%)`);
			}
		}
	}

	// ---- Call Ret ----
	for (let [name, value, prob] of user_skills_list) {
		let skill_type = (skills_dictionary[name] || {}).type;
		if (skill_type === "Call Ret" && check_proc(prob, user_attunement)) {
			let effect_key = [name, value, prob];
			if (user_proc_set.has(JSON.stringify(effect_key))) continue;
			user_proc_set.add(JSON.stringify(effect_key));

			console.log(`Before : ${user_rets}`);
			console.log(`Before : ${JSON.stringify(user_skills_list)}`);

			let ret_called = (skills_dictionary[name] || {}).retainer;
			user_rets.push(ret_called);
			console.log(`${user} called ${ret_called} who joins the fight.`);

			let ret_skills = (retainers_list[ret_called] || {}).skill || [];
			user_skills_list = user_skills_list.concat(ret_skills);

			console.log(`After : ${user_rets}`);
			console.log(`After : ${JSON.stringify(user_skills_list)}`);
		}
	}

	// ---- Kill Ret ----
	for (let [name, value, prob] of user_skills_list) {
		let skill_type = (skills_dictionary[name] || {}).type;
		if (skill_type === "Kill Ret" && check_proc(prob, user_attunement)) {
			let effect_key = [name, value, prob];
			if (user_proc_set.has(JSON.stringify(effect_key))) continue;
			user_proc_set.add(JSON.stringify(effect_key));

			console.log(`Before : ${opp_rets}`);
			console.log(`Before : ${JSON.stringify(opp_skills_list)}`);

			let kill_retainers_charges = parse_value(value);
			if (kill_retainers_charges) {
				for (let i = 0; i < kill_retainers_charges; i++) {
					if (opp_rets.length > 0) {
						let removed_ret = opp_rets[Math.floor(Math.random() * opp_rets.length)];
						console.log(`${user} cast ${name} and killed ${opp}'s retainer: ${removed_ret}`);
						opp_rets = opp_rets.filter(r => r !== removed_ret);
					}
				}
			}

			opp_skills_list = check_skills_list(opp_skills, opp_rets);

			console.log(`After : ${opp_rets}`);
			console.log(`After : ${JSON.stringify(opp_skills_list)}`);
		}
	}

	// ---- StrInst ----
	for (let [name, value, prob] of user_skills_list) {
		let skill_type = (skills_dictionary[name] || {}).type;
		if (skill_type === "StrInst" && check_proc(prob, user_attunement)) {
			if (opp_evade_charges > 0) {
				opp_evade_charges -= 1;
				console.log(`${opp} evaded ${name}`);
			} else {
				let skill_element = (skills_dictionary[name] || {}).element;
				let new_value = parse_value(value);
				opp_hp = dmg_calc(
					name, new_value, skill_element,
					user_atk_elem_mod, user_atk_race_mod, opp_def_elem_mod, opp_def_race_mod,
					user_race, opp_race, opp, opp_hp
				);
			}
		}
	}

	return [
		user_skills_list, opp_skills_list,
		user_hp, user_persistent_effects, user_rets,
		opp_hp, opp_persistent_effects, opp_rets,
		user_heal_mod, user_atk_elem_mod, user_def_elem_mod, user_atk_race_mod, user_def_race_mod, user_proc_set,
		opp_heal_mod, opp_atk_elem_mod, opp_def_elem_mod, opp_atk_race_mod, opp_def_race_mod, opp_proc_set,
		user_dispel_charges, opp_evade_charges, opp_flying_charges, stun_next_turn
	];
}

// === Applies second-priority effects ===
function second_prio_effects(
    user_skills_list,
    user, user_hp, user_race, user_rets, user_persistent_effects, user_attunement,
    opp, opp_hp, opp_race, opp_rets, opp_persistent_effects,
    user_heal_mod, user_atk_elem_mod, user_def_elem_mod, user_atk_race_mod, user_def_race_mod, user_proc_set,
    opp_heal_mod, opp_atk_elem_mod, opp_def_elem_mod, opp_atk_race_mod, opp_def_race_mod, opp_proc_set,
    user_dispel_charges, opp_evade_charges, opp_flying_charges, stun_next_turn
) {
    let stun_cue = 0;

    // Inst
    for (let [name, value, prob] of user_skills_list) {
        let skill_type = skills_dictionary[name]?.type;
        if (skill_type === "Inst") {
            if (check_proc(prob, user_attunement)) {
                if (opp_evade_charges > 0) {
                    opp_evade_charges -= 1;
                    console.log(`${opp} evaded ${name}`);
                } else {
                    let skill_element = skills_dictionary[name]?.element;
                    let new_value = parse_value(value);
                    opp_hp = dmg_calc(name, new_value, skill_element,
                        user_atk_elem_mod, user_atk_race_mod, opp_def_elem_mod, opp_def_race_mod,
                        user_race, opp_race, opp, opp_hp);
                }
            }
        }
    }

    // DoT and StrDoT
    for (let [name, value, prob] of user_skills_list) {
        let skill_type = skills_dictionary[name]?.type;
        if (skill_type === "DoT" || skill_type === "StrDoT") {
            if (check_proc(prob, user_attunement)) {
                let effect_key = [name, value, prob];
                if (user_proc_set.has(JSON.stringify(effect_key))) continue;
                user_proc_set.add(JSON.stringify(effect_key));

                if (opp_evade_charges > 0) {
                    opp_evade_charges -= 1;
                    console.log(`${opp} evaded ${name}`);
                } else {
                    let new_value = parse_value(value);
                    opp_persistent_effects.dot.push([name, new_value]);
                }
            }
        }
    }

    // Apply DoT
    for (let [name, new_value] of opp_persistent_effects.dot) {
        let skill_element = skills_dictionary[name]?.element;
        opp_hp = dmg_calc(name, new_value, skill_element,
            user_atk_elem_mod, user_atk_race_mod, opp_def_elem_mod, opp_def_race_mod,
            user_race, opp_race, opp, opp_hp);
    }

    // Lifeleech
    for (let [name, value, prob] of user_skills_list) {
        let skill_type = skills_dictionary[name]?.type;
        if (skill_type === "Lifeleech") {
            if (check_proc(prob, user_attunement)) {
                if (opp_evade_charges > 0) {
                    opp_evade_charges -= 1;
                    console.log(`${opp} evaded ${name}`);
                } else {
                    let new_value = parse_value(value);
                    opp_hp -= new_value;
                    user_hp += new_value;
                    console.log(`${user} leeched ${new_value} blood from ${opp}. ${user} was healed for ${new_value}`);
                }
            }
        }
    }

    // Stun
    for (let [name, value, prob] of user_skills_list) {
        let skill_type = skills_dictionary[name]?.type;
        if (skill_type === "Stun") {
            if (check_proc(prob, user_attunement)) {
                if (opp_evade_charges > 0) {
                    opp_evade_charges -= 1;
                    console.log(`${opp} evaded ${name}`);
                } else {
                    stun_cue = 1;
                    console.log(`${opp} was stunned and won't attack on next turn`);
                }
            }
        }
    }

    // Retainer Weapon Damage
    for (let ret of user_rets) {
        let ret_race = retainers_list[ret]?.race || null;
        for (let [name, value, prob] of (retainers_list[ret]?.skill || [])) {
            let skill_type = skills_dictionary[name]?.type;
            if (skill_type === "RWpn") {
                let skill_element = skills_dictionary[name]?.element;
                let new_value = parse_value(value);
                opp_hp = dmg_calc(name, new_value, skill_element,
                    user_atk_elem_mod, user_atk_race_mod, opp_def_elem_mod, opp_def_race_mod,
                    ret_race, opp_race, opp, opp_hp);
            }
        }
    }

    // Crit chance
    let user_crit = false;
    let total_crit_chance = 0;
    for (let [name, value, prob] of user_skills_list) {
        if (skills_dictionary[name]?.type === "Crit") {
            total_crit_chance += parse_value(value);
        }
    }
    if (check_proc(total_crit_chance, 0)) {
        user_crit = true;
    }

    // Weapon Damage
    for (let [name, value, prob] of user_skills_list) {
        if (skills_dictionary[name]?.type === "Wpn") {
            if (stun_next_turn) {
                console.log(`${user} gained Stun. ${opp} is stunned for the next attack.`);
                stun_next_turn = false;
                continue;
            }
            if (opp_flying_charges > 0) {
                opp_flying_charges -= 1;
                console.log(`${user} attacked, but ${opp} dodged!`);
            } else {
                let skill_element = skills_dictionary[name]?.element;
                let new_value = parse_value(value);
                if (user_crit) {
                    console.log(`${user} deal CRITICAL strike!`);
                    new_value *= 1.5;
                }
                opp_hp = dmg_calc(name, new_value, skill_element,
                    user_atk_elem_mod, user_atk_race_mod, opp_def_elem_mod, opp_def_race_mod,
                    user_race, opp_race, opp, opp_hp);
            }
        }
    }

    // RaceInst
    for (let [name, value, prob] of user_skills_list) {
        if (skills_dictionary[name]?.type === "RaceInst") {
            let skill_race = skills_dictionary[name]?.race;
            if (skill_race === opp_race) {
                if (check_proc(prob, user_attunement)) {
                    if (opp_evade_charges > 0) {
                        opp_evade_charges -= 1;
                        console.log(`${opp} evaded ${name}`);
                    } else {
                        let skill_element = skills_dictionary[name]?.element;
                        let new_value = parse_value(value);
                        opp_hp = dmg_calc(name, new_value, skill_element,
                            user_atk_elem_mod, user_atk_race_mod, opp_def_elem_mod, opp_def_race_mod,
                            user_race, opp_race, opp, opp_hp);
                    }
                }
            }
        }
    }

    // RaceDoT
    for (let [name, value, prob] of user_skills_list) {
        if (skills_dictionary[name]?.type === "RaceDoT") {
            let skill_race = skills_dictionary[name]?.race;
            if (skill_race === opp_race) {
                if (check_proc(prob, user_attunement)) {
                    let effect_key = [name, value, prob];
                    if (user_proc_set.has(JSON.stringify(effect_key))) continue;
                    user_proc_set.add(JSON.stringify(effect_key));

                    if (opp_evade_charges > 0) {
                        opp_evade_charges -= 1;
                        console.log(`${opp} evaded ${name}`);
                    } else {
                        let new_value = parse_value(value);
                        opp_persistent_effects.racedot.push([name, new_value]);
                    }
                }
            }
        }
    }

    // Apply RaceDoT
    for (let [name, new_value] of opp_persistent_effects.racedot) {
        let skill_element = skills_dictionary[name]?.element;
        opp_hp = dmg_calc(name, new_value, skill_element,
            user_atk_elem_mod, user_atk_race_mod, opp_def_elem_mod, opp_def_race_mod,
            user_race, opp_race, opp, opp_hp);
    }

    // Apply Stun at end
    if (stun_cue === 1) {
        stun_next_turn = true;
        stun_cue = 0;
    }

    return [
        user_hp, user_persistent_effects,
        opp_hp, opp_persistent_effects,
        user_heal_mod, user_atk_elem_mod, user_def_elem_mod, user_atk_race_mod, user_def_race_mod, user_proc_set,
        opp_heal_mod, opp_atk_elem_mod, opp_def_elem_mod, opp_atk_race_mod, opp_def_race_mod, opp_proc_set,
        user_dispel_charges, opp_evade_charges, opp_flying_charges, stun_next_turn
    ];
}

// === Applies third-priority effects ===
function third_prio_effects(
    user_skills_list,
    user, user_hp, user_race, user_rets, user_persistent_effects, user_attunement,
    opp, opp_hp, opp_race, opp_rets, opp_persistent_effects,
    user_heal_mod, user_atk_elem_mod, user_def_elem_mod, user_atk_race_mod, user_def_race_mod, user_proc_set,
    opp_heal_mod, opp_atk_elem_mod, opp_def_elem_mod, opp_atk_race_mod, opp_def_race_mod, opp_proc_set,
    user_dispel_charges, opp_evade_charges, opp_flying_charges, stun_next_turn
) {

    // Heal
    for (let [name, value, prob] of user_skills_list) {
        let skill_type = (skills_dictionary[name] || {}).type;
        if (skill_type === "Heal") {
            if (check_proc(prob, user_attunement)) {
                let new_value = parse_value(value);
                user_hp = heal_calc(name, new_value,
                    user_heal_mod,
                    user, user_hp
                );
            }
        }
    }

    // HoT
    for (let [name, value, prob] of user_skills_list) {
        let skill_type = (skills_dictionary[name] || {}).type;
        if (skill_type === "HoT") {
            if (check_proc(prob, user_attunement)) {
                let effect_key = [name, value, prob].toString();
                if (user_proc_set.has(effect_key)) {
                    continue;
                }
                user_proc_set.add(effect_key);

                let new_value = parse_value(value);
                opp_persistent_effects.hot.push([name, new_value]);
            }
        }
    }

    // Apply HoT
    for (let [name, new_value] of opp_persistent_effects.hot) {
        user_hp = heal_calc(name, new_value,
            user_heal_mod,
            user, user_hp
        );
    }

    // Dispel logic
    if (user_dispel_charges) {
        for (let i = 0; i < user_dispel_charges; i++) {
            if (user_persistent_effects.dot.length > 0 || user_persistent_effects.racedot.length > 0) {
                let combined_dots = [
                    ...user_persistent_effects.dot.map(dot => ["dot", dot]),
                    ...user_persistent_effects.racedot.map(dot => ["racedot", dot])
                ];
                if (combined_dots.length > 0) {
                    let removed = combined_dots[Math.floor(Math.random() * combined_dots.length)];
                    let removed_source = removed[0];
                    let removed_proc = removed[1];
                    console.log(`${user} gained Dispel and removed ${removed_proc[0]} (${removed_proc[1]})`);
                    let idx = user_persistent_effects[removed_source].indexOf(removed_proc);
                    if (idx > -1) {
                        user_persistent_effects[removed_source].splice(idx, 1);
                    }
                }
            } else if (user_persistent_effects.curse.length > 0 || user_persistent_effects.vulnerability.length > 0) {
                console.log(`${user} gained Dispel and remove All curses`);
                user_persistent_effects.curse = [];
                user_persistent_effects.vulnerability = [];
            } else if (user_persistent_effects.necrosis.length > 0) {
                let removed_proc = user_persistent_effects.necrosis[Math.floor(Math.random() * user_persistent_effects.necrosis.length)];
                console.log(`${user} gained Dispel and removed ${removed_proc[0]} (${removed_proc[1]})`);
                let idx = user_persistent_effects.necrosis.indexOf(removed_proc);
                if (idx > -1) {
                    user_persistent_effects.necrosis.splice(idx, 1);
                }
            }
        }
    }

    return [
        user_hp, user_persistent_effects,
        opp_hp, opp_persistent_effects,
        user_heal_mod, user_atk_elem_mod, user_def_elem_mod, user_atk_race_mod, user_def_race_mod, user_proc_set,
        opp_heal_mod, opp_atk_elem_mod, opp_def_elem_mod, opp_atk_race_mod, opp_def_race_mod, opp_proc_set,
        user_dispel_charges, opp_evade_charges, opp_flying_charges, stun_next_turn
    ];
}

// ------------------ Simulate Single Battle ------------------
function simulate_battle(enemy, player_skills, player_ret1, player_ret2, player_ret3) {
    // Prepare for new battle
    let enemy_maxhp = (enemies_list[enemy] || {}).maxhp || 0;
    let enemy_race = (enemies_list[enemy] || {}).race || "";
    let enemy_skills = (enemies_list[enemy] || {}).skill || [];

    // Initialize dictionaries with zero values
    let player_atk_elem_mod = {};
    let player_def_elem_mod = {};
    let enemy_atk_elem_mod = {};
    let enemy_def_elem_mod = {};
    let player_atk_race_mod = {};
    let player_def_race_mod = {};
    let enemy_atk_race_mod = {};
    let enemy_def_race_mod = {};
    for (let elem of elements) {
        player_atk_elem_mod[elem] = 0;
        player_def_elem_mod[elem] = 0;
        enemy_atk_elem_mod[elem] = 0;
        enemy_def_elem_mod[elem] = 0;
    }
    for (let race of races) {
        player_atk_race_mod[race] = 0;
        player_def_race_mod[race] = 0;
        enemy_atk_race_mod[race] = 0;
        enemy_def_race_mod[race] = 0;
    }
    let player_heal_mod = 0;
    let enemy_heal_mod = 0;

    // Initialize variables
    // 1. To make sure only occur once a battle
    let player_proc_set = new Set();
    let enemy_proc_set = new Set();

    // 2. So you can Dispel it, remove it one by one
    let enemy_persistent_effects = { vulnerability: [], necrosis: [], curse: [], dot: [], racedot: [], hot: [] };
    let player_persistent_effects = { vulnerability: [], necrosis: [], curse: [], dot: [], racedot: [], hot: [] };

    // 3. Recall initial retainers
    let player_rets = [player_ret1, player_ret2, player_ret3];
    for (let name of player_rets) {
        if (name !== "" && !(name in retainers_list)) {
            console.log(`Error: Retainers ${name} not found in database!`);
            throw new Error("Execution stopped"); // sys.exit() equivalent
        }
    }

    let enemy_ret1 = (enemies_list[enemy] || {}).ret1 || "";
    let enemy_ret2 = (enemies_list[enemy] || {}).ret2 || "";
    let enemy_ret3 = (enemies_list[enemy] || {}).ret3 || "";
    let enemy_rets = [enemy_ret1, enemy_ret2, enemy_ret3];

    console.log(" ");
    console.log("=========================================================================");
    console.log(`Initial ${player}'s Ret: ${player_rets}`);
    console.log(`Initial ${enemy}'s Ret: ${enemy_rets}`);

    // 4. Add retainers' skills
    let player_skills_list = check_skills_list(player_skills, player_rets);
    let enemy_skills_list = check_skills_list(enemy_skills, enemy_rets);
    console.log(`Initial ${player}'s skills: ${player_skills_list}`);
    console.log(`Initial ${enemy}'s skills: ${enemy_skills_list}`);

    console.log(`Before filter, ${player}'s skills: ${player_skills_list}`);

    // 5. Filter combat skill and calculate max hp
    let player_maxhp = 0;
    let filtered_skills = [];
    for (let skill of player_skills_list) {
        let [name, value, proc] = skill;
        if (excluded_skills.includes(name)) {
            if (name === "Health") {
                let hp_value = parseInt(value.split("+")[0], 10); // e.g. "225+" → 225
                player_maxhp += hp_value;
            }
            // skip adding excluded skills
        } else {
            filtered_skills.push(skill);
        }
    }
    player_skills_list = filtered_skills;
    console.log(`After filter, ${player}'s skills: ${player_skills_list}`);

    // 6. Restore both HP
    let player_hp = player_maxhp;
    let enemy_hp = enemy_maxhp;

    // 7. Determine who acts first
    let player_turn = false;
    for (let [name, value, proc] of player_skills_list) {
        if (name === "First Strike") {
            player_turn = true;
        }
    }

    console.log("=========================================================================");
    console.log(`New Battle, Start: Player HP = ${player_hp}, Enemy HP = ${enemy_hp}`);
    if (player_turn) {
        console.log("Player starts first");
    } else {
        console.log("Enemy starts first");
    }
    console.log("=========================================================================");
    console.log(" ");

    // ================================
    // Skills applied at battle start
    // ================================
    for (let round_num = 0; round_num < 1; round_num++) {
        // Beginning of battle effects
        for (let i = 1; i < 3; i++) {
            if (player_turn) {
                // Player acts first
                [
                    player_hp, player_persistent_effects, player_attunement,
                    enemy_hp, enemy_persistent_effects,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set
                ] = start_battle_effects(
                    player_skills_list,
                    player, player_hp, player_race, player_persistent_effects,
                    enemy, enemy_hp, enemy_race, enemy_persistent_effects,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set
                );
                console.log(`Round = ${round_num}, After player attack: Player HP = ${player_hp}, Enemy HP = ${enemy_hp}`);
            } else {
                // Enemy acts first
                [
                    enemy_hp, enemy_persistent_effects, enemy_attunement,
                    player_hp, player_persistent_effects,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set
                ] = start_battle_effects(
                    enemy_skills_list,
                    enemy, enemy_hp, enemy_race, enemy_persistent_effects,
                    player, player_hp, player_race, player_persistent_effects,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set
                );
                console.log(`Round = ${round_num}, After enemy attack: Player HP = ${player_hp}, Enemy HP = ${enemy_hp}`);
            }

            // Check for win/loss
            if (player_hp <= 0) return ["Loss", round_num];
            if (enemy_hp <= 0) return ["Win", round_num];

            player_turn = !player_turn;
        }
    }

    let stun_cue = 0;
    let stun_next_turn = false;

    for (let round_num = 1; round_num < 6; round_num++) {
		// Count charges
		let player_evade_charges = calc_charges(player_skills_list, "Evade", player_attunement);
		let enemy_evade_charges = calc_charges(enemy_skills_list, "Evade", enemy_attunement);
		let player_dispel_charges = calc_charges(player_skills_list, "Dispel", player_attunement);
		let enemy_dispel_charges = calc_charges(enemy_skills_list, "Dispel", enemy_attunement);
		let player_flying_charges = calc_charges(player_skills_list, "Flying", player_attunement);
		let enemy_flying_charges = calc_charges(enemy_skills_list, "Flying", enemy_attunement);

        // ================================
        // First priority (Curse, Shield, Call Ret, Kill Ret, StrInst)
        // ================================
        for (let i = 1; i < 3; i++) {
            if (player_turn) {
                // Player acts first
                [
                    player_skills_list, enemy_skills_list,
                    player_hp, player_persistent_effects, player_rets,
                    enemy_hp, enemy_persistent_effects, enemy_rets,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_dispel_charges, enemy_evade_charges, enemy_flying_charges, stun_next_turn
                ] = first_prio_effects(
                    player_skills_list, enemy_skills_list, enemy_skills,
                    player, player_hp, player_race, player_rets, player_persistent_effects, player_attunement,
                    enemy, enemy_hp, enemy_race, enemy_rets, enemy_persistent_effects,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_dispel_charges, enemy_evade_charges, enemy_flying_charges, stun_next_turn
                );
                console.log(`Round = ${round_num}, After player attack: Player HP = ${player_hp}, Enemy HP = ${enemy_hp}`);
            } else {
                // Enemy acts first
                [
                    enemy_skills_list, player_skills_list,
                    enemy_hp, enemy_persistent_effects, enemy_rets,
                    player_hp, player_persistent_effects, player_rets,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_dispel_charges, player_evade_charges, player_flying_charges, stun_next_turn
                ] = first_prio_effects(
                    enemy_skills_list, player_skills_list, player_skills,
                    enemy, enemy_hp, enemy_race, enemy_rets, enemy_persistent_effects, enemy_attunement,
                    player, player_hp, player_race, player_rets, player_persistent_effects,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_dispel_charges, player_evade_charges, player_flying_charges, stun_next_turn
                );
                console.log(`Round = ${round_num}, After enemy attack: Player HP = ${player_hp}, Enemy HP = ${enemy_hp}`);
            }

            if (player_hp <= 0) return ["Loss", round_num];
            if (enemy_hp <= 0) return ["Win", round_num];
            player_turn = !player_turn;
        }

        // ================================
        // Second priority (Inst, DoT, etc.)
        // ================================
        for (let i = 1; i < 3; i++) {
            if (player_turn) {
                [
                    player_hp, player_persistent_effects,
                    enemy_hp, enemy_persistent_effects,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_dispel_charges, enemy_evade_charges, enemy_flying_charges, stun_next_turn
                ] = second_prio_effects(
                    player_skills_list,
                    player, player_hp, player_race, player_rets, player_persistent_effects, player_attunement,
                    enemy, enemy_hp, enemy_race, enemy_rets, enemy_persistent_effects,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_dispel_charges, enemy_evade_charges, enemy_flying_charges, stun_next_turn
                );
                console.log(`Round = ${round_num}, After player attack: Player HP = ${player_hp}, Enemy HP = ${enemy_hp}`);
            } else {
                [
                    enemy_hp, enemy_persistent_effects,
                    player_hp, player_persistent_effects,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_dispel_charges, player_evade_charges, player_flying_charges, stun_next_turn
                ] = second_prio_effects(
                    enemy_skills_list,
                    enemy, enemy_hp, enemy_race, enemy_rets, enemy_persistent_effects, enemy_attunement,
                    player, player_hp, player_race, player_rets, player_persistent_effects,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_dispel_charges, player_evade_charges, player_flying_charges, stun_next_turn
                );
                console.log(`Round = ${round_num}, After enemy attack: Player HP = ${player_hp}, Enemy HP = ${enemy_hp}`);
            }

            if (player_hp <= 0) return ["Loss", round_num];
            if (enemy_hp <= 0) return ["Win", round_num];
            player_turn = !player_turn;
        }

        // ================================
        // Third priority (Heal, HoT, Dispel)
        // ================================
        for (let i = 1; i < 3; i++) {
            if (player_turn) {
                [
                    player_hp, player_persistent_effects,
                    enemy_hp, enemy_persistent_effects,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_dispel_charges, enemy_evade_charges, enemy_flying_charges, stun_next_turn
                ] = third_prio_effects(
                    player_skills_list,
                    player, player_hp, player_race, player_rets, player_persistent_effects, player_attunement,
                    enemy, enemy_hp, enemy_race, enemy_rets, enemy_persistent_effects,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_dispel_charges, enemy_evade_charges, enemy_flying_charges, stun_next_turn
                );
                console.log(`Round = ${round_num}, After player attack: Player HP = ${player_hp}, Enemy HP = ${enemy_hp}`);
            } else {
                [
                    enemy_hp, enemy_persistent_effects,
                    player_hp, player_persistent_effects,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_dispel_charges, player_evade_charges, player_flying_charges, stun_next_turn
                ] = third_prio_effects(
                    enemy_skills_list,
                    enemy, enemy_hp, enemy_race, enemy_rets, enemy_persistent_effects, enemy_attunement,
                    player, player_hp, player_race, player_rets, player_persistent_effects,
                    enemy_heal_mod, enemy_atk_elem_mod, enemy_def_elem_mod, enemy_atk_race_mod, enemy_def_race_mod, enemy_proc_set,
                    player_heal_mod, player_atk_elem_mod, player_def_elem_mod, player_atk_race_mod, player_def_race_mod, player_proc_set,
                    enemy_dispel_charges, player_evade_charges, player_flying_charges, stun_next_turn
                );
                console.log(`Round = ${round_num}, After enemy attack: Player HP = ${player_hp}, Enemy HP = ${enemy_hp}`);
            }

            if (player_hp <= 0) return ["Loss", round_num];
            if (enemy_hp <= 0) return ["Win", round_num];
            player_turn = !player_turn;
        }
    }

    return ["Draw", 5]; // No one dies, draw after 5 rounds
}

// ------------------ Battle Summary ------------------
// Running multiple simulations and tracking rounds
// enemiesList: array of enemy names
function estimate_winrate(player_skills, ret1, ret2, ret3, n, enemiesList) {
	let summary = [];

	for (let enemy of enemiesList) {
		let results = { "Win": [], "Draw": [], "Loss": [] };

		for (let i = 0; i < n; i++) {
			let [result, round_num] = simulate_battle(enemy, player_skills, ret1, ret2, ret3);
			results[result].push(round_num);
		}

		summary.push(""); // Blank line
		summary.push(`Enemy: ${enemy}`);
		summary.push(`Win Rate: ${(results["Win"].length / n * 100).toFixed(2)}% (${results["Win"].length})`);
		summary.push(`Draw Rate: ${(results["Draw"].length / n * 100).toFixed(2)}% (${results["Draw"].length})`);
		summary.push(`Loss Rate: ${(results["Loss"].length / n * 100).toFixed(2)}% (${results["Loss"].length})`);

		if (results["Win"].length > 0) {
			let avgWin = results["Win"].reduce((a, b) => a + b, 0) / results["Win"].length;
			summary.push(`Average Win Round: ${avgWin.toFixed(2)}`);
		}
		if (results["Loss"].length > 0) {
			let avgLoss = results["Loss"].reduce((a, b) => a + b, 0) / results["Loss"].length;
			summary.push(`Average Loss Round: ${avgLoss.toFixed(2)}`);
		}
	}

	// Print summary and update logDiv
	console.log(summary.join("\n"));
	const logDiv = document.getElementById("battle-log");
	logDiv.innerText = summary.join("\n");
}

// ------------------ Toggle button to hide/unhide ------------------
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

// ------------------ Enemy Selector Storage ------------------
function saveBattle(name) {
	const battles = JSON.parse(localStorage.getItem("savedBattles") || "[]")

	// Check if a battle with this name already exists
	if (battles.some(b => b.name === name)) {
		if (!confirm(`A battle setup named "${name}" already exists. Overwrite?`)) {
			return; // cancel save
		}
	}

	// Remove old entry if it exists
	const newBattles = battles.filter(b => b.name !== name);

	const selectors = document.querySelectorAll(".enemy-select");
	const manualEnemies = Array.from(selectors)
		.map(sel => sel.value)
		.filter(v => v !== "");

	const batchGroup = document.getElementById("batchEnemyGroup").value;
	const batchRegion = document.getElementById("batchEnemyRegion").value;

	const n = parseInt(document.getElementById("simulations").value, 10) || 1;

	newBattles.push({
		name,
		manualEnemies,
		batchGroup,
		batchRegion,
		simulations: n
	});

	localStorage.setItem("savedBattles", JSON.stringify(newBattles));
	refreshSavedBattles();
}

function loadBattle(name) {
	const battles = JSON.parse(localStorage.getItem("savedBattles") || "[]");
	const battle = battles.find(b => b.name === name);
	if (!battle) return;

	// Manual enemies
	const selectors = document.querySelectorAll(".enemy-select");
	selectors.forEach((sel, i) => {
		sel.value = battle.manualEnemies[i] || "";
	});

	// Batch selection
	document.getElementById("batchEnemyGroup").value = battle.batchGroup;
	document.getElementById("batchEnemyRegion").value = battle.batchRegion;

	// Number of simulations
	document.getElementById("simulations").value = battle.simulations;
}

function deleteBattle(name) {
	const battles = JSON.parse(localStorage.getItem("savedBattles") || "[]")
		.filter(b => b.name !== name);
	localStorage.setItem("savedBattles", JSON.stringify(battles));
	refreshSavedBattles();
}

function refreshSavedBattles() {
	const select = document.getElementById("loadBattleSelect");
	const battles = JSON.parse(localStorage.getItem("savedBattles") || "[]");
	select.innerHTML = battles.map(b => `<option value="${b.name}">${b.name}</option>`).join("");
	if (battles.length > 0) select.value = battles[0].name;
}

// ------------------ Load up to 3 active setups ------------------
function loadActiveSetups() {
	const setups = [];
	for (let i = 1; i <= 3; i++) {
		const setup = localStorage.getItem(`activeSetup-${i}`);
		if (setup) setups.push(JSON.parse(setup));
	}
	return setups;
}

// ------------------ Main ------------------
document.addEventListener("DOMContentLoaded", async () => {
	// Setup toggles
	setupToggle("toggleSetupBtn", "setup-log", "Show Setup ▲", "Hide Setup ▼", true);
	
	await loadAllData();

	// Build enemy selectors (manual + batch)
	buildEnemySelectors();

	const activeSetups = loadActiveSetups(); // array of setups
	const setupsWithSkills = activeSetups.map(setup => init_setup(setup));

	// Show chosen setup in log
	const logDiv = document.getElementById("setup-log");
	logDiv.innerHTML = activeSetups.map((setup, idx) => {
		const { player_skills, ret1, ret2, ret3 } = setupsWithSkills[idx];
		const equipmentList = Object.entries(setup.equipment || {})
			.map(([slot, item]) => `<li>${slot}: ${item || "None"}</li>`).join("");
		const collectionsList = (setup.collections || []).join(", ") || "None";
		const retainersList = [ret1, ret2, ret3].filter(r => r).join(", ") || "None";
	
		return `<p><b>Setup ${idx + 1}:</b></p>
		<ul>${equipmentList}</ul>
		<p><b>Collections:</b> ${collectionsList}</p>
		<p><b>Retainers:</b> ${retainersList}</p>
		<h3>Skills:</h3>
		<ul>${player_skills.map(s => `<li>${s[0]} [${s[1]}, ${s[2]}]</li>`).join("")}</ul>`;
	}).join("<hr>");

	// Button to go back to index.html
	document.getElementById("setupBtn").addEventListener("click", () => {
		window.location.href = "index.html";
	});

	document.getElementById("saveBattleBtn").addEventListener("click", () => {
		const name = document.getElementById("battleName").value.trim();
		if (name) saveBattle(name);
	});
	
	document.getElementById("loadBattleBtn").addEventListener("click", () => {
		const sel = document.getElementById("loadBattleSelect");
		if (sel.value) loadBattle(sel.value);
	});
	
	document.getElementById("deleteBattleBtn").addEventListener("click", () => {
		const sel = document.getElementById("loadBattleSelect");
		if (!sel.value) return alert("Select a saved battle first.");
		if (!confirm(`Delete saved battle "${sel.value}"?`)) return;
		deleteBattle(sel.value);
	});
	
	refreshSavedBattles();
	
	document.getElementById("battleBtn").addEventListener("click", () => {
		const n = parseInt(document.getElementById("simulations").value, 10) || 1;

		// --- Manual 10 enemies ---
		const selectors = document.querySelectorAll(".enemy-select");
		const selectedEnemies = Array.from(selectors)
			.map(sel => sel.value)
			.filter(v => v !== "");

		// --- Batch-selected enemies ---
		const batchGroup = document.getElementById("batchEnemyGroup").value;
		const batchRegion = document.getElementById("batchEnemyRegion").value;
		const batchEnemies = getEnemiesForRegion(batchRegion, batchGroup);

		// --- Combine both lists (unique) ---
		const enemiesList = [...new Set([...selectedEnemies, ...batchEnemies])];
		console.log("MEnemies List:", selectedEnemies);
		console.log("BEnemies List:", batchEnemies);
		console.log("Enemies List:", enemiesList);

		if (enemiesList.length === 0) {
			alert("Please select at least one enemy.");
			return;
		}

		logDiv.innerText = ""; // reset log

		// --- Run battle simulations for each active setup ---
		setupsWithSkills.forEach((setup, idx) => {
			const { player_skills, ret1, ret2, ret3 } = setup;
			logDiv.innerText += `--- Setup ${idx + 1} ---\n`;
			console.log(`Running Setup ${idx + 1}`, player_skills, ret1, ret2, ret3);
			estimate_winrate(player_skills, ret1, ret2, ret3, n, enemiesList);
			logDiv.innerText += "\n\n";
		});
	});
});

exports = globalThis.exports;
let node_fs_promises = require("node:fs/promises");
// ../../../packages/lib/src/server/rateLimit.ts
var SourceLock = class {
	active = new Set();
	async run(source, busy, task) {
		if (this.active.has(source)) return busy;
		this.active.add(source);
		try {
			return await task();
		} finally {
			this.active.delete(source);
		}
	}
	release(source) {
		this.active.delete(source);
	}
}, RateLimit = class {
	count;
	windowMs;
	hits = new Map();
	constructor(count, windowMs) {
		this.count = count, this.windowMs = windowMs;
	}
	take(source) {
		let now = GetGameTimer(), recent = (this.hits.get(source) ?? []).filter((at) => now - at < this.windowMs);
		return recent.length >= this.count ? (this.hits.set(source, recent), !1) : (recent.push(now), this.hits.set(source, recent), !0);
	}
	release(source) {
		this.hits.delete(source);
	}
};
// ../../../packages/lib/src/shared/read.ts
function num(value, fallback, min = -Infinity, max = Infinity) {
	return typeof value == "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function int(value, fallback, min = -Infinity, max = Infinity) {
	return Math.round(num(value, fallback, min, max));
}
function str(value, fallback, max = 64) {
	return typeof value == "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
function record(value) {
	return typeof value == "object" && value && !Array.isArray(value) ? value : {};
}
// ../../../packages/lib/src/shared/strict.ts
function readFinite(value) {
	return typeof value == "number" && Number.isFinite(value) ? value : null;
}
function readText(value, max) {
	if (typeof value != "string") return null;
	let text = value.trim();
	return text ? text.slice(0, max) : null;
}
const oneArg = (read) => ([value]) => {
	let parsed = read(value);
	return parsed === null ? null : [parsed];
};
function parts(value) {
	if (Array.isArray(value)) return value;
	if (typeof value != "object" || !value) return null;
	let v = value;
	return [
		v.x,
		v.y,
		v.z,
		v.heading ?? v.w
	];
}
function readVec3(value) {
	let p = parts(value);
	if (!p) return null;
	let [x, y, z] = [
		readFinite(p[0]),
		readFinite(p[1]),
		readFinite(p[2])
	];
	return x !== null && y !== null && z !== null ? {
		x,
		y,
		z
	} : null;
}
function readVec4(value) {
	let point = readVec3(value);
	if (!point) return null;
	let raw = parts(value)?.[3], heading = raw == null ? 0 : readFinite(raw);
	return heading === null ? null : {
		...point,
		heading
	};
}
// ../../../packages/lib/src/shared/action.ts
const fail = (error) => ({
	ok: !1,
	error
}), pickRandom = (list) => list[Math.floor(Math.random() * list.length)], isPublic = (rule) => rule.jobs.length === 0 && rule.gangs.length === 0;
// ../../../packages/lib/src/shared/zone.ts
function zoneContains(shape, x, y, z) {
	switch (shape.type) {
		case "sphere": {
			let dx = x - shape.center.x, dy = y - shape.center.y, dz = z - shape.center.z;
			return dx * dx + dy * dy + dz * dz <= shape.radius * shape.radius;
		}
		case "cylinder": {
			let dx = x - shape.center.x, dy = y - shape.center.y;
			return dx * dx + dy * dy <= shape.radius * shape.radius && Math.abs(z - shape.center.z) <= shape.height;
		}
		case "poly": {
			if (z < shape.minZ || z > shape.maxZ) return !1;
			let inside = !1, p = shape.points;
			for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
				let a = p[i], b = p[j];
				a.y > y != b.y > y && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x && (inside = !inside);
			}
			return inside;
		}
		default: return shape;
	}
}
function polyFromCorners(corners, height) {
	if (corners.length < 3) return null;
	let minZ = Infinity, maxZ = -Infinity;
	for (let c of corners) minZ = Math.min(minZ, c.z), maxZ = Math.max(maxZ, c.z);
	return {
		type: "poly",
		points: corners.map(({ x, y }) => ({
			x,
			y
		})),
		minZ: minZ - height,
		maxZ: maxZ + height
	};
}
// ../../../packages/lib/src/shared/records.ts
const isObject = (value) => typeof value == "object" && !!value && !Array.isArray(value);
function readRecords(raw, readOne) {
	let out = new Map();
	if (!isObject(raw)) return out;
	for (let key in raw) {
		let value = raw[key];
		if (!isObject(value)) continue;
		let parsed = readOne(key, value);
		parsed !== null && out.set(key, parsed);
	}
	return out;
}
var FileViews = class {
	read;
	updaters = new Map();
	constructor(read) {
		this.read = read;
	}
	view(file, parse) {
		let box = { value: parse(this.read(file)) };
		return this.on(file, () => box.value = parse(this.read(file))), box;
	}
	records(file, readOne) {
		let live = new LiveRecords(readOne);
		return live.reset(this.read(file)), this.on(file, (key, value) => live.update(key, value, this.read(file))), live.map;
	}
	changed(file, key, value) {
		for (let update of this.updaters.get(file) ?? []) update(key, value);
	}
	on(file, update) {
		let list = this.updaters.get(file);
		list ? list.push(update) : this.updaters.set(file, [update]);
	}
}, LiveRecords = class {
	readOne;
	map = new Map();
	constructor(readOne) {
		this.readOne = readOne;
	}
	reset(raw) {
		this.map.clear();
		for (let [key, value] of readRecords(raw, this.readOne)) this.map.set(key, value);
	}
	update(key, value, whole) {
		if (key === void 0) return this.reset(whole);
		let parsed = isObject(value) ? this.readOne(key, value) : null;
		parsed === null ? this.map.delete(key) : this.map.set(key, parsed);
	}
};
// ../../../packages/lib/src/shared/lang.ts
function formatText(template, args) {
	return template.replace(/\{(\d+)\}/g, (match, index) => {
		let value = args[Number(index)];
		return value === void 0 ? match : String(value);
	});
}
// ../../../packages/lib/src/shared/index.ts
function isRecord(value) {
	return typeof value == "object" && !!value && !Array.isArray(value);
}
function logSafe(text, max) {
	return text.replace(/\r?\n/g, " | ").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\^\d/g, "").slice(0, max);
}
function previewJson(value, max) {
	let out = "", walk = (v, depth) => {
		if (out.length >= max) return;
		if (typeof v == "string") {
			out += JSON.stringify(v.length > max ? v.slice(0, max) : v);
			return;
		}
		if (typeof v != "object" || !v) {
			out += String(v);
			return;
		}
		if (depth > 4) {
			out += Array.isArray(v) ? "[...]" : "{...}";
			return;
		}
		if (Array.isArray(v)) {
			out += "[";
			for (let i = 0; i < v.length && out.length < max; i++) i > 0 && (out += ","), walk(v[i], depth + 1);
			out += "]";
			return;
		}
		out += "{";
		let first = !0;
		for (let key in v) {
			if (out.length >= max) break;
			first || (out += ","), first = !1, out += `${JSON.stringify(key.slice(0, 50))}:`, walk(v[key], depth + 1);
		}
		out += "}";
	};
	return walk(value, 0), out.slice(0, max);
}
function createLogger(resource) {
	let prefix = `[${resource}]`;
	return {
		info: (message, ...details) => console.log(`${prefix} ${message}`, ...details),
		warn: (message, ...details) => console.warn(`${prefix} ^3${message}^7`, ...details),
		error: (message, ...details) => console.error(`${prefix} ^1${message}^7`, ...details)
	};
}
function withoutSchemaKey(value) {
	if (!isRecord(value) || !("$schema" in value)) return value;
	let { $schema: _schema, ...rest } = value;
	return rest;
}
var DataFile = class {
	resource;
	name;
	log;
	writes = Promise.resolve();
	pending = void 0;
	timer = null;
	schemaRef = null;
	constructor(resource, name, log) {
		this.resource = resource, this.name = name, this.log = log;
	}
	hasSchemaRef() {
		return (LoadResourceFile(this.resource, this.path) ?? "").includes("\"$schema\"");
	}
	read() {
		for (let path of [this.path, `${this.path}.bak`]) {
			let raw = LoadResourceFile(this.resource, path);
			if (raw) try {
				return withoutSchemaKey(JSON.parse(raw));
			} catch (error) {
				this.log.error(`${this.resource}/${path} is not valid JSON${path === this.path ? ", trying the backup" : ""}`, error);
			}
		}
		return null;
	}
	write(value) {
		this.pending = value, this.timer ||= setTimeout(() => {
			this.timer = null;
			let data = this.schemaRef && isRecord(this.pending) ? {
				$schema: this.schemaRef,
				...this.pending
			} : this.pending, text = `${JSON.stringify(data, null, 2)}\n`;
			this.writes = this.writes.then(() => this.flush(text)).catch((error) => this.log.error(`saving ${this.resource}/${this.path} failed`, error));
		}, 250);
	}
	get path() {
		return `data/${this.name}.json`;
	}
	async flush(text) {
		let file = `${GetResourcePath(this.resource)}/${this.path}`;
		await (0, node_fs_promises.mkdir)(file.slice(0, file.lastIndexOf("/")), { recursive: !0 }), await (0, node_fs_promises.writeFile)(`${file}.tmp`, text, "utf8"), await (0, node_fs_promises.copyFile)(file, `${file}.bak`).catch(() => void 0), await (0, node_fs_promises.rename)(`${file}.tmp`, file);
	}
};
// ../../../packages/shared/src/core.ts
const CORE = {
	resource: "ai-core",
	clientErrorEvent: "ai-core:clientError",
	playerLoadedEvent: "ai-core:playerLoaded",
	playerSpawnedEvent: "ai-core:playerSpawned",
	playerUnloadedEvent: "ai-core:playerUnloaded",
	moneyChangedEvent: "ai-core:moneyChanged",
	jobsChangedEvent: "ai-core:jobsChanged",
	dutyChangedEvent: "ai-core:dutyChanged",
	gangsChangedEvent: "ai-core:gangsChanged",
	activeGangChangedEvent: "ai-core:activeGangChanged",
	metaChangedEvent: "ai-core:metaChanged",
	definitionsChangedEvent: "ai-core:definitionsChanged",
	characterDeletedEvent: "ai-core:characterDeleted",
	runtimeJobPrefix: "ai:jobdef:",
	runtimeGangPrefix: "ai:gangdef:",
	characterScreenEvent: "ai-core:characterScreen",
	inventoryChangedEvent: "ai-core:inventoryChanged",
	itemUsedEvent: "ai-core:itemUsed",
	playerDiedEvent: "ai-core:playerDied",
	clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
	clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
	clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
	characterLooksEvent: "ai-core:client:characterLooks",
	clientCacheEvent: "ai-core:client:cache",
	clientHudVisibleEvent: "ai-core:client:hudVisible",
	clientWorldSyncEvent: "ai-core:client:worldSync",
	clientDefinitionsEvent: "ai-core:client:definitions",
	vehicleTypeCallback: "ai-core:vehicleType",
	interactionStateKey: "ai:interaction",
	pvpStateKey: "ai:pvp",
	medicalStateKey: "ai:medical",
	clientDeadEvent: "ai-core:client:dead",
	mdtStateKey: "ai:mdt",
	billsEvent: "ai-core:client:bills",
	payBillCallback: "ai-core:payBill",
	clientSeatbeltEvent: "ai-core:client:seatbelt",
	stressRelayEvent: "ai-core:client:stress",
	notifyStateKey: "ai:notify",
	charactersCallback: "ai-core:characters",
	createCharacterCallback: "ai-core:createCharacter",
	deleteCharacterCallback: "ai-core:deleteCharacter",
	selectCharacterCallback: "ai-core:selectCharacter",
	spawnEvent: "ai-core:client:spawn",
	chooseSpawnEvent: "ai-core:client:chooseSpawn",
	spawnChoiceCallback: "ai-core:spawnChoice",
	openCharactersEvent: "ai-core:client:openCharacters",
	characterScreenKey: "ai:characterScreen",
	externalLoadedEvent: "ai-core:client:externalLoaded",
	externalSpawnedEvent: "ai-core:externalSpawned",
	externalLogoutEvent: "ai-core:client:externalLogout"
}, ADMIN = {
	ace: "ai.admin",
	openCallback: "ai-core:admin:open",
	panelDataCallback: "ai-core:admin:panelData",
	applyCallback: "ai-core:admin:apply",
	closeEvent: "ai-core:admin:close",
	showEvent: "ai-core:admin:show",
	deltaEvent: "ai-core:admin:delta",
	recommendationEvent: "ai-core:admin:recommendation",
	worldEvent: (resource) => `${resource}:admin:world`,
	worldChangesCallback: (resource) => `${resource}:admin:worldChanges`
}, LIB_UI = {
	resource: "ai-lib",
	notifyEvent: "ai-lib:client:notify",
	promptPressedEvent: "ai-lib:client:promptPressed",
	cancelProgressEvent: "ai-lib:client:cancelProgress",
	progressForCallback: "ai-lib:progressFor",
	progressForCancelEvent: "ai-lib:client:progressForCancel",
	minigameForCallback: "ai-lib:minigameFor",
	zoneEvent: "ai-lib:client:zone",
	modelPointEvent: "ai-lib:client:modelPoint"
}, named = new Set();
function registerExport(name, handler) {
	named.add(name), globalThis.exports(name, handler);
	let first = name.charAt(0), twin = (first === first.toUpperCase() ? first.toLowerCase() : first.toUpperCase()) + name.slice(1);
	twin !== name && !named.has(twin) && globalThis.exports(twin, handler);
}
function resourceExport(resource) {
	return globalThis.exports[resource];
}
function isResourceStarted(resource) {
	return GetResourceState(resource) === "started";
}
function optionalExport(resource) {
	return isResourceStarted(resource) ? globalThis.exports[resource] : null;
}
function readLocaleFile(resource, lang) {
	let raw = LoadResourceFile(resource, `locales/${lang}.json`);
	if (!raw) return {};
	let parsed = JSON.parse(raw);
	if (!isRecord(parsed)) return {};
	let texts = {};
	for (let [key, value] of Object.entries(parsed)) typeof value == "string" && (texts[key] = value);
	return texts;
}
function createLocale() {
	let texts = loadLocaleTexts();
	return (key, ...args) => formatText(texts[key] ?? key, args);
}
function loadLocaleTexts(resource = GetCurrentResourceName()) {
	let lang = GetConvar("ai:locale", "en"), texts = {
		...readLocaleFile(resource, "en"),
		...lang === "en" ? {} : readLocaleFile(resource, lang)
	};
	for (let key of Object.keys(texts)) texts[key] = (texts[key] ?? "").replace(/\$\{([A-Z0-9_]+)\}/g, (match, ref) => texts[ref] ?? match);
	return texts;
}
// ../../../packages/lib/src/fivem/callbackNames.ts
const requestEvent = (name) => `aicore:cb:${name}`, responseEvent = (resource) => `aicore:cbr:${resource}`;
// ../../../packages/lib/src/server/position.ts
function entityCoords(entity) {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(entity);
	return {
		x,
		y,
		z
	};
}
const coordsOf = (source) => entityCoords(GetPlayerPed(String(source)));
function isNear(source, point, metres) {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source))), dx = x - point.x, dy = y - point.y, dz = z - point.z;
	return dx * dx + dy * dy + dz * dz <= metres * metres;
}
// ../../../packages/lib/src/server/gate.ts
const core$28 = resourceExport(CORE.resource), log$7 = createLogger(GetCurrentResourceName()), hasCharacter = () => (source) => core$28.GetCharacter(source) !== null || "no character loaded", gates = new Set();
on("playerDropped", () => {
	let source = Number(globalThis.source);
	for (let gate of gates) gate.release(source);
});
var ClientGate = class {
	name;
	options;
	limit;
	lock;
	refusals = new Map();
	constructor(name, options, defaultRate) {
		this.name = name, this.options = options, this.limit = new RateLimit(options.rate?.count ?? defaultRate, options.rate?.windowMs ?? 1e3), this.lock = options.lock ? new SourceLock() : null, gates.add(this);
	}
	check(source, raw) {
		if (!(source > 0) || !GetPlayerName(String(source))) return null;
		if (!this.limit.take(source)) return this.refuse(source, "rate limit"), null;
		for (let guard of this.options.guards ?? []) {
			let verdict = guard(source);
			if (verdict !== !0) return typeof verdict == "string" && this.refuse(source, verdict), null;
		}
		if (!this.options.args) return [];
		let args = this.options.args(raw);
		return args === null && this.refuse(source, () => `invalid arguments ${logSafe(previewJson(raw, 200), 200)}`), args;
	}
	run(source, busy, task) {
		return this.lock ? this.lock.run(source, busy, async () => task()) : Promise.resolve(task());
	}
	release(source) {
		this.limit.release(source), this.lock?.release(source), this.refusals.delete(source);
	}
	refuse(source, reason) {
		let now = GetGameTimer(), last = this.refusals.get(source);
		if (last && now - last.at < 1e4) {
			last.skipped++;
			return;
		}
		let more = last?.skipped ? ` (+${last.skipped} more refused)` : "";
		this.refusals.set(source, {
			at: now,
			skipped: 0
		}), log$7.warn(`${this.name} refused for ${GetPlayerName(String(source))} (${source}): ${typeof reason == "string" ? reason : reason()}${more}`);
	}
};
// ../../../packages/lib/src/server/callback.ts
const log$6 = createLogger(GetCurrentResourceName()), resource$2 = GetCurrentResourceName(), REFUSED = Symbol("refused");
function onClientCallback(name, first, second) {
	let [handler, options] = typeof first == "function" ? [first, second ?? {}] : [second, first], gate = new ClientGate(name, options, 20);
	onNet(requestEvent(name), async (caller, id, ...raw) => {
		let source = Number(globalThis.source);
		if (typeof caller != "string" || caller.length > 64 || typeof id != "number") return;
		let args = gate.check(source, raw);
		if (!args) return emitNet(responseEvent(caller), source, id, !1, null);
		try {
			let result = await gate.run(source, REFUSED, () => handler(source, ...args));
			result === REFUSED ? emitNet(responseEvent(caller), source, id, !1, null) : emitNet(responseEvent(caller), source, id, !0, result ?? null);
		} catch (error) {
			log$6.error(`callback ${name} failed for ${source}`, error), emitNet(responseEvent(caller), source, id, !1, null);
		}
	});
}
const pending = new Map();
let nextId = 0;
onNet(responseEvent(resource$2), (id, ok, result) => {
	let entry = typeof id == "number" ? pending.get(id) : void 0;
	entry && entry.source === Number(globalThis.source) && (pending.delete(id), clearTimeout(entry.timer), ok === !0 ? entry.resolve(result) : entry.reject(Error("client callback failed")));
});
function triggerClientCallback(name, source, args = [], timeoutMs = 3e4) {
	let id = ++nextId;
	return new Promise((resolve, reject) => {
		let timer = setTimeout(() => {
			pending.delete(id), reject(Error(`client callback ${name} timed out for ${source}`));
		}, timeoutMs);
		pending.set(id, {
			source,
			resolve,
			reject,
			timer
		}), emitNet(requestEvent(name), source, resource$2, id, ...args);
	});
}
// ../../../packages/lib/src/server/admin/patch.ts
function toPatch(value) {
	if (!isRecord(value) || typeof value.file != "string") return null;
	let key = typeof value.key == "string" ? value.key : void 0;
	switch (value.action) {
		case "set": return typeof value.section == "string" ? {
			file: value.file,
			action: "set",
			key,
			section: value.section,
			value: value.value
		} : null;
		case "create": return key && typeof value.label == "string" ? {
			file: value.file,
			action: "create",
			key,
			label: value.label
		} : null;
		case "delete": return key ? {
			file: value.file,
			action: "delete",
			key
		} : null;
		case "run": return typeof value.id == "string" && value.id.length <= 64 ? {
			file: value.file,
			action: "run",
			key,
			id: value.id
		} : null;
		case "import": {
			if (!isRecord(value.records)) return null;
			let records = {};
			for (let [k, v] of Object.entries(value.records)) isRecord(v) && (records[k] = v);
			return Object.keys(records).length > 0 && Object.keys(records).length <= 500 ? {
				file: value.file,
				action: "import",
				records
			} : null;
		}
		default: return null;
	}
}
const clone = (value) => value === void 0 ? value : JSON.parse(JSON.stringify(value)), core$27 = resourceExport(CORE.resource), ERR = {
	type: "ADMIN_ERR_TYPE",
	range: "ADMIN_ERR_RANGE",
	length: "ADMIN_ERR_LENGTH",
	pattern: "ADMIN_ERR_PATTERN",
	required: "ADMIN_ERR_REQUIRED",
	lookup: "ADMIN_ERR_LOOKUP"
}, lookups = new class {
	lists = new Map();
	values(source) {
		let cached = this.lists.get(source);
		if (cached && Date.now() - cached.at < 2e3) return cached.values.size > 0 ? cached.values : null;
		let list = [];
		try {
			list = core$27.GetLookupValues(source);
		} catch {}
		let values = new Set(Array.isArray(list) ? list.filter((v) => typeof v == "string") : []);
		return this.lists.set(source, {
			at: Date.now(),
			values
		}), values.size > 0 ? values : null;
	}
}(), isVec = (value, keys) => isRecord(value) && keys.every((k) => typeof value[k] == "number" && Number.isFinite(value[k]));
function validate(spec, value, path) {
	if (value == null) return spec.optional ? null : {
		error: ERR.required,
		path
	};
	let fail = (error) => ({
		error,
		path
	});
	switch (spec.type) {
		case "text": return typeof value == "string" ? value.length < (spec.min ?? 1) || value.length > (spec.max ?? 120) ? fail(ERR.length) : spec.pattern && !new RegExp(spec.pattern).test(value) ? fail(ERR.pattern) : spec.lookup && value !== "" && lookups.values(spec.lookup)?.has(value) === !1 ? fail(ERR.lookup) : null : fail(ERR.type);
		case "number": return typeof value != "number" || !Number.isFinite(value) || spec.integer && !Number.isInteger(value) ? fail(ERR.type) : spec.min !== void 0 && value < spec.min || spec.max !== void 0 && value > spec.max ? fail(ERR.range) : null;
		case "bool": return typeof value == "boolean" ? null : fail(ERR.type);
		case "enum": return spec.values.includes(value) ? null : fail(ERR.type);
		case "names": {
			if (!Array.isArray(value) || value.length > (spec.max ?? 50)) return fail(ERR.length);
			let pattern = new RegExp(spec.pattern ?? "^[\\w.:-]+$"), seen = new Set();
			for (let name of value) {
				if (typeof name != "string" || name.length > (spec.itemMax ?? 64) || seen.has(name)) return fail(ERR.type);
				if (!pattern.test(name)) return fail(ERR.pattern);
				if (spec.lookup && lookups.values(spec.lookup)?.has(name) === !1) return fail(ERR.lookup);
				seen.add(name);
			}
			return null;
		}
		case "vec3": return isVec(value, [
			"x",
			"y",
			"z"
		]) ? null : fail(ERR.type);
		case "vec4": return isVec(value, [
			"x",
			"y",
			"z",
			"heading"
		]) ? null : fail(ERR.type);
		case "object":
			if (!isRecord(value)) return fail(ERR.type);
			for (let key of Object.keys(value)) if (!(key in spec.fields)) return {
				error: ERR.type,
				path: `${path}.${key}`
			};
			for (let [key, field] of Object.entries(spec.fields)) {
				let refusal = validate(field, value[key], `${path}.${key}`);
				if (refusal) return refusal;
			}
			return null;
		case "list":
			if (!Array.isArray(value)) return fail(ERR.type);
			if (value.length < (spec.min ?? 0) || value.length > (spec.max ?? 100)) return fail(ERR.length);
			for (let i = 0; i < value.length; i++) {
				let refusal = validate(spec.of, value[i], `${path}.${i + 1}`);
				if (refusal) return refusal;
			}
			return null;
		default: return spec;
	}
}
// ../../../packages/lib/src/server/admin/edit.ts
const DEFAULT_KEY = "^[a-z0-9_]{2,32}$";
function imported(spec, value) {
	let base = clone(spec.newRecord ?? {}), out = {};
	for (let name of Object.keys(spec.sections)) {
		let v = name in value ? value[name] : base[name];
		v !== void 0 && (out[name] = clone(v));
	}
	return out;
}
function linked(spec, value, ctx) {
	return spec.type === "text" && spec.records && typeof value == "string" && value !== "" && !(value in ctx.get(spec.records)) ? "ADMIN_ERR_LOOKUP" : null;
}
function checkEdit(patch, spec, ctx) {
	let data = ctx.get(patch.file);
	if (patch.action === "create") return spec.kind !== "records" || !new RegExp(spec.keyPattern ?? DEFAULT_KEY).test(patch.key) ? ERR.pattern : patch.key in data ? "ADMIN_ERR_EXISTS" : null;
	if (patch.action === "delete") return spec.kind !== "records" || !(patch.key in data) ? ERR.type : spec.locked?.includes(patch.key) ? "ADMIN_ERR_LOCKED" : null;
	if (patch.action === "import") {
		if (spec.kind !== "records") return ERR.type;
		let pattern = new RegExp(spec.keyPattern ?? DEFAULT_KEY);
		for (let [key, value] of Object.entries(patch.records)) {
			if (!pattern.test(key)) return ERR.pattern;
			let record = imported(spec, value);
			for (let [name, section] of Object.entries(spec.sections)) {
				let refusal = validate(section, record[name], name);
				if (refusal) return refusal.error;
				let link = linked(section, record[name], ctx);
				if (link) return link;
			}
			let ruled = ctx.rule(patch.file)?.(key, record);
			if (ruled) return ruled;
		}
		return null;
	}
	let section = spec.sections[patch.section];
	if (!section || spec.kind === "records" && (!patch.key || !(patch.key in data))) return ERR.type;
	let refusal = validate(section, patch.value, patch.section);
	if (refusal) return refusal.error;
	let link = linked(section, patch.value, ctx);
	if (link) return link;
	let current = spec.kind === "records" ? data[patch.key ?? ""] : data, next = {
		...isRecord(current) ? current : {},
		[patch.section]: patch.value
	};
	return ctx.rule(patch.file)?.(patch.key, next) ?? null;
}
function applyEdit(data, patch, spec) {
	if (patch.action === "import") {
		for (let [key, value] of Object.entries(patch.records)) data[key] = imported(spec, value);
		return Object.keys(patch.records);
	}
	if (patch.action === "create") {
		let record = clone(spec.newRecord ?? {});
		spec.labelPath && (record[spec.labelPath] = patch.label), data[patch.key] = record;
	} else if (patch.action === "delete") delete data[patch.key];
	else {
		let target = spec.kind === "records" ? data[patch.key ?? ""] : data;
		if (!isRecord(target)) return [];
		patch.value === void 0 || patch.value === null ? delete target[patch.section] : target[patch.section] = clone(patch.value);
	}
	return [spec.kind === "records" ? patch.key : void 0];
}
// ../../../packages/lib/src/server/admin/descriptions.ts
function langFile(resource) {
	try {
		let raw = JSON.parse(LoadResourceFile(resource, "locales/en.json") ?? "{}");
		return isRecord(raw) ? Object.fromEntries(Object.entries(raw).filter((e) => typeof e[1] == "string")) : {};
	} catch {
		return {};
	}
}
function texts$1(resource) {
	return {
		...langFile("ai-core"),
		...langFile(resource)
	};
}
function collect(fields, prefix, lang, out) {
	for (let field of fields) {
		if (field.widget === "action") continue;
		let path = prefix + field.path, label = lang[field.label] ?? field.label, hint = field.hint ? lang[field.hint] ?? field.hint : "";
		out.has(path) || out.set(path, hint ? `${label}: ${hint}` : label), field.widget === "list" && collect(field.rows, `${path}[].`, lang, out);
	}
}
function describe(schema, file, lang) {
	let out = new Map();
	for (let tab of schema.tabs) if (tab.file === file) for (let card of tab.cards) collect(card.fields, "", lang, out);
	return out;
}
// ../../../packages/lib/src/server/admin/jsonSchema.ts
const SCHEMA_KEY = {
	type: "string",
	description: "This file's JSON Schema (for editors)."
};
function toJson(spec, path, desc) {
	let description = desc.get(path), base = description ? { description } : {};
	switch (spec.type) {
		case "text": return {
			...base,
			type: "string",
			minLength: spec.min,
			maxLength: spec.max,
			pattern: spec.pattern
		};
		case "number": return {
			...base,
			type: spec.integer ? "integer" : "number",
			minimum: spec.min,
			maximum: spec.max
		};
		case "bool": return {
			...base,
			type: "boolean"
		};
		case "enum": return {
			...base,
			enum: spec.values
		};
		case "names": return {
			...base,
			type: "array",
			maxItems: spec.max,
			uniqueItems: !0,
			items: {
				type: "string",
				maxLength: spec.itemMax,
				pattern: spec.pattern
			}
		};
		case "vec3":
		case "vec4": {
			let keys = spec.type === "vec3" ? [
				"x",
				"y",
				"z"
			] : [
				"x",
				"y",
				"z",
				"heading"
			];
			return {
				...base,
				type: "object",
				required: keys,
				properties: Object.fromEntries(keys.map((k) => [k, { type: "number" }]))
			};
		}
		case "object": return {
			...base,
			...objectOf(spec.fields, path ? `${path}.` : "", desc)
		};
		case "list": return {
			...base,
			type: "array",
			minItems: spec.min,
			maxItems: spec.max,
			items: toJson(spec.of, `${path}[]`, desc)
		};
		default: return spec;
	}
}
function objectOf(fields, prefix, desc) {
	return {
		type: "object",
		properties: Object.fromEntries(Object.entries(fields).map(([k, s]) => [k, toJson(s, prefix + k, desc)])),
		required: Object.entries(fields).filter(([, s]) => !s.optional).map(([k]) => k)
	};
}
function fileSchema(resource, schema, name, spec) {
	let desc = describe(schema, name, texts$1(resource)), title = `${resource}/data/${name}.json`, body = spec.kind === "settings" ? (() => {
		let obj = objectOf(spec.sections, "", desc), required = obj.required.filter((k) => !(k in (spec.defaults ?? {})));
		return {
			...obj,
			properties: {
				$schema: SCHEMA_KEY,
				...obj.properties
			},
			required
		};
	})() : {
		type: "object",
		properties: { $schema: SCHEMA_KEY },
		patternProperties: { [spec.keyPattern ?? "^[a-z0-9_]{2,32}$"]: objectOf(spec.sections, "", desc) },
		additionalProperties: !1
	};
	return `${JSON.stringify({
		$schema: "http://json-schema.org/draft-07/schema#",
		title,
		...body
	}, null, 2)}\n`;
}
function writeSchema(resource, name, text, log) {
	let path = `data/schemas/${name}.schema.json`;
	if (LoadResourceFile(resource, path) === text) return;
	let dir = `${GetResourcePath(resource)}/data/schemas`;
	(0, node_fs_promises.mkdir)(dir, { recursive: !0 }).then(() => (0, node_fs_promises.writeFile)(`${dir}/${name}.schema.json`, text, "utf8")).catch((error) => log.error(`writing ${resource}/${path} failed`, error));
}
// ../../../packages/lib/src/server/admin/panelFiles.ts
const core$26 = resourceExport(CORE.resource);
var PanelFiles = class {
	schema;
	data = new Map();
	dataFiles = new Map();
	handlers = new Map();
	views = new FileViews((file) => this.get(file));
	worldChanges = new Map();
	resource = GetCurrentResourceName();
	log = createLogger(this.resource);
	constructor(schema) {
		this.schema = schema;
		for (let [name, spec] of Object.entries(schema.files)) this.load(name, spec);
	}
	get(file) {
		return this.data.get(file) ?? {};
	}
	onChange(file, handler) {
		this.handlers.set(file, [...this.handlers.get(file) ?? [], handler]);
	}
	view(file, read) {
		return this.views.view(file, read);
	}
	records(file, readOne) {
		return this.views.records(file, readOne);
	}
	commit(file, key, value) {
		let data = this.data.get(file);
		data && (key === void 0 ? isRecord(value) && this.data.set(file, clone(value)) : value === null ? delete data[key] : data[key] = clone(value), this.changed(file, key));
	}
	commitAfter(file, key, value) {
		setImmediate(() => this.commit(file, key, value));
	}
	store(patch, spec) {
		let data = this.data.get(patch.file) ?? {}, keys = applyEdit(data, patch, spec);
		if (keys.length !== 0) {
			this.data.set(patch.file, data);
			for (let key of keys) this.changed(patch.file, key);
		}
	}
	changed(file, key) {
		let spec = this.schema.files[file], data = this.get(file), value = key === void 0 ? data : data[key] ?? null;
		this.dataFiles.get(file)?.write(data), this.views.changed(file, key, value);
		for (let handler of this.handlers.get(file) ?? []) handler(key, value);
		if (core$26.AdminPanelChanged({
			resource: this.resource,
			file,
			key,
			value: clone(value)
		}), spec?.sync !== "all") return;
		let changes = this.worldChanges.get(file) ?? {};
		changes[key ?? ""] = clone(value), this.worldChanges.set(file, changes), emitNet(ADMIN.worldEvent(this.resource), -1, file, key ?? null, value);
	}
	load(name, spec) {
		if (spec.memory) {
			this.data.set(name, {});
			return;
		}
		let file = new DataFile(this.resource, name, this.log);
		this.dataFiles.set(name, file), file.schemaRef = `./schemas/${name}.schema.json`, writeSchema(this.resource, name, fileSchema(this.resource, this.schema, name, spec), this.log);
		let raw = file.read(), data = isRecord(raw) ? raw : {}, filled = !1;
		if (spec.kind === "settings") for (let [section, value] of Object.entries(spec.defaults ?? {})) section in data || (data[section] = clone(value), filled = !0);
		this.data.set(name, data), (filled || raw === null || !file.hasSchemaRef()) && file.write(data);
	}
};
// ../../../packages/lib/src/server/admin/panel.ts
const core$25 = resourceExport(CORE.resource);
var AdminPanel = class extends PanelFiles {
	rules = new Map();
	actions = new Map();
	editor = 0;
	constructor(schema) {
		super(schema), registerExport("AdminPanelSnapshot", () => this.snapshot()), registerExport("AdminPanelData", () => this.dataSnapshot()), registerExport("AdminPanelSummary", () => this.summary()), registerExport("AdminPanelApply", (admin, patch) => this.apply(admin, patch)), onClientCallback(ADMIN.worldChangesCallback(this.resource), () => Object.fromEntries(this.worldChanges), { rate: {
			count: 4,
			windowMs: 1e4
		} }), setImmediate(() => core$25.RegisterAdminPanel(this.resource));
	}
	rule(file, rule) {
		this.rules.set(file, rule);
	}
	onAction(id, handler) {
		this.actions.set(id, handler);
	}
	snapshot() {
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data: this.dataSnapshot()
		};
	}
	dataSnapshot() {
		return clone(Object.fromEntries(this.data));
	}
	summary() {
		let data = {}, index = {};
		for (let [file, spec] of Object.entries(this.schema.files)) {
			let content = this.data.get(file);
			if (spec.kind !== "records") {
				data[file] = clone(content ?? {});
				continue;
			}
			let labels = {};
			for (let [key, record] of Object.entries(content ?? {})) labels[key] = labelOf(record, spec.labelPath) ?? key;
			index[file] = labels;
		}
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data,
			loaded: !1,
			index
		};
	}
	apply(admin, raw) {
		let patch = toPatch(raw), spec = patch ? this.schema.files[patch.file] : void 0;
		if (!patch || !spec) return {
			ok: !1,
			error: ERR.type
		};
		this.editor = admin;
		try {
			if (patch.action === "run") return this.run(admin, patch, spec);
			if (spec.memory) return {
				ok: !1,
				error: ERR.type
			};
			let error = checkEdit(patch, spec, {
				get: (file) => this.get(file),
				rule: (file) => this.rules.get(file)
			});
			return error ? (this.log.warn(`admin ${admin} edit refused (${error}): ${previewJson(patch, 300)}`), {
				ok: !1,
				error
			}) : (this.store(patch, spec), { ok: !0 });
		} finally {
			this.editor = 0;
		}
	}
	run(admin, patch, spec) {
		let handler = this.actions.get(patch.id), data = this.get(patch.file), target = spec.kind === "records" ? data[patch.key ?? ""] : data;
		if (!handler || !isRecord(target)) return {
			ok: !1,
			error: ERR.type
		};
		try {
			let error = handler(admin, clone(target), patch.key);
			return error ? {
				ok: !1,
				error
			} : { ok: !0 };
		} catch (error) {
			return this.log.error(`panel action ${patch.id} failed`, error), {
				ok: !1,
				error: ERR.type
			};
		}
	}
};
function labelOf(record, path) {
	if (!path) return null;
	let at = record;
	for (let part of path.split(".")) {
		if (typeof at != "object" || !at) return null;
		at = at[part];
	}
	return typeof at == "string" && at !== "" ? at : null;
}
// ../../../packages/lib/src/server/log.ts
function aiLog(channel, message, options) {
	optionalExport("ai-core")?.Log(channel, message, options);
}
// ../../../packages/lib/src/server/notify.ts
function notify(source, text, kind = "info", duration, title) {
	let notification = {
		text,
		kind,
		duration,
		title
	};
	emitNet(LIB_UI.notifyEvent, source, notification);
}
// ../../../packages/lib/src/server/inventory.ts
const core$24 = resourceExport(CORE.resource), inventory = {
	addItem: (inv, item, count = 1, metadata, slot) => core$24.AddItem(inv, item, count, metadata, slot),
	removeItem: (inv, item, count = 1, metadata, slot) => core$24.RemoveItem(inv, item, count, metadata, slot),
	getItemCount: (inv, item, metadata) => core$24.GetItemCount(inv, item, metadata),
	hasItem: (inv, item, count = 1) => core$24.HasItem(inv, item, count),
	canCarryItem: (inv, item, count = 1, metadata) => core$24.CanCarryItem(inv, item, count, metadata),
	getItems: (inv) => core$24.GetItems(inv),
	clearInventory: (inv) => core$24.ClearInventory(inv),
	registerStash: (name, label, slots, maxWeight, jobs = []) => core$24.RegisterStash(name, label, slots, maxWeight, jobs),
	openInventory: (source, inv) => core$24.OpenInventory(source, inv),
	registerUsableItem: (name, handler) => core$24.RegisterUsableItem(name, handler),
	registerShop: (name, label, items) => core$24.RegisterShop(name, label, items),
	openShop: (source, name) => core$24.OpenShop(source, name),
	getItemDefinition: (name) => core$24.GetItemDefinition(name),
	setItemMetadata: (inv, slot, metadata) => core$24.SetItemMetadata(inv, slot, metadata),
	setMaxWeight: (source, grams) => core$24.SetMaxWeight(source, grams),
	usableItems: () => core$24.GetUsableItems()
}, core$23 = resourceExport(CORE.resource);
function reindex(index, source, before, after) {
	for (let name of before) {
		let set = index.get(name);
		set && (set.delete(source), set.size === 0 && index.delete(name));
	}
	for (let name of after) {
		let set = index.get(name);
		set || index.set(name, set = new Set()), set.add(source);
	}
}
var OnlineMirror = class {
	players = new Map();
	onDuty = new Map();
	jobIndex = new Map();
	gangIndex = new Map();
	started = !1;
	start() {
		if (this.started) return;
		this.started = !0;
		let load = (source, character) => {
			this.drop(source), this.players.set(source, {
				character,
				jobs: [],
				jobNames: [],
				gangs: [],
				gangNames: [],
				duty: null
			}), this.setJobs(source, core$23.GetJobs(source) ?? []), this.setGangs(source, core$23.GetGangs(source) ?? []), this.setDuty(source, core$23.GetDutyJob(source));
		};
		on(CORE.playerLoadedEvent, load), on(CORE.playerUnloadedEvent, (source) => this.drop(source)), on(CORE.jobsChangedEvent, (source, jobs) => this.setJobs(source, jobs)), on(CORE.gangsChangedEvent, (source, gangs) => this.setGangs(source, gangs)), on(CORE.dutyChangedEvent, (source, job) => this.setDuty(source, job));
		for (let source of core$23.GetLoadedSources()) {
			let character = core$23.GetCharacter(source);
			character && load(source, character);
		}
	}
	drop(source) {
		let player = this.players.get(source);
		player && (this.setDuty(source, null), reindex(this.jobIndex, source, player.jobNames, []), reindex(this.gangIndex, source, player.gangNames, []), this.players.delete(source));
	}
	setJobs(source, jobs) {
		let player = this.players.get(source);
		if (!player) return;
		let names = jobs.map((m) => m.job);
		reindex(this.jobIndex, source, player.jobNames, names), player.jobs = jobs, player.jobNames = names;
	}
	setGangs(source, gangs) {
		let player = this.players.get(source);
		if (!player) return;
		let names = gangs.map((m) => m.gang);
		reindex(this.gangIndex, source, player.gangNames, names), player.gangs = gangs, player.gangNames = names;
	}
	setDuty(source, job) {
		let player = this.players.get(source);
		if (!player) return;
		if (player.duty) {
			let set = this.onDuty.get(player.duty);
			set?.delete(source), set?.size === 0 && this.onDuty.delete(player.duty);
		}
		if (player.duty = job, !job) return;
		let set = this.onDuty.get(job);
		set || this.onDuty.set(job, set = new Set()), set.add(source);
	}
}, OnlinePlayers = class extends OnlineMirror {
	sources() {
		return this.start(), this.players.keys();
	}
	get size() {
		return this.start(), this.players.size;
	}
	character(source) {
		return this.start(), this.players.get(source)?.character ?? null;
	}
	charId(source) {
		return this.start(), this.players.get(source)?.character.id;
	}
	name(source, options = {}) {
		let c = this.character(source);
		return c ? `${c.firstname} ${c.lastname}` : options.fallback === !1 ? "" : GetPlayerName(String(source));
	}
	jobs(source) {
		return this.start(), this.players.get(source)?.jobNames ?? [];
	}
	gangs(source) {
		return this.start(), this.players.get(source)?.gangNames ?? [];
	}
	jobGrade(source, job) {
		return this.start(), this.players.get(source)?.jobs.find((m) => m.job === job)?.grade ?? null;
	}
	gangGrade(source, gang) {
		return this.start(), this.players.get(source)?.gangs.find((m) => m.gang === gang)?.grade ?? null;
	}
	jobMembers(job) {
		return this.start(), this.jobIndex.get(job) ?? EMPTY;
	}
	gangMembers(gang) {
		return this.start(), this.gangIndex.get(gang) ?? EMPTY;
	}
	dutyJob(source) {
		return this.start(), this.players.get(source)?.duty ?? null;
	}
	onDutyIn(source, jobs) {
		let duty = this.dutyJob(source);
		return duty !== null && jobs.includes(duty);
	}
	allows(source, rule) {
		if (isPublic(rule)) return !0;
		let min = (name) => rule.grades[name] ?? 0;
		for (let gang of rule.gangs) {
			let grade = this.gangGrade(source, gang);
			if (grade !== null && grade >= min(gang)) return !0;
		}
		let duty = rule.onDuty ? this.dutyJob(source) : null;
		for (let job of rule.jobs) {
			let grade = this.jobGrade(source, job);
			if (grade !== null && grade >= min(job) && (!rule.onDuty || duty === job)) return !0;
		}
		return !1;
	}
	countOnDuty(jobs) {
		this.start();
		let count = 0;
		for (let job of jobs) count += this.onDuty.get(job)?.size ?? 0;
		return count;
	}
	onDutyFor(job) {
		return this.start(), this.onDuty.get(job) ?? EMPTY;
	}
};
const EMPTY = new Set(), online = new OnlinePlayers();
resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource);
// ../../../packages/lib/src/server/players.ts
const log$5 = createLogger(GetCurrentResourceName()), dropped = new Set();
let listening = !1;
function onDropped(fn) {
	listening || (listening = !0, on("playerDropped", () => {
		let source = Number(globalThis.source);
		for (let handler of dropped) handler(source);
	})), dropped.add(fn);
}
var PlayerMap = class extends Map {
	constructor(options = {}) {
		super(), onDropped((source) => {
			if (!this.has(source)) return;
			let value = this.get(source);
			this.delete(source), options.onDrop?.(source, value);
		});
	}
}, KeyedCooldowns = class {
	until = new Map();
	sweepAt = 64;
	ready(key) {
		return this.left(key) === 0;
	}
	start(key, ms) {
		ms <= 0 ? this.until.delete(key) : (this.until.size >= this.sweepAt && this.sweep(), this.until.set(key, GetGameTimer() + ms));
	}
	take(key, ms) {
		return this.ready(key) ? (this.start(key, ms), !0) : !1;
	}
	left(key) {
		let until = this.until.get(key);
		if (until === void 0) return 0;
		let left = until - GetGameTimer();
		return left > 0 ? left : (this.until.delete(key), 0);
	}
	clear(key) {
		this.until.delete(key);
	}
	sweep() {
		let now = GetGameTimer();
		for (let [key, until] of this.until) until <= now && this.until.delete(key);
		this.sweepAt = Math.max(64, this.until.size * 2);
	}
};
function onCharacter(handlers) {
	let live = new Map(), deliver = (source, character) => {
		if (live.set(source, character.id), handlers.loaded) try {
			let result = handlers.loaded(source, character);
			result instanceof Promise && result.catch((error) => log$5.error(`character loaded handler failed for ${source}`, error));
		} catch (error) {
			log$5.error(`character loaded handler failed for ${source}`, error);
		}
	}, end = (source, charId, reason) => {
		if (live.delete(source)) try {
			handlers.unloaded?.(source, charId, reason);
		} catch (error) {
			log$5.error(`character unloaded handler failed for ${source}`, error);
		}
	};
	on(CORE.playerLoadedEvent, (source, character) => {
		let previous = live.get(source);
		previous !== void 0 && end(source, previous, "switch"), deliver(source, character);
	}), on(CORE.playerUnloadedEvent, (source, charId, reason) => end(source, charId, reason === "dropped" ? "dropped" : "switch")), onDropped((source) => setImmediate(() => {
		let charId = live.get(source);
		charId !== void 0 && end(source, charId, "dropped");
	})), setImmediate(() => {
		for (let source of online.sources()) {
			if (live.has(source)) continue;
			let character = online.character(source);
			character && deliver(source, character);
		}
	});
}
// ../../../packages/lib/src/server/progressFor.ts
const running = new PlayerMap({ onDrop: (_source, settle) => settle(!1) });
on(CORE.playerUnloadedEvent, (source) => {
	let settle = running.get(source);
	settle && settle(!1);
});
function progressFor(source, options) {
	let previous = running.get(source);
	previous && (previous(!1), emitNet(LIB_UI.progressForCancelEvent, source));
	let { minRatio = .8, ...bar } = options, startedAt = GetGameTimer();
	return new Promise((resolve) => {
		let done = !1, settle = (ok) => {
			done || (done = !0, running.get(source) === settle && running.delete(source), resolve(ok));
		};
		running.set(source, settle), triggerClientCallback(LIB_UI.progressForCallback, source, [bar], bar.duration + 15e3).then((answer) => settle(answer === !0 && GetGameTimer() - startedAt >= bar.duration * minRatio), () => settle(!1));
	});
}
// ../../../packages/lib/src/server/definitions.ts
const core$19 = resourceExport("ai-core");
new class {
	jobs = new Map();
	gangs = new Map();
	constructor() {
		on(CORE.definitionsChangedEvent, (file, name) => {
			typeof name == "string" && (file === "jobs" ? this.jobs.delete(name) : file === "gangs" && this.gangs.delete(name));
		});
	}
	job(name) {
		let def = this.jobs.get(name);
		return def === void 0 && this.jobs.set(name, def = core$19.GetJobDefinition(name) ?? null), def;
	}
	registerJob(name, definition) {
		return core$19.RegisterJobDefinition(name, definition);
	}
	removeJob(name) {
		return core$19.RemoveJobDefinition(name);
	}
	registerGang(name, definition) {
		return core$19.RegisterGangDefinition(name, definition);
	}
	removeGang(name) {
		return core$19.RemoveGangDefinition(name);
	}
	gang(name) {
		let def = this.gangs.get(name);
		return def === void 0 && this.gangs.set(name, def = core$19.GetGangDefinition(name) ?? null), def;
	}
}();
const log$4 = createLogger(GetCurrentResourceName());
let texts = null;
const t = (key, ...args) => formatText((texts ??= loadLocaleTexts(CORE.resource))[key] ?? key, args);
function reply(source, text, kind) {
	source > 0 ? notify(source, text, kind) : log$4.info(text);
}
var Command = class {
	params;
	handler;
	info;
	usage;
	constructor(names, params, help, aces, handler) {
		this.params = params, this.handler = handler, this.info = {
			names,
			help,
			params: params.map((p) => ({ ...p })),
			aces
		}, this.usage = [`/${names[0]}`, ...params.map((p) => p.optional ? `[${p.name}]` : `<${p.name}>`)].join(" ");
	}
	allowed(source, name) {
		let aces = this.info.aces;
		if (source <= 0 || !aces) return !0;
		let player = String(source);
		return aces.some((ace) => IsPlayerAceAllowed(player, ace)) || !!IsPlayerAceAllowed(player, `command.${name}`);
	}
	suggestion(name) {
		return {
			name: `/${name}`,
			help: this.info.help,
			params: this.params.map((p) => ({
				name: p.name,
				help: p.help ?? ""
			}))
		};
	}
	run(source, name, raw, line) {
		if (!this.allowed(source, name)) return reply(source, t("COMMAND_NOT_ALLOWED"), "error");
		let args = this.parse(raw);
		if (typeof args == "string") return reply(source, args, "error"), reply(source, t("COMMAND_USAGE", this.usage), "info");
		let fail = (error) => log$4.error(`command /${name} failed`, error);
		try {
			let result = this.handler(source, args, line);
			result instanceof Promise && result.catch(fail);
		} catch (error) {
			fail(error);
		}
	}
	parse(raw) {
		let args = {};
		for (let [i, param] of this.params.entries()) {
			let token = param.type === "longString" ? raw.slice(i).join(" ").trim() : raw[i] ?? "";
			if (token === "") {
				if (!param.optional) return t("COMMAND_MISSING", param.name);
			} else {
				if (param.type === "number" || param.type === "playerId") {
					let value = Number(token);
					if (!Number.isFinite(value)) return t("COMMAND_NUMBER", param.name);
					if (param.type === "playerId" && (!Number.isInteger(value) || value <= 0 || !GetPlayerName(String(value)))) return t("COMMAND_PLAYER", token);
					args[param.name] = value;
				} else args[param.name] = token;
				if (param.type === "longString") break;
			}
		}
		return args;
	}
};
// ../../../packages/lib/src/server/command/commandSet.ts
const resource = GetCurrentResourceName(), commands = new class {
	list = [];
	sent = new Map();
	announced = 0;
	queued = !1;
	listening = !1;
	add(command) {
		this.listening || this.listen(), this.list.push(command), this.queued || (this.queued = !0, setImmediate(() => this.flush()));
	}
	refresh(source) {
		let before = this.sent.get(source), now = new Set(), add = [];
		for (let command of this.list) for (let name of command.info.names) command.allowed(source, name) && (now.add(name), before?.has(name) || add.push(command.suggestion(name)));
		if (this.sent.set(source, now), add.length && emitNet("chat:addSuggestions", source, add), before) for (let name of before) now.has(name) || emitNet("chat:removeSuggestion", source, `/${name}`);
	}
	flush() {
		this.queued = !1, optionalExport(CORE.resource)?.RegisterCommands(resource, this.list.slice(this.announced).map((c) => c.info)), this.announced = this.list.length;
		for (let player of getPlayers()) this.refresh(Number(player));
	}
	listen() {
		this.listening = !0;
		let refresh = (source) => this.refresh(Number(source));
		on(CORE.playerLoadedEvent, refresh), on(CORE.jobsChangedEvent, refresh), on(CORE.gangsChangedEvent, refresh), on("playerDropped", () => this.sent.delete(Number(globalThis.source))), on("onResourceStop", (name) => {
			if (name === resource) for (let command of this.list) for (let n of command.info.names) emitNet("chat:removeSuggestion", -1, `/${n}`);
		});
	}
}();
// ../../../packages/lib/src/server/command/addCommand.ts
function addCommand(name, options, handler) {
	let names = (Array.isArray(name) ? name : [name]).map((n) => n.toLowerCase());
	if (names.length === 0) throw Error("addCommand needs a name");
	let restricted = options.restricted ?? !1, aces = restricted === !1 ? null : restricted === !0 ? [ADMIN.ace] : Array.isArray(restricted) ? [...restricted] : [restricted], command = new Command(names, options.params ?? [], options.help ?? "", aces, handler);
	for (let n of names) RegisterCommand(n, (source, raw, line) => command.run(Number(source), n, raw, line), !1);
	commands.add(command);
}
createLogger(GetCurrentResourceName()), createLogger("aicore-lib");
// ../../../packages/lib/src/fivem/scheduler/group.ts
var Group = class {
	interval;
	jobs = Array(8);
	gens = Array(8).fill(0);
	dues = Array(8).fill(0);
	head = 0;
	mask = 7;
	count = 0;
	constructor(interval) {
		this.interval = interval;
	}
	get front() {
		return this.dues[this.head] ?? 0;
	}
	compactAt = 64;
	push(job, due) {
		this.count >= this.compactAt && this.compact(), this.count > this.mask && this.grow();
		let i = this.head + this.count & this.mask;
		this.jobs[i] = job, this.gens[i] = job.gen, this.dues[i] = due, this.count++;
	}
	run(now) {
		for (let left = this.count; left > 0 && this.count > 0; left--) {
			let i = this.head, due = this.dues[i] ?? 0;
			if (due > now) return;
			let job = this.jobs[i], gen = this.gens[i];
			if (this.jobs[i] = void 0, this.head = i + 1 & this.mask, this.count--, !job || job.gen !== gen) continue;
			let next = due + this.interval;
			next <= now && (next = now + this.interval), this.push(job, next), job.call();
		}
	}
	compact() {
		let kept = 0;
		for (let n = 0; n < this.count; n++) {
			let i = this.head + n & this.mask, job = this.jobs[i];
			if (!job || job.gen !== this.gens[i]) continue;
			let k = this.head + kept & this.mask;
			this.jobs[k] = job, this.gens[k] = this.gens[i] ?? 0, this.dues[k] = this.dues[i] ?? 0, kept++;
		}
		for (let n = kept; n < this.count; n++) this.jobs[this.head + n & this.mask] = void 0;
		this.count = kept, this.compactAt = Math.max(64, kept * 2);
	}
	grow() {
		let size = (this.mask + 1) * 2, jobs = Array(size), gens = Array(size).fill(0), dues = Array(size).fill(0);
		for (let n = 0; n < this.count; n++) {
			let i = this.head + n & this.mask;
			jobs[n] = this.jobs[i], gens[n] = this.gens[i] ?? 0, dues[n] = this.dues[i] ?? 0;
		}
		this.jobs = jobs, this.gens = gens, this.dues = dues, this.head = 0, this.mask = size - 1;
	}
};
const scheduler = new class {
	groups = [];
	byInterval = new Map();
	tick = null;
	active = 0;
	nextDue = Infinity;
	running = !1;
	activate(job) {
		job.gen++, this.active++;
		let due = GetGameTimer() + job.interval, group = this.byInterval.get(job.interval);
		group || (group = new Group(job.interval), this.byInterval.set(job.interval, group), this.groups.push(group)), group.push(job, due), due < this.nextDue && (this.nextDue = due), this.tick ??= setTick(this.onTick);
	}
	deactivate(job) {
		job.gen++, this.active--, this.active === 0 && !this.running && this.halt();
	}
	halt() {
		this.tick !== null && clearTick(this.tick), this.tick = null, this.groups.length = 0, this.byInterval.clear(), this.nextDue = Infinity;
	}
	onTick = () => {
		let now = GetGameTimer();
		if (now < this.nextDue) return;
		let groups = this.groups;
		this.running = !0;
		for (let i = 0; i < groups.length; i++) {
			let group = groups[i];
			group && group.count > 0 && group.front <= now && group.run(now);
		}
		if (this.running = !1, this.active === 0) return this.halt();
		let soonest = Infinity, kept = 0;
		for (let i = 0; i < groups.length; i++) {
			let group = groups[i];
			group && (group.count === 0 ? this.byInterval.delete(group.interval) : (groups[kept++] = group, group.front < soonest && (soonest = group.front)));
		}
		groups.length = kept, this.nextDue = soonest;
	};
}();
let log$1 = null;
var ScheduledJob = class {
	interval;
	fn;
	name;
	gen = 0;
	active = !1;
	stopped = !1;
	quietUntil = 0;
	skipped = 0;
	constructor(interval, fn, name) {
		this.interval = interval, this.fn = fn, this.name = name;
	}
	get running() {
		return this.active;
	}
	set(active) {
		active === this.active || active && this.stopped || (this.active = active, active ? scheduler.activate(this) : scheduler.deactivate(this));
	}
	stop() {
		this.set(!1), this.stopped = !0;
	}
	call() {
		try {
			let result = this.fn();
			result instanceof Promise && result.catch((error) => this.fail(error));
		} catch (error) {
			this.fail(error);
		}
	}
	fail(error) {
		let now = GetGameTimer();
		if (now < this.quietUntil) {
			this.skipped++;
			return;
		}
		this.quietUntil = now + 1e4;
		let more = this.skipped ? ` (+${this.skipped} more)` : "";
		this.skipped = 0, log$1 ??= createLogger(GetCurrentResourceName()), log$1.error(`job "${this.name}" failed${more}`, error instanceof Error ? error.stack ?? error.message : error);
	}
};
function every(ms, fn, options = {}) {
	let job = new ScheduledJob(Math.max(0, Math.floor(ms)), fn, options.name ?? (fn.name || "anonymous"));
	return options.active !== !1 && job.set(!0), job;
}
IsDuplicityVersion(), IsDuplicityVersion(), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource);
// ../../../packages/lib/src/server/dispatch.ts
const core$15 = resourceExport(CORE.resource), dispatch = { alert: (alert) => core$15.SendDispatchAlert(alert) };
resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource);
// ../../../packages/lib/src/server/mdt.ts
const core$9 = resourceExport(CORE.resource), mdt = {
	record: (record) => core$9.AddMdtRecord(record),
	provider: () => core$9.GetMdtSystem()
};
resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource);
// resource/common/locale.ts
const Locale = createLocale(), ResourceName = GetCurrentResourceName();
IsDuplicityVersion();
// resource/common/prison.ts
const EVENTS = {
	state: "ai-prison:client:state",
	move: "ai-prison:client:move",
	workStart: "ai-prison:workStart",
	canteen: "ai-prison:canteen"
}, META = {
	minutes: "injail",
	items: "jailitems",
	leftAt: "ai:jailLeftAt"
}, BOLINGBROKE_OUT = {
	x: 1848.13,
	y: 2586.05,
	z: 44.67,
	heading: 269.5
}, CELL = {
	x: 1765.67,
	y: 2565.91,
	z: 45.56,
	heading: 1.5
}, CANTEEN = {
	x: 1781.53,
	y: 2557.61,
	z: 45.67
};
function readSettings(value) {
	let v = record(value), spawns = Array.isArray(v.spawns) ? v.spawns.flatMap((row) => readVec4(record(row).coords) ?? []) : [], corners = Array.isArray(v.zone) ? v.zone.flatMap((c) => readVec3(c) ?? []) : [];
	return {
		release: readVec4(v.release) ?? BOLINGBROKE_OUT,
		spawns: spawns.length ? spawns : [CELL],
		zone: polyFromCorners(corners, num(v.zoneHeight, 40, 5, 200)),
		maxMinutes: int(v.maxMinutes, 120, 1, 1e4),
		countOffline: v.countOffline === !0,
		confiscate: v.confiscate !== !1,
		escapePenalty: int(v.escapePenalty, 5, 0, 600),
		escapeAlert: v.escapeAlert !== !1,
		canteen: readVec3(v.canteen) ?? CANTEEN,
		canteenItem: str(v.canteenItem, "", 48),
		canteenCount: int(v.canteenCount, 1, 1, 10),
		canteenMinutes: int(v.canteenMinutes, 10, 0, 240)
	};
}
function readTask(id, v) {
	let coords = readVec3(v.coords);
	return coords ? {
		id,
		label: str(v.label, id, 48),
		coords,
		seconds: int(v.seconds, 10, 3, 120),
		minutesOff: int(v.minutesOff, 1, 0, 60),
		cooldown: int(v.cooldown, 120, 0, 3600)
	} : null;
}
// resource/server/schema/index.ts
const prisonSchema = {
	title: "ADMIN_TITLE",
	icon: "handcuffs",
	files: {
		settings: {
			kind: "settings",
			sync: "all",
			sections: {
				release: { type: "vec4" },
				spawns: {
					type: "list",
					max: 30,
					of: {
						type: "object",
						fields: { coords: { type: "vec4" } }
					}
				},
				zone: {
					type: "list",
					of: { type: "vec3" },
					min: 3,
					max: 32
				},
				zoneHeight: {
					type: "number",
					min: 5,
					max: 200
				},
				maxMinutes: {
					type: "number",
					min: 1,
					max: 1e4,
					integer: !0
				},
				countOffline: { type: "bool" },
				confiscate: { type: "bool" },
				escapePenalty: {
					type: "number",
					min: 0,
					max: 600,
					integer: !0
				},
				escapeAlert: { type: "bool" },
				canteen: { type: "vec3" },
				canteenItem: {
					type: "text",
					lookup: "item",
					min: 0,
					max: 48
				},
				canteenCount: {
					type: "number",
					min: 1,
					max: 10,
					integer: !0
				},
				canteenMinutes: {
					type: "number",
					min: 0,
					max: 240,
					integer: !0
				}
			}
		},
		tasks: {
			kind: "records",
			sync: "all",
			labelPath: "label",
			newRecord: {
				label: "",
				coords: {
					x: 0,
					y: 0,
					z: 0
				},
				seconds: 10,
				minutesOff: 1,
				cooldown: 120
			},
			sections: {
				label: {
					type: "text",
					min: 1,
					max: 48
				},
				coords: { type: "vec3" },
				seconds: {
					type: "number",
					min: 3,
					max: 120,
					integer: !0
				},
				minutesOff: {
					type: "number",
					min: 0,
					max: 60,
					integer: !0
				},
				cooldown: {
					type: "number",
					min: 0,
					max: 3600,
					integer: !0
				}
			}
		}
	},
	tabs: [
		{
			id: "prison",
			file: "settings",
			icon: "building-shield",
			label: "ADMIN_TAB_PRISON",
			desc: "ADMIN_TAB_PRISON_DESC",
			cards: [
				{
					icon: "bed",
					title: "ADMIN_C_CELLS",
					desc: "ADMIN_C_CELLS_DESC",
					fields: [{
						widget: "list",
						path: "spawns",
						label: "ADMIN_F_SPAWNS",
						addLabel: "ADMIN_ADD_SPAWN",
						max: 30,
						newRow: { coords: {
							x: 0,
							y: 0,
							z: 0,
							heading: 0
						} },
						rows: [{
							widget: "point",
							path: "coords",
							label: "ADMIN_F_SPAWN",
							heading: !0,
							ground: !0
						}]
					}, {
						widget: "point",
						path: "release",
						label: "ADMIN_F_RELEASE",
						hint: "ADMIN_H_RELEASE",
						heading: !0,
						ground: !0
					}]
				},
				{
					icon: "draw-polygon",
					title: "ADMIN_C_AREA",
					desc: "ADMIN_C_AREA_DESC",
					fields: [{
						widget: "zone",
						path: "zone",
						heightPath: "zoneHeight",
						label: "ADMIN_F_ZONE",
						hint: "ADMIN_H_ZONE"
					}, {
						widget: "number",
						path: "zoneHeight",
						label: "ADMIN_F_ZONE_HEIGHT",
						hint: "ADMIN_H_ZONE_HEIGHT",
						min: 5,
						max: 200,
						unit: "m"
					}]
				},
				{
					icon: "utensils",
					title: "ADMIN_C_CANTEEN",
					desc: "ADMIN_C_CANTEEN_DESC",
					fields: [
						{
							widget: "point",
							path: "canteen",
							label: "ADMIN_F_CANTEEN",
							ground: !0
						},
						{
							widget: "text",
							lookup: "item",
							path: "canteenItem",
							label: "ADMIN_F_CANTEEN_ITEM",
							hint: "ADMIN_H_CANTEEN_ITEM",
							placeholder: "ADMIN_P_CANTEEN_ITEM"
						},
						{
							widget: "number",
							path: "canteenCount",
							label: "ADMIN_F_CANTEEN_COUNT",
							min: 1,
							max: 10
						},
						{
							widget: "number",
							path: "canteenMinutes",
							label: "ADMIN_F_CANTEEN_MINUTES",
							hint: "ADMIN_H_CANTEEN_MINUTES",
							min: 0,
							max: 240,
							unit: "min"
						}
					]
				}
			]
		},
		{
			id: "rules",
			file: "settings",
			icon: "scale-balanced",
			label: "ADMIN_TAB_RULES",
			desc: "ADMIN_TAB_RULES_DESC",
			cards: [{
				icon: "gavel",
				title: "ADMIN_C_SENTENCE",
				desc: "ADMIN_C_SENTENCE_DESC",
				fields: [
					{
						widget: "number",
						path: "maxMinutes",
						label: "ADMIN_F_MAX_MINUTES",
						hint: "ADMIN_H_MAX_MINUTES",
						min: 1,
						max: 1e4,
						unit: "min"
					},
					{
						widget: "switch",
						path: "countOffline",
						label: "ADMIN_F_COUNT_OFFLINE",
						hint: "ADMIN_H_COUNT_OFFLINE"
					},
					{
						widget: "switch",
						path: "confiscate",
						label: "ADMIN_F_CONFISCATE",
						hint: "ADMIN_H_CONFISCATE"
					}
				]
			}, {
				icon: "person-running",
				title: "ADMIN_C_ESCAPE",
				desc: "ADMIN_C_ESCAPE_DESC",
				fields: [{
					widget: "number",
					path: "escapePenalty",
					label: "ADMIN_F_ESCAPE_PENALTY",
					hint: "ADMIN_H_ESCAPE_PENALTY",
					min: 0,
					max: 600,
					unit: "min"
				}, {
					widget: "switch",
					path: "escapeAlert",
					label: "ADMIN_F_ESCAPE_ALERT",
					hint: "ADMIN_H_ESCAPE_ALERT"
				}]
			}]
		},
		{
			id: "tasks",
			file: "tasks",
			icon: "screwdriver-wrench",
			label: "ADMIN_TAB_TASKS",
			desc: "ADMIN_TAB_TASKS_DESC",
			createLabel: "ADMIN_NEW_TASK",
			deleteLabel: "ADMIN_DELETE_TASK",
			deleteDesc: "ADMIN_DELETE_TASK_DESC",
			cards: [{
				icon: "screwdriver-wrench",
				title: "ADMIN_C_TASK",
				desc: "ADMIN_C_TASK_DESC",
				fields: [
					{
						widget: "text",
						path: "label",
						label: "ADMIN_F_TASK_LABEL",
						placeholder: "ADMIN_P_TASK_LABEL"
					},
					{
						widget: "point",
						path: "coords",
						label: "ADMIN_F_TASK_COORDS",
						hint: "ADMIN_H_TASK_COORDS",
						ground: !0
					},
					{
						widget: "number",
						path: "seconds",
						label: "ADMIN_F_TASK_SECONDS",
						min: 3,
						max: 120,
						unit: "s"
					},
					{
						widget: "number",
						path: "minutesOff",
						label: "ADMIN_F_TASK_MINUTES",
						hint: "ADMIN_H_TASK_MINUTES",
						min: 0,
						max: 60,
						unit: "min"
					},
					{
						widget: "number",
						path: "cooldown",
						label: "ADMIN_F_TASK_COOLDOWN",
						hint: "ADMIN_H_TASK_COOLDOWN",
						min: 0,
						max: 3600,
						unit: "s"
					}
				]
			}]
		}
	]
}, log = createLogger(ResourceName), core = resourceExport("ai-core"), panel = new AdminPanel(prisonSchema), settings = panel.view("settings", readSettings), tasks = panel.records("tasks", readTask), toItems = (value) => Array.isArray(value) ? value.flatMap((v) => isRecord(v) && typeof v.name == "string" && typeof v.count == "number" ? [{
	name: v.name,
	count: v.count,
	metadata: isRecord(v.metadata) ? v.metadata : {}
}] : []) : [], sentences = new class {
	jailed = new PlayerMap();
	writing = !1;
	minutesOf(source) {
		return this.jailed.get(source) ?? 0;
	}
	store(source, minutes) {
		this.writing = !0;
		try {
			core.SetMeta(source, META.minutes, minutes);
		} finally {
			this.writing = !1;
		}
		minutes > 0 ? this.jailed.set(source, minutes) : this.jailed.delete(source), emitNet(EVENTS.state, source, minutes);
	}
	toCell(source) {
		let spawns = settings.value.spawns;
		emitNet(EVENTS.move, source, pickRandom(spawns));
	}
	jail(source, minutes, by = 0) {
		if (!online.character(source)) return !1;
		let total = Math.min(Math.max(1, Math.floor(minutes)), settings.value.maxMinutes), first = !this.jailed.has(source);
		if (first && settings.value.confiscate && !toItems(core.GetMeta(source, META.items)).length) {
			let items = inventory.getItems(source).map(({ name, count, metadata }) => ({
				name,
				count,
				metadata
			}));
			core.SetMeta(source, META.items, items), inventory.clearInventory(source);
		}
		return this.store(source, total), first && this.toCell(source), notify(source, Locale("PRISON_JAILED", total), "warning", 8e3), aiLog("prison", `jailed for ${total} min`, {
			source: by || void 0,
			target: source,
			metadata: { minutes: total }
		}), mdt.record({
			kind: "jail",
			target: source,
			by: by || void 0,
			title: Locale("PRISON_RECORD_JAIL", total),
			minutes: total
		}), !0;
	}
	release(source, why) {
		if (this.jailed.has(source)) {
			this.store(source, 0);
			for (let item of toItems(core.GetMeta(source, META.items))) inventory.addItem(source, item.name, item.count, item.metadata) || log.warn(`could not give back ${item.count} ${item.name} to ${source}`);
			core.SetMeta(source, META.items, null), emitNet(EVENTS.move, source, settings.value.release), notify(source, Locale(why === "served" ? "PRISON_SERVED" : "PRISON_RELEASED"), "success", 8e3), aiLog("prison", why, { target: source });
		}
	}
	add(source, delta) {
		let left = this.minutesOf(source) + delta;
		return left <= 0 ? (this.release(source, "served"), 0) : (this.store(source, left), left);
	}
	load(source) {
		let minutes = Number(core.GetMeta(source, META.minutes)) || 0, leftAt = Number(core.GetMeta(source, META.leftAt)) || 0;
		if (leftAt && core.SetMeta(source, META.leftAt, null), !(minutes <= 0)) {
			if (settings.value.countOffline && leftAt && (minutes -= Math.floor((Date.now() - leftAt) / 6e4)), this.jailed.set(source, Math.max(1, minutes)), minutes <= 0) return this.release(source, "served");
			this.store(source, minutes), this.toCell(source);
		}
	}
	unload(source) {
		this.jailed.has(source) && (settings.value.countOffline && core.SetMeta(source, META.leftAt, Date.now()), this.jailed.delete(source));
	}
	external(source, value) {
		if (this.writing) return;
		let minutes = Number(value) || 0;
		minutes > 0 && minutes !== this.minutesOf(source) ? this.jail(source, minutes) : minutes <= 0 && this.jailed.has(source) && this.release(source, "released");
	}
	tick() {
		for (let source of this.jailed.keys()) this.add(source, -1);
	}
	checkEscapes() {
		let zone = settings.value.zone;
		if (zone) for (let source of this.jailed.keys()) {
			let at = coordsOf(source);
			if (!at || zoneContains(zone, at.x, at.y, at.z)) continue;
			let penalty = settings.value.escapePenalty;
			penalty > 0 && this.add(source, penalty), this.toCell(source), notify(source, Locale("PRISON_ESCAPE_CAUGHT", penalty), "error", 8e3), settings.value.escapeAlert && dispatch.alert({
				code: "10-98",
				title: Locale("ALERT_ESCAPE_TITLE"),
				message: Locale("ALERT_ESCAPE_MESSAGE"),
				coords: at,
				source,
				icon: "person-running",
				priority: "high"
			}), aiLog("prison", "escape attempt", {
				target: source,
				metadata: { penalty }
			});
		}
	}
}();
every(6e4, () => sentences.tick(), { name: "sentences" }), every(1e4, () => sentences.checkEscapes(), { name: "escapes" }), onCharacter({
	loaded: (source) => sentences.load(source),
	unloaded: (source) => sentences.unload(source)
}), on(CORE.metaChangedEvent, (source, key, value) => {
	key === META.minutes && sentences.external(source, value);
}), registerExport("JailPlayer", (source, minutes, by) => typeof source == "number" && typeof minutes == "number" && sentences.jail(source, minutes, typeof by == "number" ? by : 0)), registerExport("ReleasePlayer", (source) => typeof source != "number" || sentences.minutesOf(source) <= 0 ? !1 : (sentences.release(source, "released"), !0)), registerExport("GetJailTime", (source) => typeof source == "number" ? sentences.minutesOf(source) : 0), addCommand("jail", {
	help: Locale("COMMAND_JAIL"),
	params: [{
		name: "id",
		type: "playerId",
		help: Locale("COMMAND_P_ID")
	}, {
		name: "minutes",
		type: "number",
		help: Locale("COMMAND_P_MINUTES")
	}],
	restricted: !0
}, (source, { id, minutes }) => void sentences.jail(id, minutes, source)), addCommand("unjail", {
	help: Locale("COMMAND_UNJAIL"),
	params: [{
		name: "id",
		type: "playerId",
		help: Locale("COMMAND_P_ID")
	}],
	restricted: !0
}, (_source, { id }) => sentences.release(id, "released"));
// resource/server/work.ts
const guards = [hasCharacter()], cooldowns = new KeyedCooldowns();
onClientCallback(EVENTS.workStart, {
	args: oneArg((v) => readText(v, 64)),
	guards
}, (source, id) => {
	let task = tasks.get(id), charId = online.charId(source);
	return !task || charId === void 0 || sentences.minutesOf(source) <= 0 ? fail("PRISON_ERR_NOT_JAILED") : isNear(source, task.coords, 3) ? cooldowns.ready(`${charId}:${id}`) ? (work(source, task), { ok: !0 }) : fail("PRISON_ERR_TIRED") : fail("PRISON_ERR_FAR");
});
async function work(source, task) {
	let done = await progressFor(source, {
		label: Locale("PRISON_WORKING"),
		duration: task.seconds * 1e3,
		scenario: "WORLD_HUMAN_HAMMERING",
		disable: {
			move: !0,
			combat: !0
		}
	}), charId = online.charId(source);
	if (!done || charId === void 0 || sentences.minutesOf(source) <= 0 || !isNear(source, task.coords, 5)) return;
	cooldowns.start(`${charId}:${task.id}`, task.cooldown * 1e3);
	let minutes = sentences.add(source, -task.minutesOff);
	minutes > 0 && notify(source, Locale("PRISON_WORK_DONE", minutes), "success");
}
onClientCallback(EVENTS.canteen, (source) => {
	let s = settings.value, charId = online.charId(source);
	return charId === void 0 || sentences.minutesOf(source) <= 0 ? fail("PRISON_ERR_NOT_JAILED") : s.canteenItem ? isNear(source, s.canteen, 3) ? cooldowns.ready(`${charId}:canteen`) ? inventory.addItem(source, s.canteenItem, s.canteenCount) ? (cooldowns.start(`${charId}:canteen`, s.canteenMinutes * 6e4), { ok: !0 }) : fail("PRISON_ERR_FULL") : fail("PRISON_ERR_TIRED") : fail("PRISON_ERR_FAR") : fail("PRISON_ERR_CLOSED");
}, {
	guards,
	lock: !0
});

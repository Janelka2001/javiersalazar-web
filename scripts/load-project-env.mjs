import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const projectRoot = new URL('../', import.meta.url);
const inheritedKeys = new Set(Object.keys(process.env));
const loaded = {};

for (const filename of ['.env', '.env.local', '.env.production', '.env.production.local']) {
	const envPath = fileURLToPath(new URL(filename, projectRoot));

	if (existsSync(envPath)) {
		Object.assign(loaded, parseEnv(readFileSync(envPath, 'utf8')));
	}
}

for (const [key, value] of Object.entries(loaded)) {
	if (!inheritedKeys.has(key)) {
		process.env[key] = value;
	}
}

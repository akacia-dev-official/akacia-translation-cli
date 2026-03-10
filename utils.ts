import fs from "fs/promises";
import path from "path";
import { INPUT_FOLDER, LOCALES, SOURCE_LANG } from "./constants";
import { RecordFilter } from "./types";

/**
	Traverse a directory and subdir and return an array of all the JSON files
 */
export async function getJsonFiles(dir: string): Promise<string[]> {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			files.push(...(await getJsonFiles(fullPath)));
		} else if (entry.name.endsWith(".json")) {
			files.push(fullPath);
		}
	}

	return files;
}


/**
		 Remove the locale prefix to the file path.
 */
export function trimPathLocale(fullpath: string) {
	return fullpath.replace(path.join(INPUT_FOLDER, SOURCE_LANG), "");
}



export const getArgs = () =>
	process.argv.reduce((args: any, arg) => {
		// long arg
		if (arg.slice(0, 2) === "--") {
			const longArg = arg.split("=");
			const longArgFlag = longArg[0].slice(2);
			const longArgValue = longArg.length > 1 ? longArg[1] : true;
			args[longArgFlag] = longArgValue;
		}
		// flags
		else if (arg[0] === "-") {
			const flags = arg.slice(1).split("");
			flags.forEach((flag) => {
				args[flag] = true;
			});
		}
		return args;
	}, {});


export const validateLocale = (locale: string | null): string | null => {

	if (!locale) {
		console.error("No locale was provided, make sure to provide a locale using the --locale=... argument");
		return null;
	}

	const locales = Object.keys(LOCALES);
	const input = locale.trim().toLowerCase();

	// 1. Exact locale match (case-insensitive)
	const exact = locales.find(l => l.toLowerCase() === input);
	if (exact) {
		console.log(`Using locale: ${exact}`);
		return exact;
	}

	// 2. Short language match (e.g. "en" -> "en-US")
	const short = locales.find(l => l.toLowerCase().startsWith(input + "-"));
	if (short) {
		console.log(`Using locale: ${short}`);
		return short;
	}


	console.error(
		"The provided locale does not match any supported locale. Make sure to use a valid BCP 47 / IETF locale format."
	);

	return null;
};

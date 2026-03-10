import fs from "fs/promises";
import path from "path";
import {
	BATCH_SIZE,
	INPUT_FOLDER,
	LOCALES,
	LOG_FOLDER,
	SOURCE_LANG,
	REGEXP_PROTECTED,
	REGEXP_VARIABLE,
	TRANSLATION_FILTERS,
	DEFAULT_METHOD
} from "./constants";
import { Cache } from "./cache";
import { JSONProcessor, } from "./json-processor";
import { APIManager } from "./api/api-manager";
import { Logger } from "./logger";
import { Dico, Method, StringDico } from "./types";
import { getArgs, getJsonFiles, trimPathLocale, validateLocale } from "./utils";

const cache = new Cache();
const apiManager = new APIManager();
const jsonProcessor = new JSONProcessor();
const logger = new Logger();


/**
		Filter out the (flattened) keys that already exists so we don't translate them twice.
 */
function prepareBatch(flatSource: Dico, flatTarget: Dico, localeCache: StringDico) {

	const filteredSource = jsonProcessor.filter(flatSource, TRANSLATION_FILTERS);

	// Remove already translated key (already existing in the target file)
	const missingKeys = Object.keys(filteredSource).filter((k) => {
		const value = flatTarget[k as keyof typeof flatTarget];
		return !value || typeof value === "string" && value.trim() === "";
	});

	const toTranslate: Dico = {};


	// Prepare the batching array by ensuring source text is not already cached.
	for (const key of missingKeys) {

		const value = filteredSource[key as keyof typeof filteredSource];

		// continue is exists in cache
		if (localeCache[value as keyof typeof localeCache]) {
			flatTarget[key as keyof typeof flatTarget] = localeCache[value as keyof typeof localeCache];
			continue;
		}


		const protectedText = typeof value === "string" ? jsonProcessor.protectVariables(value, [REGEXP_VARIABLE, REGEXP_PROTECTED]) : value;

		// add it th the batch list
		toTranslate[key] = protectedText;

	}


	return toTranslate;

}

async function translateBatch(
	{
		locale,
		toTranslate,
		flatTarget,
		localeCache,
		dryRun = false,
		verbose = false,
		writeLog = false,
	}:
		{
			locale: string,
			toTranslate: Dico,
			flatTarget: Dico,
			localeCache: StringDico,
			method: Method,
			dryRun?: Boolean,
			verbose?: Boolean,
			writeLog?: Boolean,
		}) {

	const keys = Object.keys(toTranslate);
	for (let i = 0; i < keys.length; i += BATCH_SIZE) {

		const batchKeys = keys.slice(i, i + BATCH_SIZE);

		// get the batch of values to translate
		const batchValues = batchKeys.map(k => toTranslate[k]) as string[];

		// call API with batch of strings
		const translated = await apiManager.call(batchValues, locale);

		translated.forEach((t, index) => {
			const key = batchKeys[index];
			const sourceText = toTranslate[key];

			const restored = jsonProcessor.restoreVariables(t, index);
			flatTarget[key] = restored;

			localeCache[sourceText] = restored;

			if (writeLog)
				logger.push(locale, String(sourceText), String(restored));
		});
	}


}

async function processLocale(file: string, locale: string) {

	console.log(`Processing file ${file}...`);

	if (!file.endsWith(".json"))
		return console.error(`The provided file "${file}" needs to be a JSON. Skipping.`);


	// Get source file and flatten it
	file = trimPathLocale(file);
	const sourceJson = await jsonProcessor.readFileLocale(SOURCE_LANG, file);

	if (!sourceJson)
		return;

	const flatSource = jsonProcessor.flatten(sourceJson);

	// Get target file and flatten it
	const targetPath = path.join(INPUT_FOLDER, locale, file);
	const targetJson = await jsonProcessor.readFileLocale(locale, file);

	if (!targetJson)
		return;

	const flatTarget = jsonProcessor.flatten(targetJson);
	const localeCache = await cache.load(locale);

	const toTranslate = prepareBatch(flatSource, flatTarget, localeCache);

	await translateBatch({
		locale,
		toTranslate,
		flatTarget,
		localeCache,
		method: DEFAULT_METHOD,
	});

	await cache.save(locale, cache);

	const rebuilt = jsonProcessor.unflatten(flatTarget);

	await fs.mkdir(path.dirname(targetPath), { recursive: true });
	await fs.writeFile(targetPath, JSON.stringify(rebuilt, null, 2));

}


/**
 * --local : the lang
 * --input : folder or file
 * --output : output dir
 * --api
 * -log : enable logs
 * -verbose : enable verbose
 * -dry : dry run (no call to APIs)
 */
async function main() {

	let { locale, log, input, output } = getArgs();

	locale = validateLocale(locale);
	if (!locale)
		return;

	if (!input)
		return console.error("No folder or file where input, make sure to use the argument --input=FILE_PATH|DIR_PATH.");;


	if (!output)
		return console.error("No folder or file where set as output, make sure to use the argument --output=DIR_PATH.");


	// Determing input type (dir or file)
	const stat = await fs.stat(input);
	if (stat.isFile()) {
		await processLocale(input, locale);
	} else if (stat.isDirectory()) {
		const files = await getJsonFiles(path.join(input, SOURCE_LANG));
		for (const file of files)
			await processLocale(file, locale);
	} else {
		return console.error(`The provided input "${input}" is not valid.`);
	}


	if (log) {
		await logger.write();
		await logger.writeCSV();
	}
}

main();

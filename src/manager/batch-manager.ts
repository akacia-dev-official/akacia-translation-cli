import {
	LOCALES,
	REGEXP_PROTECTED,
	REGEXP_VARIABLE,
	TRANSLATION_FILTERS
} from "src/constants";
import { JSONProcessor } from "src/json-processor";
import { Dico } from "src/types";
import { Cache } from "src/cache";

export class BatchManager {

	batchSize: number = 0;

	constructor({ batchSize }: { batchSize: number }) {
		this.batchSize = batchSize;
	}


	getMissingKeys(filteredSource: Dico, flatTarget: Dico): string[] {

		// Remove already translated key (already existing in the target file)
		let missingKeys = Object.keys(filteredSource).filter((k) => {
			const value = flatTarget[k as keyof typeof flatTarget];
			return !value || typeof value === "string" && value.trim() === "";
		});

		return missingKeys;
	}

	/**
	* Filter out the (flattened) keys that already exists so we don't translate them twice.
	*/
	run(flatSource: Dico, flatTarget: Dico, targetLocale: keyof typeof LOCALES, jsonProcessor: JSONProcessor, cache?: Cache, override: Boolean = false) {

		const filteredSource: Dico = jsonProcessor.filter(flatSource, TRANSLATION_FILTERS);
		let keysToTranslate = Object.keys(filteredSource); // by default, all keys

		// if no override option, only keep missing keys in the target file
		if (!override)
			keysToTranslate = this.getMissingKeys(filteredSource, flatTarget);


		const toTranslate: Dico = {};

		// Prepare the batching array by ensuring source text is not already cached.
		for (const key of keysToTranslate) {

			const value = filteredSource[key as keyof typeof filteredSource];

			// continue is exists in cache
			if (cache) {
				const cachedValue = cache.find(targetLocale, String(value));
				if (cachedValue) {
					flatTarget[key as keyof typeof flatTarget] = cachedValue;
					continue;
				}
			}

			const protectedText = typeof value === "string" ? jsonProcessor.protectVariables(value, [REGEXP_VARIABLE, REGEXP_PROTECTED]) : value;

			// add it th the batch list
			toTranslate[key] = protectedText;
		}

		return toTranslate;

	}


}

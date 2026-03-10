import { DEFAULT_METHOD } from "../constants";


export class APIManager {

	#characterCount = 0;

	async call(strings: string[], locale: string, characterLimit: number = -1): Promise<string[]> {
  
		if (DEFAULT_METHOD === "GEMINI") {
			const prompt = `
Translate the following UI strings from English to ${locale}.
Return ONLY a JSON array in the same order.

${JSON.stringify(strings)}
`;

			// TODO: replace with real API call
			console.log("Calling Gemini...");
			return strings.map((s) => `[${locale}] ${s}`);
		}

		if (DEFAULT_METHOD === "GOOGLE_TRANSLATE") {
			// TODO: replace with real API call
			console.log("Calling Google Translate...");
			return strings.map((s) => `[${locale}] ${s}`);
		}

		return strings;

	}

}


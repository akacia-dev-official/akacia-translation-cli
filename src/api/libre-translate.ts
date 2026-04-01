import { LOCALES } from "src/constants";
import { spawn } from "child_process";

const LIBRE_TRANSLATE_LOADED_LOCALES = ["en", "fr", "zt", "th"] as const;

/**
 * Map standard locales to LibreTranslate format (the tricky one it zh-TW which doesn't simply become zh but zt)
 * @see: https://docs.libretranslate.com/guides/supported_languages/
 */
const LIBRE_TRANSLATE_LOCALES_MAP: Partial<Record<keyof typeof LOCALES, typeof LIBRE_TRANSLATE_LOADED_LOCALES[number]>> = {
	"en-US": "en",
	"en-GB": "en",
	"en-CA": "en",
	"en-AU": "en",
	"fr-FR": "fr",
	"fr-CA": "fr",
	"zh-TW": "zt",
	"th-TH": "th",
};


/**
 * Call the shell environment to start LibreTranslate local server
 * @description (unsuned) Have conflict with pipenv starting from within NodeJS shell environment
 *
 * @param host - The local server host address
 * @param port - The local server target port
 * @param port - The list of locales to perload
 * @returns The process onject
 * 
 */
async function startLibre(host: string, port: string, locales: readonly string[]) {
	const args = [
		"run",
		"libretranslate",
		"--load-only",
		locales.join(","),
		"--host",
		host,
		"--port",
		port,
	];

	const proc = spawn("pipenv", args, {
		stdio: "inherit",
		shell: false,
	});

	proc.on("error", (_) => {
		throw new Error("Failed to start LibreTranslate");
	});

	// Wait until the server responds
	const url = `http://${host}:${port}/languages`;
	await waitForLibre(url);

	return proc; // optionally return the process if you want to kill it later
}

/**
 * Loop and listen to see if LibreTranslate local server is started
 * @description (unsuned) Have conflict with pipenv starting from within NodeJS shell environment
 *
 * @param url - The LibreTranslate local server url
 * @param timeoutMs - How low until we reject (ms)
 * @exception throw error if the delay reach the timeout
 * @returns The resolved promise if the server call is successful or a new timeout promise if not  
 * 
 */
async function waitForLibre(url: string, timeoutMs = 5000) {
	const start = Date.now();

	while (true) {
		try {
			const res = await fetch(url);
			if (res.ok) return;
		} catch {}

		if (Date.now() - start > timeoutMs) {
			throw new Error("LibreTranslate did not start in time");
		}

		// wait 200ms before retry
		await new Promise((r) => setTimeout(r, 200));
	}
}


/**
 * Ensure the Libre Translate program is running by checking its running server URL
 * @description Since Libre Translate server runs locally (npm run libre) we need to
 * ensure the server is running before making any call.
 *
 * @param serverURL - The LibreTranslate local server url
 * @returns True if the server is indeeed running, False if not
 * @exception Throws error if the server is not running
 * 
 */
async function isLibreRunning(serverURL: string) {
	try {
		const res = await fetch(`${serverURL}/languages`, {
			signal: AbortSignal.timeout(1000)
		});

		if (res.ok) {
			console.log("(LibreTranslate already running)");
			return true;
		}

		return false;
	} catch {
		console.log("LibreTranslate not running");
		return false;
	}

}



/**
 * Call LibreTranslate API to translate 
 *
 * @param locale - The target locale to translate to
 * @param strings - The array of strings to translate
 * @param _attempt - (unused) The number of attempt we tried to reach the API
 * @returns The translated array of strings
 * 
 */
export async function LibreTranslate(locale: string, strings: string[], _attempt: number = 1) {

	// Libre Translate Config
	const localServerHost = process.env.LIBRE_TRANSLATE_SERVER_HOST;
	const localServerPort = process.env.LIBRE_TRANSLATE_SERVER_PORT;


	if (!localServerHost)
		throw new Error("No Server Host were found for Libre Translate, make sure the variable LIBRE_TRANSLATE_SERVER_HOST is set in .env");

	if (!localServerPort)
		throw new Error("No Server Host were found for Libre Translate, make sure the variable LIBRE_TRANSLATE_SERVER_PORT is set in .env");

	// Request server
	const localServerURL = `http://${localServerHost}:${localServerPort}`;


	// Start local server if not already launched
	if (!(await isLibreRunning(localServerURL)))
		//TODO: start libre translate directly from here
		throw new Error("Libre Translate server is not running, make sure to start it by running the comment 'npm run libre'.");


	const targetLocale = LIBRE_TRANSLATE_LOCALES_MAP[locale as keyof typeof LOCALES];

	if (!targetLocale)
		throw new Error("Target language not supported by Libre Translate API.");

	const res = await fetch(`${localServerURL}/translate`, {
		method: "POST",
		body: JSON.stringify({
			q: strings.join("\n"),
			source: "en",
			target: targetLocale,
		}),
		headers: {
			"Content-Type": "application/json"
		}
	});



	/*
	Typically return:
			 {
								translatedText: '內容\n' +
								'瀏覽最新 Web 設計工具\n' +
								'使用繁多的設計工具改善和放宽工作流程\n' +
								'模板\n' 
			 }
	 */

	const { translatedText } = await res.json();

	if (!translatedText)
		throw new Error("Unable to retrieve translatedText key from the returned json");

	return translatedText.split('\n');

}

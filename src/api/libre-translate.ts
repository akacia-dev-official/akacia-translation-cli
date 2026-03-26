import { LOCALES } from "src/constants";



export default async function LibreTranslate(locale: string, strings: string[], attempt: number = 1) {

	const localServerHost = process.env.LIBRE_TRANSLATE_SERVER_HOST;
	const localServerPort = process.env.LIBRE_TRANSLATE_SERVER_PORT;
	const libreTranslateLoadedLocales = ["en", "fr", "zt"] as const;

	if (!localServerHost)
		throw new Error("No Server Host were found for Libre Translate, make sure the variable LIBRE_TRANSLATE_SERVER_HOST is set in .env");

	if (!localServerPort)
		throw new Error("No Server Host were found for Libre Translate, make sure the variable LIBRE_TRANSLATE_SERVER_PORT is set in .env");

	// Start local server if not already launched


	// Request server
	const localServerURL = `http://${localServerHost}:${localServerPort}/translate`;

	// Map standard locales to LibreTranslate format (the tricky one it zh-TW which doesn't simply become zh but zt)
	const libreTranslateLocalesMap: Partial<Record<keyof typeof LOCALES, typeof libreTranslateLoadedLocales[number]>> = {
		"en-US": "en",
		"en-GB": "en",
		"en-CA": "en",
		"en-AU": "en",
		"fr-FR": "fr",
		"fr-CA": "fr",
		"zh-TW": "zt",
	};

	const targetLocale = libreTranslateLocalesMap[locale as keyof typeof LOCALES];

	if (!targetLocale)
		throw new Error("No Server Host were found for Libre Translate, make sure the variable LIBRE_TRANSLATE_SERVER_PORT is set in .env");

	const res = await fetch(localServerURL, {
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
	
	 ```
	 {
		 translatedText: '內容\n' +
			 '瀏覽最新 Web 設計工具\n' +
			 '使用繁多的設計工具改善和放宽工作流程\n' +
			 '模板\n' +
			 '模板\n' +
			 '要啟動您新設計專案或下一個演示文稿的最新文件\n' +
			 '模組\n' +
			 '模組\n' 
		}
          ```
	 */

	const { translatedText } = await res.json();

	if (!translatedText)
		throw new Error("Unable to retrieve translatedText key from the returned json");

	return translatedText.split('\n');

}

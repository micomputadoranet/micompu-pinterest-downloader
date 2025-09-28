const pinterest = require('./src/pinterestService');

(async () => {
	const url = process.argv[2];
	if (!url) {
		console.log('Uso: node index.js <URL_DEL_PIN>');
		process.exit(1);
	}

	console.log('Descargando desde:', url);
	const result = await pinterest.downloadVideo(url);
	console.log(result);

	await pinterest.closeBrowser();
})();

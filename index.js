const pinterest = require('./src/pinterestService');

(async () => {
	const url = process.argv[2];
	if (!url) {
		console.log('Use: node index.js <PIN_URL>');
		process.exit(1);
	}

	console.log('Downloading from:', url);
	const result = await pinterest.downloadVideo(url);
	console.log(result);

	await pinterest.closeBrowser();
})();

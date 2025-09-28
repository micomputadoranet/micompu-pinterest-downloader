const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

puppeteer.use(StealthPlugin());

const waitForTimeout = (ms) => new Promise((r) => setTimeout(r, ms));

class PinterestService {
	constructor() {
		this.browser = null;
		this.downloadsDir = path.join(__dirname, '../downloads');
		this.ensureDownloadsDir();
	}

	ensureDownloadsDir() {
		if (!fs.existsSync(this.downloadsDir)) {
			fs.mkdirSync(this.downloadsDir, { recursive: true });
		}
	}

	async initBrowser() {
		if (!this.browser) {
			const chromePaths = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'];
			const executablePath = chromePaths.find(fs.existsSync);

			this.browser = await puppeteer.launch({
				headless: true,
				timeout: 60000, // 60s en vez de 30s
				executablePath, // <- ahora le dices cuál Chrome usar
				args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
			});
		}
		return this.browser;
	}

	async closeBrowser() {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
		}
	}

	async downloadVideo(pinUrl) {
		let page = null;
		try {
			console.log('Downloading:', pinUrl);

			if (!this.isValidPinterestUrl(pinUrl)) {
				throw new Error('Invalid Pinterest URL');
			}

			const browser = await this.initBrowser();
			page = await browser.newPage();

			// Configurar user-agent moderno
			await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
			await page.setViewport({ width: 1920, height: 1080 });

			// Configurar timeouts
			page.setDefaultTimeout(45000);
			page.setDefaultNavigationTimeout(45000);

			console.log('Browsing URL...');
			await page.goto(pinUrl, {
				waitUntil: 'networkidle2',
				timeout: 45000,
			});

			// Esperar a que cargue
			await waitForTimeout(5000);

			// Intentar obtener video
			const videoInfo = await this.extractVideoInfo(page, pinUrl);

			if (videoInfo.videoUrl) {
				console.log('Found Video URL:', videoInfo.videoUrl);

				// Descargar el video
				const downloadResult = await this.downloadVideoFile(videoInfo.videoUrl, videoInfo.filename);

				return {
					success: true,
					type: 'video',
					filename: downloadResult.filename,
					filepath: downloadResult.filepath,
					mediaUrl: videoInfo.videoUrl,
					title: videoInfo.title || 'Pinterest Video',
					message: 'Video download success',
				};
			}

			// Si no hay video, intentar con imagen
			const imageInfo = await page.evaluate(() => {
				const result = {};
				const metaImage = document.querySelector('meta[property="og:image"]');
				if (metaImage && metaImage.content) {
					result.imageUrl = metaImage.content;
					return result;
				}
				const img = document.querySelector('img');
				if (img && img.src) {
					result.imageUrl = img.src;
					return result;
				}
				return result;
			});

			if (imageInfo.imageUrl) {
				console.log('Image URL found:', imageInfo.imageUrl);

				// Descargar imagen
				const filename = `pinterest_image_${Date.now()}.jpg`;
				const filepath = path.join(this.downloadsDir, filename);

				const writer = fs.createWriteStream(filepath);
				const response = await axios.get(imageInfo.imageUrl, {
					responseType: 'stream',
				});
				response.data.pipe(writer);

				await new Promise((resolve, reject) => {
					writer.on('finish', resolve);
					writer.on('error', reject);
				});

				return {
					success: true,
					type: 'image',
					filename,
					filepath,
					mediaUrl: imageInfo.imageUrl,
					title: 'Pinterest Image',
					message: 'Image download success',
				};
			}

			// Si no hay ni video ni imagen
			return {
				success: false,
				error: 'NO_MEDIA',
				message: 'No video or image on this pin',
			};
		} catch (error) {
			console.error('Error en PinterestService:', error);
			return {
				success: false,
				error: error.message,
				message: `Error downloading: ${error.message}`,
			};
		} finally {
			if (page) {
				await page.close();
			}
		}
	}

	

	async extractVideoInfo(page, pinUrl) {
		// Método 1: Buscar en elementos de video
		let videoInfo = await page.evaluate(() => {
			const result = {};

			// Buscar elemento video directo
			const videoElement = document.querySelector('video');
			if (videoElement) {
				const url = videoElement.src || videoElement.currentSrc;
				if (url && !url.startsWith('blob:')) {
					result.videoUrl = url;
					return result;
				}
			}

			// Buscar en source tags dentro de video
			const sourceElements = document.querySelectorAll('video source');
			for (let source of sourceElements) {
				if (source.src && !source.src.startsWith('blob:')) {
					result.videoUrl = source.src;
					return result;
				}
			}

			// Buscar en meta tags
			const metaVideo = document.querySelector('meta[property="og:video"]');
			if (metaVideo && metaVideo.content && !metaVideo.content.startsWith('blob:')) {
				result.videoUrl = metaVideo.content;
				return result;
			}

			const metaVideoUrl = document.querySelector('meta[property="og:video:url"]');
			if (metaVideoUrl && metaVideoUrl.content && !metaVideoUrl.content.startsWith('blob:')) {
				result.videoUrl = metaVideoUrl.content;
				return result;
			}

			return result; // Si no encuentra nada aquí, seguimos afuera
		});

		// Método 2: Buscar en scripts JSON (corregido, ejecuta en Node)
		if (!videoInfo.videoUrl) {
			const scripts = await page.$$eval('script[type="application/json"]', (elements) => elements.map((el) => el.textContent));

			for (const script of scripts) {
				try {
					const data = JSON.parse(script);
					const videoUrl = this.findVideoUrlInObject(data); // Ahora sí funciona en Node
					if (videoUrl && !videoUrl.startsWith('blob:')) {
						videoInfo.videoUrl = videoUrl;
						break;
					}
				} catch (e) {
					// Ignorar errores de parse
				}
			}
		}

		// Método 3: Fallback con axios/regex
		if (!videoInfo.videoUrl) {
			videoInfo = await this.fallbackExtraction(pinUrl);
		}

		// Generar nombre de archivo
		if (videoInfo.videoUrl) {
			videoInfo.filename = this.generateFilename(videoInfo.videoUrl);
		}

		return videoInfo;
	}

	

	findVideoUrlInObject(obj) {
		if (typeof obj !== 'object' || obj === null) return null;

		// Buscar URLs de video en diferentes estructuras
		if (typeof obj === 'string' && obj.match(/\.mp4(\?|$)/)) {
			return obj;
		}

		if (obj.url && typeof obj.url === 'string' && obj.url.match(/\.mp4(\?|$)/)) {
			return obj.url;
		}

		if (obj.video_url && typeof obj.video_url === 'string') {
			return obj.video_url;
		}

		if (obj.videoUrl && typeof obj.videoUrl === 'string') {
			return obj.videoUrl;
		}

		if (obj.videos && typeof obj.videos === 'object') {
			const videoList = obj.videos.video_list || obj.videos;
			if (videoList) {
				// Obtener la mejor calidad disponible
				const qualities = Object.keys(videoList).sort((a, b) => {
					const qualityOrder = { V_720P: 3, V_480P: 2, V_360P: 1, V_240P: 0 };
					return (qualityOrder[b] || 0) - (qualityOrder[a] || 0);
				});

				if (qualities.length > 0 && videoList[qualities[0]].url) {
					return videoList[qualities[0]].url;
				}
			}
		}

		// Buscar recursivamente en objetos y arrays
		for (let key in obj) {
			if (obj.hasOwnProperty(key)) {
				const result = this.findVideoUrlInObject(obj[key]);
				if (result) return result;
			}
		}

		return null;
	}

	async fallbackExtraction(pinUrl) {
		try {
			const response = await axios.get(pinUrl, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
					Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
					'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
				},
				timeout: 10000,
			});

			// Buscar URL de video en el HTML
			const videoUrlMatches = response.data.match(/"video_url":"([^"]+)"/) || response.data.match(/"url":"([^"]+\.mp4[^"]*)"/) || response.data.match(/<meta property="og:video" content="([^"]+)"/);

			if (videoUrlMatches && videoUrlMatches[1]) {
				let videoUrl = videoUrlMatches[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
				return { videoUrl: videoUrl };
			}
		} catch (error) {
			console.log('Fallback extraction failed:', error.message);
		}

		return {};
	}

	async downloadVideoFile(videoUrl, customFilename = null) {
		return new Promise((resolve, reject) => {
			const filename = customFilename || `pinterest_video_${Date.now()}.mp4`;
			const filepath = path.join(this.downloadsDir, filename);

			const file = fs.createWriteStream(filepath);
			const protocol = videoUrl.startsWith('https') ? https : http;

			const request = protocol
				.get(videoUrl, (response) => {
					if (response.statusCode !== 200) {
						reject(new Error(`HTTP ${response.statusCode}`));
						return;
					}

					const contentLength = parseInt(response.headers['content-length'], 10);
					let downloadedLength = 0;

					response.on('data', (chunk) => {
						downloadedLength += chunk.length;
						if (contentLength) {
							const percent = ((downloadedLength / contentLength) * 100).toFixed(2);
							console.log(`Downloading: ${percent}%`);
						}
					});

					response.pipe(file);

					file.on('finish', () => {
						file.close();
						console.log('Download completed:', filename);
						resolve({ filename, filepath });
					});
				})
				.on('error', (err) => {
					fs.unlink(filepath, () => reject(err));
				});

			request.setTimeout(60000, () => {
				request.destroy();
				reject(new Error('Download Timeout'));
			});
		});
	}

	generateFilename(videoUrl) {
		const timestamp = Date.now();
		const randomId = Math.random().toString(36).substring(2, 8);
		return `pinterest_video_${timestamp}_${randomId}.mp4`;
	}

	isValidPinterestUrl(url) {
		try {
			const parsedUrl = new URL(url);
			return parsedUrl.hostname.includes('pinterest.com') && parsedUrl.pathname.includes('/pin/');
		} catch (error) {
			return false;
		}
	}

	async getDownloadedVideos() {
		try {
			const files = fs.readdirSync(this.downloadsDir);
			return files
				.filter((file) => file.endsWith('.mp4'))
				.map((file) => {
					const filepath = path.join(this.downloadsDir, file);
					const stats = fs.statSync(filepath);
					return {
						filename: file,
						filepath: filepath,
						size: this.formatFileSize(stats.size),
						created: stats.birthtime,
					};
				});
		} catch (error) {
			return [];
		}
	}

	formatFileSize(bytes) {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	async cleanupOldFiles(maxAgeHours = 24) {
		try {
			const files = await this.getDownloadedVideos();
			const now = Date.now();
			const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

			for (const file of files) {
				const fileAge = now - file.created.getTime();
				if (fileAge > maxAgeMs) {
					fs.unlinkSync(file.filepath);
					console.log('Archivo eliminado:', file.filename);
				}
			}
		} catch (error) {
			console.error('Error en cleanup:', error);
		}
	}
}

module.exports = new PinterestService();

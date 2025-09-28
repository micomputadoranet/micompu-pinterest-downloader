# Micompu Pinterest Downloader

A simple Node.js module to download videos and images from Pinterest.


## 🚀 Installation

```bash
git clone https://github.com/tuusuario/pinterest-downloader.git
cd micompu-pinterest-downloader
npm install
````

## 📌 Usage

```bash
node index.js <URL_DEL_PIN>
```

Example:

node index.js https://www.pinterest.com/pin/676595544059507203/

 Files will be saved in the `downloads/` folder.

## 📂  Project Structure

```
micompu-pinterest-downloader/
│
├── src/
│   └── pinterestService.js   # Main download logic
│
├── downloads/                # Folder where files are saved
├── index.js                  # Entry point
├── package.json
├── .gitignore
└── README.md
```

## 🔧 Dependencies

* [puppeteer-extra](https://www.npmjs.com/package/puppeteer-extra)
* [puppeteer-extra-plugin-stealth](https://www.npmjs.com/package/puppeteer-extra-plugin-stealth)
* [puppeteer](https://www.npmjs.com/package/puppeteer)
* [axios](https://www.npmjs.com/package/axios)

## 📄 License

MIT

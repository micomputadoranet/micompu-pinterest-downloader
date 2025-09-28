# Pinterest Downloader

Un módulo sencillo en Node.js para descargar **videos e imágenes** de Pinterest usando Puppeteer.

## 🚀 Instalación

```bash
git clone https://github.com/tuusuario/pinterest-downloader.git
cd micompu-pinterest-downloader
npm install
````

## 📌 Uso

```bash
node index.js <URL_DEL_PIN>
```

Ejemplo:

node index.js https://www.pinterest.com/pin/676595544059507203/

 Los archivos se guardarán en la carpeta `downloads/`.

## 📂 Estructura del proyecto

```
micompu-pinterest-downloader/
│
├── src/
│   └── pinterestService.js   # Lógica principal de descargas
│
├── downloads/                # Carpeta donde se guardan los archivos
├── index.js                  # Punto de entrada
├── package.json
├── .gitignore
└── README.md
```

## 🔧 Dependencias

* [puppeteer-extra](https://www.npmjs.com/package/puppeteer-extra)
* [puppeteer-extra-plugin-stealth](https://www.npmjs.com/package/puppeteer-extra-plugin-stealth)
* [puppeteer](https://www.npmjs.com/package/puppeteer)
* [axios](https://www.npmjs.com/package/axios)

## 📄 Licencia

MIT

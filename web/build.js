const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname);
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

const filesToCopy = ['index.html', 'index.css', 'app.js'];
filesToCopy.forEach(file => {
    const src = path.join(srcDir, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(distDir, file));
    }
});

console.log('Build completed. Files copied to dist/');

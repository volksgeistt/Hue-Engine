class ColorPaletteExtractor {
    constructor() {
        this.uploadBox = document.getElementById('uploadBox');
        this.fileInput = document.getElementById('fileInput');
        this.results = document.getElementById('results');
        this.loading = document.getElementById('loading');
        this.dominantPalette = document.getElementById('dominantPalette');
        this.themePalettes = document.getElementById('themePalettes');
        
        this.isDragging = false;
        this.isProcessing = false;
        this.currentImage = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
    }
    
    setupEventListeners() {
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0 && !this.isProcessing) {
                this.handleFile(e.target.files[0]);
            }
        });
        
        this.uploadBox.addEventListener('click', (e) => {
            if (this.shouldOpenFileInput(e)) {
                this.fileInput.click();
            }
        });
    }
    
    setupDragAndDrop() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.uploadBox.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            this.uploadBox.addEventListener(eventName, () => {
                this.isDragging = true;
                this.uploadBox.classList.add('dragover');
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            this.uploadBox.addEventListener(eventName, (e) => {
                if (eventName === 'dragleave' && this.uploadBox.contains(e.relatedTarget)) {
                    return;
                }
                this.isDragging = false;
                this.uploadBox.classList.remove('dragover');
            });
        });
        
        this.uploadBox.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0 && !this.isProcessing) {
                this.handleFile(files[0]);
            }
        });
    }
    
    shouldOpenFileInput(e) {
        const excludedClasses = ['image-preview', 'btn'];
        const excludedIds = ['chooseAnotherBtn'];
        
        return !excludedClasses.some(cls => e.target.classList.contains(cls)) &&
               !excludedIds.includes(e.target.id) &&
               !this.isProcessing &&
               !this.isDragging &&
               this.results.style.display === 'none';
    }
    
    async handleFile(file) {
        if (this.isProcessing) return;
        
        if (!this.isValidImageFile(file)) {
            this.showToast('Please select a valid image file (PNG, JPG, WEBP, GIF, BMP, SVG, TIFF, ICO)', 'error');
            return;
        }
        
        this.isProcessing = true;
        
        try {
            const imageSrc = await this.readFileAsDataURL(file);
            this.showLoading(true);
            await this.extractColors(imageSrc);
        } catch (error) {
            console.error('Error processing file:', error);
            this.showToast('Error processing image. Please try again.', 'error');
            this.isProcessing = false;
        }
    }
    
    isValidImageFile(file) {
        const validTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
            'image/bmp', 'image/webp', 'image/svg+xml', 'image/tiff', 'image/ico'
        ];
        const validExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|ico)$/i;
        
        return validTypes.includes(file.type) || validExtensions.test(file.name);
    }
    
    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }
    
    showLoading(show) {
        this.loading.style.display = show ? 'block' : 'none';
        this.results.style.display = show ? 'none' : 'block';
        if (!show) {
            this.isProcessing = false;
        }
    }
    
    async extractColors(imageSrc) {
        try {
            const img = await this.loadImage(imageSrc);
            this.currentImage = imageSrc;
            
            const canvas = this.createCanvas(img);
            const imageData = this.getImageData(canvas, img);
            
            this.updateUploadBox(imageSrc);
            
            const colors = this.analyzeImageData(imageData);
            const enhancedColors = this.enhanceColorPalette(colors);
            
            this.showLoading(false);
            this.displayResults(enhancedColors);
        } catch (error) {
            console.error('Error extracting colors:', error);
            this.showToast('Error analyzing image. Please try again.', 'error');
            this.isProcessing = false;
            this.showLoading(false);
        }
    }
    
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = src;
        });
    }
    
    createCanvas(img) {
        const canvas = document.createElement('canvas');
        const maxSize = 300;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height);
        
        canvas.width = Math.max(1, Math.floor(img.width * ratio));
        canvas.height = Math.max(1, Math.floor(img.height * ratio));
        
        return canvas;
    }
    
    getImageData(canvas, img) {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    
    analyzeImageData(imageData) {
        const data = imageData.data;
        const colorCounts = new Map();
        const skipPixels = Math.max(1, Math.floor(data.length / 40000));
        
        for (let i = 0; i < data.length; i += skipPixels * 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            if (a < 128) continue; 
            
            const quantizedColor = this.quantizeColor(r, g, b);
            const key = `${quantizedColor.r},${quantizedColor.g},${quantizedColor.b}`;
            
            colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
        }
        
        return this.getTopColors(colorCounts, 12);
    }
    
    quantizeColor(r, g, b) {
        const factor = 24;
        return {
            r: Math.round(r / factor) * factor,
            g: Math.round(g / factor) * factor,
            b: Math.round(b / factor) * factor
        };
    }
    
    getTopColors(colorCounts, count) {
        return Array.from(colorCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, count)
            .map(([colorKey, frequency]) => {
                const [r, g, b] = colorKey.split(',').map(Number);
                return { r, g, b, frequency };
            });
    }
    
    enhanceColorPalette(colors) {
        const filteredColors = this.filterSimilarColors(colors);
        
        return filteredColors
            .map(color => ({
                ...color,
                impact: this.calculateVisualImpact(color)
            }))
            .sort((a, b) => b.impact - a.impact)
            .slice(0, 8);
    }
    
    filterSimilarColors(colors, threshold = 30) {
        const filtered = [colors[0]];
        
        for (let i = 1; i < colors.length; i++) {
            const currentColor = colors[i];
            const isSimilar = filtered.some(existingColor => 
                this.calculateColorDistance(currentColor, existingColor) < threshold
            );
            
            if (!isSimilar) {
                filtered.push(currentColor);
            }
        }
        
        return filtered;
    }
    
    calculateColorDistance(color1, color2) {
        const dr = color1.r - color2.r;
        const dg = color1.g - color2.g;
        const db = color1.b - color2.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }
    
    calculateVisualImpact(color) {
        const { h, s, l } = this.rgbToHsl(color.r, color.g, color.b);
        return color.frequency * (1 + s / 100) * (1 + Math.abs(l - 50) / 50);
    }
    
    updateUploadBox(imageSrc) {
        this.uploadBox.innerHTML = `
            <img src="${imageSrc}" class="image-preview" alt="Uploaded image">
            <div class="upload-text">Image Uploaded : ✅</div>
            <button class="btn" id="chooseAnotherBtn">Choose Another Image</button>
        `;
        
        document.getElementById('chooseAnotherBtn').addEventListener('click', () => {
            this.chooseNewImage();
        });
    }
    
    chooseNewImage() {
        if (this.isProcessing) return;
        
        this.isProcessing = false;
        this.currentImage = null;
        this.fileInput.value = '';
        
        this.uploadBox.innerHTML = `
            <div class="upload-icon">📸</div>
            <div class="upload-text">Drop your image here or click to browse</div>
            <button class="btn" onclick="document.getElementById('fileInput').click()">Choose Image</button>
        `;
        
        this.results.style.display = 'none';
        this.loading.style.display = 'none';
        
        setTimeout(() => this.fileInput.click(), 100);
    }
    
    displayResults(colors) {
        this.displayDominantColors(colors);
        this.displayThemePalettes(colors);
    }
    
    displayDominantColors(colors) {
        const colorRow = this.createColorRow(colors);
        const colorInfo = this.createColorInfo(colors);
        
        this.dominantPalette.innerHTML = '';
        this.dominantPalette.appendChild(colorRow);
        this.dominantPalette.appendChild(colorInfo);
    }
    
    createColorRow(colors) {
        const colorRow = document.createElement('div');
        colorRow.className = 'color-row';
        
        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
            swatch.title = `Click to copy ${this.rgbToHex(color.r, color.g, color.b)}`;
            swatch.addEventListener('click', () => {
                this.copyColor(this.rgbToHex(color.r, color.g, color.b));
            });
            colorRow.appendChild(swatch);
        });
        
        return colorRow;
    }
    
    createColorInfo(colors) {
        const colorInfo = document.createElement('div');
        colorInfo.className = 'color-info';
        
        colors.forEach(color => {
            const hex = this.rgbToHex(color.r, color.g, color.b);
            const code = document.createElement('div');
            code.className = 'color-code';
            code.textContent = hex;
            code.title = `Click to copy ${hex}`;
            code.addEventListener('click', () => this.copyColor(hex));
            colorInfo.appendChild(code);
        });
        
        return colorInfo;
    }
    
    displayThemePalettes(baseColors) {
        const themes = [
            { name: 'Monochromatic', generator: this.generateMonochromatic.bind(this) },
            { name: 'Analogous', generator: this.generateAnalogous.bind(this) },
            { name: 'Complementary', generator: this.generateComplementary.bind(this) },
            { name: 'Triadic', generator: this.generateTriadic.bind(this) },
            { name: 'Split Complementary', generator: this.generateSplitComplementary.bind(this) },
        ];
        
        this.themePalettes.innerHTML = '';
        
        themes.forEach(theme => {
            const mainColor = baseColors[0];
            const palette = theme.generator(mainColor);
            const card = this.createThemeCard(theme.name, palette);
            this.themePalettes.appendChild(card);
        });
    }
    
    createThemeCard(name, palette) {
        const card = document.createElement('div');
        card.className = 'palette-card';
        
        const title = document.createElement('div');
        title.className = 'palette-title';
        title.textContent = ` ${name}`;
        
        const colorRow = document.createElement('div');
        colorRow.className = 'color-row';
        
        palette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.title = `Click to copy ${color}`;
            swatch.addEventListener('click', () => this.copyColor(color));
            colorRow.appendChild(swatch);
        });
        
        const colorInfo = document.createElement('div');
        colorInfo.className = 'color-info';
        
        palette.forEach(color => {
            const code = document.createElement('div');
            code.className = 'color-code';
            code.textContent = color;
            code.title = `Click to copy ${color}`;
            code.addEventListener('click', () => this.copyColor(color));
            colorInfo.appendChild(code);
        });
        
        card.appendChild(title);
        card.appendChild(colorRow);
        card.appendChild(colorInfo);
        
        return card;
    }
    
    generateMonochromatic(color) {
        const { h, s, l } = this.rgbToHsl(color.r, color.g, color.b);
        const variations = [-40, -20, 0, 20, 40];
        
        return variations.map(variation => {
            const newL = Math.max(0, Math.min(100, l + variation));
            return this.hslToHex(h, s, newL);
        });
    }
    
    generateAnalogous(color) {
        const { h, s, l } = this.rgbToHsl(color.r, color.g, color.b);
        const angles = [-60, -30, 0, 30, 60];
        
        return angles.map(angle => {
            const newH = (h + angle + 360) % 360;
            return this.hslToHex(newH, s, l);
        });
    }
    
    generateComplementary(color) {
        const { h, s, l } = this.rgbToHsl(color.r, color.g, color.b);
        const complementary = (h + 180) % 360;
        
        return [
            this.hslToHex(h, s, Math.max(0, l - 20)),
            this.hslToHex(h, s, l),
            this.hslToHex(h, s, Math.min(100, l + 20)),
            this.hslToHex(complementary, s, Math.max(0, l - 10)),
            this.hslToHex(complementary, s, l)
        ];
    }
    
    generateTriadic(color) {
        const { h, s, l } = this.rgbToHsl(color.r, color.g, color.b);
        const angles = [0, 120, 240];
        
        return [
            ...angles.map(angle => {
                const newH = (h + angle) % 360;
                return this.hslToHex(newH, s, l);
            }),
            this.hslToHex(h, Math.max(0, s - 30), l),
            this.hslToHex((h + 120) % 360, Math.max(0, s - 30), l)
        ];
    }
    
    generateSplitComplementary(color) {
        const { h, s, l } = this.rgbToHsl(color.r, color.g, color.b);
        const complementary = (h + 180) % 360;
        
        return [
            this.hslToHex(h, s, l),
            this.hslToHex((complementary - 30 + 360) % 360, s, l),
            this.hslToHex((complementary + 30) % 360, s, l),
            this.hslToHex(h, Math.max(0, s - 20), Math.max(0, l - 15)),
            this.hslToHex(h, Math.max(0, s - 20), Math.min(100, l + 15))
        ];
    }
    

    rgbToHex(r, g, b) {
        const toHex = (n) => {
            const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }
    
    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        const sum = max + min;
        
        let h = 0;
        let s = 0;
        const l = sum / 2;
        
        if (diff !== 0) {
            s = l > 0.5 ? diff / (2 - sum) : diff / sum;
            
            switch (max) {
                case r:
                    h = ((g - b) / diff) + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / diff + 2;
                    break;
                case b:
                    h = (r - g) / diff + 4;
                    break;
            }
            h /= 6;
        }
        
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }
    
    hslToHex(h, s, l) {
        h = ((h % 360) + 360) % 360;
        s = Math.max(0, Math.min(100, s)) / 100;
        l = Math.max(0, Math.min(100, l)) / 100;
        
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        
        let r = 0, g = 0, b = 0;
        
        if (h >= 0 && h < 60) {
            r = c; g = x; b = 0;
        } else if (h >= 60 && h < 120) {
            r = x; g = c; b = 0;
        } else if (h >= 120 && h < 180) {
            r = 0; g = c; b = x;
        } else if (h >= 180 && h < 240) {
            r = 0; g = x; b = c;
        } else if (h >= 240 && h < 300) {
            r = x; g = 0; b = c;
        } else if (h >= 300 && h < 360) {
            r = c; g = 0; b = x;
        }
        
        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);
        
        return this.rgbToHex(r, g, b);
    }
    
    async copyColor(color) {
        try {
            await navigator.clipboard.writeText(color);
            this.showToast(`Copied ${color} to clipboard!`);
        } catch (err) {
            console.warn('Clipboard API not available, using fallback');
            this.fallbackCopyColor(color);
        }
    }
    
    fallbackCopyColor(color) {
        const textArea = document.createElement('textarea');
        textArea.value = color;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showToast(`Copied ${color} to clipboard!`);
        } catch (err) {
            console.error('Failed to copy color:', err);
            this.showToast('Failed to copy color. Please copy manually.', 'error');
        } finally {
            document.body.removeChild(textArea);
        }
    }
    
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ColorPaletteExtractor();
});

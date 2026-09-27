const canvas = document.getElementById('drawing-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const colorPicker = document.getElementById('color-picker') as HTMLDivElement;
const brushSizeInput = document.getElementById('brush-size') as HTMLInputElement;
const brushSizeLabel = document.getElementById('brush-size-label') as HTMLSpanElement;
const eraserBtn = document.getElementById('eraser-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const savePartBtn = document.getElementById('save-part-btn') as HTMLButtonElement;
const partSelect = document.getElementById('part-select') as HTMLSelectElement;
const backBtn = document.getElementById('back-btn') as HTMLButtonElement;

let isDrawing = false;
let lastX = 0;
let lastY = 0;

let currentColor = '#ffffff';
let currentSize = 5;
let isEraser = false;

// Predefined colors
const colors = [
    '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080',
    '#a52a2a', '#ffc0cb', '#ffd700', '#008080', '#000080'
];

// Initialize UI
function init() {
    // Setup color palette
    colors.forEach(color => {
        const btn = document.createElement('div');
        btn.className = 'color-btn';
        btn.style.backgroundColor = color;
        if (color === currentColor) btn.classList.add('active');
        
        btn.addEventListener('click', () => {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentColor = color;
            isEraser = false;
            eraserBtn.style.background = '#333';
        });
        
        colorPicker.appendChild(btn);
    });

    loadCurrentPart();
}

function loadCurrentPart() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const key = partSelect?.value === 'skin' ? 'player_custom_skin' : partSelect?.value;
    const saved = localStorage.getItem(key);
    if (saved) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = saved;
    }
}

// Event Listeners
brushSizeInput.addEventListener('input', (e) => {
    currentSize = parseInt((e.target as HTMLInputElement).value);
    brushSizeLabel.innerText = currentSize.toString();
});

eraserBtn.addEventListener('click', () => {
    isEraser = true;
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    eraserBtn.style.background = '#555'; // Highlight eraser
});

clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the canvas?')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
});

backBtn.addEventListener('click', () => {
    window.location.href = '/index.html';
});

saveBtn.addEventListener('click', () => {
    // Save as Data URL to localStorage
    const dataUrl = canvas.toDataURL('image/png');
    
    // Basic validation: check if canvas is completely empty
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasPixels = false;
    for (let i = 3; i < imgData.length; i += 4) {
        if (imgData[i] > 0) {
            hasPixels = true;
            break;
        }
    }

    if (!hasPixels) {
        alert("Your skin is empty! Draw something before saving.");
        return;
    }

    localStorage.setItem('player_custom_skin', dataUrl);
    alert('Skin saved successfully! It will be used in the game.');
    window.location.href = '/index.html';
});

savePartBtn.addEventListener('click', () => {
    const dataUrl = canvas.toDataURL('image/png');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasPixels = false;
    for (let i = 3; i < imgData.length; i += 4) {
        if (imgData[i] > 0) {
            hasPixels = true;
            break;
        }
    }
    if (!hasPixels) {
        alert('Canvas is empty.');
        return;
    }
    const key = partSelect.value;
    if (!key) return;
    if (key === 'skin') {
        localStorage.setItem('player_custom_skin', dataUrl);
        alert('Saved as whole-body skin.');
    } else {
        localStorage.setItem(key, dataUrl);
        alert('Part saved: ' + key);
    }
});

partSelect.addEventListener('change', () => {
    loadCurrentPart();
});

// Drawing Logic
function getMousePos(evt: MouseEvent | TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (window.TouchEvent && evt instanceof TouchEvent) {
        clientX = evt.touches[0].clientX;
        clientY = evt.touches[0].clientY;
    } else {
        clientX = (evt as MouseEvent).clientX;
        clientY = (evt as MouseEvent).clientY;
    }

    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

function startDrawing(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    isDrawing = true;
    const pos = getMousePos(e);
    lastX = pos.x;
    lastY = pos.y;
    
    // Draw a single dot if just clicking
    draw(e);
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath(); // Reset path
}

function draw(e: MouseEvent | TouchEvent) {
    if (!isDrawing) return;
    e.preventDefault();

    const pos = getMousePos(e);

    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentColor;
    }

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastX = pos.x;
    lastY = pos.y;
}

// Mouse events
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
window.addEventListener('mouseup', stopDrawing);

// Touch events for mobile support
canvas.addEventListener('touchstart', startDrawing, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
window.addEventListener('touchend', stopDrawing);

// Initialize
init();

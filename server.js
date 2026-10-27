const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data', 'portfolio.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// MP4 faststart optimizer: moves 'moov' atom to the beginning so videos play instantly without waiting to download
function optimizeMp4Faststart(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const buf = fs.readFileSync(filePath);
    let moov = null, mdat = null;
    let beforeMdat = [];
    let afterMdat = [];
    let pos = 0;
    let foundMdat = false;
    let moovPos = -1;
    let mdatPos = -1;

    while (pos + 8 <= buf.length) {
      let size = buf.readUInt32BE(pos);
      if (size === 0) size = buf.length - pos;
      if (size < 8 || pos + size > buf.length) break;
      const type = buf.slice(pos + 4, pos + 8).toString('ascii');
      const box = buf.slice(pos, pos + size);

      if (type === 'moov') {
        moov = Buffer.from(box);
        moovPos = pos;
      } else if (type === 'mdat') {
        mdat = box;
        mdatPos = pos;
        foundMdat = true;
      } else {
        if (!foundMdat) {
          beforeMdat.push(box);
        } else {
          afterMdat.push(box);
        }
      }
      pos += size;
    }

    if (!moov || !mdat) return;

    // If moov is ALREADY before mdat, the video is already faststart-ready!
    if (moovPos < mdatPos) {
      return;
    }

    // moov is AFTER mdat. Compute exact shift when moving moov before mdat.
    let beforeMdatLength = 0;
    for (const b of beforeMdat) beforeMdatLength += b.length;

    const oldMdatPos = mdatPos;
    const newMdatPos = beforeMdatLength + moov.length;
    const shift = newMdatPos - oldMdatPos;

    for (let i = 0; i < moov.length - 8; i++) {
      const type = moov.slice(i + 4, i + 8).toString('ascii');
      if (type === 'stco') {
        const entryCount = moov.readUInt32BE(i + 12);
        for (let e = 0; e < entryCount; e++) {
          const entryPos = i + 16 + e * 4;
          const curOffset = moov.readUInt32BE(entryPos);
          moov.writeUInt32BE(curOffset + shift, entryPos);
        }
      } else if (type === 'co64') {
        const entryCount = moov.readUInt32BE(i + 12);
        for (let e = 0; e < entryCount; e++) {
          const entryPos = i + 16 + e * 8;
          const curOffset = moov.readBigUInt64BE(entryPos);
          moov.writeBigUInt64BE(curOffset + BigInt(shift), entryPos);
        }
      }
    }

    const newFile = Buffer.concat([...beforeMdat, moov, mdat, ...afterMdat]);
    fs.writeFileSync(filePath, newFile);
  } catch (err) {
    console.warn('MP4 faststart optimization notice:', err);
  }
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'work-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB max for 3D models & videos
});

const itemUpload = upload.fields([
  { name: 'imageFile', maxCount: 1 },
  { name: 'headerFile', maxCount: 1 },
  { name: 'modelFile', maxCount: 1 },
  { name: 'videoFile', maxCount: 1 },
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Helper: Read Data
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { siteConfig: {}, categories: [], items: [] };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading data:', err);
    return { siteConfig: {}, categories: [], items: [] };
  }
}

// Helper: Save Data
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving data:', err);
    return false;
  }
}

// API: Get all portfolio data
app.get('/api/data', (req, res) => {
  const data = readData();
  res.json(data);
});

// API: Upload any file (Image, 3D Model .glb/.bbmodel, Video .mp4/.webm)
app.post('/api/upload', upload.any(), (req, res) => {
  const file = (req.files && req.files.length > 0) ? req.files[0] : req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${file.filename}`;
  res.json({ success: true, url: fileUrl, filename: file.filename, originalName: file.originalname });
});

// API: Add new portfolio item
app.post('/api/items', itemUpload, (req, res) => {
  const data = readData();
  const { 
    title, category, price, priceHead, priceBody, priceFull, 
    description, tags, imageUrl, headerUrl, modelUrl, videoUrl, itemType 
  } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Handle uploaded files
  let hasUploadedSkin = Boolean(
    (req.files && (req.files.imageFile || req.files.image)) || 
    (imageUrl && imageUrl !== '/uploads/custom-yuki-skin.png')
  );

  let finalImage = hasUploadedSkin ? (imageUrl || '/uploads/custom-yuki-skin.png') : '/uploads/custom-yuki-skin.png';
  let finalHeader = headerUrl || '';
  let finalModel = modelUrl || '';
  let finalVideo = videoUrl || '';

  if (req.files) {
    if (req.files.imageFile && req.files.imageFile[0]) {
      finalImage = `/uploads/${req.files.imageFile[0].filename}`;
      hasUploadedSkin = true;
    } else if (req.files.image && req.files.image[0]) {
      finalImage = `/uploads/${req.files.image[0].filename}`;
      hasUploadedSkin = true;
    }
    if (req.files.headerFile && req.files.headerFile[0]) {
      finalHeader = `/uploads/${req.files.headerFile[0].filename}`;
    }
    if (req.files.modelFile && req.files.modelFile[0]) {
      finalModel = `/uploads/${req.files.modelFile[0].filename}`;
    }
    if (req.files.videoFile && req.files.videoFile[0]) {
      finalVideo = `/uploads/${req.files.videoFile[0].filename}`;
      optimizeMp4Faststart(req.files.videoFile[0].path);
    }
  } else if (req.file) {
    finalImage = `/uploads/${req.file.filename}`;
    hasUploadedSkin = true;
  }

  if (category && !data.categories.includes(category)) {
    data.categories.push(category);
  }

  let parsedTags = [];
  if (Array.isArray(tags)) {
    parsedTags = tags;
  } else if (typeof tags === 'string') {
    parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
  }

  const effectiveFull = (priceFull || price || '195-240฿').trim();
  const isPremadeItem = req.body.isPremade === 'true' || req.body.isPremade === true || category === 'สกินสำเร็จ';

  const newItem = {
    id: isPremadeItem ? ('premade-' + Date.now()) : ('item-' + Date.now()),
    title: title.trim(),
    category: category || (data.categories[0] || 'สกิน (Skin)'),
    itemType: 'skin',
    isPremade: isPremadeItem,
    hasCustomSkin: hasUploadedSkin,
    licenseType: req.body.licenseType || 'exclusive',
    status: req.body.status || 'available',
    modelType: (req.body.modelType === 'classic' || req.body.modelType === 'steve' || req.body.modelType === 'default') ? 'classic' : 'slim',
    premadeCode: req.body.premadeCode || (isPremadeItem ? `#SKIN-${String(data.items.filter(i => i.isPremade).length + 1).padStart(2, '0')}` : undefined),
    price: effectiveFull,
    priceHead: (priceHead || '70฿').trim(),
    priceBody: (priceBody || '150-250฿').trim(),
    priceFull: effectiveFull,
    image: finalImage,
    headerImage: finalHeader,
    skinTexture: finalImage,
    resolution: (req.body.resolution || '64x64 HD Standard').trim(),
    armType: (req.body.armType || ((req.body.modelType === 'classic') ? 'Classic 4px (Steve)' : 'Slim 3px (Alex)')).trim(),
    edition: (req.body.edition || 'Java & Bedrock Edition').trim(),
    included: (req.body.included || 'ไฟล์ .PNG คมชัด • ดาวน์โหลดทันที').trim(),
    priceNote: req.body.priceNote ? req.body.priceNote.trim() : undefined,
    licenseText: req.body.licenseText ? req.body.licenseText.trim() : undefined,
    modelUrl: finalModel,
    videoUrl: finalVideo,
    description: (description || '').trim(),
    tags: parsedTags,
    createdAt: new Date().toISOString()
  };

  if (!data.categoryPrices) data.categoryPrices = {};
  if (newItem.category) {
    const newHead = (priceHead || '70฿').trim();
    const newBody = (priceBody || '150-250฿').trim();
    const newFull = effectiveFull;

    data.categoryPrices[newItem.category] = {
      priceHead: newHead,
      priceBody: newBody,
      priceFull: newFull
    };

    // Propagate prices to all items in this category
    data.items.forEach(it => {
      if (it.category === newItem.category) {
        it.priceHead = newHead;
        it.priceBody = newBody;
        it.priceFull = newFull;
        it.price = newFull;
      }
    });
  }

  if (!data.categoryCovers) data.categoryCovers = {};
  if (newItem.category && finalHeader) {
    data.categoryCovers[newItem.category] = finalHeader;
  }

  data.items.unshift(newItem);
  saveData(data);

  res.status(201).json({ success: true, item: newItem, categories: data.categories });
});

// API: Save 3D Model Cover Snapshot
app.post('/api/save-cover', express.json({ limit: '15mb' }), (req, res) => {
  try {
    const { itemId, dataUrl } = req.body;
    if (!itemId || !dataUrl || !dataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const data = readData();
    const item = data.items.find(i => i.id === itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid data URL' });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `cover-${itemId}.png`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, buffer);

    item.headerImage = `/uploads/${filename}`;
    saveData(data);

    res.json({ success: true, coverUrl: item.headerImage });
  } catch (err) {
    console.error('Save cover error:', err);
    res.status(500).json({ error: 'Failed to save cover' });
  }
});

// API: Update an item
app.put('/api/items/:id', itemUpload, (req, res) => {
  const data = readData();
  const itemId = req.params.id;
  const idx = data.items.findIndex(i => i.id === itemId);

  if (idx === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const { 
    title, category, price, priceHead, priceBody, priceFull, 
    description, tags, imageUrl, headerUrl, modelUrl, videoUrl, itemType 
  } = req.body;
  const existing = data.items[idx];

  let finalImage = existing.image;
  let finalHeader = existing.headerImage || '';
  let finalModel = existing.modelUrl || '';
  let finalVideo = existing.videoUrl || '';

  if (req.files) {
    if (req.files.imageFile && req.files.imageFile[0]) {
      finalImage = `/uploads/${req.files.imageFile[0].filename}`;
    } else if (req.files.image && req.files.image[0]) {
      finalImage = `/uploads/${req.files.image[0].filename}`;
    }
    if (req.files.headerFile && req.files.headerFile[0]) {
      finalHeader = `/uploads/${req.files.headerFile[0].filename}`;
    }
    if (req.files.modelFile && req.files.modelFile[0]) {
      finalModel = `/uploads/${req.files.modelFile[0].filename}`;
    }
    if (req.files.videoFile && req.files.videoFile[0]) {
      finalVideo = `/uploads/${req.files.videoFile[0].filename}`;
      optimizeMp4Faststart(req.files.videoFile[0].path);
    }
  } else if (req.file) {
    finalImage = `/uploads/${req.file.filename}`;
  }

  if (imageUrl) finalImage = imageUrl;
  if (headerUrl !== undefined && headerUrl !== '') finalHeader = headerUrl;
  if (modelUrl !== undefined && modelUrl !== '') finalModel = modelUrl;
  if (videoUrl !== undefined && videoUrl !== '') finalVideo = videoUrl;
  if (req.body.clearVideo === 'true') finalVideo = '';
  if (req.body.clearModel === 'true') finalModel = '';

  if (category && !data.categories.includes(category)) {
    data.categories.push(category);
  }

  let parsedTags = existing.tags || [];
  if (tags !== undefined) {
    if (Array.isArray(tags)) {
      parsedTags = tags;
    } else if (typeof tags === 'string') {
      parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    }
  }

  const effectiveFull = (priceFull !== undefined ? priceFull : (price !== undefined ? price : existing.priceFull || existing.price)).trim();

  data.items[idx] = {
    ...existing,
    title: title !== undefined ? title.trim() : existing.title,
    category: category || existing.category,
    itemType: itemType || existing.itemType || 'skin',
    isPremade: req.body.isPremade !== undefined ? (req.body.isPremade === 'true' || req.body.isPremade === true) : (category === 'สกินสำเร็จ' || existing.isPremade),
    licenseType: req.body.licenseType !== undefined ? req.body.licenseType : (existing.licenseType || 'exclusive'),
    status: req.body.status !== undefined ? req.body.status : (existing.status || 'available'),
    modelType: req.body.modelType !== undefined ? ((req.body.modelType === 'classic' || req.body.modelType === 'steve' || req.body.modelType === 'default') ? 'classic' : 'slim') : (existing.modelType || 'slim'),
    premadeCode: req.body.premadeCode !== undefined ? req.body.premadeCode : existing.premadeCode,
    price: effectiveFull,
    priceHead: priceHead !== undefined ? priceHead.trim() : existing.priceHead,
    priceBody: priceBody !== undefined ? priceBody.trim() : existing.priceBody,
    priceFull: effectiveFull,
    image: finalImage,
    headerImage: finalHeader,
    skinTexture: req.body.skinTexture || finalImage,
    resolution: req.body.resolution !== undefined ? req.body.resolution.trim() : (existing.resolution || '64x64 HD Standard'),
    armType: req.body.armType !== undefined ? req.body.armType.trim() : (existing.armType || ((req.body.modelType === 'classic' || existing.modelType === 'classic') ? 'Classic 4px (Steve)' : 'Slim 3px (Alex)')),
    edition: req.body.edition !== undefined ? req.body.edition.trim() : (existing.edition || 'Java & Bedrock Edition'),
    included: req.body.included !== undefined ? req.body.included.trim() : (existing.included || 'ไฟล์ .PNG คมชัด • ดาวน์โหลดทันที'),
    priceNote: req.body.priceNote !== undefined ? req.body.priceNote.trim() : existing.priceNote,
    licenseText: req.body.licenseText !== undefined ? req.body.licenseText.trim() : existing.licenseText,
    modelUrl: finalModel,
    videoUrl: finalVideo,
    description: description !== undefined ? description.trim() : existing.description,
    tags: parsedTags,
    updatedAt: new Date().toISOString()
  };

  if (!data.categoryPrices) data.categoryPrices = {};
  const updatedCat = data.items[idx].category;
  if (updatedCat && updatedCat !== 'สกินสำเร็จ' && !data.items[idx].isPremade && (priceHead || priceBody || priceFull)) {
    const newHead = (priceHead !== undefined ? priceHead.trim() : (existing.priceHead || '70฿'));
    const newBody = (priceBody !== undefined ? priceBody.trim() : (existing.priceBody || '150-250฿'));
    const newFull = effectiveFull;

    data.categoryPrices[updatedCat] = {
      priceHead: newHead,
      priceBody: newBody,
      priceFull: newFull
    };

    // Propagate prices to all items in this category (excluding premade)
    data.items.forEach(it => {
      if (it.category === updatedCat && it.category !== 'สกินสำเร็จ' && !it.isPremade) {
        it.priceHead = newHead;
        it.priceBody = newBody;
        it.priceFull = newFull;
        it.price = newFull;
      }
    });
  }

  if (!data.categoryCovers) data.categoryCovers = {};
  if (updatedCat && finalHeader) {
    data.categoryCovers[updatedCat] = finalHeader;
  }

  saveData(data);
  res.json({ success: true, item: data.items[idx], categories: data.categories });
});

// API: Quick update specs for a premade skin item
app.put('/api/items/:id/specs', (req, res) => {
  const data = readData();
  const itemId = req.params.id;
  const idx = data.items.findIndex(i => i.id === itemId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const { resolution, armType, edition, included, priceNote, licenseText, modelType, licenseType, price } = req.body;
  if (resolution !== undefined) data.items[idx].resolution = resolution.trim();
  if (armType !== undefined) data.items[idx].armType = armType.trim();
  if (edition !== undefined) data.items[idx].edition = edition.trim();
  if (included !== undefined) data.items[idx].included = included.trim();
  if (priceNote !== undefined) data.items[idx].priceNote = priceNote.trim();
  if (licenseText !== undefined) data.items[idx].licenseText = licenseText.trim();
  if (modelType !== undefined) data.items[idx].modelType = modelType;
  if (licenseType !== undefined) data.items[idx].licenseType = licenseType;
  if (price !== undefined) {
    data.items[idx].price = price.trim();
    data.items[idx].priceFull = price.trim();
  }
  data.items[idx].updatedAt = new Date().toISOString();

  saveData(data);
  res.json({ success: true, item: data.items[idx] });
});

// API: Save / Update category prices
app.post('/api/category-prices', (req, res) => {
  const data = readData();
  const { category, priceHead, priceBody, priceFull } = req.body;
  if (!category) {
    return res.status(400).json({ error: 'Category is required' });
  }
  const newHead = (priceHead || '70฿').trim();
  const newBody = (priceBody || '150-250฿').trim();
  const newFull = (priceFull || '195-240฿').trim();

  if (!data.categoryPrices) data.categoryPrices = {};
  data.categoryPrices[category] = {
    priceHead: newHead,
    priceBody: newBody,
    priceFull: newFull
  };

  // Propagate prices to all items in this category
  if (Array.isArray(data.items)) {
    data.items.forEach(it => {
      if (it.category === category) {
        it.priceHead = newHead;
        it.priceBody = newBody;
        it.priceFull = newFull;
        it.price = newFull;
      }
    });
  }

  saveData(data);
  res.json({ success: true, categoryPrices: data.categoryPrices });
});

// API: Save / Update category cover image
app.post('/api/category-covers', (req, res) => {
  const data = readData();
  const { category, coverUrl } = req.body;
  if (!category) {
    return res.status(400).json({ error: 'Category is required' });
  }
  if (!data.categoryCovers) data.categoryCovers = {};
  data.categoryCovers[category] = coverUrl || '';
  saveData(data);
  res.json({ success: true, categoryCovers: data.categoryCovers });
});

// API: Save / Update Pricing Table
app.post('/api/pricing-table', (req, res) => {
  const data = readData();
  const { pricingTable } = req.body;
  if (!pricingTable || typeof pricingTable !== 'object') {
    return res.status(400).json({ error: 'pricingTable object is required' });
  }
  data.pricingTable = pricingTable;
  saveData(data);
  res.json({ success: true, pricingTable: data.pricingTable });
});

// API: Save / Update Remake Pricing
app.post('/api/remake-pricing', (req, res) => {
  const data = readData();
  const { remakePricing } = req.body;
  if (!remakePricing || typeof remakePricing !== 'object') {
    return res.status(400).json({ error: 'remakePricing object is required' });
  }
  data.remakePricing = remakePricing;
  saveData(data);
  res.json({ success: true, remakePricing: data.remakePricing });
});

// API: Save / Update Add-on Pricing
app.post('/api/addon-pricing', (req, res) => {
  const data = readData();
  const { addonPricing } = req.body;
  if (!addonPricing || typeof addonPricing !== 'object') {
    return res.status(400).json({ error: 'addonPricing object is required' });
  }
  data.addonPricing = addonPricing;
  saveData(data);
  res.json({ success: true, addonPricing: data.addonPricing });
});

// API: Delete an item
app.delete('/api/items/:id', (req, res) => {
  const data = readData();
  const itemId = req.params.id;
  const originalLen = data.items.length;
  data.items = data.items.filter(i => i.id !== itemId);

  if (data.items.length === originalLen) {
    return res.status(404).json({ error: 'Item not found' });
  }

  saveData(data);
  res.json({ success: true, message: 'Item deleted' });
});

// API: Reorder items list
app.post('/api/items/reorder', (req, res) => {
  const data = readData();
  const { itemIds } = req.body;
  if (!Array.isArray(itemIds)) {
    return res.status(400).json({ error: 'itemIds array is required' });
  }

  const itemMap = new Map(data.items.map(i => [i.id, i]));
  const reordered = [];

  for (const id of itemIds) {
    if (itemMap.has(id)) {
      reordered.push(itemMap.get(id));
      itemMap.delete(id);
    }
  }

  // Any remaining items not explicitly listed
  for (const remaining of itemMap.values()) {
    reordered.push(remaining);
  }

  data.items = reordered;
  saveData(data);
  res.json({ success: true, count: data.items.length });
});

// API: Add a new category
app.post('/api/categories', (req, res) => {
  const data = readData();
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const trimmed = name.trim();
  if (!data.categories.includes(trimmed)) {
    data.categories.push(trimmed);
    saveData(data);
  }

  res.json({ success: true, categories: data.categories });
});

// API: Delete a category
app.delete('/api/categories/:name', (req, res) => {
  const data = readData();
  const name = decodeURIComponent(req.params.name);

  data.categories = data.categories.filter(c => c !== name);
  saveData(data);

  res.json({ success: true, categories: data.categories });
});

// API: Reorder categories list
app.post('/api/categories/reorder', (req, res) => {
  const data = readData();
  const { categories } = req.body;
  if (!Array.isArray(categories)) {
    return res.status(400).json({ error: 'Categories array is required' });
  }

  const cleanCats = [];
  for (const c of categories) {
    if (typeof c === 'string' && c.trim() && !cleanCats.includes(c.trim())) {
      cleanCats.push(c.trim());
    }
  }

  // Preserve any remaining categories from data.categories
  for (const c of data.categories) {
    if (!cleanCats.includes(c)) cleanCats.push(c);
  }

  data.categories = cleanCats;
  saveData(data);
  res.json({ success: true, categories: data.categories });
});

// API: Update site settings
app.post('/api/config', (req, res) => {
  const data = readData();
  data.siteConfig = {
    ...data.siteConfig,
    ...req.body
  };
  saveData(data);
  res.json({ success: true, siteConfig: data.siteConfig });
});

// API: Add or update an announcement
app.post('/api/announcements', (req, res) => {
  const data = readData();
  data.announcements = data.announcements || [];
  const { id, title, content, date } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Announcement content is required' });
  }

  if (id) {
    const idx = data.announcements.findIndex(a => a.id === id);
    if (idx !== -1) {
      data.announcements[idx] = {
        ...data.announcements[idx],
        title: title ? title.trim() : 'ประกาศร้าน',
        content: content.trim(),
        date: date ? date.trim() : data.announcements[idx].date,
        updatedAt: new Date().toISOString()
      };
      saveData(data);
      return res.json({ success: true, announcements: data.announcements });
    }
  }

  const newAnn = {
    id: 'ann-' + Date.now(),
    title: title ? title.trim() : 'ประกาศจากร้าน',
    content: content.trim(),
    date: date ? date.trim() : new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }),
    createdAt: new Date().toISOString()
  };

  data.announcements.unshift(newAnn);
  saveData(data);
  res.status(201).json({ success: true, announcements: data.announcements });
});

// API: Delete an announcement
app.delete('/api/announcements/:id', (req, res) => {
  const data = readData();
  data.announcements = data.announcements || [];
  const id = req.params.id;
  data.announcements = data.announcements.filter(a => a.id !== id);
  saveData(data);
  res.json({ success: true, announcements: data.announcements });
});

// API: Update About Us configuration
app.post('/api/about', (req, res) => {
  const data = readData();
  data.aboutConfig = {
    ...(data.aboutConfig || {}),
    ...req.body
  };
  saveData(data);
  res.json({ success: true, aboutConfig: data.aboutConfig });
});

// API: Add or update a service
app.post('/api/services', (req, res) => {
  const data = readData();
  data.services = data.services || [];
  const { id, title, description, icon, targetCategory } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Service title is required' });
  }

  if (id) {
    const idx = data.services.findIndex(s => s.id === id);
    if (idx !== -1) {
      data.services[idx] = {
        ...data.services[idx],
        title: title.trim(),
        description: (description || '').trim(),
        icon: (icon || '❄️').trim(),
        targetCategory: (targetCategory || '').trim()
      };
      saveData(data);
      return res.json({ success: true, services: data.services });
    }
  }

  const newService = {
    id: 'srv-' + Date.now(),
    title: title.trim(),
    description: (description || '').trim(),
    icon: (icon || '❄️').trim(),
    targetCategory: (targetCategory || '').trim()
  };

  data.services.push(newService);
  saveData(data);
  res.status(201).json({ success: true, services: data.services });
});

// API: Delete a service
app.delete('/api/services/:id', (req, res) => {
  const data = readData();
  data.services = data.services || [];
  const id = req.params.id;
  data.services = data.services.filter(s => s.id !== id);
  saveData(data);
  res.json({ success: true, services: data.services });
});

// API: Add or update a hero banner slide
app.post('/api/banners', (req, res) => {
  const data = readData();
  data.heroBanners = data.heroBanners || [];
  const { id, image, title, subtitle, positionY, positionX, zoom } = req.body;

  if (id) {
    const idx = data.heroBanners.findIndex(b => b.id === id);
    if (idx !== -1) {
      data.heroBanners[idx] = {
        ...data.heroBanners[idx],
        image: (image && image.trim()) || data.heroBanners[idx].image,
        title: title !== undefined ? title.trim() : (data.heroBanners[idx].title || ''),
        subtitle: subtitle !== undefined ? subtitle.trim() : (data.heroBanners[idx].subtitle || ''),
        positionY: positionY !== undefined ? Math.max(0, Math.min(100, Number(positionY))) : (data.heroBanners[idx].positionY ?? 50),
        positionX: positionX !== undefined ? Math.max(0, Math.min(100, Number(positionX))) : (data.heroBanners[idx].positionX ?? 50),
        zoom: zoom !== undefined ? Math.max(50, Math.min(300, Number(zoom))) : (data.heroBanners[idx].zoom ?? 100)
      };
      saveData(data);
      return res.json({ success: true, heroBanners: data.heroBanners });
    }
  }

  if (!image || !image.trim()) {
    return res.status(400).json({ error: 'Banner image is required' });
  }

  const newBanner = {
    id: 'banner-' + Date.now(),
    image: image.trim(),
    title: (title || '').trim(),
    subtitle: (subtitle || '').trim(),
    positionY: positionY !== undefined ? Math.max(0, Math.min(100, Number(positionY))) : 50,
    positionX: positionX !== undefined ? Math.max(0, Math.min(100, Number(positionX))) : 50,
    zoom: zoom !== undefined ? Math.max(50, Math.min(300, Number(zoom))) : 100
  };

  data.heroBanners.push(newBanner);
  saveData(data);
  res.status(201).json({ success: true, heroBanners: data.heroBanners });
});

// API: Update banner position and zoom only
app.put('/api/banners/:id/position', (req, res) => {
  const data = readData();
  data.heroBanners = data.heroBanners || [];
  const id = req.params.id;
  const idx = data.heroBanners.findIndex(b => b.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Banner not found' });
  }
  const { positionY, positionX, zoom } = req.body;
  if (positionY !== undefined) data.heroBanners[idx].positionY = Math.max(0, Math.min(100, Number(positionY)));
  if (positionX !== undefined) data.heroBanners[idx].positionX = Math.max(0, Math.min(100, Number(positionX)));
  if (zoom !== undefined) data.heroBanners[idx].zoom = Math.max(50, Math.min(300, Number(zoom)));
  saveData(data);
  res.json({ success: true, banner: data.heroBanners[idx], heroBanners: data.heroBanners });
});

// API: Delete a hero banner slide
app.delete('/api/banners/:id', (req, res) => {
  const data = readData();
  data.heroBanners = data.heroBanners || [];
  const id = req.params.id;
  data.heroBanners = data.heroBanners.filter(b => b.id !== id);
  saveData(data);
  res.json({ success: true, heroBanners: data.heroBanners });
});

// Helper: Extract date from transRef and check expiry
function checkSlipDateExpiry(transRef) {
  if (!transRef || typeof transRef !== 'string') return { isExpired: false, date: null };
  transRef = transRef.trim();

  let slipDate = null;

  // Pattern 1: TrueMoney / BAY format APF + YYMMDDHHMMSS e.g. APF 26 09 05 22 10 24
  const m1 = transRef.match(/([0-9]{2})(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])([0-9]{2})([0-9]{2})([0-9]{2})/);
  if (m1) {
    const rawYear = parseInt(m1[1], 10);
    const fullYear = (rawYear > 50) ? (1900 + rawYear) : (2000 + rawYear);
    const month = parseInt(m1[2], 10) - 1;
    const day = parseInt(m1[3], 10);
    const hour = parseInt(m1[4], 10);
    const min = parseInt(m1[5], 10);
    const sec = parseInt(m1[6], 10);
    slipDate = new Date(fullYear, month, day, hour, min, sec);
  }

  // Pattern 2: YYYYMMDD (e.g. 20261023... or 20241022...)
  if (!slipDate) {
    const m2 = transRef.match(/(202[0-9])(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])/);
    if (m2) {
      slipDate = new Date(parseInt(m2[1], 10), parseInt(m2[2], 10) - 1, parseInt(m2[3], 10));
    }
  }

  if (!slipDate || isNaN(slipDate.getTime())) {
    return { isExpired: false, date: null };
  }

  const now = Date.now();
  const diffHours = (now - slipDate.getTime()) / (1000 * 3600);

  // If slip is in the past by more than 48 hours
  if (diffHours > 48) {
    const formatted = slipDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const diffDays = Math.floor(diffHours / 24);
    return {
      isExpired: true,
      date: slipDate,
      diffDays,
      error: `สลิปนี้เป็นสลิปเก่า (ทำรายการเมื่อ ${formatted} หรือ ${diffDays} วันที่แล้ว)! ระบบรับเฉพาะสลิปการโอนเงินของวันนี้เท่านั้นค่ะ`
    };
  }

  return { isExpired: false, date: slipDate };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderApprovalHtml({ success, order, alreadyApproved, title, message }) {
  const safeTitle = escapeHtml(title || 'ยืนยันคำสั่งซื้อ');
  const safeMessage = escapeHtml(message || '');
  const orderId = order ? escapeHtml(order.orderId) : '';
  const itemTitle = order ? escapeHtml(order.itemTitle || 'สกินสำเร็จรูป') : '';
  const price = order ? escapeHtml(order.price || '-') : '';
  const buyer = order ? escapeHtml(order.buyerContact || '-') : '';
  const payment = order ? escapeHtml(order.paymentMethod || 'พร้อมเพย์') : '';
  const time = order && order.approvedAt ? new Date(order.approvedAt).toLocaleString('th-TH') : new Date().toLocaleString('th-TH');

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} • Yuki Haru Store</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Mitr:wght@300;400;500;600;700&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Mitr', 'Nunito', sans-serif; }
    .bg-gradient-snow { background: linear-gradient(135deg, #f4f0ff 0%, #ece8ff 50%, #fdf2f8 100%); }
    .card-glass { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(16px); border: 2px solid rgba(190, 170, 245, 0.8); box-shadow: 0 20px 50px rgba(130, 90, 220, 0.18); }
  </style>
</head>
<body class="bg-gradient-snow min-h-screen flex items-center justify-center p-4">
  <div class="card-glass max-w-lg w-full rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden">
    <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold ${success ? (alreadyApproved ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300') : 'bg-rose-100 text-rose-900 border border-rose-300'} mb-4 shadow-sm">
      <span>${success ? (alreadyApproved ? 'ℹ️ เคยยืนยันแล้ว' : '✨ ยืนยันสำเร็จ') : '❌ ผิดพลาด'}</span>
      <span>${success ? (alreadyApproved ? 'คำสั่งซื้อนี้เคยได้รับการอนุมัติแล้ว' : 'สถานะ: สมบูรณ์ (Completed)') : 'ไม่พบคำสั่งซื้อ'}</span>
    </div>

    <h1 class="text-xl sm:text-2xl font-black text-purple-950 mb-2 flex items-center justify-center gap-2">
      <span>${success ? '🎉' : '⚠️'}</span>
      <span>${safeTitle}</span>
      <span>${success ? '🌸' : ''}</span>
    </h1>

    <p class="text-xs sm:text-sm text-purple-700/90 mb-6 leading-relaxed">
      ${safeMessage}
    </p>

    ${order ? `
    <div class="bg-purple-50/70 border border-purple-200/90 rounded-2xl p-4 text-left text-xs text-purple-900 space-y-2 mb-6">
      <div class="flex items-center justify-between pb-2 border-b border-purple-200/60 font-bold">
        <span>🆔 รหัสคำสั่งซื้อ:</span>
        <span class="font-mono text-purple-950 font-black">${orderId}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-purple-600">🛍️ สกินที่สั่งซื้อ:</span>
        <span class="font-bold text-purple-950">${itemTitle}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-purple-600">💰 ยอดชำระ:</span>
        <span class="font-black text-emerald-600 text-sm">${price}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-purple-600">👤 ผู้ซื้อ / Discord:</span>
        <span class="font-semibold text-purple-950">${buyer}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-purple-600">💳 ช่องทางชำระเงิน:</span>
        <span class="font-semibold text-purple-950">${payment}</span>
      </div>
      <div class="flex items-center justify-between pt-1 border-t border-purple-200/50 text-[11px] text-purple-500">
        <span>⏰ เวลาที่ยืนยัน:</span>
        <span>${time}</span>
      </div>
    </div>
    ` : ''}

    <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
      <a href="/#orders" class="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-md hover:opacity-95 transition flex items-center justify-center gap-2">
        <span>📋</span>
        <span>ดูรายการคำสั่งซื้อทั้งหมด</span>
      </a>
      <a href="/" class="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-white border border-purple-300 text-purple-800 font-bold text-xs hover:bg-purple-50 transition flex items-center justify-center gap-1.5 shadow-xs">
        <span>🌐</span>
        <span>กลับสู่หน้าแรกเว็บไซต์</span>
      </a>
    </div>

    <div class="mt-6 pt-4 border-t border-purple-200/50 text-[10px] text-purple-400">
      Yuki Haru Store • ระบบสั่งซื้อและยืนยันผ่าน Discord อัตโนมัติ 🌸
    </div>
  </div>
</body>
</html>`;
}

// Helper: Send Discord Webhook Notification on Order
async function sendDiscordOrderNotification(order, item, siteConfig, isApproved = false, req = null) {
  const webhookUrl = siteConfig?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) return;

  try {
    const isCompleted = order.status === 'completed' || isApproved;
    const title = isApproved 
      ? `✅ [อนุมัติคำสั่งซื้อ] ลูกค้าได้รับสกินแล้ว! • ${order.orderId}`
      : (isCompleted ? `🎉 มีลูกค้าซื้อสกินสำเร็จ! • ${order.orderId}` : `🛒 มีคำสั่งซื้อใหม่ (รอตรวจสลิป) • ${order.orderId}`);
    
    const embedColor = isCompleted ? 0x10b981 : 0x8b5cf6; // Emerald green or Violet

    let baseUrl = '';
    if (req) {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      if (host) baseUrl = `${proto}://${host}`.replace(/\/$/, '');
    }
    if (!baseUrl && siteConfig?.publicUrl && siteConfig.publicUrl.trim().startsWith('http')) {
      baseUrl = siteConfig.publicUrl.trim().replace(/\/$/, '');
    }
    if (!baseUrl) {
      baseUrl = `http://localhost:${PORT}`;
    }
    const approveUrl = `${baseUrl}/api/orders/${encodeURIComponent(order.orderId)}/quick-approve`;
    const ordersUrl = `${baseUrl}/#orders`;

    const fields = [
      { name: '🛍️ สกินที่ซื้อ', value: `**${order.itemTitle || item?.title || 'สกินสำเร็จรูป'}** (${order.itemCode || item?.premadeCode || '-'})`, inline: true },
      { name: '💰 ราคา', value: `**${order.price || item?.price || '250฿'}**`, inline: true },
      { name: '💳 ช่องทางชำระ', value: `${order.paymentMethod || 'พร้อมเพย์'}`, inline: true },
      { name: '👤 ผู้ซื้อ / Discord', value: `**${order.buyerContact || 'ไม่ระบุ'}**`, inline: true },
      { name: '⚡ สถานะคำสั่งซื้อ', value: isCompleted ? '✅ **สำเร็จ (ส่งมอบสกินแล้ว)**' : '⏳ **รอแอดมินตรวจสลิป & กดยืนยัน**', inline: true },
      { name: '🆔 รหัสคำสั่งซื้อ', value: `\`${order.orderId}\``, inline: true }
    ];

    if (order.transRef) {
      fields.push({
        name: '🧾 เลขอ้างอิงสลิป / ธนาคาร',
        value: `\`${order.transRef}\` (${order.bankName || order.bankCode || 'ธนาคารไทย'})`,
        inline: false
      });
    }

    if (!isCompleted) {
      fields.push({
        name: '⚡ ลิงก์กดยืนยันออเดอร์ทันที (คลิกเพื่ออนุมัติ):',
        value: `✅ **กดที่นี่เพื่ออนุมัติ:**\n${approveUrl}\n\n🔍 **ดูสลิปและจัดการบนเว็บ:**\n${ordersUrl}`,
        inline: false
      });
    }

    const embed = {
      title: title,
      color: embedColor,
      fields: fields,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Yuki Haru Store • ระบบแจ้งเตือนการสั่งซื้อสกินอัตโนมัติ 🌸'
      }
    };

    if (order.skinUrl) {
      const skinFull = order.skinUrl.startsWith('http') ? order.skinUrl : `${baseUrl}${order.skinUrl.startsWith('/') ? '' : '/'}${order.skinUrl}`;
      embed.thumbnail = { url: skinFull };
    }

    if (order.slipUrl) {
      const slipFull = order.slipUrl.startsWith('http') ? order.slipUrl : `${baseUrl}${order.slipUrl.startsWith('/') ? '' : '/'}${order.slipUrl}`;
      embed.image = { url: slipFull };
    }

    const pingTag = (siteConfig?.discordPingMention !== undefined) ? siteConfig.discordPingMention : '@everyone';
    const contentText = isApproved
      ? `✅ **[อนุมัติเรียบร้อย]** คำสั่งซื้อ \`${order.orderId}\` (${order.itemTitle || 'สกินสำเร็จรูป'}) ได้รับการยืนยันแล้วค่ะ! ✨`
      : `${pingTag ? `${pingTag} ` : ''}🔔 **มีคำสั่งซื้อใหม่เข้ามาแล้วค่ะ!**\n\n⚡ **แตะที่ลิงก์นี้เพื่อกดยืนยันออเดอร์ทันที (1-Click Approve):**\n${approveUrl}\n\n🔍 **ตรวจดูสลิปและจัดการบนเว็บ:**\n${ordersUrl}`;

    const payload = {
      username: 'Yuki Haru Store 🌸',
      content: contentText,
      embeds: [embed],
      allowed_mentions: {
        parse: ['everyone', 'roles', 'users']
      }
    };

    if (!isCompleted) {
      payload.components = [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: '✅ ยืนยันออเดอร์นี้ทันที',
              url: approveUrl
            },
            {
              type: 2,
              style: 5,
              label: '🔍 ตรวจดูสลิปบนเว็บ',
              url: ordersUrl
            }
          ]
        }
      ];
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('Discord Webhook notification notice:', err.message);
  }
}

// Helper: Call SlipOK Verification API (if configured)
async function verifySlipWithSlipOK(rawQr, slipokApiKey, slipokBranchId) {
  if (!slipokApiKey || !slipokBranchId || !rawQr) return null;
  try {
    const response = await fetch(`https://api.slipok.com/api/line/apikey/${encodeURIComponent(slipokBranchId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authorization': slipokApiKey
      },
      body: JSON.stringify({ data: rawQr })
    });
    return await response.json();
  } catch (err) {
    console.error('SlipOK API error:', err);
    return null;
  }
}

// API: Verify bank transfer slip (Duplicate check & Date/Expiry check)
app.post('/api/verify-slip', (req, res) => {
  const data = readData();
  const { transRef, bankCode, bankName, qrRaw, amount } = req.body;

  if (!transRef) {
    return res.status(400).json({ error: 'Transaction reference is required' });
  }

  // 1. Check slip date expiry (reject slips older than 48 hours)
  const expiry = checkSlipDateExpiry(transRef);
  if (expiry.isExpired) {
    return res.status(400).json({
      success: false,
      isExpired: true,
      error: expiry.error,
      date: expiry.date
    });
  }

  // 2. Check duplicate slip
  const orders = data.orders || [];
  const existingOrder = orders.find(o => o.transRef && o.transRef.trim().toLowerCase() === transRef.trim().toLowerCase());

  if (existingOrder) {
    return res.status(400).json({
      success: false,
      isDuplicate: true,
      error: `สลิปนี้ถูกใช้งานไปแล้วในคำสั่งซื้อ ${existingOrder.orderId} เมื่อ ${new Date(existingOrder.createdAt).toLocaleString('th-TH')} (ไม่อนุญาตให้ใช้สลิปซ้ำ)`,
      usedAt: existingOrder.createdAt,
      orderId: existingOrder.orderId
    });
  }

  res.json({
    success: true,
    isDuplicate: false,
    isExpired: false,
    message: 'สลิปถูกต้อง ไม่พบประวัติการใช้งานซ้ำและเป็นสลิปใหม่',
    transRef,
    bankCode,
    bankName
  });
});

// API: Process order & payment for premade skin
app.post('/api/order', upload.single('slipFile'), async (req, res) => {
  const data = readData();
  const { 
    itemId, buyerName, buyerContact, paymentMethod, notes,
    transRef, bankCode, bankName, slipVerified, slipQrRaw
  } = req.body;

  const item = data.items.find(i => i.id === itemId);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  if (item.status === 'sold' && item.licenseType === 'exclusive') {
    return res.status(400).json({ error: 'สกินนี้ถูกซื้อไปแล้ว (สิทธิ์ขาดคนเดียว)' });
  }

  // 1. Strict Slip QR Verification & Duplicate Protection
  if (!transRef || !transRef.trim()) {
    return res.status(400).json({ 
      error: 'รูปภาพที่แนบไม่ใช่สลิปโอนเงิน หรือระบบตรวจไม่พบ QR Code ในภาพ กรุณาแนบสลิปธนาคารที่มี QR Code ชัดเจนนะคะ' 
    });
  }

  // 2. Check Slip Date Expiry
  const expiry = checkSlipDateExpiry(transRef);
  if (expiry.isExpired) {
    return res.status(400).json({ error: expiry.error });
  }

  // 3. Check Duplicate Slip
  const orders = data.orders || [];
  const duplicate = orders.find(o => o.transRef && o.transRef.trim().toLowerCase() === transRef.trim().toLowerCase());
  if (duplicate) {
    return res.status(400).json({ 
      error: `สลิปนี้ถูกใช้งานไปแล้วในคำสั่งซื้อ ${duplicate.orderId} (ไม่อนุญาตให้ใช้สลิปซ้ำ)` 
    });
  }

  // 4. Bank API (SlipOK) Verification & Amount Matching if configured
  const siteConfig = data.siteConfig || {};
  let orderStatus = 'pending'; // Default: Pending Admin Approval to protect store from fake/wrong slips!
  let slipokData = null;

  if (siteConfig.slipokApiKey && siteConfig.slipokBranchId && slipQrRaw) {
    try {
      const slipokRes = await verifySlipWithSlipOK(slipQrRaw, siteConfig.slipokApiKey, siteConfig.slipokBranchId);
      if (slipokRes && slipokRes.success && slipokRes.data) {
        slipokData = slipokRes.data;
        const verifiedAmount = parseFloat(slipokData.amount);
        const expectedAmount = parseFloat(String(item.price || item.priceFull || '0').replace(/[^0-9.]/g, ''));
        
        if (verifiedAmount < expectedAmount) {
          return res.status(400).json({
            error: `ยอดเงินในสลิป (${verifiedAmount}฿) ไม่ตรงกับราคาสกิน (${expectedAmount}฿)! กรุณาโอนเงินให้ครบตามจำนวนนะคะ`
          });
        }

        orderStatus = 'completed'; // Auto-approved by bank API!
      }
    } catch (apiErr) {
      console.warn('SlipOK verification failed:', apiErr);
    }
  } else if (siteConfig.autoApproveWithoutApi === true) {
    orderStatus = 'completed';
  }

  let slipUrl = '';
  if (req.file) {
    slipUrl = `/uploads/${req.file.filename}`;
  } else if (req.body.slipUrl) {
    slipUrl = req.body.slipUrl;
  }

  const orderId = 'ORD-' + Date.now();
  const newOrder = {
    orderId,
    itemId: item.id,
    itemTitle: item.title,
    itemCode: item.premadeCode || item.id,
    price: item.price || item.priceFull || '250฿',
    licenseType: item.licenseType || 'exclusive',
    buyerName: buyerName || 'ลูกค้า Yuki Shop',
    buyerContact: buyerContact || 'ไม่ระบุ',
    paymentMethod: paymentMethod || 'PromptPay',
    slipUrl: slipUrl,
    transRef: transRef || '',
    bankCode: bankCode || '',
    bankName: bankName || '',
    slipVerified: slipVerified === 'true' || slipVerified === true,
    slipQrRaw: slipQrRaw || '',
    status: orderStatus, // 'completed' or 'pending'
    notes: notes || '',
    itemImage: item.image || item.skinTexture || '',
    skinUrl: item.skinTexture || item.image || '/uploads/custom-yuki-skin.png',
    createdAt: new Date().toISOString()
  };

  data.orders = data.orders || [];
  data.orders.unshift(newOrder);

  // If exclusive, lock skin
  if (item.licenseType === 'exclusive') {
    item.status = (orderStatus === 'completed') ? 'sold' : 'pending_sold';
    item.soldAt = new Date().toISOString();
  }

  saveData(data);

  // Send Discord notification asynchronously
  sendDiscordOrderNotification(newOrder, item, siteConfig, false, req);

  res.json({
    success: true,
    order: newOrder,
    status: orderStatus,
    item: item,
    skinUrl: (orderStatus === 'completed') ? newOrder.skinUrl : null
  });
});

// API: Check single order status (for polling)
app.get('/api/order-status/:orderId', (req, res) => {
  const data = readData();
  const { orderId } = req.params;
  const order = (data.orders || []).find(o => o.orderId === orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json({
    orderId: order.orderId,
    status: order.status || 'completed',
    skinUrl: (order.status === 'completed') ? order.skinUrl : null,
    itemTitle: order.itemTitle,
    itemImage: order.itemImage || order.skinUrl || null,
    price: order.price,
    createdAt: order.createdAt
  });
});

// API: Customer order lookup by Discord handle or Order ID
app.get('/api/customer-orders', (req, res) => {
  const data = readData();
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.json({ orders: [] });

  const orders = (data.orders || [])
    .filter(o => 
      (o.orderId && o.orderId.toLowerCase().includes(q)) ||
      (o.buyerContact && o.buyerContact.toLowerCase().includes(q))
    )
    .map(o => ({
      orderId: o.orderId,
      status: o.status || 'completed',
      itemTitle: o.itemTitle,
      price: o.price,
      createdAt: o.createdAt,
      skinUrl: (o.status === 'completed') ? o.skinUrl : null,
      buyerContact: o.buyerContact,
      itemImage: o.itemImage || o.skinUrl || null
    }));

  res.json({ orders });
});

// API: Approve order (Admin)
app.post('/api/orders/:orderId/approve', (req, res) => {
  const data = readData();
  const { orderId } = req.params;
  const order = (data.orders || []).find(o => o.orderId === orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  order.status = 'completed';
  order.approvedAt = new Date().toISOString();

  let approvedItem = null;
  if (order.itemId) {
    approvedItem = (data.items || []).find(i => i.id === order.itemId);
    if (approvedItem && approvedItem.licenseType === 'exclusive') {
      approvedItem.status = 'sold';
    }
  }

  saveData(data);

  // Send Discord notification on approval
  const siteConfig = data.siteConfig || {};
  sendDiscordOrderNotification(order, approvedItem, siteConfig, true, req);

  res.json({ success: true, message: 'อนุมัติคำสั่งซื้อเรียบร้อยแล้ว', order });
});

// API: Quick Approve Order via 1-Click Link from Discord
app.get('/api/orders/:orderId/quick-approve', (req, res) => {
  const data = readData();
  const { orderId } = req.params;
  const order = (data.orders || []).find(o => o.orderId === orderId);

  if (!order) {
    return res.status(404).send(renderApprovalHtml({
      success: false,
      title: 'ไม่พบคำสั่งซื้อนี้',
      message: `ไม่พบข้อมูลคำสั่งซื้อ #${orderId} ในระบบ หรืออาจถูกลบไปแล้วค่ะ`
    }));
  }

  const alreadyApproved = order.status === 'completed';
  if (!alreadyApproved) {
    order.status = 'completed';
    order.approvedAt = new Date().toISOString();
    order.approvedVia = 'discord-quick-approve';

    let approvedItem = null;
    if (order.itemId) {
      approvedItem = (data.items || []).find(i => i.id === order.itemId);
      if (approvedItem && approvedItem.licenseType === 'exclusive') {
        approvedItem.status = 'sold';
        approvedItem.soldAt = new Date().toISOString();
      }
    }

    saveData(data);

    // Send follow-up confirmation to Discord
    const siteConfig = data.siteConfig || {};
    sendDiscordOrderNotification(order, approvedItem, siteConfig, true, req);
  }

  res.send(renderApprovalHtml({
    success: true,
    order,
    alreadyApproved,
    title: alreadyApproved ? 'คำสั่งซื้อนี้ได้รับการยืนยันแล้ว' : 'ยืนยันคำสั่งซื้อสำเร็จเรียบร้อย!',
    message: alreadyApproved 
      ? `คำสั่งซื้อ #${order.orderId} ได้รับการอนุมัติไปเรียบร้อยแล้วค่ะ` 
      : `อนุมัติคำสั่งซื้อ #${order.orderId} ผ่าน Discord เรียบร้อยแล้ว! ลูกค้าจะได้รับสิทธิ์ดาวน์โหลดสกินทันที และสกินถูกตั้งสถานะเป็น "ขายแล้ว"`
  }));
});

// API: Test Discord Webhook
app.post('/api/test-discord-webhook', async (req, res) => {
  const { webhookUrl, pingMention, publicUrl } = req.body;
  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
    return res.status(400).json({ error: 'กรุณาระบุ Discord Webhook URL ให้ถูกต้องนะคะ' });
  }

  try {
    const data = readData();
    const siteConfig = data.siteConfig || {};
    const defaultBaseUrl = `http://localhost:${PORT}`;
    const baseUrl = (publicUrl || siteConfig.publicUrl || defaultBaseUrl).trim().replace(/\/$/, '');
    const pingText = (pingMention !== undefined ? pingMention : (siteConfig.discordPingMention || '@everyone')).trim();

    const testEmbed = {
      title: '🌸 ทดสอบการเชื่อมต่อระบบแจ้งเตือน & ยืนยันผ่าน Discord',
      description: 'ระบบแจ้งเตือนคำสั่งซื้อพร้อม **ปุ่มกดยืนยันออเดอร์ในคลิกเดียว** พร้อมใช้งานแล้วค่ะ! เมื่อมีลูกค้าสั่งซื้อสกินและโอนเงินเรียบร้อย ข้อความแจ้งเตือนพร้อมสลิปจะเด้งมาที่นี่ทันที ♡',
      color: 0x9333ea,
      fields: [
        { name: '🛍️ ตัวอย่างงาน', value: 'สกินเจ้าหญิงหิมะ (#SKIN-01)', inline: true },
        { name: '💰 ราคาตัวอย่าง', value: '250 ฿', inline: true },
        { name: '👤 ผู้ซื้อตัวอย่าง', value: 'yuki_haru#2204', inline: true },
        { name: '⚡ สถานะการเชื่อมต่อ', value: '✅ เชื่อมต่อ Discord Webhook สำเร็จสมบูรณ์', inline: false },
        { 
          name: '🔘 ตัวอย่างปุ่มยืนยันออเดอร์', 
          value: `👉 [**✅ ตัวอย่างปุ่มกดยืนยันออเดอร์ทันที**](${baseUrl}/#orders)\n👉 [**🔍 ตัวอย่างปุ่มเปิดดูรายการสั่งซื้อบนเว็บ**](${baseUrl}/#orders)`, 
          inline: false 
        }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Yuki Haru Store Webhook Test 🌸' }
    };

    const payload = {
      username: 'Yuki Haru Store 🌸',
      content: `${pingText ? `${pingText} ` : ''}🔔 **ทดสอบระบบแจ้งเตือนคำสั่งซื้อพร้อมปุ่มยืนยันออเดอร์ ✨**`,
      embeds: [testEmbed],
      allowed_mentions: {
        parse: ['everyone', 'roles', 'users']
      },
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: '✅ ตัวอย่างปุ่มยืนยันออเดอร์',
              url: `${baseUrl}/#orders`
            },
            {
              type: 2,
              style: 5,
              label: '🌐 เปิดหน้าเว็บร้านค้า',
              url: baseUrl
            }
          ]
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok || response.status === 204) {
      return res.json({ success: true, message: 'ส่งข้อความทดสอบพร้อมปุ่มเข้า Discord สำเร็จแล้ว!' });
    } else {
      const errText = await response.text();
      return res.status(400).json({ error: `Discord ปฏิเสธ Webhook (HTTP ${response.status}): ${errText}` });
    }
  } catch (err) {
    console.error('Test webhook error:', err);
    return res.status(500).json({ error: 'ไม่สามารถส่งไปยัง Discord ได้: ' + err.message });
  }
});

// API: Get recent completed purchases (for live social proof ticker)
app.get('/api/recent-purchases', (req, res) => {
  const data = readData();
  const orders = (data.orders || [])
    .filter(o => o.status === 'completed')
    .slice(0, 10)
    .map(o => {
      let maskedBuyer = 'ลูกค้าทั่วไป';
      if (o.buyerContact && o.buyerContact !== 'ไม่ระบุ') {
        const contact = o.buyerContact.trim();
        if (contact.length <= 4) {
          maskedBuyer = contact[0] + '***';
        } else {
          maskedBuyer = contact.substring(0, 3) + '***' + (contact.includes('@') ? '@' + contact.split('@')[1] : '');
        }
      }
      return {
        orderId: o.orderId,
        itemTitle: o.itemTitle,
        itemCode: o.itemCode,
        price: o.price,
        buyer: maskedBuyer,
        skinUrl: o.skinUrl,
        createdAt: o.createdAt
      };
    });
  
  res.json({ success: true, purchases: orders });
});

// API: Reject order (Admin)
app.post('/api/orders/:orderId/reject', (req, res) => {
  const data = readData();
  const { orderId } = req.params;
  const order = (data.orders || []).find(o => o.orderId === orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  order.status = 'rejected';
  order.rejectedAt = new Date().toISOString();

  // Restore exclusive skin to available
  if (order.itemId) {
    const item = (data.items || []).find(i => i.id === order.itemId);
    if (item) {
      item.status = 'available';
      delete item.soldAt;
    }
  }

  saveData(data);
  res.json({ success: true, message: 'ปฏิเสธคำสั่งซื้อและคืนสกินเรียบร้อยแล้ว', order });
});

// API: Get all customer orders (Admin)
app.get('/api/orders', (req, res) => {
  const data = readData();
  res.json(data.orders || []);
});

// API: Delete an order & optionally restore skin availability
app.delete('/api/orders/:orderId', (req, res) => {
  const data = readData();
  const { orderId } = req.params;
  const restoreSkin = req.query.restoreSkin === 'true';

  const orderIdx = (data.orders || []).findIndex(o => o.orderId === orderId);
  if (orderIdx === -1) {
    return res.status(404).json({ error: 'ไม่พบรายการคำสั่งซื้อนี้ในระบบ' });
  }

  const order = data.orders[orderIdx];
  data.orders.splice(orderIdx, 1);

  // Restore exclusive skin if requested
  if (restoreSkin && order.itemId) {
    const item = (data.items || []).find(i => i.id === order.itemId);
    if (item) {
      item.status = 'available';
      delete item.soldAt;
    }
  }

  saveData(data);
  res.json({ success: true, message: 'ลบรายการคำสั่งซื้อสำเร็จ', orderId });
});

// Helper: Calculate CRC16-CCITT for PromptPay EMVCo
function crc16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      else crc = (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Helper: Generate PromptPay EMVCo Payload
function generatePromptPayPayload(target, amount) {
  const cleanTarget = String(target || '0959891045').replace(/[^0-9]/g, '');
  let formattedTarget = (cleanTarget.length === 10 && cleanTarget.startsWith('0')) ? ('0066' + cleanTarget.substring(1)) : cleanTarget;
  const fTargetTag = '01' + String(formattedTarget.length).padStart(2, '0') + formattedTarget;
  const merchantInfo = '0016A000000677010111' + fTargetTag;
  const tag29 = '29' + String(merchantInfo.length).padStart(2, '0') + merchantInfo;
  let payload = '000201' + (amount ? '010212' : '010211') + tag29 + '5303764';
  if (amount && Number(amount) > 0) {
    const formattedAmount = Number(amount).toFixed(2);
    payload += '54' + String(formattedAmount.length).padStart(2, '0') + formattedAmount;
  }
  payload += '5802TH6304';
  payload += crc16(payload);
  return payload;
}

// API: Generate Dynamic PromptPay QR Code with specified amount
app.get('/api/promptpay-qr', async (req, res) => {
  try {
    const rawAmount = req.query.amount;
    const cleanAmount = rawAmount ? parseFloat(String(rawAmount).replace(/[^0-9.]/g, '')) : 0;
    const target = req.query.target || '0959891045';
    const payload = generatePromptPayPayload(target, cleanAmount);

    if (req.query.format === 'image') {
      res.setHeader('Content-Type', 'image/png');
      const buffer = await QRCode.toBuffer(payload, { margin: 1, width: 360, errorCorrectionLevel: 'M' });
      return res.send(buffer);
    }

    const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 360, errorCorrectionLevel: 'M' });
    res.json({
      success: true,
      target,
      name: 'SAVUN THOEUN',
      amount: cleanAmount,
      payload,
      qrDataUrl
    });
  } catch (err) {
    console.error('Error generating PromptPay QR:', err);
    res.status(500).json({ error: 'Failed to generate QR Code' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Minecraft Portfolio Server running at http://localhost:${PORT}`);
});

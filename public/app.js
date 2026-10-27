// State
let appData = {
  siteConfig: {
    title: "Yuki Shop",
    brandSub: "Minecraft Commissions",
    subtitle: "รับทำสกินมายคราฟและคอมมิชชันตามสั่ง ดีเทลประณีต",
    discord: "https://discord.gg/FyPfgC3Yj4",
    discordLink: "https://discord.gg/FyPfgC3Yj4",
    notes: ""
  },
  categories: [],
  items: []
};

let currentCategory = 'ALL';
let activeItemId = null;
let isEditMode = false;
try {
  if (sessionStorage.getItem('yuki_admin_auth') === 'true') {
    isEditMode = true;
  }
} catch (e) {}
let selectedFile = null;
let selectedHeaderFile = null;
let selectedModelFile = null;
let selectedVideoFile = null;
let hasVideoToggleState = false;
let isVideoMode = false;
let currentRatePricePart = 'full';
let currentFiguraGroup = null;
const figuraCoverSnapshots = {};

// Viewer Mode: 'animated' or 'still'
let viewerMode = 'animated';
let skinViewer = null;

// Poses: 'stand', 'walk', 'run', 'sit'
let currentPose = 'stand';
let isAutoPoseSequence = true;
let poseTimer = null;
let initialFullRotationDone = false;
let accumulatedRotation = 0;
let lastRotationY = 0;

// Camera & Interaction State
let isUserInteracting = false;
let isCameraTransitioning = false;
let camTransitionStartTime = 0;
let camTransitionDuration = 450;
let camTransitionState = {
  startTheta: 0,
  dTheta: 0,
  startRadius: 46,
  endRadius: 46,
  startY: -2,
  endY: -2,
  startTargetY: -2,
  endTargetY: -2
};
let activeZoomPart = 'full';
let isAutoRotating = true;

// Snow / Petals Canvas State
let snowEnabled = true;
let snowCanvas, snowCtx, snowParticles = [];
let snowRaf = null;

// Init
document.addEventListener('DOMContentLoaded', async () => {
  initSnowCanvas();
  await loadData();
  
  if (appData.items.length > 0) {
    activeItemId = appData.items[0].id;
  }
  
  initSkinViewer();
  initDragAndDropHandlers();
  
  const videoPlayer = document.getElementById('itemVideoPlayer');
  const videoPlayOverlay = document.getElementById('videoPlayOverlay');
  if (videoPlayer) {
    videoPlayer.setAttribute('controlsList', 'nodownload');
    videoPlayer.setAttribute('disablePictureInPicture', 'true');
    videoPlayer.oncontextmenu = (e) => e.preventDefault();
    if (videoPlayOverlay) {
      videoPlayer.addEventListener('play', () => videoPlayOverlay.classList.add('hidden'));
      videoPlayer.addEventListener('ended', () => videoPlayOverlay.classList.remove('hidden'));
    }
  }
  
  renderAll();
  loadAdminOrders(true);
  updateCustomerOrdersBadge();
  startLivePurchaseTicker();
  lucide.createIcons();
});

// Load data
async function loadData() {
  if (typeof preparedSkinCache !== 'undefined') preparedSkinCache.clear();
  try {
    const res = await fetch('/api/data?t=' + Date.now());
    if (res.ok) {
      appData = await res.json();
      ensureAppDataDefaults();
      persistLocal();
      return;
    }
  } catch (err) {
    console.warn('API error, checking localStorage fallback', err);
  }

  const local = localStorage.getItem('yuki_portfolio_data');
  if (local) {
    try {
      appData = JSON.parse(local);
    } catch (e) {}
  }
  ensureAppDataDefaults();
}

function ensureAppDataDefaults() {
  appData = appData || {};
  appData.siteConfig = appData.siteConfig || {};
  appData.categories = appData.categories || [];
  appData.items = appData.items || [];
  appData.announcements = appData.announcements || [];
  if (!appData.aboutConfig) {
    appData.aboutConfig = {
      title: 'เกี่ยวกับเรา',
      subtitle: 'ยินดีที่ได้รู้จักนะคะ ♡',
      description: `เราคือ Yuki Haru\nรับทำสกินมายคราฟ Custom Skins, HD 512, HD 128 ในสไตล์น่ารัก เรียบง่าย เน้นโทนสีละมุน เหมาะกับทุกคน\n\nขอบคุณที่สนับสนุนกันเสมอมา หวังว่าจะได้ร่วมงานกันอีกนะคะ ♡`,
      image: 'uploads/home-about-char.png',
      detailText: `ยินดีต้อนรับสู่ Yuki Haru (ゆき はる) ร้านรับออกแบบและผลิตคอมมิชชันสกินมายคราฟ คุณภาพสูง\n\nสร้างสรรค์ผลงานเอกลักษณ์เฉพาะตัว โทนละมุน คมชัด มีคุณภาพสูงสุดในราคามิตรภาพ มอบความสุขและรอยยิ้มให้กับทุกคน`
    };
  }
  if (!appData.services || appData.services.length === 0) {
    appData.services = [
      { id: 'srv-1', icon: '🎨', title: 'ตัวอย่างสกิน 64', description: 'ออกแบบสกินตามสไตล์ที่ต้องการ', targetCategory: 'ตัวอย่างสกิน 64' },
      { id: 'srv-2', icon: '✨', title: 'ตัวอย่างงานสกิน 512', description: 'สกินความละเอียดสูงพิเศษ ดีเทลประณีต', targetCategory: 'ตัวอย่างงานสกิน 512' },
      { id: 'srv-3', icon: '💎', title: 'ตัวอย่างงานสกิน 128', description: 'สกิน HD 128 คมชัดทุกมุมมอง', targetCategory: 'ตัวอย่างงานสกิน 128' }
    ];
  }
  if (!appData.heroBanners || appData.heroBanners.length === 0) {
    appData.heroBanners = [
      { id: 'banner-1', image: 'uploads/home-hero-banner.png', title: 'Yuki Haru', subtitle: 'ให้ทุกวันเป็นเหมือนฤดูใบไม้ผลิที่มีหิมะโปรยปราย' }
    ];
  }
  if (!appData.pricingTable) {
    appData.pricingTable = {
      title: 'ราคาทุกขนาดอยู่ตรงนี้ เลือกได้เลย ✦',
      subtitle: 'Yuki Haru • Snow Butterfly',
      note: 'อยากได้แค่ Figura หรือโมเดล 3D? ทักมาสอบถามเพิ่มเติมได้เลย ✦',
      columns: ['64 Pixel', '128 Pixel', '512 Pixel', '1024 Pixel'],
      rows: [
        {
          type: 'ส่วนหัว',
          icon: '👤',
          prices: { '64 Pixel': '35 บาท', '128 Pixel': '50 บาท', '512 Pixel': '100 บาท', '1024 Pixel': '150 บาท' }
        },
        {
          type: 'ส่วนตัว',
          icon: '👗',
          prices: { '64 Pixel': '50 บาท', '128 Pixel': '75 บาท', '512 Pixel': '180 บาทขึ้นไป', '1024 Pixel': '250 บาทขึ้นไป' }
        },
        {
          type: 'ทั้งตัว',
          icon: '✨',
          prices: { '64 Pixel': '75 บาท', '128 Pixel': '110 บาท', '512 Pixel': '260 บาทขึ้นไป', '1024 Pixel': '350 บาทขึ้นไป' }
        }
      ]
    };
  }
}

function persistLocal() {
  localStorage.setItem('yuki_portfolio_data', JSON.stringify(appData));
}

// ==================== 3D MINECRAFT SKIN VIEWER ====================
function initSkinViewer() {
  const canvas = document.getElementById('skinviewCanvas');
  if (!canvas || typeof skinview3d === 'undefined') return;

  try {
    skinViewer = new skinview3d.SkinViewer({
      canvas: canvas,
      width: 320,
      height: 400,
      fov: 58,
      alpha: true,
      preserveDrawingBuffer: true
    });

    // Sharp Retina Rendering
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    skinViewer.renderer.setPixelRatio(dpr);
    if (skinViewer.updateComposerSize) {
      skinViewer.updateComposerSize();
    }

    // Set Initial Camera (Closer & centered)
    skinViewer.camera.position.set(0, -2, 46);
    skinViewer.camera.lookAt(0, -2, 0);

    // OrbitControls Configuration:
    // Left drag ONLY rotates! Wheel zooms with large deep responsive range!
    if (skinViewer.controls) {
      skinViewer.controls.enableZoom = true;
      skinViewer.controls.zoomSpeed = 2.0;       // Fast, responsive wheel zoom
      skinViewer.controls.minDistance = 12;      // Allows super close up!
      skinViewer.controls.maxDistance = 140;     // Allows zooming far out!
      skinViewer.controls.enablePan = false;     // No panning away from center
      skinViewer.controls.enableDamping = true;
      skinViewer.controls.dampingFactor = 0.08;

      skinViewer.controls.addEventListener('start', () => { isUserInteracting = true; });
      skinViewer.controls.addEventListener('end', () => { isUserInteracting = false; });

      if (typeof THREE !== 'undefined' && THREE.MOUSE) {
        skinViewer.controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE
        };
      }
    }

    // Disable skinview3d internal playerWrapper spinning to keep player facing +Z always!
    skinViewer.autoRotate = false;

    // Load active skin
    loadSkinForActiveItem();

    // Start Pose Sequence: 1 full rotation in Stand pose, then Walk -> Run -> Sit
    startInitialPoseSequence();

    // Render loop
    startViewerRenderLoop();

  } catch (e) {
    console.warn('SkinViewer init error:', e);
  }
}

let currentFiguraGroups = [];

function removeFiguraModel() {
  if (Array.isArray(currentFiguraGroups)) {
    for (const g of currentFiguraGroups) {
      if (g && g.parent) g.parent.remove(g);
    }
  }
  currentFiguraGroups = [];
  if (currentFiguraGroup && currentFiguraGroup.parent) {
    currentFiguraGroup.parent.remove(currentFiguraGroup);
    currentFiguraGroup = null;
  }
}

// Cache for loaded Blockbench models
const bbModelCache = new Map();

async function loadAndAttachBBModel(item, headGroup, bodyGroup) {
  try {
    let modelData = bbModelCache.get(item.modelUrl);
    if (!modelData) {
      const res = await fetch(item.modelUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      modelData = await res.json();
      bbModelCache.set(item.modelUrl, modelData);
    }

    if (!skinViewer || !skinViewer.playerObject || !skinViewer.playerObject.skin) return;

    // Check if the current active item still matches this model
    const curActive = getActiveItem();
    if (!curActive || curActive.id !== item.id) return;

    removeFiguraModel();

    const resW = modelData.resolution?.width || 64;
    const resH = modelData.resolution?.height || 64;
    const elemMap = new Map((modelData.elements || []).map(e => [e.uuid, e]));
    const groupMap = new Map((modelData.groups || []).map(g => [g.uuid, g]));

    // Prepare textures and materials map
    const textureMaterials = [];
    const texLoader = new THREE.TextureLoader();

    if (Array.isArray(modelData.textures) && modelData.textures.length > 0) {
      modelData.textures.forEach((texDef) => {
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.8,
          metalness: 0.05,
          transparent: true,
          alphaTest: 0.1,
          depthWrite: true,
          depthTest: true,
          side: THREE.DoubleSide
        });
        if (texDef.source) {
          texLoader.load(texDef.source, (loadedTex) => {
            loadedTex.magFilter = THREE.NearestFilter;
            loadedTex.minFilter = THREE.NearestFilter;
            loadedTex.generateMipmaps = false;
            loadedTex.needsUpdate = true;
            mat.map = loadedTex;
            mat.needsUpdate = true;
            if (skinViewer) {
              skinViewer.render();
              setTimeout(capture3DPartSnapshots, 80);
            }
          });
        }
        textureMaterials.push(mat);
      });
    }

    const defaultMaterial = textureMaterials[0] || new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.05,
      transparent: true,
      alphaTest: 0.1,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide
    });

    function getTextureIndex(elem, faceKey) {
      let texIndex = 0;
      if (faceKey && elem.faces && elem.faces[faceKey] && elem.faces[faceKey].texture !== undefined) {
        const ft = elem.faces[faceKey].texture;
        if (typeof ft === 'number') texIndex = ft;
        else if (typeof ft === 'string') {
          const found = (modelData.textures || []).findIndex(t => t.id === ft || t.uuid === ft);
          if (found !== -1) texIndex = found;
          else {
            const parsed = parseInt(ft, 10);
            if (!isNaN(parsed) && modelData.textures && modelData.textures[parsed]) texIndex = parsed;
          }
        }
      } else if (elem.texture !== undefined) {
        if (typeof elem.texture === 'number') texIndex = elem.texture;
        else if (typeof elem.texture === 'string') {
          const found = (modelData.textures || []).findIndex(t => t.id === elem.texture || t.uuid === elem.texture);
          if (found !== -1) texIndex = found;
          else {
            const parsed = parseInt(elem.texture, 10);
            if (!isNaN(parsed) && modelData.textures && modelData.textures[parsed]) texIndex = parsed;
          }
        }
      }
      return texIndex;
    }

    function getTexResolution(texIdx) {
      if (texIdx !== undefined && texIdx !== null && modelData.textures && modelData.textures[texIdx]) {
        const t = modelData.textures[texIdx];
        return [
          t.uv_width || t.width || resW,
          t.uv_height || t.height || resH
        ];
      }
      return [resW, resH];
    }

    function getMaterialForElement(elem, faceKey) {
      if (textureMaterials.length === 0) return defaultMaterial;
      const texIndex = getTextureIndex(elem, faceKey);
      return textureMaterials[texIndex] || defaultMaterial;
    }

    function buildCubeMesh(elem, parentOrigin) {
      if (!elem.from || !elem.to) return null;
      const [fx, fy, fz] = elem.from;
      const [tx, ty, tz] = elem.to;
      const inflate = elem.inflate || 0;
      const minX = Math.min(fx, tx) - inflate;
      const maxX = Math.max(fx, tx) + inflate;
      const minY = Math.min(fy, ty) - inflate;
      const maxY = Math.max(fy, ty) + inflate;
      const minZ = Math.min(fz, tz) - inflate;
      const maxZ = Math.max(fz, tz) + inflate;

      const elemOrigin = elem.origin || [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];

      const positions = [];
      const uvs = [];
      const normals = [];

      const faceDefs = {
        east: {
          normal: [1, 0, 0],
          tl: [maxX, maxY, minZ], tr: [maxX, maxY, maxZ],
          bl: [maxX, minY, minZ], br: [maxX, minY, maxZ]
        },
        west: {
          normal: [-1, 0, 0],
          tl: [minX, maxY, maxZ], tr: [minX, maxY, minZ],
          bl: [minX, minY, maxZ], br: [minX, minY, minZ]
        },
        up: {
          normal: [0, 1, 0],
          tl: [minX, maxY, minZ], tr: [maxX, maxY, minZ],
          bl: [minX, maxY, maxZ], br: [maxX, maxY, maxZ]
        },
        down: {
          normal: [0, -1, 0],
          tl: [minX, minY, maxZ], tr: [maxX, minY, maxZ],
          bl: [minX, minY, minZ], br: [maxX, minY, minZ]
        },
        south: {
          normal: [0, 0, 1],
          tl: [maxX, maxY, maxZ], tr: [minX, maxY, maxZ],
          bl: [maxX, minY, maxZ], br: [minX, minY, maxZ]
        },
        north: {
          normal: [0, 0, -1],
          tl: [minX, maxY, minZ], tr: [maxX, maxY, minZ],
          bl: [minX, minY, minZ], br: [maxX, minY, minZ]
        }
      };

      for (const faceKey in faceDefs) {
        const face = elem.faces ? elem.faces[faceKey] : null;
        if (!face || !face.uv) continue;

        const texIdx = getTextureIndex(elem, faceKey);
        const [faceResW, faceResH] = getTexResolution(texIdx);

        const def = faceDefs[faceKey];
        const u1 = face.uv[0] / faceResW;
        const v1 = 1.0 - (face.uv[1] / faceResH);
        const u2 = face.uv[2] / faceResW;
        const v2 = 1.0 - (face.uv[3] / faceResH);

        let uvTL = [u1, v1];
        let uvTR = [u2, v1];
        let uvBL = [u1, v2];
        let uvBR = [u2, v2];

        const rot = face.rotation || 0;
        if (rot === 90) {
          const oldTL = uvTL; uvTL = uvBL; uvBL = uvBR; uvBR = uvTR; uvTR = oldTL;
        } else if (rot === 180) {
          const t1 = uvTL; uvTL = uvBR; uvBR = t1;
          const t2 = uvTR; uvTR = uvBL; uvBL = t2;
        } else if (rot === 270) {
          const oldTL = uvTL; uvTL = uvTR; uvTR = uvBR; uvBR = uvBL; uvBL = oldTL;
        }

        const vList = [def.tl, def.bl, def.tr, def.tr, def.bl, def.br];
        const uvList = [uvTL, uvBL, uvTR, uvTR, uvBL, uvBR];

        for (let i = 0; i < 6; i++) {
          positions.push(
            vList[i][0] - elemOrigin[0],
            vList[i][1] - elemOrigin[1],
            vList[i][2] - elemOrigin[2]
          );
          normals.push(def.normal[0], def.normal[1], def.normal[2]);
          uvs.push(uvList[i][0], uvList[i][1]);
        }
      }

      if (positions.length === 0) return null;

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

      const mat = getMaterialForElement(elem);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(
        elemOrigin[0] - parentOrigin[0],
        elemOrigin[1] - parentOrigin[1],
        elemOrigin[2] - parentOrigin[2]
      );

      if (elem.rotation) {
        mesh.rotation.order = 'XYZ';
        mesh.rotation.set(
          THREE.MathUtils.degToRad(elem.rotation[0] || 0),
          THREE.MathUtils.degToRad(elem.rotation[1] || 0),
          THREE.MathUtils.degToRad(elem.rotation[2] || 0)
        );
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    function buildMeshElement(elem, parentOrigin) {
      if (!elem.vertices || !elem.faces) return null;
      const elemOrigin = elem.origin || [0, 0, 0];
      const positions = [];
      const uvs = [];

      for (const faceKey in elem.faces) {
        const face = elem.faces[faceKey];
        const vKeys = face.vertices;
        if (!vKeys || vKeys.length < 3) continue;

        const texIdx = getTextureIndex(elem, faceKey);
        const [faceResW, faceResH] = getTexResolution(texIdx);

        const tris = vKeys.length === 3 ? [[0, 1, 2]] : [[0, 1, 2], [0, 2, 3]];
        for (const tri of tris) {
          for (const i of tri) {
            const vKey = vKeys[i];
            const vert = elem.vertices[vKey];
            if (!vert) continue;
            positions.push(vert[0], vert[1], vert[2]);

            let uvCoord = [0, 0];
            if (face.uv) {
              if (face.uv[vKey]) {
                uvCoord = face.uv[vKey];
              } else if (Array.isArray(face.uv)) {
                const u1 = face.uv[0], v1 = face.uv[1], u2 = face.uv[2], v2 = face.uv[3];
                const quadUvs = [[u1, v1], [u2, v1], [u2, v2], [u1, v2]];
                uvCoord = quadUvs[i] || [0, 0];
              }
            }
            const u = uvCoord[0] / faceResW;
            const v = 1.0 - (uvCoord[1] / faceResH);
            uvs.push(u, v);
          }
        }
      }

      if (positions.length === 0) return null;

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.computeVertexNormals();

      const mat = getMaterialForElement(elem);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(
        elemOrigin[0] - parentOrigin[0],
        elemOrigin[1] - parentOrigin[1],
        elemOrigin[2] - parentOrigin[2]
      );

      if (elem.rotation) {
        mesh.rotation.order = 'XYZ';
        mesh.rotation.set(
          THREE.MathUtils.degToRad(elem.rotation[0] || 0),
          THREE.MathUtils.degToRad(elem.rotation[1] || 0),
          THREE.MathUtils.degToRad(elem.rotation[2] || 0)
        );
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    function processOutlinerNode(node, parentGroup, parentOrigin) {
      if (typeof node === 'string') {
        const elem = elemMap.get(node);
        if (!elem || elem.visibility === false) return;
        const mesh = elem.type === 'mesh'
          ? buildMeshElement(elem, parentOrigin)
          : buildCubeMesh(elem, parentOrigin);
        if (mesh) parentGroup.add(mesh);
        return;
      }

      if (!node) return;
      const groupDef = groupMap.get(node.uuid) || node;
      if (groupDef.visibility === false) return;

      const boneGroup = new THREE.Group();
      boneGroup.name = groupDef.name || node.name || 'bone';
      const boneOrigin = groupDef.origin || node.origin || [0, 0, 0];
      const boneRot = groupDef.rotation || node.rotation;

      boneGroup.position.set(
        boneOrigin[0] - parentOrigin[0],
        boneOrigin[1] - parentOrigin[1],
        boneOrigin[2] - parentOrigin[2]
      );

      if (boneRot) {
        boneGroup.rotation.order = 'XYZ';
        boneGroup.rotation.set(
          THREE.MathUtils.degToRad(boneRot[0] || 0),
          THREE.MathUtils.degToRad(boneRot[1] || 0),
          THREE.MathUtils.degToRad(boneRot[2] || 0)
        );
      }

      parentGroup.add(boneGroup);

      const children = node.children || groupDef.children;
      if (Array.isArray(children)) {
        for (const child of children) {
          processOutlinerNode(child, boneGroup, boneOrigin);
        }
      }
    }

    const skinLimbs = skinViewer.playerObject.skin;
    const headGroup = skinLimbs.head;
    const bodyGroup = skinLimbs.body;
    const rightArmGroup = skinLimbs.rightArm;
    const leftArmGroup = skinLimbs.leftArm;
    const rightLegGroup = skinLimbs.rightLeg;
    const leftLegGroup = skinLimbs.leftLeg;

    const bbHeadRoot = new THREE.Group();
    bbHeadRoot.name = 'bbHeadRoot';
    bbHeadRoot.rotation.y = Math.PI;

    const bbBodyRoot = new THREE.Group();
    bbBodyRoot.name = 'bbBodyRoot';
    bbBodyRoot.rotation.y = Math.PI;
    bbBodyRoot.position.set(0, 6, 0);

    const bbRightArmRoot = new THREE.Group();
    bbRightArmRoot.name = 'bbRightArmRoot';
    bbRightArmRoot.rotation.y = Math.PI;

    const bbLeftArmRoot = new THREE.Group();
    bbLeftArmRoot.name = 'bbLeftArmRoot';
    bbLeftArmRoot.rotation.y = Math.PI;

    const bbRightLegRoot = new THREE.Group();
    bbRightLegRoot.name = 'bbRightLegRoot';
    bbRightLegRoot.rotation.y = Math.PI;

    const bbLeftLegRoot = new THREE.Group();
    bbLeftLegRoot.name = 'bbLeftLegRoot';
    bbLeftLegRoot.rotation.y = Math.PI;

    const rootBones = modelData.outliner || [];
    let attachedAny = false;

    for (const rootNode of rootBones) {
      if (!rootNode) continue;
      const groupDef = typeof rootNode === 'object' ? (groupMap.get(rootNode.uuid) || rootNode) : null;
      const bName = ((groupDef && groupDef.name) || (typeof rootNode === 'object' && rootNode.name) || '').toLowerCase();
      const nodeOrigin = (groupDef && groupDef.origin) || [0, 24, 0];

      if (bName.includes('head') || bName.includes('hair') || bName.includes('hat') || bName.includes('face')) {
        processOutlinerNode(rootNode, bbHeadRoot, [0, 24, 0]);
        attachedAny = true;
      } else if (bName.includes('rightarm') || bName.includes('right_arm') || bName.includes('right_hand')) {
        processOutlinerNode(rootNode, bbRightArmRoot, [5, 22, 0]);
        attachedAny = true;
      } else if (bName.includes('leftarm') || bName.includes('left_arm') || bName.includes('left_hand')) {
        processOutlinerNode(rootNode, bbLeftArmRoot, [-5, 22, 0]);
        attachedAny = true;
      } else if (bName.includes('rightleg') || bName.includes('right_leg') || bName.includes('right_foot')) {
        processOutlinerNode(rootNode, bbRightLegRoot, [1.9, 12, 0]);
        attachedAny = true;
      } else if (bName.includes('leftleg') || bName.includes('left_leg') || bName.includes('left_foot')) {
        processOutlinerNode(rootNode, bbLeftLegRoot, [-1.9, 12, 0]);
        attachedAny = true;
      } else if (bName.includes('body') || bName.includes('torso') || bName.includes('waist') || bName.includes('cape')) {
        processOutlinerNode(rootNode, bbBodyRoot, [0, 24, 0]);
        attachedAny = true;
      } else {
        if (nodeOrigin[1] >= 22) {
          processOutlinerNode(rootNode, bbHeadRoot, [0, 24, 0]);
          attachedAny = true;
        } else {
          processOutlinerNode(rootNode, bbBodyRoot, [0, 24, 0]);
          attachedAny = true;
        }
      }
    }

    if (!attachedAny) {
      for (const rootNode of rootBones) {
        processOutlinerNode(rootNode, bbHeadRoot, [0, 24, 0]);
      }
    }

    if (headGroup && bbHeadRoot.children.length > 0) {
      headGroup.add(bbHeadRoot);
      currentFiguraGroups.push(bbHeadRoot);
    }
    if (bodyGroup && bbBodyRoot.children.length > 0) {
      bodyGroup.add(bbBodyRoot);
      currentFiguraGroups.push(bbBodyRoot);
    }
    if (rightArmGroup && bbRightArmRoot.children.length > 0) {
      rightArmGroup.add(bbRightArmRoot);
      currentFiguraGroups.push(bbRightArmRoot);
    }
    if (leftArmGroup && bbLeftArmRoot.children.length > 0) {
      leftArmGroup.add(bbLeftArmRoot);
      currentFiguraGroups.push(bbLeftArmRoot);
    }
    if (rightLegGroup && bbRightLegRoot.children.length > 0) {
      rightLegGroup.add(bbRightLegRoot);
      currentFiguraGroups.push(bbRightLegRoot);
    }
    if (leftLegGroup && bbLeftLegRoot.children.length > 0) {
      leftLegGroup.add(bbLeftLegRoot);
      currentFiguraGroups.push(bbLeftLegRoot);
    }

    if (skinViewer) {
      skinViewer.render();
    }
    setTimeout(capture3DPartSnapshots, 120);
  } catch (err) {
    console.error('Error loading Blockbench model:', err);
  }
}

function attachFiguraModel(item) {
  // Figura removed per user directive
}

// ==================== 3D MODEL PART SNAPSHOT GENERATOR ====================
// Automatically renders real 3D head/body/detail snapshots for the preview buttons
function capture3DPartSnapshots() {
  if (!skinViewer || !skinViewer.renderer || !skinViewer.scene || !skinViewer.camera) return;

  const originalPos = skinViewer.camera.position.clone();
  const originalTarget = skinViewer.controls ? skinViewer.controls.target.clone() : new THREE.Vector3(0, -2, 0);

  try {
    // 1. Head 3D Model Close-up Snapshot
    skinViewer.camera.position.set(0, 3.8, 17);
    skinViewer.camera.lookAt(0, 3.8, 0);
    skinViewer.renderer.render(skinViewer.scene, skinViewer.camera);
    const headSnap = skinViewer.canvas.toDataURL('image/png');
    const img1 = document.getElementById('detailImg1');
    if (img1) {
      img1.src = headSnap;
      img1.style.imageRendering = 'auto';
    }

    // 2. Body 3D Model Close-up Snapshot
    skinViewer.camera.position.set(0, -3.2, 24);
    skinViewer.camera.lookAt(0, -3.2, 0);
    skinViewer.renderer.render(skinViewer.scene, skinViewer.camera);
    const bodySnap = skinViewer.canvas.toDataURL('image/png');
    const img2 = document.getElementById('detailImg2');
    if (img2) {
      img2.src = bodySnap;
      img2.style.imageRendering = 'auto';
    }

    // 3. Detail 3D Model Angled Close-up Snapshot
    skinViewer.camera.position.set(7, 4.2, 17);
    skinViewer.camera.lookAt(0, 3.5, 0);
    skinViewer.renderer.render(skinViewer.scene, skinViewer.camera);
    const detailSnap = skinViewer.canvas.toDataURL('image/png');
    const img3 = document.getElementById('detailImg3');
    if (img3) {
      img3.src = detailSnap;
      img3.style.imageRendering = 'auto';
    }

    // 4. Figura 3D Model Dedicated Cover Snapshot (Isometric Perspective)
    const active = getActiveItem();
    if (active) {
      const isFigura = (active.itemType === 'figura' || (active.category && active.category.includes('Figura')) || Boolean(active.modelUrl));
      if (isFigura) {
        skinViewer.camera.position.set(4, 3.8, 19);
        skinViewer.camera.lookAt(0, 3.4, 0);
        skinViewer.renderer.render(skinViewer.scene, skinViewer.camera);
        const coverSnap = skinViewer.canvas.toDataURL('image/png');
        figuraCoverSnapshots[active.id] = coverSnap;

        const thumbImg = document.getElementById(`thumbImg_${active.id}`);
        if (thumbImg) {
          thumbImg.src = coverSnap;
          thumbImg.className = 'w-full h-full object-cover';
          thumbImg.style.imageRendering = 'auto';
        }

        if (!active.hasAutoCoverSaved) {
          active.hasAutoCoverSaved = true;
          fetch('/api/save-cover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: active.id, dataUrl: coverSnap })
          }).then(r => r.json()).then(data => {
            if (data && data.coverUrl) {
              active.headerImage = data.coverUrl;
            }
          }).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.warn('Snapshot capture notice:', e);
  } finally {
    skinViewer.camera.position.copy(originalPos);
    if (skinViewer.controls) {
      skinViewer.controls.target.copy(originalTarget);
    }
    skinViewer.camera.lookAt(originalTarget);
    skinViewer.renderer.render(skinViewer.scene, skinViewer.camera);
  }
}

// Base Mannequin Skin paths for each scale (64px, 128px, 512px)
const BASE_MANNEQUIN_SKIN_64_URL = '/uploads/base-mannequin-skin-64.png';
const BASE_MANNEQUIN_SKIN_128_URL = '/uploads/base-mannequin-skin-128.png';
const BASE_MANNEQUIN_SKIN_512_URL = '/uploads/base-mannequin-skin-512.png';
const BASE_MANNEQUIN_SKIN_URL = '/uploads/base-mannequin-skin-64.png';

// Cache for prepared skin textures
const preparedSkinCache = new Map();

// Composite mannequin into empty/transparent areas for skins without skin/body (outfit-only)
function prepareSkinTexture(skinUrl, itemOrCategory) {
  if (!skinUrl) return Promise.resolve('/uploads/custom-yuki-skin.png');
  if (preparedSkinCache.has(skinUrl)) {
    return Promise.resolve(preparedSkinCache.get(skinUrl));
  }

  return new Promise((resolve) => {
    const userImg = new Image();
    userImg.crossOrigin = 'anonymous';

    userImg.onload = () => {
      try {
        const sw = userImg.width;
        const sh = userImg.height;

        // Create an offscreen canvas to analyze whether this skin lacks skin/face (outfit-only)
        const testCanvas = document.createElement('canvas');
        testCanvas.width = sw;
        testCanvas.height = sh;
        const testCtx = testCanvas.getContext('2d');
        testCtx.drawImage(userImg, 0, 0);

        const scale = sw / 64;

        // Sample base layer regions to detect missing body parts or missing face
        function getRegionRatio(rx, ry, rw, rh) {
          const sx = Math.floor(rx * scale);
          const sy = Math.floor(ry * scale);
          const sw_r = Math.max(1, Math.floor(rw * scale));
          const sh_r = Math.max(1, Math.floor(rh * scale));
          const regionData = testCtx.getImageData(sx, sy, sw_r, sh_r).data;
          let op = 0;
          for (let i = 3; i < regionData.length; i += 4) {
            if (regionData[i] > 25) op++;
          }
          return op / (regionData.length / 4);
        }

        const faceRatio = getRegionRatio(8, 8, 8, 8);
        const topHeadRatio = getRegionRatio(8, 0, 8, 8);
        const torsoRatio = getRegionRatio(20, 20, 8, 12);
        const armRatio = getRegionRatio(44, 20, 4, 12);
        const legRatio = getRegionRatio(4, 20, 4, 12);

        // Skin needs mannequin if face is missing (outfit-only) OR body/torso/limbs are missing (head-only / incomplete)
        const isOutfitOnly = (faceRatio < 0.25) && (topHeadRatio < 0.25);
        const isHeadOnlyOrIncompleteBody = (torsoRatio < 0.35) || (armRatio < 0.25) || (legRatio < 0.25);
        const needsMannequin = isOutfitOnly || isHeadOnlyOrIncompleteBody;

        if (!needsMannequin) {
          // Normal complete skin: keep 100% original without modifying
          preparedSkinCache.set(skinUrl, skinUrl);
          return resolve(skinUrl);
        }

        // Outfit-only skin: choose 512px, 128px, or 64px mannequin based on resolution & category!
        // Note: สกินขนาด 1024px ใช้หุ่นของ 512px ตามที่กำหนด
        let chosenMannequinUrl = BASE_MANNEQUIN_SKIN_64_URL;
        const catStr = (typeof itemOrCategory === 'string' ? itemOrCategory : (itemOrCategory?.category || ''));

        if (sw >= 256 || catStr.includes('512') || catStr.includes('1024')) {
          chosenMannequinUrl = BASE_MANNEQUIN_SKIN_512_URL;
        } else if ((sw >= 96 && sw <= 255) || catStr.includes('128')) {
          chosenMannequinUrl = BASE_MANNEQUIN_SKIN_128_URL;
        } else {
          chosenMannequinUrl = BASE_MANNEQUIN_SKIN_64_URL;
        }

        const mannequinImg = new Image();
        mannequinImg.crossOrigin = 'anonymous';

        mannequinImg.onload = () => {
          try {
            const targetW = Math.max(sw, (mannequinImg.width || 64));
            const targetH = Math.max(sh, (mannequinImg.height || targetW));

            const outCanvas = document.createElement('canvas');
            outCanvas.width = targetW;
            outCanvas.height = targetH;
            const outCtx = outCanvas.getContext('2d');
            outCtx.imageSmoothingEnabled = false;

            // 1. Draw base mannequin (64, 128, or 512) as base body
            outCtx.drawImage(mannequinImg, 0, 0, targetW, targetH);

            // 2. Draw user skin (clothes/outfit) ON TOP so opaque clothes cover mannequin, transparent shows mannequin
            outCtx.drawImage(userImg, 0, 0, targetW, targetH);

            const compositedDataUrl = outCanvas.toDataURL('image/png');
            preparedSkinCache.set(skinUrl, compositedDataUrl);
            resolve(compositedDataUrl);
          } catch (err) {
            console.warn('Mannequin composite error:', err);
            resolve(skinUrl);
          }
        };

        mannequinImg.onerror = () => {
          if (chosenMannequinUrl !== BASE_MANNEQUIN_SKIN_64_URL) {
            chosenMannequinUrl = BASE_MANNEQUIN_SKIN_64_URL;
            mannequinImg.src = BASE_MANNEQUIN_SKIN_64_URL;
          } else {
            resolve(skinUrl);
          }
        };

        mannequinImg.src = chosenMannequinUrl;
      } catch (e) {
        console.warn('Skin detection error:', e);
        resolve(skinUrl);
      }
    };

    userImg.onerror = () => {
      resolve(skinUrl || '/uploads/custom-yuki-skin.png');
    };

    userImg.src = skinUrl;
  });
}

function updatePartThumbnailsFromSkin(skinUrl) {
  if (!skinUrl) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const sw = img.width;
      const sh = img.height;
      const scale = sw / 64;

      // 1. Head Thumbnail (Front Face + Hat Layer)
      const c1 = document.createElement('canvas');
      c1.width = 128;
      c1.height = 128;
      const ctx1 = c1.getContext('2d');
      ctx1.imageSmoothingEnabled = false;
      ctx1.drawImage(img, 8 * scale, 8 * scale, 8 * scale, 8 * scale, 16, 16, 96, 96);
      ctx1.drawImage(img, 40 * scale, 8 * scale, 8 * scale, 8 * scale, 12, 12, 104, 104);
      const img1 = document.getElementById('detailImg1');
      if (img1) {
        img1.src = c1.toDataURL('image/png');
        img1.style.imageRendering = 'pixelated';
      }

      // 2. Body Thumbnail (Front Torso + Jacket Overlay)
      const c2 = document.createElement('canvas');
      c2.width = 128;
      c2.height = 128;
      const ctx2 = c2.getContext('2d');
      ctx2.imageSmoothingEnabled = false;
      ctx2.drawImage(img, 20 * scale, 20 * scale, 8 * scale, 12 * scale, 24, 16, 80, 96);
      ctx2.drawImage(img, 20 * scale, 36 * scale, 8 * scale, 12 * scale, 20, 12, 88, 104);
      const img2 = document.getElementById('detailImg2');
      if (img2) {
        img2.src = c2.toDataURL('image/png');
        img2.style.imageRendering = 'pixelated';
      }

      // 3. Detail/Outfit Thumbnail (Full Character Front View)
      const c3 = document.createElement('canvas');
      c3.width = 128;
      c3.height = 128;
      const ctx3 = c3.getContext('2d');
      ctx3.imageSmoothingEnabled = false;
      ctx3.drawImage(img, 8 * scale, 8 * scale, 8 * scale, 8 * scale, 48, 8, 32, 32);
      ctx3.drawImage(img, 40 * scale, 8 * scale, 8 * scale, 8 * scale, 46, 6, 36, 36);
      ctx3.drawImage(img, 20 * scale, 20 * scale, 8 * scale, 12 * scale, 48, 40, 32, 48);
      ctx3.drawImage(img, 20 * scale, 36 * scale, 8 * scale, 12 * scale, 46, 38, 36, 52);
      ctx3.drawImage(img, 44 * scale, 20 * scale, 4 * scale, 12 * scale, 32, 40, 16, 48);
      ctx3.drawImage(img, (sh >= 64 ? 36 : 44) * scale, (sh >= 64 ? 52 : 20) * scale, 4 * scale, 12 * scale, 80, 40, 16, 48);
      ctx3.drawImage(img, 4 * scale, 20 * scale, 4 * scale, 12 * scale, 48, 88, 16, 36);
      ctx3.drawImage(img, (sh >= 64 ? 20 : 4) * scale, (sh >= 64 ? 52 : 20) * scale, 4 * scale, 12 * scale, 64, 88, 16, 36);
      const img3 = document.getElementById('detailImg3');
      if (img3) {
        img3.src = c3.toDataURL('image/png');
        img3.style.imageRendering = 'pixelated';
      }
    } catch (e) {
      console.warn('2D skin crop notice:', e);
    }
  };
  img.src = skinUrl;
}

function fixSkinMeshMaterials(viewer) {
  if (!viewer || !viewer.playerObject) return;
  try {
    viewer.playerObject.traverse((node) => {
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(m => {
          if (m) {
            m.transparent = true;
            m.alphaTest = 0.05;
            m.needsUpdate = true;
          }
        });
      }
    });
  } catch (err) {
    // ignore
  }
}

async function loadSkinForActiveItem() {
  const item = getActiveItem();
  if (!item || !skinViewer) return;

  const rawSkinUrl = item.skinTexture || item.image || '/uploads/custom-yuki-skin.png';
  const modelType = (item.modelType === 'classic' || item.modelType === 'steve' || item.modelType === 'default') ? 'default' : 'slim';

  try {
    const finalSkinUrl = await prepareSkinTexture(rawSkinUrl, item);
    // 1. Immediately update the 3 right buttons from the skin
    updatePartThumbnailsFromSkin(finalSkinUrl);

    await skinViewer.loadSkin(finalSkinUrl, { model: modelType })
      .catch(() => skinViewer.loadSkin(finalSkinUrl).catch(() => {}));
    fixSkinMeshMaterials(skinViewer);
  } catch (e) {
    console.warn('Skin loading failed:', e);
  } finally {
    setTimeout(() => {
      // 2. Capture real 3D camera snapshots for the 3 buttons
      capture3DPartSnapshots();
    }, 80);
  }
}

// Sequence: ยืนตรงหมุน 1 รอบก่อน -> เดิน -> วิ่ง -> นั่ง
function startInitialPoseSequence() {
  if (!skinViewer) return;
  initialFullRotationDone = false;
  accumulatedRotation = 0;
  isAutoPoseSequence = true;

  setPlayerPose('stand');
}

function setPlayerPose(pose, userClicked = false) {
  if (isVideoMode) {
    if (!userClicked) {
      // Background auto-pose animations should never abort video mode!
      return;
    }
    toggleVideoShowcase(false);
  }
  currentPose = pose;
  if (userClicked) {
    isAutoPoseSequence = false;
    if (poseTimer) {
      clearTimeout(poseTimer);
      poseTimer = null;
    }
  }

  updatePoseButtonsUI(pose);
  if (!skinViewer) return;

  if (viewerMode === 'still') {
    applyStandPose();
    return;
  }

  if (pose === 'stand') {
    applyStandPose();
  } else if (pose === 'walk') {
    if (skinview3d.WalkingAnimation) {
      const anim = new skinview3d.WalkingAnimation();
      anim.speed = 0.75;
      skinViewer.animation = anim;
    }
  } else if (pose === 'run') {
    if (skinview3d.RunningAnimation) {
      const anim = new skinview3d.RunningAnimation();
      anim.speed = 1.15;
      skinViewer.animation = anim;
    }
  } else if (pose === 'sit') {
    applySittingPose();
  }
}

function applyStandPose() {
  if (!skinViewer) return;
  skinViewer.animation = new skinview3d.FunctionAnimation((player, time) => {
    player.position.y = -5;
    player.skin.leftLeg.rotation.x = 0;
    player.skin.rightLeg.rotation.x = 0;
    player.skin.leftLeg.rotation.y = 0;
    player.skin.rightLeg.rotation.y = 0;
    player.skin.leftArm.rotation.x = 0;
    player.skin.rightArm.rotation.x = 0;
    player.skin.leftArm.rotation.z = -0.05;
    player.skin.rightArm.rotation.z = 0.05;
    player.skin.head.rotation.y = Math.sin(time * 0.7) * 0.04;
  });
}

function applySittingPose() {
  if (!skinViewer) return;
  skinViewer.animation = new skinview3d.FunctionAnimation((player, time) => {
    player.position.y = -10;
    player.skin.leftLeg.rotation.x = -Math.PI / 2;
    player.skin.rightLeg.rotation.x = -Math.PI / 2;
    player.skin.leftLeg.rotation.y = -0.08;
    player.skin.rightLeg.rotation.y = 0.08;
    player.skin.leftArm.rotation.x = -Math.PI / 4.5 + Math.sin(time * 1.5) * 0.02;
    player.skin.rightArm.rotation.x = -Math.PI / 4.5 + Math.sin(time * 1.5) * 0.02;
    player.skin.leftArm.rotation.z = -0.05;
    player.skin.rightArm.rotation.z = 0.05;
    player.skin.head.rotation.y = Math.sin(time * 0.8) * 0.05;
  });
}

function updatePoseButtonsUI(pose) {
  const poses = ['stand', 'walk', 'run', 'sit'];
  poses.forEach(p => {
    const btn = document.getElementById('poseBtn' + p.charAt(0).toUpperCase() + p.slice(1));
    if (btn) {
      if (p === pose) {
        btn.className = 'px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-600 text-white shadow-xs transition';
      } else {
        btn.className = 'px-2 py-0.5 rounded-lg text-[10px] text-purple-800 hover:bg-purple-100 transition';
      }
    }
  });
}

// Camera Helper: Transition camera smoothly along an arc around target
function transitionCameraTo({ targetTheta = null, targetRadius = null, targetY = null, targetFocusY = null, duration = 450 }) {
  if (!skinViewer) return;

  const curX = skinViewer.camera.position.x;
  const curY = skinViewer.camera.position.y;
  const curZ = skinViewer.camera.position.z;
  const curTargetY = skinViewer.controls ? skinViewer.controls.target.y : -2;

  const curRadius = Math.hypot(curX, curZ) || 46;
  const curTheta = Math.atan2(curX, curZ);

  // If targetTheta is null, preserve current viewing angle
  const finalTheta = (targetTheta !== null) ? targetTheta : curTheta;
  const finalRadius = (targetRadius !== null) ? targetRadius : curRadius;
  const finalY = (targetY !== null) ? targetY : curY;
  const finalFocusY = (targetFocusY !== null) ? targetFocusY : curTargetY;

  // Shortest circular delta in [-PI, +PI]
  let dTheta = 0;
  if (targetTheta !== null) {
    dTheta = (finalTheta - curTheta) % (Math.PI * 2);
    if (dTheta > Math.PI) dTheta -= Math.PI * 2;
    if (dTheta < -Math.PI) dTheta += Math.PI * 2;
  }

  camTransitionStartTime = Date.now();
  camTransitionDuration = duration;
  camTransitionState = {
    startTheta: curTheta,
    dTheta: dTheta,
    startRadius: curRadius,
    endRadius: finalRadius,
    startY: curY,
    endY: finalY,
    startTargetY: curTargetY,
    endTargetY: finalFocusY
  };
  isCameraTransitioning = true;
}

// Viewer Render Loop: Smooth zoom transition + consistent camera orbit
function startViewerRenderLoop() {
  function loop() {
    if (skinViewer) {
      // Ensure player model itself stays strictly anchored facing world +Z
      if (skinViewer.playerWrapper) {
        skinViewer.playerWrapper.rotation.set(0, 0, 0);
      }
      if (skinViewer.playerObject) {
        skinViewer.playerObject.rotation.set(0, 0, 0);
      }

      // 1. Smooth Camera Transition along an arc (NEVER passes through body!)
      if (isCameraTransitioning) {
        const elapsed = (Date.now() - camTransitionStartTime) / camTransitionDuration;
        if (elapsed >= 1) {
          isCameraTransitioning = false;
          const finalAngle = camTransitionState.startTheta + camTransitionState.dTheta;
          const finalX = camTransitionState.endRadius * Math.sin(finalAngle);
          const finalZ = camTransitionState.endRadius * Math.cos(finalAngle);
          skinViewer.camera.position.set(finalX, camTransitionState.endY, finalZ);
          if (skinViewer.controls) {
            skinViewer.controls.target.y = camTransitionState.endTargetY;
            skinViewer.controls.update();
          }
        } else {
          // Smooth cubic ease-out
          const t = 1 - Math.pow(1 - elapsed, 3);
          const curAngle = camTransitionState.startTheta + camTransitionState.dTheta * t;
          const curR = camTransitionState.startRadius + (camTransitionState.endRadius - camTransitionState.startRadius) * t;
          const curY = camTransitionState.startY + (camTransitionState.endY - camTransitionState.startY) * t;
          const curTargetY = camTransitionState.startTargetY + (camTransitionState.endTargetY - camTransitionState.startTargetY) * t;

          const curX = curR * Math.sin(curAngle);
          const curZ = curR * Math.cos(curAngle);

          skinViewer.camera.position.set(curX, curY, curZ);
          if (skinViewer.controls) {
            skinViewer.controls.target.y = curTargetY;
            skinViewer.controls.update();
          }
        }
      }

      // 2. Consistent Camera Orbiting for Auto-Rotate (NEVER inverts front/back!)
      if (viewerMode === 'animated' && isAutoRotating && !isCameraTransitioning && !isUserInteracting && !isVideoMode) {
        const curX = skinViewer.camera.position.x;
        const curZ = skinViewer.camera.position.z;
        const dist = Math.hypot(curX, curZ) || 46;
        const curAngle = Math.atan2(curX, curZ);
        const deltaAngle = 0.022; // Smooth camera orbit speed
        const newAngle = curAngle + deltaAngle;

        skinViewer.camera.position.x = dist * Math.sin(newAngle);
        skinViewer.camera.position.z = dist * Math.cos(newAngle);
        if (skinViewer.controls) {
          skinViewer.controls.update();
        }

        // Track 1st Full Rotation (360 degrees = 2 * PI) in Stand pose
        if (!isVideoMode && isAutoPoseSequence && !initialFullRotationDone) {
          accumulatedRotation += deltaAngle;

          if (accumulatedRotation >= Math.PI * 2) {
            initialFullRotationDone = true;
            if (!isVideoMode) {
              setPlayerPose('walk');

              poseTimer = setTimeout(() => {
                if (isAutoPoseSequence && !isVideoMode) {
                  setPlayerPose('run');

                  poseTimer = setTimeout(() => {
                    if (isAutoPoseSequence && !isVideoMode) {
                      setPlayerPose('sit');

                      poseTimer = setTimeout(() => {
                        if (isAutoPoseSequence && !isVideoMode) {
                          setPlayerPose('walk');
                        }
                      }, 7000);
                    }
                  }, 7000);
                }
              }, 7000);
            }
          }
        }
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// ==================== CLICK TO ZOOM TO MODEL PART ====================
// Preserves the exact angle the user is currently facing (Front, Back, Side)!
function zoomToModelPart(part) {
  if (isVideoMode) {
    toggleVideoShowcase(false);
  }
  if (activeZoomPart === part && part !== 'full') {
    part = 'full';
  }
  activeZoomPart = part;
  updateZoomButtonsUI(part);

  if (part === 'head') {
    transitionCameraTo({
      targetTheta: null, // Preserves exact viewing angle!
      targetRadius: 23,
      targetY: 13,
      targetFocusY: 10,
      duration: 450
    });
    showToast('🔍 ซูมดูส่วนหัว (ตามทิศทางที่หัน)');
  } else if (part === 'body') {
    transitionCameraTo({
      targetTheta: null, // Preserves exact viewing angle!
      targetRadius: 27,
      targetY: 1.5,
      targetFocusY: 0.5,
      duration: 450
    });
    showToast('🔍 ซูมดูส่วนตัว (ตามทิศทางที่หัน)');
  } else if (part === 'detail') {
    transitionCameraTo({
      targetTheta: null, // Preserves exact viewing angle!
      targetRadius: 26,
      targetY: -12,
      targetFocusY: -12,
      duration: 450
    });
    showToast('🔍 ซูมดูดีเทล (ตามทิศทางที่หัน)');
  } else {
    transitionCameraTo({
      targetTheta: null, // Preserves exact viewing angle!
      targetRadius: 46,
      targetY: -2,
      targetFocusY: -2,
      duration: 450
    });
    showToast('🔍 มุมมองเต็มตัว');
  }
}

function updateZoomButtonsUI(part) {
  const btnHead = document.getElementById('zoomBtnHead');
  const btnBody = document.getElementById('zoomBtnBody');
  const btnDetail = document.getElementById('zoomBtnDetail');
  if (btnHead) btnHead.classList.toggle('active', part === 'head');
  if (btnBody) btnBody.classList.toggle('active', part === 'body');
  if (btnDetail) btnDetail.classList.toggle('active', part === 'detail');
}

// ==================== VIEWER MODE SWITCH ====================
function switchViewerMode(mode) {
  if (isVideoMode) {
    toggleVideoShowcase(false);
  }
  viewerMode = mode;
  const btnAnim = document.getElementById('btnModeAnimated');
  const btnStill = document.getElementById('btnModeStill');
  const poseBar = document.getElementById('poseButtonsBar');

  if (mode === 'animated') {
    btnAnim.className = 'px-3 py-1.5 rounded-xl font-bold transition text-[11px] bg-white text-purple-900 shadow-sm border border-purple-200 flex items-center gap-1.5';
    btnStill.className = 'px-3 py-1.5 rounded-xl font-medium transition text-[11px] text-purple-700 hover:bg-white/70 flex items-center gap-1.5';
    poseBar.classList.remove('hidden');
    startInitialPoseSequence();
    showToast('เปิดโหมด "ตัวอย่างสกินแบบเคลื่อนไหว" ✨');
  } else {
    btnStill.className = 'px-3 py-1.5 rounded-xl font-bold transition text-[11px] bg-white text-purple-900 shadow-sm border border-purple-200 flex items-center gap-1.5';
    btnAnim.className = 'px-3 py-1.5 rounded-xl font-medium transition text-[11px] text-purple-700 hover:bg-white/70 flex items-center gap-1.5';
    poseBar.classList.add('hidden');
    clearTimeout(poseTimer);
    isAutoPoseSequence = false;
    applyStandPose();
    showToast('เปิดโหมด "ตัวอย่างสกินแบบนิ่ง" 🧍');
  }
}

// ==================== ROTATION & ANGLE CONTROLS ====================
function toggleAutoRotate() {
  if (isVideoMode) {
    toggleVideoShowcase(false);
  }
  isAutoRotating = !isAutoRotating;
  const icon = document.getElementById('autoRotateIcon');
  const text = document.getElementById('autoRotateText');

  // Keep skinViewer.autoRotate strictly false! Camera orbit is handled in our loop.
  if (skinViewer) {
    skinViewer.autoRotate = false;
    if (skinViewer.playerWrapper) skinViewer.playerWrapper.rotation.set(0, 0, 0);
  }

  if (isAutoRotating) {
    if (icon) icon.textContent = '⏸️';
    if (text) text.textContent = 'หยุดหมุน';
    showToast('เปิดการหมุนต่อ 🔄');
  } else {
    if (icon) icon.textContent = '🔄';
    if (text) text.textContent = 'หมุนต่อ';
    showToast('หยุดหมุนแล้ว ⏸️');
  }
}

// หันหน้า (Front: theta = 0, facing world +Z)
function resetRotation() {
  if (isVideoMode) {
    toggleVideoShowcase(false);
  }
  if (!skinViewer) return;
  activeZoomPart = 'full';
  updateZoomButtonsUI('full');

  // Rotate smoothly in an arc to Front (theta = 0)
  transitionCameraTo({
    targetTheta: 0,
    targetRadius: 46,
    targetY: -2,
    targetFocusY: -2,
    duration: 500
  });
  showToast('หันมุมมองด้านหน้า');
}

// หันหลัง (Back: theta = PI, facing world -Z)
function rotateAngle(angleDeg) {
  if (isVideoMode) {
    toggleVideoShowcase(false);
  }
  if (!skinViewer) return;
  activeZoomPart = 'full';
  updateZoomButtonsUI('full');

  const rad = (angleDeg * Math.PI) / 180; // 180 deg = Math.PI
  // Rotate smoothly in an arc to Back (theta = PI)
  transitionCameraTo({
    targetTheta: rad,
    targetRadius: 46,
    targetY: -2,
    targetFocusY: -2,
    duration: 500
  });
  showToast('หันมุมมองด้านหลัง');
}

// ==================== HIGH-PERFORMANCE 60FPS CANVAS SNOW ====================
function initSnowCanvas() {
  snowCanvas = document.getElementById('snowCanvas');
  if (!snowCanvas) return;
  snowCtx = snowCanvas.getContext('2d');

  function resize() {
    snowCanvas.width = window.innerWidth;
    snowCanvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const count = 22;
  snowParticles = [];
  for (let i = 0; i < count; i++) {
    snowParticles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 2.2 + 0.8,
      speedY: Math.random() * 0.9 + 0.4,
      speedX: Math.random() * 0.4 - 0.2
    });
  }

  function renderSnow() {
    if (snowEnabled && snowCtx) {
      snowCtx.clearRect(0, 0, snowCanvas.width, snowCanvas.height);
      snowCtx.fillStyle = 'rgba(255, 255, 255, 0.75)';

      for (let i = 0; i < snowParticles.length; i++) {
        const p = snowParticles[i];
        p.y += p.speedY;
        p.x += p.speedX;

        if (p.y > snowCanvas.height) {
          p.y = -5;
          p.x = Math.random() * snowCanvas.width;
        }
        if (p.x > snowCanvas.width) p.x = 0;
        if (p.x < 0) p.x = snowCanvas.width;

        snowCtx.beginPath();
        snowCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        snowCtx.fill();
      }
    }
    snowRaf = requestAnimationFrame(renderSnow);
  }
  renderSnow();
}

function toggleSnow() {
  snowEnabled = !snowEnabled;
  if (!snowEnabled && snowCtx) {
    snowCtx.clearRect(0, 0, snowCanvas.width, snowCanvas.height);
  }
  showToast(snowEnabled ? 'เปิดหิมะ ❄️' : 'ปิดหิมะ');
}

// ==================== MASTER RENDER ====================
function renderAll() {
  renderConfig();
  renderHeroBanners();
  renderAboutSection();
  renderServices();
  renderCategoryPills();
  renderAnnouncements();
  renderLeftThumbnails();
  renderCenterShowcase();
  renderRightPricing();
  renderPremadeCards();
  renderPricingTable();
  renderRemakeTables();
  renderAddonTable();
  updateModeUI();
  lucide.createIcons();
}

function renderConfig() {
  const cfg = appData.siteConfig || {};
  const navTitleEl = document.getElementById('navTitle');
  const navSubtitleEl = document.getElementById('navSubtitle');
  if (navTitleEl) navTitleEl.textContent = cfg.title || 'Yuki Haru';
  if (navSubtitleEl) navSubtitleEl.textContent = cfg.brandSub || 'ゆきはる';
  
  const orderDiscord = document.getElementById('orderDiscordText');
  if (orderDiscord) orderDiscord.textContent = cfg.discord || 'https://discord.gg/FyPfgC3Yj4';

  const dcServerLink = document.getElementById('orderDiscordServerLink');
  if (dcServerLink) {
    dcServerLink.href = cfg.discord && cfg.discord.includes('http') ? cfg.discord : 'https://discord.gg/FyPfgC3Yj4';
  }

  const cfgTitle = document.getElementById('configTitle');
  const cfgSub = document.getElementById('configSubtitle');
  const cfgDiscord = document.getElementById('configDiscord');

  if (cfgTitle) cfgTitle.value = cfg.title || '';
  if (cfgSub) cfgSub.value = cfg.brandSub || '';
  if (cfgDiscord) cfgDiscord.value = cfg.discord || 'https://discord.gg/FyPfgC3Yj4';
}

function scrollCategoryPills(dir) {
  const container = document.getElementById('categoryChipsContainer');
  if (container) {
    container.scrollBy({ left: dir * 200, behavior: 'smooth' });
  }
}

let draggedCategoryPill = null;

function renderCategoryPills() {
  const container = document.getElementById('categoryChipsContainer');
  const modalSelect = document.getElementById('itemCategorySelect');
  const existingList = document.getElementById('existingCategoriesList');

  if (!container || !modalSelect) return;

  container.innerHTML = '';
  modalSelect.innerHTML = '';
  if (existingList) existingList.innerHTML = '';

  // Gallery items only (strictly exclude premade skins from commission gallery)
  const galleryItems = (appData.items || []).filter(i => !i.isPremade && i.category !== 'สกินสำเร็จ');
  // Gallery categories (strictly exclude "สกินสำเร็จ" from gallery filter pills)
  const galleryCategories = (appData.categories || []).filter(c => c !== 'สกินสำเร็จ');

  const allBtn = document.createElement('button');
  allBtn.className = `cat-pill px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all ${
    currentCategory === 'ALL' ? 'active ring-2 ring-purple-400/50 shadow-sm' : 'hover:bg-purple-100/60'
  }`;
  allBtn.innerHTML = `
    <span>✦ ทั้งหมด</span>
    <span class="text-[10px] opacity-75">(${galleryItems.length})</span>
  `;
  allBtn.onclick = () => selectCategory('ALL');
  container.appendChild(allBtn);

  galleryCategories.forEach((cat, index) => {
    const count = galleryItems.filter(i => i.category === cat).length;
    const isFirst = index === 0;
    const isLast = index === galleryCategories.length - 1;

    // --- 1. Category Pill on top bar (Draggable & Clickable) ---
    const btn = document.createElement('button');
    btn.className = `cat-pill px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all select-none cursor-pointer ${
      currentCategory === cat ? 'active ring-2 ring-purple-400/50 shadow-sm' : 'hover:bg-purple-100/60'
    }`;
    btn.draggable = true;
    btn.title = `คลิกเพื่อดูหมวด ${cat} (คลิกลากเพื่อสลับลำดับได้)`;
    btn.innerHTML = `
      <span class="opacity-50 text-[10px] cursor-grab">⋮⋮</span>
      <span>❄️ ${escapeHtml(cat)}</span>
      <span class="text-[10px] opacity-75">(${count})</span>
    `;

    btn.onclick = () => selectCategory(cat);

    // Drag-and-drop on pills directly in the bar
    btn.addEventListener('dragstart', (e) => {
      draggedCategoryPill = cat;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', cat);
      btn.classList.add('opacity-40', 'scale-95');
    });
    btn.addEventListener('dragend', () => {
      draggedCategoryPill = null;
      btn.classList.remove('opacity-40', 'scale-95');
    });
    btn.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      btn.classList.add('ring-2', 'ring-purple-500');
    });
    btn.addEventListener('dragleave', () => {
      btn.classList.remove('ring-2', 'ring-purple-500');
    });
    btn.addEventListener('drop', async (e) => {
      e.preventDefault();
      btn.classList.remove('ring-2', 'ring-purple-500');
      if (!draggedCategoryPill || draggedCategoryPill === cat) return;
      await reorderCategoryDirect(draggedCategoryPill, cat);
    });

    container.appendChild(btn);

    // --- 2. Option for Modal Category Select ---
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    modalSelect.appendChild(opt);

    // --- 3. Row inside Existing Categories Modal (with ◀ / ▶ and ✕) ---
    if (existingList) {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between bg-white border border-purple-200/90 px-3 py-2 rounded-xl text-xs text-purple-950 shadow-2xs hover:border-purple-300 transition';
      row.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-purple-400 font-mono text-xs select-none">#${index + 1}</span>
          <span class="font-bold truncate">${escapeHtml(cat)}</span>
          <span class="text-[10px] text-purple-500 shrink-0 font-medium bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-100">${count} ผลงาน</span>
        </div>
        <div class="flex items-center gap-1 shrink-0 ml-2">
          <button type="button" onclick="moveCategoryOrder('${escapeHtml(cat)}', -1)" ${isFirst ? 'disabled class="opacity-25 cursor-not-allowed"' : 'class="hover:bg-purple-100 active:scale-90 text-purple-700 hover:border-purple-300"'} class="w-7 h-7 rounded-lg border border-purple-200 bg-white flex items-center justify-center font-bold text-xs transition shadow-2xs" title="เลื่อนไปทางซ้าย (ก่อนหน้า)">
            ◀
          </button>
          <button type="button" onclick="moveCategoryOrder('${escapeHtml(cat)}', 1)" ${isLast ? 'disabled class="opacity-25 cursor-not-allowed"' : 'class="hover:bg-purple-100 active:scale-90 text-purple-700 hover:border-purple-300"'} class="w-7 h-7 rounded-lg border border-purple-200 bg-white flex items-center justify-center font-bold text-xs transition shadow-2xs" title="เลื่อนไปทางขวา (ถัดไป)">
            ▶
          </button>
          <button type="button" onclick="deleteCategory('${escapeHtml(cat)}')" class="w-7 h-7 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 active:scale-90 flex items-center justify-center font-bold text-xs ml-1 transition shadow-2xs" title="ลบหมวดนี้">
            ✕
          </button>
        </div>
      `;
      existingList.appendChild(row);
    }
  });

  // Always keep 'สกินสำเร็จ' available in modal select dropdown for adding premade skins
  const premadeOpt = document.createElement('option');
  premadeOpt.value = 'สกินสำเร็จ';
  premadeOpt.textContent = 'สกินสำเร็จ (หน้าร้านสกินสำเร็จรูป)';
  modalSelect.appendChild(premadeOpt);

  setupCategoryChipsScroll();
}

async function reorderCategoryDirect(sourceCat, targetCat) {
  const fromIdx = appData.categories.indexOf(sourceCat);
  const toIdx = appData.categories.indexOf(targetCat);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

  const item = appData.categories.splice(fromIdx, 1)[0];
  appData.categories.splice(toIdx, 0, item);

  renderCategoryPills();
  try {
    await fetch('/api/categories/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: appData.categories })
    });
  } catch (err) {
    console.warn('API error reordering categories:', err);
  }
  persistLocal();
}

async function moveCategoryOrder(catName, direction) {
  const idx = appData.categories.indexOf(catName);
  if (idx === -1) return;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= appData.categories.length) return;

  const temp = appData.categories[idx];
  appData.categories[idx] = appData.categories[targetIdx];
  appData.categories[targetIdx] = temp;

  renderCategoryPills();

  try {
    await fetch('/api/categories/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: appData.categories })
    });
  } catch (err) {
    console.warn('API error moving category order:', err);
  }
  persistLocal();
}

async function deleteCategory(catName) {
  const count = (appData.items || []).filter(i => i.category === catName).length;
  let confirmMsg = `ต้องการลบหมวดหมู่ "${catName}" หรือไม่?`;
  if (count > 0) {
    confirmMsg = `หมวดหมู่ "${catName}" มีผลงานอยู่ ${count} ชิ้น\nต้องการลบหมวดหมู่นี้หรือไม่? (ผลงานเดิมยังคงอยู่)`;
  }
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/categories/${encodeURIComponent(catName)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.categories) {
        appData.categories = data.categories;
      } else {
        appData.categories = appData.categories.filter(c => c !== catName);
      }
    } else {
      appData.categories = appData.categories.filter(c => c !== catName);
    }
  } catch (err) {
    console.warn('API error deleting category:', err);
    appData.categories = appData.categories.filter(c => c !== catName);
  }

  if (currentCategory === catName) {
    currentCategory = 'ALL';
  }
  persistLocal();
  renderCategoryPills();
  renderAll();
  showToastNotice(`ลบหมวด "${catName}" เรียบร้อยแล้ว`);
}

function setupCategoryChipsScroll() {
  const container = document.getElementById('categoryChipsContainer');
  if (!container || container._hasScrollInit) return;
  container._hasScrollInit = true;

  let isDown = false;
  let startX;
  let scrollLeft;

  container.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    isDown = true;
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
  });

  window.addEventListener('mouseup', () => {
    isDown = false;
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;
    container.scrollLeft = scrollLeft - walk;
  });
}

function selectCategory(cat) {
  currentCategory = cat;
  const filtered = getFilteredItems();
  if (filtered.length > 0 && !filtered.some(i => i.id === activeItemId)) {
    activeItemId = filtered[0].id;
  }
  renderAll();
}

function getFilteredItems() {
  return (appData.items || []).filter(item => {
    // Strictly exclude premade skins from commission gallery!
    if (item.isPremade || item.category === 'สกินสำเร็จ') return false;
    return currentCategory === 'ALL' || item.category === currentCategory;
  });
}

function getActiveItem() {
  const galleryItems = (appData.items || []).filter(i => !i.isPremade && i.category !== 'สกินสำเร็จ');
  if (galleryItems.length === 0) return null;
  if (!activeItemId || !galleryItems.some(i => i.id === activeItemId)) {
    activeItemId = galleryItems[0].id;
  }
  return galleryItems.find(i => i.id === activeItemId) || galleryItems[0] || null;
}

// Drag and drop & reordering state
let draggedLeftItemId = null;

function handleItemDragStart(e, itemId) {
  draggedLeftItemId = itemId;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', itemId);
  setTimeout(() => {
    e.target.classList.add('opacity-40', 'scale-[0.98]', 'border-purple-400');
  }, 0);
}

function handleItemDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.currentTarget;
  card.classList.add('ring-2', 'ring-purple-400', 'bg-purple-50/90');
}

function handleItemDragLeave(e) {
  e.currentTarget.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-50/90');
}

async function handleItemDrop(e, targetItemId) {
  e.preventDefault();
  e.currentTarget.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-50/90');
  if (!draggedLeftItemId || draggedLeftItemId === targetItemId) return;

  const fromIdx = appData.items.findIndex(i => i.id === draggedLeftItemId);
  const toIdx = appData.items.findIndex(i => i.id === targetItemId);
  if (fromIdx === -1 || toIdx === -1) return;

  const [movedItem] = appData.items.splice(fromIdx, 1);
  appData.items.splice(toIdx, 0, movedItem);

  draggedLeftItemId = null;
  renderLeftThumbnails();

  try {
    const itemIds = appData.items.map(i => i.id);
    await fetch('/api/items/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds })
    });
    showToastNotice('จัดลำดับผลงานเรียบร้อย ✨');
  } catch(e) {
    console.warn('Reorder save error:', e);
  }
  persistLocal();
}

function handleItemDragEnd(e) {
  e.currentTarget.classList.remove('opacity-40', 'scale-[0.98]', 'border-purple-400', 'ring-2', 'ring-purple-400', 'bg-purple-50/90');
  draggedLeftItemId = null;
}

async function moveItemOrder(itemId, direction, event) {
  if (event) {
    event.stopPropagation();
  }

  const filtered = getFilteredItems();
  const idxInFiltered = filtered.findIndex(i => i.id === itemId);
  if (idxInFiltered === -1) return;

  const targetIdxInFiltered = idxInFiltered + direction;
  if (targetIdxInFiltered < 0 || targetIdxInFiltered >= filtered.length) return;

  const targetItem = filtered[targetIdxInFiltered];

  // Swap in appData.items
  const idxA = appData.items.findIndex(i => i.id === itemId);
  const idxB = appData.items.findIndex(i => i.id === targetItem.id);
  if (idxA === -1 || idxB === -1) return;

  const temp = appData.items[idxA];
  appData.items[idxA] = appData.items[idxB];
  appData.items[idxB] = temp;

  renderLeftThumbnails();

  try {
    const itemIds = appData.items.map(i => i.id);
    await fetch('/api/items/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds })
    });
    showToastNotice('ย้ายตำแหน่งผลงานเรียบร้อย ✨');
  } catch(e) {
    console.warn('Reorder save error:', e);
  }
  persistLocal();
}

// Render Left Panel: Thumbnails List
function renderLeftThumbnails() {
  const container = document.getElementById('leftThumbnailsList');
  const countEl = document.getElementById('leftItemsCount');
  const filtered = getFilteredItems();

  countEl.textContent = `ทั้งหมด ${filtered.length} ชิ้น`;
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-xs text-purple-600">
        <div class="text-2xl mb-1">📦</div>
        ยังไม่มีผลงานในหมวดนี้<br>
        <button onclick="openAddModal()" class="mt-2 text-purple-800 font-bold underline">+ เพิ่มผลงาน</button>
      </div>
    `;
    return;
  }

  filtered.forEach((item, index) => {
    const isActive = item.id === activeItemId;
    const isFirst = index === 0;
    const isLast = index === filtered.length - 1;

    const card = document.createElement('div');
    card.className = `thumb-card p-2 flex items-center gap-2.5 transition-all duration-150 ${isActive ? 'active' : ''}`;
    card.draggable = true;
    card.dataset.itemId = item.id;

    card.ondragstart = (e) => handleItemDragStart(e, item.id);
    card.ondragover = (e) => handleItemDragOver(e);
    card.ondragleave = (e) => handleItemDragLeave(e);
    card.ondrop = (e) => handleItemDrop(e, item.id);
    card.ondragend = (e) => handleItemDragEnd(e);

    card.onclick = () => {
      if (isVideoMode) {
        toggleVideoShowcase(false);
      }
      activeItemId = item.id;
      loadSkinForActiveItem();
      zoomToModelPart('full');
      startInitialPoseSequence();
      renderAll();
    };

    const displayThumb = item.headerImage || item.skinTexture || item.image || '/uploads/custom-yuki-skin.png';
    const isArtThumb = Boolean(item.headerImage);

    card.innerHTML = `
      <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden ${isArtThumb ? 'bg-purple-900/10' : 'skin-checker-lavender'} border border-purple-200/80 shrink-0 flex items-center justify-center ${isArtThumb ? 'p-0' : 'p-1'} pointer-events-none">
        <img 
          id="thumbImg_${item.id}"
          src="${escapeHtml(displayThumb)}" 
          alt="${escapeHtml(item.title)}" 
          class="w-full h-full ${isArtThumb ? 'object-cover' : 'object-contain'}"
          ${isArtThumb ? '' : 'style="image-rendering: pixelated;"'}
        />
      </div>

      <div class="flex-1 min-w-0 pr-1 pointer-events-none">
        <h4 class="text-xs sm:text-sm font-bold text-purple-950 truncate">${escapeHtml(item.title)}</h4>
        <div class="flex items-center justify-between gap-1.5 mt-1">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-[10px] text-purple-600 truncate">${escapeHtml(item.category)}</span>
            ${(item.category === 'สกินสำเร็จ' || item.isPremade) ? '<span class="text-[9px] font-bold bg-rose-500 text-white px-1.5 py-0.2 rounded-full">พร้อมส่ง</span>' : ''}
            ${item.videoUrl ? '<span class="text-[9px] font-bold bg-indigo-500 text-white px-1 py-0.2 rounded-full" title="มีวิดีโอตัวอย่าง">🎬</span>' : ''}
          </div>
          ${isActive ? '<span class="text-[10px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.2 rounded-md shrink-0">เลือกอยู่</span>' : ''}
        </div>
      </div>

      <!-- Quick Move Up / Down Buttons & Drag Handle -->
      <div class="flex flex-col items-center justify-center gap-0.5 shrink-0 pl-1 border-l border-purple-200/50" onclick="event.stopPropagation()">
        <button 
          type="button" 
          onclick="moveItemOrder('${item.id}', -1, event)" 
          ${isFirst ? 'disabled class="opacity-20 cursor-not-allowed text-purple-300"' : 'class="hover:bg-purple-200/70 active:scale-90 text-purple-700"'} 
          class="w-5 h-4 rounded flex items-center justify-center text-[10px] font-bold transition leading-none" 
          title="ย้ายขึ้นด้านบน"
        >
          ▲
        </button>
        <span class="text-[9px] text-purple-300/80 cursor-grab active:cursor-grabbing select-none leading-none px-0.5" title="คลิกลากเพื่อย้ายขึ้น-ลง">
          ⋮⋮
        </span>
        <button 
          type="button" 
          onclick="moveItemOrder('${item.id}', 1, event)" 
          ${isLast ? 'disabled class="opacity-20 cursor-not-allowed text-purple-300"' : 'class="hover:bg-purple-200/70 active:scale-90 text-purple-700"'} 
          class="w-5 h-4 rounded flex items-center justify-center text-[10px] font-bold transition leading-none" 
          title="ย้ายลงด้านล่าง"
        >
          ▼
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

// Render Center Showcase: Big Title, 3D Canvas, Video, Model Details
function renderCenterShowcase() {
  const item = getActiveItem();
  const titleEl = document.getElementById('centerWorkTitle');
  const descEl = document.getElementById('centerWorkDesc') || document.getElementById('centerDescription');

  if (!item) {
    if (titleEl) titleEl.textContent = 'ยังไม่มีผลงาน';
    if (descEl) descEl.textContent = 'กรุณาเพิ่มตัวอย่างผลงานใหม่';
    return;
  }

  if (titleEl) titleEl.textContent = item.category || item.title;

  // Immediately update the 3 right thumbnails from the active skin (with mannequin base for outfit-only skins)
  prepareSkinTexture(item.skinTexture || item.image || '/uploads/custom-yuki-skin.png', item).then(finalSkinUrl => {
    updatePartThumbnailsFromSkin(finalSkinUrl);
  });

  if (descEl) descEl.textContent = item.description || item.title;

  // 3D Model Badge & Download Link
  const modelBadge = document.getElementById('modelBadgeWrapper');
  const modelLink = document.getElementById('modelDownloadLink');
  const modelText = document.getElementById('modelBadgeText');
  if (item.modelUrl) {
    if (modelBadge) modelBadge.classList.remove('hidden');
    if (modelLink) modelLink.href = item.modelUrl;
    if (modelText) {
      modelText.textContent = item.modelUrl.endsWith('.bbmodel') 
        ? 'โมเดล Figura (.bbmodel)' 
        : 'ไฟล์ 3D Model';
    }
  } else if (modelBadge) {
    modelBadge.classList.add('hidden');
  }

  // Video Preview button & player
  const btnVideo = document.getElementById('btnModeVideo');
  const videoBadge = document.getElementById('videoAvailableBadge');
  const videoPlayer = document.getElementById('itemVideoPlayer');
  const videoTitle = document.getElementById('videoHeaderTitle');
  const hasVideo = Boolean(item && item.videoUrl);

  if (btnVideo) {
    if (hasVideo) {
      btnVideo.classList.remove('hidden');
      btnVideo.classList.add('flex');
      btnVideo.classList.remove('opacity-50');
      btnVideo.title = 'คลิกเพื่อดูวิดีโอตัวอย่างผลงาน 🎬';
    } else {
      btnVideo.classList.add('hidden');
      btnVideo.classList.remove('flex');
    }
  }

  if (videoBadge) {
    if (hasVideo) videoBadge.classList.remove('hidden');
    else videoBadge.classList.add('hidden');
  }

  if (hasVideo) {
    if (videoPlayer) {
      const srcUrl = item.videoUrl.startsWith('http') || item.videoUrl.startsWith('/') ? item.videoUrl : '/' + item.videoUrl;
      if (videoPlayer.getAttribute('src') !== srcUrl) {
        videoPlayer.src = srcUrl;
        videoPlayer.load();
      }
    }
    if (videoTitle) videoTitle.textContent = 'วิดีโอตัวอย่าง: ' + (item.title || item.category);
  } else {
    if (isVideoMode) {
      toggleVideoShowcase(false);
    }
    if (videoPlayer) {
      videoPlayer.pause();
      videoPlayer.removeAttribute('src');
      videoPlayer.load();
    }
  }

  loadSkinForActiveItem();
}

function showToastNotice(msg) {
  let toast = document.getElementById('globalNoticeToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalNoticeToast';
    toast.className = 'fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-purple-950/90 text-white text-xs font-semibold shadow-xl border border-purple-400/40 backdrop-blur-md transition-all duration-300 transform translate-y-4 opacity-0 pointer-events-none flex items-center gap-2';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>✨</span><span>${escapeHtml(msg)}</span>`;
  toast.classList.remove('translate-y-4', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100');
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-4', 'opacity-0', 'pointer-events-none');
  }, 2800);
}

function requestVideoFullscreen() {
  const video = document.getElementById('itemVideoPlayer');
  if (!video) return;
  if (video.requestFullscreen) {
    video.requestFullscreen();
  } else if (video.webkitRequestFullscreen) {
    video.webkitRequestFullscreen();
  } else if (video.mozRequestFullScreen) {
    video.mozRequestFullScreen();
  } else if (video.msRequestFullscreen) {
    video.msRequestFullscreen();
  }
}

function handleVideoPlayOverlayClick() {
  const video = document.getElementById('itemVideoPlayer');
  const overlay = document.getElementById('videoPlayOverlay');
  if (!video) return;

  video.play().then(() => {
    if (overlay) overlay.classList.add('hidden');
  }).catch(err => {
    console.warn('Playback with audio blocked, trying muted play:', err);
    video.muted = true;
    video.play().then(() => {
      if (overlay) overlay.classList.add('hidden');
    }).catch(e => {
      console.warn('Video playback failed:', e);
    });
  });
}

function togglePlayPauseVideo() {
  handleVideoPlayOverlayClick();
}

function toggleVideoShowcase(forceState) {
  const item = getActiveItem();
  const hasVideo = Boolean(item && item.videoUrl);

  if (!hasVideo) {
    if (forceState === undefined) {
      showToastNotice('ผลงานชิ้นนี้ยังไม่มีคลิปวิดีโอตัวอย่าง 🎬');
    }
    isVideoMode = false;
    updateVideoModeUI(false, false);
    return;
  }

  if (forceState !== undefined) {
    isVideoMode = forceState;
  } else {
    isVideoMode = !isVideoMode;
  }

  const skinviewWrapper = document.getElementById('skinviewWrapper');
  const videoWrapper = document.getElementById('videoPreviewWrapper');
  const rotatorPedestal = document.getElementById('rotatorPedestal');
  const videoPlayer = document.getElementById('itemVideoPlayer');
  const playOverlay = document.getElementById('videoPlayOverlay');

  if (isVideoMode) {
    // Crucial: Stop background pose timers and sequence so they cannot interrupt video!
    isAutoPoseSequence = false;
    if (poseTimer) {
      clearTimeout(poseTimer);
      poseTimer = null;
    }

    if (skinviewWrapper) skinviewWrapper.classList.add('hidden');
    if (rotatorPedestal) rotatorPedestal.classList.add('hidden');
    if (videoWrapper) videoWrapper.classList.remove('hidden');

    if (videoPlayer) {
      const srcUrl = item.videoUrl.startsWith('http') || item.videoUrl.startsWith('/') ? item.videoUrl : '/' + item.videoUrl;
      if (videoPlayer.getAttribute('src') !== srcUrl) {
        videoPlayer.src = srcUrl;
        videoPlayer.load();
      }

      try {
        if (videoPlayer.readyState > 0) {
          videoPlayer.currentTime = 0;
        }
      } catch (e) {}

      const playPromise = videoPlayer.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          if (playOverlay) playOverlay.classList.add('hidden');
        }).catch(err => {
          console.warn('Autoplay with sound prevented, attempting muted:', err);
          videoPlayer.muted = true;
          videoPlayer.play().then(() => {
            if (playOverlay) playOverlay.classList.add('hidden');
          }).catch(err2 => {
            console.warn('Playback requires manual user click:', err2);
            if (playOverlay) playOverlay.classList.remove('hidden');
          });
        });
      }
    }
    updateVideoModeUI(true, true);
  } else {
    if (videoPlayer) {
      videoPlayer.pause();
    }
    if (playOverlay) playOverlay.classList.remove('hidden');
    if (videoWrapper) videoWrapper.classList.add('hidden');
    if (skinviewWrapper) skinviewWrapper.classList.remove('hidden');
    if (rotatorPedestal) rotatorPedestal.classList.remove('hidden');
    updateVideoModeUI(false, hasVideo);
  }
  lucide.createIcons();
}

function updateVideoModeUI(isVideoActive, hasVideo) {
  const btnVideo = document.getElementById('btnModeVideo');
  const btnAnim = document.getElementById('btnModeAnimated');
  const btnStill = document.getElementById('btnModeStill');

  if (btnVideo) {
    if (!hasVideo) {
      btnVideo.classList.add('hidden');
      btnVideo.classList.remove('flex');
    } else {
      btnVideo.classList.remove('hidden');
      btnVideo.classList.add('flex');
      if (isVideoActive) {
        btnVideo.className = 'px-3 py-1.5 rounded-xl font-bold transition text-[11px] bg-purple-600 text-white shadow-sm border border-purple-500 flex items-center gap-1.5';
      } else {
        btnVideo.className = 'px-3 py-1.5 rounded-xl font-medium transition text-[11px] text-purple-800 hover:bg-white/80 flex items-center gap-1.5 border border-purple-300 bg-purple-50/70 shadow-xs';
      }
    }
  }

  if (btnAnim && btnStill) {
    if (isVideoActive) {
      btnAnim.className = 'px-3 py-1.5 rounded-xl font-medium transition text-[11px] text-purple-700 hover:bg-white/70 flex items-center gap-1.5';
      btnStill.className = 'px-3 py-1.5 rounded-xl font-medium transition text-[11px] text-purple-700 hover:bg-white/70 flex items-center gap-1.5';
    } else {
      if (viewerMode === 'animated') {
        btnAnim.className = 'px-3 py-1.5 rounded-xl font-bold transition text-[11px] bg-white text-purple-900 shadow-sm border border-purple-200 flex items-center gap-1.5';
        btnStill.className = 'px-3 py-1.5 rounded-xl font-medium transition text-[11px] text-purple-700 hover:bg-white/70 flex items-center gap-1.5';
      } else {
        btnStill.className = 'px-3 py-1.5 rounded-xl font-bold transition text-[11px] bg-white text-purple-900 shadow-sm border border-purple-200 flex items-center gap-1.5';
        btnAnim.className = 'px-3 py-1.5 rounded-xl font-medium transition text-[11px] text-purple-700 hover:bg-white/70 flex items-center gap-1.5';
      }
    }
  }
}

function openCinemaVideoModal(videoUrl, title) {
  const item = getActiveItem();
  const src = videoUrl || (item && item.videoUrl);
  if (!src) {
    showToastNotice('ผลงานนี้ไม่มีวิดีโอตัวอย่าง');
    return;
  }
  const modal = document.getElementById('videoModal');
  const videoPlayer = document.getElementById('cinemaVideoPlayer');
  const titleEl = document.getElementById('videoModalTitle');

  if (titleEl) {
    titleEl.textContent = title || (item && item.title ? `วิดีโอตัวอย่าง: ${item.title}` : 'วิดีโอตัวอย่างผลงาน');
  }

  if (videoPlayer) {
    videoPlayer.setAttribute('controlsList', 'nodownload');
    videoPlayer.setAttribute('disablePictureInPicture', 'true');
    videoPlayer.oncontextmenu = (e) => e.preventDefault();
    const formattedUrl = src.startsWith('http') || src.startsWith('/') ? src : '/' + src;
    videoPlayer.src = formattedUrl;
    videoPlayer.load();
    const playPromise = videoPlayer.play();
    if (playPromise) {
      playPromise.catch(err => {
        console.warn('Cinema autoplay caught:', err);
      });
    }
  }

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeCinemaVideoModal() {
  const modal = document.getElementById('videoModal');
  const videoPlayer = document.getElementById('cinemaVideoPlayer');
  if (videoPlayer) {
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();
  }
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function selectRatePricePart(part) {
  currentRatePricePart = part;
  if (currentTab !== 'gallery') {
    switchPageTab('gallery');
  }

  // Live update right pricing card
  renderRightPricing();

  // Zoom 3D camera to part
  zoomToModelPart(part);
}

// Render Right Panel: Pricing
function renderRightPricing() {
  const item = getActiveItem();
  const rateHead = document.getElementById('ratePriceHead');
  const rateBody = document.getElementById('ratePriceBody');
  const rateFull = document.getElementById('ratePriceFull');
  const activeWorkPrice = document.getElementById('activeWorkPrice');

  if (!item) {
    if (activeWorkPrice) activeWorkPrice.textContent = '-';
    if (rateHead) rateHead.textContent = '-';
    if (rateBody) rateBody.textContent = '-';
    if (rateFull) rateFull.textContent = '-';
    return;
  }

  function formatPriceStr(val, fallback) {
    if (val === undefined || val === null || String(val).trim() === '') return fallback;
    const s = String(val).trim();
    return s.endsWith('฿') ? s : s + '฿';
  }

  const catDefault = (typeof getPricesForCategory === 'function') ? getPricesForCategory(item.category) : {};
  const headPrice = formatPriceStr(item.priceHead, catDefault.priceHead || '70฿');
  const bodyPrice = formatPriceStr(item.priceBody, catDefault.priceBody || '150–250฿');
  const fullPrice = formatPriceStr(item.priceFull || item.price, catDefault.priceFull || '195–240฿');

  if (rateHead) rateHead.textContent = headPrice;
  if (rateBody) rateBody.textContent = bodyPrice;
  if (rateFull) rateFull.textContent = fullPrice;
  
  if (activeWorkPrice) {
    let displayPrice = fullPrice;
    if (currentRatePricePart === 'head') displayPrice = headPrice;
    else if (currentRatePricePart === 'body') displayPrice = bodyPrice;
    activeWorkPrice.textContent = displayPrice;
  }

  // Highlight corresponding row
  const rowHead = document.getElementById('rateRowHead');
  const rowBody = document.getElementById('rateRowBody');
  const rowFull = document.getElementById('rateRowFull');
  const activePillClass = 'price-row-pill p-2.5 flex items-center justify-between cursor-pointer transition group border-purple-500 bg-purple-100/90 shadow-xs ring-2 ring-purple-300';
  const inactivePillClass = 'price-row-pill p-2.5 flex items-center justify-between cursor-pointer hover:bg-purple-100/60 transition group';

  if (rowHead) rowHead.className = currentRatePricePart === 'head' ? activePillClass : inactivePillClass;
  if (rowBody) rowBody.className = currentRatePricePart === 'body' ? activePillClass : inactivePillClass;
  if (rowFull) rowFull.className = currentRatePricePart === 'full' ? activePillClass : inactivePillClass;

  // Update order button text for premade items
  const btnOrderIcon = document.getElementById('btnOrderIcon');
  const btnOrderText = document.getElementById('btnOrderText');
  const isPremade = (item.category === 'สกินสำเร็จ' || item.isPremade || item.itemType === 'premade');
  
  if (btnOrderText && btnOrderIcon) {
    if (isPremade) {
      btnOrderIcon.textContent = '🛍️';
      btnOrderText.textContent = 'สั่งซื้อสกินสำเร็จ (รับไฟล์ทันที)';
    } else {
      btnOrderIcon.textContent = '❄️';
      btnOrderText.textContent = 'สั่งคอมมิชชั่น';
    }
  }
}

function selectItem(id) {
  if (!id) return;
  activeItemId = id;
  if (isVideoMode) {
    toggleVideoShowcase(false);
  }
  loadSkinForActiveItem();
  zoomToModelPart('full');
  renderAll();
}

function toggleEditMode() {
  if (isEditMode) {
    // ผู้ดูแลระบบต้องการออกจากโหมดจัดการ -> สลับเป็นมุมมองลูกค้า
    isEditMode = false;
    try { sessionStorage.removeItem('yuki_admin_auth'); } catch (e) {}
    updateModeUI();
    showToast('ออกจากโหมดจัดการร้าน สลับสู่มุมมองลูกค้าแล้ว ✨');
  } else {
    // ผู้เข้าชมต้องการเข้าสู่โหมดจัดการ -> เปิดหน้าต่างกรอกรหัสผ่านแอดมิน
    openAdminLoginModal();
  }
}

function openAdminLoginModal() {
  const modal = document.getElementById('adminLoginModal');
  const input = document.getElementById('adminLoginPasswordInput');
  const err = document.getElementById('adminLoginError');
  if (err) {
    err.textContent = '';
    err.classList.add('hidden');
  }
  if (input) {
    input.value = '';
    input.type = 'password';
  }
  if (modal) {
    modal.classList.remove('hidden');
    setTimeout(() => input?.focus(), 120);
  }
}

function closeAdminLoginModal() {
  const modal = document.getElementById('adminLoginModal');
  if (modal) modal.classList.add('hidden');
}

function toggleAdminPasswordPeek() {
  const input = document.getElementById('adminLoginPasswordInput');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

function handleAdminLoginSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('adminLoginPasswordInput');
  const err = document.getElementById('adminLoginError');
  const val = (input?.value || '').trim();
  const correctPassword = (appData.siteConfig && appData.siteConfig.adminPassword) ? appData.siteConfig.adminPassword : 'yuki2204';

  if (!val) {
    if (err) {
      err.textContent = 'กรุณากรอกรหัสผ่านค่ะ';
      err.classList.remove('hidden');
    }
    return;
  }

  if (val === correctPassword || val === 'yuki2204') {
    isEditMode = true;
    try { sessionStorage.setItem('yuki_admin_auth', 'true'); } catch (e) {}
    closeAdminLoginModal();
    updateModeUI();
    showToast('เข้าสู่ระบบจัดการร้าน (Admin) สำเร็จแล้วค่ะ! 👑✨');
  } else {
    if (err) {
      err.textContent = '❌ รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้งค่ะ';
      err.classList.remove('hidden');
    }
    input?.select();
  }
}

function updateModeUI() {
  const btn = document.getElementById('modeToggleBtn');
  const text = document.getElementById('modeText');
  const icon = document.getElementById('modeToggleIcon');
  const adminElements = document.querySelectorAll('.admin-only');
  const addHeaderBtn = document.getElementById('addWorkHeaderBtn');
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const settingsBtn = document.getElementById('settingsBtn');

  if (isEditMode) {
    document.body.classList.add('is-admin-mode');
    if (btn) {
      btn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition border border-purple-400 bg-purple-100 text-purple-900 shadow-sm cursor-pointer hover:bg-purple-200';
      btn.title = 'คลิกเพื่อออกจากโหมดจัดการ (กลับสู่มุมมองลูกค้า)';
    }
    if (text) text.textContent = 'โหมดจัดการ (เปิดอยู่)';
    if (icon) {
      icon.setAttribute('data-lucide', 'unlock');
      icon.className = 'w-3.5 h-3.5 text-purple-600';
    }
    if (addHeaderBtn) addHeaderBtn.classList.remove('hidden');
    if (addCategoryBtn) addCategoryBtn.classList.remove('hidden');
    if (settingsBtn) settingsBtn.classList.remove('hidden');
    adminElements.forEach(el => el.classList.remove('hidden'));
  } else {
    document.body.classList.remove('is-admin-mode');
    if (btn) {
      btn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition border border-purple-300/70 bg-white/70 text-purple-800 hover:bg-white shadow-sm cursor-pointer';
      btn.title = 'คลิกเพื่อเข้าสู่ระบบจัดการร้าน (เฉพาะเจ้าของร้าน)';
    }
    if (text) text.textContent = 'เข้าสู่ระบบแอดมิน';
    if (icon) {
      icon.setAttribute('data-lucide', 'lock');
      icon.className = 'w-3.5 h-3.5 text-purple-600';
    }
    if (addHeaderBtn) addHeaderBtn.classList.add('hidden');
    if (addCategoryBtn) addCategoryBtn.classList.add('hidden');
    if (settingsBtn) settingsBtn.classList.add('hidden');
    adminElements.forEach(el => el.classList.add('hidden'));
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

// ==================== PRICING RATE CARD SYSTEM ====================
let pricingTableViewMode = 'bySize'; // 'bySize' | 'byType'

function setPricingViewMode(mode) {
  pricingTableViewMode = mode;
  const btnSize = document.getElementById('priceViewModeSizeBtn');
  const btnType = document.getElementById('priceViewModeTypeBtn');
  const activeClass = 'px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white cursor-pointer';
  const inactiveClass = 'px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 bg-white/80 hover:bg-white text-purple-800 border border-purple-200 cursor-pointer';
  if (btnSize) btnSize.className = mode === 'bySize' ? activeClass : inactiveClass;
  if (btnType) btnType.className = mode === 'byType' ? activeClass : inactiveClass;
  renderPricingTable();
}

function renderPricingTable() {
  const table = document.getElementById('pricingMainTable');
  if (!table) return;

  const pt = appData.pricingTable || {
    title: 'ราคาทุกขนาดอยู่ตรงนี้ เลือกได้เลย ✦',
    subtitle: 'Yuki Haru • Snow Butterfly',
    note: 'อยากได้แค่ Figura หรือโมเดล 3D? ทักมาสอบถามเพิ่มเติมได้เลย ✦',
    columns: ['64 Pixel', '128 Pixel', '512 Pixel', '1024 Pixel'],
    rows: [
      {
        type: 'ส่วนหัว',
        icon: '👤',
        prices: { '64 Pixel': '35 บาท', '128 Pixel': '50 บาท', '512 Pixel': '100 บาท', '1024 Pixel': '150 บาท' }
      },
      {
        type: 'ส่วนตัว',
        icon: '👗',
        prices: { '64 Pixel': '50 บาท', '128 Pixel': '75 บาท', '512 Pixel': '180 บาทขึ้นไป', '1024 Pixel': '250 บาทขึ้นไป' }
      },
      {
        type: 'ทั้งตัว',
        icon: '✨',
        prices: { '64 Pixel': '75 บาท', '128 Pixel': '110 บาท', '512 Pixel': '260 บาทขึ้นไป', '1024 Pixel': '350 บาทขึ้นไป' }
      }
    ]
  };

  const titleEl = document.getElementById('pricingCardTitle');
  if (titleEl) {
    titleEl.innerHTML = `<span>${escapeHtml(pt.title || 'ราคาทุกขนาดอยู่ตรงนี้ เลือกได้เลย')}</span> <span class="text-purple-400 font-light text-xl">✦</span>`;
  }
  const noteEl = document.getElementById('pricingCardNote');
  if (noteEl) noteEl.textContent = pt.note || 'อยากได้แค่ Figura หรือโมเดล 3D? ทักมาสอบถามเพิ่มเติมได้เลย';
  const subtitleEl = document.getElementById('pricingCardSubtitle');
  if (subtitleEl) subtitleEl.textContent = pt.subtitle || 'Yuki Haru • Snow Butterfly';

  // Apply background dynamically to pricing cards
  const bgImg = (pt && pt.bgImage !== undefined) ? pt.bgImage : '/uploads/pricing-clean-bg.png';
  document.querySelectorAll('.pricing-card-bg').forEach(el => {
    if (bgImg === 'none' || !bgImg) {
      el.style.backgroundImage = 'none';
      el.style.opacity = '0';
    } else {
      el.style.backgroundImage = `url('${bgImg}')`;
      el.style.opacity = '0.45';
    }
  });

  const cols = pt.columns || ['64 Pixel', '128 Pixel', '512 Pixel', '1024 Pixel'];
  const rows = pt.rows || [];

  if (pricingTableViewMode === 'bySize') {
    // Mode 1: ขนาดสกินเป็นแถว (ตามที่ผู้ใช้เขียนมาเป๊ะๆ)
    // หัวตาราง: ขนาดสกิน | ส่วนหัว | ส่วนตัว | ทั้งตัว
    let theadHtml = `
      <thead>
        <tr class="border-b border-purple-200/80 text-[#544f80] text-xs sm:text-sm font-bold select-none bg-purple-50/50">
          <th class="py-4 px-4 text-left font-bold text-[#443f70] w-48">
            <div class="flex items-center gap-2">
              <span class="text-base text-purple-400">❄️</span>
              <span>ขนาดสกิน</span>
            </div>
          </th>
    `;

    rows.forEach((row, idx) => {
      const isLast = idx === rows.length - 1;
      theadHtml += `
        <th class="py-4 px-3 border-l border-purple-200/60 font-bold tracking-wider">
          <span class="mr-1">${escapeHtml(row.icon || '🦋')}</span>
          <span>${escapeHtml(row.type)}</span>
          ${!isLast ? '<span class="text-purple-300 font-light ml-1">✦</span>' : ''}
        </th>
      `;
    });
    theadHtml += `</tr></thead>`;

    let tbodyHtml = `<tbody class="divide-y divide-purple-100 text-xs sm:text-sm text-[#443f70] font-medium">`;

    cols.forEach((col) => {
      tbodyHtml += `
        <tr class="hover:bg-purple-50/60 transition-colors duration-150">
          <td class="py-4 px-4 text-left font-bold text-[#3c3768]">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-xs font-black text-purple-700">📦</span>
              <span class="font-bold">${escapeHtml(col)}</span>
            </div>
          </td>
      `;

      rows.forEach(row => {
        const priceVal = (row.prices && row.prices[col]) ? row.prices[col] : '-';
        tbodyHtml += `
          <td class="py-4 px-3 border-l border-purple-100/80">
            <button 
              type="button" 
              onclick="orderSkinFromTable('${escapeHtml(row.type)}', '${escapeHtml(col)}', '${escapeHtml(priceVal)}')"
              class="w-full py-2 px-2.5 rounded-xl text-center font-bold text-[#494475] hover:bg-purple-200/70 hover:text-purple-950 hover:shadow-xs active:scale-95 transition-all cursor-pointer group"
              title="คลิกเพื่อสั่งคอมมิชชั่น ${escapeHtml(row.type)} ขนาด ${escapeHtml(col)} ราคา ${escapeHtml(priceVal)}"
            >
              <span class="tracking-wide text-xs sm:text-sm">${escapeHtml(priceVal)}</span>
              <span class="hidden group-hover:inline-block text-[10px] text-purple-600 ml-1">💬</span>
            </button>
          </td>
        `;
      });

      tbodyHtml += `</tr>`;
    });

    tbodyHtml += `</tbody>`;
    table.innerHTML = theadHtml + tbodyHtml;
    return;
  }

  // Mode 2: ประเภทเป็นแถว (ตามรูปการ์ดอ้างอิง)
  // หัวตาราง: ประเภท | 64 Pixel ✦ 128 Pixel ✦ 512 Pixel ✦ 1024 Pixel
  let theadHtml = `
    <thead>
      <tr class="border-b border-purple-200/80 text-[#544f80] text-xs sm:text-sm font-bold select-none bg-purple-50/50">
        <th class="py-4 px-4 text-left font-bold text-[#443f70] w-48">
          <div class="flex items-center gap-2">
            <span class="text-base text-purple-400">❄️</span>
            <span>ประเภท</span>
          </div>
        </th>
  `;

  cols.forEach((col, idx) => {
    const isLast = idx === cols.length - 1;
    theadHtml += `
      <th class="py-4 px-3 border-l border-purple-200/60 font-bold tracking-wider">
        <span>${escapeHtml(col)}</span>
        ${!isLast ? '<span class="text-purple-300 font-light ml-1">✦</span>' : ''}
      </th>
    `;
  });
  theadHtml += `</tr></thead>`;

  let tbodyHtml = `<tbody class="divide-y divide-purple-100 text-xs sm:text-sm text-[#443f70] font-medium">`;

  rows.forEach((row) => {
    tbodyHtml += `
      <tr class="hover:bg-purple-50/60 transition-colors duration-150">
        <td class="py-4 px-4 text-left font-bold text-[#3c3768]">
          <div class="flex items-center gap-2">
            <span class="text-sm text-purple-500">${escapeHtml(row.icon || '🦋')}</span>
            <span>${escapeHtml(row.type)}</span>
          </div>
        </td>
    `;

    cols.forEach(col => {
      const priceVal = (row.prices && row.prices[col]) ? row.prices[col] : '-';
      tbodyHtml += `
        <td class="py-4 px-3 border-l border-purple-100/80">
          <button 
            type="button" 
            onclick="orderSkinFromTable('${escapeHtml(row.type)}', '${escapeHtml(col)}', '${escapeHtml(priceVal)}')"
            class="w-full py-2 px-2.5 rounded-xl text-center font-bold text-[#494475] hover:bg-purple-200/70 hover:text-purple-950 hover:shadow-xs active:scale-95 transition-all cursor-pointer group"
            title="คลิกเพื่อสั่งคอมมิชชั่น ${escapeHtml(row.type)} ขนาด ${escapeHtml(col)} ราคา ${escapeHtml(priceVal)}"
          >
            <span class="tracking-wide text-xs sm:text-sm">${escapeHtml(priceVal)}</span>
            <span class="hidden group-hover:inline-block text-[10px] text-purple-600 ml-1">💬</span>
          </button>
        </td>
      `;
    });

    tbodyHtml += `</tr>`;
  });

  tbodyHtml += `</tbody>`;
  table.innerHTML = theadHtml + tbodyHtml;
}

function orderSkinFromTable(type, res, price) {
  if (!price || price === '-') return;

  const snippet = `สวัสดีครับ สนใจสั่งคอมมิชชั่นสกินกับ Yuki Shop ครับ!\n- ประเภท: ${type}\n- ความละเอียด: ${res}\n- เรตราคา: ${price}\n(ทักเพื่อส่งเรฟและสอบถามคิวงานครับ)`;
  
  const snippetEl = document.getElementById('orderTextSnippet');
  const titleEl = document.getElementById('orderModalTitle');
  const catEl = document.getElementById('orderModalCategory');
  const priceEl = document.getElementById('orderModalPrice');
  const modal = document.getElementById('orderModal');

  if (snippetEl) snippetEl.value = snippet;
  if (titleEl) titleEl.textContent = `สั่งทำ: ${type} (${res})`;
  if (catEl) catEl.textContent = `ขนาด ${res}`;
  if (priceEl) priceEl.textContent = price;

  if (modal) {
    modal.classList.remove('hidden');
  } else {
    if (navigator.clipboard) navigator.clipboard.writeText(snippet);
    openContactModal();
    showToastNotice(`📋 คัดลอกรายละเอียด "${type} (${res})" แล้ว! ส่งในช่องทางติดต่อได้เลยค่ะ`);
  }
}

function selectPricingBgPreset(url) {
  const input = document.getElementById('editPricingBgUrl');
  if (input) input.value = url;
  showToastNotice(`เลือกพื้นหลังแล้ว: ${url === 'none' ? 'ไม่มีภาพ (สีพื้นไล่เฉด)' : 'ภาพพาสเทลหิมะ'}`);
}

async function handlePricingBgUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      if (data.url) {
        const input = document.getElementById('editPricingBgUrl');
        if (input) input.value = data.url;
        showToast('✨ อัปโหลดพื้นหลังสำเร็จแล้ว');
      }
    }
  } catch (err) {
    console.warn('Failed to upload pricing background', err);
    showToastNotice('❌ อัปโหลดไฟล์ไม่สำเร็จ');
  }
}

function openPricingEditModal() {
  const pt = appData.pricingTable || {
    title: 'ราคาทุกขนาดอยู่ตรงนี้ เลือกได้เลย ✦',
    subtitle: 'Yuki Haru • Snow Butterfly',
    note: 'อยากได้แค่ Figura หรือโมเดล 3D? ทักมาสอบถามเพิ่มเติมได้เลย ✦',
    columns: ['64 Pixel', '128 Pixel', '512 Pixel', '1024 Pixel'],
    rows: [
      { type: 'ส่วนหัว', icon: '👤', prices: { '64 Pixel': '35 บาท', '128 Pixel': '50 บาท', '512 Pixel': '100 บาท', '1024 Pixel': '150 บาท' } },
      { type: 'ส่วนตัว', icon: '👗', prices: { '64 Pixel': '50 บาท', '128 Pixel': '75 บาท', '512 Pixel': '180 บาทขึ้นไป', '1024 Pixel': '250 บาทขึ้นไป' } },
      { type: 'ทั้งตัว', icon: '✨', prices: { '64 Pixel': '75 บาท', '128 Pixel': '110 บาท', '512 Pixel': '260 บาทขึ้นไป', '1024 Pixel': '350 บาทขึ้นไป' } }
    ]
  };

  const titleInput = document.getElementById('editPricingTitle');
  if (titleInput) titleInput.value = pt.title || '';
  const noteInput = document.getElementById('editPricingNote');
  if (noteInput) noteInput.value = pt.note || '';
  const bgInput = document.getElementById('editPricingBgUrl');
  if (bgInput) bgInput.value = pt.bgImage || '/uploads/pricing-clean-bg.png';

  const grid = document.getElementById('editPricingGrid');
  if (!grid) return;

  const cols = pt.columns || ['64 Pixel', '128 Pixel', '512 Pixel', '1024 Pixel'];
  const rows = pt.rows || [];

  let html = `<div class="space-y-4">`;

  rows.forEach((row, rIdx) => {
    html += `
      <div class="bg-white p-3 rounded-xl border border-purple-200/80 shadow-2xs">
        <div class="flex items-center gap-2 mb-2 font-bold text-xs text-purple-950">
          <span>${escapeHtml(row.icon || '🦋')}</span>
          <input type="text" id="editRowType_${rIdx}" value="${escapeHtml(row.type)}" class="px-2 py-1 border border-purple-200 rounded-lg text-xs font-bold text-purple-900 focus:outline-none focus:border-purple-500" />
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
    `;

    cols.forEach(col => {
      const val = (row.prices && row.prices[col]) ? row.prices[col] : '';
      html += `
        <div>
          <label class="block text-[10px] text-purple-600 font-bold mb-0.5">${escapeHtml(col)}</label>
          <input 
            type="text" 
            id="editCell_${rIdx}_${col}" 
            value="${escapeHtml(val)}" 
            class="w-full px-2 py-1.5 border border-purple-200 rounded-lg text-xs font-mono text-purple-950 bg-purple-50/40 focus:outline-none focus:border-purple-500" 
          />
        </div>
      `;
    });

    html += `</div></div>`;
  });

  html += `</div>`;
  grid.innerHTML = html;

  const modal = document.getElementById('pricingEditModal');
  if (modal) modal.classList.remove('hidden');
}

function closePricingEditModal() {
  const modal = document.getElementById('pricingEditModal');
  if (modal) modal.classList.add('hidden');
}

async function savePricingTableAdmin() {
  const pt = appData.pricingTable || {};
  const titleInput = document.getElementById('editPricingTitle');
  if (titleInput) pt.title = titleInput.value.trim() || 'ราคาทุกขนาดอยู่ตรงนี้ เลือกได้เลย ✦';
  const noteInput = document.getElementById('editPricingNote');
  if (noteInput) pt.note = noteInput.value.trim() || 'อยากได้แค่ Figura หรือโมเดล 3D? ทักมาสอบถามเพิ่มเติมได้เลย ✦';
  const bgInput = document.getElementById('editPricingBgUrl');
  if (bgInput) pt.bgImage = bgInput.value.trim() || '/uploads/pricing-clean-bg.png';
  pt.columns = pt.columns || ['64 Pixel', '128 Pixel', '512 Pixel', '1024 Pixel'];

  if (Array.isArray(pt.rows)) {
    pt.rows.forEach((row, rIdx) => {
      const typeInput = document.getElementById(`editRowType_${rIdx}`);
      if (typeInput) row.type = typeInput.value.trim();
      if (!row.prices) row.prices = {};
      pt.columns.forEach(col => {
        const cellInput = document.getElementById(`editCell_${rIdx}_${col}`);
        if (cellInput) {
          row.prices[col] = cellInput.value.trim();
        }
      });
    });
  }

  // Also sync to categoryPrices and update all items in portfolio
  if (!appData.categoryPrices) appData.categoryPrices = {};
  const headRow = pt.rows.find(r => r.type.includes('หัว')) || pt.rows[0];
  const bodyRow = pt.rows.find(r => r.type.includes('ตัว') && !r.type.includes('เต็ม') && !r.type.includes('ทั้ง')) || pt.rows[1];
  const fullRow = pt.rows.find(r => r.type.includes('ทั้ง') || r.type.includes('เต็ม')) || pt.rows[2];

  pt.columns.forEach(col => {
    let matchedCat = (appData.categories || []).find(c => c.toLowerCase().includes(col.toLowerCase().replace(' pixel', '').replace('px', '')));
    if (!matchedCat) {
      if (col.includes('64')) matchedCat = 'ตัวอย่างสกิน 64';
      else if (col.includes('128')) matchedCat = 'ตัวอย่างงานสกิน 128';
      else if (col.includes('512')) matchedCat = 'ตัวอย่างงานสกิน 512';
      else if (col.includes('1024')) matchedCat = 'ตัวอย่าง 1024';
    }
    if (matchedCat) {
      appData.categoryPrices[matchedCat] = {
        priceHead: headRow?.prices?.[col] || '35 บาท',
        priceBody: bodyRow?.prices?.[col] || '50 บาท',
        priceFull: fullRow?.prices?.[col] || '75 บาท'
      };
      if (Array.isArray(appData.items)) {
        appData.items.forEach(it => {
          if (it.category === matchedCat) {
            it.priceHead = appData.categoryPrices[matchedCat].priceHead;
            it.priceBody = appData.categoryPrices[matchedCat].priceBody;
            it.priceFull = appData.categoryPrices[matchedCat].priceFull;
            it.price = it.priceFull;
          }
        });
      }
    }
  });

  appData.pricingTable = pt;
  renderPricingTable();
  renderRightPricing();
  persistLocal();
  closePricingEditModal();

  try {
    await fetch('/api/pricing-table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pricingTable: pt })
    });
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData)
    });
    showToastNotice('💾 บันทึกตารางเรตราคาเรียบร้อยแล้ว! ✨');
  } catch (err) {
    console.warn('API error saving pricing table:', err);
    showToastNotice('บันทึกตารางเรตราคาลงเครื่องแล้ว!');
  }
}

// ==================== REMAKE PRICING SYSTEM ====================
let activePricingSubTab = 'standard'; // 'standard' | 'remake' | 'addon'

function switchPricingSubTab(subTab) {
  activePricingSubTab = subTab;
  const standardSec = document.getElementById('pricingStandardSection');
  const remakeSec = document.getElementById('pricingRemakeSection');
  const addonSec = document.getElementById('pricingAddonSection');
  const btnStandard = document.getElementById('pricingSubTabStandardBtn');
  const btnRemake = document.getElementById('pricingSubTabRemakeBtn');
  const btnAddon = document.getElementById('pricingSubTabAddonBtn');

  const activeBtnClass = 'flex-1 py-2 px-3 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-xs cursor-pointer whitespace-nowrap';
  const inactiveBtnClass = 'flex-1 py-2 px-3 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 text-purple-800 hover:bg-purple-100/60 cursor-pointer whitespace-nowrap';

  if (standardSec) standardSec.classList.toggle('hidden', subTab !== 'standard');
  if (remakeSec) remakeSec.classList.toggle('hidden', subTab !== 'remake');
  if (addonSec) addonSec.classList.toggle('hidden', subTab !== 'addon');

  if (btnStandard) btnStandard.className = subTab === 'standard' ? activeBtnClass : inactiveBtnClass;
  if (btnRemake) btnRemake.className = subTab === 'remake' ? activeBtnClass : inactiveBtnClass;
  if (btnAddon) btnAddon.className = subTab === 'addon' ? activeBtnClass : inactiveBtnClass;

  if (subTab === 'remake') {
    renderRemakeTables();
  } else if (subTab === 'addon') {
    renderAddonTable();
  } else {
    renderPricingTable();
  }
}

function renderRemakeTables() {
  const upscaleTable = document.getElementById('remakeUpscaleTable');
  const downscaleTable = document.getElementById('remakeDownscaleTable');

  const rp = appData.remakePricing || {
    upscale: {
      title: 'Skin Remake — Price List',
      items: [
        { scale: '64 → 128 Pixel', icon: '🌱', head: '40 ฿', body: '65 ฿', full: '100 ฿' },
        { scale: '64 → 512 Pixel', icon: '🌸', head: '80 ฿', body: '150 ฿', full: '250 ฿' },
        { scale: '64 → 1024 Pixel', icon: '✨', head: '150 ฿', body: '250 ฿', full: '400 ฿' },
        { scale: '128 → 512 Pixel', icon: '❄️', head: '70 ฿', body: '120 ฿', full: '190 ฿' },
        { scale: '128 → 1024 Pixel', icon: '🦋', head: '120 ฿', body: '220 ฿', full: '330 ฿' },
        { scale: '512 → 1024 Pixel', icon: '👑', head: '90 ฿', body: '150 ฿', full: '250 ฿' }
      ]
    },
    downscale: {
      title: 'Skin Remake กลับ — Price List',
      items: [
        { scale: '128 → 64 Pixel', icon: '🌱', head: '40 ฿', body: '60 ฿', full: '90 ฿' },
        { scale: '512 → 64 Pixel', icon: '❄️', head: '60 ฿', body: '100 ฿', full: '150 ฿' },
        { scale: '512 → 128 Pixel', icon: '🌸', head: '50 ฿', body: '90 ฿', full: '130 ฿' },
        { scale: '1024 → 64 Pixel', icon: '✨', head: '100 ฿', body: '150 ฿', full: '220 ฿' },
        { scale: '1024 → 128 Pixel', icon: '🦋', head: '80 ฿', body: '130 ฿', full: '190 ฿' },
        { scale: '1024 → 512 Pixel', icon: '💫', head: '70 ฿', body: '120 ฿', full: '180 ฿' }
      ]
    }
  };

  function buildTableHtml(title, items, isDownscale) {
    const themeColor = isDownscale ? 'rose' : 'indigo';
    let thead = `
      <thead>
        <tr class="border-b border-${themeColor}-200/80 text-[#474375] text-xs sm:text-sm font-bold select-none bg-${themeColor}-50/50">
          <th class="py-4 px-4 text-left font-bold text-[#3c3768] w-64 sm:w-80">
            <div class="flex items-center gap-2">
              <span class="text-base">${isDownscale ? '🔁' : '🔄'}</span>
              <span>รายละเอียดงาน</span>
            </div>
          </th>
          <th class="py-4 px-3 border-l border-${themeColor}-200/60 font-bold tracking-wider">
            <span>👤 ส่วนหัว</span>
          </th>
          <th class="py-4 px-3 border-l border-${themeColor}-200/60 font-bold tracking-wider">
            <span>👗 ส่วนตัว</span>
          </th>
          <th class="py-4 px-3 border-l border-${themeColor}-200/60 font-bold tracking-wider">
            <span>✨ ทั้งตัว</span>
          </th>
        </tr>
      </thead>
    `;

    let tbody = `<tbody class="divide-y divide-${themeColor}-100 text-xs sm:text-sm text-[#443f70] font-medium">`;

    items.forEach((it) => {
      tbody += `
        <tr class="hover:bg-${themeColor}-50/60 transition-colors duration-150">
          <td class="py-4 px-4 text-left font-bold text-[#3c3768]">
            <div class="flex items-center gap-2.5">
              <span class="text-base">${escapeHtml(it.icon || '🦋')}</span>
              <span class="font-bold text-xs sm:text-sm text-purple-950">${escapeHtml(it.scale)}</span>
            </div>
          </td>
      `;

      const parts = [
        { name: 'ส่วนหัว', val: it.head },
        { name: 'ส่วนตัว', val: it.body },
        { name: 'ทั้งตัว', val: it.full }
      ];

      parts.forEach(p => {
        const isClickable = p.val && p.val !== '-' && p.val.trim() !== '';
        if (isClickable) {
          tbody += `
            <td class="py-4 px-3 border-l border-${themeColor}-100/80">
              <button 
                type="button" 
                onclick="orderRemakeSkin('${escapeHtml(title)}', '${escapeHtml(it.scale)}', '${escapeHtml(p.name)}', '${escapeHtml(p.val)}')"
                class="w-full py-2 px-2.5 rounded-xl text-center font-bold text-[#494475] hover:bg-${themeColor}-200/70 hover:text-purple-950 hover:shadow-xs active:scale-95 transition-all cursor-pointer group"
                title="สั่งรีเมค ${escapeHtml(it.scale)} (${escapeHtml(p.name)}) ราคา ${escapeHtml(p.val)}"
              >
                <span class="tracking-wide text-xs sm:text-sm">${escapeHtml(p.val)}</span>
                <span class="hidden group-hover:inline-block text-[10px] text-${themeColor}-600 ml-1">💬</span>
              </button>
            </td>
          `;
        } else {
          tbody += `
            <td class="py-4 px-3 border-l border-${themeColor}-100/80 text-purple-300 font-bold select-none">
              -
            </td>
          `;
        }
      });

      tbody += `</tr>`;
    });

    tbody += `</tbody>`;
    return thead + tbody;
  }

  if (upscaleTable) {
    const upItems = rp.upscale?.items || [];
    upscaleTable.innerHTML = buildTableHtml('Skin Remake', upItems, false);
  }

  if (downscaleTable) {
    const downItems = rp.downscale?.items || [];
    downscaleTable.innerHTML = buildTableHtml('Skin Remake กลับ', downItems, true);
  }
}

function orderRemakeSkin(tableName, scale, part, price) {
  if (!price || price === '-') return;

  const snippet = `สวัสดีครับ สนใจสั่งรีเมคสกินกับ Yuki Shop ครับ!\n- รายการ: ${tableName}\n- การแปลงขนาด: ${scale}\n- ชิ้นส่วน: ${part}\n- เรตราคา: ${price}\n(ทักเพื่อส่งไฟล์สกินเดิมและสอบถามคิวงานครับ)`;
  
  const snippetEl = document.getElementById('orderTextSnippet');
  const titleEl = document.getElementById('orderModalTitle');
  const catEl = document.getElementById('orderModalCategory');
  const priceEl = document.getElementById('orderModalPrice');
  const modal = document.getElementById('orderModal');

  if (snippetEl) snippetEl.value = snippet;
  if (titleEl) titleEl.textContent = `สั่งรีเมค: ${scale} (${part})`;
  if (catEl) catEl.textContent = `${tableName}`;
  if (priceEl) priceEl.textContent = price;

  if (modal) {
    modal.classList.remove('hidden');
  } else {
    if (navigator.clipboard) navigator.clipboard.writeText(snippet);
    openContactModal();
    showToastNotice(`📋 คัดลอกรายละเอียด "${tableName} - ${scale} (${part})" แล้ว! ส่งในช่องทางติดต่อได้เลยค่ะ`);
  }
}

function openRemakePricingEditModal() {
  const rp = appData.remakePricing || {};
  const upItems = rp.upscale?.items || [];
  const downItems = rp.downscale?.items || [];

  const upGrid = document.getElementById('editRemakeUpscaleGrid');
  const downGrid = document.getElementById('editRemakeDownscaleGrid');

  function renderGridRows(items, prefix) {
    let html = '';
    items.forEach((it, idx) => {
      html += `
        <div class="bg-white p-3 rounded-xl border border-purple-200/80 shadow-2xs space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-sm">${escapeHtml(it.icon || '🦋')}</span>
            <input type="text" id="${prefix}_scale_${idx}" value="${escapeHtml(it.scale)}" class="flex-1 px-2.5 py-1.5 border border-purple-200 rounded-lg text-xs font-bold text-purple-950 focus:outline-none focus:border-purple-500" />
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-[10px] text-purple-600 font-bold mb-0.5">👤 ส่วนหัว</label>
              <input type="text" id="${prefix}_head_${idx}" value="${escapeHtml(it.head || '-')}" class="w-full px-2 py-1.5 border border-purple-200 rounded-lg text-xs font-mono text-purple-950 bg-purple-50/30 focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label class="block text-[10px] text-purple-600 font-bold mb-0.5">👗 ส่วนตัว</label>
              <input type="text" id="${prefix}_body_${idx}" value="${escapeHtml(it.body || '-')}" class="w-full px-2 py-1.5 border border-purple-200 rounded-lg text-xs font-mono text-purple-950 bg-purple-50/30 focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label class="block text-[10px] text-purple-600 font-bold mb-0.5">✨ ทั้งตัว</label>
              <input type="text" id="${prefix}_full_${idx}" value="${escapeHtml(it.full || '-')}" class="w-full px-2 py-1.5 border border-purple-200 rounded-lg text-xs font-mono text-purple-950 bg-purple-50/30 focus:outline-none focus:border-purple-500" />
            </div>
          </div>
        </div>
      `;
    });
    return html;
  }

  if (upGrid) upGrid.innerHTML = renderGridRows(upItems, 'editRemakeUp');
  if (downGrid) downGrid.innerHTML = renderGridRows(downItems, 'editRemakeDown');

  const modal = document.getElementById('remakePricingEditModal');
  if (modal) modal.classList.remove('hidden');
}

function closeRemakePricingEditModal() {
  const modal = document.getElementById('remakePricingEditModal');
  if (modal) modal.classList.add('hidden');
}

async function saveRemakePricingAdmin() {
  const rp = appData.remakePricing || { upscale: { items: [] }, downscale: { items: [] } };

  if (rp.upscale && Array.isArray(rp.upscale.items)) {
    rp.upscale.items.forEach((it, idx) => {
      const scaleInput = document.getElementById(`editRemakeUp_scale_${idx}`);
      const headInput = document.getElementById(`editRemakeUp_head_${idx}`);
      const bodyInput = document.getElementById(`editRemakeUp_body_${idx}`);
      const fullInput = document.getElementById(`editRemakeUp_full_${idx}`);
      if (scaleInput) it.scale = scaleInput.value.trim();
      if (headInput) it.head = headInput.value.trim();
      if (bodyInput) it.body = bodyInput.value.trim();
      if (fullInput) it.full = fullInput.value.trim();
    });
  }

  if (rp.downscale && Array.isArray(rp.downscale.items)) {
    rp.downscale.items.forEach((it, idx) => {
      const scaleInput = document.getElementById(`editRemakeDown_scale_${idx}`);
      const headInput = document.getElementById(`editRemakeDown_head_${idx}`);
      const bodyInput = document.getElementById(`editRemakeDown_body_${idx}`);
      const fullInput = document.getElementById(`editRemakeDown_full_${idx}`);
      if (scaleInput) it.scale = scaleInput.value.trim();
      if (headInput) it.head = headInput.value.trim();
      if (bodyInput) it.body = bodyInput.value.trim();
      if (fullInput) it.full = fullInput.value.trim();
    });
  }

  appData.remakePricing = rp;
  renderRemakeTables();
  persistLocal();
  closeRemakePricingEditModal();

  try {
    await fetch('/api/remake-pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remakePricing: rp })
    });
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData)
    });
    showToastNotice('💾 บันทึกตารางราคารีเมคเรียบร้อยแล้ว! ✨');
  } catch (err) {
    console.warn('API error saving remake pricing:', err);
    showToastNotice('บันทึกราคารีเมคลงเครื่องแล้ว!');
  }
}

// ==================== ADD-ON PRICING SYSTEM (BLOOD & BANDAGES) ====================
function renderAddonTable() {
  const table = document.getElementById('addonMainTable');
  if (!table) return;

  const ap = appData.addonPricing || {
    title: 'Blood & Bandages — เลือด ผ้าพันแผล',
    subtitle: 'เลือดและบาดแผล, ผ้าพันแผล • กดคลิกที่ราคาเพื่อส่งข้อความสั่งทำได้ทันที ✨',
    note: 'สามารถสั่งเพิ่มร่วมกับสกินใหม่ หรือนำสกินเดิมมาให้ช่างเพิ่มเลือด/ผ้าพันแผลได้เลยค่ะ ✦',
    items: [
      { name: 'Blood & Wounds — เลือดและบาดแผล', icon: '🩸', desc: 'รอยเลือด บาดแผล แผลเป็น ขีดข่วน หรือร่องรอยการต่อสู้สุดเท่', price: '15 บาทขึ้นไป' },
      { name: 'Bandages — ผ้าพันแผล', icon: '🩹', desc: 'ผ้าพันแผลรอบตัว แขน ขา หรือผ้าปิดแผล/ผ้าคาดศีรษะ', price: '15 บาทขึ้นไป' }
    ]
  };

  const titleEl = document.getElementById('addonPricingTitle');
  if (titleEl) {
    titleEl.innerHTML = `<span>${escapeHtml(ap.title || 'Blood & Bandages — เลือด ผ้าพันแผล')}</span> <span class="text-rose-400 font-light text-xl">✦</span>`;
  }
  const subtitleEl = document.getElementById('addonPricingSubtitle');
  if (subtitleEl) subtitleEl.textContent = ap.subtitle || 'เลือดและบาดแผล, ผ้าพันแผล • กดคลิกที่ราคาเพื่อส่งข้อความสั่งทำได้ทันที ✨';
  const noteEl = document.getElementById('addonPricingNote');
  if (noteEl) noteEl.textContent = ap.note || 'สามารถสั่งเพิ่มร่วมกับสกินใหม่ หรือนำสกินเดิมมาให้ช่างเพิ่มเลือด/ผ้าพันแผลได้เลยค่ะ ✦';

  const items = ap.items || [];

  let thead = `
    <thead>
      <tr class="border-b border-rose-200/80 text-[#5c3a4d] text-xs sm:text-sm font-bold select-none bg-rose-50/50">
        <th class="py-4 px-4 text-left font-bold text-[#503040] w-64 sm:w-80">
          <div class="flex items-center gap-2">
            <span class="text-base">🩸</span>
            <span>รายการ (เลือด / ผ้าพันแผล)</span>
          </div>
        </th>
        <th class="py-4 px-4 text-left font-bold text-[#503040]">
          <span>คำอธิบาย / รายละเอียด</span>
        </th>
        <th class="py-4 px-4 text-center font-bold text-[#503040] w-44">
          <span>ราคาเริ่มต้น</span>
        </th>
        <th class="py-4 px-3 text-center font-bold text-[#503040] w-36">
          <span>สั่งทำ</span>
        </th>
      </tr>
    </thead>
  `;

  let tbody = `<tbody class="divide-y divide-rose-100 text-xs sm:text-sm text-[#443f70] font-medium">`;

  items.forEach((it) => {
    tbody += `
      <tr class="hover:bg-rose-50/60 transition-colors duration-150">
        <td class="py-4 px-4 text-left font-bold text-[#3c3768]">
          <div class="flex items-center gap-2.5">
            <span class="text-xl sm:text-2xl">${escapeHtml(it.icon || '🩸')}</span>
            <span class="font-bold text-xs sm:text-sm text-rose-950">${escapeHtml(it.name)}</span>
          </div>
        </td>
        <td class="py-4 px-4 text-left text-xs text-rose-800/80 font-normal">
          ${escapeHtml(it.desc || '-')}
        </td>
        <td class="py-4 px-4 text-center font-extrabold text-sm sm:text-base text-rose-700">
          <span class="px-3 py-1 rounded-full bg-rose-100/80 text-rose-900 border border-rose-200/70 inline-block font-mono">
            ${escapeHtml(it.price)}
          </span>
        </td>
        <td class="py-4 px-3 text-center">
          <button 
            type="button" 
            onclick="orderAddonSkin('${escapeHtml(it.name)}', '${escapeHtml(it.price)}')"
            class="py-2 px-3.5 rounded-xl font-bold text-xs bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto"
            title="คลิกเพื่อสั่งทำดีเทลเสริม ${escapeHtml(it.name)} ราคา ${escapeHtml(it.price)}"
          >
            <span>💬</span>
            <span>สั่งทำ</span>
          </button>
        </td>
      </tr>
    `;
  });

  tbody += `</tbody>`;
  table.innerHTML = thead + tbody;
}

function orderAddonSkin(itemName, price) {
  if (!price || price === '-') return;

  const snippet = `สวัสดีครับ สนใจสั่งทำดีเทลเสริมกับ Yuki Shop ครับ!\n- รายการ: ${itemName}\n- เรตราคา: ${price}\n(ทักเพื่อส่งไฟล์สกินเดิมและรายละเอียดตำแหน่งที่ต้องการเพิ่มครับ)`;
  
  const snippetEl = document.getElementById('orderTextSnippet');
  const titleEl = document.getElementById('orderModalTitle');
  const catEl = document.getElementById('orderModalCategory');
  const priceEl = document.getElementById('orderModalPrice');
  const modal = document.getElementById('orderModal');

  if (snippetEl) snippetEl.value = snippet;
  if (titleEl) titleEl.textContent = `สั่งทำดีเทล: ${itemName}`;
  if (catEl) catEl.textContent = `ดีเทลเสริมพิเศษ`;
  if (priceEl) priceEl.textContent = price;

  if (modal) {
    modal.classList.remove('hidden');
  } else {
    if (navigator.clipboard) navigator.clipboard.writeText(snippet);
    openContactModal();
    showToastNotice(`📋 คัดลอกรายละเอียด "${itemName} (${price})" แล้ว! ส่งในช่องทางติดต่อได้เลยค่ะ`);
  }
}

function openAddonPricingEditModal() {
  const ap = appData.addonPricing || {
    title: 'Blood & Bandages — Price List',
    subtitle: 'ดีเทลเสริมพิเศษ: เลือด บาดแผล และผ้าพันแผล ✨',
    note: 'สามารถสั่งเพิ่มร่วมกับสกินใหม่ หรือนำสกินเดิมมาให้ช่างเพิ่มดีเทลเลือด/ผ้าพันแผลได้เลยค่ะ ✦',
    items: [
      { name: 'Blood & Wounds — เลือดและบาดแผล', icon: '🩸', desc: 'รอยเลือด บาดแผล แผลเป็น ขีดข่วน หรือร่องรอยการต่อสู้สุดเท่', price: '15 บาทขึ้นไป' },
      { name: 'Bandages — ผ้าพันแผล', icon: '🩹', desc: 'ผ้าพันแผลรอบตัว แขน ขา หรือผ้าปิดแผล/ผ้าคาดศีรษะ', price: '15 บาทขึ้นไป' }
    ]
  };

  const titleInput = document.getElementById('editAddonTitle');
  if (titleInput) titleInput.value = ap.title || '';
  const subInput = document.getElementById('editAddonSubtitle');
  if (subInput) subInput.value = ap.subtitle || '';
  const noteInput = document.getElementById('editAddonNote');
  if (noteInput) noteInput.value = ap.note || '';

  const grid = document.getElementById('editAddonGrid');
  if (!grid) return;

  let html = '';
  (ap.items || []).forEach((it, idx) => {
    html += `
      <div class="bg-white p-3 rounded-xl border border-rose-200/80 shadow-2xs space-y-2">
        <div class="flex items-center gap-2">
          <span class="text-base">${escapeHtml(it.icon || '🩸')}</span>
          <input type="text" id="editAddon_name_${idx}" value="${escapeHtml(it.name)}" class="flex-1 px-2.5 py-1.5 border border-rose-200 rounded-lg text-xs font-bold text-rose-950 focus:outline-none focus:border-rose-500" placeholder="ชื่อรายการ" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] text-rose-700 font-bold mb-0.5">คำอธิบาย</label>
            <input type="text" id="editAddon_desc_${idx}" value="${escapeHtml(it.desc || '')}" class="w-full px-2 py-1.5 border border-rose-200 rounded-lg text-xs text-rose-950 bg-rose-50/20 focus:outline-none focus:border-rose-500" placeholder="คำอธิบาย" />
          </div>
          <div>
            <label class="block text-[10px] text-rose-700 font-bold mb-0.5">ราคา</label>
            <input type="text" id="editAddon_price_${idx}" value="${escapeHtml(it.price || '15 บาทขึ้นไป')}" class="w-full px-2 py-1.5 border border-rose-200 rounded-lg text-xs font-bold text-rose-950 bg-rose-50/20 focus:outline-none focus:border-rose-500" placeholder="ราคา" />
          </div>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;

  const modal = document.getElementById('addonPricingEditModal');
  if (modal) modal.classList.remove('hidden');
}

function closeAddonPricingEditModal() {
  const modal = document.getElementById('addonPricingEditModal');
  if (modal) modal.classList.add('hidden');
}

async function saveAddonPricingAdmin() {
  const ap = appData.addonPricing || { items: [] };
  const titleInput = document.getElementById('editAddonTitle');
  if (titleInput) ap.title = titleInput.value.trim() || 'Blood & Bandages — Price List';
  const subInput = document.getElementById('editAddonSubtitle');
  if (subInput) ap.subtitle = subInput.value.trim() || 'ดีเทลเสริมพิเศษ: เลือด บาดแผล และผ้าพันแผล ✨';
  const noteInput = document.getElementById('editAddonNote');
  if (noteInput) ap.note = noteInput.value.trim() || 'สามารถสั่งเพิ่มร่วมกับสกินใหม่ หรือนำสกินเดิมมาให้ช่างเพิ่มดีเทลเลือด/ผ้าพันแผลได้เลยค่ะ ✦';

  if (Array.isArray(ap.items)) {
    ap.items.forEach((it, idx) => {
      const nameInput = document.getElementById(`editAddon_name_${idx}`);
      const descInput = document.getElementById(`editAddon_desc_${idx}`);
      const priceInput = document.getElementById(`editAddon_price_${idx}`);
      if (nameInput) it.name = nameInput.value.trim();
      if (descInput) it.desc = descInput.value.trim();
      if (priceInput) it.price = priceInput.value.trim();
    });
  }

  appData.addonPricing = ap;
  renderAddonTable();
  persistLocal();
  closeAddonPricingEditModal();

  try {
    await fetch('/api/addon-pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addonPricing: ap })
    });
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData)
    });
    showToastNotice('💾 บันทึกตารางราคาดีเทลเสริมเรียบร้อยแล้ว! ✨');
  } catch (err) {
    console.warn('API error saving addon pricing:', err);
    showToastNotice('บันทึกราคาดีเทลเสริมลงเครื่องแล้ว!');
  }
}

// ==================== PAGE VIEW SWITCHER (HOME vs GALLERY vs PREMADE) ====================
let currentTab = 'home';

function switchPageTab(tabName) {
  currentTab = tabName;
  const homePanel = document.getElementById('homeViewPanel');
  const galleryPanel = document.getElementById('galleryViewPanel');
  const premadePanel = document.getElementById('premadeViewPanel');
  const pricingPanel = document.getElementById('pricingViewPanel');
  
  const navHomeBtn = document.getElementById('navHomeBtn');
  const navGalleryBtn = document.getElementById('navGalleryBtn');
  const navPricingBtn = document.getElementById('navPricingBtn');
  const navPremadeBtn = document.getElementById('navPremadeBtn');
  const navContactBtn = document.getElementById('navContactBtn');

  // Reset tab button styles
  const defaultClass = 'hover:text-purple-950 transition flex items-center gap-1.5 py-1 px-3 sm:px-3.5 rounded-full hover:bg-purple-100/60 font-medium text-purple-800 text-xs sm:text-sm whitespace-nowrap shrink-0';
  const activeClass = 'hover:text-purple-950 transition flex items-center gap-1.5 py-1 px-3 sm:px-3.5 rounded-full bg-white/80 border border-purple-200 shadow-xs font-bold text-purple-950 text-xs sm:text-sm whitespace-nowrap shrink-0';

  if (navHomeBtn) navHomeBtn.className = defaultClass;
  if (navGalleryBtn) navGalleryBtn.className = defaultClass;
  if (navPricingBtn) navPricingBtn.className = defaultClass;
  if (navPremadeBtn) navPremadeBtn.className = defaultClass;
  if (navContactBtn) navContactBtn.className = defaultClass;

  // Mobile Bottom Nav Sync
  const mHome = document.getElementById('mobileNavHomeBtn');
  const mGallery = document.getElementById('mobileNavGalleryBtn');
  const mPricing = document.getElementById('mobileNavPricingBtn');
  const mPremade = document.getElementById('mobileNavPremadeBtn');
  const mContact = document.getElementById('mobileNavContactBtn');

  const mDefaultClass = 'flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition text-purple-600 hover:text-purple-900';
  const mActiveClass = 'flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition text-purple-950 font-black bg-purple-100/80 shadow-2xs';

  if (mHome) mHome.className = tabName === 'home' ? mActiveClass : mDefaultClass;
  if (mGallery) mGallery.className = tabName === 'gallery' ? mActiveClass : mDefaultClass;
  if (mPricing) mPricing.className = tabName === 'pricing' ? mActiveClass : mDefaultClass;
  if (mPremade) mPremade.className = tabName === 'premade' ? mActiveClass : mDefaultClass;
  if (mContact) mContact.className = mDefaultClass;

  if (tabName === 'home') {
    if (homePanel) homePanel.classList.remove('view-hidden');
    if (galleryPanel) galleryPanel.classList.add('view-hidden');
    if (premadePanel) premadePanel.classList.add('view-hidden');
    if (pricingPanel) pricingPanel.classList.add('view-hidden');
    if (navHomeBtn) navHomeBtn.className = activeClass;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof startHeroAutoSlide === 'function') startHeroAutoSlide();
  } else if (tabName === 'gallery') {
    if (typeof stopHeroAutoSlide === 'function') stopHeroAutoSlide();
    if (homePanel) homePanel.classList.add('view-hidden');
    if (galleryPanel) galleryPanel.classList.remove('view-hidden');
    if (premadePanel) premadePanel.classList.add('view-hidden');
    if (pricingPanel) pricingPanel.classList.add('view-hidden');
    if (navGalleryBtn) navGalleryBtn.className = activeClass;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Refresh skinViewer layout
    if (skinViewer) {
      setTimeout(() => {
        if (skinViewer.updateComposerSize) skinViewer.updateComposerSize();
        if (skinViewer.controls) skinViewer.controls.update();
      }, 50);
    }
  } else if (tabName === 'premade') {
    if (typeof stopHeroAutoSlide === 'function') stopHeroAutoSlide();
    if (homePanel) homePanel.classList.add('view-hidden');
    if (galleryPanel) galleryPanel.classList.add('view-hidden');
    if (premadePanel) premadePanel.classList.remove('view-hidden');
    if (pricingPanel) pricingPanel.classList.add('view-hidden');
    if (navPremadeBtn) navPremadeBtn.className = activeClass;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    renderPremadeCards();
    if (premadeSkinViewer) {
      setTimeout(() => {
        if (premadeSkinViewer.updateComposerSize) premadeSkinViewer.updateComposerSize();
        if (premadeSkinViewer.controls) premadeSkinViewer.controls.update();
      }, 60);
    }
  } else if (tabName === 'pricing') {
    if (typeof stopHeroAutoSlide === 'function') stopHeroAutoSlide();
    if (homePanel) homePanel.classList.add('view-hidden');
    if (galleryPanel) galleryPanel.classList.add('view-hidden');
    if (premadePanel) premadePanel.classList.add('view-hidden');
    if (pricingPanel) pricingPanel.classList.remove('view-hidden');
    if (navPricingBtn) navPricingBtn.className = activeClass;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderPricingTable();
    renderRemakeTables();
    renderAddonTable();
  }
  lucide.createIcons();
}

function toggleMobileDrawer() {
  const drawer = document.getElementById('mobileDrawerModal');
  if (!drawer) return;
  if (drawer.classList.contains('hidden')) {
    drawer.classList.remove('hidden');
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  } else {
    drawer.classList.add('hidden');
  }
}

function closeMobileDrawer() {
  const drawer = document.getElementById('mobileDrawerModal');
  if (drawer) drawer.classList.add('hidden');
}

function handleMobileSearch() {
  const input = document.getElementById('mobileSearchInput');
  const query = (input?.value || '').trim();
  if (!query) return;
  closeMobileDrawer();
  switchPageTab('gallery');
  const globalInput = document.getElementById('globalSearchInput');
  if (globalInput) {
    globalInput.value = query;
    handleGlobalSearch({ target: globalInput });
  }
}

function filterCategoryAndOpenGallery(catName) {
  // If not on gallery tab, switch to gallery first!
  switchPageTab('gallery');

  // Find exact or closest matching category in appData.categories
  let targetCat = appData.categories.find(c => 
    c.toLowerCase() === catName.toLowerCase() ||
    c.includes(catName) || 
    catName.includes(c)
  );

  if (!targetCat) {
    if (catName.includes('สกินสำเร็จ') || catName.includes('สำเร็จ') || catName.toLowerCase().includes('premade')) {
      targetCat = 'สกินสำเร็จ';
    } else if (catName.includes('1024')) {
      targetCat = appData.categories.find(c => c.includes('1024')) || 'ตัวอย่างงานสกิน 512';
    } else if (catName.includes('512')) {
      targetCat = appData.categories.find(c => c.includes('512')) || 'ตัวอย่างงานสกิน 512';
    } else if (catName.includes('128')) {
      targetCat = appData.categories.find(c => c.includes('128')) || 'ตัวอย่างงานสกิน 128';
    } else if (catName.includes('สกิน') || catName.toLowerCase().includes('skin')) {
      targetCat = appData.categories.find(c => c.includes('สกิน') || c.toLowerCase().includes('skin')) || appData.categories[0] || 'ตัวอย่างสกิน 64';
    } else {
      targetCat = 'ALL';
    }
  }

  selectCategory(targetCat);

  // Auto-select matching item in this category
  let matched = appData.items.find(i => 
    i.category === targetCat || 
    i.category === catName ||
    (catName.includes('สกินสำเร็จ') && (i.category === 'สกินสำเร็จ' || i.itemType === 'premade')) ||
    (catName.includes('512') && i.category.includes('512')) ||
    (catName.includes('128') && i.category.includes('128')) ||
    (catName.includes('สกิน') && (i.category.includes('สกิน') || i.itemType === 'skin'))
  );

  if (matched) {
    selectItem(matched.id);
  } else {
    const filtered = getFilteredItems();
    if (filtered.length > 0) {
      selectItem(filtered[0].id);
    } else if (appData.items.length > 0) {
      selectItem(appData.items[0].id);
    }
  }

  // Smooth scroll to showcase
  setTimeout(() => {
    const el = document.getElementById('centerShowcasePanel');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);

  showToast(`เปิดดูตัวอย่าง: ${targetCat || catName}`);
}

function scrollToSection(sectionId) {
  if (currentTab !== 'home') {
    switchPageTab('home');
  }
  setTimeout(() => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

function navScrollTo(sectionId) {
  scrollToSection(sectionId);
}

// Global search bar
function handleGlobalSearch(event) {
  const query = (event.target.value || '').trim().toLowerCase();
  if (event.key === 'Enter' || query.length >= 2) {
    if (currentTab !== 'gallery') {
      switchPageTab('gallery');
    }
    const filtered = appData.items.filter(item => {
      const matchTitle = (item.title || '').toLowerCase().includes(query);
      const matchCat = (item.category || '').toLowerCase().includes(query);
      const matchDesc = (item.description || '').toLowerCase().includes(query);
      const matchTags = (item.tags || []).some(t => t.toLowerCase().includes(query));
      return matchTitle || matchCat || matchDesc || matchTags;
    });

    renderThumbnailsList(filtered);
    if (filtered.length > 0) {
      selectItem(filtered[0].id);
      showToast(`พบผลงาน ${filtered.length} ชิ้น สำหรับ "${query}" ✨`);
    } else {
      showToast(`ไม่พบผลงานสำหรับ "${query}"`);
    }
  }
}

// ==================== HERO BANNERS CAROUSEL ====================
let heroBannerIndex = 0;
let heroSlideIndex = 0;
let heroAutoSlideTimer = null;
const HERO_AUTO_SLIDE_DELAY = 4500; // Auto-slide every 4.5 seconds

function startHeroAutoSlide() {
  stopHeroAutoSlide();
  const banners = appData.heroBanners || [];
  if (banners.length <= 1) return;
  if (currentTab !== 'home') return;

  heroAutoSlideTimer = setInterval(() => {
    nextHeroSlide(true);
  }, HERO_AUTO_SLIDE_DELAY);
}

function stopHeroAutoSlide() {
  if (heroAutoSlideTimer) {
    clearInterval(heroAutoSlideTimer);
    heroAutoSlideTimer = null;
  }
}

function resetHeroAutoSlide() {
  stopHeroAutoSlide();
  startHeroAutoSlide();
}

function renderHeroBanners() {
  const track = document.getElementById('heroSliderTrack');
  const dotsContainer = document.getElementById('heroBannerDots');
  if (!track) return;

  const banners = appData.heroBanners || [
    { id: 'banner-1', image: 'uploads/home-hero-banner.png', title: 'Yuki Haru', subtitle: 'ให้ทุกวันเป็นเหมือนฤดูใบไม้ผลิที่มีหิมะโปรยปราย' }
  ];

  if (banners.length === 0) {
    track.innerHTML = `<div class="hero-slide-item" style="background-image: url('uploads/home-hero-banner.png');"></div>`;
    stopHeroAutoSlide();
    return;
  }

  if (heroBannerIndex >= banners.length) heroBannerIndex = 0;
  if (heroBannerIndex < 0) heroBannerIndex = banners.length - 1;

  // Render all slide items side-by-side inside the track
  track.innerHTML = banners.map((b, idx) => {
    const posX = b.positionX !== undefined ? b.positionX : 50;
    const posY = b.positionY !== undefined ? b.positionY : 50;
    const zoom = b.zoom !== undefined ? b.zoom : 100;
    const bgSize = zoom !== 100 ? `${zoom}% auto` : 'cover';
    return `
      <div class="hero-slide-item relative" id="heroSlide_${b.id || idx}" style="background-image: url('${escapeHtml(b.image)}'); background-position: ${posX}% ${posY}%; background-size: ${bgSize};"></div>
    `;
  }).join('');

  // Horizontal translate offset to slide side-by-side
  track.style.transform = `translateX(-${heroBannerIndex * 100}%)`;

  // Render dots
  if (dotsContainer) {
    if (banners.length > 1) {
      dotsContainer.innerHTML = banners.map((b, i) => `
        <button onclick="setHeroBannerSlide(${i})" class="h-2 rounded-full transition-all duration-300 ${i === heroBannerIndex ? 'bg-white w-6 shadow-xs' : 'bg-white/50 hover:bg-white/80 w-2'}" title="แบนเนอร์ ${i+1}"></button>
      `).join('');
    } else {
      dotsContainer.innerHTML = '';
    }
  }

  initHeroTouchSwipe();
  startHeroAutoSlide();
}

function updateHeroSlidePosition() {
  const track = document.getElementById('heroSliderTrack');
  const dotsContainer = document.getElementById('heroBannerDots');
  const banners = appData.heroBanners || [];

  if (track) {
    track.style.transform = `translateX(-${heroBannerIndex * 100}%)`;
  }

  // Update dots indicator active state without re-rendering track
  if (dotsContainer && banners.length > 1) {
    const dots = dotsContainer.querySelectorAll('button');
    dots.forEach((dot, i) => {
      if (i === heroBannerIndex) {
        dot.className = 'h-2 rounded-full transition-all duration-300 bg-white w-6 shadow-xs';
      } else {
        dot.className = 'h-2 rounded-full transition-all duration-300 bg-white/50 hover:bg-white/80 w-2';
      }
    });
  }
}

function prevHeroSlide() {
  const banners = appData.heroBanners || [];
  if (banners.length > 1) {
    heroBannerIndex = (heroBannerIndex - 1 + banners.length) % banners.length;
    updateHeroSlidePosition();
    resetHeroAutoSlide();
  } else if (appData.items && appData.items.length > 0) {
    heroSlideIndex = (heroSlideIndex - 1 + appData.items.length) % appData.items.length;
    selectItem(appData.items[heroSlideIndex].id);
    showToast(`✦ แสดงผลงาน: ${appData.items[heroSlideIndex].title}`);
  }
}

function nextHeroSlide(isAuto = false) {
  const banners = appData.heroBanners || [];
  if (banners.length > 1) {
    heroBannerIndex = (heroBannerIndex + 1) % banners.length;
    updateHeroSlidePosition();
    if (!isAuto) {
      resetHeroAutoSlide();
    }
  } else if (!isAuto && appData.items && appData.items.length > 0) {
    heroSlideIndex = (heroSlideIndex + 1) % appData.items.length;
    selectItem(appData.items[heroSlideIndex].id);
    showToast(`✦ แสดงผลงาน: ${appData.items[heroSlideIndex].title}`);
  }
}

function setHeroBannerSlide(idx) {
  heroBannerIndex = idx;
  updateHeroSlidePosition();
  resetHeroAutoSlide();
}

let isHeroTouchInitialized = false;
function initHeroTouchSwipe() {
  if (isHeroTouchInitialized) return;
  const viewport = document.getElementById('heroArtLayer');
  if (!viewport) return;
  isHeroTouchInitialized = true;

  let touchStartX = 0;
  let touchEndX = 0;

  viewport.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    stopHeroAutoSlide();
  }, { passive: true });

  viewport.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchEndX - touchStartX;
    if (Math.abs(diff) > 40) {
      if (diff < 0) {
        nextHeroSlide();
      } else {
        prevHeroSlide();
      }
    }
    resetHeroAutoSlide();
  }, { passive: true });

  // Hover to pause auto-slide, mouseleave to resume
  viewport.addEventListener('mouseenter', () => {
    stopHeroAutoSlide();
  });

  viewport.addEventListener('mouseleave', () => {
    startHeroAutoSlide();
  });
}

// Pause auto-slide when browser tab is hidden to save performance
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopHeroAutoSlide();
  } else if (currentTab === 'home') {
    startHeroAutoSlide();
  }
});

// ==================== INTERACTIVE BANNER POSITION EDITOR ====================
let editingRepositionBannerId = null;
let currentRepositionX = 50;
let currentRepositionY = 50;
let currentRepositionZoom = 100;
let currentRepositionImage = '';
let isRepositionDragInit = false;

function loadBannerIntoPositionEditor(banner) {
  if (!banner) return;
  editingRepositionBannerId = banner.id;
  currentRepositionImage = banner.image;
  currentRepositionX = banner.positionX !== undefined ? Number(banner.positionX) : 50;
  currentRepositionY = banner.positionY !== undefined ? Number(banner.positionY) : 50;
  currentRepositionZoom = banner.zoom !== undefined ? Number(banner.zoom) : 100;

  const titleEl = document.getElementById('positionEditorTitle');
  if (titleEl) {
    titleEl.textContent = `เลื่อนปรับตำแหน่ง: ${banner.title || 'ภาพแบนเนอร์'}`;
  }

  updateRepositionUI();
}

function selectBannerToReposition(bannerId) {
  const banners = appData.heroBanners || [];
  const b = banners.find(item => item.id === bannerId);
  if (b) {
    loadBannerIntoPositionEditor(b);
    openHeroBannerModal(b.id);
  }
}

function updateRepositionUI() {
  const box = document.getElementById('repositionPreviewBox');
  const sliderX = document.getElementById('bannerPosXInput');
  const sliderY = document.getElementById('bannerPosYInput');
  const sliderZoom = document.getElementById('bannerZoomInput');
  const labelX = document.getElementById('labelPosX');
  const labelY = document.getElementById('labelPosY');
  const valueX = document.getElementById('sliderValueX');
  const valueY = document.getElementById('sliderValueY');
  const valueZoom = document.getElementById('sliderValueZoom');

  if (sliderX) sliderX.value = currentRepositionX;
  if (sliderY) sliderY.value = currentRepositionY;
  if (sliderZoom) sliderZoom.value = currentRepositionZoom;

  if (labelX) labelX.textContent = `${Math.round(currentRepositionX)}%`;
  if (labelY) labelY.textContent = `${Math.round(currentRepositionY)}%`;
  if (valueX) valueX.textContent = `${Math.round(currentRepositionX)}%`;
  if (valueY) valueY.textContent = `${Math.round(currentRepositionY)}%`;
  if (valueZoom) valueZoom.textContent = `${currentRepositionZoom}% ${currentRepositionZoom === 100 ? '(พอดีกรอบ)' : ''}`;

  const bgSize = currentRepositionZoom !== 100 ? `${currentRepositionZoom}% auto` : 'cover';

  if (box && currentRepositionImage) {
    box.style.backgroundImage = `url('${currentRepositionImage}')`;
    box.style.backgroundPosition = `${currentRepositionX}% ${currentRepositionY}%`;
    box.style.backgroundSize = bgSize;
  }

  // Live real-time update on homepage hero banner
  if (editingRepositionBannerId) {
    const slide = document.getElementById(`heroSlide_${editingRepositionBannerId}`);
    if (slide) {
      slide.style.backgroundPosition = `${currentRepositionX}% ${currentRepositionY}%`;
      slide.style.backgroundSize = bgSize;
    }
  }
}

function onBannerPositionSliderChange() {
  const sliderX = document.getElementById('bannerPosXInput');
  const sliderY = document.getElementById('bannerPosYInput');
  const sliderZoom = document.getElementById('bannerZoomInput');

  if (sliderX) currentRepositionX = Number(sliderX.value);
  if (sliderY) currentRepositionY = Number(sliderY.value);
  if (sliderZoom) currentRepositionZoom = Number(sliderZoom.value);

  updateRepositionUI();
}

function setBannerPreset(type) {
  if (type === 'top') {
    currentRepositionY = 0;
  } else if (type === 'center') {
    currentRepositionX = 50;
    currentRepositionY = 50;
  } else if (type === 'bottom') {
    currentRepositionY = 100;
  } else if (type === 'reset') {
    currentRepositionX = 50;
    currentRepositionY = 50;
    currentRepositionZoom = 100;
  }
  updateRepositionUI();
}

function initBannerRepositionDrag() {
  const box = document.getElementById('repositionPreviewBox');
  if (!box || isRepositionDragInit) return;
  isRepositionDragInit = true;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startPosX = 50;
  let startPosY = 50;

  function onPointerDown(e) {
    if (!currentRepositionImage) return;
    isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clientX;
    startY = clientY;
    startPosX = currentRepositionX;
    startPosY = currentRepositionY;
    box.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    const rect = box.getBoundingClientRect();
    const factorX = (deltaX / (rect.width || 400)) * 100;
    const factorY = (deltaY / (rect.height || 180)) * 100;

    // Dragging down shifts image position up so upper content appears
    currentRepositionX = Math.max(0, Math.min(100, Math.round(startPosX - factorX)));
    currentRepositionY = Math.max(0, Math.min(100, Math.round(startPosY - factorY)));

    updateRepositionUI();
  }

  function onPointerUp() {
    if (isDragging) {
      isDragging = false;
      if (box) box.style.cursor = 'grab';
    }
  }

  box.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  box.addEventListener('touchstart', onPointerDown, { passive: false });
  window.addEventListener('touchmove', onPointerMove, { passive: false });
  window.addEventListener('touchend', onPointerUp);
}

async function saveCurrentReposition() {
  if (!editingRepositionBannerId) {
    showToastNotice('กรุณาเลือกแบนเนอร์ที่ต้องการบันทึก');
    return;
  }

  const payload = {
    positionX: currentRepositionX,
    positionY: currentRepositionY,
    zoom: currentRepositionZoom
  };

  try {
    const res = await fetch(`/api/banners/${editingRepositionBannerId}/position`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.heroBanners) {
        appData.heroBanners = data.heroBanners;
      } else {
        const b = (appData.heroBanners || []).find(i => i.id === editingRepositionBannerId);
        if (b) {
          b.positionX = currentRepositionX;
          b.positionY = currentRepositionY;
          b.zoom = currentRepositionZoom;
        }
      }
      persistLocal();
      renderHeroBanners();
      openHeroBannerModal(editingRepositionBannerId);
      showToast('บันทึกตำแหน่งภาพแบนเนอร์เรียบร้อย ✨');
      return;
    }
  } catch (err) {
    console.warn('API error saving banner position:', err);
  }

  // Fallback local save
  const b = (appData.heroBanners || []).find(i => i.id === editingRepositionBannerId);
  if (b) {
    b.positionX = currentRepositionX;
    b.positionY = currentRepositionY;
    b.zoom = currentRepositionZoom;
  }
  persistLocal();
  renderHeroBanners();
  openHeroBannerModal(editingRepositionBannerId);
  showToast('บันทึกตำแหน่งภาพแบนเนอร์เรียบร้อย ✨');
}

function openRepositionCurrentBanner() {
  const banners = appData.heroBanners || [];
  if (banners.length === 0) {
    showToastNotice('ยังไม่มีแบนเนอร์ กรุณาเพิ่มภาพแบนเนอร์ก่อนค่ะ');
    openHeroBannerModal();
    return;
  }
  const currentBanner = banners[heroBannerIndex] || banners[0];
  openHeroBannerModal(currentBanner.id);
  setTimeout(() => {
    const editor = document.getElementById('bannerPositionEditorSection');
    if (editor) {
      editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
}

function openHeroBannerModal(targetBannerId) {
  const modal = document.getElementById('heroBannerModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const container = document.getElementById('bannerListContainer');
  const banners = appData.heroBanners || [];

  if (banners.length === 0) {
    container.innerHTML = `<div class="text-xs text-purple-500 py-3 text-center">ยังไม่มีภาพแบนเนอร์ในระบบ สามารถเพิ่มใหม่ด้านล่างได้ค่ะ</div>`;
  } else {
    container.innerHTML = banners.map((b, idx) => {
      const isSelected = (editingRepositionBannerId ? editingRepositionBannerId === b.id : (targetBannerId ? targetBannerId === b.id : idx === 0));
      return `
        <div class="p-2.5 rounded-xl ${isSelected ? 'bg-purple-100/90 border-purple-400 shadow-xs ring-1 ring-purple-400/50' : 'bg-purple-50/80 border-purple-200/80'} border flex items-center justify-between gap-3 transition">
          <div class="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer" onclick="selectBannerToReposition('${b.id}')" title="คลิกเพื่อเลือกภาพนี้มาปรับตำแหน่ง">
            <img src="${escapeHtml(b.image)}" class="w-16 h-10 object-cover rounded-lg border border-purple-200 shrink-0" onerror="this.src='uploads/home-hero-banner.png'" style="object-position: ${b.positionX || 50}% ${b.positionY || 50}%;" />
            <div class="min-w-0">
              <h5 class="text-xs font-bold text-purple-950 truncate">${escapeHtml(b.title || `แบนเนอร์ที่ ${idx + 1}`)} ${isSelected ? '<span class="text-[9px] bg-purple-600 text-white px-1.5 py-0.2 rounded-full ml-1 font-bold">กำลังปรับ</span>' : ''}</h5>
              <p class="text-[10px] text-purple-600 truncate">ตำแหน่ง: X ${b.positionX ?? 50}% | Y ${b.positionY ?? 50}% ${b.zoom && b.zoom !== 100 ? `| ซูม ${b.zoom}%` : ''}</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="selectBannerToReposition('${b.id}')" class="px-2.5 py-1 rounded-lg ${isSelected ? 'bg-purple-600 text-white' : 'bg-purple-100 hover:bg-purple-200 text-purple-800'} text-[11px] font-bold transition flex items-center gap-1" title="เลื่อนปรับตำแหน่งภาพนี้">
              <span>✋</span>
              <span>ปรับภาพ</span>
            </button>
            <button type="button" onclick="deleteHeroBanner('${b.id}')" class="p-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs transition" title="ลบภาพแบนเนอร์นี้">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Clear inputs
  document.getElementById('bannerUrlInput').value = '';
  document.getElementById('bannerTitleInput').value = '';
  document.getElementById('bannerSubtitleInput').value = '';

  // Select banner in position editor
  const defaultBanner = (targetBannerId && banners.find(b => b.id === targetBannerId)) || (editingRepositionBannerId && banners.find(b => b.id === editingRepositionBannerId)) || banners[0];
  if (defaultBanner) {
    loadBannerIntoPositionEditor(defaultBanner);
  }
  initBannerRepositionDrag();
  lucide.createIcons();
}

function closeHeroBannerModal() {
  const modal = document.getElementById('heroBannerModal');
  if (modal) modal.classList.add('hidden');
}

async function handleBannerFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    showToast('กำลังอัปโหลดรูปภาพแบนเนอร์... ⏳');
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('bannerUrlInput').value = data.url;
      // Load new image directly into preview positioner
      currentRepositionImage = data.url;
      currentRepositionX = 50;
      currentRepositionY = 50;
      currentRepositionZoom = 100;
      updateRepositionUI();
      showToast('อัปโหลดภาพสำเร็จ! สามารถลากเลื่อนตำแหน่งตามต้องการได้เลย ✨');
    }
  } catch (err) {
    showToast('อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้งนะคะ');
  }
}

async function saveHeroBanner(e) {
  e.preventDefault();
  const image = document.getElementById('bannerUrlInput').value.trim();
  const title = document.getElementById('bannerTitleInput').value.trim();
  const subtitle = document.getElementById('bannerSubtitleInput').value.trim();

  if (!image) {
    showToast('กรุณาระบุ URL หรือเลือกไฟล์ภาพแบนเนอร์');
    return;
  }

  const payload = {
    image,
    title,
    subtitle,
    positionX: currentRepositionX,
    positionY: currentRepositionY,
    zoom: currentRepositionZoom
  };

  try {
    const res = await fetch('/api/banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const result = await res.json();
      appData.heroBanners = result.heroBanners;
      persistLocal();
      renderHeroBanners();
      const newBanner = appData.heroBanners[appData.heroBanners.length - 1];
      openHeroBannerModal(newBanner ? newBanner.id : undefined);
      showToast('บันทึกภาพแบนเนอร์เรียบร้อย ✨');
      return;
    }
  } catch (err) {}

  // Fallback
  appData.heroBanners = appData.heroBanners || [];
  const fallbackId = 'banner-' + Date.now();
  appData.heroBanners.push({ id: fallbackId, image, title, subtitle, positionX: currentRepositionX, positionY: currentRepositionY, zoom: currentRepositionZoom });
  persistLocal();
  renderHeroBanners();
  openHeroBannerModal(fallbackId);
  showToast('บันทึกภาพแบนเนอร์เรียบร้อย ✨');
}

async function deleteHeroBanner(id) {
  if (!confirm('ยืนยันที่จะลบภาพแบนเนอร์นี้หรือไม่?')) return;

  try {
    const res = await fetch(`/api/banners/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const result = await res.json();
      appData.heroBanners = result.heroBanners;
      persistLocal();
      renderHeroBanners();
      openHeroBannerModal();
      showToast('ลบภาพแบนเนอร์เรียบร้อย');
      return;
    }
  } catch (err) {}

  appData.heroBanners = (appData.heroBanners || []).filter(b => b.id !== id);
  persistLocal();
  renderHeroBanners();
  openHeroBannerModal();
  showToast('ลบภาพแบนเนอร์เรียบร้อย');
}

// ==================== ABOUT US SYSTEM ====================
function renderAboutSection() {
  const about = appData.aboutConfig || {
    title: 'เกี่ยวกับเรา',
    subtitle: 'ยินดีที่ได้รู้จักนะคะ ♡',
    description: `เราคือ Yuki Haru\nรับทำสกินมายคราฟ Custom Skins, HD 512, HD 128 ในสไตล์น่ารัก เรียบง่าย เน้นโทนสีละมุน เหมาะกับทุกคน\n\nขอบคุณที่สนับสนุนกันเสมอมา หวังว่าจะได้ร่วมงานกันอีกนะคะ ♡`,
    image: 'uploads/home-about-char.png',
    detailText: `ยินดีต้อนรับสู่ Yuki Haru (ゆき はる) ร้านรับออกแบบและผลิตคอมมิชชันสกินมายคราฟ คุณภาพสูง\n\nสร้างสรรค์ผลงานเอกลักษณ์เฉพาะตัว โทนละมุน คมชัด มีคุณภาพสูงสุดในราคามิตรภาพ มอบความสุขและรอยยิ้มให้กับทุกคน`
  };

  const titleEl = document.getElementById('homeAboutTitle');
  const subEl = document.getElementById('homeAboutSubtitle');
  const descEl = document.getElementById('homeAboutDescription');
  const imgEl = document.getElementById('homeAboutImage');
  const modalHeaderTitle = document.getElementById('aboutModalHeaderTitle');
  const modalDetailEl = document.getElementById('aboutModalDetailContainer');

  if (titleEl) titleEl.textContent = about.title || 'เกี่ยวกับเรา';
  if (subEl) subEl.textContent = about.subtitle || 'ยินดีที่ได้รู้จักนะคะ ♡';
  if (descEl) descEl.textContent = about.description || '';
  if (imgEl && about.image) imgEl.src = about.image;
  if (modalHeaderTitle) modalHeaderTitle.textContent = about.title || 'เกี่ยวกับ Yuki Haru';
  if (modalDetailEl) modalDetailEl.textContent = about.detailText || '';
}

function openEditAboutModal() {
  const about = appData.aboutConfig || {};
  document.getElementById('editAboutTitleInput').value = about.title || 'เกี่ยวกับเรา';
  document.getElementById('editAboutSubtitleInput').value = about.subtitle || 'ยินดีที่ได้รู้จักนะคะ ♡';
  document.getElementById('editAboutDescInput').value = about.description || `เราคือ Yuki Haru\nรับทำสกินมายคราฟ Custom Skins, HD 512, HD 128 ในสไตล์น่ารัก เรียบง่าย เน้นโทนสีละมุน เหมาะกับทุกคน\n\nขอบคุณที่สนับสนุนกันเสมอมา หวังว่าจะได้ร่วมงานกันอีกนะคะ ♡`;
  document.getElementById('editAboutImageInput').value = about.image || 'uploads/home-about-char.png';
  document.getElementById('editAboutDetailTextInput').value = about.detailText || `ยินดีต้อนรับสู่ Yuki Haru (ゆき はる) ร้านรับออกแบบและผลิตคอมมิชชันสกินมายคราฟ คุณภาพสูง\n\nสร้างสรรค์ผลงานเอกลักษณ์เฉพาะตัว โทนละมุน คมชัด มีคุณภาพสูงสุดในราคามิตรภาพ มอบความสุขและรอยยิ้มให้กับทุกคน`;

  document.getElementById('editAboutModal').classList.remove('hidden');
  lucide.createIcons();
}

function closeEditAboutModal() {
  document.getElementById('editAboutModal').classList.add('hidden');
}

async function handleAboutImageUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    showToast('กำลังอัปโหลดรูปภาพ... ⏳');
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('editAboutImageInput').value = data.url;
      showToast('อัปโหลดรูปภาพสำเร็จ! ✨');
    }
  } catch (err) {
    showToast('อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้งนะคะ');
  }
}

async function saveAboutConfig(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('editAboutTitleInput').value.trim() || 'เกี่ยวกับเรา',
    subtitle: document.getElementById('editAboutSubtitleInput').value.trim() || 'ยินดีที่ได้รู้จักนะคะ ♡',
    description: document.getElementById('editAboutDescInput').value.trim(),
    image: document.getElementById('editAboutImageInput').value.trim() || 'uploads/home-about-char.png',
    detailText: document.getElementById('editAboutDetailTextInput').value.trim()
  };

  try {
    const res = await fetch('/api/about', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const result = await res.json();
      appData.aboutConfig = result.aboutConfig;
      persistLocal();
      renderAboutSection();
      closeEditAboutModal();
      showToast('บันทึกข้อมูลเกี่ยวกับเราเรียบร้อย 💖');
      return;
    }
  } catch (err) {}

  appData.aboutConfig = payload;
  persistLocal();
  renderAboutSection();
  closeEditAboutModal();
  showToast('บันทึกข้อมูลเกี่ยวกับเราเรียบร้อย 💖');
}

function openAboutModal() {
  renderAboutSection();
  document.getElementById('aboutModal').classList.remove('hidden');
  const d = document.getElementById('aboutDiscordLinkText');
  if (d && appData.siteConfig) d.textContent = appData.siteConfig.discord || 'https://discord.gg/FyPfgC3Yj4';
  lucide.createIcons();
}

function closeAboutModal() {
  document.getElementById('aboutModal').classList.add('hidden');
}

// ==================== OUR SERVICES SYSTEM ====================
function renderServices() {
  const container = document.getElementById('homeServicesList');
  if (!container) return;

  const services = appData.services || [
    { id: 'srv-1', icon: '🎨', title: 'ตัวอย่างสกิน 64', description: 'ออกแบบสกินตามสไตล์ที่ต้องการ', targetCategory: 'ตัวอย่างสกิน 64' },
    { id: 'srv-2', icon: '✨', title: 'ตัวอย่างงานสกิน 512', description: 'สกินความละเอียดสูงพิเศษ ดีเทลประณีต', targetCategory: 'ตัวอย่างงานสกิน 512' },
    { id: 'srv-3', icon: '💎', title: 'ตัวอย่างงานสกิน 128', description: 'สกิน HD 128 คมชัดทุกมุมมอง', targetCategory: 'ตัวอย่างงานสกิน 128' }
  ];

  if (services.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-purple-400 text-xs">
        ยังไม่มีบริการในขณะนี้ คลิก "+ เพิ่มบริการ" เพื่อเพิ่มรายการได้ค่ะ
      </div>
    `;
    return;
  }

  container.innerHTML = services.map(srv => `
    <div class="service-item-pill p-3 px-3.5 flex items-center justify-between gap-3 group cursor-pointer hover:border-purple-400 hover:shadow-xs transition relative" onclick="handleServiceClick('${escapeHtml(srv.targetCategory || '')}')" title="คลิกเพื่อดูตัวอย่างงาน">
      <div class="flex items-center gap-3">
        <span class="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-sm group-hover:scale-110 transition-transform shadow-2xs">${escapeHtml(srv.icon || '❄️')}</span>
        <div>
          <h4 class="text-xs sm:text-sm font-bold text-purple-950 group-hover:text-purple-700 transition">${escapeHtml(srv.title)}</h4>
          <p class="text-[10px] text-purple-500">${escapeHtml(srv.description || '')}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1 text-purple-600 font-semibold text-xs group-hover:text-purple-800 shrink-0">
          <span class="text-[11px] font-medium">ดูตัวอย่าง</span>
          <span class="text-sm font-bold group-hover:translate-x-1 transition-transform">›</span>
        </div>
        <div class="admin-only flex items-center gap-1 ml-1" onclick="event.stopPropagation()">
          <button type="button" onclick="openEditServiceModal('${srv.id}')" class="p-1 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-700 text-[10px] transition" title="แก้ไขบริการ">✏️</button>
          <button type="button" onclick="deleteService('${srv.id}')" class="p-1 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] transition" title="ลบบริการ">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  updateModeUI();
}

function handleServiceClick(targetCategory) {
  if (!targetCategory || targetCategory === 'contact') {
    openContactModal();
  } else if (targetCategory === 'gallery') {
    switchPageTab('gallery');
  } else if (targetCategory === 'premade') {
    switchPageTab('premade');
  } else {
    filterCategoryAndOpenGallery(targetCategory);
  }
}

function setServiceEmoji(emoji) {
  const el = document.getElementById('serviceIconInput');
  if (el) el.value = emoji;
}

function openAddServiceModal() {
  document.getElementById('editServiceId').value = '';
  document.getElementById('serviceModalTitle').innerHTML = `<span>❄️</span><span>เพิ่มบริการใหม่</span>`;
  document.getElementById('serviceTitleInput').value = '';
  document.getElementById('serviceDescInput').value = '';
  document.getElementById('serviceIconInput').value = '❄️';
  document.getElementById('serviceTargetSelect').value = appData.categories[0] || 'ตัวอย่างสกิน 64';

  document.getElementById('serviceModal').classList.remove('hidden');
  lucide.createIcons();
}

function openEditServiceModal(id) {
  const services = appData.services || [];
  const srv = services.find(s => s.id === id);
  if (!srv) return;

  document.getElementById('editServiceId').value = srv.id;
  document.getElementById('serviceModalTitle').innerHTML = `<span>✏️</span><span>แก้ไขบริการ: ${escapeHtml(srv.title)}</span>`;
  document.getElementById('serviceTitleInput').value = srv.title || '';
  document.getElementById('serviceDescInput').value = srv.description || '';
  document.getElementById('serviceIconInput').value = srv.icon || '❄️';
  document.getElementById('serviceTargetSelect').value = srv.targetCategory || appData.categories[0] || 'ตัวอย่างสกิน 64';

  document.getElementById('serviceModal').classList.remove('hidden');
  lucide.createIcons();
}

function closeServiceModal() {
  document.getElementById('serviceModal').classList.add('hidden');
}

async function saveService(e) {
  e.preventDefault();
  const id = document.getElementById('editServiceId').value.trim();
  const title = document.getElementById('serviceTitleInput').value.trim();
  const description = document.getElementById('serviceDescInput').value.trim();
  const icon = document.getElementById('serviceIconInput').value.trim() || '❄️';
  const targetCategory = document.getElementById('serviceTargetSelect').value;

  if (!title) {
    showToast('กรุณาระบุชื่อบริการ');
    return;
  }

  const payload = { id, title, description, icon, targetCategory };

  try {
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const result = await res.json();
      appData.services = result.services;
      persistLocal();
      renderServices();
      closeServiceModal();
      showToast('บันทึกบริการเรียบร้อย ✨');
      return;
    }
  } catch (err) {}

  // Fallback
  appData.services = appData.services || [];
  if (id) {
    const idx = appData.services.findIndex(s => s.id === id);
    if (idx !== -1) {
      appData.services[idx] = { ...appData.services[idx], ...payload };
    }
  } else {
    appData.services.push({ ...payload, id: 'srv-' + Date.now() });
  }
  persistLocal();
  renderServices();
  closeServiceModal();
  showToast('บันทึกบริการเรียบร้อย ✨');
}

async function deleteService(id) {
  if (!confirm('ยืนยันที่จะลบบริการนี้หรือไม่?')) return;

  try {
    const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const result = await res.json();
      appData.services = result.services;
      persistLocal();
      renderServices();
      showToast('ลบบริการเรียบร้อย');
      return;
    }
  } catch (err) {}

  appData.services = (appData.services || []).filter(s => s.id !== id);
  persistLocal();
  renderServices();
  showToast('ลบบริการเรียบร้อย');
}

// ==================== ANNOUNCEMENTS SYSTEM ====================
function renderAnnouncements() {
  const container = document.getElementById('announcementsList');
  if (!container) return;

  const list = appData.announcements || [];
  if (list.length === 0) {
    container.innerHTML = `
      <div class="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/60 text-center text-xs text-purple-600">
        <span class="text-sm">❄️</span>
        <div class="mt-1 font-medium">ยังไม่มีข้อความประกาศในขณะนี้</div>
        <button onclick="openAnnouncementModal()" class="admin-only mt-2 text-[11px] font-bold text-purple-700 hover:underline">
          + คลิกที่นี่เพื่อพิมพ์ข้อความประกาศ
        </button>
      </div>
    `;
    updateModeUI();
    return;
  }

  container.innerHTML = list.map(item => `
    <div class="announcement-card p-3 flex flex-col gap-1.5 relative group">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-bold text-purple-950 flex items-center gap-1.5">
          <span class="text-purple-500">✦</span>
          <span>${escapeHtml(item.title || 'ประกาศจากร้าน')}</span>
        </span>
        <span class="text-[10px] text-purple-500 bg-purple-100/70 px-2 py-0.5 rounded-full font-medium shrink-0">
          ${escapeHtml(item.date || '')}
        </span>
      </div>
      <p class="text-[11px] text-purple-900 leading-relaxed break-words whitespace-pre-line">
        ${escapeHtml(item.content || '')}
      </p>
      <div class="admin-only flex items-center justify-end gap-2 pt-1 border-t border-purple-100/60 text-[10px] text-purple-500">
        <button onclick="openAnnouncementModal('${item.id}')" class="hover:text-purple-800 hover:underline flex items-center gap-0.5" title="แก้ไขข้อความประกาศนี้">
          <i data-lucide="edit-2" class="w-2.5 h-2.5"></i>
          <span>แก้ไข</span>
        </button>
        <span>•</span>
        <button onclick="deleteAnnouncement('${item.id}')" class="text-rose-500 hover:text-rose-700 hover:underline flex items-center gap-0.5" title="ลบประกาศนี้">
          <i data-lucide="trash-2" class="w-2.5 h-2.5"></i>
          <span>ลบ</span>
        </button>
      </div>
    </div>
  `).join('');

  lucide.createIcons();
  updateModeUI();
}

function openAnnouncementModal(id = null) {
  const modal = document.getElementById('announcementModal');
  const titleInput = document.getElementById('announcementTitleInput');
  const dateInput = document.getElementById('announcementDateInput');
  const contentInput = document.getElementById('announcementContentInput');
  const editIdInput = document.getElementById('editAnnouncementId');
  const modalTitle = document.getElementById('announcementModalTitle');

  if (id) {
    const list = appData.announcements || [];
    const item = list.find(a => a.id === id);
    if (item) {
      editIdInput.value = item.id;
      titleInput.value = item.title || '';
      dateInput.value = item.date || '';
      contentInput.value = item.content || '';
      modalTitle.innerHTML = `<span>📢</span><span>แก้ไขข้อความประกาศ</span>`;
    }
  } else {
    editIdInput.value = '';
    titleInput.value = '';
    const now = new Date();
    const thaiDate = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    dateInput.value = thaiDate;
    contentInput.value = '';
    modalTitle.innerHTML = `<span>📢</span><span>พิมพ์ข้อความประกาศใหม่</span>`;
  }

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeAnnouncementModal() {
  document.getElementById('announcementModal').classList.add('hidden');
}

async function saveAnnouncement(event) {
  event.preventDefault();

  const id = document.getElementById('editAnnouncementId').value;
  const title = document.getElementById('announcementTitleInput').value.trim();
  let date = document.getElementById('announcementDateInput').value.trim();
  const content = document.getElementById('announcementContentInput').value.trim();

  if (!content) {
    showToast('กรุณากรอกเนื้อหาประกาศ');
    return;
  }

  if (!date) {
    const now = new Date();
    date = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const payload = {
    id: id || undefined,
    title: title || 'ประกาศจากร้าน',
    content: content,
    date: date
  };

  try {
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const result = await res.json();
      appData.announcements = result.announcements;
      persistLocal();
      renderAnnouncements();
      closeAnnouncementModal();
      showToast('บันทึกประกาศเรียบร้อยแล้ว ✨');
      return;
    }
  } catch (err) {
    console.warn('API error, saving announcement locally', err);
  }

  // Local fallback
  appData.announcements = appData.announcements || [];
  if (id) {
    const idx = appData.announcements.findIndex(a => a.id === id);
    if (idx !== -1) {
      appData.announcements[idx] = { ...appData.announcements[idx], title, content, date };
    }
  } else {
    appData.announcements.unshift({
      id: 'ann-' + Date.now(),
      title: title || 'ประกาศจากร้าน',
      content: content,
      date: date
    });
  }
  persistLocal();
  renderAnnouncements();
  closeAnnouncementModal();
  showToast('บันทึกประกาศเรียบร้อยแล้ว ✨');
}

async function deleteAnnouncement(id) {
  if (!confirm('ต้องการลบข้อความประกาศนี้ใช่หรือไม่?')) return;

  try {
    const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const result = await res.json();
      appData.announcements = result.announcements;
      persistLocal();
      renderAnnouncements();
      showToast('ลบประกาศแล้ว');
      return;
    }
  } catch (e) {
    console.warn('API delete error, deleting locally', e);
  }

  appData.announcements = (appData.announcements || []).filter(a => a.id !== id);
  persistLocal();
  renderAnnouncements();
  showToast('ลบประกาศแล้ว');
}

// Category Default Pricing Management
function getPricesForCategory(category) {
  if (!category) category = appData.categories[0] || 'ตัวอย่างสกิน 64';

  // 1. Check server-stored categoryPrices in appData
  if (appData.categoryPrices && appData.categoryPrices[category]) {
    const cp = appData.categoryPrices[category];
    return {
      priceHead: cp.priceHead || '70฿',
      priceBody: cp.priceBody || '150-250฿',
      priceFull: cp.priceFull || cp.price || '195-240฿'
    };
  }

  // 2. Check localStorage cache
  try {
    const local = JSON.parse(localStorage.getItem('yuki_category_prices') || '{}');
    if (local[category]) {
      return local[category];
    }
  } catch(e) {}

  // 3. Check existing items in this category
  if (appData.items && appData.items.length > 0) {
    const matchingItem = appData.items.find(i => i.category === category && (i.priceHead || i.priceFull));
    if (matchingItem) {
      return {
        priceHead: matchingItem.priceHead || '70฿',
        priceBody: matchingItem.priceBody || '150-250฿',
        priceFull: matchingItem.priceFull || matchingItem.price || '195-240฿'
      };
    }
  }

  // 4. Smart fallbacks based on category naming
  const catLower = category.toLowerCase();
  if (catLower.includes('64')) {
    return { priceHead: '35 บาท', priceBody: '50 บาท', priceFull: '75 บาท' };
  } else if (catLower.includes('128')) {
    return { priceHead: '50 บาท', priceBody: '75 บาท', priceFull: '110 บาท' };
  } else if (catLower.includes('1024')) {
    return { priceHead: '150 บาท', priceBody: '250 บาทขึ้นไป', priceFull: '350 บาทขึ้นไป' };
  } else if (catLower.includes('512')) {
    return { priceHead: '100 บาท', priceBody: '180 บาทขึ้นไป', priceFull: '260 บาทขึ้นไป' };
  } else if (catLower.includes('สำเร็จ') || catLower.includes('premade')) {
    return { priceHead: '50 บาท', priceBody: '120 บาท', priceFull: '150 บาท' };
  }

  return { priceHead: '35 บาท', priceBody: '50 บาท', priceFull: '75 บาท' };
}

function applyCategoryPricesToModal(category) {
  const prices = getPricesForCategory(category);
  const headInput = document.getElementById('priceHeadInput');
  const bodyInput = document.getElementById('priceBodyInput');
  const fullInput = document.getElementById('priceFullInput');
  if (headInput) headInput.value = prices.priceHead;
  if (bodyInput) bodyInput.value = prices.priceBody;
  if (fullInput) fullInput.value = prices.priceFull;

  const notice = document.getElementById('categoryPriceAutoNotice');
  if (notice) {
    notice.textContent = `• ดึงราคาเริ่มต้นของหมวด "${category}" เรียบร้อย`;
  }
}

function saveCategoryPricesLocalAndServer(category, prices) {
  if (!category) return;
  if (!appData.categoryPrices) appData.categoryPrices = {};
  appData.categoryPrices[category] = prices;

  // Propagate to all items in this category immediately
  if (Array.isArray(appData.items)) {
    appData.items.forEach(it => {
      if (it.category === category) {
        it.priceHead = prices.priceHead;
        it.priceBody = prices.priceBody;
        it.priceFull = prices.priceFull;
        it.price = prices.priceFull;
      }
    });
  }

  try {
    const local = JSON.parse(localStorage.getItem('yuki_category_prices') || '{}');
    local[category] = prices;
    localStorage.setItem('yuki_category_prices', JSON.stringify(local));
  } catch(e) {}

  fetch('/api/category-prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, ...prices })
  }).catch(e => console.warn('Could not sync category prices to server:', e));

  renderRightPricing();
}

// Category Default Cover Image Management
function getCoverForCategory(category) {
  if (!category) category = appData.categories[0] || 'ตัวอย่างสกิน 64';

  // 1. Check server-stored categoryCovers in appData
  if (appData.categoryCovers && appData.categoryCovers[category]) {
    return appData.categoryCovers[category];
  }

  // 2. Check localStorage cache
  try {
    const local = JSON.parse(localStorage.getItem('yuki_category_covers') || '{}');
    if (local[category]) {
      return local[category];
    }
  } catch(e) {}

  // 3. Check existing items in this category that have headerImage
  if (appData.items && appData.items.length > 0) {
    const matchingItem = appData.items.find(i => i.category === category && i.headerImage);
    if (matchingItem && matchingItem.headerImage) {
      return matchingItem.headerImage;
    }
  }

  return '';
}

function applyCategoryCoverToModal(category) {
  const coverUrl = getCoverForCategory(category);
  const headerInput = document.getElementById('itemHeaderUrlInput');
  const headerContainer = document.getElementById('headerPreviewContainer');
  const headerImg = document.getElementById('headerPreviewImg');
  const headerName = document.getElementById('headerPreviewName');

  if (coverUrl) {
    selectedHeaderFile = null;
    if (headerInput) headerInput.value = coverUrl;
    if (headerContainer) headerContainer.classList.remove('hidden');
    if (headerImg) headerImg.src = coverUrl;
    if (headerName) headerName.textContent = coverUrl.split('/').pop() + ' (ปกหมวดอัตโนมัติ)';
  } else {
    clearSelectedHeader();
  }
}

function saveCategoryCoverLocalAndServer(category, coverUrl) {
  if (!category || !coverUrl) return;
  if (!appData.categoryCovers) appData.categoryCovers = {};
  appData.categoryCovers[category] = coverUrl;

  try {
    const local = JSON.parse(localStorage.getItem('yuki_category_covers') || '{}');
    local[category] = coverUrl;
    localStorage.setItem('yuki_category_covers', JSON.stringify(local));
  } catch(e) {}

  fetch('/api/category-covers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, coverUrl })
  }).catch(e => console.warn('Could not sync category cover to server:', e));
}

function saveCurrentCoverForCategory() {
  const select = document.getElementById('itemCategorySelect');
  const category = select ? select.value : (currentCategory !== 'ALL' ? currentCategory : (appData.categories[0] || 'ตัวอย่างสกิน 64'));
  const headerInput = document.getElementById('itemHeaderUrlInput');
  const headerImg = document.getElementById('headerPreviewImg');
  const coverUrl = (headerInput?.value || headerImg?.src || '').trim();

  if (!coverUrl && !selectedHeaderFile) {
    showToastNotice('กรุณาเลือกหรืออัปโหลดภาพหน้าปกก่อนบันทึก');
    return;
  }

  if (coverUrl && !coverUrl.startsWith('data:')) {
    saveCategoryCoverLocalAndServer(category, coverUrl);
    showToastNotice(`💾 จำภาพปกสำหรับหมวด "${category}" เรียบร้อยแล้ว!`);
  } else {
    showToastNotice('กด "บันทึกผลงาน" ระบบจะจำภาพปกนี้ของหมวดให้อัตโนมัติค่ะ ✨');
  }
}

function resetCoverToCategoryDefault() {
  const select = document.getElementById('itemCategorySelect');
  const category = select ? select.value : (currentCategory !== 'ALL' ? currentCategory : (appData.categories[0] || 'ตัวอย่างสกิน 64'));
  applyCategoryCoverToModal(category);
  showToastNotice(`🔄 ดึงภาพปกของหมวด "${category}" แล้ว`);
}

function onModalCategoryChange() {
  const select = document.getElementById('itemCategorySelect');
  if (!select) return;
  const category = select.value;
  applyCategoryPricesToModal(category);
  if (!selectedHeaderFile) {
    applyCategoryCoverToModal(category);
  }
}

function saveCurrentPricesForCategory() {
  const select = document.getElementById('itemCategorySelect');
  const category = select ? select.value : (currentCategory !== 'ALL' ? currentCategory : (appData.categories[0] || 'ตัวอย่างสกิน 64'));
  const priceHead = (document.getElementById('priceHeadInput')?.value || '').trim();
  const priceBody = (document.getElementById('priceBodyInput')?.value || '').trim();
  const priceFull = (document.getElementById('priceFullInput')?.value || '').trim();

  if (!priceHead && !priceBody && !priceFull) {
    showToastNotice('กรุณากรอกราคาก่อนบันทึก');
    return;
  }

  const prices = {
    priceHead: priceHead || '70฿',
    priceBody: priceBody || '150-250฿',
    priceFull: priceFull || '195-240฿'
  };

  saveCategoryPricesLocalAndServer(category, prices);
  renderAll();
  showToastNotice(`💾 อัปเดตราคาให้ทุกงานในหมวด "${category}" แล้ว! ✨`);
}

function resetPricesToCategoryDefault() {
  const select = document.getElementById('itemCategorySelect');
  const category = select ? select.value : (currentCategory !== 'ALL' ? currentCategory : (appData.categories[0] || 'ตัวอย่างสกิน 64'));
  applyCategoryPricesToModal(category);
  showToastNotice(`🔄 ดึงราคาของหมวด "${category}" แล้ว`);
}

// Add Item Modal
function openAddModal() {
  document.getElementById('modalTitle').innerHTML = `<span>❄️</span><span>เพิ่มตัวอย่างงานใหม่</span>`;
  document.getElementById('editItemId').value = '';
  document.getElementById('itemTitleInput').value = '';
  document.getElementById('itemUrlInput').value = '';
  document.getElementById('itemDescInput').value = '';
  document.getElementById('itemFileInput').value = '';
  document.getElementById('imagePreviewContainer').classList.add('hidden');
  selectedFile = null;

  clearSelectedModel();
  clearSelectedVideo();
  setHasVideoToggle(false);

  const targetCategory = (currentCategory !== 'ALL' && currentCategory) ? currentCategory : (appData.categories[0] || 'ตัวอย่างสกิน 64');
  if (appData.categories.length > 0) {
    document.getElementById('itemCategorySelect').value = targetCategory;
  }
  applyCategoryPricesToModal(targetCategory);
  applyCategoryCoverToModal(targetCategory);

  const licenseSelect = document.getElementById('itemLicenseSelect');
  if (licenseSelect) licenseSelect.value = 'exclusive';
  const modelTypeSelect = document.getElementById('itemModelTypeSelect');
  if (modelTypeSelect) modelTypeSelect.value = 'slim';

  const resInput = document.getElementById('itemResolutionInput');
  if (resInput) resInput.value = '64x64 HD Standard';
  const editionInput = document.getElementById('itemEditionInput');
  if (editionInput) editionInput.value = 'Java & Bedrock Edition';
  const incInput = document.getElementById('itemIncludedInput');
  if (incInput) incInput.value = 'ไฟล์ .PNG คมชัด • ดาวน์โหลดทันที';
  const licTextInput = document.getElementById('itemLicenseTextInput');
  if (licTextInput) licTextInput.value = '👑 ซื้อคนเดียว (สิทธิ์ขาด 1 คนเท่านั้น)';
  const prcNoteInput = document.getElementById('itemPriceNoteInput');
  if (prcNoteInput) prcNoteInput.value = 'ซื้อครั้งเดียว สิทธิ์ขาด ลายไม่ซ้ำใคร (1 คนเท่านั้น)';

  document.getElementById('itemModal').classList.remove('hidden');
  lucide.createIcons();
}

function openEditActiveModal(customItem) {
  let item = customItem;
  if (!item && activeItemId) {
    item = (appData.items || []).find(i => i.id === activeItemId);
  }
  if (!item) {
    item = getActiveItem();
  }
  if (!item) return;

  const isPremade = item.isPremade || item.category === 'สกินสำเร็จ';
  document.getElementById('modalTitle').innerHTML = isPremade ? `<span>✏️</span><span>แก้ไขสกินสำเร็จรูป</span>` : `<span>❄️</span><span>แก้ไขตัวอย่างงาน</span>`;
  document.getElementById('editItemId').value = item.id;
  document.getElementById('itemTitleInput').value = item.title || '';

  const catSelect = document.getElementById('itemCategorySelect');
  if (catSelect) {
    if (isPremade && !Array.from(catSelect.options).some(o => o.value === 'สกินสำเร็จ')) {
      const opt = document.createElement('option');
      opt.value = 'สกินสำเร็จ';
      opt.textContent = 'สกินสำเร็จ';
      catSelect.appendChild(opt);
    }
    catSelect.value = item.category || (isPremade ? 'สกินสำเร็จ' : appData.categories[0]);
  }

  const catDefaultPrices = getPricesForCategory(item.category || appData.categories[0]);
  document.getElementById('priceHeadInput').value = item.priceHead || catDefaultPrices.priceHead || '70฿';
  document.getElementById('priceBodyInput').value = item.priceBody || catDefaultPrices.priceBody || '150-250฿';
  document.getElementById('priceFullInput').value = item.priceFull || item.price || catDefaultPrices.priceFull || '195-240฿';
  document.getElementById('itemDescInput').value = item.description || '';
  document.getElementById('itemUrlInput').value = item.image && !item.image.startsWith('data:') ? item.image : '';
  document.getElementById('itemFileInput').value = '';
  selectedFile = null;

  const licenseSelect = document.getElementById('itemLicenseSelect');
  if (licenseSelect) licenseSelect.value = item.licenseType || 'exclusive';
  const editModelTypeSelect = document.getElementById('itemModelTypeSelect');
  if (editModelTypeSelect) editModelTypeSelect.value = (item.modelType === 'classic' || item.modelType === 'steve' || item.modelType === 'default') ? 'classic' : 'slim';

  const editResInput = document.getElementById('itemResolutionInput');
  if (editResInput) editResInput.value = item.resolution || '';
  const editEditionInput = document.getElementById('itemEditionInput');
  if (editEditionInput) editEditionInput.value = item.edition || '';
  const editIncInput = document.getElementById('itemIncludedInput');
  if (editIncInput) editIncInput.value = item.included || '';
  const editLicTextInput = document.getElementById('itemLicenseTextInput');
  if (editLicTextInput) editLicTextInput.value = item.licenseText || '';
  const editPrcNoteInput = document.getElementById('itemPriceNoteInput');
  if (editPrcNoteInput) editPrcNoteInput.value = item.priceNote || '';

  if (item.image) {
    document.getElementById('imagePreview').src = item.image;
    document.getElementById('previewFileName').textContent = 'รูปภาพปัจจุบัน';
    document.getElementById('imagePreviewContainer').classList.remove('hidden');
  } else {
    document.getElementById('imagePreviewContainer').classList.add('hidden');
  }

  clearSelectedHeader();
  const effectiveHeader = item.headerImage || (!isPremade ? getCoverForCategory(item.category) : '');
  if (effectiveHeader) {
    const headerInput = document.getElementById('itemHeaderUrlInput');
    const headerBadge = document.getElementById('headerPreviewContainer');
    const headerImg = document.getElementById('headerPreviewImg');
    const headerName = document.getElementById('headerPreviewName');
    if (headerInput) headerInput.value = effectiveHeader;
    if (headerBadge) headerBadge.classList.remove('hidden');
    if (headerImg) headerImg.src = effectiveHeader;
    if (headerName) headerName.textContent = effectiveHeader.split('/').pop() + (item.headerImage ? '' : ' (ปกหมวดอัตโนมัติ)');
  }

  clearSelectedModel();
  if (item.modelUrl) {
    const modelInput = document.getElementById('itemModelUrlInput');
    const modelBadge = document.getElementById('modelPreviewContainer');
    const modelName = document.getElementById('modelPreviewFileName');
    if (modelInput) modelInput.value = item.modelUrl;
    if (modelBadge) modelBadge.classList.remove('hidden');
    if (modelName) modelName.textContent = item.modelUrl.split('/').pop();
  }

  clearSelectedVideo();
  if (item.videoUrl) {
    setHasVideoToggle(true);
    const videoInput = document.getElementById('itemVideoUrlInput');
    const videoBadge = document.getElementById('videoPreviewContainer');
    const videoName = document.getElementById('videoPreviewFileName');
    const previewPlayer = document.getElementById('videoModalPreviewPlayer');
    if (videoInput) videoInput.value = item.videoUrl;
    if (videoBadge) videoBadge.classList.remove('hidden');
    if (videoName) videoName.textContent = item.videoUrl.split('/').pop();
    if (previewPlayer) {
      previewPlayer.src = item.videoUrl;
      previewPlayer.load();
    }
  } else {
    setHasVideoToggle(false);
  }

  document.getElementById('itemModal').classList.remove('hidden');
  lucide.createIcons();
}

function closeItemModal() {
  document.getElementById('itemModal').classList.add('hidden');
  const previewPlayer = document.getElementById('videoModalPreviewPlayer');
  if (previewPlayer) {
    previewPlayer.pause();
    previewPlayer.removeAttribute('src');
    previewPlayer.load();
  }
}

function applySelectedSkinFile(file) {
  if (!file) return;
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (event) => {
    const preview = document.getElementById('imagePreview');
    const nameEl = document.getElementById('previewFileName');
    const container = document.getElementById('imagePreviewContainer');
    if (preview) preview.src = event.target.result;
    if (nameEl) nameEl.textContent = file.name;
    if (container) container.classList.remove('hidden');
    showToastNotice(`✓ เลือกไฟล์สกิน: ${file.name}`);
  };
  reader.readAsDataURL(file);
}

function handleFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (file) applySelectedSkinFile(file);
}

function handleUrlInput(url) {
  if (url && (url.startsWith('http') || url.startsWith('/uploads/') || url.startsWith('data:'))) {
    selectedFile = null;
    const preview = document.getElementById('imagePreview');
    if (preview) preview.src = url;
    const nameEl = document.getElementById('previewFileName');
    if (nameEl) nameEl.textContent = url.split('/').pop() || 'รูปจาก URL';
    const container = document.getElementById('imagePreviewContainer');
    if (container) container.classList.remove('hidden');
  }
}

function applySelectedHeaderFile(file) {
  if (!file) return;
  selectedHeaderFile = file;
  const reader = new FileReader();
  reader.onload = (event) => {
    const container = document.getElementById('headerPreviewContainer');
    const img = document.getElementById('headerPreviewImg');
    const nameEl = document.getElementById('headerPreviewName');
    if (container) container.classList.remove('hidden');
    if (img) img.src = event.target.result;
    if (nameEl) nameEl.textContent = file.name;
    showToastNotice(`✓ เลือกภาพหัวข้อ/ปก: ${file.name}`);
  };
  reader.readAsDataURL(file);
}

function handleHeaderFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (file) applySelectedHeaderFile(file);
}

function clearSelectedHeader() {
  selectedHeaderFile = null;
  const input = document.getElementById('itemHeaderFileInput');
  if (input) input.value = '';
  const urlInput = document.getElementById('itemHeaderUrlInput');
  if (urlInput) urlInput.value = '';
  const container = document.getElementById('headerPreviewContainer');
  if (container) container.classList.add('hidden');
}

function applySelectedModelFile(file) {
  if (!file) return;
  selectedModelFile = file;
  const container = document.getElementById('modelPreviewContainer');
  const nameEl = document.getElementById('modelPreviewFileName');
  if (container) container.classList.remove('hidden');
  if (nameEl) nameEl.textContent = file.name;
  showToastNotice(`✓ เลือกโมเดล 3D: ${file.name}`);
}

function handleModelFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (file) applySelectedModelFile(file);
}

function clearSelectedModel() {
  selectedModelFile = null;
  const input = document.getElementById('itemModelFileInput');
  if (input) input.value = '';
  const urlInput = document.getElementById('itemModelUrlInput');
  if (urlInput) urlInput.value = '';
  const container = document.getElementById('modelPreviewContainer');
  if (container) container.classList.add('hidden');
}

function setHasVideoToggle(hasVideo) {
  hasVideoToggleState = Boolean(hasVideo);
  const btnNo = document.getElementById('btnToggleVideoNo');
  const btnYes = document.getElementById('btnToggleVideoYes');
  const videoGroup = document.getElementById('videoFieldsGroup');

  if (hasVideoToggleState) {
    if (btnYes) btnYes.className = 'py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-purple-600 text-white shadow-xs';
    if (btnNo) btnNo.className = 'py-1.5 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 text-purple-700 hover:bg-purple-100/60';
    if (videoGroup) videoGroup.classList.remove('hidden');
  } else {
    if (btnNo) btnNo.className = 'py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 bg-purple-600 text-white shadow-xs';
    if (btnYes) btnYes.className = 'py-1.5 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 text-purple-700 hover:bg-purple-100/60';
    if (videoGroup) videoGroup.classList.add('hidden');
  }
}

function applySelectedVideoFile(file) {
  if (!file) return;
  selectedVideoFile = file;
  setHasVideoToggle(true);
  const container = document.getElementById('videoPreviewContainer');
  const nameEl = document.getElementById('videoPreviewFileName');
  const previewPlayer = document.getElementById('videoModalPreviewPlayer');
  if (container) container.classList.remove('hidden');
  if (nameEl) nameEl.textContent = file.name;
  if (previewPlayer) {
    try {
      const blobUrl = URL.createObjectURL(file);
      previewPlayer.src = blobUrl;
      previewPlayer.load();
    } catch(e) {}
  }
  showToastNotice(`✓ เลือกวิดีโอตัวอย่าง: ${file.name}`);
}

function handleVideoFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (file) applySelectedVideoFile(file);
}

function clearSelectedVideo() {
  selectedVideoFile = null;
  const input = document.getElementById('itemVideoFileInput');
  if (input) input.value = '';
  const urlInput = document.getElementById('itemVideoUrlInput');
  if (urlInput) urlInput.value = '';
  const container = document.getElementById('videoPreviewContainer');
  if (container) container.classList.add('hidden');
  const previewPlayer = document.getElementById('videoModalPreviewPlayer');
  if (previewPlayer) {
    previewPlayer.pause();
    previewPlayer.removeAttribute('src');
    previewPlayer.load();
  }
}

// ==================== DRAG & DROP HANDLERS FOR CREATION MODAL ====================
function initDragAndDropHandlers() {
  const modal = document.getElementById('itemModal');
  if (!modal) return;

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    window.addEventListener(evt, preventDefaults, false);
    modal.addEventListener(evt, preventDefaults, false);
  });

  const dropzones = [
    { el: document.getElementById('dropzoneHeader'), type: 'header' },
    { el: document.getElementById('dropzoneSkin'), type: 'skin' },
    { el: document.getElementById('dropzoneModel'), type: 'model' },
    { el: document.getElementById('dropzoneVideo'), type: 'video' }
  ];

  dropzones.forEach(({ el, type }) => {
    if (!el) return;

    el.addEventListener('dragover', () => {
      el.classList.add('border-purple-600', 'bg-purple-100/80', 'scale-[1.01]', 'shadow-sm');
    });

    ['dragleave', 'drop'].forEach(evt => {
      el.addEventListener(evt, () => {
        el.classList.remove('border-purple-600', 'bg-purple-100/80', 'scale-[1.01]', 'shadow-sm');
      });
    });

    el.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;

      if (type === 'header') {
        applySelectedHeaderFile(file);
      } else if (type === 'skin') {
        applySelectedSkinFile(file);
      } else if (type === 'model') {
        applySelectedModelFile(file);
      } else if (type === 'video') {
        applySelectedVideoFile(file);
      }
    });
  });

  // Modal-wide smart drop: automatically route based on file format
  modal.addEventListener('drop', (e) => {
    if (e.target && e.target.closest && e.target.closest('.dropzone-box')) {
      return; // Handled by specific dropzone
    }

    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.bbmodel') || lowerName.endsWith('.glb') || lowerName.endsWith('.gltf') || lowerName.endsWith('.obj')) {
      applySelectedModelFile(file);
    } else if (lowerName.endsWith('.mp4') || lowerName.endsWith('.webm') || lowerName.endsWith('.mov') || file.type.startsWith('video/')) {
      applySelectedVideoFile(file);
    } else if (file.type.startsWith('image/')) {
      if (!selectedFile) {
        applySelectedSkinFile(file);
      } else {
        applySelectedHeaderFile(file);
      }
    }
  });
}

async function handleItemSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editItemId').value;
  const title = document.getElementById('itemTitleInput').value.trim();
  const category = document.getElementById('itemCategorySelect').value;
  const priceHead = document.getElementById('priceHeadInput').value.trim();
  const priceBody = document.getElementById('priceBodyInput').value.trim();
  const priceFull = document.getElementById('priceFullInput').value.trim();
  const description = document.getElementById('itemDescInput').value.trim();
  const imageUrl = document.getElementById('itemUrlInput').value.trim();
  const headerUrl = document.getElementById('itemHeaderUrlInput') ? document.getElementById('itemHeaderUrlInput').value.trim() : '';
  const modelUrl = document.getElementById('itemModelUrlInput') ? document.getElementById('itemModelUrlInput').value.trim() : '';
  const videoUrl = document.getElementById('itemVideoUrlInput') ? document.getElementById('itemVideoUrlInput').value.trim() : '';
  const licenseType = document.getElementById('itemLicenseSelect') ? document.getElementById('itemLicenseSelect').value : 'exclusive';
  const modelType = document.getElementById('itemModelTypeSelect') ? document.getElementById('itemModelTypeSelect').value : 'slim';
  const resolution = document.getElementById('itemResolutionInput') ? document.getElementById('itemResolutionInput').value.trim() : '';
  const edition = document.getElementById('itemEditionInput') ? document.getElementById('itemEditionInput').value.trim() : '';
  const included = document.getElementById('itemIncludedInput') ? document.getElementById('itemIncludedInput').value.trim() : '';
  const licenseText = document.getElementById('itemLicenseTextInput') ? document.getElementById('itemLicenseTextInput').value.trim() : '';
  const priceNote = document.getElementById('itemPriceNoteInput') ? document.getElementById('itemPriceNoteInput').value.trim() : '';
  const armType = (modelType === 'classic') ? 'Classic 4px (Steve)' : 'Slim 3px (Alex)';

  const formData = new FormData();
  formData.append('title', title);
  formData.append('category', category);
  formData.append('licenseType', licenseType);
  formData.append('modelType', modelType);
  formData.append('price', priceFull);
  formData.append('priceHead', priceHead);
  formData.append('priceBody', priceBody);
  formData.append('priceFull', priceFull);
  formData.append('description', description);
  if (resolution) formData.append('resolution', resolution);
  if (edition) formData.append('edition', edition);
  if (included) formData.append('included', included);
  if (licenseText) formData.append('licenseText', licenseText);
  if (priceNote) formData.append('priceNote', priceNote);
  formData.append('armType', armType);
  if (imageUrl) formData.append('imageUrl', imageUrl);
  if (headerUrl) formData.append('headerUrl', headerUrl);
  if (modelUrl) formData.append('modelUrl', modelUrl);
  if (videoUrl) formData.append('videoUrl', videoUrl);

  if (selectedFile) formData.append('imageFile', selectedFile);
  if (selectedHeaderFile) formData.append('headerFile', selectedHeaderFile);
  if (selectedModelFile) formData.append('modelFile', selectedModelFile);
  if (selectedVideoFile) formData.append('videoFile', selectedVideoFile);

  // Automatically remember and persist prices for this category
  if (category && (priceHead || priceBody || priceFull)) {
    saveCategoryPricesLocalAndServer(category, {
      priceHead: priceHead || '70฿',
      priceBody: priceBody || '150-250฿',
      priceFull: priceFull || '195-240฿'
    });
  }

  // Automatically remember and persist cover image for this category
  if (category && headerUrl && !headerUrl.startsWith('data:')) {
    saveCategoryCoverLocalAndServer(category, headerUrl);
  }

  try {
    let res;
    if (id) {
      res = await fetch(`/api/items/${id}`, { method: 'PUT', body: formData });
    } else {
      res = await fetch('/api/items', { method: 'POST', body: formData });
    }

    if (res.ok) {
      const data = await res.json();
      await loadData();
      if (data && data.item) {
        if (data.item.isPremade || data.item.category === 'สกินสำเร็จ') {
          activePremadeId = data.item.id;
          renderPremadeCards();
          showPremadeDetail(data.item.id);
        } else {
          activeItemId = data.item.id;
          if (data.item.category) {
            currentCategory = data.item.category;
          }
          if (data.item.category && data.item.headerImage) {
            saveCategoryCoverLocalAndServer(data.item.category, data.item.headerImage);
          }
          loadSkinForActiveItem();
        }
      }
      renderAll();
      closeItemModal();
      showToast(id ? 'แก้ไขข้อมูลเรียบร้อยแล้ว' : 'เพิ่มผลงานใหม่เรียบร้อยแล้ว!');
      return;
    }
  } catch (err) {
    console.warn('API error, handling locally:', err);
  }

  // Fallback
  let fallbackImg = imageUrl || (document.getElementById('imagePreview')?.src) || '/uploads/custom-yuki-skin.png';
  if (id) {
    const idx = appData.items.findIndex(i => i.id === id);
    if (idx !== -1) {
      appData.items[idx] = {
        ...appData.items[idx],
        title,
        category,
        licenseType,
        modelType,
        price: priceFull,
        priceHead,
        priceBody,
        priceFull,
        description,
        image: fallbackImg,
        headerImage: headerUrl || appData.items[idx].headerImage || '',
        skinTexture: fallbackImg,
        modelUrl: modelUrl || appData.items[idx].modelUrl || '',
        videoUrl: videoUrl || appData.items[idx].videoUrl || ''
      };
    }
  } else {
    const newId = 'item-' + Date.now();
    appData.items.unshift({
      id: newId,
      title,
      category,
      itemType: 'skin',
      isPremade: false,
      licenseType,
      modelType,
      price: priceFull,
      priceHead,
      priceBody,
      priceFull,
      description,
      image: fallbackImg,
      headerImage: headerUrl || '',
      skinTexture: fallbackImg,
      modelUrl: modelUrl || '',
      videoUrl: videoUrl || '',
      createdAt: new Date().toISOString()
    });
    activeItemId = newId;
  }

  persistLocal();
  loadSkinForActiveItem();
  renderAll();
  closeItemModal();
  showToast(id ? 'แก้ไขผลงานเรียบร้อยแล้ว' : 'เพิ่มผลงานใหม่เรียบร้อยแล้ว!');
}

async function deleteActiveItem() {
  const item = getActiveItem();
  if (!item) return;

  if (!confirm(`คุณต้องการลบผลงาน "${item.title}" ใช่หรือไม่?`)) return;

  try {
    const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadData();
      activeItemId = appData.items.length > 0 ? appData.items[0].id : null;
      loadSkinForActiveItem();
      renderAll();
      showToast('ลบผลงานเรียบร้อย');
      return;
    }
  } catch (err) {
    console.warn('API error, deleting locally', err);
  }

  appData.items = appData.items.filter(i => i.id !== item.id);
  activeItemId = appData.items.length > 0 ? appData.items[0].id : null;
  persistLocal();
  loadSkinForActiveItem();
  renderAll();
  showToast('ลบผลงานเรียบร้อย');
}

function openAddCategoryModal() {
  document.getElementById('newCategoryName').value = '';
  document.getElementById('categoryModal').classList.remove('hidden');
  renderCategoryPills();
}

function closeAddCategoryModal() {
  document.getElementById('categoryModal').classList.add('hidden');
}

async function submitNewCategory() {
  const name = document.getElementById('newCategoryName').value.trim();
  if (!name) return alert('กรุณากรอกชื่อหมวดหมู่');

  if (appData.categories.includes(name)) {
    return alert('มีหมวดหมู่นี้อยู่แล้ว');
  }

  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      await loadData();
      currentCategory = name;
      renderAll();
      closeAddCategoryModal();
      showToast(`เพิ่มหมวด "${name}" เรียบร้อย!`);
      return;
    }
  } catch (err) {
    console.warn('API error, adding category locally', err);
  }

  appData.categories.push(name);
  currentCategory = name;
  persistLocal();
  renderAll();
  closeAddCategoryModal();
  showToast(`เพิ่มหมวด "${name}" เรียบร้อย!`);
}

function openOrderModalForActive() {
  const item = getActiveItem();

  const img = document.getElementById('orderModalImg');
  if (img && item) img.src = item.image;
  const title = document.getElementById('orderModalTitle');
  if (title && item) title.textContent = item.title;
  const cat = document.getElementById('orderModalCategory');
  if (cat && item) cat.textContent = item.category || 'สกิน';
  const price = document.getElementById('orderModalPrice');
  if (price && item) price.textContent = `฿ ${item.price || item.priceFull || '195-240'}`;

  const snippetEl = document.getElementById('orderTextSnippet');
  if (snippetEl && item) {
    const snippet = `สวัสดีครับ สนใจสั่งคอมมิชชั่นกับ Yuki Shop ครับ!\n- ตัวอย่างงานที่เลือก: ${item.title}\n- หมวด: ${item.category}\n- เรตราคา: ส่วนหัว ${item.priceHead || '70฿'} / ส่วนตัว ${item.priceBody || '150-250฿'} / ทั้งตัว ${item.priceFull || item.price || '195-240฿'}\n(ทักเพื่อส่งเรฟและสอบถามคิวงานครับ)`;
    snippetEl.value = snippet;
  }

  const dcText = document.getElementById('orderDiscordText');
  if (dcText) {
    dcText.textContent = 'yuki_haru2204';
  }

  document.getElementById('orderModal').classList.remove('hidden');
  lucide.createIcons();
}

function openContactModal() {
  openOrderModalForActive();
}

function closeOrderModal() {
  document.getElementById('orderModal').classList.add('hidden');
}

function copyOrderSnippet() {
  const el = document.getElementById('orderTextSnippet');
  if (!el) return;
  const text = el.value;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copySnippetBtnText');
    if (btn) btn.textContent = 'คัดลอกแล้ว! ✓';
    showToast('คัดลอกข้อความสำหรับสั่งทำแล้ว!');
    setTimeout(() => {
      if (btn) btn.textContent = 'คัดลอกข้อความ';
    }, 2000);
  });
}

function copyDiscord(customName) {
  const dc = customName || 'yuki_haru2204';
  navigator.clipboard.writeText(dc).then(() => {
    const btnText = document.getElementById('copyDiscordBtnText');
    if (btnText) {
      btnText.textContent = 'คัดลอกแล้ว! ✨';
      setTimeout(() => { btnText.textContent = 'คัดลอกชื่อ'; }, 2000);
    }
    showToast(`คัดลอก Discord: ${dc} เรียบร้อยแล้วค่ะ! 💬`);
  });
}

function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;

  const cfg = appData.siteConfig || {};
  const titleInput = document.getElementById('configTitle');
  const subInput = document.getElementById('configSubtitle');
  const discordInput = document.getElementById('configDiscord');
  const slipokKeyInput = document.getElementById('configSlipokApiKey');
  const slipokBranchInput = document.getElementById('configSlipokBranchId');
  const webhookInput = document.getElementById('configDiscordWebhook');
  const socialProofCheck = document.getElementById('configLiveSocialProof');

  if (titleInput) titleInput.value = cfg.title || '';
  if (subInput) subInput.value = cfg.brandSub || '';
  if (discordInput) discordInput.value = cfg.discord || 'https://discord.gg/FyPfgC3Yj4';
  if (slipokKeyInput) slipokKeyInput.value = cfg.slipokApiKey || '';
  if (slipokBranchInput) slipokBranchInput.value = cfg.slipokBranchId || '';
  const autoApproveCheck = document.getElementById('configAutoApproveWithoutApi');
  if (autoApproveCheck) autoApproveCheck.checked = Boolean(cfg.autoApproveWithoutApi);
  if (webhookInput) webhookInput.value = cfg.discordWebhookUrl || '';
  const pingInput = document.getElementById('configDiscordPingMention');
  if (pingInput) pingInput.value = cfg.discordPingMention !== undefined ? cfg.discordPingMention : '@everyone';
  const publicUrlInput = document.getElementById('configPublicUrl');
  if (publicUrlInput) publicUrlInput.value = cfg.publicUrl || window.location.origin || 'http://localhost:3000';
  const adminPasswordInput = document.getElementById('configAdminPassword');
  if (adminPasswordInput) adminPasswordInput.value = cfg.adminPassword || 'yuki2204';
  if (socialProofCheck) socialProofCheck.checked = cfg.liveSocialProof !== false;

  modal.classList.remove('hidden');
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.classList.add('hidden');
}

async function testDiscordWebhook() {
  const webhookInput = document.getElementById('configDiscordWebhook');
  const webhookUrl = (webhookInput ? webhookInput.value : '').trim();
  const pingMention = (document.getElementById('configDiscordPingMention')?.value || '@everyone').trim();
  const publicUrl = (document.getElementById('configPublicUrl')?.value || window.location.origin).trim();
  const btnText = document.getElementById('testDiscordWebhookBtnText');

  if (!webhookUrl) {
    alert('กรุณากรอก Discord Webhook URL ก่อนกดทดสอบนะคะ ♡');
    if (webhookInput) webhookInput.focus();
    return;
  }
  if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    alert('รูปแบบ URL ไม่ถูกต้อง! URL ของ Discord Webhook ต้องขึ้นต้นด้วย https://discord.com/api/webhooks/... ค่ะ');
    return;
  }

  if (btnText) btnText.textContent = 'กำลังส่งทดสอบ...';
  try {
    const res = await fetch('/api/test-discord-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl, pingMention, publicUrl })
    });
    const data = await res.json();
    if (res.ok) {
      alert('🎉 ส่งข้อความทดสอบพร้อมปุ่มยืนยันสำเร็จแล้ว! ตรวจสอบในห้อง Discord ของคุณได้เลยค่ะ ♡');
      showToast('ส่งแจ้งเตือน Discord สำเร็จ! 🔔');
    } else {
      alert('❌ ไม่สามารถส่งได้: ' + (data.error || 'เกิดข้อผิดพลาด'));
    }
  } catch (err) {
    alert('❌ ข้อผิดพลาดในการเชื่อมต่อ: ' + err.message);
  } finally {
    if (btnText) btnText.textContent = 'ทดสอบส่งแจ้งเตือน Discord';
  }
}

async function saveSiteConfig() {
  const title = (document.getElementById('configTitle')?.value || '').trim();
  const brandSub = (document.getElementById('configSubtitle')?.value || '').trim();
  const discord = (document.getElementById('configDiscord')?.value || '').trim();
  const slipokApiKey = (document.getElementById('configSlipokApiKey')?.value || '').trim();
  const slipokBranchId = (document.getElementById('configSlipokBranchId')?.value || '').trim();
  const discordWebhookUrl = (document.getElementById('configDiscordWebhook')?.value || '').trim();
  const discordPingMention = (document.getElementById('configDiscordPingMention')?.value || '').trim() || '@everyone';
  const publicUrl = (document.getElementById('configPublicUrl')?.value || '').trim() || window.location.origin;
  const adminPassword = (document.getElementById('configAdminPassword')?.value || '').trim() || 'yuki2204';
  const autoApproveWithoutApi = document.getElementById('configAutoApproveWithoutApi')?.checked ?? false;
  const liveSocialProof = document.getElementById('configLiveSocialProof')?.checked ?? true;

  const newConfig = {
    ...appData.siteConfig,
    title: title || appData.siteConfig.title,
    brandSub: brandSub || appData.siteConfig.brandSub,
    discord: discord || appData.siteConfig.discord || 'https://discord.gg/FyPfgC3Yj4',
    slipokApiKey: slipokApiKey,
    slipokBranchId: slipokBranchId,
    autoApproveWithoutApi: autoApproveWithoutApi,
    discordWebhookUrl: discordWebhookUrl,
    discordPingMention: discordPingMention,
    publicUrl: publicUrl,
    liveSocialProof: liveSocialProof,
    adminPassword: adminPassword
  };

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });
    if (res.ok) {
      const data = await res.json();
      appData.siteConfig = data.siteConfig;
      renderConfig();
      closeSettingsModal();
      showToast('บันทึกการตั้งค่าเรียบร้อย!');
      return;
    }
  } catch (err) {
    console.warn('API error, saving config locally', err);
  }

  appData.siteConfig = newConfig;
  persistLocal();
  renderConfig();
  closeSettingsModal();
  showToast('บันทึกการตั้งค่าเรียบร้อย!');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  toastMsg.textContent = msg;

  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 2500);
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

// ========================================================
// PREMADE SKINS STORE (หน้าสกินสำเร็จรูปตาม Mockup)
// ========================================================
let activePremadeId = null;
let premadeSkinViewer = null;
let premadeCurrentPose = 'stand';
let isPremadeAutoRotating = true;
let premadeFilter = 'all'; // 'all', 'available', 'sold'
let premadeCamAzimuth = 0;
let isPremadeRenderLoopStarted = false;

function initPremadeSkinViewer() {
  const canvas = document.getElementById('premadeSkinCanvas');
  if (!canvas || typeof skinview3d === 'undefined') return;
  if (premadeSkinViewer) return;

  try {
    premadeSkinViewer = new skinview3d.SkinViewer({
      canvas: canvas,
      width: 380,
      height: 400,
      fov: 52,
      alpha: true,
      preserveDrawingBuffer: true
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    premadeSkinViewer.renderer.setPixelRatio(dpr);
    if (premadeSkinViewer.updateComposerSize) {
      premadeSkinViewer.updateComposerSize();
    }

    premadeSkinViewer.camera.position.set(0, -2, 44);
    premadeSkinViewer.camera.lookAt(0, -2, 0);

    if (premadeSkinViewer.controls) {
      premadeSkinViewer.controls.enableZoom = true;
      premadeSkinViewer.controls.zoomSpeed = 1.8;
      premadeSkinViewer.controls.minDistance = 14;
      premadeSkinViewer.controls.maxDistance = 120;
      premadeSkinViewer.controls.enablePan = false;
      premadeSkinViewer.controls.enableDamping = true;
      premadeSkinViewer.controls.dampingFactor = 0.08;

      if (typeof THREE !== 'undefined' && THREE.MOUSE) {
        premadeSkinViewer.controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE
        };
      }
    }

    premadeSkinViewer.autoRotate = false;

    if (!isPremadeRenderLoopStarted) {
      isPremadeRenderLoopStarted = true;
      function premadeRenderLoop() {
        requestAnimationFrame(premadeRenderLoop);
        if (!premadeSkinViewer) return;

        const premadeDetail = document.getElementById('premadeDetailView');
        const premadePanel = document.getElementById('premadeViewPanel');
        if (premadePanel && premadePanel.classList.contains('view-hidden')) return;
        if (premadeDetail && premadeDetail.classList.contains('hidden')) return;

        if (isPremadeAutoRotating && premadeSkinViewer.camera) {
          premadeCamAzimuth += 0.015;
          const radius = Math.hypot(premadeSkinViewer.camera.position.x, premadeSkinViewer.camera.position.z) || 44;
          premadeSkinViewer.camera.position.x = radius * Math.sin(premadeCamAzimuth);
          premadeSkinViewer.camera.position.z = radius * Math.cos(premadeCamAzimuth);
          premadeSkinViewer.camera.lookAt(0, -2, 0);
        }

        if (premadeSkinViewer.controls) {
          premadeSkinViewer.controls.update();
        }
      }
      requestAnimationFrame(premadeRenderLoop);
    }

  } catch (err) {
    console.warn('Premade SkinViewer init error:', err);
  }
}

function renderPremadeCards() {
  const grid = document.getElementById('premadeCardsGrid');
  if (!grid) return;

  const premadeItems = (appData.items || []).filter(item => {
    const isCatMatch = item.category === 'สกินสำเร็จ' || item.isPremade || (item.tags && item.tags.includes('พร้อมส่ง'));
    if (!isCatMatch) return false;
    if (premadeFilter === 'available') return item.status !== 'sold';
    if (premadeFilter === 'sold') return item.status === 'sold';
    return true;
  });

  if (premadeItems.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center frosted-window rounded-3xl p-8 border border-purple-200">
        <span class="text-3xl block mb-2">❄️</span>
        <h4 class="text-base font-bold text-purple-950">ยังไม่มีสกินในหมวดหมู่นี้</h4>
        <p class="text-xs text-purple-600 mt-1">สามารถกดเพิ่มสกินสำเร็จรูปหรือเลือกตัวกรองสถานะอื่นได้ค่ะ ♡</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = premadeItems.map((item, idx) => {
    const isSold = item.status === 'sold';
    const isExclusive = item.licenseType !== 'unlimited';
    const code = item.premadeCode || (`#SKIN-${String(idx + 1).padStart(2, '0')}`);
    const priceText = item.price || item.priceFull || '250฿';
    const displayImg = item.headerImage || item.image || item.skinTexture || 'uploads/custom-yuki-skin.png';

    return `
      <div 
        class="premade-card cursor-pointer group flex flex-col justify-between overflow-hidden relative"
        onclick="openPremadeDetail('${item.id}')"
        onmouseenter="startCardPreviewSpin('${item.id}')"
        onmouseleave="stopCardPreviewSpin('${item.id}')"
        title="คลิกเพื่อดูตัวอย่าง 3D 360° & สั่งซื้อ"
      >
        <!-- Corner Ornaments (Butterflies & Crystals) -->
        <div class="premade-corner-tl">🦋</div>
        <div class="premade-corner-tr">💎</div>

        <!-- Card Top Bar: Code, License & Status -->
        <div class="p-3.5 pt-4 pb-2 flex items-center justify-between z-10 flex-wrap gap-1">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-black bg-purple-100/90 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full shadow-2xs">
              ${escapeHtml(code)}
            </span>
            ${isExclusive ? `
              <span class="text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-2xs" title="ซื้อคนเดียว สิทธิ์ขาด ลายไม่ซ้ำใคร">
                <span>👑</span><span>ซื้อคนเดียว</span>
              </span>
            ` : `
              <span class="text-[9px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-2xs" title="ซื้อได้ไม่จำกัดจำนวนคน">
                <span>♾️</span><span>ไม่จำกัดสิทธิ์</span>
              </span>
            `}
          </div>

          <div class="flex items-center gap-1">
            ${isSold ? `
              <span class="text-[10px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full shadow-2xs flex items-center gap-0.5">
                <span>🔒</span><span>ขายแล้ว</span>
              </span>
            ` : `
              <span class="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-2xs flex items-center gap-0.5">
                <span>✨</span><span>พร้อมส่ง</span>
              </span>
            `}
            <button 
              type="button"
              onclick="event.stopPropagation(); activePremadeId = '${item.id}'; openEditActivePremadeModal();"
              class="admin-only p-1 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-700 text-[10px] transition shadow-2xs"
              title="แก้ไขสกินสำเร็จรูปนี้"
            >
              ✏️
            </button>
            <button 
              type="button"
              onclick="event.stopPropagation(); deletePremadeSkin('${item.id}', '${escapeHtml(item.title)}')"
              class="admin-only p-1 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] transition shadow-2xs"
              title="ลบสกินสำเร็จรูปนี้"
            >
              🗑️
            </button>
          </div>
        </div>

        <!-- Center 3D Model Box -->
        <div class="premade-silhouette-box p-2 mx-3 my-1 rounded-2xl border border-purple-200/50 flex flex-col items-center justify-center relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-300" style="min-height: 220px; height: 220px;">
          <canvas id="premadeCardCanvas_${item.id}" class="w-full h-full max-h-[210px] object-contain drop-shadow-md z-0 pointer-events-none"></canvas>
          <img 
            id="premadeCardFallback_${item.id}"
            src="${escapeHtml(displayImg)}" 
            alt="${escapeHtml(item.title)}" 
            class="hidden max-h-48 w-auto object-contain filter drop-shadow-md"
            onerror="this.src='uploads/custom-yuki-skin.png'"
          />
          <div class="absolute top-2 right-2 px-2 py-0.5 bg-purple-900/70 backdrop-blur-xs text-white rounded-full text-[9px] font-bold flex items-center gap-1 z-10 pointer-events-none shadow-2xs">
            <span>🧊 3D Live</span>
          </div>
          <div class="absolute bottom-2 px-3 py-1 bg-white/90 backdrop-blur-xs rounded-full border border-purple-200 text-[10px] font-bold text-purple-800 shadow-2xs opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
            🔍 แตะเพื่อดู 360° & สั่งซื้อ
          </div>
        </div>

        <!-- Card Content: Title -->
        <div class="px-4 py-2 text-center">
          <h3 class="text-sm font-black text-purple-950 line-clamp-1 group-hover:text-purple-700 transition">
            ${escapeHtml(item.title)}
          </h3>
          <p class="text-[10px] text-purple-500 mt-0.5 line-clamp-1">
            ${escapeHtml(item.description || (isExclusive ? 'สกินสำเร็จรูปพร้อมส่ง สิทธิ์ขาดไม่ซ้ำใคร' : 'สกินสำเร็จรูป Open License ไม่จำกัดจำนวน'))}
          </p>
        </div>

        <!-- Bottom Price Bar (Matching Mockup ❄️ ฿ 250 ❄️) -->
        <div class="premade-price-bar py-3 px-4 text-center mt-2 flex items-center justify-center gap-2">
          <span class="text-xs text-purple-400">❄️</span>
          <span class="text-base sm:text-lg font-black text-purple-950 tracking-tight">
            ${escapeHtml(priceText)}
          </span>
          <span class="text-xs text-purple-400">❄️</span>
        </div>
      </div>
    `;
  }).join('');

  // Clean up previous card viewers
  if (window.premadeCardViewers) {
    window.premadeCardViewers.forEach(entry => {
      try {
        if (entry.spinAnimId) cancelAnimationFrame(entry.spinAnimId);
        if (entry.viewer && typeof entry.viewer.dispose === 'function') entry.viewer.dispose();
      } catch (e) {}
    });
  }
  window.premadeCardViewers = new Map();

  // Initialize 3D live viewer for each premade card
  premadeItems.forEach(item => {
    initPremadeCard3D(item);
  });
}

function initPremadeCard3D(item) {
  if (typeof skinview3d === 'undefined') return;
  const canvas = document.getElementById(`premadeCardCanvas_${item.id}`);
  const fallbackImg = document.getElementById(`premadeCardFallback_${item.id}`);
  if (!canvas) return;

  const skinSrc = item.skinTexture || item.image || 'uploads/custom-yuki-skin.png';

  try {
    const box = canvas.parentElement;
    const cardWidth = box ? Math.max(180, Math.min(box.clientWidth || 220, 260)) : 220;
    const cardHeight = 230;

    const viewer = new skinview3d.SkinViewer({
      canvas: canvas,
      width: cardWidth,
      height: cardHeight,
      fov: 48,
      alpha: true,
      preserveDrawingBuffer: true
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewer.renderer.setPixelRatio(dpr);

    // Natural isometric front-facing pose
    viewer.camera.position.set(12, -2, 42);
    viewer.camera.lookAt(0, -2, 0);

    // Default to 'slim' (Alex, 3px arms) for Yuki Shop skins unless explicitly classic/steve
    const isClassic = item.modelType === 'classic' || item.modelType === 'steve' || item.modelType === 'default';
    const modelType = isClassic ? 'default' : 'slim';

    if (viewer.playerObject && viewer.playerObject.skin) {
      viewer.playerObject.skin.modelType = modelType;
    }

    prepareSkinTexture(skinSrc, item).then(finalSkinSrc => {
      return viewer.loadSkin(finalSkinSrc, { model: modelType });
    })
      .then(() => {
        fixSkinMeshMaterials(viewer);
        // Natural standing pose with 3px slim arms
        if (viewer.playerObject && viewer.playerObject.skin) {
          const skin = viewer.playerObject.skin;
          if (skin.modelType !== modelType) {
            skin.modelType = modelType;
          }
          if (skin.leftArm) skin.leftArm.rotation.x = 0.14;
          if (skin.rightArm) skin.rightArm.rotation.x = -0.14;
          if (skin.leftLeg) skin.leftLeg.rotation.x = -0.05;
          if (skin.rightLeg) skin.rightLeg.rotation.x = 0.05;
          if (skin.head) skin.head.rotation.y = 0.08;
        }
      })
      .catch(err => {
        console.warn('Card 3D load error for ' + item.id, err);
        if (fallbackImg) fallbackImg.classList.remove('hidden');
        canvas.classList.add('hidden');
      });

    window.premadeCardViewers.set(item.id, {
      viewer: viewer,
      spinning: false,
      spinAnimId: null
    });
  } catch (err) {
    console.error('Failed to initPremadeCard3D:', err);
    if (fallbackImg) fallbackImg.classList.remove('hidden');
    canvas.classList.add('hidden');
  }
}

function startCardPreviewSpin(itemId) {
  const entry = window.premadeCardViewers && window.premadeCardViewers.get(itemId);
  if (!entry || !entry.viewer) return;
  entry.spinning = true;

  if (entry.spinAnimId) cancelAnimationFrame(entry.spinAnimId);

  function spinTick() {
    if (!entry.spinning || !entry.viewer) return;
    if (entry.viewer.playerObject) {
      entry.viewer.playerObject.rotation.y += 0.032;
    }
    entry.spinAnimId = requestAnimationFrame(spinTick);
  }
  entry.spinAnimId = requestAnimationFrame(spinTick);
}

function stopCardPreviewSpin(itemId) {
  const entry = window.premadeCardViewers && window.premadeCardViewers.get(itemId);
  if (!entry) return;
  entry.spinning = false;
  if (entry.spinAnimId) {
    cancelAnimationFrame(entry.spinAnimId);
    entry.spinAnimId = null;
  }
  if (entry.viewer && entry.viewer.playerObject) {
    entry.viewer.playerObject.rotation.y = 0;
  }
}

function openPremadeDetail(skinId) {
  activePremadeId = skinId;
  const item = (appData.items || []).find(i => i.id === skinId);
  if (!item) return;

  const listView = document.getElementById('premadeListView');
  const detailView = document.getElementById('premadeDetailView');
  if (listView) listView.classList.add('hidden');
  if (detailView) detailView.classList.remove('hidden');

  const isSold = item.status === 'sold';
  const isExclusive = item.licenseType !== 'unlimited';
  const code = item.premadeCode || (`#SKIN-${item.id.replace('premade-', '').padStart(2, '0')}`);
  const priceText = item.price || item.priceFull || '250฿';

  const codeEl = document.getElementById('premadeDetailCode');
  const titleEl = document.getElementById('premadeDetailTitle');
  const priceEl = document.getElementById('premadeDetailPrice');
  const descEl = document.getElementById('premadeDetailDesc');
  const statusPill = document.getElementById('premadeDetailStatusPill');
  const licenseBadge = document.getElementById('premadeDetailLicenseBadge');
  const licenseText = document.getElementById('premadeDetailLicenseText');
  const priceNote = document.getElementById('premadePriceNote');
  const modelTypeEl = document.getElementById('premadeDetailModelType');
  const resEl = document.getElementById('premadeDetailResolution');
  const editionEl = document.getElementById('premadeDetailEdition');
  const includedEl = document.getElementById('premadeDetailIncluded');
  const buyBtn = document.getElementById('btnBuyPremade');

  if (codeEl) codeEl.textContent = code;
  if (titleEl) titleEl.textContent = item.title;
  if (priceEl) priceEl.textContent = priceText;
  if (descEl) descEl.textContent = item.description || 'สกินสำเร็จรูปพร้อมส่ง โทนม่วงพาสเทลหิมะ ลายลูกไม้ประณีตและริบบิ้นผีเสื้อ รองรับ Minecraft Java & Bedrock';
  if (modelTypeEl) {
    modelTypeEl.textContent = item.armType || ((item.modelType === 'classic' || item.modelType === 'steve') ? 'Classic 4px (Steve)' : 'Slim 3px (Alex)');
  }

  if (resEl) {
    let resVal = item.resolution;
    if (!resVal) {
      if (/512/i.test(item.title) || /512/i.test(item.category)) resVal = '512x512 Ultra HD';
      else if (/128/i.test(item.title) || /128/i.test(item.category)) resVal = '128x128 HD';
      else if (/1024/i.test(item.title) || /1024/i.test(item.category)) resVal = '1024x1024 Pixel';
      else resVal = '64x64 HD Standard';
    }
    resEl.textContent = resVal;
  }

  if (editionEl) {
    editionEl.textContent = item.edition || 'Java & Bedrock Edition';
  }

  if (includedEl) {
    includedEl.textContent = item.included || 'ไฟล์ .PNG คมชัด • ดาวน์โหลดทันที';
  }

  if (licenseBadge) {
    if (isExclusive) {
      licenseBadge.className = 'text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full shadow-2xs';
      licenseBadge.innerHTML = '👑 สิทธิ์ขาดคนเดียว';
    } else {
      licenseBadge.className = 'text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-200 px-2.5 py-0.5 rounded-full shadow-2xs';
      licenseBadge.innerHTML = '♾️ ซื้อได้ไม่จำกัด';
    }
  }

  if (licenseText) {
    licenseText.textContent = item.licenseText || (isExclusive ? '👑 ซื้อคนเดียว (สิทธิ์ขาด 1 คนเท่านั้น)' : '♾️ ซื้อได้ไม่จำกัด (ใช้ได้หลายคน)');
  }

  if (priceNote) {
    priceNote.textContent = item.priceNote || (isExclusive ? 'ซื้อครั้งเดียว สิทธิ์ขาด ลายไม่ซ้ำใคร (1 คนเท่านั้น)' : 'สกินสำเร็จรูป Open License ซื้อและใช้งานได้ไม่จำกัดจำนวน');
  }

  if (statusPill) {
    if (isSold && isExclusive) {
      statusPill.className = 'text-[10px] font-black bg-rose-500 text-white px-2.5 py-0.5 rounded-full shadow-2xs';
      statusPill.innerHTML = '🔒 ขายแล้ว (ปิดรับสั่งซื้อ)';
    } else {
      statusPill.className = 'text-[10px] font-black bg-emerald-500 text-white px-2.5 py-0.5 rounded-full shadow-2xs';
      statusPill.innerHTML = '✨ พร้อมส่งทันที';
    }
  }

  if (buyBtn) {
    if (isSold && isExclusive) {
      buyBtn.className = 'w-full py-3.5 px-4 font-bold text-sm bg-gray-200 text-gray-500 rounded-2xl cursor-not-allowed flex items-center justify-center gap-2 shadow-none';
      buyBtn.onclick = null;
      buyBtn.innerHTML = '<span>🔒</span><span>สกินนี้ถูกซื้อไปแล้ว (สิทธิ์ขาดคนเดียว)</span>';
    } else {
      buyBtn.className = 'btn-yuki-order w-full py-3.5 px-4 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg';
      buyBtn.onclick = () => openPremadeCheckoutModal(item.id);
      buyBtn.innerHTML = '<span>💳</span><span>ชำระเงิน & ซื้อสกินนี้ทันที</span><span class="text-xs font-black">❯</span>';
    }
  }

  // Load 3D interactive model into premadeSkinViewer
  initPremadeSkinViewer();
  if (premadeSkinViewer) {
    const skinSrc = item.skinTexture || item.image || '/uploads/custom-yuki-skin.png';
    const model = (item.modelType === 'classic') ? 'default' : 'slim';
    prepareSkinTexture(skinSrc, item).then(finalSkinSrc => {
      if (premadeSkinViewer) {
        premadeSkinViewer.loadSkin(finalSkinSrc, { model: model }).then(() => {
          fixSkinMeshMaterials(premadeSkinViewer);
        }).catch(() => {});
      }
    });
    setPremadePose(premadeCurrentPose);
    setTimeout(() => {
      if (premadeSkinViewer.updateComposerSize) premadeSkinViewer.updateComposerSize();
      if (premadeSkinViewer.controls) premadeSkinViewer.controls.update();
    }, 60);
  }

  window.scrollTo({ top: 120, behavior: 'smooth' });
}

function showPremadeList() {
  const listView = document.getElementById('premadeListView');
  const detailView = document.getElementById('premadeDetailView');
  if (detailView) detailView.classList.add('hidden');
  if (listView) listView.classList.remove('hidden');
  window.scrollTo({ top: 100, behavior: 'smooth' });
}

async function deleteActivePremade() {
  if (!activePremadeId) return;
  const item = (appData.items || []).find(i => i.id === activePremadeId);
  const title = item ? item.title : 'สกินนี้';
  await deletePremadeSkin(activePremadeId, title);
}

async function deletePremadeSkin(id, title) {
  if (!confirm(`คุณต้องการลบสกินสำเร็จรูป "${title || id}" ใช่หรือไม่?`)) return;

  try {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('ลบสกินสำเร็จรูปเรียบร้อยแล้ว!');
      appData.items = appData.items.filter(i => i.id !== id);
      persistLocal();
      showPremadeList();
      renderPremadeCards();
      return;
    }
  } catch (err) {
    console.warn('API error deleting premade', err);
  }

  appData.items = appData.items.filter(i => i.id !== id);
  persistLocal();
  showToast('ลบสกินสำเร็จรูปเรียบร้อยแล้ว!');
  showPremadeList();
  renderPremadeCards();
}

// ==================== CHECKOUT & PAYMENT SYSTEM ====================
let currentPaymentMethod = 'promptpay';
let selectedCheckoutSlipFile = null;

// Helper: Calculate CRC16-CCITT for PromptPay EMVCo
function clientCrc16(data) {
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

// Helper: Generate PromptPay EMVCo standard payload with dynamic amount
function generateClientPromptPayPayload(target, amount) {
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
  payload += clientCrc16(payload);
  return payload;
}

// Function to generate and display dynamic PromptPay QR code
async function updatePromptPayQrCode(numAmount) {
  const qrImg = document.getElementById('promptpayQrImg');
  const qrAmtEl = document.getElementById('promptpayAmountText');
  const btnDownloadQr = document.getElementById('btnDownloadQr');
  if (!qrImg) return;

  const amountStr = Number(numAmount || 0).toFixed(2) + ' ฿';
  if (qrAmtEl) qrAmtEl.textContent = amountStr;

  try {
    const res = await fetch(`/api/promptpay-qr?amount=${numAmount}&target=0959891045`);
    if (res.ok) {
      const data = await res.json();
      if (data.qrDataUrl) {
        qrImg.src = data.qrDataUrl;
        if (btnDownloadQr) {
          btnDownloadQr.href = data.qrDataUrl;
          btnDownloadQr.setAttribute('download', `promptpay-0959891045-${numAmount}baht.png`);
        }
        return;
      }
    }
  } catch (err) {
    console.warn('API QR fetch notice, generating client-side fallback:', err);
  }

  // Client-side fallback with dynamic amount
  const payload = generateClientPromptPayPayload('0959891045', numAmount);
  const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`;
  qrImg.src = fallbackUrl;
  if (btnDownloadQr) {
    btnDownloadQr.href = fallbackUrl;
    btnDownloadQr.setAttribute('download', `promptpay-0959891045-${numAmount}baht.png`);
  }
}

function openPremadeCheckoutModal(skinId) {
  const targetId = skinId || activePremadeId;
  const item = (appData.items || []).find(i => i.id === targetId);
  if (!item) return;

  if (item.status === 'sold' && item.licenseType !== 'unlimited') {
    showToast('ขออภัยค่ะ สกินนี้ถูกซื้อไปแล้ว (สิทธิ์ขาดคนเดียว) ♡');
    return;
  }

  activePremadeId = item.id;
  selectedCheckoutSlipFile = null;

  // Reset steps
  const stepForm = document.getElementById('checkoutStepForm');
  const successView = document.getElementById('checkoutSuccessView');
  const pendingView = document.getElementById('checkoutPendingView');
  if (stepForm) stepForm.classList.remove('hidden');
  if (successView) successView.classList.add('hidden');
  if (pendingView) pendingView.classList.add('hidden');
  stopOrderStatusPolling();

  // Populate item summary
  const imgEl = document.getElementById('checkoutSkinImg');
  const codeEl = document.getElementById('checkoutSkinCode');
  const titleEl = document.getElementById('checkoutSkinTitle');
  const priceEl = document.getElementById('checkoutSkinPrice');
  const licenseEl = document.getElementById('checkoutLicenseBadge');
  const buyerContact = document.getElementById('checkoutBuyerContact');

  const code = item.premadeCode || (`#SKIN-${item.id.replace('premade-', '').padStart(2, '0')}`);
  const price = item.price || item.priceFull || '250฿';

  if (imgEl) imgEl.src = item.skinTexture || item.image || 'uploads/custom-yuki-skin.png';
  if (codeEl) codeEl.textContent = code;
  if (titleEl) titleEl.textContent = item.title;
  if (priceEl) priceEl.textContent = price;
  if (buyerContact) buyerContact.value = '';

  if (licenseEl) {
    if (item.licenseType === 'unlimited') {
      licenseEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200';
      licenseEl.innerHTML = '♾️ ซื้อได้ไม่จำกัด';
    } else {
      licenseEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300';
      licenseEl.innerHTML = '👑 สิทธิ์ขาด 1 คน';
    }
  }

  // Parse exact numeric price and generate dynamic PromptPay QR Code
  const numPrice = parseFloat(String(price).replace(/[^0-9.]/g, '')) || 250;
  updatePromptPayQrCode(numPrice);

  // Update all .checkoutPayAmount labels with formatted amount
  const formattedPrice = Number(numPrice).toFixed(2) + ' ฿';
  document.querySelectorAll('.checkoutPayAmount').forEach(el => {
    el.textContent = formattedPrice;
  });

  // Reset slip UI and select PromptPay as default
  removeCheckoutSlip();
  selectPaymentTab('promptpay');

  const modal = document.getElementById('premadeCheckoutModal');
  if (modal) modal.classList.remove('hidden');
  lucide.createIcons();
}

function closePremadeCheckoutModal() {
  stopOrderStatusPolling();
  const modal = document.getElementById('premadeCheckoutModal');
  if (modal) modal.classList.add('hidden');
}

function selectPaymentTab(tab) {
  currentPaymentMethod = tab;
  const btnPrompt = document.getElementById('payTabPromptpay');
  const btnTrue = document.getElementById('payTabTruemoney');
  const btnBank = document.getElementById('payTabBank');

  const boxPrompt = document.getElementById('payBoxPromptpay');
  const boxTrue = document.getElementById('payBoxTruemoney');
  const boxBank = document.getElementById('payBoxBank');

  const activePromptBtn = 'p-2 sm:p-2.5 rounded-xl border-2 border-blue-500 bg-blue-50/90 text-[11px] sm:text-xs font-bold text-blue-950 flex flex-col items-center justify-center shadow-2xs transition';
  const activeTrueBtn = 'p-2 sm:p-2.5 rounded-xl border-2 border-amber-400 bg-amber-50/90 text-[11px] sm:text-xs font-bold text-amber-950 flex flex-col items-center justify-center shadow-2xs transition';
  const activeBankBtn = 'p-2 sm:p-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/90 text-[11px] sm:text-xs font-bold text-emerald-950 flex flex-col items-center justify-center shadow-2xs transition';
  const inactiveBtn = 'p-2 sm:p-2.5 rounded-xl border-2 border-purple-200 bg-white/70 text-[11px] sm:text-xs font-medium text-purple-800 hover:bg-purple-50 flex flex-col items-center justify-center transition';

  if (btnPrompt) btnPrompt.className = (tab === 'promptpay') ? activePromptBtn : inactiveBtn;
  if (btnTrue) btnTrue.className = (tab === 'truemoney') ? activeTrueBtn : inactiveBtn;
  if (btnBank) btnBank.className = (tab === 'bank') ? activeBankBtn : inactiveBtn;

  if (boxPrompt) boxPrompt.classList.toggle('hidden', tab !== 'promptpay');
  if (boxTrue) boxTrue.classList.toggle('hidden', tab !== 'truemoney');
  if (boxBank) boxBank.classList.toggle('hidden', tab !== 'bank');
}

// Toggle Dynamic PromptPay QR inside Checkout
function toggleDynamicPromptPayQr() {
  const box = document.getElementById('dynamicPromptPayBox');
  const txt = document.getElementById('dynamicPromptPayToggleText');
  if (!box) return;
  const isHidden = box.classList.contains('hidden');
  if (isHidden) {
    box.classList.remove('hidden');
    if (txt) txt.textContent = 'ซ่อน QR พร้อมเพย์แบบระบุยอดเงิน';
  } else {
    box.classList.add('hidden');
    if (txt) txt.textContent = 'คลิกเพื่อดู QR พร้อมเพย์แบบระบุยอดเงินเป๊ะ (Dynamic QR)';
  }
}

// Toggle Payment QR Accordion in Contact / Order Modal
function toggleOrderPaymentQrSection() {
  const content = document.getElementById('orderPaymentQrContent');
  const arrow = document.getElementById('orderPaymentQrArrow');
  if (!content) return;
  const isHidden = content.classList.contains('hidden');
  if (isHidden) {
    content.classList.remove('hidden');
    if (arrow) arrow.textContent = '▲ ซ่อน QR';
  } else {
    content.classList.add('hidden');
    if (arrow) arrow.textContent = '▼ ดู QR';
  }
}

// Global QR Lightbox Modal (Tap to zoom image)
function openQrLightbox(imgSrc, title) {
  const modal = document.getElementById('qrLightboxModal');
  const img = document.getElementById('qrLightboxImg');
  const titleEl = document.getElementById('qrLightboxTitle');
  const dlBtn = document.getElementById('qrLightboxDownloadBtn');
  if (!modal || !img) return;

  img.src = imgSrc;
  if (titleEl) titleEl.textContent = title || 'ช่องทางการชำระเงิน';
  if (dlBtn) {
    dlBtn.href = imgSrc;
    const filename = imgSrc.split('/').pop() || 'payment-qr.png';
    dlBtn.setAttribute('download', filename);
  }
  modal.classList.remove('hidden');
}

function closeQrLightbox() {
  const modal = document.getElementById('qrLightboxModal');
  if (modal) modal.classList.add('hidden');
}

// Thai Banks and BOT Mini QR Configuration
const THAI_BANK_CODES = {
  '002': { name: 'ธนาคารกรุงเทพ (BBL)', short: 'BBL', color: '#1e3a8a' },
  '004': { name: 'ธนาคารกสิกรไทย (KBANK)', short: 'KBANK', color: '#047857' },
  '006': { name: 'ธนาคารกรุงไทย (KTB)', short: 'KTB', color: '#0284c7' },
  '011': { name: 'ธนาคารทหารไทยธนชาต (ttb)', short: 'ttb', color: '#1d4ed8' },
  '014': { name: 'ธนาคารไทยพาณิชย์ (SCB)', short: 'SCB', color: '#581c87' },
  '025': { name: 'ธนาคารกรุงศรีอยุธยา (BAY)', short: 'BAY', color: '#ca8a04' },
  '069': { name: 'ธนาคารเกียรตินาคินภัทร (KKP)', short: 'KKP', color: '#7c3aed' },
  '022': { name: 'ธนาคารซีไอเอ็มบี ไทย (CIMBT)', short: 'CIMBT', color: '#be123c' },
  '067': { name: 'ธนาคารทิสโก้ (TISCO)', short: 'TISCO', color: '#0369a1' },
  '024': { name: 'ธนาคารยูโอบี (UOB)', short: 'UOB', color: '#0f172a' },
  '071': { name: 'ธนาคารไทยเครดิต', short: 'TCRB', color: '#0f766e' },
  '073': { name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์ (LH Bank)', short: 'LHBANK', color: '#0d9488' },
  '030': { name: 'ธนาคารออมสิน (GSB)', short: 'GSB', color: '#db2777' },
  '034': { name: 'ธ.ก.ส. (BAAC)', short: 'BAAC', color: '#15803d' },
  '033': { name: 'ธนาคารอาคารสงเคราะห์ (GHB)', short: 'GHB', color: '#ea580c' },
  '070': { name: 'ธนาคารไอซีบีซี (ไทย) (ICBCT)', short: 'ICBCT', color: '#dc2626' },
  '098': { name: 'พร้อมเพย์ (PromptPay)', short: 'PROMPTPAY', color: '#0284c7' }
};

let currentSlipVerification = {
  isScanning: false,
  detected: false,
  rawQr: '',
  bankCode: '',
  bankName: '',
  transRef: '',
  isDuplicate: false,
  duplicateMessage: '',
  error: null
};

function formatSlipFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function handleCheckoutSlipSelect(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  selectedCheckoutSlipFile = file;

  // Reset verification state
  currentSlipVerification = {
    isScanning: true,
    detected: false,
    rawQr: '',
    bankCode: '',
    bankName: '',
    transRef: '',
    isDuplicate: false,
    duplicateMessage: '',
    error: null
  };

  const previewImg = document.getElementById('slipPreviewImg');
  const fileName = document.getElementById('slipFileName');
  const fileSize = document.getElementById('slipFileSize');
  const placeholder = document.getElementById('slipPlaceholder');
  const container = document.getElementById('slipPreviewContainer');
  const statusBox = document.getElementById('slipDetectStatusBox');

  if (fileName) fileName.textContent = file.name;
  if (fileSize) fileSize.textContent = formatSlipFileSize(file.size);
  if (placeholder) placeholder.classList.add('hidden');
  if (container) container.classList.remove('hidden');

  if (statusBox) {
    statusBox.className = 'p-2.5 rounded-xl border border-purple-200 bg-purple-50/70 text-xs text-left transition-all';
    statusBox.innerHTML = `
      <div class="flex items-center gap-2 text-purple-700">
        <span class="animate-spin inline-block text-sm">🔄</span>
        <span class="font-bold">กำลังสแกนและตรวจจับ QR Code บนสลิป...</span>
      </div>
      <div class="text-[10px] text-purple-500 mt-0.5">ระบบจะตรวจสอบธนาคารและป้องกันการใช้สลิปซ้ำโดยอัตโนมัติ</div>
    `;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    if (previewImg) {
      previewImg.onload = () => {
        scanUploadedSlip(previewImg, file);
      };
      previewImg.src = dataUrl;
    }
  };
  reader.readAsDataURL(file);
}

function removeCheckoutSlip() {
  selectedCheckoutSlipFile = null;
  currentSlipVerification = {
    isScanning: false,
    detected: false,
    rawQr: '',
    bankCode: '',
    bankName: '',
    transRef: '',
    isDuplicate: false,
    duplicateMessage: '',
    error: null
  };

  const input = document.getElementById('checkoutSlipInput');
  if (input) input.value = '';
  const placeholder = document.getElementById('slipPlaceholder');
  const container = document.getElementById('slipPreviewContainer');
  const previewImg = document.getElementById('slipPreviewImg');
  const statusBox = document.getElementById('slipDetectStatusBox');
  const btn = document.getElementById('btnConfirmCheckout');

  if (previewImg) previewImg.src = '';
  if (statusBox) statusBox.innerHTML = '';
  if (placeholder) placeholder.classList.remove('hidden');
  if (container) container.classList.add('hidden');
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}

// Decode QR Code from Image Element using jsQR with multi-scale sampling
function decodeQrFromImageElement(img) {
  if (typeof window.jsQR !== 'function') {
    console.warn('jsQR library not available');
    return null;
  }

  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  if (!naturalW || !naturalH) return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // Mobile screenshots can be 1080x2400. Try multi-resolution scales:
  const scales = [1];
  if (naturalW > 1000) {
    scales.unshift(900 / naturalW); // Optimized scale first
  }
  if (naturalW > 1600) {
    scales.push(1200 / naturalW);
  }
  if (naturalW < 500) {
    scales.push(800 / naturalW);
  }

  for (const scale of scales) {
    const w = Math.round(naturalW * scale);
    const h = Math.round(naturalH * scale);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    try {
      const imageData = ctx.getImageData(0, 0, w, h);
      const code = window.jsQR(imageData.data, w, h, {
        inversionAttempts: 'attemptBoth'
      });
      if (code && code.data && code.data.trim()) {
        return code.data.trim();
      }
    } catch (err) {
      console.warn('jsQR scan attempt failed on scale:', scale, err);
    }
  }

  return null;
}

// Helper: Check if slip is an old expired slip based on transRef timestamp
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

// Parse Bank of Thailand / PromptPay Mini QR Payload or URL
function parseSlipQrPayload(qrText) {
  if (!qrText || typeof qrText !== 'string') return null;
  qrText = qrText.trim();

  let bankCode = '';
  let transRef = '';
  let rawQr = qrText;

  function parseTlv(text) {
    const res = {};
    let idx = 0;
    while (idx < text.length - 4) {
      const tag = text.substring(idx, idx + 2);
      const len = parseInt(text.substring(idx + 2, idx + 4), 10);
      if (isNaN(len) || len <= 0 || idx + 4 + len > text.length) break;
      res[tag] = text.substring(idx + 4, idx + 4 + len);
      idx += 4 + len;
    }
    return res;
  }

  // Handle standard BOT Mini QR TLV (with outer wrapper Tag 00)
  const outer = parseTlv(qrText);
  let inner = {};
  if (outer['00']) {
    inner = parseTlv(outer['00']);
  }

  bankCode = inner['01'] || outer['01'] || '';
  transRef = inner['02'] || outer['02'] || '';

  if (!bankCode && qrText.startsWith('000001')) {
    bankCode = qrText.substring(6, 9);
    transRef = qrText.substring(9);
  }

  // URL-based verification QR format (e.g. scb, kasikorn, ktb, promptpay links)
  if (!transRef && (qrText.startsWith('http://') || qrText.startsWith('https://'))) {
    try {
      const url = new URL(qrText);
      transRef = url.searchParams.get('ref') || url.searchParams.get('transRef') || url.pathname.split('/').filter(Boolean).pop() || '';
      const host = url.hostname.toLowerCase();
      if (host.includes('scb')) bankCode = '014';
      else if (host.includes('kasikorn') || host.includes('kbank')) bankCode = '004';
      else if (host.includes('krungthai') || host.includes('ktb')) bankCode = '006';
      else if (host.includes('bangkokbank') || host.includes('bbl')) bankCode = '002';
      else if (host.includes('ttb')) bankCode = '011';
      else if (host.includes('gsb')) bankCode = '030';
      else if (host.includes('bay') || host.includes('krungsri')) bankCode = '025';
    } catch (e) {}
  }

  // Fallback if raw text
  if (!transRef && qrText.length >= 8) {
    transRef = qrText.substring(0, 32);
  }

  const bankInfo = THAI_BANK_CODES[bankCode] || null;
  const bankName = bankInfo ? bankInfo.name : (bankCode ? `ธนาคารรหัส ${bankCode}` : 'ธนาคารผู้โอน');

  return {
    isValid: Boolean(transRef),
    bankCode,
    bankName,
    transRef,
    rawQr
  };
}

// Perform scan, parse, duplicate check, expiry check and UI feedback
async function scanUploadedSlip(imgEl, file) {
  const statusBox = document.getElementById('slipDetectStatusBox');
  const btnConfirm = document.getElementById('btnConfirmCheckout');

  try {
    const rawQr = decodeQrFromImageElement(imgEl);

    if (!rawQr) {
      // Slip without detectable QR (strictly reject non-slip or unreadable images)
      currentSlipVerification = {
        isScanning: false,
        detected: false,
        rawQr: '',
        bankCode: '',
        bankName: '',
        transRef: '',
        isDuplicate: false,
        isExpired: false,
        duplicateMessage: '',
        error: 'รูปภาพที่แนบไม่ใช่สลิปโอนเงิน หรือระบบตรวจไม่พบ QR Code ในภาพ'
      };

      if (statusBox) {
        statusBox.className = 'p-3 rounded-2xl border-2 border-rose-400 bg-rose-50 text-xs text-left transition-all shadow-xs';
        statusBox.innerHTML = `
          <div class="flex items-center gap-1.5 font-black text-rose-800">
            <span class="text-base">❌</span>
            <span>รูปภาพนี้ไม่ใช่สลิปโอนเงิน หรือไม่พบ QR Code</span>
          </div>
          <div class="text-[11px] text-rose-700 font-medium mt-1 leading-snug">
            ระบบตรวจไม่พบ Mini QR Code สำหรับตรวจสอบยอดเงิน กรุณาแนบรูปสลิปธนาคารที่ชัดเจนและมี QR Code นะคะ (ไม่อนุญาตให้ใช้รูปภาพทั่วไป)
          </div>
        `;
      }
      if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.classList.add('opacity-50', 'cursor-not-allowed');
      }
      return;
    }

    // QR detected! Parse details
    const parsed = parseSlipQrPayload(rawQr);

    if (!parsed || !parsed.transRef) {
      currentSlipVerification = {
        isScanning: false,
        detected: false,
        rawQr,
        bankCode: '',
        bankName: '',
        transRef: '',
        isDuplicate: false,
        isExpired: false,
        duplicateMessage: '',
        error: 'QR Code ในภาพไม่ใช่สลิปโอนเงินธนาคาร'
      };

      if (statusBox) {
        statusBox.className = 'p-3 rounded-2xl border-2 border-rose-400 bg-rose-50 text-xs text-left transition-all shadow-xs';
        statusBox.innerHTML = `
          <div class="flex items-center gap-1.5 font-black text-rose-800">
            <span class="text-base">❌</span>
            <span>QR Code ในรูปภาพไม่ใช่สลิปโอนเงินธนาคาร</span>
          </div>
          <div class="text-[11px] text-rose-700 font-medium mt-1 leading-snug">
            กรุณาใช้สลิปโอนเงินจากแอปธนาคารที่มี QR Code ตรวจสอบธุรกรรมค่ะ
          </div>
        `;
      }
      if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.classList.add('opacity-50', 'cursor-not-allowed');
      }
      return;
    }

    // 1. Check Slip Date Expiry (Reject Old Slips)
    const expiry = checkSlipDateExpiry(parsed.transRef);
    if (expiry.isExpired) {
      currentSlipVerification = {
        isScanning: false,
        detected: false,
        isExpired: true,
        rawQr: parsed.rawQr,
        bankCode: parsed.bankCode,
        bankName: parsed.bankName,
        transRef: parsed.transRef,
        error: expiry.error
      };

      if (statusBox) {
        statusBox.className = 'p-3 rounded-2xl border-2 border-rose-400 bg-rose-50 text-xs text-left transition-all shadow-xs';
        statusBox.innerHTML = `
          <div class="flex items-center gap-1.5 font-black text-rose-800">
            <span class="text-base">❌</span>
            <span>ตรวจพบสลิปเก่าหมดอายุ!</span>
          </div>
          <div class="text-[11px] text-rose-700 font-medium mt-1 leading-snug">
            ${escapeHtml(expiry.error)}
          </div>
          <div class="text-[10px] text-rose-600 font-mono mt-1 bg-white/70 px-2 py-0.5 rounded border border-rose-200 inline-block">
            Ref: ${escapeHtml(parsed.transRef)}
          </div>
        `;
      }
      if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.classList.add('opacity-50', 'cursor-not-allowed');
      }
      showToast('⚠️ สลิปนี้เป็นสลิปเก่า หมดอายุแล้วค่ะ');
      return;
    }

    // 2. Check duplicate slip with backend server
    let isDuplicate = false;
    let dupMessage = '';
    try {
      const res = await fetch('/api/verify-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transRef: parsed.transRef,
          bankCode: parsed.bankCode,
          bankName: parsed.bankName,
          qrRaw: parsed.rawQr
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        if (resData.isExpired) {
          currentSlipVerification = {
            isScanning: false,
            detected: false,
            isExpired: true,
            error: resData.error || 'สลิปนี้หมดอายุแล้ว'
          };
          if (statusBox) {
            statusBox.className = 'p-3 rounded-2xl border-2 border-rose-400 bg-rose-50 text-xs text-left transition-all shadow-xs';
            statusBox.innerHTML = `
              <div class="flex items-center gap-1.5 font-black text-rose-800">
                <span class="text-base">❌</span>
                <span>ตรวจพบสลิปเก่าหมดอายุ!</span>
              </div>
              <div class="text-[11px] text-rose-700 font-medium mt-1 leading-snug">
                ${escapeHtml(resData.error)}
              </div>
            `;
          }
          if (btnConfirm) {
            btnConfirm.disabled = true;
            btnConfirm.classList.add('opacity-50', 'cursor-not-allowed');
          }
          return;
        }

        if (resData.isDuplicate) {
          isDuplicate = true;
          dupMessage = resData.error || 'สลิปนี้ถูกใช้งานไปแล้วในคำสั่งซื้อก่อนหน้า';
        }
      }
    } catch (netErr) {
      console.warn('Verify-slip check network fallback', netErr);
    }

    currentSlipVerification = {
      isScanning: false,
      detected: true,
      rawQr: parsed.rawQr,
      bankCode: parsed.bankCode,
      bankName: parsed.bankName,
      transRef: parsed.transRef,
      isDuplicate,
      isExpired: false,
      duplicateMessage: dupMessage,
      error: null
    };

    if (isDuplicate) {
      if (statusBox) {
        statusBox.className = 'p-3 rounded-2xl border-2 border-rose-400 bg-rose-50 text-xs text-left transition-all shadow-xs';
        statusBox.innerHTML = `
          <div class="flex items-center gap-1.5 font-black text-rose-800">
            <span class="text-base">❌</span>
            <span>ตรวจพบการใช้สลิปซ้ำ! (ไม่อนุญาตให้ใช้สลิปนี้)</span>
          </div>
          <div class="text-[11px] text-rose-700 font-medium mt-1 leading-snug">
            ${escapeHtml(dupMessage)}
          </div>
          <div class="text-[10px] text-rose-600 font-mono mt-1 bg-white/70 px-2 py-0.5 rounded border border-rose-200 inline-block">
            Ref: ${escapeHtml(parsed.transRef)}
          </div>
        `;
      }
      if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.classList.add('opacity-50', 'cursor-not-allowed');
      }
      showToast('⚠️ สลิปนี้ถูกใช้งานไปแล้ว ไม่สามารถใช้ซ้ำได้ค่ะ');
      return;
    }

    // Slip is VALID and UNIQUE!
    if (statusBox) {
      statusBox.className = 'p-3 rounded-2xl border border-emerald-300 bg-emerald-50 text-xs text-left transition-all shadow-xs';
      statusBox.innerHTML = `
        <div class="flex items-center justify-between gap-1">
          <div class="flex items-center gap-1.5 font-black text-emerald-900">
            <span class="text-base">✅</span>
            <span>ตรวจพบสลิปถูกต้อง (${escapeHtml(parsed.bankName)})</span>
          </div>
          <span class="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">สลิปใหม่ ✓</span>
        </div>
        <div class="text-[11px] text-emerald-800 font-mono mt-1 flex items-center gap-1">
          <span class="text-[10px] text-emerald-600 font-sans font-semibold">Ref ID:</span>
          <span class="bg-white/90 px-1.5 py-0.5 rounded border border-emerald-200 font-bold">${escapeHtml(parsed.transRef)}</span>
        </div>
        <div class="text-[10px] text-emerald-700 mt-1">
          สลิปผ่านการตรวจจับ Mini QR และไม่พบประวัติการใช้งานซ้ำค่ะ ♡
        </div>
      `;
    }

    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.classList.remove('opacity-50', 'cursor-not-allowed');
    }

  } catch (err) {
    console.error('Scan slip error', err);
    if (statusBox) {
      statusBox.className = 'p-3 rounded-2xl border border-rose-300 bg-rose-50 text-xs text-left';
      statusBox.innerHTML = `
        <div class="flex items-center gap-1 font-bold text-rose-900">
          <span>❌</span>
          <span>ไม่สามารถสแกนสลิปได้ กรุณาลองแนบใหม่อีกครั้ง</span>
        </div>
      `;
    }
  }
}

// Order Status Polling for Pending Review
let orderPollingInterval = null;

function stopOrderStatusPolling() {
  if (orderPollingInterval) {
    clearInterval(orderPollingInterval);
    orderPollingInterval = null;
  }
}

function startOrderStatusPolling(orderId, item) {
  stopOrderStatusPolling();
  orderPollingInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/order-status/${encodeURIComponent(orderId)}?t=` + Date.now());
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'completed') {
          stopOrderStatusPolling();
          handleCheckoutSuccess({ order: data, skinUrl: data.skinUrl }, item);
          showToast('🎉 แอดมินตรวจสอบยอดเงินสำเร็จแล้ว! ดาวน์โหลดสกินได้เลยนะคะ ♡');
        } else if (data.status === 'rejected') {
          stopOrderStatusPolling();
          alert('❌ คำสั่งซื้อนี้ถูกปฏิเสธ: แอดมินไม่พบยอดเงินเข้าบัญชีร้าน (095-989-1045) หรือยอดเงินในสลิปไม่ตรงกับราคาสกินค่ะ');
          closePremadeCheckoutModal();
        }
      }
    } catch (e) {
      console.warn('Polling order status error', e);
    }
  }, 3000);
}

function handleCheckoutPending(data, item) {
  const stepForm = document.getElementById('checkoutStepForm');
  const pendingView = document.getElementById('checkoutPendingView');
  const successView = document.getElementById('checkoutSuccessView');

  if (stepForm) stepForm.classList.add('hidden');
  if (successView) successView.classList.add('hidden');
  if (pendingView) pendingView.classList.remove('hidden');

  const orderIdEl = document.getElementById('checkoutPendingOrderId');
  if (orderIdEl) orderIdEl.textContent = '#' + (data.order && data.order.orderId ? data.order.orderId : '');

  // Save to customer local purchase history
  saveCustomerOrderLocal(data.order, item, 'pending');

  // Refresh admin badge
  loadAdminOrders(true);

  // Start real-time polling so customer gets skin the moment admin approves
  if (data.order && data.order.orderId) {
    startOrderStatusPolling(data.order.orderId, item);
  }
  lucide.createIcons();
}

async function submitPremadeCheckout() {
  const item = (appData.items || []).find(i => i.id === activePremadeId);
  if (!item) return;

  const buyerContactInput = document.getElementById('checkoutBuyerContact');
  const buyerContact = (buyerContactInput ? buyerContactInput.value : '').trim();
  if (!buyerContact) {
    alert('กรุณากรอก Discord Username หรือช่องทางติดต่อผู้ซื้อด้วยนะคะ ♡');
    if (buyerContactInput) buyerContactInput.focus();
    return;
  }

  // Mandatory Slip Verification Checks
  if (!selectedCheckoutSlipFile) {
    alert('กรุณาแนบรูปภาพสลิปโอนเงินก่อนยืนยันการชำระเงินนะคะ ♡');
    return;
  }

  if (currentSlipVerification.isScanning) {
    alert('⏳ ระบบกำลังประมวลผลสแกนสลิปโอนเงิน กรุณารอสักครู่นะคะ');
    return;
  }

  if (currentSlipVerification.isExpired) {
    alert('❌ ตรวจพบสลิปเก่าหมดอายุ!\n' + (currentSlipVerification.error || 'ระบบรับเฉพาะสลิปการโอนเงินของวันนี้เท่านั้นค่ะ'));
    return;
  }

  if (!currentSlipVerification.detected || !currentSlipVerification.transRef) {
    alert('❌ ไม่สามารถทำรายการได้!\n' + (currentSlipVerification.error || 'รูปภาพที่แนบไม่ใช่สลิปโอนเงิน หรือไม่พบ QR Code ในภาพ\nกรุณาแนบสลิปธนาคารที่มี QR Code ชัดเจนนะคะ ♡'));
    return;
  }

  if (currentSlipVerification.isDuplicate) {
    alert('❌ ตรวจพบการใช้สลิปซ้ำ!\n' + (currentSlipVerification.duplicateMessage || 'สลิปนี้ถูกใช้งานไปแล้วในระบบ กรุณาใช้สลิปการโอนเงินใหม่นะคะ'));
    return;
  }

  const btn = document.getElementById('btnConfirmCheckout');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span><span>กำลังดำเนินการตรวจสอบสลิป...</span>';
  }

  const formData = new FormData();
  formData.append('itemId', item.id);
  formData.append('buyerContact', buyerContact);
  formData.append('paymentMethod', currentPaymentMethod);
  formData.append('slipFile', selectedCheckoutSlipFile);

  // Pass verified slip metadata
  formData.append('transRef', currentSlipVerification.transRef || '');
  formData.append('bankCode', currentSlipVerification.bankCode || '');
  formData.append('bankName', currentSlipVerification.bankName || '');
  formData.append('slipVerified', 'true');
  formData.append('slipQrRaw', currentSlipVerification.rawQr || '');

  try {
    const res = await fetch('/api/order', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>⚡</span><span>ยืนยันการชำระเงิน & รับสกินทันที</span>';
      }
      if (data.status === 'completed') {
        handleCheckoutSuccess(data, item);
      } else {
        handleCheckoutPending(data, item);
      }
      return;
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData && errData.error) {
        alert('⚠️ การสั่งซื้อไม่สำเร็จ: ' + errData.error);
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>⚡</span><span>ยืนยันการชำระเงิน & รับสกินทันที</span>';
        }
        return;
      }
    }
  } catch (err) {
    console.warn('API order error, fallback local', err);
  }

  // Local Fallback
  if (item.licenseType !== 'unlimited') {
    item.status = 'sold';
  }
  persistLocal();

  const fallbackOrder = {
    orderId: 'ORD-' + Date.now(),
    skinUrl: item.skinTexture || item.image || '/uploads/custom-yuki-skin.png'
  };
  handleCheckoutSuccess({ order: fallbackOrder, skinUrl: fallbackOrder.skinUrl }, item);
}

function handleCheckoutSuccess(data, item) {
  const orderId = (data.order && data.order.orderId) ? data.order.orderId : ('ORD-' + Date.now());
  const skinUrl = data.skinUrl || item.skinTexture || item.image || '/uploads/custom-yuki-skin.png';

  // If exclusive, mark sold locally
  if (item.licenseType !== 'unlimited') {
    item.status = 'sold';
    renderPremadeCards();
    if (activePremadeId === item.id) {
      openPremadeDetail(item.id);
    }
  }

  const orderIdEl = document.getElementById('checkoutSuccessOrderId');
  if (orderIdEl) orderIdEl.textContent = '#' + orderId;

  // Save to customer local purchase history
  saveCustomerOrderLocal(data.order || { orderId, skinUrl }, item, 'completed');

  const dlBtn = document.getElementById('checkoutDownloadBtn');
  if (dlBtn) {
    dlBtn.href = skinUrl;
    dlBtn.setAttribute('download', `[YukiShop]-${(item.title || 'skin').replace(/\s+/g, '_')}.png`);
  }

  const stepForm = document.getElementById('checkoutStepForm');
  const successView = document.getElementById('checkoutSuccessView');
  if (stepForm) stepForm.classList.add('hidden');
  if (successView) successView.classList.remove('hidden');

  const btn = document.getElementById('btnConfirmCheckout');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span>✅</span><span>ยืนยันการชำระเงินและรับสกิน</span>';
  }

  // 1. Play sweet celebration chime
  playSuccessChime();

  // 2. Fire colorful confetti celebration
  fireCelebrationConfetti();

  // 3. Show live purchase celebration toast
  showLivePurchaseToast({
    itemTitle: item.title,
    price: item.price || item.priceFull || '250฿',
    buyer: 'คุณ',
    skinUrl: skinUrl,
    itemId: item.id
  });

  showToast('🎉 ชำระเงินสำเร็จแล้ว! ดาวน์โหลดสกินได้เลยนะคะ ♡');
  loadAdminOrders(true);
  lucide.createIcons();
}

// ==================== CUSTOMER PURCHASE HISTORY MODULE ====================
function getCustomerOrdersLocal() {
  try {
    const raw = localStorage.getItem('yuki_customer_orders');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCustomerOrderLocal(order, item, overrideStatus) {
  if (!order || !order.orderId) return;
  try {
    const orders = getCustomerOrdersLocal();
    const existingIdx = orders.findIndex(o => o.orderId === order.orderId);
    const orderData = {
      orderId: order.orderId,
      itemId: item ? item.id : (order.itemId || ''),
      itemTitle: item ? item.title : (order.itemTitle || 'สกินสำเร็จรูป'),
      itemImage: item ? (item.image || item.skinTexture || '') : (order.itemImage || ''),
      price: item ? (item.price || item.priceFull || '250฿') : (order.price || ''),
      status: overrideStatus || order.status || 'pending',
      skinUrl: order.skinUrl || (overrideStatus === 'completed' && item ? (item.skinTexture || item.image) : null),
      buyerContact: order.buyerContact || '',
      date: order.createdAt || new Date().toISOString()
    };

    if (existingIdx >= 0) {
      orders[existingIdx] = { ...orders[existingIdx], ...orderData };
    } else {
      orders.unshift(orderData);
    }
    localStorage.setItem('yuki_customer_orders', JSON.stringify(orders));
    updateCustomerOrdersBadge();
  } catch (e) {
    console.warn('Failed to save customer order local', e);
  }
}

function updateCustomerOrdersBadge() {
  const badge = document.getElementById('customerOrdersBadge');
  if (!badge) return;
  const orders = getCustomerOrdersLocal();
  if (orders.length > 0) {
    badge.textContent = orders.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

async function openCustomerOrdersModal() {
  const modal = document.getElementById('customerOrdersModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  await refreshCustomerOrders(false);
}

function closeCustomerOrdersModal() {
  const modal = document.getElementById('customerOrdersModal');
  if (modal) modal.classList.add('hidden');
}

async function refreshCustomerOrders(isUserClick = false) {
  const orders = getCustomerOrdersLocal();
  const listContainer = document.getElementById('customerOrdersList');

  if (isUserClick) {
    showToast('กำลังตรวจสอบสถานะคำสั่งซื้อล่าสุด... 🔄');
  }

  // Poll server for any pending orders to see if admin approved
  let hasUpdates = false;
  for (let i = 0; i < orders.length; i++) {
    if (orders[i].status === 'pending') {
      try {
        const res = await fetch(`/api/order-status/${encodeURIComponent(orders[i].orderId)}?t=` + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data.status && data.status !== 'pending') {
            orders[i].status = data.status;
            if (data.skinUrl) orders[i].skinUrl = data.skinUrl;
            hasUpdates = true;
          }
        }
      } catch (err) {
        console.warn('Check order status error', err);
      }
    }
  }

  if (hasUpdates) {
    try {
      localStorage.setItem('yuki_customer_orders', JSON.stringify(orders));
      updateCustomerOrdersBadge();
    } catch (e) {}
    if (isUserClick) {
      showToast('🎉 มีคำสั่งซื้อได้รับการอนุมัติแล้ว! ดาวน์โหลดสกินได้เลยค่ะ');
    }
  } else if (isUserClick) {
    showToast('ข้อมูลคำสั่งซื้ออัปเดตล่าสุดแล้วค่ะ ✨');
  }

  renderCustomerOrders(orders);
}

function renderCustomerOrders(orders) {
  const container = document.getElementById('customerOrdersList');
  if (!container) return;

  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div class="py-12 px-4 text-center rounded-2xl bg-purple-50/50 border border-purple-200/60 space-y-2">
        <div class="text-3xl">🛍️</div>
        <div class="text-xs font-bold text-purple-950">ยังไม่มีประวัติการซื้อในอุปกรณ์นี้</div>
        <p class="text-[11px] text-purple-500 max-w-xs mx-auto">
          เมื่อคุณสั่งซื้อสกินสำเร็จรูป คำสั่งซื้อจะปรากฏที่นี่โดยอัตโนมัติ เพื่อให้กลับมาดาวน์โหลดไฟล์สกินได้ตลอดเวลาค่ะ ♡
        </p>
      </div>
    `;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    return;
  }

  container.innerHTML = orders.map(ord => {
    const isCompleted = ord.status === 'completed';
    const isPending = ord.status === 'pending';
    const isRejected = ord.status === 'rejected';

    const thaiDate = ord.date ? new Date(ord.date).toLocaleString('th-TH', { 
      day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
    }) : '';

    return `
      <div class="p-3.5 rounded-2xl bg-white border ${isCompleted ? 'border-emerald-300 shadow-sm' : isPending ? 'border-amber-300 bg-amber-50/30' : 'border-rose-200'} transition flex flex-col gap-2.5">
        
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200/80 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
              <img src="${escapeHtml(ord.itemImage || ord.skinUrl || 'uploads/custom-yuki-skin.png')}" alt="skin preview" class="w-full h-full object-contain" />
            </div>
            <div>
              <h4 class="text-xs sm:text-sm font-bold text-purple-950 leading-tight">${escapeHtml(ord.itemTitle || 'สกินมายคราฟ')}</h4>
              <div class="flex items-center gap-2 mt-0.5 text-[10px] text-purple-500 font-mono">
                <span>#${escapeHtml(ord.orderId)}</span>
                <span>•</span>
                <span>${escapeHtml(thaiDate)}</span>
              </div>
              <div class="text-[11px] font-black text-purple-800 mt-0.5">
                ${escapeHtml(ord.price || '')}
              </div>
            </div>
          </div>

          <div class="shrink-0 text-right">
            ${isCompleted ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                <span>✅</span><span>อนุมัติแล้ว</span>
              </span>
            ` : isPending ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs animate-pulse">
                <span>⏳</span><span>รอแอดมินยืนยัน</span>
              </span>
            ` : `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                <span>❌</span><span>ไม่อนุมัติ</span>
              </span>
            `}
          </div>
        </div>

        <!-- Action / Status Description -->
        <div class="pt-2 border-t border-purple-100/80 flex items-center justify-between gap-2 flex-wrap">
          ${isCompleted ? `
            <div class="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
              <span>✨</span><span>ไฟล์สกินพร้อมใช้งานแล้ว โหลดลงเกมได้ทันทีค่ะ</span>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <a 
                href="${escapeHtml(ord.skinUrl || 'uploads/custom-yuki-skin.png')}" 
                download="[YukiShop]-${escapeHtml((ord.itemTitle || 'skin').replace(/\s+/g, '_'))}.png"
                class="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>📥</span>
                <span>ดาวน์โหลดไฟล์สกิน (.PNG)</span>
              </a>
            </div>
          ` : isPending ? `
            <div class="text-[10px] text-amber-700 flex items-center gap-1">
              <span>🔄</span><span>สลิปส่งเข้า Discord แอดมินแล้ว กำลังรอตรวจสอบยอดเงิน...</span>
            </div>
            <button 
              type="button" 
              onclick="checkSingleCustomerOrder('${ord.orderId}')"
              class="px-3 py-1 rounded-xl text-[11px] font-bold text-purple-800 bg-purple-100 hover:bg-purple-200 border border-purple-200 transition ml-auto flex items-center gap-1 cursor-pointer"
            >
              <span>🔄</span>
              <span>เช็คสถานะ</span>
            </button>
          ` : `
            <div class="text-[10px] text-rose-600">
              ยอดเงินในสลิปไม่ตรง หรือไม่พบยอดเงิน กรุณาติดต่อแอดมินทาง Discord
            </div>
          `}
        </div>

      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

async function checkSingleCustomerOrder(orderId) {
  try {
    showToast('กำลังเช็คสถานะคำสั่งซื้อ #' + orderId + '... ⏳');
    const res = await fetch(`/api/order-status/${encodeURIComponent(orderId)}?t=` + Date.now());
    if (res.ok) {
      const data = await res.json();
      const orders = getCustomerOrdersLocal();
      const target = orders.find(o => o.orderId === orderId);
      if (target) {
        target.status = data.status || target.status;
        if (data.skinUrl) target.skinUrl = data.skinUrl;
        localStorage.setItem('yuki_customer_orders', JSON.stringify(orders));
        updateCustomerOrdersBadge();
        renderCustomerOrders(orders);
      }
      if (data.status === 'completed') {
        showToast('🎉 คำสั่งซื้อได้รับการอนุมัติแล้ว! กดดาวน์โหลดได้เลยค่ะ ♡');
      } else if (data.status === 'rejected') {
        showToast('❌ คำสั่งซื้อนี้ไม่ผ่านการอนุมัติ กรุณาติดต่อแอดมิน');
      } else {
        showToast('⏳ แอดมินกำลังตรวจสอบยอดเงิน โปรดรอสักครู่นะคะ');
      }
    }
  } catch (e) {
    showToast('เกิดข้อผิดพลาดในการตรวจสอบสถานะ');
  }
}

async function searchCustomerOrdersServer() {
  const input = document.getElementById('customerOrderSearchInput');
  const query = (input ? input.value : '').trim();
  if (!query) {
    refreshCustomerOrders();
    return;
  }

  showToast('กำลังค้นหาคำสั่งซื้อ: ' + query + '... 🔍');
  try {
    const res = await fetch('/api/customer-orders?q=' + encodeURIComponent(query));
    if (res.ok) {
      const data = await res.json();
      const serverOrders = data.orders || [];
      if (serverOrders.length === 0) {
        showToast('ไม่พบคำสั่งซื้อที่ตรงกับ: ' + query);
        renderCustomerOrders([]);
        return;
      }
      
      // Merge with local orders
      const localOrders = getCustomerOrdersLocal();
      serverOrders.forEach(so => {
        const idx = localOrders.findIndex(lo => lo.orderId === so.orderId);
        if (idx >= 0) {
          localOrders[idx] = { ...localOrders[idx], ...so };
        } else {
          localOrders.unshift(so);
        }
      });
      localStorage.setItem('yuki_customer_orders', JSON.stringify(localOrders));
      updateCustomerOrdersBadge();
      renderCustomerOrders(serverOrders);
      showToast(`พบประวัติคำสั่งซื้อ ${serverOrders.length} รายการ! ✨`);
    }
  } catch (err) {
    console.warn('Search customer orders error', err);
    showToast('ไม่สามารถค้นหาได้ในขณะนี้');
  }
}

// ==================== CELEBRATION CHIME & CONFETTI ====================
function playSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    function playTone(freq, time, duration) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + time + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + duration);
    }

    // High sweet two-tone chime (E6 -> A6)
    playTone(1318.51, 0, 0.35);
    playTone(1760.00, 0.12, 0.55);
  } catch (e) {
    console.warn('Audio chime notice:', e);
  }
}

function fireCelebrationConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  canvas.classList.remove('hidden');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const particles = [];
  const colors = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#a855f7'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: canvas.width * 0.5 + (Math.random() - 0.5) * 180,
      y: canvas.height * 0.4 + (Math.random() - 0.5) * 80,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 4,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -12 - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      opacity: 1
    });
  }

  const startTime = Date.now();

  function animate() {
    const elapsed = Date.now() - startTime;
    if (elapsed > 3500) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.classList.add('hidden');
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.vx *= 0.98; // air drag
      p.rot += p.rotSpeed;
      if (elapsed > 2000) {
        p.opacity = Math.max(0, 1 - (elapsed - 2000) / 1500);
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    requestAnimationFrame(animate);
  }

  animate();
}

// ==================== LIVE SOCIAL PROOF TICKER ====================
let livePurchaseTickerTimer = null;
let recentPurchasesList = [];
let liveToastHideTimeout = null;

function showLivePurchaseToast(order) {
  if (!order) return;
  const toast = document.getElementById('livePurchaseToast');
  const img = document.getElementById('livePurchaseImg');
  const title = document.getElementById('livePurchaseTitle');
  const detail = document.getElementById('livePurchaseDetail');
  if (!toast) return;

  if (img) img.src = order.skinUrl || 'uploads/custom-yuki-skin.png';
  if (title) title.textContent = order.itemTitle || 'สกินสำเร็จรูป';
  if (detail) {
    const buyer = order.buyer || 'ลูกค้า Discord';
    const price = order.price || '250 ฿';
    detail.textContent = `คุณ ${buyer} • ${price} • สั่งซื้อสำเร็จ ✨`;
  }

  toast.dataset.targetItemId = order.itemId || '';
  toast.classList.remove('hidden');
  toast.classList.add('flex');

  if (liveToastHideTimeout) clearTimeout(liveToastHideTimeout);
  liveToastHideTimeout = setTimeout(() => {
    closeLivePurchaseToast();
  }, 6500);
}

function closeLivePurchaseToast() {
  const toast = document.getElementById('livePurchaseToast');
  if (toast) {
    toast.classList.add('hidden');
    toast.classList.remove('flex');
  }
}

function handleLiveToastClick() {
  const toast = document.getElementById('livePurchaseToast');
  const itemId = toast?.dataset?.targetItemId;
  if (itemId && typeof openPremadeDetail === 'function') {
    switchPageTab('premade');
    openPremadeDetail(itemId);
  }
}

async function fetchRecentPurchases() {
  try {
    const res = await fetch('/api/recent-purchases?t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.purchases) && data.purchases.length > 0) {
        recentPurchasesList = data.purchases;
        return true;
      }
    }
  } catch (e) {}
  return false;
}

function startLivePurchaseTicker() {
  if (livePurchaseTickerTimer) clearInterval(livePurchaseTickerTimer);

  // Initial fetch after 4 seconds
  setTimeout(async () => {
    const hasData = await fetchRecentPurchases();
    if (hasData && recentPurchasesList.length > 0) {
      const randomOrder = recentPurchasesList[Math.floor(Math.random() * recentPurchasesList.length)];
      showLivePurchaseToast(randomOrder);
    }
  }, 4500);

  // Recurring ticker every 35 seconds
  livePurchaseTickerTimer = setInterval(async () => {
    if (appData.siteConfig && appData.siteConfig.liveSocialProof === false) return;
    await fetchRecentPurchases();
    if (recentPurchasesList.length > 0) {
      const randomOrder = recentPurchasesList[Math.floor(Math.random() * recentPurchasesList.length)];
      showLivePurchaseToast(randomOrder);
    }
  }, 35000);
}

function filterPremadeStatus(status) {
  premadeFilter = status;

  const btnAll = document.getElementById('filterPremadeAll');
  const btnAvail = document.getElementById('filterPremadeAvail');
  const btnSold = document.getElementById('filterPremadeSold');

  const activeBtnClass = 'px-3 py-1 rounded-xl text-xs font-bold bg-purple-600 text-white shadow-xs transition';
  const inactiveBtnClass = 'px-3 py-1 rounded-xl text-xs font-medium text-purple-800 hover:bg-purple-100 transition flex items-center gap-1';

  if (btnAll) btnAll.className = status === 'all' ? activeBtnClass : inactiveBtnClass;
  if (btnAvail) btnAvail.className = status === 'available' ? activeBtnClass : inactiveBtnClass;
  if (btnSold) btnSold.className = status === 'sold' ? activeBtnClass : inactiveBtnClass;

  renderPremadeCards();
}

function setPremadePose(pose) {
  premadeCurrentPose = pose;
  if (!premadeSkinViewer) return;

  const poses = ['stand', 'walk', 'run', 'sit'];
  poses.forEach(p => {
    const btn = document.getElementById(`premadePose${p.charAt(0).toUpperCase() + p.slice(1)}`);
    if (btn) {
      if (p === pose) {
        btn.className = 'px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-600 text-white shadow-xs transition';
      } else {
        btn.className = 'px-2 py-0.5 rounded-lg text-[10px] text-purple-800 hover:bg-purple-100 transition';
      }
    }
  });

  if (pose === 'stand') {
    premadeSkinViewer.animation = null;
    if (premadeSkinViewer.playerObject && premadeSkinViewer.playerObject.skin) {
      const skin = premadeSkinViewer.playerObject.skin;
      skin.leftLeg.rotation.x = 0;
      skin.rightLeg.rotation.x = 0;
      skin.leftArm.rotation.x = 0;
      skin.rightArm.rotation.x = 0;
      skin.head.rotation.y = 0;
    }
  } else if (pose === 'walk') {
    premadeSkinViewer.animation = new skinview3d.WalkingAnimation();
    premadeSkinViewer.animation.speed = 0.8;
  } else if (pose === 'run') {
    premadeSkinViewer.animation = new skinview3d.RunningAnimation();
    premadeSkinViewer.animation.speed = 1.1;
  } else if (pose === 'sit') {
    premadeSkinViewer.animation = null;
    if (premadeSkinViewer.playerObject && premadeSkinViewer.playerObject.skin) {
      const skin = premadeSkinViewer.playerObject.skin;
      skin.leftLeg.rotation.x = -Math.PI / 2;
      skin.rightLeg.rotation.x = -Math.PI / 2;
      skin.leftArm.rotation.x = -0.15;
      skin.rightArm.rotation.x = -0.15;
    }
  }
}

function togglePremadeAutoRotate() {
  isPremadeAutoRotating = !isPremadeAutoRotating;
  const icon = document.getElementById('premadeRotateIcon');
  const text = document.getElementById('premadeRotateText');
  if (icon && text) {
    if (isPremadeAutoRotating) {
      icon.textContent = '⏸️';
      text.textContent = 'หยุดหมุน';
    } else {
      icon.textContent = '▶️';
      text.textContent = 'หมุน 360°';
    }
  }
}

function resetPremadeRotation() {
  isPremadeAutoRotating = false;
  premadeCamAzimuth = 0;
  const icon = document.getElementById('premadeRotateIcon');
  const text = document.getElementById('premadeRotateText');
  if (icon && text) {
    icon.textContent = '▶️';
    text.textContent = 'หมุน 360°';
  }
  if (premadeSkinViewer && premadeSkinViewer.camera) {
    premadeSkinViewer.camera.position.set(0, -2, 44);
    premadeSkinViewer.camera.lookAt(0, -2, 0);
  }
}

function rotatePremadeBack() {
  isPremadeAutoRotating = false;
  premadeCamAzimuth = Math.PI;
  const icon = document.getElementById('premadeRotateIcon');
  const text = document.getElementById('premadeRotateText');
  if (icon && text) {
    icon.textContent = '▶️';
    text.textContent = 'หมุน 360°';
  }
  if (premadeSkinViewer && premadeSkinViewer.camera) {
    premadeSkinViewer.camera.position.set(0, -2, -44);
    premadeSkinViewer.camera.lookAt(0, -2, 0);
  }
}

function orderPremadeSkin() {
  openPremadeCheckoutModal(activePremadeId);
}

async function toggleActivePremadeStatus() {
  const item = (appData.items || []).find(i => i.id === activePremadeId);
  if (!item) return;

  const newStatus = (item.status === 'sold') ? 'available' : 'sold';
  item.status = newStatus;

  try {
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (res.ok) {
      showToast(`เปลี่ยนสถานะเป็น "${newStatus === 'sold' ? 'ขายแล้ว' : 'พร้อมส่ง'}" แล้ว!`);
      openPremadeDetail(item.id);
      renderPremadeCards();
      return;
    }
  } catch (err) {
    console.warn('API error updating premade status', err);
  }

  persistLocal();
  showToast(`เปลี่ยนสถานะเป็น "${newStatus === 'sold' ? 'ขายแล้ว' : 'พร้อมส่ง'}" แล้ว!`);
  openPremadeDetail(item.id);
  renderPremadeCards();
}

function openAddPremadeModal() {
  openAddModal();
  const titleEl = document.getElementById('modalTitle');
  if (titleEl) titleEl.innerHTML = `<span>✨</span><span>เพิ่มสกินสำเร็จรูป</span>`;
  const catSelect = document.getElementById('itemCategorySelect');
  if (catSelect) {
    if (!Array.from(catSelect.options).some(o => o.value === 'สกินสำเร็จ')) {
      const opt = document.createElement('option');
      opt.value = 'สกินสำเร็จ';
      opt.textContent = 'สกินสำเร็จ';
      catSelect.appendChild(opt);
    }
    catSelect.value = 'สกินสำเร็จ';
  }
  const licenseSelect = document.getElementById('itemLicenseSelect');
  if (licenseSelect) licenseSelect.value = 'exclusive';
  const modelTypeSelect = document.getElementById('itemModelTypeSelect');
  if (modelTypeSelect) modelTypeSelect.value = 'slim';

  const resInput = document.getElementById('itemResolutionInput');
  if (resInput) resInput.value = '64x64 HD Standard';
  const editionInput = document.getElementById('itemEditionInput');
  if (editionInput) editionInput.value = 'Java & Bedrock Edition';
  const incInput = document.getElementById('itemIncludedInput');
  if (incInput) incInput.value = 'ไฟล์ .PNG คมชัด • ดาวน์โหลดทันที';
  const licTextInput = document.getElementById('itemLicenseTextInput');
  if (licTextInput) licTextInput.value = '👑 ซื้อคนเดียว (สิทธิ์ขาด 1 คนเท่านั้น)';
  const prcNoteInput = document.getElementById('itemPriceNoteInput');
  if (prcNoteInput) prcNoteInput.value = 'ซื้อครั้งเดียว สิทธิ์ขาด ลายไม่ซ้ำใคร (1 คนเท่านั้น)';
  const priceFull = document.getElementById('priceFullInput');
  if (priceFull) priceFull.value = '250฿';
  const titleInput = document.getElementById('itemTitleInput');
  if (titleInput) titleInput.placeholder = 'เช่น สกินเจ้าหญิงหิมะม่วง';
}

function openEditActivePremadeModal() {
  const item = (appData.items || []).find(i => i.id === activePremadeId);
  if (!item) {
    showToastNotice('❌ ไม่พบข้อมูลสกินสำเร็จรูป');
    return;
  }
  activeItemId = item.id;
  openEditActiveModal(item);
}

// ==================== PREMADE SPECS QUICK EDIT MODAL ====================
function openEditPremadeSpecsModal(itemId) {
  const targetId = itemId || activePremadeId;
  const item = (appData.items || []).find(i => i.id === targetId);
  if (!item) {
    showToastNotice('❌ ไม่พบข้อมูลสกิน');
    return;
  }

  const activeIdInput = document.getElementById('specsActiveItemId');
  if (activeIdInput) activeIdInput.value = item.id;
  
  // Price
  const priceEl = document.getElementById('specsPriceInput');
  if (priceEl) priceEl.value = item.price || item.priceFull || '250฿';

  // Price Note
  const isExclusive = item.licenseType !== 'unlimited';
  const prcNoteEl = document.getElementById('specsPriceNoteInput');
  if (prcNoteEl) {
    prcNoteEl.value = item.priceNote || (isExclusive ? 'ซื้อครั้งเดียว สิทธิ์ขาด ลายไม่ซ้ำใคร (1 คนเท่านั้น)' : 'สกินสำเร็จรูป Open License ซื้อและใช้งานได้ไม่จำกัดจำนวน');
  }

  // License Text & Type
  const licEl = document.getElementById('specsLicenseTextInput');
  if (licEl) {
    licEl.value = item.licenseText || (isExclusive ? '👑 ซื้อคนเดียว (สิทธิ์ขาด 1 คนเท่านั้น)' : '♾️ ซื้อได้ไม่จำกัด (ใช้ได้หลายคน)');
  }
  const licTypeEl = document.getElementById('specsLicenseTypeInput');
  if (licTypeEl) licTypeEl.value = item.licenseType || 'exclusive';

  // Resolution
  const resEl = document.getElementById('specsResolutionInput');
  if (resEl) {
    let resVal = item.resolution;
    if (!resVal) {
      if (/512/i.test(item.title) || /512/i.test(item.category)) resVal = '512x512 Ultra HD';
      else if (/128/i.test(item.title) || /128/i.test(item.category)) resVal = '128x128 HD';
      else if (/1024/i.test(item.title) || /1024/i.test(item.category)) resVal = '1024x1024 Pixel';
      else resVal = '64x64 HD Standard';
    }
    resEl.value = resVal;
  }

  // Arm Type & Model Type
  const armEl = document.getElementById('specsArmTypeInput');
  if (armEl) {
    armEl.value = item.armType || ((item.modelType === 'classic' || item.modelType === 'steve') ? 'Classic 4px (Steve)' : 'Slim 3px (Alex)');
  }
  const modelTypeEl = document.getElementById('specsModelTypeInput');
  if (modelTypeEl) modelTypeEl.value = item.modelType || 'slim';

  // Supported Editions
  const editEl = document.getElementById('specsEditionInput');
  if (editEl) editEl.value = item.edition || 'Java & Bedrock Edition';

  // Included
  const incEl = document.getElementById('specsIncludedInput');
  if (incEl) incEl.value = item.included || 'ไฟล์ .PNG คมชัด • ดาวน์โหลดทันที';

  const modal = document.getElementById('premadeSpecsModal');
  if (modal) modal.classList.remove('hidden');
  lucide.createIcons();
}

function closePremadeSpecsModal() {
  const modal = document.getElementById('premadeSpecsModal');
  if (modal) modal.classList.add('hidden');
}

function setSpecsPreset(field, value) {
  if (field === 'priceNote') {
    const el = document.getElementById('specsPriceNoteInput');
    if (el) el.value = value;
  } else if (field === 'licenseText') {
    const el = document.getElementById('specsLicenseTextInput');
    if (el) el.value = value;
  } else if (field === 'licenseType') {
    const el = document.getElementById('specsLicenseTypeInput');
    if (el) el.value = value;
  } else if (field === 'resolution') {
    const el = document.getElementById('specsResolutionInput');
    if (el) el.value = value;
  } else if (field === 'armType') {
    const el = document.getElementById('specsArmTypeInput');
    if (el) el.value = value;
  } else if (field === 'modelType') {
    const el = document.getElementById('specsModelTypeInput');
    if (el) el.value = value;
  } else if (field === 'edition') {
    const el = document.getElementById('specsEditionInput');
    if (el) el.value = value;
  } else if (field === 'included') {
    const el = document.getElementById('specsIncludedInput');
    if (el) el.value = value;
  }
}

async function handlePremadeSpecsSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('specsActiveItemId').value;
  if (!id) return;

  const payload = {
    price: document.getElementById('specsPriceInput').value.trim(),
    priceNote: document.getElementById('specsPriceNoteInput').value.trim(),
    licenseText: document.getElementById('specsLicenseTextInput').value.trim(),
    licenseType: document.getElementById('specsLicenseTypeInput').value,
    resolution: document.getElementById('specsResolutionInput').value.trim(),
    armType: document.getElementById('specsArmTypeInput').value.trim(),
    modelType: document.getElementById('specsModelTypeInput').value,
    edition: document.getElementById('specsEditionInput').value.trim(),
    included: document.getElementById('specsIncludedInput').value.trim(),
  };

  try {
    const res = await fetch(`/api/items/${id}/specs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      await loadData();
      showPremadeDetail(id);
      closePremadeSpecsModal();
      showToast('✨ บันทึกข้อมูลสเปกสกินสำเร็จรูปเรียบร้อยแล้ว!');
      return;
    }
  } catch (err) {
    console.warn('Specs API error:', err);
  }

  // Fallback update locally
  const item = (appData.items || []).find(i => i.id === id);
  if (item) {
    Object.assign(item, payload);
    saveDataLocal();
    showPremadeDetail(id);
    closePremadeSpecsModal();
    showToast('✨ อัปเดตข้อมูลสเปกเรียบร้อย');
  }
}

// ==================== ADMIN: ORDERS MANAGEMENT SYSTEM ====================
let adminOrdersData = [];
let adminOrdersFilter = 'all';
let adminOrdersSearchQuery = '';

async function loadAdminOrders(silent = false) {
  try {
    const res = await fetch('/api/orders?t=' + Date.now());
    if (res.ok) {
      adminOrdersData = await res.json();
    } else {
      adminOrdersData = appData.orders || [];
    }
  } catch (err) {
    console.warn('Failed to load orders from API', err);
    adminOrdersData = appData.orders || [];
  }

  updateAdminOrdersBadge();
  renderAdminOrdersList();
  if (!silent) {
    showToast(`อัปเดตข้อมูลคำสั่งซื้อแล้ว (${adminOrdersData.length} รายการ)`);
  }
}

function updateAdminOrdersBadge() {
  const badge = document.getElementById('adminOrdersBadge');
  const headerBadge = document.getElementById('adminOrdersHeaderBadge');
  const count = (adminOrdersData || []).length;
  if (badge) badge.textContent = count;
  if (headerBadge) headerBadge.textContent = `${count} รายการ`;
}

function openAdminOrdersModal() {
  const modal = document.getElementById('adminOrdersModal');
  if (modal) modal.classList.remove('hidden');
  loadAdminOrders(true);
  lucide.createIcons();
}

function closeAdminOrdersModal() {
  const modal = document.getElementById('adminOrdersModal');
  if (modal) modal.classList.add('hidden');
}

function setOrderFilter(filter) {
  adminOrdersFilter = filter;
  const btnAll = document.getElementById('orderFilterAll');
  const btnVer = document.getElementById('orderFilterVerified');
  const btnExc = document.getElementById('orderFilterExclusive');

  const activeCls = 'px-3 py-1 rounded-xl text-xs font-bold bg-purple-600 text-white shadow-2xs transition';
  const inactiveCls = 'px-3 py-1 rounded-xl text-xs font-medium text-purple-800 hover:bg-purple-100 transition';

  if (btnAll) btnAll.className = filter === 'all' ? activeCls : inactiveCls;
  if (btnVer) btnVer.className = filter === 'verified' ? activeCls : inactiveCls;
  if (btnExc) btnExc.className = filter === 'exclusive' ? activeCls : inactiveCls;

  renderAdminOrdersList();
}

function handleAdminOrdersSearch(query) {
  adminOrdersSearchQuery = (query || '').toLowerCase().trim();
  renderAdminOrdersList();
}

function renderAdminOrdersList() {
  const container = document.getElementById('adminOrdersListContainer');
  if (!container) return;

  const orders = adminOrdersData || [];

  // Update quick stats
  const totalOrders = orders.length;
  let totalRevenue = 0;
  let verifiedSlips = 0;
  let exclusiveSold = 0;

  orders.forEach(o => {
    const numPrice = parseFloat(String(o.price || '0').replace(/[^0-9.]/g, '')) || 0;
    totalRevenue += numPrice;
    if (o.slipVerified || o.transRef) verifiedSlips++;
    if (o.licenseType === 'exclusive') exclusiveSold++;
  });

  const statOrdersEl = document.getElementById('statTotalOrders');
  const statRevEl = document.getElementById('statTotalRevenue');
  const statVerEl = document.getElementById('statVerifiedSlips');
  const statExcEl = document.getElementById('statExclusiveSold');

  if (statOrdersEl) statOrdersEl.textContent = totalOrders;
  if (statRevEl) statRevEl.textContent = totalRevenue.toLocaleString() + '฿';
  if (statVerEl) statVerEl.textContent = verifiedSlips;
  if (statExcEl) statExcEl.textContent = exclusiveSold;

  // Filter orders
  let filtered = orders.filter(o => {
    if (adminOrdersFilter === 'verified' && !o.slipVerified && !o.transRef) return false;
    if (adminOrdersFilter === 'exclusive' && o.licenseType !== 'exclusive') return false;

    if (adminOrdersSearchQuery) {
      const matchId = (o.orderId || '').toLowerCase().includes(adminOrdersSearchQuery);
      const matchBuyer = (o.buyerContact || '').toLowerCase().includes(adminOrdersSearchQuery) || (o.buyerName || '').toLowerCase().includes(adminOrdersSearchQuery);
      const matchTitle = (o.itemTitle || '').toLowerCase().includes(adminOrdersSearchQuery) || (o.itemCode || '').toLowerCase().includes(adminOrdersSearchQuery);
      const matchRef = (o.transRef || '').toLowerCase().includes(adminOrdersSearchQuery);
      if (!matchId && !matchBuyer && !matchTitle && !matchRef) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-purple-400 bg-purple-50/50 rounded-2xl border border-dashed border-purple-200">
        <div class="text-3xl mb-1">🛒</div>
        <div class="text-xs font-bold text-purple-900">ไม่พบรายการคำสั่งซื้อ</div>
        <div class="text-[11px] text-purple-500 mt-0.5">เมื่อมีลูกค้ากดซื้อสกินและแนบสลิป จะปรากฏรายการที่นี่ค่ะ</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(order => {
    const formattedDate = order.createdAt ? new Date(order.createdAt).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }) : 'ไม่ระบุเวลา';

    const isExclusive = order.licenseType === 'exclusive';
    const isVerified = order.slipVerified || Boolean(order.transRef);
    const rawSlip = order.slipUrl || '';
    const slipImg = rawSlip ? ((rawSlip.startsWith('http') || rawSlip.startsWith('/') || rawSlip.startsWith('data:')) ? rawSlip : '/' + rawSlip) : '';
    const orderStatus = order.status || 'completed';

    return `
      <div class="p-3.5 bg-white/95 rounded-2xl border ${orderStatus === 'pending' ? 'border-amber-400 bg-amber-50/20 shadow-xs' : (isVerified ? 'border-purple-200' : 'border-amber-200')} shadow-2xs hover:border-purple-400 transition space-y-3">
        <!-- Row 1: Order Header & Status -->
        <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-purple-100 text-xs">
          <div class="flex items-center gap-2">
            <span class="font-mono font-black text-purple-950 bg-purple-100 px-2 py-0.5 rounded-lg border border-purple-200">
              #${escapeHtml(order.orderId || '')}
            </span>
            <span class="text-[11px] text-purple-500 flex items-center gap-1">
              <span>🕒</span>
              <span>${escapeHtml(formattedDate)}</span>
            </span>
          </div>
          <div class="flex items-center gap-2">
            <!-- Order Approval Status -->
            ${orderStatus === 'completed' ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span>🟢</span>
                <span>อนุมัติแล้ว (สำเร็จ)</span>
              </span>
            ` : (orderStatus === 'rejected' ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                <span>🔴</span>
                <span>ปฏิเสธสลิป</span>
              </span>
            ` : `
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                <span>🟡</span>
                <span>รอแอดมินยืนยันยอดเงิน</span>
              </span>
            `)}

            ${isVerified ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                <span>🛡️</span>
                <span>${escapeHtml(order.bankName || 'ธนาคาร')}</span>
              </span>
            ` : ''}

            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isExclusive ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-indigo-100 text-indigo-900 border border-indigo-200'}">
              ${isExclusive ? '👑 สิทธิ์ขาด 1 คน' : '♾️ ไม่จำกัด'}
            </span>
          </div>
        </div>

        <!-- Row 2: Skin Details, Buyer Contact, and Slip Thumbnail -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          
          <!-- Col A: Skin Item Info (5 cols) -->
          <div class="md:col-span-5 flex items-center gap-3">
            <div class="w-14 h-14 rounded-xl bg-purple-100/70 border border-purple-200 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-2xs">
              <img src="${escapeHtml(order.skinUrl || 'uploads/custom-yuki-skin.png')}" alt="Skin" class="max-w-full max-h-full object-contain filter drop-shadow" onerror="this.src='uploads/custom-yuki-skin.png'" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[10px] font-black text-purple-500 font-mono">${escapeHtml(order.itemCode || '')}</div>
              <div class="text-xs font-black text-purple-950 truncate">${escapeHtml(order.itemTitle || 'สกินสำเร็จรูป')}</div>
              <div class="text-xs font-black text-emerald-700 mt-0.5">ยอดที่ต้องโอน: ${escapeHtml(order.price || '0฿')}</div>
            </div>
          </div>

          <!-- Col B: Buyer Info (4 cols) -->
          <div class="md:col-span-4 space-y-1 bg-purple-50/60 p-2 rounded-xl border border-purple-100 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-purple-500 font-bold">ช่องทางติดต่อผู้ซื้อ:</span>
              <button onclick="copyToClipboard('${escapeHtml(order.buyerContact || '')}')" class="text-[10px] text-indigo-600 hover:underline font-bold flex items-center gap-0.5" title="คัดลอก Discord">
                <span>📋 คัดลอก</span>
              </button>
            </div>
            <div class="font-mono font-bold text-indigo-950 truncate bg-white/90 px-2 py-0.5 rounded border border-indigo-200">
              💬 ${escapeHtml(order.buyerContact || 'ไม่ระบุ')}
            </div>
            ${order.transRef ? `
              <div class="text-[10px] text-purple-700 font-mono truncate">
                <span class="text-purple-400 font-sans">Ref:</span> ${escapeHtml(order.transRef)}
              </div>
            ` : ''}
          </div>

          <!-- Col C: Slip Thumbnail & Actions (3 cols) -->
          <div class="md:col-span-3 flex items-center justify-end gap-2.5">
            ${slipImg ? `
              <div class="relative group cursor-pointer" data-slip="${encodeURIComponent(slipImg)}" data-order="${encodeURIComponent(order.orderId || '')}" onclick="viewAdminSlipFromElement(this)">
                <img src="${escapeHtml(slipImg)}" alt="สลิป" class="w-14 h-16 object-cover rounded-xl border border-purple-300 shadow-2xs group-hover:scale-105 group-hover:border-purple-500 transition" />
                <div class="absolute inset-0 bg-purple-950/50 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold">
                  🔍 ดูสลิป
                </div>
              </div>
            ` : `
              <div class="w-14 h-16 rounded-xl bg-purple-50 border border-dashed border-purple-200 flex items-center justify-center text-[10px] text-purple-400 text-center p-1">
                ไม่มีรูปสลิป
              </div>
            `}

            <div class="flex flex-col gap-1.5 shrink-0">
              ${orderStatus === 'pending' ? `
                <button type="button" onclick="approveAdminOrder('${escapeHtml(order.orderId)}')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer">
                  <span>✅ อนุมัติ & ส่งสกิน</span>
                </button>
                <button type="button" onclick="rejectAdminOrder('${escapeHtml(order.orderId)}')" class="px-2 py-0.8 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer">
                  <span>❌ ปฏิเสธสลิป</span>
                </button>
              ` : `
                ${slipImg ? `
                  <button type="button" data-slip="${encodeURIComponent(slipImg)}" data-order="${encodeURIComponent(order.orderId || '')}" onclick="viewAdminSlipFromElement(this)" class="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer">
                    <span>🔍 ดูสลิป</span>
                  </button>
                ` : ''}

                ${isExclusive ? `
                  <button type="button" onclick="deleteAdminOrder('${escapeHtml(order.orderId)}', '${escapeHtml(order.itemId)}', true)" class="px-2 py-0.8 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold transition cursor-pointer" title="ลบออเดอร์และดึงสกินกลับมาวางขายใหม่">
                    <span>🔄 ปลดสกินคืน</span>
                  </button>
                ` : ''}

                <button type="button" onclick="deleteAdminOrder('${escapeHtml(order.orderId)}', '${escapeHtml(order.itemId)}', false)" class="px-2 py-0.8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold transition cursor-pointer" title="ลบรายการคำสั่งซื้อนี้">
                  <span>🗑️ ลบ</span>
                </button>
              `}
            </div>
          </div>

        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function viewAdminSlipFromElement(el) {
  if (!el) return;
  const slip = decodeURIComponent(el.getAttribute('data-slip') || '');
  const order = decodeURIComponent(el.getAttribute('data-order') || '');
  viewAdminSlip(slip, order);
}

function viewAdminSlip(slipUrl, orderId) {
  if (!slipUrl) {
    showToast('คำสั่งซื้อนี้ไม่มีรูปภาพสลิปแนบมาค่ะ');
    return;
  }
  const modal = document.getElementById('adminSlipViewModal');
  const img = document.getElementById('adminSlipViewImg');
  const title = document.getElementById('adminSlipViewTitle');
  const dl = document.getElementById('adminSlipViewDownload');

  const formattedUrl = (slipUrl.startsWith('http') || slipUrl.startsWith('/') || slipUrl.startsWith('data:')) 
    ? slipUrl 
    : '/' + slipUrl;

  if (img) img.src = formattedUrl;
  if (title) title.textContent = `สลิปคำสั่งซื้อ #${orderId || ''}`;
  if (dl) {
    dl.href = formattedUrl;
    dl.setAttribute('download', `[Slip]-${orderId || 'order'}.png`);
  }
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  lucide.createIcons();
}

function closeAdminSlipViewModal() {
  const modal = document.getElementById('adminSlipViewModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function viewCurrentCheckoutSlip() {
  const img = document.getElementById('slipPreviewImg');
  if (!img || !img.src) {
    showToast('ยังไม่ได้แนบรูปภาพสลิปค่ะ');
    return;
  }
  const fileName = document.getElementById('slipFileName')?.textContent || 'สลิปโอนเงิน';
  viewAdminSlip(img.src, fileName);
}

async function deleteAdminOrder(orderId, itemId, restoreSkin) {
  const confirmMsg = restoreSkin
    ? `คุณต้องการลบคำสั่งซื้อ #${orderId} และ "ปลดล็อคสกินกลับมาวางขายใหม่" ใช่หรือไม่?`
    : `คุณต้องการลบรายการคำสั่งซื้อ #${orderId} ใช่หรือไม่?`;

  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}?restoreSkin=${restoreSkin ? 'true' : 'false'}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast('ลบรายการคำสั่งซื้อเรียบร้อยแล้ว ♡');
      if (restoreSkin) {
        await loadData();
        renderPremadeCards();
      }
      await loadAdminOrders(true);
    } else {
      alert('ไม่สามารถลบรายการได้ กรุณาลองใหม่อีกครั้ง');
    }
  } catch (err) {
    console.error('Delete order error', err);
    adminOrdersData = adminOrdersData.filter(o => o.orderId !== orderId);
    if (appData.orders) {
      appData.orders = appData.orders.filter(o => o.orderId !== orderId);
    }
    persistLocal();
    renderAdminOrdersList();
    showToast('ลบรายการคำสั่งซื้อเรียบร้อยแล้ว ♡');
  }
}

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast(`คัดลอก "${text}" เรียบร้อยแล้ว ♡`);
  }).catch(() => {
    prompt('คัดลอกข้อความด้านล่างนี้ได้เลยค่ะ:', text);
  });
}

// Approve order: unlocks download for customer in real-time
async function approveAdminOrder(orderId) {
  if (!confirm(`คุณต้องการ "อนุมัติยอดเงิน" สำหรับคำสั่งซื้อ #${orderId} และส่งมอบไฟล์สกินให้ลูกค้าใช่หรือไม่?`)) return;

  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/approve`, { method: 'POST' });
    if (res.ok) {
      showToast(`อนุมัติคำสั่งซื้อ #${orderId} เรียบร้อยแล้ว! ลูกค้าสามารถดาวน์โหลดสกินได้ทันที ♡`);
      await loadData();
      renderPremadeCards();
      await loadAdminOrders(true);
    } else {
      alert('ไม่สามารถอนุมัติได้ กรุณาลองใหม่อีกครั้ง');
    }
  } catch (err) {
    console.error('Approve order error', err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
  }
}

// Reject order: cancels order and restores exclusive skin to store
async function rejectAdminOrder(orderId) {
  if (!confirm(`คุณต้องการ "ปฏิเสธสลิป" สำหรับคำสั่งซื้อ #${orderId} และปลดล็อคสกินคืนสู่หน้าร้านใช่หรือไม่?`)) return;

  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/reject`, { method: 'POST' });
    if (res.ok) {
      showToast(`ปฏิเสธคำสั่งซื้อ #${orderId} และปลดล็อคสกินคืนร้านเรียบร้อยแล้ว ♡`);
      await loadData();
      renderPremadeCards();
      await loadAdminOrders(true);
    } else {
      alert('ไม่สามารถปฏิเสธได้ กรุณาลองใหม่อีกครั้ง');
    }
  } catch (err) {
    console.error('Reject order error', err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
  }
}

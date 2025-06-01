import { texts } from "./text.js";

// Three.js setup
const width = window.innerWidth;
const height = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(width, height);
document.getElementById("threejs-canvas").appendChild(renderer.domElement);

camera.position.z = 10;

let isAudioPlaying = false;
let audioAvailable = true;
let audioInitialized = false;

// Hàm tạo texture từ text
function createTextTexture(text) {
  // Tạo canvas tạm để đo chiều rộng text
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.font = "bold 48px 'Playpen Sans'";
  const textWidth = tempCtx.measureText(text).width;

  // Thêm padding cho đẹp
  const padding = 60;
  const canvasWidth = Math.ceil(textWidth + padding * 2);
  const canvasHeight = 128;

  // Tạo canvas thật với kích thước phù hợp
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 48px 'Playpen Sans'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#ff69b4";
  ctx.shadowBlur = 50;
  ctx.fillStyle = "#fff";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  // Trả về cả texture và tỉ lệ
  return {
    texture: new THREE.CanvasTexture(canvas),
    aspect: canvas.width / canvas.height,
  };
}

// Hàm tạo texture trái tim
function createHeartTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 128, 128);
  // Vẽ trái tim đỏ tươi, dễ thương (không viền)
  ctx.save();
  ctx.translate(64, 64);
  ctx.beginPath();
  ctx.moveTo(0, 28);
  ctx.bezierCurveTo(28, 0, 56, 28, 0, 56);
  ctx.bezierCurveTo(-56, 28, -28, 0, 0, 28);
  ctx.closePath();
  ctx.fillStyle = "#ff2222";
  ctx.shadowColor = "#ffb3b3";
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.restore();
  return new THREE.CanvasTexture(canvas);
}

// Tạo nền trời sao
let starMeshes = [];
function createStars() {
  const starGeometry = new THREE.SphereGeometry(0.07, 6, 6);
  const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 800; i++) {
    const star = new THREE.Mesh(starGeometry, starMaterial);
    star.position.x = (Math.random() - 0.5) * 120;
    star.position.y = Math.random() * 80 - 20;
    star.position.z = (Math.random() - 0.5) * 120 - 20;
    scene.add(star);
    starMeshes.push(star);
  }
}

// Tạo nhiều mesh chữ đổ xuống
let textMeshes = [];
function createFallingTexts() {
  textMeshes.forEach((m) => scene.remove(m));
  textMeshes = [];
  for (let i = 0; i < 200; i++) {
    const text = texts[Math.floor(Math.random() * texts.length)];
    const { texture, aspect } = createTextTexture(text);
    texture.needsUpdate = true;
    // Tạo PlaneGeometry theo tỉ lệ chữ
    const height = 1.1;
    const width = height * aspect;
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      color: 0xffffff,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = (Math.random() - 0.5) * 30;
    mesh.position.y = Math.random() * 20 + 10;
    mesh.position.z = (Math.random() - 0.5) * 10;
    mesh.userData.phase = Math.random() * Math.PI * 2;
    scene.add(mesh);
    textMeshes.push(mesh);
  }
}

// Tạo nhiều trái tim rơi
let heartMeshes = [];
function createFallingHearts() {
  heartMeshes.forEach((m) => scene.remove(m));
  heartMeshes = [];
  const heartTexture = createHeartTexture();
  for (let i = 0; i < 15; i++) {
    const geometry = new THREE.PlaneGeometry(1.5, 1.5);
    const material = new THREE.MeshBasicMaterial({
      map: heartTexture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = (Math.random() - 0.5) * 30;
    mesh.position.y = Math.random() * 20 + 10;
    mesh.position.z = (Math.random() - 0.5) * 10;
    const scale = 1 + Math.random() * 1.5;
    mesh.scale.set(scale, scale, 1);
    scene.add(mesh);
    heartMeshes.push(mesh);
  }
}

// Sao băng
let shootingStars = [];
function spawnShootingStar() {
  const geometry = new THREE.SphereGeometry(0.15, 8, 8);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
  });
  const star = new THREE.Mesh(geometry, material);
  // Chỉ xuất hiện ở background (z nhỏ hơn -10)
  star.position.x = (Math.random() - 0.5) * 100;
  star.position.y = Math.random() * 80 - 20;
  star.position.z = -40 - Math.random() * 40; // Luôn ở xa phía sau chữ
  star.userData = {
    vx: 0.4 + Math.random() * 0.3, // chậm hơn
    vy: -0.2 - Math.random() * 0.2,
    vz: 0.7 + Math.random() * 0.5,
    tail: [], // lưu các điểm đuôi
  };
  scene.add(star);
  shootingStars.push(star);
}

// Infinity chiều rộng và hiệu ứng kéo mượt
let isDragging = false;
let lastX = 0;
let isTouching = false;
let lastTouchX = 0;
let targetRotationY = 0;

renderer.domElement.addEventListener("mousedown", (e) => {
  isDragging = true;
  lastX = e.clientX;
});
window.addEventListener("mouseup", () => {
  isDragging = false;
});
window.addEventListener("mousemove", (e) => {
  if (isDragging) {
    const deltaX = e.clientX - lastX;
    lastX = e.clientX;
    targetRotationY += deltaX * 0.0015; // Nhẹ hơn
  }
});

renderer.domElement.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) {
    isTouching = true;
    lastTouchX = e.touches[0].clientX;
  }
});
window.addEventListener("touchend", () => {
  isTouching = false;
});
window.addEventListener("touchmove", (e) => {
  if (isTouching && e.touches.length === 1) {
    const touchX = e.touches[0].clientX;
    const deltaX = touchX - lastTouchX;
    lastTouchX = touchX;
    targetRotationY += deltaX * 0.0015;
  }
});

function lerpColor(a, b, t) {
  // a, b: [r, g, b] 0-255, t: 0-1
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function animate() {
  requestAnimationFrame(animate);
  camera.rotation.y += (targetRotationY - camera.rotation.y) * 0.08;
  const now = Date.now();
  textMeshes.forEach((mesh) => {
    mesh.position.y -= 0.05 + Math.random() * 0.02;
    if (mesh.position.y < -12) {
      mesh.position.y = Math.random() * 20 + 10;
      mesh.position.x = (Math.random() - 0.5) * 30;
      mesh.position.z = (Math.random() - 0.5) * 10;
    }
    if (mesh.position.x > 16) mesh.position.x = -16;
    if (mesh.position.x < -16) mesh.position.x = 16;
    const t = (Math.sin(now * 0.0005 + mesh.userData.phase) + 1) / 2;
    const colorArr = lerpColor([255, 255, 255], [255, 105, 180], t);
    const colorHex = (colorArr[0] << 16) | (colorArr[1] << 8) | colorArr[2];
    mesh.material.color.setHex(colorHex);
  });
  heartMeshes.forEach((mesh) => {
    mesh.position.y -= 0.08 + Math.random() * 0.04;
    mesh.position.x += (Math.random() - 0.5) * 0.05;
    if (mesh.position.y < -12) {
      mesh.position.y = Math.random() * 20 + 10;
      mesh.position.x = (Math.random() - 0.5) * 30;
      mesh.position.z = (Math.random() - 0.5) * 10;
    }
    if (mesh.position.x > 16) mesh.position.x = -16;
    if (mesh.position.x < -16) mesh.position.x = 16;
  });
  // Sao băng
  shootingStars.forEach((star, i) => {
    // Lưu vị trí cũ vào đuôi
    if (star.userData.tail.length > 20) star.userData.tail.shift();
    star.userData.tail.push({
      x: star.position.x,
      y: star.position.y,
      z: star.position.z,
    });
    star.position.x += star.userData.vx;
    star.position.y += star.userData.vy;
    star.position.z += star.userData.vz;
    // Vẽ đuôi sao băng
    for (let j = 0; j < star.userData.tail.length - 1; j++) {
      const p1 = star.userData.tail[j];
      const p2 = star.userData.tail[j + 1];
      const tailGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p1.x, p1.y, p1.z),
        new THREE.Vector3(p2.x, p2.y, p2.z),
      ]);
      const tailMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15 + 0.25 * (j / star.userData.tail.length),
      });
      const tailLine = new THREE.Line(tailGeom, tailMat);
      scene.add(tailLine);
      setTimeout(() => scene.remove(tailLine), 40); // Xoá đuôi cũ sau 40ms
    }
    star.material.opacity = 0.8;
    if (star.position.z > 0 || star.position.y < -40) {
      scene.remove(star);
      shootingStars.splice(i, 1);
    }
  });
  // Ngẫu nhiên xuất hiện sao băng
  if (Math.random() < 0.012) spawnShootingStar();
  renderer.render(scene, camera);
}

// Khởi tạo
createStars();
createFallingTexts();
createFallingHearts();
animate();

// Responsive
window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

// ====== PHÁT NHẠC MP3 TỰ ĐỘNG ======
const audio = document.getElementById("bg-audio");

// Khởi tạo âm thanh
function initAudio() {
  if (!audio || audioInitialized) return;

  audio.loop = true;
  audio.volume = 0;

  // Kiểm tra lỗi audio
  audio.addEventListener("error", (e) => {
    audioAvailable = false;
  });

  audio.addEventListener("loadstart", () => {
    // Audio loading started
  });

  audio.addEventListener("canplaythrough", () => {
    audioAvailable = true;
  });

  // Xử lý khi không tìm thấy file
  audio.addEventListener("loadeddata", () => {
    audioAvailable = true;
  });

  audioInitialized = true;
}

// Fade in âm thanh mượt mà
function fadeInAudio(targetVolume = 0.7, duration = 3000) {
  if (!audioAvailable || !audio) return;

  // Dừng fade cũ nếu có
  if (audio.fadeInterval) {
    clearInterval(audio.fadeInterval);
  }

  audio.volume = 0;

  // Thử phát nhạc
  const playPromise = audio.play();

  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        isAudioPlaying = true;

        // Fade in từ từ
        const step = targetVolume / (duration / 50); // 50ms mỗi bước
        audio.fadeInterval = setInterval(() => {
          if (audio.volume < targetVolume) {
            audio.volume = Math.min(audio.volume + step, targetVolume);
          } else {
            clearInterval(audio.fadeInterval);
          }
        }, 50);
      })
      .catch((error) => {
        audioAvailable = false;
        isAudioPlaying = false;
      });
  }
}

// Xử lý tương tác người dùng để phát nhạc
function handleUserInteraction() {
  if (!audioInitialized && audio) {
    initAudio();
  }

  // Chỉ thử phát nhạc nếu có element audio và chưa đang phát
  if (audio && audioAvailable && !isAudioPlaying) {
    fadeInAudio();
  }
}

// Lắng nghe các sự kiện tương tác
const interactionEvents = [
  "click",
  "touchstart",
  "touchend",
  "mousedown",
  "keydown",
];

interactionEvents.forEach((eventType) => {
  document.addEventListener(eventType, handleUserInteraction, {
    once: true,
    passive: true,
  });
});

// Khởi tạo khi DOM loaded
document.addEventListener("DOMContentLoaded", () => {
  // Đảm bảo body luôn được hiển thị
  document.body.style.display = "";

  // Chỉ khởi tạo audio nếu có element
  if (audio) {
    initAudio();

    // Kiểm tra file âm thanh có tồn tại không
    audio.addEventListener("error", () => {
      audioAvailable = false;
    });

    // Thử preload audio, nhưng không bắt buộc
    try {
      audio.load();
    } catch (error) {
      audioAvailable = false;
    }
  } else {
    audioAvailable = false;
  }
});

// Xử lý khi audio kết thúc (nếu không loop)
if (audio) {
  audio.addEventListener("ended", () => {
    isAudioPlaying = false;
    // Tự động phát lại nếu cần và có thể
    if (audioAvailable) {
      setTimeout(() => fadeInAudio(), 1000);
    }
  });

  audio.addEventListener("pause", () => {
    isAudioPlaying = false;
  });

  audio.addEventListener("play", () => {
    isAudioPlaying = true;
  });
}

// Tạo sao cho loading screen
function createStarsForLoading() {
  const loadingScreen = document.getElementById("loading-screen");
  const numberOfStars = 50;

  for (let i = 0; i < numberOfStars; i++) {
    const star = document.createElement("div");
    star.className = "star";

    // Random vị trí
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;

    // Random độ sáng và kích thước
    const size = Math.random() * 3;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;

    // Random độ trễ animation
    star.style.animationDelay = `${Math.random() * 2}s`;

    // Thêm shadow để tạo hiệu ứng lấp lánh
    const shadowSize = Math.random() * 5 + 5;
    star.style.boxShadow = `0 0 ${shadowSize}px #fff`;

    loadingScreen.appendChild(star);
  }
}

// Xử lý nút bắt đầu
const startButton = document.getElementById("start-button");
const loadingScreen = document.getElementById("loading-screen");
const canvas = document.getElementById("threejs-canvas");

// Tạo sao khi trang load xong
document.addEventListener("DOMContentLoaded", createStarsForLoading);

function startExperience() {
  // Thêm class để trái tim bay lên
  const heartButton = document.getElementById("start-button");
  heartButton.classList.add("clicked");

  // Đợi animation trái tim hoàn thành rồi mới fade out loading screen
  setTimeout(() => {
    // Hiệu ứng fade out cho loading screen
    loadingScreen.classList.add("fade-out");

    // Hiển thị canvas với hiệu ứng fade in
    canvas.style.display = "";
    canvas.classList.add("fade-in");

    // Xóa loading screen sau khi fade out
    setTimeout(() => {
      loadingScreen.remove();
    }, 1000);

    // Khởi tạo audio
    if (audio) {
      initAudio();
      handleUserInteraction();
    }
  }, 1000); // Đợi 1s cho animation trái tim
}

// Thêm event listener cho nút bắt đầu
if (startButton) {
  startButton.addEventListener("click", startExperience);
}

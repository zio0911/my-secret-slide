<template>
  <div class="container" tabindex="0">

    <!-- 상단 좌측 : 카운트 -->
    <div class="top-left" v-if="images.length">
      {{ currentIndex + 1 }} / {{ images.length }}
      <span v-if="isSecretMode">🔒</span>
    </div>

    <!-- 상단 우측 : 폴더 -->
    <div class="top-right">
      <button @click="selectFolder">📂 폴더 변경</button>
    </div>

    <!-- Empty -->
    <div v-if="images.length === 0" class="empty">
      <h1>Free Image Viewer</h1>
      <p class="subtitle">Private · Simple · Offline</p>
      <img :src="displayedImageSrc" class="placeholder" />
    </div>

    <!-- Viewer -->
    <div v-else class="viewer">
      <img
          :src="displayedImageSrc"
          class="slide"
          :style="imageStyle"
      />
    </div>

    <!-- Keypad -->
    <div v-if="showKeypad" class="overlay">
      <div class="keypad">
        <div class="display">
          {{ '*'.repeat(inputPassword.length) || '----' }}
        </div>
        <div class="keys">
          <button v-for="n in 9" :key="n" @click="inputNum(n)">{{ n }}</button>
          <button @click="clearPassword">C</button>
          <button @click="inputNum(0)">0</button>
          <button @click="confirmPassword">OK</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import placeholderImage from './assets/placeholder.jpg'

const fs = window.require('fs')
const path = window.require('path')
const { ipcRenderer } = window.require('electron')

/* ================= State ================= */
const images = ref([])
const currentIndex = ref(0)
const currentPath = ref('')
const isSecretMode = ref(false)

const displayedImageSrc = ref(placeholderImage)
let lastUrl = null

/* ================= Zoom / Pan ================= */
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)

const imageStyle = computed(() => ({
  transform: `scale(${scale.value}) translate(${tx.value}px, ${ty.value}px)`,
  transition: 'transform 0.15s ease-out'
}))

const resetTransform = () => {
  scale.value = 1
  tx.value = 0
  ty.value = 0
}

/* ================= Slideshow ================= */
const isPlaying = ref(false)
let timer = null

const startSlideShow = () => {
  stopSlideShow()
  isPlaying.value = true
  alert('gogo');
  timer = setInterval(() => {
    nextImage()
  }, 2000)
}

const stopSlideShow = () => {
  if (timer) clearInterval(timer)
  timer = null
  isPlaying.value = false
  alert('');
}

const togglePlay = () => {
  if (scale.value > 1) return
  isPlaying.value ? stopSlideShow() : startSlideShow()
}

/* ================= Secret ================= */
const showKeypad = ref(false)
const inputPassword = ref('')
const secretKey = ref(null)
const keypadPurpose = ref(null) // 'ENCRYPT' | 'ENTER_SECRET'
const SECRET_EXT = '.secret'

/* ================= Folder ================= */
const selectFolder = async () => {
  const paths = await ipcRenderer.invoke('open-folder-dialog')
  if (!paths?.length) return
  currentPath.value = paths[0]
  exitSecretMode()
  loadImages()
}

const loadImages = () => {
  if (!currentPath.value) return
  const files = fs.readdirSync(currentPath.value)

  images.value = isSecretMode.value
      ? files.filter(f => f.endsWith(SECRET_EXT))
      : files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))

  currentIndex.value = 0
  updateImage()
}

/* ================= Image ================= */
const updateImage = () => {
  resetTransform()

  if (lastUrl) {
    URL.revokeObjectURL(lastUrl)
    lastUrl = null
  }

  if (!images.value.length) {
    displayedImageSrc.value = placeholderImage
    return
  }

  const file = images.value[currentIndex.value]
  const fullPath = path.join(currentPath.value, file)

  if (isSecretMode.value) {
    const encrypted = fs.readFileSync(fullPath)
    const restored = Buffer.from(encrypted.map(b => b ^ secretKey.value))
    const blob = new Blob([restored])
    lastUrl = URL.createObjectURL(blob)
    displayedImageSrc.value = lastUrl
  } else {
    displayedImageSrc.value = `file://${fullPath}?t=${Date.now()}`
  }
}

const nextImage = () => {
  currentIndex.value = (currentIndex.value + 1) % images.value.length
}

const prevImage = () => {
  currentIndex.value =
      (currentIndex.value - 1 + images.value.length) % images.value.length
}

const deleteCurrentFile = () => {
  if (!images.value.length) return

  const indexToDelete = currentIndex.value
  const file = images.value[indexToDelete]
  const fullPath = path.join(currentPath.value, file)

  if (!confirm(`이 파일을 삭제할까요?\n\n${file}`)) return

  fs.unlinkSync(fullPath)

  // 🔑 삭제 후 이미지 다시 로드
  const files = fs.readdirSync(currentPath.value)
  images.value = isSecretMode.value
      ? files.filter(f => f.endsWith(SECRET_EXT))
      : files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))

  // 🔑 인덱스 보정
  if (images.value.length === 0) {
    currentIndex.value = 0
    displayedImageSrc.value = placeholderImage
    return
  }

  if (indexToDelete >= images.value.length) {
    currentIndex.value = images.value.length - 1
  } else {
    currentIndex.value = indexToDelete
  }

  updateImage()
}



/* ================= Encrypt / Restore ================= */
const encryptCurrentFile = () => {
  if (!secretKey.value) return
  const file = images.value[currentIndex.value]
  const oldPath = path.join(currentPath.value, file)
  const newPath = oldPath.replace(/\.\w+$/, '') + '_' + Date.now() + SECRET_EXT
  const data = fs.readFileSync(oldPath)
  const encrypted = Buffer.from(data.map(b => b ^ secretKey.value))
  fs.writeFileSync(newPath, encrypted)
  fs.unlinkSync(oldPath)
  loadImages()
}

const restoreCurrentFile = () => {
  if (!isSecretMode.value) return
  const file = images.value[currentIndex.value]
  const secretPath = path.join(currentPath.value, file)
  const restoredPath = secretPath.replace(/_\d+\.secret$/, '.jpg')
  const encrypted = fs.readFileSync(secretPath)
  const restored = Buffer.from(encrypted.map(b => b ^ secretKey.value))
  fs.writeFileSync(restoredPath, restored)
  fs.unlinkSync(secretPath)
  loadImages()
}

/* ================= Keypad ================= */
const openKeypad = () => {
  showKeypad.value = true
  inputPassword.value = ''
}

const inputNum = (n) => {
  if (inputPassword.value.length < 30) inputPassword.value += n
}

const clearPassword = () => inputPassword.value = ''

const confirmPassword = () => {
  secretKey.value =
      inputPassword.value.split('').reduce((a, c) => a + c.charCodeAt(0), 0) & 0xff
  showKeypad.value = false
  inputPassword.value = ''

  if (keypadPurpose.value === 'ENTER_SECRET') {
    isSecretMode.value = true
    loadImages()
  }
  if (keypadPurpose.value === 'ENCRYPT') {
    encryptCurrentFile()
  }

  keypadPurpose.value = null
}

/* ================= Exit Secret ================= */
const exitSecretMode = () => {
  isSecretMode.value = false
  secretKey.value = null
  resetTransform()
}

/* ================= Keyboard ================= */
const handleKeydown = (e) => {
  if (showKeypad.value) {
    if (e.key >= '0' && e.key <= '9') inputNum(e.key)
    if (e.key === 'Backspace') clearPassword()
    if (e.key === 'Enter') confirmPassword()
    return
  }

  if (e.key === '=') {
    scale.value = Math.min(scale.value + 0.2, 5)
    return
  }

  if (e.key === '-') {
    scale.value = Math.max(scale.value - 0.2, 1)
    if (scale.value === 1) resetTransform()
    return
  }

  if (scale.value > 1) {
    if (e.code === 'ArrowLeft') tx.value += 40
    if (e.code === 'ArrowRight') tx.value -= 40
    if (e.code === 'ArrowUp') ty.value += 40
    if (e.code === 'ArrowDown') ty.value -= 40
    return
  }

  if (e.code === 'Backspace') deleteCurrentFile()
  if (e.code === 'ArrowRight') nextImage()
  if (e.code === 'ArrowLeft') prevImage()
  if (e.code === 'Space') togglePlay()

  if (e.code === 'KeyH') {
    keypadPurpose.value = 'ENCRYPT'
    openKeypad()
  }

  if (e.code === 'KeyS') {
    keypadPurpose.value = 'ENTER_SECRET'
    openKeypad()
  }

  if (e.code === 'KeyR') restoreCurrentFile()

  if (e.code === 'Escape') {
    exitSecretMode()
    loadImages()
  }
}

watch(currentIndex, updateImage)
onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<style>
html, body { margin:0; background:#111; color:white; overflow:hidden }
.container { width:100vw;height:100vh }

.top-left {
  position:fixed;
  top:12px;
  left:16px;
  opacity:.8;
}

.top-right {
  position:fixed;
  top:12px;
  right:16px;
}

.viewer {
  width:100%;
  height:100%;
  display:flex;
  align-items:center;
  justify-content:center;
}

.slide {
  max-width:100%;
  max-height:100%;
}

.empty {
  height:100%;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
}

.subtitle { opacity:.6; margin-bottom:20px }

.overlay {
  position:fixed;
  inset:0;
  background:#000c;
  display:flex;
  align-items:center;
  justify-content:center;
}

.keypad {
  background:#222;
  padding:24px;
  border-radius:10px;
}

.keys {
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:8px;
}
</style>

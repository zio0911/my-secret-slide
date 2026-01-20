import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

export const deriveKeyFromPassword = (password) => {
  return crypto
  .createHash('sha256')
  .update(password)
  .digest() // 32 bytes
}

export const encryptFile = ({ inputPath, outputPath, key }) => {
  if (!key) throw new Error('AES key missing')

  const iv = crypto.randomBytes(IV_LENGTH)
  const data = fs.readFileSync(inputPath)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  const authTag = cipher.getAuthTag()

  const meta = {
    originalName: path.basename(inputPath),
    mime: getMimeByExt(path.extname(inputPath))
  }

  const payload = Buffer.concat([
    iv,
    authTag,
    Buffer.from(JSON.stringify(meta) + '\n'),
    encrypted
  ])

  fs.writeFileSync(outputPath, payload)
}

export const decryptFile = ({ inputPath, outputDir, key }) => {
  if (!key) throw new Error('AES key missing')

  const payload = fs.readFileSync(inputPath)

  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + 16)
  const rest = payload.subarray(IV_LENGTH + 16)

  const metaEnd = rest.indexOf('\n')
  if (metaEnd === -1) throw new Error('Invalid secret file')

  const meta = JSON.parse(rest.subarray(0, metaEnd).toString())
  const encrypted = rest.subarray(metaEnd + 1)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ])

  const outputPath = path.join(outputDir, meta.originalName)
  fs.writeFileSync(outputPath, decrypted)

  return { meta, outputPath }
}

const getMimeByExt = (ext) => {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.png': return 'image/png'
    case '.gif': return 'image/gif'
    case '.webp': return 'image/webp'
    default: return 'application/octet-stream'
  }
}

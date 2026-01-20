import keytar from 'keytar'
import crypto from 'crypto'

const SERVICE_NAME = 'my-secret-slide'
const ACCOUNT_NAME = 'aes-key'

// 비밀번호 → AES Key 파생 (PBKDF2)
export const deriveKeyFromPassword = (password) => {
  return crypto.pbkdf2Sync(
      password,
      'my-secret-slide-salt', // 고정 salt (파일 안에 있어도 무방)
      100000,
      32,
      'sha256'
  ).toString('hex')
}

// 키 저장
export const saveSecretKey = async (keyHex) => {
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, keyHex)
}

// 키 불러오기
export const loadSecretKey = async () => {
  return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
}

// 키 삭제 (로그아웃 / 리셋용)
export const clearSecretKey = async () => {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
}

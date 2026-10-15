/* Local accounts. Passwords are salted + hashed (PBKDF2) and stored in this browser only. */

const USERS_KEY = 'lingocards:users'
const SESSION_KEY = 'lingocards:session'
const ITERATIONS = 150000

interface StoredUser {
  name: string
  salt: string
  hash: string
}

const toHex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)!.map(h => parseInt(h, 16)))

async function hash(password: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256))
}

const readUsers = (): Record<string, StoredUser> => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? 'null') || {}
  } catch {
    return {}
  }
}
const normName = (name: string) => String(name || '').trim().toLowerCase()

export async function register(name: string, password: string) {
  const id = normName(name)
  if (id.length < 2) throw new Error('Username must be at least 2 characters.')
  if (String(password).length < 6) throw new Error('Password must be at least 6 characters.')
  const users = readUsers()
  if (users[id]) throw new Error('That username is already taken.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  users[id] = { name: name.trim(), salt: toHex(salt), hash: await hash(password, salt) }
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
  localStorage.setItem(SESSION_KEY, id)
  return users[id].name
}

export async function login(name: string, password: string) {
  const id = normName(name)
  const user = readUsers()[id]
  // Same message for unknown user and wrong password.
  if (!user || (await hash(password, fromHex(user.salt))) !== user.hash) throw new Error('Incorrect username or password.')
  localStorage.setItem(SESSION_KEY, id)
  return user.name
}

export const logout = () => localStorage.removeItem(SESSION_KEY)
export const currentUser = (): string | null => readUsers()[localStorage.getItem(SESSION_KEY) ?? '']?.name ?? null
export const hasUsers = () => Object.keys(readUsers()).length > 0

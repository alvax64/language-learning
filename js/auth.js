/* LingoCards — local accounts. Passwords are salted + hashed (PBKDF2) and stored in this browser only. */
(() => {
  'use strict';

  const USERS_KEY = 'lingocards:users';
  const SESSION_KEY = 'lingocards:session';
  const ITERATIONS = 150000;

  const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const fromHex = hex => new Uint8Array(hex.match(/../g).map(h => parseInt(h, 16)));

  async function hash(password, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256));
  }

  const readUsers = () => {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; } catch { return {}; }
  };
  const normName = name => String(name || '').trim().toLowerCase();

  async function register(name, password) {
    const id = normName(name);
    if (id.length < 2) throw new Error('Username must be at least 2 characters.');
    if (String(password).length < 6) throw new Error('Password must be at least 6 characters.');
    const users = readUsers();
    if (users[id]) throw new Error('That username is already taken.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    users[id] = { name: name.trim(), salt: toHex(salt), hash: await hash(password, salt) };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    localStorage.setItem(SESSION_KEY, id);
    return users[id].name;
  }

  async function login(name, password) {
    const id = normName(name);
    const user = readUsers()[id];
    // Same message for unknown user and wrong password.
    if (!user || await hash(password, fromHex(user.salt)) !== user.hash) throw new Error('Incorrect username or password.');
    localStorage.setItem(SESSION_KEY, id);
    return user.name;
  }

  const logout = () => localStorage.removeItem(SESSION_KEY);
  const currentUser = () => readUsers()[localStorage.getItem(SESSION_KEY)]?.name ?? null;
  const hasUsers = () => Object.keys(readUsers()).length > 0;

  window.AUTH = { register, login, logout, currentUser, hasUsers };
})();

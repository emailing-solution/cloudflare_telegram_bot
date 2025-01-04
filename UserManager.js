import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class UserManager {
  constructor() {
    // Use absolute path and create data directory if it doesn't exist
    this.dataDir = path.join(__dirname, 'data');
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.users = new Map();
    this.ensureDataDirectory();
    this.loadUsers();
    
    // Initialize processing state for existing users
    for (const [userId, userData] of this.users.entries()) {
      if (userData.isProcessing === undefined) {
        userData.isProcessing = false;
      }
    }
  }

  ensureDataDirectory() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create data directory:', error);
    }
  }

  loadUsers() {
    try {
      if (fs.existsSync(this.usersFile)) {
        const data = fs.readFileSync(this.usersFile, 'utf8');
        const parsed = JSON.parse(data);
        // Convert all keys to strings during load
        const convertedData = Object.entries(parsed).reduce((acc, [key, value]) => {
          acc[key.toString()] = value;
          return acc;
        }, {});
        this.users = new Map(Object.entries(convertedData));
        console.log('Loaded users data:', this.users.size, 'users');
        console.log('Users data:', Object.fromEntries(this.users));
      } else {
        console.log('No existing users file, starting fresh');
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }

  saveUsers() {
    try {
      const data = JSON.stringify(Object.fromEntries(this.users), null, 2);
      fs.writeFileSync(this.usersFile, data, 'utf8');
      console.log('Saved users data:', this.users.size, 'users');
    } catch (error) {
      console.error('Failed to save users:', error);
    }
  }

  setAuthenticated(userId, value) {
    const userIdStr = userId.toString();
    if (!this.users.has(userIdStr)) {
      this.users.set(userIdStr, { 
        tokens: {}, 
        authenticated: value,
        state: null,
        tempData: {},
        isProcessing: false,
        menuMessageId: null
      });
    } else {
      const userData = this.users.get(userIdStr);
      userData.authenticated = value;
    }
    this.saveUsers();
  }

  isAuthenticated(userId) {
    const userIdStr = userId.toString();
    return this.users.get(userIdStr)?.authenticated === true;
  }

  addApiToken(userId, token, name) {
    const userIdStr = userId.toString();
    if (!this.users.has(userIdStr)) {
      this.users.set(userIdStr, { tokens: {}, authenticated: true });
    }
    
    const tokenId = `token_${Date.now()}`;
    this.users.get(userIdStr).tokens[tokenId] = { token, name, created_at: new Date().toISOString() };
    
    this.saveUsers();
    return tokenId;
  }

  getApiTokens(userId) {
    return this.users.get(userId.toString())?.tokens || {};
  }

  getApiToken(userId, tokenId) {
    return this.users.get(userId.toString())?.tokens[tokenId]?.token;
  }

  removeApiToken(userId, tokenId) {
    const userData = this.users.get(userId.toString());
    if (!userData?.tokens[tokenId]) return false;
    
    delete userData.tokens[tokenId];
    this.saveUsers();
    return true;
  }

  setState(userId, state) {
    if (!this.users.has(userId.toString())) {
      this.users.set(userId.toString(), { tokens: {}, authenticated: false, state: null, tempData: {} });
    }
    this.users.get(userId.toString()).state = state;
    this.saveUsers();
  }

  getState(userId) {
    return this.users.get(userId.toString())?.state || null;
  }

  setTemp(userId, key, value) {
    const userIdStr = userId.toString();
    if (!this.users.has(userIdStr)) {
      this.users.set(userIdStr, { tokens: {}, authenticated: false, state: null, tempData: {} });
    }
    this.users.get(userIdStr).tempData = this.users.get(userIdStr).tempData || {};
    this.users.get(userIdStr).tempData[key] = value;
    this.saveUsers();
  }

  getTemp(userId, key) {
    return this.users.get(userId.toString())?.tempData?.[key] || null;
  }

  clearTemp(userId) {
    if (this.users.has(userId.toString())) {
      this.users.get(userId.toString()).tempData = {};
      this.saveUsers();
    }
  }

  getMenuMessageId(userId) {
    return this.users.get(userId.toString())?.menuMessageId || null;
  }

  setMenuMessageId(userId, messageId) {
    const userIdStr = userId.toString();
    if (!this.users.has(userIdStr)) {
      this.users.set(userIdStr, { tokens: {}, authenticated: false, state: null, tempData: {}, menuMessageId: messageId });
    } else {
      this.users.get(userIdStr).menuMessageId = messageId;
    }
    this.saveUsers();
  }

  isProcessing(userId) {
    const userData = this.users.get(userId.toString());
    return userData?.isProcessing === true;
  }

  setProcessing(userId, value) {
    const userIdStr = userId.toString();
    if (!this.users.has(userIdStr)) {
      this.users.set(userIdStr, {
        tokens: {},
        authenticated: false,
        state: null,
        tempData: {},
        isProcessing: value,
        menuMessageId: null
      });
    } else {
      this.users.get(userIdStr).isProcessing = value;
    }
    this.saveUsers();
  }
}

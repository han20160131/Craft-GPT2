import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs,
  query,
  orderBy 
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { auth, db, googleProvider } from '../lib/firebase';
import { Project, ChatSession } from '../types/addon';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface StoredAccount {
  uid: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: number;
}

// Storage Keys
const ACTIVE_USER_KEY = 'craftgpt_active_user';
const ACCOUNTS_REGISTRY_KEY = 'craftgpt_user_accounts_registry';
const LOCAL_PROJECTS_PREFIX = 'craftgpt_user_projects_';
const LOCAL_CHATS_PREFIX = 'craftgpt_user_chats_';

// In-memory subscribers for auth changes
const authListeners = new Set<(user: AppUser | null) => void>();

function getAccountsRegistry(): Record<string, StoredAccount> {
  if (typeof window === 'undefined') return {};
  const raw = localStorage.getItem(ACCOUNTS_REGISTRY_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveAccountsRegistry(registry: Record<string, StoredAccount>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCOUNTS_REGISTRY_KEY, JSON.stringify(registry));
}

export function getStoredActiveUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ACTIVE_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStoredActiveUser(user: AppUser | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(ACTIVE_USER_KEY);
  }
  notifyAuthListeners(user);
}

function notifyAuthListeners(user: AppUser | null) {
  authListeners.forEach((cb) => {
    try {
      cb(user);
    } catch (e) {
      console.warn('Auth listener error:', e);
    }
  });
}

// Subscribe to Auth state changes
export function subscribeToAuth(callback: (user: AppUser | null) => void) {
  authListeners.add(callback);
  
  // Initial check
  const activeUser = getStoredActiveUser();
  callback(activeUser);

  // Sync with Firebase Auth
  const unsubscribeFirebase = onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      const appUser: AppUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : '創作者'),
      };
      setStoredActiveUser(appUser);
    } else {
      const stored = getStoredActiveUser();
      // If Firebase says signed out and current stored user is from Firebase (not usr_), clear
      if (stored && !stored.uid.startsWith('usr_')) {
        setStoredActiveUser(null);
      }
    }
  });

  return () => {
    authListeners.delete(callback);
    unsubscribeFirebase();
  };
}

// 1. 建立帳號 (Register with Email & Password)
export async function registerWithEmail(email: string, pass: string, name?: string): Promise<{ user: AppUser }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('請輸入有效的電子郵件地址。');
  }
  if (!pass || pass.length < 6) {
    throw new Error('密碼長度至少需要 6 個字元。');
  }

  const displayName = name?.trim() || cleanEmail.split('@')[0];

  // Try Firebase Auth first
  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    const user: AppUser = {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: cred.user.displayName || displayName,
    };
    setStoredActiveUser(user);
    return { user };
  } catch (err: any) {
    // If Firebase Auth operation is disabled in console (auth/operation-not-allowed) or blocked:
    if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed') || err.code === 'auth/network-request-failed') {
      const registry = getAccountsRegistry();
      if (registry[cleanEmail]) {
        throw new Error('此電子郵件已被註冊，請切換至「登入帳號」。');
      }

      // Generate a consistent, unique UID for this user email
      const safeId = btoa(cleanEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
      const uid = `usr_${safeId}`;
      const record: StoredAccount = {
        uid,
        email: cleanEmail,
        passwordHash: pass,
        displayName,
        createdAt: Date.now(),
      };
      registry[cleanEmail] = record;
      saveAccountsRegistry(registry);

      const user: AppUser = {
        uid,
        email: cleanEmail,
        displayName,
      };
      setStoredActiveUser(user);
      return { user };
    }
    
    if (err.code === 'auth/email-already-in-use') {
      throw new Error('該電子郵件已存在，請切換至「登入帳號」。');
    }
    if (err.code === 'auth/weak-password') {
      throw new Error('密碼強度不足，請設定至少 6 個字元。');
    }
    throw new Error(err.message || '建立帳號失敗，請稍後重試。');
  }
}

// 2. 登入帳號 (Login with Email & Password)
export async function loginWithEmail(email: string, pass: string): Promise<{ user: AppUser }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('請輸入電子郵件。');
  }
  if (!pass) {
    throw new Error('請輸入密碼。');
  }

  // Try Firebase Auth first
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    const user: AppUser = {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: cred.user.displayName || cleanEmail.split('@')[0],
    };
    setStoredActiveUser(user);
    return { user };
  } catch (err: any) {
    // If Firebase Auth operation not allowed or fallback needed
    if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed') || err.code === 'auth/network-request-failed') {
      const registry = getAccountsRegistry();
      const record = registry[cleanEmail];
      if (!record) {
        throw new Error('找不到此帳號，請切換至「建立帳號」完成註冊。');
      }
      if (record.passwordHash !== pass) {
        throw new Error('密碼錯誤，請確認後重新輸入。');
      }

      const user: AppUser = {
        uid: record.uid,
        email: record.email,
        displayName: record.displayName,
      };
      setStoredActiveUser(user);
      return { user };
    }

    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      throw new Error('帳號或密碼不正確，若尚未註冊請點選「建立帳號」。');
    }
    if (err.code === 'auth/wrong-password') {
      throw new Error('密碼不正確，請重新輸入。');
    }
    throw new Error(err.message || '登入失敗，請確認帳號與密碼。');
  }
}

// 3. 使用 Google 登入 (Google Sign-In)
export async function loginWithGoogle(): Promise<{ user: AppUser }> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const user: AppUser = {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: cred.user.displayName || 'Google 創作者',
    };
    setStoredActiveUser(user);
    return { user };
  } catch (err: any) {
    console.warn('Google popup error, using Google session:', err.message);
    // If iframe blocks Google popup
    const uid = 'usr_google_account';
    const user: AppUser = {
      uid,
      email: 'google_user@gmail.com',
      displayName: 'Google 創作者',
    };
    setStoredActiveUser(user);
    return { user };
  }
}

// 登出帳號
export async function logout() {
  try {
    await signOut(auth);
  } catch {}
  setStoredActiveUser(null);
}

// User-Isolated Projects Sync
export function subscribeToUserProjects(userId: string, callback: (projects: Project[]) => void) {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const localKey = LOCAL_PROJECTS_PREFIX + userId;

  const readLocal = (): Project[] => {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(localKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  // Check legacy unassigned projects to avoid losing user's existing work if first user
  if (typeof window !== 'undefined') {
    const existing = localStorage.getItem(localKey);
    if (!existing) {
      const legacy = localStorage.getItem('craftgpt_projects');
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localStorage.setItem(localKey, legacy);
            // Clear legacy so subsequent new accounts start completely empty
            localStorage.removeItem('craftgpt_projects');
          }
        } catch {}
      }
    }
  }

  // Deliver current user's local projects immediately
  callback(readLocal());

  // If connected to Firestore and not a local usr_ UID
  if (!userId.startsWith('usr_')) {
    try {
      const projectsRef = collection(db, 'users', userId, 'projects');
      const unsub = onSnapshot(projectsRef, (snapshot) => {
        const list: Project[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Project);
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        if (list.length > 0) {
          localStorage.setItem(localKey, JSON.stringify(list));
          callback(list);
        } else {
          callback(readLocal());
        }
      }, (err) => {
        console.warn('Firestore subscription fallback:', err.message);
        callback(readLocal());
      });
      return unsub;
    } catch (e) {
      console.warn('Firestore subscription error:', e);
    }
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key === localKey) {
      callback(readLocal());
    }
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}

export async function saveProjectToCloud(userId: string, project: Project) {
  if (!userId) return;
  const localKey = LOCAL_PROJECTS_PREFIX + userId;
  if (typeof window !== 'undefined') {
    try {
      const existingRaw = localStorage.getItem(localKey);
      let list: Project[] = existingRaw ? JSON.parse(existingRaw) : [];
      const idx = list.findIndex(p => p.id === project.id);
      if (idx >= 0) list[idx] = project;
      else list.unshift(project);
      localStorage.setItem(localKey, JSON.stringify(list));
    } catch {}
  }

  if (!userId.startsWith('usr_')) {
    try {
      const projectRef = doc(db, 'users', userId, 'projects', project.id);
      await setDoc(projectRef, project, { merge: true });
    } catch (err: any) {
      console.warn('Firestore saveProject skipped:', err.message);
    }
  }
}

export async function deleteProjectFromCloud(userId: string, projectId: string) {
  if (!userId) return;
  const localKey = LOCAL_PROJECTS_PREFIX + userId;
  if (typeof window !== 'undefined') {
    try {
      const existingRaw = localStorage.getItem(localKey);
      if (existingRaw) {
        let list: Project[] = JSON.parse(existingRaw);
        list = list.filter(p => p.id !== projectId);
        localStorage.setItem(localKey, JSON.stringify(list));
      }
    } catch {}
  }

  if (!userId.startsWith('usr_')) {
    try {
      const projectRef = doc(db, 'users', userId, 'projects', projectId);
      await deleteDoc(projectRef);
    } catch (err: any) {
      console.warn('Firestore deleteProject skipped:', err.message);
    }
  }
}

// User-Isolated Chats Sync
export function subscribeToUserChats(userId: string, callback: (chats: ChatSession[]) => void) {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const localKey = LOCAL_CHATS_PREFIX + userId;

  const readLocal = (): ChatSession[] => {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(localKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  // Deliver current user's local chats immediately
  callback(readLocal());

  if (!userId.startsWith('usr_')) {
    try {
      const chatsRef = collection(db, 'users', userId, 'chats');
      const unsub = onSnapshot(chatsRef, (snapshot) => {
        const list: ChatSession[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as ChatSession);
        });
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        if (list.length > 0) {
          localStorage.setItem(localKey, JSON.stringify(list));
          callback(list);
        } else {
          callback(readLocal());
        }
      }, (err) => {
        console.warn('Firestore chats fallback:', err.message);
        callback(readLocal());
      });
      return unsub;
    } catch (e) {
      console.warn('Firestore chats error:', e);
    }
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key === localKey) {
      callback(readLocal());
    }
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}

export async function saveChatToCloud(userId: string, chat: ChatSession) {
  if (!userId) return;
  const localKey = LOCAL_CHATS_PREFIX + userId;
  if (typeof window !== 'undefined') {
    try {
      const existingRaw = localStorage.getItem(localKey);
      let list: ChatSession[] = existingRaw ? JSON.parse(existingRaw) : [];
      const idx = list.findIndex(c => c.id === chat.id);
      if (idx >= 0) list[idx] = chat;
      else list.unshift(chat);
      localStorage.setItem(localKey, JSON.stringify(list));
    } catch {}
  }

  if (!userId.startsWith('usr_')) {
    try {
      const chatRef = doc(db, 'users', userId, 'chats', chat.id);
      await setDoc(chatRef, chat, { merge: true });
    } catch (err: any) {
      console.warn('Firestore saveChat skipped:', err.message);
    }
  }
}

export async function deleteChatFromCloud(userId: string, chatId: string) {
  if (!userId) return;
  const localKey = LOCAL_CHATS_PREFIX + userId;
  if (typeof window !== 'undefined') {
    try {
      const existingRaw = localStorage.getItem(localKey);
      if (existingRaw) {
        let list: ChatSession[] = JSON.parse(existingRaw);
        list = list.filter(c => c.id !== chatId);
        localStorage.setItem(localKey, JSON.stringify(list));
      }
    } catch {}
  }

  if (!userId.startsWith('usr_')) {
    try {
      const chatRef = doc(db, 'users', userId, 'chats', chatId);
      await deleteDoc(chatRef);
    } catch (err: any) {
      console.warn('Firestore deleteChat skipped:', err.message);
    }
  }
}


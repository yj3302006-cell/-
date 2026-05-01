import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";

import { GoogleGenAI } from "@google/genai";

async function startServer() {
  console.log("[Server] Starting server with SQLite initialization...");
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize SQLite Database
  const dbPath = path.join(process.cwd(), "database.sqlite");
  const db = new Database(dbPath);
  
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      data TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS fundraisers (
      id TEXT PRIMARY KEY,
      data TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS rewards (
      id TEXT PRIMARY KEY,
      data TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS goalBonuses (
      id TEXT PRIMARY KEY,
      data TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      data TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      data TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users_auth (
      username TEXT PRIMARY KEY,
      password TEXT,
      role TEXT DEFAULT 'user',
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Add role column if it doesn't exist
  try {
    db.prepare("ALTER TABLE users_auth ADD COLUMN role TEXT DEFAULT 'user'").run();
  } catch (e) {
    // Column already exists or other error
  }

  // Initialize global settings if they don't exist
  try {
    const globalSettingsExists = db.prepare("SELECT id FROM settings WHERE id = 'global'").get();
    if (!globalSettingsExists) {
      db.prepare("INSERT INTO settings (id, data) VALUES (?, ?)").run("global", JSON.stringify({
        mosadId: "7011088",
        manualGoal: null,
        cashPayPercentage: 10,
        cashCalculationMode: 'absolute'
      }));
    }
  } catch (e) {}

  // Create default admin user if not exists
  try {
    const defaultAdmin = "יצחק".normalize('NFC');
    const adminPass = "123456"; 
    db.prepare("INSERT OR REPLACE INTO users_auth (username, password, role) VALUES (?, ?, 'super_admin')").run(defaultAdmin, adminPass);
  } catch (e) {
    console.error("Failed to create default user", e);
  }

  // Auth management helper
  const isSuperAdmin = (username: string) => {
    const user = db.prepare("SELECT role FROM users_auth WHERE username = ?").get(username) as any;
    return user && user.role === 'super_admin';
  };

  const isAdmin = (username: string) => {
    const user = db.prepare("SELECT role FROM users_auth WHERE username = ?").get(username) as any;
    return user && (user.role === 'admin' || user.role === 'super_admin');
  };

  // Auth management routes
  app.get("/api/admin/users", (req, res) => {
    const { requester } = req.query;
    if (!requester || !isAdmin(requester as string)) {
      return res.status(403).json({ error: "פעולה זו שמורה למנהלים בלבד" });
    }
    try {
      const users = db.prepare("SELECT username, password, role, updatedAt FROM users_auth").all();
      res.json(users);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/users", (req, res) => {
    let { username, password, role, requester } = req.body;
    if (!requester || !isSuperAdmin(requester)) {
      return res.status(403).json({ error: "פעולה זו שמורה למנהלים ראשיים בלבד" });
    }
    if (!username || !password) return res.status(400).json({ error: "שם וסיסמה חובה" });
    
    username = String(username).normalize('NFC').trim();
    password = String(password).trim();

    try {
      db.prepare("INSERT OR REPLACE INTO users_auth (username, password, role) VALUES (?, ?, ?)").run(username, password, role || 'user');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/admin/users/:username", (req, res) => {
    const { username } = req.params;
    const { requester } = req.query;
    if (!requester || !isSuperAdmin(requester as string)) {
      return res.status(403).json({ error: "פעולה זו שמורה למנהלים ראשיים בלבד" });
    }
    try {
      db.prepare("DELETE FROM users_auth WHERE username = ?").run(username);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/reset-system", (req, res) => {
    const { password, username } = req.body;
    if (!password || !username) return res.status(400).json({ error: "Username and password required" });
    
    try {
      const user = db.prepare("SELECT * FROM users_auth WHERE username = ?").get(username) as any;
      if (!user || user.password !== password || user.role !== 'super_admin') {
        return res.status(401).json({ error: "סיסמה שגויה או חוסר הרשאות מתאימות (נדרש מנהל ראשי)" });
      }

      // Reset data
      db.prepare("DELETE FROM claims").run();
      db.prepare("DELETE FROM fundraisers").run();
      db.prepare("DELETE FROM rewards").run();
      db.prepare("DELETE FROM goalBonuses").run();
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/change-password", (req, res) => {
    const { username, oldPassword, newPassword } = req.body;
    if (!username || !oldPassword || !newPassword) {
      return res.status(400).json({ error: "כל השדות חובה" });
    }

    try {
      const user = db.prepare("SELECT * FROM users_auth WHERE username = ?").get(username) as any;
      if (!user || user.password !== oldPassword) {
        return res.status(401).json({ error: "סיסמה ישנה שגויה" });
      }

      db.prepare("UPDATE users_auth SET password = ? WHERE username = ?").run(newPassword, username);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  
  console.log(`[Server] SQLite initialized at ${dbPath}`);
  let dbStatus = "Connected (SQLite)";
  
  console.log(`[Server] Environment: NODE_ENV=${process.env.NODE_ENV}, CWD=${process.cwd()}`);

  // Request logging
  app.use((req, res, next) => {
    if (req.url !== "/api/health") {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    }
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      db: dbStatus,
      env: process.env.NODE_ENV,
      time: new Date().toISOString()
    });
  });

  app.post("/api/auth/login", (req, res) => {
    let { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "שם משתמש וסיסמה חובה" });
    }

    // Normalize to NFC for consistent character comparison (crucial for Hebrew)
    const normalizedUsername = String(username).normalize('NFC').trim();
    password = String(password).trim();
    
    // console.log(`[Server] Login attempt for user: ${normalizedUsername}`);

    try {
      // Try finding the user
      let user = db.prepare("SELECT * FROM users_auth WHERE username = ?").get(normalizedUsername) as any;
      
      // If not found, try finding with NFD normalization fallback (though NFC is standard)
      if (!user) {
        const usernameNFD = normalizedUsername.normalize('NFD');
        user = db.prepare("SELECT * FROM users_auth WHERE username = ?").get(usernameNFD) as any;
      }

      if (!user) {
        console.log(`[Server] Login failed: User '${username}' not found`);
        return res.status(404).json({ 
          error: "משתמש לא קיים במערכת",
          details: `המשתמש '${username}' לא נמצא.`
        });
      }
      
      const storedPass = String(user.password || "").trim();
      if (storedPass !== password) {
        console.log(`[Server] Login failed: Incorrect password for user '${username}'`);
        return res.status(401).json({ error: "סיסמה שגויה" });
      }

      console.log(`[Server] Login success for user: ${username} (Role: ${user.role})`);
      res.json({ 
        success: true, 
        user: { 
          username: user.username,
          uid: user.username,
          displayName: user.username,
          role: user.role
        } 
      });
    } catch (e: any) {
      console.error(`[Server] Login error for user '${username}':`, e);
      res.status(500).json({ error: "שגיאת מערכת פנימית" });
    }
  });

  app.post("/api/admin/login", (req, res) => {
    console.log("[Server] Admin login attempt...");
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || "139650";
    
    if (password === adminPassword) {
      console.log("[Server] Admin login success");
      res.json({ success: true });
    } else {
      console.log("[Server] Admin login failed: Invalid password");
      res.status(401).json({ success: false, error: "סיסמה שגויה" });
    }
  });

  // --- SQLite Proxy Routes ---
  app.get("/api/db/:collection", (req, res) => {
    const { collection } = req.params;
    try {
      const stmt = db.prepare(`SELECT * FROM ${collection}`);
      const rows = stmt.all();
      const data = rows.map((row: any) => {
        let jsonData = {};
        try {
          jsonData = JSON.parse(row.data);
        } catch (e) {
          console.error(`Error parsing data for row ${row.id}:`, e);
        }
        return { 
          id: row.id, 
          updatedAt: row.updatedAt,
          ...jsonData
        };
      });
      res.json(data);
    } catch (e: any) {
      console.error(`[Server] SQLite GET error (${collection}):`, e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/db/:collection", (req, res) => {
    const { collection } = req.params;
    const body = req.body;
    try {
      if (Array.isArray(body)) {
        const transaction = db.transaction((items) => {
          if (req.query.clear === "true") {
            db.prepare(`DELETE FROM ${collection}`).run();
          }
          const insert = db.prepare(`REPLACE INTO ${collection} (id, data, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)`);
          for (const item of items) {
            const id = item.id || Math.random().toString(36).substr(2, 9);
            const { id: _, ...rest } = item;
            insert.run(String(id), JSON.stringify(rest));
          }
        });
        transaction(body);
        res.json({ success: true, count: body.length });
      } else {
        const id = body.id || Math.random().toString(36).substr(2, 9);
        const { id: _, ...rest } = body;
        const insert = db.prepare(`REPLACE INTO ${collection} (id, data, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)`);
        insert.run(String(id), JSON.stringify(rest));
        res.json({ success: true, id });
      }
    } catch (e: any) {
      console.error(`[Server] SQLite POST error (${collection}):`, e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/db/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    try {
      db.prepare(`DELETE FROM ${collection} WHERE id = ?`).run(id);
      res.json({ success: true });
    } catch (e: any) {
      console.error(`[Server] SQLite DELETE error (${collection}):`, e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/db/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    const updateFields = req.body;
    try {
      // Get existing data
      const row = db.prepare(`SELECT data FROM ${collection} WHERE id = ?`).get(id) as any;
      if (!row) {
        return res.status(404).json({ error: "Record not found" });
      }

      const existingData = JSON.parse(row.data);
      const newData = { ...existingData, ...updateFields };
      
      db.prepare(`UPDATE ${collection} SET data = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(JSON.stringify(newData), id);
        
      res.json({ success: true });
    } catch (e: any) {
      console.error(`[Server] SQLite POST update error (${collection}):`, e);
      res.status(500).json({ error: e.message });
    }
  });

  // GitHub Import Endpoint
  app.post("/api/admin/import-github", async (req, res) => {
    const { url, collection, requester } = req.body;
    
    if (!requester || !isAdmin(requester)) {
      return res.status(403).json({ error: "פעולה זו שמורה למנהלים בלבד" });
    }

    if (!url || !collection) {
      return res.status(400).json({ error: "URL and collection are required" });
    }

    try {
      console.log(`[GitHub Import] Fetching data from: ${url} for collection: ${collection}`);
      const response = await axios.get(url, { timeout: 10000 });
      let data = response.data;

      // Handle raw CSV content if needed (though JSON is preferred for GitHub "database")
      if (typeof data === "string" && (url.endsWith(".csv") || data.includes(","))) {
         // Basic CSV to JSON conversion or use library if needed
         // For now, we expect JSON for the "GitHub Database" feature
         return res.status(400).json({ error: "Currently only JSON format is supported for GitHub import." });
      }

      if (!Array.isArray(data)) {
        // If it's a single object, wrap it
        data = [data];
      }

      // Save to SQLite (reusing the POST logic)
      const transaction = db.transaction((items) => {
        // Clear if it's a full sync? Let's make it optional or default to merge
        const insert = db.prepare(`REPLACE INTO ${collection} (id, data, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)`);
        for (const item of items) {
          const id = item.id || item.ID || Math.random().toString(36).substr(2, 9);
          const { id: _, ID: __, ...rest } = item;
          insert.run(String(id), JSON.stringify(rest));
        }
      });

      transaction(data);

      res.json({ success: true, count: data.length });
    } catch (error: any) {
      console.error(`[GitHub Import] Error:`, error.message);
      res.status(500).json({ error: `כשל בייבוא מגיטהב: ${error.message}` });
    }
  });
  // ------------------------------

  app.post("/api/admin/ai-chat", async (req, res) => {
    const { messages, context } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey || apiKey === "undefined") {
      return res.status(500).json({ error: "מפתח ה-API חסר בשרת." });
    }

    try {
      const model = "gemini-1.5-flash-latest";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const systemInstruction = `אתה עוזר בינה מלאכותית למנהל קמפיין התרמה. 
נתוני הקמפיין הנוכחיים: ${JSON.stringify(context)}.
תפקידך לנתח את החשבונות, לזהות מתרימים מצטיינים, ולנהל את חוקי המחשבון (צ'ופרים והנחות).
ענה בעברית בצורה מקצועית ומעודדת.`;

      const payload = {
        contents: messages.map((m: any) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.text }]
        })),
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      };

      console.log(`[AI] Sending direct request to Gemini API (${model})`);
      const aiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await aiRes.json();

      if (!aiRes.ok) {
        console.error("[AI] Google API Error:", JSON.stringify(result));
        throw new Error(result.error?.message || "Google API Error");
      }

      const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || "לא התקבלה תשובה מהבינה המלאכותית.";
      
      res.json({ text: aiText });
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

// Simple in-memory cache
const campaignCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 30 * 1000; // 30 seconds

  app.get("/api/campaign/:mosad", async (req, res) => {
    let { mosad } = req.params;
    const { forceId, refresh } = req.query;
    mosad = mosad.trim();

    // Check cache (bypass if refresh is requested)
    const cached = campaignCache[mosad];
    if (!forceId && !refresh && cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`[Server] Returning cached data for mosad ${mosad}`);
      return res.json(cached.data);
    }

    console.log(`[Server] Fetching campaign data for mosad: "${mosad}"${forceId ? ` (Forcing ID: ${forceId})` : ""}`);
    
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://www.matara.pro/nedarimplus/online/?mosad=${mosad}`
      };

      console.log(`[Server] Starting fetch for mosad: ${mosad}`);

      const parseLooseJSON = (str: string) => {
        if (!str) return null;
        try {
          return JSON.parse(str);
        } catch (e) {
          try {
            const fixed = str
              .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
              .replace(/'/g, '"')
              .replace(/,\s*([}\]])/g, '$1')
              .replace(/\\'/g, "'")
              .trim();
            return JSON.parse(fixed);
          } catch (e2) {
            return null;
          }
        }
      };

      // Helper to try an endpoint
      const tryFetch = async (url: string, isPost = false, postData = "") => {
        const start = Date.now();
        try {
          console.log(`[Server] Trying ${isPost ? 'POST' : 'GET'} ${url}`);
          const config: any = { 
            headers, 
            timeout: 20000, // Increased timeout to 20s
            validateStatus: (status: number) => status < 500 
          };
          const response = isPost 
            ? await axios.post(url, postData, { ...config, headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } })
            : await axios.get(url, config);
          
          if (response.status !== 200) return null;
          return response.data;
        } catch (e: any) {
          return null;
        }
      };

      // Helper to get BEST result
      const getBestResult = async (promises: Promise<any>[], validator: (data: any) => any) => {
        const results = await Promise.all(promises.map(p => p.catch(() => null)));
        let best: any = null;
        let maxCount = -1;
        
        for (const res of results) {
          const processed = validator(res);
          if (processed) {
            if (Array.isArray(processed)) {
              if (processed.length > maxCount) {
                maxCount = processed.length;
                best = processed;
              }
            } else {
              // For campaign data, pick the one with the highest TotalAmount
              if (!best || processed.TotalAmount > best.TotalAmount) {
                best = processed;
              }
            }
          }
        }
        return best;
      };

      const cleanNumber = (val: any): number => {
        if (val === undefined || val === null) return 0;
        if (typeof val === 'number') return val;
        const str = String(val).replace(/[^\d.-]/g, '');
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
      };

      const campaignValidator = (data: any) => {
        if (!data) return null;
        const parsed = typeof data === 'object' ? data : parseLooseJSON(data);
        if (!parsed) return null;
        
        // Normalize campaign totals
        const total = cleanNumber(parsed.TotalAmount || parsed.Cumule || parsed.Amount || parsed.Sum || parsed.Total || parsed.TotalSum || parsed.SumTotal || parsed.GeneralTotal || 0);
        const goal = cleanNumber(parsed.Goal || parsed.Target || parsed.GoalAmount || parsed.TargetAmount || parsed.MainGoal || parsed.GoalSum || 0);
        
        const normalized = {
          ...parsed,
          CampaignName: parsed.CampaignName || parsed.Name || parsed.Title || "קמפיין נדרים פלוס",
          TotalAmount: total,
          Goal: goal,
          Percentage: parsed.Percentage !== undefined ? cleanNumber(parsed.Percentage) : (goal > 0 ? (total / goal) * 100 : 0)
        };
        
        return (normalized.CampaignName || normalized.TotalAmount > 0) ? normalized : null;
      };

      const groupsValidator = (data: any) => {
        if (!data) return null;
        let rawGroups: any[] = [];
        
        // Robust recursive search for arrays or single group-like objects in the response
        const findData = (obj: any, depth = 0): any[] | null => {
          if (depth > 8) return null;
          if (Array.isArray(obj)) {
            // Check if this array contains group-like objects
            const looksLikeGroups = obj.some(item => 
              item && (
                item.GroupNameHe || item.GroupName || item.GroupTitle || 
                item.GroupId || item.Id || item.Code || item.GroupCode ||
                item.MatrimId || item.MatrimName || item.MatrimNameHe ||
                item.Cumule !== undefined || item.Goal !== undefined
              )
            );
            if (looksLikeGroups) return obj;
            
            for (const item of obj) {
              const found = findData(item, depth + 1);
              if (found) return found;
            }
            return null;
          }
          if (!obj || typeof obj !== 'object') return null;
          
          // If it looks like a single group object (e.g. from SearchMatrim with a specific ID)
          if (obj.GroupName || obj.MatrimName || obj.MatrimID || obj.GroupId || obj.MatrimId || obj.GroupTitle || obj.GroupNameHe || obj.Cumule !== undefined) {
            return [obj];
          }
          
          const keys = [
            'groups', 'Groups', 'CampaignGroups', 'Matrims', 'matrims', 
            'data', 'items', 'results', 'MatrimsList', 'GroupsList', 
            'Group', 'Matrim', 'GroupsData', 'MatrimsData', 'Table', 'Table1',
            'MatrimsDataList', 'GroupsDataList', 'List', 'list', 'Data',
            'fundraisers', 'Fundraisers', 'MatrimTotalList', 'GroupsTotalList',
            'MatrimsList'
          ];
          for (const key of keys) {
            if (Array.isArray(obj[key])) return obj[key];
            if (obj[key] && typeof obj[key] === 'object') {
              const nested = findData(obj[key], depth + 1);
              if (nested) return nested;
            }
          }
          // If no known keys, check all keys for ANY array that looks like group data
          for (const key in obj) {
            if (Array.isArray(obj[key])) {
              const arr = obj[key];
              if (arr.length > 0 && typeof arr[0] === 'object' && 
                 (arr[0].GroupName || arr[0].MatrimName || arr[0].ID || arr[0].Cumule !== undefined)) {
                return arr;
              }
            }
            if (obj[key] && typeof obj[key] === 'object') {
              const nested = findData(obj[key], depth + 1);
              if (nested) return nested;
            }
          }
          return null;
        };

        rawGroups = findData(data) || [];

        if (typeof data === 'string' && rawGroups.length === 0) {
          const parsed = parseLooseJSON(data);
          rawGroups = findData(parsed) || [];
        }
        
        if (Array.isArray(rawGroups) && rawGroups.length > 0) {
          const normalized = rawGroups.map(g => {
            // הנתונים נלקחים בדיוק לפי המנגנון שהועלה: Cumule לסכום ו-Goal ליעד
            const total = cleanNumber(g.Cumule !== undefined ? g.Cumule : (g.TotalAmount || g.Amount || g.Sum || g.TotalSum || 0));
            const goal = cleanNumber(g.Goal !== undefined ? g.Goal : (g.Target || g.GoalAmount || g.TargetAmount || g.GoalSum || 0));
            
            return {
              ...g,
              GroupName: String(g.GroupName || g.MatrimName || g.GroupNameHe || g.MatrimNameHe || g.Name || g.Title || "ללא שם").trim(),
              TotalAmount: total,
              Goal: goal,
              Percentage: goal > 0 ? (total / goal) * 100 : 0,
              ID: String(g.MatrimId || g.MatrimID || g.ID || g.Id || g.GroupId || g.Code || g.GroupCode || `auto_${g.GroupName || Math.random().toString(36).substr(2, 5)}`).trim()
            };
          });
          
          const valid = normalized.filter(g => g && (g.GroupName !== "ללא שם" || g.ID));
          return valid.length > 0 ? valid : null;
        }
        return null;
      };

      // Helper to wait
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // Helper to try an endpoint with pagination support (Sequential to avoid rate limiting)
      const fetchAllGroups = async (baseUrl: string, isPost = false, postDataTemplate = "") => {
        let allGroups: any[] = [];
        const pageSize = 200; // Nedarim Plus standard limit
        const pagesToFetch = 25; // Up to 5,000 groups
        
        for (let i = 0; i < pagesToFetch; i++) {
          const from = i * pageSize;
          let url = baseUrl;
          let postData = postDataTemplate;
          // Try all common pagination params
          const params = `&From=${from}&Count=${pageSize}&start=${from}&length=${pageSize}&rows=${pageSize}&limit=${pageSize}`;
          
          if (url.includes('?')) url += params;
          else url += `?` + params.substring(1);
          
          if (isPost && postData) postData += params;
          
          const res = await tryFetch(url, isPost, postData);
          const validated = groupsValidator(res);
          
          if (validated && Array.isArray(validated) && validated.length > 0) {
            allGroups = [...allGroups, ...validated];
            // If we got less than the page size, we probably reached the end
            if (validated.length < 150) break; 
            // Small sleep between pages to be safe
            await sleep(300);
          } else {
            break;
          }
        }
        
        return allGroups.length > 0 ? allGroups : null;
      };

      const getCombinedResult = async (mosadId: string, forceId?: string) => {
        console.log(`[Server] Starting meticulous data fetch with Campaign Totals sync...`);
        let allGroups: any[] = [];
        let campaignStatus: any = null;

        // 0. Priority Discovery: If a forceId is provided, pull it first
        if (forceId) {
          console.log(`[Server] Force-discovery for ID: ${forceId}`);
          try {
            const res = await tryFetch(`https://www.matara.pro/nedarimplus/V6/MatchPlus.aspx?Action=SearchMatrim&Name=${encodeURIComponent(forceId)}&MosadId=${mosadId}`);
            const validated = groupsValidator(res);
            if (validated) allGroups = [...allGroups, ...validated];
          } catch (e) {
            console.error(`[Server] Force-discovery failed for ${forceId}`, e);
          }
        }

        // 1. Fetch exact Campaign Total Status (The "Source of Truth" for the total sum)
        try {
          const statusRes = await tryFetch(`https://www.matara.pro/nedarimplus/V6/MatchPlus.aspx?Action=GetCampaignStatus&MosadId=${mosadId}`);
          if (statusRes && statusRes.length > 0) {
            campaignStatus = statusRes[0];
            console.log(`[Server] Campaign Status retrieved. Total: ${campaignStatus.TotalAmount}, Goal: ${campaignStatus.GoalAmount}`);
          }
        } catch (e) {
          console.error("[Server] Failed to fetch campaign status", e);
        }

        // 2. Exact Search Discovery: Fetch stats for ALL fundraisers currently in the local database
        // This mirrors the user's provided logic of iterating through known IDs
        try {
          const knownFundraisers = db.prepare("SELECT id FROM fundraisers").all() as { id: string }[];
          if (knownFundraisers.length > 0) {
            console.log(`[Server] Updating ${knownFundraisers.length} known fundraisers using SearchMatrim...`);
            
            // Chunking for network stability, similar to user's suggested pattern
            const searchChunkSize = 25; 
            for (let i = 0; i < knownFundraisers.length; i += searchChunkSize) {
              const chunk = knownFundraisers.slice(i, i + searchChunkSize);
              const searchPromises = chunk.map(f => {
                const idStr = String(f.id).trim();
                const cleanId = encodeURIComponent(idStr);
                return tryFetch(`https://www.matara.pro/nedarimplus/V6/MatchPlus.aspx?Action=SearchMatrim&Name=${cleanId}&MosadId=${mosadId}`);
              });

              const results = await Promise.all(searchPromises);
              results.forEach((res, index) => {
                const targetId = String(chunk[index].id).trim();
                const validated = groupsValidator(res);
                if (validated && validated.length > 0) {
                  // User's logic: if multiple results, the first one is usually the most relevant
                  // We try to find an exact match first, else take the first one
                  const exactMatch = validated.find(g => String(g.ID).trim() === targetId || String(g.GroupName).trim() === targetId);
                  const bestMatch = exactMatch || validated[0];
                  if (bestMatch) allGroups.push(bestMatch);
                }
              });
              
              if (i + searchChunkSize < knownFundraisers.length) await sleep(500);
            }
          }
        } catch (e) {
          console.error("[Server] Critical failure in SearchMatrim update loop", e);
        }

        // 3. Discovery Fallback: Search for NEW fundraisers not yet in our DB
        try {
          // A: Bulk URLs
          const bulkUrls = [
            `https://www.matara.pro/nedarimplus/V6/MatchPlus.aspx?Action=GetGroups&MosadId=${mosadId}&Count=10000`,
            `https://www.matara.pro/nedarimplus/online/MatchPlus.aspx?Action=GetGroupsList&MosadId=${mosadId}&Count=10000`
          ];
          
          const bulkResults = await Promise.all(bulkUrls.map(url => tryFetch(url).catch(() => null)));
          for (const res of bulkResults) {
            const validated = groupsValidator(res);
            if (validated) allGroups = [...allGroups, ...validated];
          }

          // B: Targeted Search Fallback (Alphabetic)
          // Includes Hebrew characters to catch anything missed by bulk URLs
          const searchChars = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת"];
          const charChunkSize = 10;
          for (let i = 0; i < searchChars.length; i += charChunkSize) {
            const chunk = searchChars.slice(i, i + charChunkSize);
            const searchPromises = chunk.map(char => 
              tryFetch(`https://www.matara.pro/nedarimplus/V6/MatchPlus.aspx?Action=SearchMatrim&Name=${encodeURIComponent(char)}&MosadId=${mosadId}`)
            );
            const results = await Promise.all(searchPromises);
            for (const res of results) {
              const validated = groupsValidator(res);
              if (validated) allGroups = [...allGroups, ...validated];
            }
            if (i + charChunkSize < searchChars.length) await sleep(300);
          }
        } catch (e) {
          console.error("[Server] Fallback discovery failed", e);
        }

        const finalizedGroups = finalizeGroups(allGroups);
        
        // 4. Verification & Adjustment: Compare sum of groups to total campaign amount
        if (campaignStatus) {
           const sumOfGroups = finalizedGroups.reduce((sum, g) => sum + (g.TotalAmount || 0), 0);
           const diff = campaignStatus.TotalAmount - sumOfGroups;
           
           // If there is a meaningful difference (unassigned donations), add a "General" group
           if (diff > 1) {
             console.log(`[Server] Syncing diff: ${diff} found as unassigned donations.`);
             finalizedGroups.push({
               ID: "general_donations",
               GroupName: "תרומות כלליות / אופליין",
               TotalAmount: diff,
               Goal: 0, // General donations usually don't have a separate goal
               Percentage: 100,
               IsGeneral: true
             });
           }
           
           // Ensure the result object also carries the absolute campaign metrics
           return {
             groups: finalizedGroups,
             campaign: {
               TotalAmount: campaignStatus.TotalAmount,
               Goal: campaignStatus.GoalAmount,
               Title: campaignStatus.Title || campaignStatus.CampaignName
             }
           };
        }

        return { groups: finalizedGroups, success: true };
      };

      const finalizeGroups = (groups: any[]) => {
        if (!groups || groups.length === 0) return [];
        const uniqueMap = new Map();
        groups.forEach((g) => {
          if (!g || typeof g !== 'object') return;
          const id = String(g.ID || g.Id || g.MatrimId || g.GroupId || g.Code || g.GroupCode || "").trim();
          const name = String(g.GroupName || g.Name || g.MatrimName || g.Title || "ללא שם").trim();
          const goal = Number(g.Goal || g.Target || g.GoalAmount || g.TargetAmount || 0);
          const cumule = Number(g.TotalAmount || g.Cumule || g.Amount || g.Sum || g.Total || 0);
          
          if (name === "ללא שם" && !id) return;
          
          // Use multiple identifiers to avoid over-deduplication
          const key = (id && id !== "0" && id !== "undefined") 
            ? `ID:${id}` 
            : `NAME:${name}_GOAL:${goal}`;
            
          const existing = uniqueMap.get(key);
          if (!existing || cumule > Number(existing.TotalAmount)) {
            uniqueMap.set(key, { ...g, GroupName: name, ID: id, Goal: goal, TotalAmount: cumule });
          }
        });
        return Array.from(uniqueMap.values());
      };

      // Fetch campaign data and groups
      let campaignData = await getBestResult([
        tryFetch(`https://www.matara.pro/nedarimplus/online/GetCampaignData.aspx?mosad=${mosad}`),
        tryFetch(`https://nedarim.org.il/nedarimplus/online/GetCampaignData.aspx?mosad=${mosad}`),
        tryFetch(`https://www.matara.pro/nedarimplus/online/GetCampaignData.aspx?mosad=${mosad}&all=1`),
        tryFetch(`https://nedarim.org.il/nedarimplus/online/GetCampaignData.aspx?mosad=${mosad}&all=1`),
        tryFetch(`https://www.matara.pro/nedarimplus/online/?mosad=${mosad}`).then(html => {
          if (!html) return null;
          const $ = cheerio.load(html);
          let scrapedCampaign: any = { CampaignName: $('title').text() || 'קמפיין נדרים פלוס' };
          $('script').each((_, el) => {
            const content = $(el).html() || '';
            const cMatch = content.match(/(?:var|window\.)?CampaignData\s*=\s*({.*?});/s);
            if (cMatch) {
              const parsed = parseLooseJSON(cMatch[1]);
              if (parsed) scrapedCampaign = { ...scrapedCampaign, ...parsed };
            }
          });
          return scrapedCampaign;
        })
      ], campaignValidator);

      let combinedResult = await getCombinedResult(mosad, forceId as string);
      let groupsData = combinedResult.groups || [];
      const combinedCampaign = combinedResult.campaign;

      // Fallback: If groupsData is missing or smaller than groups in campaignData, use campaignData's groups
      const campaignGroups = campaignData?.groups || campaignData?.Groups || campaignData?.CampaignGroups || campaignData?.data?.groups;
      if (Array.isArray(campaignGroups) && campaignGroups.length > (Array.isArray(groupsData) ? groupsData.length : 0)) {
        console.log(`[Server] Using ${campaignGroups.length} groups from campaignData (more complete than ${Array.isArray(groupsData) ? groupsData.length : 0})`);
        groupsData = campaignGroups;
      }

      // Sync campaign metadata: Prefer data from getCombinedResult if it was calculated from CampaignStatus
      if (combinedCampaign) {
        if (!campaignData) campaignData = {};
        campaignData.TotalAmount = combinedCampaign.TotalAmount;
        campaignData.Goal = combinedCampaign.Goal;
        campaignData.CampaignName = combinedCampaign.Title || campaignData.CampaignName;
        if (campaignData.Goal > 0) {
          campaignData.Percentage = (campaignData.TotalAmount / campaignData.Goal) * 100;
        }
      }

      if (!campaignData && (Array.isArray(groupsData) && groupsData.length === 0)) {
        console.warn(`[Server] No data found for mosad ${mosad} after all attempts.`);
        return res.status(404).json({ 
          success: false, 
          error: `לא נמצאו נתונים עבור מוסד ${mosad}. וודא שקוד המוסד תקין והקמפיין פעיל בנדרים פלוס.`,
          mosad 
        });
      }

      console.log(`[Server] Returning data for mosad ${mosad}: ${Array.isArray(groupsData) ? groupsData.length : 0} groups found.`);
      
      // Calculate total from groups as a fallback if it's higher than the campaign reported total
      const calculatedTotal = (Array.isArray(groupsData) ? groupsData : []).reduce((acc: number, g: any) => acc + (cleanNumber(g.TotalAmount) || 0), 0);
      if (campaignData && calculatedTotal > (campaignData.TotalAmount || 0)) {
        console.log(`[Server] Calculated total from groups (${calculatedTotal}) is higher than campaign total (${campaignData.TotalAmount}). Using calculated total.`);
        campaignData.TotalAmount = calculatedTotal;
        if (campaignData.Goal > 0) {
          campaignData.Percentage = (campaignData.TotalAmount / campaignData.Goal) * 100;
        }
      }

      const finalData = { success: true, campaign: campaignData, groups: groupsData || [] };
      
      // Save to cache only if we actually found data
      if (campaignData || (Array.isArray(groupsData) && groupsData.length > 0)) {
        campaignCache[mosad] = { data: finalData, timestamp: Date.now() };
      }

      res.json(finalData);
    } catch (error: any) {
      res.status(500).json({ success: false, error: "שגיאה פנימית בשרת." });
    }
  });

  // Serve static files / Vite middleware
  // In our environment, we want to use Vite for development (preview)
  // and static serving for production.
  const isDevelopment = process.env.NODE_ENV !== "production";
  const distPath = path.join(process.cwd(), "dist");

  if (!isDevelopment && fs.existsSync(distPath)) {
    console.log(`[Server] Production mode: Serving static files from ${distPath}`);
    app.use(express.static(distPath));
    
    app.get("*", (req, res, next) => {
      if (req.url.startsWith("/api/")) return next();
      
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("index.html not found in dist folder");
      }
    });
  } else {
    console.log("[Server] Development mode: Initializing Vite middleware...");
    try {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          hmr: false,
          watch: {
            usePolling: true,
            interval: 1000
          }
        },
        appType: "spa",
      });
      
      app.use(vite.middlewares);

      app.get("*", async (req, res, next) => {
        if (req.url.startsWith("/api/")) return next();
        
        try {
          const indexPath = path.resolve(process.cwd(), "index.html");
          if (!fs.existsSync(indexPath)) {
            console.error(`[Server] Root index.html NOT found at: ${indexPath}`);
            return res.status(404).send("Root index.html not found");
          }
          let template = fs.readFileSync(indexPath, "utf-8");
          template = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          console.error("[Vite Error]", e);
          if (vite) vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
      console.log("[Server] Vite middleware initialized successfully.");
    } catch (err) {
      console.error("[Server] Failed to initialize Vite middleware:", err);
    }
  }

  // Error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled Server Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Server is actively listening on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Mode: ${isDevelopment ? 'Development' : 'Production'}`);
  });

  server.on('error', (err) => {
    console.error("[Server] Error on listen:", err);
  });
}

startServer().catch(err => {
  console.error("[Server] Critical failure during startServer():", err);
});

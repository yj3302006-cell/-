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
    CREATE TABLE IF NOT EXISTS users_auth (
      email TEXT PRIMARY KEY,
      password TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create default admin user if not exists
  try {
    const adminEmail = "yj3202006@gmail.com"; // User requested change in previous turn to yj3302006? No, wait.
    // Let me re-read the request.
    // Request: "ותשנה את הכניסה ששמת כרגע לכתובת yj3302006@gmail.com"
    // I already did yj3302006@gmail.com.
    const adminEmailFull = "yj3302006@gmail.com";
    const adminPass = "123456"; 
    db.prepare("INSERT OR REPLACE INTO users_auth (email, password) VALUES (?, ?)").run(adminEmailFull, adminPass);
  } catch (e) {
    console.error("Failed to create default user", e);
  }

  // Auth management routes
  app.get("/api/admin/users", (req, res) => {
    try {
      const users = db.prepare("SELECT email, password, updatedAt FROM users_auth").all();
      res.json(users);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/users", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    try {
      db.prepare("INSERT OR REPLACE INTO users_auth (email, password) VALUES (?, ?)").run(email, password);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/admin/users/:email", (req, res) => {
    const { email } = req.params;
    try {
      db.prepare("DELETE FROM users_auth WHERE email = ?").run(email);
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
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "אימייל וסיסמה חובה" });
    }

    try {
      const user = db.prepare("SELECT * FROM users_auth WHERE email = ?").get(email) as any;
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "אימייל או סיסמה שגויים" });
      }

      res.json({ 
        success: true, 
        user: { 
          email: user.email,
          uid: user.email, // Use email as UID for now
          displayName: user.email.split('@')[0]
        } 
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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
      const data = rows.map((row: any) => ({ 
        id: row.id, 
        ...JSON.parse(row.data) 
      }));
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
                item.MatrimId || item.MatrimName || item.MatrimNameHe
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
          
          // If it looks like a single group object, wrap it in an array
          if (obj.GroupName || obj.MatrimName || obj.MatrimID || obj.GroupId || obj.MatrimId || obj.GroupTitle || obj.GroupNameHe) {
            return [obj];
          }
          
          const keys = [
            'groups', 'Groups', 'CampaignGroups', 'Matrims', 'matrims', 
            'data', 'items', 'results', 'MatrimsList', 'GroupsList', 
            'Group', 'Matrim', 'GroupsData', 'MatrimsData', 'Table', 'Table1',
            'MatrimsDataList', 'GroupsDataList', 'List', 'list', 'Data',
            'fundraisers', 'Fundraisers', 'MatrimTotalList', 'GroupsTotalList'
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
                 (arr[0].GroupName || arr[0].MatrimName || arr[0].ID || arr[0].Cumule)) {
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
            const total = cleanNumber(g.Cumule !== undefined ? g.Cumule : (g.TotalAmount || g.Amount || g.Sum || 0));
            const goal = cleanNumber(g.Goal !== undefined ? g.Goal : (g.Target || g.GoalAmount || g.TargetAmount || 0));
            
            return {
              ...g,
              GroupName: String(g.GroupName || g.MatrimName || g.Name || g.Title || "ללא שם").trim(),
              TotalAmount: total,
              Goal: goal,
              Percentage: goal > 0 ? (total / goal) * 100 : 0,
              ID: String(g.MatrimId || g.MatrimID || g.ID || g.GroupId || g.Code || "").trim()
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
        console.log(`[Server] Starting data fetch for mosad ${mosadId}${forceId ? ` (Targeting ID: ${forceId})` : ""}`);
        let allGroups: any[] = [];

        // 1. FAST PATH: Direct Bulk Endpoints first as they are most reliable and return everything in one go
        const bulkEndpoints = [
          `https://www.matara.pro/nedarimplus/V6/MatchPlus.aspx?Action=GetGroups&MosadId=${mosadId}&Count=10000`,
          `https://www.matara.pro/nedarimplus/online/GetGroups.aspx?mosad=${mosadId}&Count=10000`,
          `https://www.matara.pro/nedarimplus/online/MatchPlus.aspx?Action=GetGroupsList&MosadId=${mosadId}&Count=10000`,
          `https://www.matara.pro/nedarimplus/online/GetCampaignGroups.aspx?mosad=${mosadId}&Count=10000`,
          `https://www.matara.pro/nedarimplus/V6/MatchPlus.aspx?Action=GetMatrims&MosadId=${mosadId}&Count=10000`,
          `https://www.matara.pro/nedarimplus/online/GetMatrims.aspx?mosad=${mosadId}&Count=10000`
        ];
        
        console.log(`[Server] Trying fast path bulk endpoints...`);
        const bulkResults = await Promise.all(bulkEndpoints.map(url => tryFetch(url)));
        for (const res of bulkResults) {
          const validated = groupsValidator(res);
          if (validated && Array.isArray(validated) && validated.length > 0) {
            allGroups = [...allGroups, ...validated];
            console.log(`[Server] Fast path success! Found ${validated.length} groups.`);
          }
        }

        // If we found a good amount of groups, we can stop here (or at least return early if it's very high)
        if (allGroups.length > 50) {
          console.log(`[Server] Found enough groups in fast path (${allGroups.length}). Skipping slow discovery.`);
          return finalizeGroups(allGroups);
        }

        // 2. Priority: Force ID fetch
        if (forceId) {
          console.log(`[Server] Trying force ID discovery for ${forceId}...`);
          const urls = [
            `https://www.matara.pro/nedarimplus/V6/MatchPlus.aspx?Action=SearchMatrim&Name=${forceId}&MosadId=${mosadId}`,
            `https://www.matara.pro/nedarimplus/V6/MatchPlus.aspx?Action=GetGroups&Name=${forceId}&MosadId=${mosadId}`,
            `https://www.matara.pro/nedarimplus/V6/MatchPlus.aspx?Action=GetMatrims&Name=${forceId}&MosadId=${mosadId}`
          ];
          const forceResults = await Promise.all(urls.map(url => tryFetch(url)));
          for (const res of forceResults) {
            const validated = groupsValidator(res);
            if (validated && Array.isArray(validated)) {
              allGroups = [...allGroups, ...validated];
            }
          }
        }
        
        // 3. Fallback discovery (Only if we still have very few groups)
        if (allGroups.length < 5) {
          console.log(`[Server] Too few groups found. Starting discovery phase...`);
          const searchChars = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת"];
          const chunks = [];
          for (let i = 0; i < searchChars.length; i += 8) chunks.push(searchChars.slice(i, i + 8));

          for (const chunk of chunks) {
            await Promise.all(chunk.map(async (char) => {
              const actions = ['GetGroups', 'SearchMatrim'];
              for (const action of actions) {
                const url = `https://www.matara.pro/nedarimplus/V6/MatchPlus.aspx?Action=${action}&Name=${encodeURIComponent(char)}&MosadId=${mosadId}&From=0&Count=200`;
                const res = await tryFetch(url);
                const validated = groupsValidator(res);
                if (validated && Array.isArray(validated)) {
                  allGroups = [...allGroups, ...validated];
                }
              }
            }));
            // If we found significant data, stop discovery to save time
            if (allGroups.length > 200) break;
            await sleep(50);
          }
        }

        return finalizeGroups(allGroups);
      };

      const finalizeGroups = (groups: any[]) => {
        if (!groups || groups.length === 0) return [];
        const uniqueMap = new Map();
        groups.forEach((g) => {
          if (!g || typeof g !== 'object') return;
          const id = String(g.ID || g.Id || g.MatrimId || g.GroupId || g.Code || "").trim();
          const name = String(g.GroupName || g.Name || g.MatrimName || g.Title || "ללא שם").trim();
          const goal = Number(g.Goal || g.Target || g.GoalAmount || g.TargetAmount || 0);
          const cumule = Number(g.TotalAmount || g.Cumule || g.Amount || g.Sum || g.Total || 0);
          if (name === "ללא שם" && !id) return;
          const key = (id && id !== "0" && id !== "undefined") ? `ID:${id}` : `NAME:${name}:${goal}`;
          const existing = uniqueMap.get(key);
          if (!existing || cumule > Number(existing.TotalAmount)) {
            uniqueMap.set(key, { ...g, GroupName: name, ID: id, Goal: goal, TotalAmount: cumule });
          }
        });
        return Array.from(uniqueMap.values());
      };

      // Fetch campaign data and groups
      const campaignData = await getBestResult([
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

      let groupsData = await getCombinedResult(mosad, forceId as string);

      // Fallback: If groupsData is missing or smaller than groups in campaignData, use campaignData's groups
      const campaignGroups = campaignData?.groups || campaignData?.Groups || campaignData?.CampaignGroups || campaignData?.data?.groups;
      if (Array.isArray(campaignGroups) && campaignGroups.length > (Array.isArray(groupsData) ? groupsData.length : 0)) {
        console.log(`[Server] Using ${campaignGroups.length} groups from campaignData (more complete than ${Array.isArray(groupsData) ? groupsData.length : 0})`);
        groupsData = campaignGroups;
      }

      if (!campaignData && (!groupsData || (Array.isArray(groupsData) && groupsData.length === 0))) {
        console.warn(`[Server] No data found for mosad ${mosad} after all attempts.`);
        return res.status(404).json({ 
          success: false, 
          error: `לא נמצאו נתונים עבור מוסד ${mosad}. וודא שקוד המוסד תקין והקמפיין פעיל בנדרים פלוס.`,
          mosad 
        });
      }

      console.log(`[Server] Returning data for mosad ${mosad}: ${Array.isArray(groupsData) ? groupsData.length : 0} groups found.`);
      
      // Calculate total from groups as a fallback if it's higher than the campaign reported total
      const calculatedTotal = (groupsData || []).reduce((acc: number, g: any) => acc + (cleanNumber(g.TotalAmount) || 0), 0);
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

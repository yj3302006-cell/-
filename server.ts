import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.get("/api/campaign/:mosad", async (req, res) => {
    const { mosad } = req.params;
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://www.matara.pro/nedarimplus/online/?mosad=${mosad}`
      };

      // Try 1: GetCampaignData.aspx
      let campaignData: any = null;
      try {
        const apiRes = await axios.get(`https://www.matara.pro/nedarimplus/online/GetCampaignData.aspx?mosad=${mosad}`, { headers });
        if (apiRes.data && typeof apiRes.data === 'object') {
          campaignData = apiRes.data;
        }
      } catch (e) {}

      // Try 2: SearchGroups.aspx (often used for the list of fundraisers)
      let groupsData: any = null;
      try {
        const groupsRes = await axios.post(`https://www.matara.pro/nedarimplus/online/SearchGroups.aspx`, 
          `mosad=${mosad}&search=`, 
          { 
            headers: { 
              ...headers, 
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' 
            } 
          }
        );
        console.log("SearchGroups response type:", typeof groupsRes.data);
        if (groupsRes.data && Array.isArray(groupsRes.data)) {
          groupsData = groupsRes.data;
        } else if (typeof groupsRes.data === 'string') {
           const match = groupsRes.data.match(/\[.*\]/);
           if (match) {
             try {
               groupsData = JSON.parse(match[0]);
             } catch (e) {
               console.error("Failed to parse groups JSON match");
             }
           }
        }
      } catch (e: any) {
        console.error("SearchGroups failed:", e.message);
      }

      // Try 2.5: GetGroups.aspx
      if (!groupsData) {
        try {
          const gRes = await axios.get(`https://www.matara.pro/nedarimplus/online/GetGroups.aspx?mosad=${mosad}`, { headers });
          if (Array.isArray(gRes.data)) groupsData = gRes.data;
          else if (typeof gRes.data === 'string') {
             const match = gRes.data.match(/\[.*\]/);
             if (match) groupsData = JSON.parse(match[0]);
          }
        } catch (e) {}
      }

      // Try 3: If still no data, scrape the main page for embedded JSON
      if (!campaignData || !groupsData) {
        const mainPage = await axios.get(`https://www.matara.pro/nedarimplus/online/?mosad=${mosad}`, { headers });
        const $ = cheerio.load(mainPage.data);
        
        if (!campaignData) {
          campaignData = { CampaignName: $('title').text() || 'קמפיין נדרים פלוס' };
        }

        $('script').each((i, el) => {
          const content = $(el).html() || '';
          if (!campaignData) {
            const cMatch = content.match(/CampaignData\s*=\s*({.*?});/s);
            if (cMatch) try { campaignData = JSON.parse(cMatch[1]); } catch(e) {}
          }
          if (!groupsData) {
            const gMatch = content.match(/GroupsData\s*=\s*(\[.*?\]);/s);
            if (gMatch) try { groupsData = JSON.parse(gMatch[1]); } catch(e) {}
          }
        });
      }

      res.json({ success: true, campaign: campaignData, groups: groupsData });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

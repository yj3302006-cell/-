import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { Upload, LogIn, ShieldCheck, AlertCircle, Loader2, Trash2, FileSpreadsheet, Sparkles, Gift, RefreshCw, TrendingUp, Check, X, Plus, Users, Target, Bot, Home, Box } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const ADMIN_EMAIL = "g0548533206@gmail.com";

export default function Admin() {
  console.log("Admin component rendering...");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordAuthenticated, setIsPasswordAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [rewards, setRewards] = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [campaignData, setCampaignData] = useState<any>(null);
  const [fundraisers, setFundraisers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"fundraisers" | "claims" | "rules" | "settings" | "admins">("fundraisers");
  const isFetching = useRef(false);
  const [showDebug, setShowDebug] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
    danger?: boolean;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [mosadId, setMosadId] = useState("7011088");
  const [manualGoal, setManualGoal] = useState<number | "">("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [manualIdInput, setManualIdInput] = useState("");
  const [addingManualId, setAddingManualId] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ loading: boolean; data: any; error: string | null }>({ loading: false, data: null, error: null });
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  
  // Reward form state
  const [rewardName, setRewardName] = useState("");
  const [rewardAmountThreshold, setRewardAmountThreshold] = useState(""); // Threshold amount
  const [rewardPrice, setRewardPrice] = useState("");   // Value in NIS
  const [rewardCode, setRewardCode] = useState("");     // Identifier
  const [addingReward, setAddingReward] = useState(false);

  // Discount form state
  const [discountBaseGoal, setDiscountBaseGoal] = useState("");
  const [discountMinPercentage, setDiscountMinPercentage] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [addingDiscount, setAddingDiscount] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('campee_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
    
    const savedAuth = sessionStorage.getItem("admin_auth");
    if (savedAuth === "true") {
      setIsPasswordAuthenticated(true);
      fetchData();
    }
    
    // Loading timeout
    const timer = setTimeout(() => {
      setLoading(false);
    }, 5000);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleManualIdAdd = async () => {
    if (!manualIdInput.trim()) return;
    if (!validateFiveDigitId(manualIdInput.trim())) {
      setToast({ message: "קוד זיהוי חייב להיות מספר בן 5 ספרות בדיוק", type: "error" });
      return;
    }
    setAddingManualId(true);
    try {
      const res = await fetch(`/api/campaign/${mosadId}?forceId=${manualIdInput.trim()}`);
      const result = await res.json();
      if (result.success && result.groups && result.groups.length > 0) {
        // Find the specific group we added or use the first one
        const newGroups = result.groups.filter((g: any) => 
          String(g.ID || g.GroupId || g.Code || g.GroupCode || g.MatrimId) === manualIdInput.trim()
        );
        const groupsToSave = newGroups.length > 0 ? newGroups : [result.groups[0]];
        
        // Save to Firestore
        await saveFundraisers(groupsToSave);
        setToast({ message: `המזהה ${manualIdInput} נוסף וסונכרן בהצלחה!`, type: "success" });
        setManualIdInput("");
        fetchData();
      } else {
        setToast({ message: result.error || "לא נמצאו נתונים עבור מזהה זה. וודא שהקוד תקין.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "שגיאת תקשורת עם השרת", type: "error" });
    } finally {
      setAddingManualId(false);
    }
  };

  const handlePasswordLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPasswordError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput })
      });
      const result = await res.json();
      if (result.success) {
        console.log("Admin: Password login successful.");
        setIsPasswordAuthenticated(true);
        sessionStorage.setItem("admin_auth", "true");
        fetchData().catch(err => console.error("Initial fetchData failed", err));
      } else {
        setPasswordError(result.error || "סיסמה שגויה");
      }
    } catch (err) {
      setPasswordError("שגיאת תקשורת עם השרת");
    }
  };

  const displayFundraisers = useMemo(() => {
    const apiGroups = campaignData?.groups || [];
    const merged = [...apiGroups];
    fundraisers.forEach(f => {
      if (!merged.find(g => (g.ID || g.GroupId || g.Code || g.GroupCode) === f.ID)) {
        merged.push(f);
      }
    });
    return merged.sort((a, b) => (b.TotalAmount || b.Amount || 0) - (a.TotalAmount || a.Amount || 0));
  }, [campaignData, fundraisers]);

  const fetchData = async () => {
    if (isMockMode) {
      setRewards([
        { id: "mock1", name: "צ'ופר דוגמה (מצב הדמיה)", minAmount: 1000, price: 50, code: "12345" }
      ]);
      setBonuses([
        { id: "mock-b1", name: "בונוס דוגמה (מצב הדמיה)", minPercentage: 10, minGoal: 50000 }
      ]);
      setFundraisers([]);
      setAdmins([]);
      setLoading(false);
      isFetching.current = false;
      return;
    }

    if (isFetching.current) return;
    isFetching.current = true;
    console.log("Admin: Fetching data started...");
    
    const fetchSegment = async (name: string, promise: Promise<any>) => {
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout fetching ${name}`)), 8000)
      );
      try {
        const result = await Promise.race([promise, timeout]);
        console.log(`Admin: segment "${name}" loaded.`);
        return result;
      } catch (e: any) {
        let msg = `Admin: segment "${name}" failed: ${e.message}`;
        if (e.code === 'unavailable') {
          msg += " (כשל בחיבור למסד הנתונים - ייתכן וחסום ברשת)";
        } else if (e.code === 'permission-denied') {
          msg += " (אין הרשאות לגישה לנתונים)";
        }
        console.warn(msg);
        return null;
      }
    };

    try {
      // Parallel fetch for non-dependent data
      fetchSegment("rewards", fetch("/api/db/rewards").then(res => res.json())).then(data => {
        if (data && Array.isArray(data)) setRewards(data);
      });

      fetchSegment("bonuses", fetch("/api/db/goalBonuses").then(res => res.json())).then(data => {
        if (data && Array.isArray(data)) setBonuses(data);
      });

      fetchSegment("claims", fetch("/api/db/claims").then(res => res.json())).then(data => {
        if (data && Array.isArray(data)) {
          const cData = data.map((item: any) => {
            let dateStr = "טרם";
            if (item.updatedAt) {
              // Handle both standard date strings and Firebase seconds objects for backward compatibility
              const dateVal = item.updatedAt._seconds ? new Date(item.updatedAt._seconds * 1000) : new Date(item.updatedAt);
              dateStr = isNaN(dateVal.getTime()) ? "טרם" : dateVal.toLocaleString();
            }
            return { ...item, date: dateStr };
          });
          setClaims(cData.sort((a: any, b: any) => {
            const timeA = a.updatedAt?._seconds ? a.updatedAt._seconds * 1000 : new Date(a.updatedAt || 0).getTime();
            const timeB = b.updatedAt?._seconds ? b.updatedAt._seconds * 1000 : new Date(b.updatedAt || 0).getTime();
            return timeB - timeA;
          }));
        }
      });

      fetchSegment("fundraisers", fetch("/api/db/fundraisers").then(res => res.json())).then(data => {
        if (data && Array.isArray(data)) setFundraisers(data);
      });

      fetchSegment("users", fetch("/api/admin/users").then(res => res.json())).then(data => {
        if (data && Array.isArray(data)) setAdmins(data);
      });

      // Settings fetch
      fetchSegment("settings", fetch("/api/db/settings").then(res => res.json())).then((data: any) => {
        if (data && Array.isArray(data)) {
          const global = data.find(it => it.id === "global");
          if (global) {
            setMosadId(global.mosadId);
            if (global.manualGoal !== undefined) setManualGoal(global.manualGoal);
            
            // Campaign data fetch
            if (global.mosadId?.trim()) {
              const apiTimeout = new AbortController();
              const tId = setTimeout(() => apiTimeout.abort(), 12000);
              fetch(`/api/campaign/${global.mosadId.trim()}`, { signal: apiTimeout.signal })
                .then(res => res.ok ? res.json() : null)
                .then(result => {
                  if (result?.success) setCampaignData(result);
                })
                .catch(() => console.warn("Campaign API fetch failed"))
                .finally(() => clearTimeout(tId));
            }
          }
        }
      });
    } catch (err) {
      console.error("Admin: Global fetch error:", err);
    } finally {
      isFetching.current = false;
    }
  };

  const validateFiveDigitId = (id: string) => {
    return /^\d{5}$/.test(id);
  };

  const testNedarimConnection = async () => {
    if (!mosadId) {
      setConfirmModal({
        title: "שגיאה",
        message: "נא להזין קוד מוסד תחילה.",
        onConfirm: () => setConfirmModal(null)
      });
      return;
    }
    
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/campaign/${mosadId.trim()}?refresh=true`);
      const data = await res.json();
      
      if (data.success) {
        setCampaignData(data); // Update the UI list state
        
        // Automatically sync to Firestore
        if (data.groups && data.groups.length > 0) {
          await saveFundraisers(data.groups);
          await fetchData();
        }

        setConfirmModal({
          title: "סנכרון הושלם!",
          message: `החיבור לנדרים פלוס תקין. נמצא קמפיין: ${data.campaign?.CampaignName || "ללא שם"}. נמצאו ${data.groups?.length || 0} מתרימים והם סונכרנו למערכת.`,
          onConfirm: () => setConfirmModal(null)
        });
      } else {
        setConfirmModal({
          title: "חיבור נכשל",
          message: data.error || "לא נמצאו נתונים עבור קוד מוסד זה.",
          danger: true,
          onConfirm: () => setConfirmModal(null)
        });
      }
    } catch (err) {
      setConfirmModal({
        title: "שגיאת תקשורת",
        message: "אירעה שגיאה בחיבור לשרת.",
        danger: true,
        onConfirm: () => setConfirmModal(null)
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await fetch("/api/db/settings/global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mosadId,
          manualGoal: manualGoal === "" ? null : Number(manualGoal)
        })
      });
      setToast({ message: "הגדרות נשמרו בהצלחה!", type: "success" });
      fetchData();
    } catch (error) {
      console.error("Save settings failed", error);
      setToast({ message: "שגיאה בשמירת ההגדרות", type: "error" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetClaims = async () => {
    setConfirmModal({
      title: "איפוס בקשות צ'ופרים",
      message: "האם אתה בטוח שברצונך למחוק את כל בקשות הצ'ופרים? פעולה זו אינה ניתנת לביטול.",
      danger: true,
      onConfirm: async () => {
        try {
          await fetch("/api/db/claims?clear=true", { method: "POST", body: "[]" });
          setClaims([]);
          setToast({ message: "כל הבקשות נמחקו בהצלחה.", type: "success" });
        } catch (e: any) {
          setToast({ message: "שגיאה במחיקת הבקשות", type: "error" });
        }
      }
    });
  };

  const handleResetBonuses = async () => {
    setConfirmModal({
      title: "איפוס הנחות יעד",
      message: "האם אתה בטוח שברצונך למחוק את כל הנחות היעד?",
      danger: true,
      onConfirm: async () => {
        try {
          await fetch("/api/db/goalBonuses?clear=true", { method: "POST", body: "[]" });
          setBonuses([]);
          setToast({ message: "כל ההנחות נמחקו בהצלחה.", type: "success" });
        } catch (err) {
          setToast({ message: "שגיאה במחיקה", type: "error" });
        }
      }
    });
  };

  const handleAddDiscount = async () => {
    if (!discountBaseGoal || !discountMinPercentage || !discountAmount) {
      setToast({ message: "אנא מלא את כל השדות להוספת הנחת יעד", type: "error" });
      return;
    }
    
    setAddingDiscount(true);
    try {
      await fetch("/api/db/goalBonuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minGoal: Number(discountBaseGoal),
          minPercentage: Number(discountMinPercentage),
          description: discountAmount,
          name: `הנחת יעד ${discountMinPercentage}% (מעל סכום ${discountBaseGoal})`
        })
      });
      
      setDiscountBaseGoal("");
      setDiscountMinPercentage("");
      setDiscountAmount("");
      fetchData();
      setToast({ message: "ההנחה נוספה בהצלחה!", type: "success" });
    } catch (err: any) {
      console.error("Admin: Add discount error:", err);
      setToast({ message: "שגיאה: " + (err.message || "פעולה נכשלה"), type: "error" });
    } finally {
      setAddingDiscount(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !newAdminPassword.trim()) return;
    setAddingAdmin(true);
    try {
      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: newAdminEmail.toLowerCase(), 
          password: newAdminPassword.trim() 
        })
      });
      
      setNewAdminEmail("");
      setNewAdminPassword("");
      setToast({ message: "משתמש נוסף בהצלחה!", type: "success" });
      fetchData();
    } catch (error) {
      console.error("Add user failed", error);
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleUpdateClaimStatus = async (claimId: string, newStatus: string) => {
    try {
      await fetch(`/api/db/claims/${claimId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      await fetchData();
    } catch (error) {
      console.error("Update claim failed", error);
    }
  };

  const handleTogglePaid = async (claimId: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/db/claims/${claimId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: !currentStatus })
      });
      await fetchData();
      setToast({ message: `סטטוס תשלום עודכן ל-${!currentStatus ? 'שולם' : 'לא שולם'}`, type: "success" });
    } catch (error) {
      console.error("Toggle paid failed", error);
      setToast({ message: "שגיאה בעדכון סטטוס תשלום", type: "error" });
    }
  };

  const exportClaimsToExcel = () => {
    const exportData = claims.map(c => ({
      "שם מתרים": c.fundraiserName,
      "קוד מתרים": c.fundraiserId,
      "שם צ'ופר": c.rewardName,
      "קוד צ'ופר": c.rewardCode || "",
      "סוג": c.type === 'reward' ? 'סכום' : 'יעד %',
      "תאריך": c.date,
      "סטטוס": c.status === 'pending' ? 'ממתין' : 'קיבל',
      "שולם?": c.isPaid ? 'כן' : 'לא',
      "שולם במזומן": c.paidInCash ? 'כן' : 'לא',
      "סכום לתשלום": c.amountToPay || 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "מימושי צ'ופרים");
    XLSX.writeFile(wb, `מימושי_צופרים_${new Date().toLocaleDateString()}.xlsx`);
  };

  const handleLogout = () => {
    localStorage.removeItem('campee_user');
    sessionStorage.removeItem("admin_auth");
    window.location.href = "/";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      // Check if it's percentage bonuses or absolute rewards or fundraisers
      const isPercentage = data.some((item: any) => item.minPercentage || item.MinPercentage);
      const isFundraisers = data.some((item: any) => item.GroupName || item.GroupNameHe || item.ID);
      
      if (isPercentage) {
        await saveBonuses(data);
      } else if (isFundraisers) {
        await saveFundraisers(data);
      } else {
        await saveRewards(data);
      }
    };
    reader.readAsBinaryString(file);
  };

  const saveFundraisers = async (data: any[]) => {
    setUploading(true);
    try {
      const items = data.map(item => {
        const id = String(item.ID || item.id || item.code || item.Code || item.GroupId || item.MatrimId || "");
        return {
          id,
          ID: id,
          GroupName: item.GroupName || item.GroupNameHe || item.name || item.Name || item.GroupTitle || item.MatrimName || "ללא שם",
          TotalAmount: Number(item.TotalAmount || item.Amount || item.Sum || item.TotalSum || 0),
          Goal: Number(item.Goal || item.Target || item.MainGoal || 0),
          Percentage: Number(item.Percentage || 0) || (Number(item.Goal || item.Target || item.MainGoal || 0) > 0 ? (Number(item.TotalAmount || item.Amount || item.Sum || item.TotalSum || 0) / Number(item.Goal || item.Target || item.MainGoal || 0)) * 100 : 0)
        };
      }).filter(it => it.id);

      await fetch("/api/db/fundraisers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items)
      });

      await fetchData();
      setToast({ message: "רשימת המתרימים עודכנה בהצלחה!", type: "success" });
    } catch (error) {
      console.error("Fundraiser save failed", error);
      setToast({ message: "שגיאה בשמירת המתרימים", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const saveBonuses = async (data: any[]) => {
    setUploading(true);
    try {
      const items = data.map(item => ({
        name: item.name || item.Name || item.title || item.Title || "הנחה/צ'ופר יעד",
        minPercentage: Number(item.minPercentage || item.MinPercentage || item.percentage || item.Percentage || 0),
        minGoal: Number(item.minGoal || item.MinGoal || item.baseGoal || item.BaseGoal || item.Goal || 0),
        description: item.description || item.Description || item.text || item.Text || ""
      }));

      await fetch("/api/db/goalBonuses?clear=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items)
      });

      await fetchData();
      setToast({ message: "הנחות היעד הועלו בהצלחה!", type: "success" });
    } catch (error) {
      console.error("Bonus upload failed", error);
    } finally {
      setUploading(false);
    }
  };

  const saveRewards = async (data: any[]) => {
    setUploading(true);
    try {
      const items = data.map(item => {
        const keys = Object.keys(item);
        const threshold = Number(item.minAmount || item.Goal || item.Amount || item.threshold || item.Threshold || item[keys[0]] || 0);
        const codeValue = String(item.code || item.id || item.Code || item.ID || item.identifier || item[keys[1]] || "").trim();
        const priceValue = Number(item.price || item.Price || item.Value || item.cost || item[keys[2]] || 0);
        const nameText = item.name || item.Name || item.title || item.Title || `צ'ופר ${codeValue || threshold}`;
        return {
          name: nameText,
          minAmount: threshold,
          code: codeValue,
          price: priceValue,
          description: item.description || item.Description || ""
        };
      });

      await fetch("/api/db/rewards?clear=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items)
      });

      await fetchData();
      setToast({ message: "הצ'ופרים הועלו בהצלחה!", type: "success" });
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setUploading(false);
    }
  };

  const handleAddRewardManual = async () => {
    if (!rewardName || !rewardAmountThreshold || !rewardPrice) {
      setToast({ message: "אנא מלא את כל השדות החובה (שם, סכום יעד, שווי)", type: "error" });
      return;
    }

    const code = rewardCode.trim();
    if (!code || !validateFiveDigitId(code)) {
      setToast({ message: "חובה להזין קוד זיהוי בן 5 ספרות בדיוק", type: "error" });
      return;
    }

    setAddingReward(true);
    try {
      const res = await fetch("/api/db/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rewardName,
          minAmount: Number(rewardAmountThreshold),
          price: Number(rewardPrice),
          code: code,
          description: ""
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "לא ניתן היה לשמור את הצ'ופר.");
      }

      setRewardName("");
      setRewardAmountThreshold("");
      setRewardPrice("");
      setRewardCode("");
      fetchData();
      setToast({ message: "הצ'ופר נוסף בהצלחה!", type: "success" });
    } catch (err: any) {
      console.error("Admin: Add reward error:", err);
      setToast({ message: "שגיאה: " + (err.message || "פעולה נכשלה"), type: "error" });
    } finally {
      setAddingReward(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <Loader2 className="w-10 h-10 animate-spin text-[#5A5A40]" />
      </div>
    );
  }

  if (!isPasswordAuthenticated) {
    console.log("Admin: Not authenticated, showing login form");
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] p-4" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[32px] shadow-xl max-w-md w-full text-center border border-[#141414]/5"
        >
          <div className="flex justify-end mb-4">
             <button onClick={() => window.location.reload()} className="p-2 text-[#141414]/20 hover:text-[#5A5A40] transition-colors">
                <RefreshCw className="w-4 h-4" />
             </button>
          </div>
          <ShieldCheck className="w-16 h-16 text-[#5A5A40] mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">כניסת מנהל</h1>
          <p className="text-[#141414]/60 mb-8">אנא הזן סיסמה או התחבר עם גוגל</p>
          
          <form onSubmit={handlePasswordLogin} className="space-y-4 mb-6">
            <input 
              type="password" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="סיסמת מנהל"
              className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 text-center text-lg focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none"
            />
            {passwordError && <p className="text-red-500 text-sm font-bold">{passwordError}</p>}
            <button 
              type="submit"
              className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold hover:bg-[#4A4A30] transition-all"
            >
              התחבר עם סיסמה
            </button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#141414]/10"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-[#141414]/40">או</span></div>
          </div>

          <Link 
            to="/"
            className="w-full border-2 border-[#5A5A40] text-[#5A5A40] py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-[#5A5A40]/5 transition-all text-center"
          >
            <LogIn className="w-5 h-5" />
            חזרה להתחברות הראשית
          </Link>
          
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-2">בעיות בטעינה? נסה לפתוח בלשונית חדשה:</p>
            <button 
              onClick={() => window.open(window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'tab=new', '_blank')}
              className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles size={14} /> פתח בלשונית חדשה
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans" dir="rtl">
      <header className="bg-white border-b border-[#141414]/10 p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-[#5A5A40] w-8 h-8" />
            <h1 className="text-xl font-bold">פאנל ניהול צ'ופרים</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              to="/"
              className="flex items-center gap-2 bg-[#F5F5F0] text-[#5A5A40] px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#E5E5E0] transition-all"
            >
              <Home className="w-4 h-4" />
              חזרה לאתר
            </Link>
            <button 
              onClick={testNedarimConnection}
              className="flex items-center gap-2 bg-[#5A5A40] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#4A4A30] transition-all"
            >
              <TrendingUp className="w-4 h-4" />
              סנכרן נדרים פלוס
            </button>
            <span className="text-sm text-[#141414]/60">{user?.email || "מנהל (סיסמה)"}</span>
            <button onClick={handleLogout} className="text-xs font-bold uppercase tracking-widest hover:text-red-500 transition-colors">התנתק</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 space-y-8">
        <div className="w-full space-y-8">
          <div className="space-y-8">
            <div className="bg-white p-4 rounded-2xl border border-[#141414]/5 flex gap-2">
              <button 
                onClick={() => setActiveTab("fundraisers")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "fundraisers" ? "bg-[#5A5A40] text-white" : "hover:bg-[#F5F5F0]"}`}
              >
                מתרימים
              </button>
                <button 
                  onClick={() => setActiveTab("claims")}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "claims" ? "bg-[#5A5A40] text-white" : "hover:bg-[#F5F5F0]"}`}
                >
                  מימושי צ'ופרים
                </button>
                <button 
                  onClick={() => setActiveTab("rules")}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "rules" ? "bg-[#5A5A40] text-white" : "hover:bg-[#F5F5F0]"}`}
                >
                  חוקי מחשבון
                </button>
                <button 
                  onClick={() => setActiveTab("settings")}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "settings" ? "bg-[#5A5A40] text-white" : "hover:bg-[#F5F5F0]"}`}
                >
                  הגדרות
                </button>
                <button 
                  onClick={() => setActiveTab("admins")}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "admins" ? "bg-[#5A5A40] text-white" : "hover:bg-[#F5F5F0]"}`}
                >
                  מנהלים
                </button>
              </div>

              {activeTab === "fundraisers" && (
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      <Bot className="w-6 h-6 text-[#5A5A40]" />
                      חשבונות קמפיין (מתרימים)
                      {campaignData?.groups?.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">מחובר לנדרים פלוס ({campaignData.groups.length} מתרימים)</span>
                        </div>
                      )}
                    </h2>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                              <div className="relative">
                                <input 
                                  type="text"
                                  placeholder="הוסף מזהה ידנית..."
                                  className="text-xs border border-[#141414]/10 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[#5A5A40]"
                                  value={manualIdInput}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                                    setManualIdInput(val);
                                  }}
                                  onKeyDown={(e) => e.key === 'Enter' && handleManualIdAdd()}
                                />
                                {manualIdInput.length > 0 && manualIdInput.length < 5 && (
                                  <span className="absolute -bottom-4 right-0 text-[8px] text-orange-500 font-bold">5 ספרות נדרשות</span>
                                )}
                              </div>
                        <button 
                          onClick={handleManualIdAdd}
                          disabled={addingManualId}
                          className="bg-[#F5F5F0] text-[#5A5A40] text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-[#E5E5E0] disabled:opacity-50 flex items-center gap-1"
                        >
                          {addingManualId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          הוסף מזהה
                        </button>
                      </div>
                    </div>
                    {fundraisers.length > 0 && (
                      <button 
                        onClick={() => {
                          setConfirmModal({
                            title: "ניקוי נתונים ידניים",
                            message: "האם אתה בטוח שברצונך למחוק את כל נתוני המתרימים שהועלו ידנית? פעולה זו לא תמחק נתונים מנדרים פלוס.",
                            danger: true,
                            onConfirm: async () => {
                              try {
                                await fetch("/api/db/fundraisers?clear=true", { method: "POST", body: "[]" });
                                setFundraisers([]);
                                setToast({ message: "הנתונים הידניים נמחקו.", type: "success" });
                              } catch (e) {
                                setToast({ message: "שגיאה במחיקה", type: "error" });
                              }
                            }
                          });
                        }}
                        className="text-xs text-red-500 font-bold hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        נקה נתונים ידניים
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    {displayFundraisers.length > 0 ? (
                      <table className="w-full text-right">
                        <thead>
                          <tr className="border-b border-[#141414]/5 text-xs text-[#141414]/40 uppercase tracking-widest">
                            <th className="pb-4 font-bold">קוד</th>
                            <th className="pb-4 font-bold">שם</th>
                            <th className="pb-4 font-bold">נאסף</th>
                            <th className="pb-4 font-bold">יעד</th>
                            <th className="pb-4 font-bold">ביצוע</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {displayFundraisers.map((g: any, i: number) => (
                            <tr key={i} className="border-b border-[#141414]/5 last:border-0">
                              <td className="py-4 font-mono text-xs text-[#141414]/40">#{g.ID || g.GroupId || g.Code || g.GroupCode || "N/A"}</td>
                              <td className="py-4 font-bold">{g.GroupName || g.Name || "ללא שם"}</td>
                              <td className="py-4">₪{(g.TotalAmount || g.Amount || 0).toLocaleString()}</td>
                              <td className="py-4">₪{(g.Goal || 0).toLocaleString()}</td>
                              <td className="py-4">
                                <div className="flex flex-col gap-1">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className={`text-[10px] font-bold ${(g.Percentage || 0) >= 100 ? "text-green-600" : "text-blue-600"}`}>
                                      {Math.round(g.Percentage || 0)}%
                                    </span>
                                  </div>
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full transition-all duration-500 ${(g.Percentage || 0) >= 100 ? "bg-green-500" : "bg-blue-500"}`} 
                                      style={{ width: `${Math.min(100, g.Percentage || 0)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="py-20 text-center">
                        <div className="bg-[#F5F5F0] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Users className="w-8 h-8 text-[#141414]/20" />
                        </div>
                        <p className="text-[#141414]/40 font-bold">לא נמצאו מתרימים.</p>
                        <p className="text-[10px] text-[#141414]/20 mt-1">לחץ על "סנכרן נדרים פלוס" כדי למשוך נתונים.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "claims" && (
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      <Gift className="w-6 h-6 text-[#5A5A40]" />
                      מימושי צ'ופרים
                    </h2>
                    <div className="flex gap-4">
                      <button 
                        onClick={exportClaimsToExcel}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700 transition-all"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        הורדה לאקסל
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right">
                      <thead>
                        <tr className="border-b border-[#141414]/5 text-xs text-[#141414]/40 uppercase tracking-widest">
                          <th className="pb-4 font-bold">מתרים</th>
                          <th className="pb-4 font-bold">צ'ופר</th>
                          <th className="pb-4 font-bold">תאריך</th>
                          <th className="pb-4 font-bold">שולם?</th>
                          <th className="pb-4 font-bold">סטטוס</th>
                          <th className="pb-4 font-bold">פעולות</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {claims.map((claim) => (
                          <tr key={claim.id} className="border-b border-[#141414]/5 last:border-0">
                            <td className="py-4">
                              <div className="font-bold">{claim.fundraiserName || "ללא שם"}</div>
                              <div className="text-[10px] text-[#141414]/40 font-mono">#{claim.fundraiserId || "N/A"}</div>
                            </td>
                            <td className="py-4">
                              <div className="font-bold">{claim.rewardName || "ללא שם"}</div>
                              <div className={`text-[10px] font-bold ${claim.type === 'reward' ? 'text-green-600' : 'text-purple-600'}`}>
                                {claim.type === 'reward' ? 'סכום' : 'יעד %'}
                              </div>
                            </td>
                            <td className="py-4 text-[#141414]/60">{claim.date || "טרם"}</td>
                            <td className="py-4">
                              {claim.isPaid ? (
                                <button 
                                  onClick={() => handleTogglePaid(claim.id, true)}
                                  className="flex flex-col items-center gap-1 group"
                                >
                                  {claim.paidInCash ? (
                                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">₪{(claim.amountToPay || 0).toLocaleString()}</span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">פטור</span>
                                  )}
                                  <span className="text-[9px] text-green-600 font-bold group-hover:text-red-500 transition-colors">שולם ✓</span>
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleTogglePaid(claim.id, false)}
                                  className="flex flex-col items-center gap-1 group"
                                >
                                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">₪{(claim.amountToPay || 0).toLocaleString()}</span>
                                  <span className="text-[9px] text-red-400 font-bold group-hover:text-red-600">לא שולם</span>
                                </button>
                              )}
                            </td>
                            <td className="py-4">
                              {claim.status === 'completed' ? (
                                <button 
                                  onClick={() => handleUpdateClaimStatus(claim.id, 'pending')}
                                  className="px-2 py-1 rounded-lg font-bold text-xs bg-green-100 text-green-700 hover:bg-green-200 transition-colors cursor-pointer"
                                  title="לחץ כדי להחזיר לממתין"
                                >
                                  קיבל
                                </button>
                              ) : (
                                <span className="px-2 py-1 rounded-lg font-bold text-xs bg-yellow-100 text-yellow-700">
                                  ממתין
                                </span>
                              )}
                            </td>
                            <td className="py-4">
                              <div className="flex gap-2">
                                {claim.status !== 'completed' && (
                                  <button 
                                    onClick={() => handleUpdateClaimStatus(claim.id, 'completed')}
                                    className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                    title="סמן כקיבל"
                                  >
                                    <ShieldCheck className="w-4 h-4" />
                                  </button>
                                )}
                                <button 
                                  onClick={() => setConfirmModal({
                                    title: "מחיקת בקשה",
                                    message: `האם אתה בטוח שברצונך למחוק את הבקשה של ${claim.fundraiserName}?`,
                                    danger: true,
                                    onConfirm: () => fetch(`/api/db/claims/${claim.id}`, { method: "DELETE" }).then(fetchData)
                                  })}
                                  className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                  title="מחק בקשה"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "rules" && (
                <div className="space-y-8">
                  {/* Manual Reward Entry Table */}
                  <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold flex items-center gap-3">
                        <Gift className="w-6 h-6 text-[#5A5A40]" />
                        הוספת צ'ופר ידנית
                      </h2>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all cursor-pointer shadow-lg shadow-blue-600/10">
                          <Upload className="w-4 h-4" />
                          העלאת אקסל צ'ופרים
                          <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                            onChange={handleFileUpload}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="text-[10px] text-[#141414]/40 uppercase font-bold tracking-widest border-b border-[#141414]/5">
                            <th className="pb-4 pr-2 w-1/4">שם הצ'ופר</th>
                            <th className="pb-4 pr-2 w-1/4">משבצת 1: סכום יעד (להגעה)</th>
                            <th className="pb-4 pr-2 w-1/4">משבצת 3: שווי / מחיר (₪)</th>
                            <th className="pb-4 pr-2 w-1/6">משבצת 2: קוד זיהוי</th>
                            <th className="pb-4">פעולה</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="group">
                            <td className="py-6 pr-2">
                              <input 
                                type="text" 
                                value={rewardName}
                                onChange={(e) => setRewardName(e.target.value)}
                                className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none text-sm"
                                placeholder='למשל: נגן MP3'
                              />
                            </td>
                            <td className="py-6 pr-2">
                              <input 
                                type="number" 
                                value={rewardAmountThreshold}
                                onChange={(e) => setRewardAmountThreshold(e.target.value)}
                                className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none text-sm"
                                placeholder="2500"
                              />
                            </td>
                            <td className="py-6 pr-2">
                              <input 
                                type="number" 
                                value={rewardPrice}
                                onChange={(e) => setRewardPrice(e.target.value)}
                                className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none text-sm"
                                placeholder="200"
                              />
                            </td>
                            <td className="py-6 pr-2">
                              <input 
                                type="text" 
                                value={rewardCode}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                                  setRewardCode(val);
                                }}
                                className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none text-sm font-mono"
                                placeholder="קוד בן 5 ספרות"
                              />
                            </td>
                            <td className="py-6">
                              <button 
                                onClick={handleAddRewardManual}
                                disabled={addingReward}
                                className="w-full bg-[#5A5A40] text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all disabled:opacity-50 shadow-lg shadow-[#5A5A40]/10"
                              >
                                {addingReward ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                הוסף
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Horizontal Discount Entry "Table" */}
                  <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-[#5A5A40]" />
                        הוספת הנחת יעד מהירה
                      </h2>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-700 transition-all cursor-pointer shadow-lg shadow-purple-600/10">
                          <Upload className="w-4 h-4" />
                          העלאת אקסל הנחות
                          <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                            onChange={handleFileUpload}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="text-[10px] text-[#141414]/40 uppercase font-bold tracking-widest border-b border-[#141414]/5">
                            <th className="pb-4 pr-2">משבצת 1: יעד (סכום)</th>
                            <th className="pb-4 pr-2">משבצת 2: הגיע ל (%)</th>
                            <th className="pb-4 pr-2">משבצת 3: סכום הנחה</th>
                            <th className="pb-4">פעולה</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="group">
                            <td className="py-6 pr-2">
                              <input 
                                type="number" 
                                value={discountBaseGoal}
                                onChange={(e) => setDiscountBaseGoal(e.target.value)}
                                className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none text-sm"
                                placeholder="למשל: 2500"
                              />
                            </td>
                            <td className="py-6 pr-2">
                              <div className="relative">
                                <input 
                                  type="number" 
                                  value={discountMinPercentage}
                                  onChange={(e) => setDiscountMinPercentage(e.target.value)}
                                  className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none text-sm"
                                  placeholder="100"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#141414]/20 font-bold">%</span>
                              </div>
                            </td>
                            <td className="py-6 pr-2">
                              <input 
                                type="text" 
                                value={discountAmount}
                                onChange={(e) => setDiscountAmount(e.target.value)}
                                className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none text-sm"
                                placeholder="₪500 הנחה"
                              />
                            </td>
                            <td className="py-6">
                              <button 
                                onClick={handleAddDiscount}
                                disabled={addingDiscount}
                                className="w-full bg-[#5A5A40] text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all disabled:opacity-50 shadow-lg shadow-[#5A5A40]/10"
                              >
                                {addingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                הוסף
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                    <h2 className="text-xl font-bold mb-6">ניהול צ'ופרי סכום</h2>
                    <div className="space-y-4">
                      {rewards.map((reward) => (
                        <div key={reward.id} className="p-4 bg-[#F5F5F0] rounded-2xl flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm">{reward.name || "ללא שם"}</h3>
                              <span className="text-[10px] text-[#141414]/30 font-mono">#{reward.id?.slice(-4).toUpperCase() || "????"}</span>
                            </div>
                            <p className="text-xs text-[#141414]/40">יעד: ₪{(reward.minAmount || 0).toLocaleString()} | מחיר: ₪{reward.price?.toLocaleString() || 0}</p>
                          </div>
                          <button 
                            onClick={() => setConfirmModal({
                              title: "מחיקת צ'ופר",
                              message: `האם אתה בטוח שברצונך למחוק את הצ'ופר ${reward.name}?`,
                              danger: true,
                              onConfirm: () => fetch(`/api/db/rewards/${reward.id}`, { method: "DELETE" }).then(fetchData)
                            })}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                    <h2 className="text-xl font-bold mb-6">ניהול הנחות יעד</h2>
                    <div className="space-y-4">
                      {bonuses.map((bonus) => (
                        <div key={bonus.id} className="p-4 bg-[#F5F5F0] rounded-2xl flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm">{bonus.name || "ללא שם"}</h3>
                              <span className="text-[10px] text-[#141414]/30 font-mono">#{bonus.id?.slice(-4).toUpperCase() || "????"}</span>
                            </div>
                            <p className="text-xs text-[#141414]/40">{bonus.minPercentage || 0}% יעד</p>
                          </div>
                          <button 
                            onClick={() => setConfirmModal({
                              title: "מחיקת הנחת יעד",
                              message: `האם אתה בטוח שברצונך למחוק את הנחת היעד ${bonus.name}?`,
                              danger: true,
                              onConfirm: () => fetch(`/api/db/goalBonuses/${bonus.id}`, { method: "DELETE" }).then(fetchData)
                            })}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              )}

              {activeTab === "settings" && (
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <RefreshCw className="w-6 h-6 text-[#5A5A40]" />
                    הגדרות קמפיין
                  </h2>
                  <div className="space-y-6 max-w-md">
                    <div>
                      <label className="block text-sm font-bold mb-2">קוד מוסד (Mosad ID)</label>
                      <div className="flex gap-2 mb-2">
                        <input 
                          type="text" 
                          value={mosadId}
                          onChange={(e) => setMosadId(e.target.value)}
                          className="flex-1 bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none"
                          placeholder="למשל: 7011088"
                        />
                        <button 
                          onClick={testNedarimConnection}
                          className="px-6 bg-[#F5F5F0] text-[#5A5A40] rounded-2xl font-bold hover:bg-[#E5E5E0] transition-all"
                        >
                          בדיקה
                        </button>
                      </div>
                      <p className="text-[10px] text-[#141414]/40 mt-2">זהו הקוד שמושך את הנתונים האוטומטיים מהקמפיין.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">יעד ידני (Manual Goal)</label>
                      <input 
                        type="number" 
                        value={manualGoal}
                        onChange={(e) => setManualGoal(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none"
                        placeholder="השאר ריק לשימוש ביעד מנדרים פלוס"
                      />
                      <p className="text-[10px] text-[#141414]/40 mt-2">אם יוזן ערך, הוא ידרוס את היעד שמגיע מנדרים פלוס.</p>
                    </div>
                    <button 
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {savingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                      שמור הגדרות
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "admins" && (
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-[#6366F1]" />
                    ניהול משתמשים
                  </h2>
                  
                  <form onSubmit={handleAddAdmin} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <input 
                      type="email" 
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="כתובת אימייל"
                      className="bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#6366F1]/20 transition-all outline-none"
                      required
                    />
                    <input 
                      type="text" 
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="קוד אישי / סיסמה"
                      className="bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#6366F1]/20 transition-all outline-none"
                      required
                    />
                    <button 
                      type="submit"
                      disabled={addingAdmin}
                      className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white px-8 py-4 rounded-2xl font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50"
                    >
                      {addingAdmin ? "מוסיף..." : "הוסף משתמש"}
                    </button>
                  </form>

                  <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 text-indigo-700 rounded-2xl text-sm font-bold flex items-center gap-2 border border-indigo-100">
                      <ShieldCheck className="w-4 h-4" />
                      מנהל מערכת ראשי: yj3302006@gmail.com
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="border-b border-[#141414]/5 text-xs text-[#141414]/40 uppercase tracking-widest">
                            <th className="pb-4 font-bold">אימייל</th>
                            <th className="pb-4 font-bold">קוד אישי</th>
                            <th className="pb-4 font-bold text-left">פעולות</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {admins.map((admin) => (
                            <tr key={admin.email} className="border-b border-[#141414]/5 last:border-0 hover:bg-[#F5F5F0]/30 transition-colors">
                              <td className="py-4 font-bold text-[#2D3E50]">{admin.email}</td>
                              <td className="py-4 font-mono text-[#6366F1]">{admin.password}</td>
                              <td className="py-4 text-left">
                                {admin.email !== "yj3302006@gmail.com" && (
                                  <button 
                                    onClick={() => setConfirmModal({
                                      title: "הסרת משתמש",
                                      message: `האם אתה בטוח שברצונך להסיר את המשתמש ${admin.email}?`,
                                      danger: true,
                                      onConfirm: () => fetch(`/api/admin/users/${admin.email}`, { method: "DELETE" }).then(fetchData)
                                    })}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
        </div>
      </div>
    </main>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConnectionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white p-8 rounded-[32px] shadow-2xl max-w-2xl w-full border border-[#141414]/5 overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                  סטטוס חיבור לנדרים פלוס
                </h3>
                <button onClick={() => setShowConnectionModal(false)} className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors">
                  <RefreshCw className="w-5 h-5 rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2">
                {connectionStatus.loading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                    <p className="font-bold text-blue-600">בודק חיבור מול השרתים...</p>
                  </div>
                ) : connectionStatus.error ? (
                  <div className="p-6 bg-red-50 border border-red-100 rounded-2xl text-red-700">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertCircle className="w-6 h-6" />
                      <h4 className="font-bold">החיבור נכשל</h4>
                    </div>
                    <p className="text-sm">{connectionStatus.error}</p>
                    <div className="mt-4 p-4 bg-white/50 rounded-xl text-xs font-mono">
                      טיפ: וודא שקוד המוסד ({mosadId}) תקין ושהקמפיין פעיל בנדרים פלוס.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="p-6 bg-green-50 border border-green-100 rounded-2xl text-green-700">
                      <div className="flex items-center gap-3 mb-2">
                        <ShieldCheck className="w-6 h-6" />
                        <h4 className="font-bold">החיבור תקין!</h4>
                      </div>
                      <p className="text-sm">הנתונים נמשכו בהצלחה מנדרים פלוס.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-[#F5F5F0] rounded-2xl">
                        <p className="text-[10px] text-[#141414]/40 uppercase font-bold mb-1">שם קמפיין</p>
                        <p className="font-bold">{connectionStatus.data?.campaign?.CampaignName}</p>
                      </div>
                      <div className="p-4 bg-[#F5F5F0] rounded-2xl">
                        <p className="text-[10px] text-[#141414]/40 uppercase font-bold mb-1">מספר קבוצות</p>
                        <p className="font-bold">{connectionStatus.data?.groups?.length || 0}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-[#F5F5F0] rounded-2xl">
                      <p className="text-[10px] text-[#141414]/40 uppercase font-bold mb-2">נתונים גולמיים (JSON)</p>
                      <pre className="text-[10px] font-mono bg-white/50 p-4 rounded-xl overflow-x-auto max-h-40">
                        {JSON.stringify(connectionStatus.data, null, 2)}
                      </pre>
                    </div>

                    <button 
                      onClick={async () => {
                        if (!connectionStatus.data?.groups) return;
                        setConnectionStatus(prev => ({ ...prev, loading: true }));
                        try {
                          await saveFundraisers(connectionStatus.data.groups);
                          setToast({ message: "הנתונים סונכרנו בהצלחה!", type: "success" });
                          setShowConnectionModal(false);
                        } catch (err) {
                          setConnectionStatus(prev => ({ ...prev, loading: false, error: "סנכרון נכשל" }));
                        }
                      }}
                      className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
                    >
                      <RefreshCw className="w-5 h-5" />
                      סנכרן נתונים למערכת
                    </button>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setShowConnectionModal(false)}
                className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold mt-6 hover:bg-[#4A4A30] transition-all"
              >
                סגור
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${confirmModal.danger ? 'bg-red-50 text-red-600' : 'bg-[#5A5A40]/10 text-[#5A5A40]'}`}>
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">{confirmModal.title}</h3>
              <p className="text-[#141414]/60 mb-8">{confirmModal.message}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-4 rounded-2xl font-bold bg-[#F5F5F0] hover:bg-[#E4E3E0] transition-all"
                >
                  ביטול
                </button>
                <button 
                  onClick={async () => {
                    await confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className={`flex-1 py-4 rounded-2xl font-bold text-white transition-all ${confirmModal.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#5A5A40] hover:bg-[#4A4A30]'}`}
                >
                  אישור
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 border ${
              toast.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'
            }`}
          >
            {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-bold">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-50">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debug Section Toggle */}
      <div className="fixed bottom-4 right-4 z-50">
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="p-2 bg-slate-800 text-white rounded-full opacity-20 hover:opacity-100 transition-opacity"
          title="Debug Mode"
        >
          <Bot size={16} />
        </button>
      </div>

      {showDebug && (
        <div className="fixed bottom-16 right-4 w-80 bg-white shadow-2xl rounded-xl border border-slate-200 p-4 z-50 text-xs font-mono max-h-96 overflow-auto" dir="rtl">
          <div className="flex justify-between items-center mb-2 border-b pb-2">
            <span className="font-bold">Debugger</span>
            <button onClick={() => setShowDebug(false)}><X size={14}/></button>
          </div>
          <div className="space-y-1">
            <p className="text-blue-500 font-bold">מצב גישה: {user ? (user.isAnonymous ? "אנונימי" : user.email) : "ציבורי (סיסמה)"}</p>
            <p>UID: {user?.uid || "אין (חיבור ציבורי)"}</p>
            {authError && <p className="text-orange-500 bg-orange-50 p-1 rounded">הערת חיבור: {authError}</p>}
            <p>קוד מוסד: {mosadId}</p>
            <p>צ'ופרים: {rewards.length}</p>
            <p>בונוסים: {bonuses.length}</p>
            <hr className="my-2" />
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => {
                  setIsMockMode(!isMockMode);
                  setToast({ message: `מצב הדמיה ${!isMockMode ? "פעיל" : "מכובה"}`, type: "success" });
                  if (!isMockMode) {
                    setLoading(false);
                  } else {
                    fetchData();
                  }
                }}
                className={`px-2 py-1 rounded ${isMockMode ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-700 hover:bg-orange-200"}`}
              >
                מצב הדמיה (ללא DB)
              </button>
              <button 
                onClick={async () => {
                   setToast({ message: "יוצר נתוני דוגמה...", type: "success" });
                   try {
                     const res = await fetch("/api/db/rewards", {
                       method: "POST",
                       headers: { "Content-Type": "application/json" },
                       body: JSON.stringify({
                         name: "צ'ופר דוגמה",
                         minAmount: 1000,
                         price: 50,
                         code: "12345",
                         description: "נוסף אוטומטית לבדיקה"
                       })
                     });
                     if (!res.ok) throw new Error("API failed");
                     await fetchData();
                     setToast({ message: "נתוני דוגמה נוצרו!", type: "success" });
                   } catch (e: any) {
                     setToast({ message: "כשל: " + e.message, type: "error" });
                   }
                }}
                className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
              >
                יצירת נתוני דוגמה
              </button>
              <button 
                onClick={async () => {
                  setToast({ message: "מנסה לבדוק כתיבה דרך השרת...", type: "success" });
                  try {
                    const res = await fetch("/api/db/test_writes", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ test: true, userAgent: navigator.userAgent })
                    });
                    if (!res.ok) throw new Error("API failed");
                    setToast({ message: "כתיבת שרת הצליחה!", type: "success" });
                  } catch (e: any) {
                    setToast({ message: "כשל בכתיבה: " + e.message, type: "error" });
                  }
                }}
                className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
              >
                בדיקת כתיבה
              </button>
               <button 
                onClick={async () => {
                   setToast({ message: "בודק חיבור שרת ל-DB...", type: "success" });
                   try {
                     const res = await fetch("/api/health");
                     if (!res.ok) throw new Error("API failed");
                     const health = await res.json();
                     setToast({ message: `סטטוס שרת: ${health.status}, DB: ${health.db}`, type: health.db.startsWith("Connected") ? "success" : "error" });
                   } catch (e: any) {
                     setToast({ message: "כשל בחיבור שרת: " + e.message, type: "error" });
                   }
                }}
                className="px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              >
                בדוק חיבור DB
              </button>
              <button 
                onClick={() => {
                  fetchData();
                  setToast({ message: "סנכרון נתונים החל...", type: "success" });
                }}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
              >
                <RefreshCw size={12} /> רענן נתונים
              </button>
              <button 
                onClick={() => {
                  sessionStorage.removeItem("admin_auth");
                  window.location.reload();
                }}
                className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                התנתק (סיסמה)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

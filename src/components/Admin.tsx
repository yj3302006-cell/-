import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import Fuse from "fuse.js";
import { Upload, LogIn, Settings, AlertCircle, Loader2, Trash2, FileSpreadsheet, Sparkles, Gift, RefreshCw, TrendingUp, Check, X, Plus, Users, Target, Bot, Home, Box, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CampaignData, GroupData, RewardData, BonusData, SupplierData, ClaimData } from "../types";

const ADMIN_NAME = "יצחק";

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordAuthenticated, setIsPasswordAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [rewards, setRewards] = useState<RewardData[]>([]);
  const [bonuses, setBonuses] = useState<BonusData[]>([]);
  const [claims, setClaims] = useState<ClaimData[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierData[]>([]);
  const [campaignData, setCampaignData] = useState<CampaignData | null>(null);
  const [fundraisers, setFundraisers] = useState<GroupData[]>([]);
  const [activeTab, setActiveTab] = useState<"fundraisers" | "claims" | "rules" | "settings" | "admins" | "suppliers" | "github">("fundraisers");
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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [mosadId, setMosadId] = useState("7011088");
  const [manualGoal, setManualGoal] = useState<number | "">("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [cashPayPercentage, setCashPayPercentage] = useState<number>(10);
  const [cashCalculationMode, setCashCalculationMode] = useState<'percentage' | 'absolute'>('absolute');
  const [forgotPasswordText, setForgotPasswordText] = useState("נא לפנות למנהל המערכת לקבלת סיסמה חדשה.");
  const [showForgotPasswordMessage, setShowForgotPasswordMessage] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<"user" | "admin" | "super_admin">("user");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [manualIdInput, setManualIdInput] = useState("");
  const [addingManualId, setAddingManualId] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ loading: boolean; data: any; error: string | null }>({ loading: false, data: null, error: null });
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  // Change password state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Reset system state
  const [resetVerifyCode, setResetVerifyCode] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Search state
  const [searchTermClaims, setSearchTermClaims] = useState("");
  
  // Reward form state
  const [rewardName, setRewardName] = useState("");
  const [rewardAmountThreshold, setRewardAmountThreshold] = useState<string | number>(""); // Threshold amount
  const [rewardPrice, setRewardPrice] = useState<string | number>("");   // Value in NIS
  const [rewardCode, setRewardCode] = useState("");     // Identifier
  const [rewardSupplierId, setRewardSupplierId] = useState(""); // Supplier ID
  
  // GitHub Integration state
  const [githubUrl, setGithubUrl] = useState("");
  const [githubCollection, setGithubCollection] = useState<"fundraisers" | "rewards" | "goalBonuses">("rewards");
  const [isGitHubSyncing, setIsGitHubSyncing] = useState(false);

  const [rewardInDisplay, setRewardInDisplay] = useState(false); // Existing in display
  const [addingReward, setAddingReward] = useState(false);

  // Supplier form state
  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [addingSupplier, setAddingSupplier] = useState(false);

  // Discount form state
  const [discountBaseGoal, setDiscountBaseGoal] = useState("");
  const [discountMinPercentage, setDiscountMinPercentage] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [addingDiscount, setAddingDiscount] = useState(false);

  useEffect(() => {
    // ALWAYS fetch basic settings first for forgot password etc
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/db/settings");
        const data = await res.json();
        if (data && Array.isArray(data)) {
          const global = data.find((it: any) => it.id === "global");
          if (global && global.forgotPasswordText) {
            setForgotPasswordText(global.forgotPasswordText);
          }
        }
      } catch (err) {
        console.warn("Initial settings fetch failed", err);
      }
    };
    fetchSettings();

    const savedUser = localStorage.getItem('campee_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      // Auto authenticate if user is admin or super_admin
      if (parsedUser.role === 'admin' || parsedUser.role === 'super_admin') {
        setIsPasswordAuthenticated(true);
      }
    }
    setLoading(false);
    
    const savedAuth = sessionStorage.getItem("admin_auth");
    if (savedAuth === "true") {
      setIsPasswordAuthenticated(true);
    }
    
    if (!savedAuth && user && user.role === 'user') {
      window.location.href = "/";
      return;
    }

    // fetchData is called only if authenticated for full data access
    if (savedAuth === "true" || (savedUser && (JSON.parse(savedUser).role === 'admin' || JSON.parse(savedUser).role === 'super_admin'))) {
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

  const handleToggleAdminRole = async (username: string, currentRole: string) => {
    const userToToggle = admins.find(a => a.username === username);
    if (!userToToggle) return;
    
    // Cycle roles: user -> admin -> super_admin -> user
    let newRole: string;
    if (currentRole === 'user') newRole = 'admin';
    else if (currentRole === 'admin') newRole = 'super_admin';
    else newRole = 'user';

    try {
      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: username, 
          password: userToToggle.password,
          role: newRole,
          requester: user?.username
        })
      });
      fetchData();
      const roleNames: Record<string, string> = { 'user': 'משתמש', 'admin': 'מנהל', 'super_admin': 'מנהל ראשי' };
      setToast({ message: `תפקיד המשתמש עודכן ל-${roleNames[newRole]}`, type: "success" });
    } catch (error) {
      console.error("Toggle admin role failed", error);
    }
  };

  const handleGitHubSync = async () => {
    if (!githubUrl.trim()) {
      setToast({ message: "נא להזין כתובת URL מגיטהב (Raw JSON)", type: "error" });
      return;
    }
    
    setIsGitHubSyncing(true);
    try {
      const res = await fetch("/api/admin/import-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: githubUrl.trim(),
          collection: githubCollection,
          requester: user?.username || ADMIN_NAME
        })
      });
      
      const result = await res.json();
      if (result.success) {
        setToast({ message: `סנכרון מגיטהב הושלם! יובאו ${result.count} פריטים למאגר ${githubCollection}`, type: "success" });
        setGithubUrl("");
        fetchData();
      } else {
        setToast({ message: result.error || "סנכרון נכשל", type: "error" });
      }
    } catch (err) {
      setToast({ message: "שגיאת תקשורת עם השרת", type: "error" });
    } finally {
      setIsGitHubSyncing(false);
    }
  };

  const handleManualIdAdd = async () => {
    if (!manualIdInput.trim()) return;
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
        setIsPasswordAuthenticated(true);
        sessionStorage.setItem("admin_auth", "true");
        // Set default admin user if not already logged in
        let updatedUser = user;
        if (!user) {
          updatedUser = { username: ADMIN_NAME, role: 'super_admin' };
          setUser(updatedUser);
          localStorage.setItem('campee_user', JSON.stringify(updatedUser));
        }
        fetchData(updatedUser).catch(err => console.error("Initial fetchData failed", err));
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

  const filteredClaims = useMemo(() => {
    if (!searchTermClaims.trim()) return claims;
    const fuse = new Fuse(claims, {
      keys: ["fundraiserName", "fundraiserId", "rewardName", "rewardCode"],
      threshold: 0.35,
      distance: 100
    });
    return fuse.search(searchTermClaims).map(r => r.item);
  }, [claims, searchTermClaims]);

  const fetchData = async (overrideUser?: any) => {
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

      fetchSegment("suppliers", fetch("/api/db/suppliers").then(res => res.json())).then(data => {
        if (data && Array.isArray(data)) setSuppliers(data);
      });

      fetchSegment("bonuses", fetch("/api/db/goalBonuses").then(res => res.json())).then(data => {
        if (data && Array.isArray(data)) setBonuses(data);
      });

      fetchSegment("claims", fetch("/api/db/claims").then(res => res.json())).then(data => {
        if (data && Array.isArray(data)) {
          const cData = data.map((item: any) => {
            let dateStr = "טרם";
            // Use updatedAt from the item (either from JSON or database column)
            const rawDate = item.updatedAt;
            
            if (rawDate) {
              let dateVal: Date;
              if (rawDate._seconds) {
                dateVal = new Date(rawDate._seconds * 1000);
              } else if (typeof rawDate === 'string') {
                // Handle SQLite format "YYYY-MM-DD HH:MM:SS" by replacing space with T to make it ISO-like
                const isoDate = rawDate.includes(' ') ? rawDate.replace(' ', 'T') + 'Z' : rawDate;
                dateVal = new Date(isoDate);
              } else {
                dateVal = new Date(rawDate);
              }
              
              if (!isNaN(dateVal.getTime())) {
                dateStr = dateVal.toLocaleString('he-IL', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                });
              }
            }
            return { ...item, date: dateStr };
          });
          setClaims(cData.sort((a: any, b: any) => {
            const timeA = new Date(a.updatedAt?.includes?.(' ') ? a.updatedAt.replace(' ', 'T') + 'Z' : (a.updatedAt || 0)).getTime();
            const timeB = new Date(b.updatedAt?.includes?.(' ') ? b.updatedAt.replace(' ', 'T') + 'Z' : (b.updatedAt || 0)).getTime();
            return timeB - timeA;
          }));
        }
      });

      fetchSegment("fundraisers", fetch("/api/db/fundraisers").then(res => res.json())).then(data => {
        if (data && Array.isArray(data)) setFundraisers(data);
      });

      const rName = (overrideUser || user)?.username || (localStorage.getItem('campee_user') ? JSON.parse(localStorage.getItem('campee_user')!).username : "");
      fetchSegment("users", fetch(`/api/admin/users?requester=${encodeURIComponent(rName || ADMIN_NAME)}`).then(res => res.json())).then(data => {
        if (data && Array.isArray(data)) setAdmins(data);
      });

      // Settings fetch
      fetchSegment("settings", fetch("/api/db/settings").then(res => res.json())).then((data: any) => {
        if (data && Array.isArray(data)) {
          const global = data.find(it => it.id === "global");
          if (global) {
            setMosadId(global.mosadId);
            if (global.manualGoal !== undefined) setManualGoal(global.manualGoal);
            if (global.cashPayPercentage !== undefined) setCashPayPercentage(global.cashPayPercentage);
            if (global.cashCalculationMode !== undefined) setCashCalculationMode(global.cashCalculationMode);
            if (global.forgotPasswordText !== undefined) setForgotPasswordText(global.forgotPasswordText);
            
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
    return id.length > 0;
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
          manualGoal: manualGoal === "" ? null : Number(manualGoal),
          cashPayPercentage,
          cashCalculationMode,
          forgotPasswordText
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
      const discountValue = parseInt(discountAmount.replace(/\D/g, '')) || 0;
      
      await fetch("/api/db/goalBonuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minGoal: Number(discountBaseGoal),
          minPercentage: Number(discountMinPercentage),
          description: discountAmount,
          name: `הנחת יעד ${discountMinPercentage}% (מעל סכום ${discountBaseGoal})`,
          discountValue: discountValue
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

  const handleAddSupplier = async () => {
    if (!supplierName.trim() || !supplierEmail.trim()) {
      setToast({ message: "שם וכתובת מייל חובה להוספת ספק", type: "error" });
      return;
    }
    
    setAddingSupplier(true);
    try {
      await fetch("/api/db/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: supplierName.trim(),
          email: supplierEmail.trim()
        })
      });
      
      setSupplierName("");
      setSupplierEmail("");
      fetchData();
      setToast({ message: "הספק נוסף בהצלחה!", type: "success" });
    } catch (err: any) {
      console.error("Admin: Add supplier error:", err);
      setToast({ message: "שגיאה בהוספת ספק", type: "error" });
    } finally {
      setAddingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    setConfirmModal({
      title: "מחיקת ספק",
      message: "האם אתה בטוח שברצונך למחוק ספק זה?",
      danger: true,
      onConfirm: async () => {
        try {
          await fetch(`/api/db/suppliers/${id}`, { method: "DELETE" });
          fetchData();
          setToast({ message: "הספק נמחק בהצלחה", type: "success" });
        } catch (e) {
          setToast({ message: "שגיאה במחיקת הספק", type: "error" });
        }
      }
    });
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUsername.trim() || !newAdminPassword.trim()) return;
    setAddingAdmin(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: newAdminUsername.trim(), 
          password: newAdminPassword.trim(),
          role: newAdminRole,
          requester: user?.username || ADMIN_NAME
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        setToast({ message: err.error || "הוספת משתמש נכשלה", type: "error" });
        return;
      }

      setNewAdminUsername("");
      setNewAdminPassword("");
      setNewAdminRole("user");
      setToast({ message: "משתמש נוסף בהצלחה!", type: "success" });
      fetchData();
    } catch (error: any) {
      console.error("Add user failed", error);
      setToast({ message: "שגיאה בתקשורת עם השרת: " + error.message, type: "error" });
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleUpdateClaimStatus = async (claimId: string, newStatus: string) => {
    try {
      await fetch(`/api/db/claims/${claimId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: newStatus,
          updatedBy: user?.username || "מנהל"
        })
      });
      await fetchData();
    } catch (error) {
      console.error("Update claim failed", error);
    }
  };

  const handleUpdateRewardSupplier = async (rewardId: string, supplierId: string) => {
    try {
      await fetch(`/api/db/rewards/${rewardId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          supplierId
        })
      });
      await fetchData();
      setToast({ message: "ספק עודכן בהצלחה", type: "success" });
    } catch (error) {
      console.error("Update reward supplier failed", error);
      setToast({ message: "שגיאה בעדכון ספק", type: "error" });
    }
  };

  const handleToggleRewardDisplay = async (rewardId: string, currentInDisplay: boolean) => {
    try {
      await fetch(`/api/db/rewards/${rewardId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          inDisplay: !currentInDisplay
        })
      });
      await fetchData();
      setToast({ message: "סטטוס תצוגה עודכן בהצלחה", type: "success" });
    } catch (error) {
      console.error("Toggle reward display failed", error);
      setToast({ message: "שגיאה בעדכון סטטוס תצוגה", type: "error" });
    }
  };

  const handleTogglePaid = async (claimId: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/db/claims/${claimId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          isPaid: !currentStatus,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.username || "מנהל"
        })
      });
      await fetchData();
      setToast({ message: `סטטוס תשלום עודכן ל-${!currentStatus ? 'שולם' : 'לא שולם'}`, type: "success" });
    } catch (error) {
      console.error("Toggle paid failed", error);
      setToast({ message: "שגיאה בעדכון סטטוס תשלום", type: "error" });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setToast({ message: "הסיסמאות החדשות לא תואמות", type: "error" });
      return;
    }
    
    setChangingPassword(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          oldPassword,
          newPassword
        })
      });
      const result = await res.json();
      if (result.success) {
        setToast({ message: "הסיסמה שונתה בהצלחה!", type: "success" });
        setOldPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        setToast({ message: result.error || "שינוי סיסמה נכשל", type: "error" });
      }
    } catch (err) {
      setToast({ message: "שגיאת תקשורת עם השרת", type: "error" });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleResetSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetting(true);
    try {
      const res = await fetch("/api/admin/reset-system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          password: resetVerifyCode
        })
      });
      const result = await res.json();
      if (result.success) {
        setToast({ message: "התרחשה מחיקה מלאה של הנתונים בהצלחה", type: "success" });
        setShowResetModal(false);
        setResetVerifyCode("");
        fetchData();
      } else {
        setToast({ message: result.error || "אימות נכשל", type: "error" });
      }
    } catch (err) {
      setToast({ message: "שגיאת תקשורת עם השרת", type: "error" });
    } finally {
      setResetting(false);
    }
  };

  const downloadRewardsTemplate = () => {
    try {
      const sampleSupplier = suppliers.length > 0 ? suppliers[0].name : "ספק כללי";
      const data = [
        { "שם": "אוזניות", "יעד": 2500, "מחיר": 200, "קוד": "12345", "ספק": sampleSupplier },
        { "שם": "רחפן", "יעד": 5000, "מחיר": 450, "קוד": "67890", "ספק": sampleSupplier }
      ];
      const ws = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'template_rewards.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download template failed", error);
      setToast({ message: "שגיאה ביצירת התבנית", type: "error" });
    }
  };

  const downloadFundraisersTemplate = () => {
    try {
      const data = [
        { "קוד": "101", "שם": "מתרים א", "סכום": 500, "יעד": 1000 },
        { "קוד": "102", "שם": "מתרים ב", "סכום": 1500, "יעד": 2000 }
      ];
      const ws = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'template_fundraisers.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download template failed", error);
      setToast({ message: "שגיאה ביצירת התבנית", type: "error" });
    }
  };

  const downloadBonusesTemplate = () => {
    try {
      const data = [
        { "שם": "בונוס אחוזים", "אחוז": 10, "תיאור": "10% הנחה על כל הצ'ופרים" },
        { "שם": "בונוס סכום", "אחוז": 0, "סכום": 1000, "הנחה": 50, "תיאור": "הנחה של 50 ש\"ח בהגעה ל-1000 ש\"ח" }
      ];
      const ws = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'template_bonuses.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download template failed", error);
      setToast({ message: "שגיאה ביצירת התבנית", type: "error" });
    }
  };

  const handleExportSupplier = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    // Find ALL rewards for this supplier
    const supplierRewards = rewards.filter(r => r.supplierId === supplierId);
    const rewardIds = supplierRewards.map(r => r.id);
    const rewardCodes = supplierRewards.map(r => r.code);
    const rewardNames = supplierRewards.map(r => r.name);
    
    // Filter claims for THESE rewards
    const supplierClaims = claims.filter(c => 
      (c.rewardId && rewardIds.includes(c.rewardId)) ||
      (c.rewardCode && rewardCodes.includes(c.rewardCode)) || 
      (!c.rewardCode && rewardNames.includes(c.rewardName))
    );

    if (supplierClaims.length === 0) {
      setToast({ message: "אין הזמנות לספק זה לייצוא", type: "error" });
      return;
    }

    // Aggregate by all supplier rewards to include -1 for unsold display items
    const finalExportData = supplierRewards.map(reward => {
      // Match claims strictly by ID or exact code/name
      const rewardClaims = claims.filter(c => {
        if (c.rewardId && reward.id) return c.rewardId === reward.id;
        
        const rCode = reward.code?.toString().trim();
        const cCode = c.rewardCode?.toString().trim();
        if (rCode && cCode) return rCode === cCode;
        
        return c.rewardName === reward.name;
      });
      
      const count = rewardClaims.length;
      const adjustedCount = reward.inDisplay ? count - 1 : count;
      
      return {
        "שם מוצר": reward.name,
        "כמות": adjustedCount
      };
    }).filter(row => row["כמות"] !== 0);

    if (finalExportData.length === 0) {
      setToast({ message: "אין הזמנות חדשות לספק זה (כל הפריטים מאוזנים)", type: "info" });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(finalExportData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = supplier.name.replace(/[^a-zA-Z0-9א-ת]/g, '_');
    const dateStr = new Date().toLocaleDateString('he-IL').replace(/\//g, '-');
    link.download = `הזמנות_${safeName}_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toLocaleDateString('he-IL').replace(/\//g, '-');
    link.download = `מימושים_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    localStorage.removeItem('campee_user');
    sessionStorage.removeItem("admin_auth");
    window.location.href = "/";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, preferredType?: 'fundraisers' | 'rewards' | 'bonuses') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setToast({ message: "מעבד קובץ...", type: "info" });

    try {
      // Use modern File.arrayBuffer() if available, otherwise fallback to FileReader
      let dataBuffer: ArrayBuffer;
      if (typeof file.arrayBuffer === 'function') {
        dataBuffer = await file.arrayBuffer();
      } else {
        dataBuffer = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });
      }

      if (!dataBuffer) throw new Error("לא ניתן לקרוא את תוכן הקובץ");
      
      // Auto-detect type. Recent sheetjs handles ArrayBuffer directly.
      const wb = XLSX.read(dataBuffer, { 
        type: "array",
        cellDates: true, 
        cellNF: false, 
        cellText: false 
      });
      
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
      
      if (!Array.isArray(data) || data.length === 0) {
        setToast({ message: "הקובץ ריק או שאינו בפורמט תקין (וודא שיש כותרות בשורה הראשונה)", type: "error" });
        return;
      }

      const firstRow = data[0] as any;
      const allKeysString = Object.keys(firstRow).join(" ").toLowerCase();
      
      console.log("Detected keys:", allKeysString);
      console.log("Preferred type:", preferredType);

      // Priority 1: Use preferredType if it matches the data reasonably well or if user is explicit
      if (preferredType === 'fundraisers') {
        await saveFundraisers(data);
        return;
      } else if (preferredType === 'bonuses') {
        await saveBonuses(data);
        return;
      } else if (preferredType === 'rewards') {
        await saveRewards(data);
        return;
      }

      // Fallback: Detection logic if no preferredType
      // Priority 1: Fundraisers (check for 'amount' and some identifier)
      const isFundraisers = (/מתרים|קבוצה|GroupName|fundraiser|user/i.test(allKeysString)) && 
                            /סכום|יעד|amount|sum|target/i.test(allKeysString) &&
                            !(/price|reward|צ'ופר|שווי/i.test(allKeysString));

      // Priority 2: Bonuses (check for percentage keyword)
      const isPercentage = /אחוז|הנחה|percentage|discount/i.test(allKeysString);

      // Priority 3: Rewards (individual codes/prices)
      const isRewards = /price|reward|code|מחיר|שווי|קוד|צ'ופר/i.test(allKeysString);

      if (isFundraisers) {
        console.log("Detected: Fundraisers");
        await saveFundraisers(data);
      } else if (isPercentage) {
        console.log("Detected: Bonuses/Percentages");
        await saveBonuses(data);
      } else if (isRewards) {
        console.log("Detected: Rewards");
        await saveRewards(data);
      } else {
        // Final attempt at detection
        if (/מתרים|קבוצה|שם/i.test(allKeysString) && /סכום/i.test(allKeysString)) {
           await saveFundraisers(data);
        } else {
           setToast({ message: "לא הצלחנו לזהות את סוג הקובץ. וודא שהכותרות תואמות לתבנית.", type: "error" });
        }
      }
    } catch (err) {
      console.error("File processing error:", err);
      let errorMsg = "שגיאה בעיבוד הקובץ";
      if (err instanceof Error) {
        if (err.message.includes("Namespace") || err.message.includes("Corrupted") || err.message.includes("Zip")) {
          errorMsg = "סיומת הקובץ אינה תואמת לתוכן או שהקובץ פגום. נסה לשמור את הקובץ מחדש כ-xlsx או כ-csv (מומלץ).";
        } else {
          errorMsg = `שגיאה: ${err.message}`;
        }
      }
      setToast({ message: errorMsg, type: "error" });
    } finally {
      e.target.value = "";
    }
  };

  const saveFundraisers = async (data: any[]) => {
    setUploading(true);
    try {
      const items = data.map(item => {
        const keys = Object.keys(item);
        const id = String(
          item.ID || item.id || item.code || item.Code || item.GroupId || item.MatrimId || 
          item["מזהה"] || item["קוד"] || item["מספר"] || 
          item[keys[0]] || ""
        );
        return {
          id,
          ID: id,
          GroupName: item.GroupName || item.GroupNameHe || item.name || item.Name || item.GroupTitle || item.MatrimName || item["שם"] || item["שם קבוצה"] || item["מתרים"] || "ללא שם",
          TotalAmount: Number(item.TotalAmount || item.Amount || item.Sum || item.TotalSum || item["סכום"] || item["סה\"כ"] || 0),
          Goal: Number(item.Goal || item.Target || item.MainGoal || item["יעד"] || item["מטרה"] || 0),
          Percentage: Number(item.Percentage || item["אחוז"] || 0) || (Number(item.Goal || item.Target || item.MainGoal || item["יעד"] || 0) > 0 ? (Number(item.TotalAmount || item.Amount || item["סכום"] || 0) / Number(item.Goal || item.Target || item["יעד"] || 0)) * 100 : 0)
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
      const items = data.map(item => {
        const keys = Object.keys(item);
        const minPercentage = Number(item.minPercentage || item.MinPercentage || item.percentage || item.Percentage || item["אחוז"] || item["אחוז יעד"] || 0);
        const minGoal = Number(item.minGoal || item.MinGoal || item.baseGoal || item.BaseGoal || item.Goal || item["יעד"] || item["סכום"] || 0);
        const name = item.name || item.Name || item.title || item.Title || item["שם"] || `בונוס ${minPercentage}%`;
        const description = item.description || item.Description || item.text || item.Text || item["תיאור"] || "";
        const discountValue = Number(item.discountValue || item.discount || item.Discount || item["סכום הנחה"] || item["הנחה"] || 0);
        
        return {
          name,
          minPercentage,
          minGoal,
          description,
          discountValue
        };
      });

      await fetch("/api/db/goalBonuses?clear=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items)
      });

      await fetchData();
      setToast({ message: "הנחות היעד הועלו בהצלחה!", type: "success" });
    } catch (error) {
      console.error("Bonus upload failed", error);
      setToast({ message: "שגיאה בהעלאת הנחות היעד", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const saveRewards = async (data: any[]) => {
    setUploading(true);
    let missingSuppliers: string[] = [];

    try {
      const items = data.map(item => {
        const keys = Object.keys(item);
        const threshold = Number(
          item.minAmount || item.Goal || item.Amount || item.threshold || item.Threshold || 
          item["יעד"] || item["סכום יעד"] || item["מינימום"] ||
          item[keys[0]] || 0
        );
        const codeValue = String(
          item.code || item.id || item.Code || item.ID || item.identifier || 
          item["קוד"] || item["קוד צ'ופר"] || item["מזהה"] ||
          item[keys[1]] || ""
        ).trim();
        const priceValue = Number(
          item.price || item.Price || item.Value || item.cost || 
          item["מחיר"] || item["שווי"] || item["עלות"] ||
          item[keys[2]] || 0
        );
        const nameText = item.name || item.Name || item.title || item.Title || item["שם"] || item["שם הצ'ופר"] || `צ'ופר ${codeValue || threshold}`;
        const description = item.description || item.Description || item["תיאור"] || "";
        const inDisplay = !!(item.inDisplay || item["בתצוגה"] || item["תצוגה"]);
        
        // Find supplier
        const supplierNameFromFile = item.supplier || item.Supplier || item["ספק"] || "";
        let foundSupplierId = "";
        if (supplierNameFromFile) {
          const supplier = suppliers.find(s => 
            s.id === supplierNameFromFile || 
            s.name.toLowerCase().trim() === String(supplierNameFromFile).toLowerCase().trim()
          );
          if (supplier) {
            foundSupplierId = supplier.id;
          } else {
            if (!missingSuppliers.includes(supplierNameFromFile)) {
              missingSuppliers.push(supplierNameFromFile);
            }
          }
        }

        return {
          name: nameText,
          minAmount: threshold,
          code: codeValue,
          price: priceValue,
          description: description,
          inDisplay: inDisplay,
          supplierId: foundSupplierId
        };
      });

      await fetch("/api/db/rewards?clear=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items)
      });

      await fetchData();
      
      if (missingSuppliers.length > 0) {
        setToast({ 
          message: `הצ'ופרים הועלו, אך הספקים הבאים לא זוהו במערכת: ${missingSuppliers.join(", ")}`, 
          type: "error" 
        });
      } else {
        setToast({ message: "הצ'ופרים הועלו בהצלחה!", type: "success" });
      }
    } catch (error) {
      console.error("Upload failed", error);
      setToast({ message: "שגיאה בהעלאת הצ'ופרים", type: "error" });
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
    if (!code) {
      setToast({ message: "חובה להזין קוד זיהוי", type: "error" });
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
          supplierId: rewardSupplierId,
          inDisplay: rewardInDisplay,
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
      setRewardSupplierId("");
      setRewardInDisplay(false);
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
          <Gift className="w-16 h-16 text-[#5A5A40] mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">ניהול צ'ופרקל</h1>
          <p className="text-[#141414]/60 mb-8">אנא הזן סיסמה לכניסה לניהול</p>
          
          <form onSubmit={handlePasswordLogin} className="space-y-4 mb-4">
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

          <div className="mb-8">
            <button 
              type="button"
              onClick={() => setShowForgotPasswordMessage(!showForgotPasswordMessage)}
              className="text-sm font-bold text-[#5A5A40]/60 hover:text-[#5A5A40] transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              {showForgotPasswordMessage ? "הסתר הודעה" : "שכחתי סיסמה"}
            </button>
            <AnimatePresence>
              {showForgotPasswordMessage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="mt-4 p-5 bg-yellow-50 border-2 border-yellow-200 rounded-3xl text-yellow-900 text-sm font-bold leading-relaxed shadow-lg text-center"
                >
                  {forgotPasswordText || "נא לפנות למנהל המערכת לקבלת סיסמה חדשה."}
                </motion.div>
              )}
            </AnimatePresence>
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
          <div className="flex items-center gap-3 relative group">
            <div className="absolute -inset-2 bg-orange-500/10 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            <Settings className="text-[#5A5A40] w-8 h-8 group-hover:rotate-180 transition-transform duration-700 relative z-10" strokeWidth={2.5} />
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
                {(user?.role === 'admin' || user?.role === 'super_admin') && (
                  <button 
                    onClick={() => setActiveTab("rules")}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "rules" ? "bg-[#5A5A40] text-white" : "hover:bg-[#F5F5F0]"}`}
                  >
                    חוקי מחשבון
                  </button>
                )}
                {(user?.role === 'admin' || user?.role === 'super_admin') && (
                  <button 
                    onClick={() => setActiveTab("settings")}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "settings" ? "bg-orange-500 text-white shadow-lg shadow-orange-200" : "hover:bg-[#F5F5F0]"}`}
                  >
                    <Settings className={`w-4 h-4 ${activeTab === "settings" ? "animate-spin-slow" : ""}`} />
                    הגדרות
                  </button>
                )}
                {user?.role === 'super_admin' && (
                  <button 
                    onClick={() => setActiveTab("admins")}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "admins" ? "bg-[#5A5A40] text-white" : "hover:bg-[#F5F5F0]"}`}
                  >
                    ניהול משתמשים
                  </button>
                )}
                <button 
                  onClick={() => setActiveTab("suppliers")}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "suppliers" ? "bg-[#5A5A40] text-white" : "hover:bg-[#F5F5F0]"}`}
                >
                  <Users className="w-4 h-4" />
                  ספקים
                </button>
                <button 
                  onClick={() => setActiveTab("github")}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "github" ? "bg-black text-white" : "hover:bg-[#F5F5F0]"}`}
                >
                  <Box className="w-4 h-4" />
                  גיטהב
                </button>
              </div>

              {activeTab === "github" && (
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5 space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="bg-black p-3 rounded-2xl text-white">
                      <Box className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">סנכרון ממסד נתונים (GitHub)</h2>
                      <p className="text-sm text-[#141414]/60">ייבוא נתונים ישירות מקובצי JSON בגיטהב למערכת המקומית.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4 p-6 bg-[#F8F9FA] rounded-2xl border border-[#141414]/5">
                      <div>
                        <label className="block text-sm font-bold mb-2">כתובת JSON מגיטהב (Raw URL)</label>
                        <input 
                          type="text" 
                          placeholder="https://raw.githubusercontent.com/user/repo/main/data.json"
                          className="w-full bg-white border border-[#141414]/10 rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-black/10"
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                        />
                        <p className="text-[10px] text-[#141414]/40 mt-1">וודא שהכתובת מתחילה ב-raw.githubusercontent.com</p>
                      </div>

                      <div>
                        <label className="block text-sm font-bold mb-2">יעד הייבוא</label>
                        <select 
                          className="w-full bg-white border border-[#141414]/10 rounded-xl py-3 px-4 text-sm outline-none"
                          value={githubCollection}
                          onChange={(e: any) => setGithubCollection(e.target.value)}
                        >
                          <option value="rewards">צ'ופרים (Rewards)</option>
                          <option value="fundraisers">מתרימים (Fundraisers)</option>
                          <option value="goalBonuses">הנחות יעד (Bonuses)</option>
                        </select>
                      </div>

                      <button 
                        onClick={handleGitHubSync}
                        disabled={isGitHubSyncing}
                        className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isGitHubSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                        סנכרן כעת מגיטהב
                      </button>
                    </div>

                    <div className="space-y-4 text-sm leading-relaxed text-[#141414]/80">
                      <h3 className="font-bold text-lg border-b pb-2">מדריך מהיר</h3>
                      <p>
                        ניתן לייצא את הנתונים שלך לגיטהב כקובץ JSON ולשמור עליהם מסונכרנים לכל האפליקציות.
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-xs">
                        <li>הקובץ חייב להיות בפורמט JSON תקין (מערך של אובייקטים).</li>
                        <li>לצ'ופרים: נדרש שדות כמו <code>name</code>, <code>minAmount</code>, <code>price</code>, <code>code</code>.</li>
                        <li>למתרימים: נדרש <code>GroupName</code>, <code>TotalAmount</code>, <code>Goal</code>, <code>ID</code>.</li>
                        <li>להנחות יעד: נדרש <code>name</code>, <code>minPercentage</code>, <code>minGoal</code>.</li>
                      </ul>
                      <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 mt-4">
                        <p className="text-[11px] font-bold text-yellow-800 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          שים לב: הסנכרון יעדכן נתונים קיימים לפי מזהה (ID). פריטים ללא מזהה יקבלו מזהה רנדומלי.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                      <div className="flex gap-2">
                        <button 
                          onClick={downloadFundraisersTemplate}
                          className="flex items-center gap-2 bg-[#F5F5F0] text-[#5A5A40] px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#E5E5E0] transition-all border border-[#5A5A40]/10"
                        >
                          <Download className="w-3 h-3" />
                          הורד תבנית
                        </button>
                        <label className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 transition-all cursor-pointer shadow-lg shadow-green-600/10">
                          <Upload className="w-4 h-4" />
                          העלאת אקסל
                          <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv" 
                            className="hidden" 
                            onChange={(e) => handleFileUpload(e, 'fundraisers')}
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                              <div className="relative">
                                <input 
                                  type="text"
                                  placeholder="הוסף מזהה ידנית..."
                                  className="text-xs border border-[#141414]/10 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[#5A5A40]"
                                  value={manualIdInput}
                                  onChange={(e) => {
                                    setManualIdInput(e.target.value);
                                  }}
                                  onKeyDown={(e) => e.key === 'Enter' && handleManualIdAdd()}
                                />
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
                            <tr 
                              key={i} 
                              className="border-b border-[#141414]/5 last:border-0 hover:bg-[#F5F5F0] transition-colors cursor-pointer"
                              onClick={() => {
                                // For admins/managers, clicking does a quick preview sync notification
                                setToast({ message: `מציג נתוני: ${g.GroupName || g.Name || "ללא שם"}`, type: "success" });
                              }}
                            >
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
                                      className={`h-full transition-all duration-500 ${(g.Percentage || 0) >= 100 ? "bg-green-500" : "bg-red-500"}`} 
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
                      <div className="relative group flex-1 md:flex-none">
                        <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#141414]/20 group-focus-within:text-[#5A5A40] transition-colors" />
                        <input 
                          type="text" 
                          placeholder="חיפוש חכם (שם, מזהה, צ'ופר...)"
                          value={searchTermClaims}
                          onChange={(e) => setSearchTermClaims(e.target.value)}
                          className="w-full md:w-64 bg-[#F5F5F0] border-none rounded-xl py-2 pr-10 pl-4 text-xs focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none"
                        />
                      </div>
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
                          <th className="pb-4 font-bold">עודכן ע"י</th>
                          <th className="pb-4 font-bold">סטטוס</th>
                          <th className="pb-4 font-bold">פעולות</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {filteredClaims.length > 0 ? filteredClaims.map((claim) => (
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
                            <td className="py-4 text-[10px] font-bold text-[#141414]/40">
                              {claim.updatedBy || "—"}
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
                                    <Settings className="w-4 h-4" />
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
                        )) : (
                          <tr>
                            <td colSpan={6} className="py-20 text-center">
                               <div className="bg-[#F5F5F0] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                                 <RefreshCw className="w-6 h-6 text-[#141414]/20" />
                               </div>
                               <p className="text-[#141414]/40 font-bold">לא נמצאו מימושים התואמים לחיפוש.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-10 pt-6 border-t border-[#141414]/5 flex justify-end">
                    <button 
                      onClick={() => setShowResetModal(true)}
                      className="flex items-center gap-2 text-red-500 hover:text-red-600 font-bold text-sm bg-red-50 px-4 py-2 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      איפוס כל נתוני המערכת
                    </button>
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
                        <button 
                          onClick={downloadRewardsTemplate}
                          className="flex items-center gap-2 bg-[#F5F5F0] text-[#5A5A40] px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#E5E5E0] transition-all border border-[#5A5A40]/10"
                        >
                          <Download className="w-4 h-4" />
                          הורד תבנית
                        </button>
                        <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all cursor-pointer shadow-lg shadow-blue-600/10">
                          <Upload className="w-4 h-4" />
                          העלאת אקסל צ'ופרים
                          <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv" 
                            className="hidden" 
                            onChange={(e) => handleFileUpload(e, 'rewards')}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="text-[10px] text-[#141414]/40 uppercase font-bold tracking-widest border-b border-[#141414]/5">
                            <th className="pb-4 pr-2 w-1/4">שם הצ'ופר</th>
                            <th className="pb-4 pr-2 w-1/6">סכום יעד</th>
                            <th className="pb-4 pr-2 w-1/6">שווי (₪)</th>
                            <th className="pb-4 pr-2 w-1/6">קוד זיהוי</th>
                            <th className="pb-4 pr-2 w-1/6">ספק</th>
                            <th className="pb-4 pr-2">בתצוגה?</th>
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
                                value={rewardAmountThreshold ?? ""}
                                onChange={(e) => setRewardAmountThreshold(e.target.value)}
                                className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none text-sm"
                                placeholder="2500"
                              />
                            </td>
                            <td className="py-6 pr-2">
                              <input 
                                type="number" 
                                value={rewardPrice ?? ""}
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
                            <td className="py-6 pr-2">
                              <select
                                value={rewardSupplierId || ""}
                                onChange={(e) => setRewardSupplierId(e.target.value)}
                                className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none text-sm"
                              >
                                <option value="">בחר ספק...</option>
                                {suppliers.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-6 pr-2">
                              <div className="flex justify-center">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={rewardInDisplay}
                                    onChange={(e) => setRewardInDisplay(e.target.checked)}
                                  />
                                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#5A5A40]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5A5A40]"></div>
                                </label>
                              </div>
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
                        <button 
                          onClick={downloadBonusesTemplate}
                          className="flex items-center gap-2 bg-[#F5F5F0] text-[#5A5A40] px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#E5E5E0] transition-all border border-[#5A5A40]/10"
                        >
                          <Download className="w-4 h-4" />
                          הורד תבנית
                        </button>
                        <label className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-700 transition-all cursor-pointer shadow-lg shadow-purple-600/10">
                          <Upload className="w-4 h-4" />
                          העלאת אקסל הנחות
                          <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv" 
                            className="hidden" 
                            onChange={(e) => handleFileUpload(e, 'bonuses')}
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
                            <p className="text-xs text-[#141414]/40">
                              יעד: ₪{(reward.minAmount || 0).toLocaleString()} | מחיר: ₪{reward.price?.toLocaleString() || 0}
                              {reward.supplierId && ` | ספק: ${suppliers.find(s => s.id === reward.supplierId)?.name || 'לא ידוע'}`}
                              {reward.inDisplay && <span className="mr-2 text-blue-600 font-bold">(קיים בתצוגה)</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] text-[#141414]/40 font-bold mb-1 leading-none">ספק</span>
                              <select
                                value={reward.supplierId || ""}
                                onChange={(e) => handleUpdateRewardSupplier(reward.id!, e.target.value)}
                                className="text-[10px] bg-white border-none rounded p-1 focus:ring-1 focus:ring-[#5A5A40] outline-none cursor-pointer"
                              >
                                <option value="">ללא ספק</option>
                                {suppliers.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] text-[#141414]/40 font-bold mb-1 leading-none">תצוגה</span>
                              <input 
                                type="checkbox" 
                                checked={!!reward.inDisplay}
                                onChange={() => handleToggleRewardDisplay(reward.id!, !!reward.inDisplay)}
                                className="w-4 h-4 rounded border-[#141414]/10 text-[#5A5A40] focus:ring-[#5A5A40] cursor-pointer"
                              />
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
                        value={manualGoal ?? ""}
                        onChange={(e) => setManualGoal(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none"
                        placeholder="השאר ריק לשימוש ביעד מנדרים פלוס"
                      />
                      <p className="text-[10px] text-[#141414]/40 mt-2">אם יוזן ערך, הוא ידרוס את היעד שמגיע מנדרים פלוס.</p>
                    </div>

                    <div className="pt-4 border-t border-[#141414]/5">
                      <h3 className="text-lg font-bold mb-4">הגדרות תשלום מזומן</h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold mb-2">שיטת חישוב תשלום</label>
                          <div className="flex gap-2">
                             <button
                               onClick={() => setCashCalculationMode('absolute')}
                               className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all ${cashCalculationMode === 'absolute' ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#5A5A40] border-[#141414]/10 hover:bg-[#F5F5F0]'}`}
                             >
                               לפי הפרש סכומים
                             </button>
                             <button
                               onClick={() => setCashCalculationMode('percentage')}
                               className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all ${cashCalculationMode === 'percentage' ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#5A5A40] border-[#141414]/10 hover:bg-[#F5F5F0]'}`}
                             >
                               לפי אחוזי יעד
                             </button>
                          </div>
                        </div>

                        {cashCalculationMode === 'percentage' && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-[#F5F5F0] p-4 rounded-2xl"
                          >
                            <label className="block text-xs font-bold mb-2">אחוז לתשלום מהיתרה ליעד</label>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                value={cashPayPercentage}
                                onChange={(e) => setCashPayPercentage(Number(e.target.value))}
                                className="w-full bg-white border-none rounded-xl py-2 px-4 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none text-sm"
                                placeholder="10"
                              />
                              <span className="font-bold text-[#141414]/40">%</span>
                            </div>
                            <p className="text-[10px] text-[#141414]/40 mt-2">דוגמה: אם חסר 900 ש"ח ליעד והוגדר 10%, המתרים ישלם 90 ש"ח.</p>
                          </motion.div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-[#141414]/5">
                        <label className="block text-sm font-bold mb-2">הודעת "שכחתי סיסמה"</label>
                        <textarea 
                          value={forgotPasswordText}
                          onChange={(e) => setForgotPasswordText(e.target.value)}
                          className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none text-sm min-h-[100px]"
                          placeholder="מה יוצג כשילחצו על 'שכחתי סיסמה'?"
                        />
                        <p className="text-[10px] text-[#141414]/40 mt-2">טקסט זה יוצג במסך הכניסה למנהל בעת לחיצה על שכחתי סיסמה.</p>
                      </div>
                    </div>

                    <button 
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {savingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Settings className="w-5 h-5" />}
                      שמור הגדרות
                    </button>

                    <div className="pt-8 mt-8 border-t border-[#141414]/5">
                      <h3 className="text-sm font-bold mb-4 text-[#5A5A40]">תחזוקת מערכת</h3>
                      <button 
                        onClick={async () => {
                          if (!window.confirm("האם אתה בטוח שברצונך למחוק כפילויות מהמערכת? פעולה זו תסרוק את כל הצ'ופרים והמתרימים ותמחק פריטים זהים.")) return;
                          try {
                            const res = await fetch("/api/admin/db-maintenance", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "cleanup_duplicates", requester: user?.username || ADMIN_NAME })
                            });
                            const result = await res.json();
                            if (result.success) {
                              setToast({ message: `בוצע ניקוי! הוסרו ${result.removed} כפילויות.`, type: "success" });
                              fetchData();
                            } else {
                              setToast({ message: result.error || "נכשל", type: "error" });
                            }
                          } catch (e) {
                            setToast({ message: "שגיאה בתקשורת", type: "error" });
                          }
                        }}
                        className="w-full bg-white text-[#5A5A40] border border-[#5A5A40]/30 py-3 rounded-xl font-bold hover:bg-[#F5F5F0] transition-all flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        ניקוי כפילויות (ניפוי דאטה)
                      </button>
                    </div>

                    {user?.role === 'super_admin' && (
                      <div className="pt-8 border-t border-[#141414]/5">
                        <h3 className="text-lg font-bold mb-4 text-red-600">איפוס מערכת (פעולה מסוכנת)</h3>
                        <p className="text-xs text-[#141414]/40 mb-4">פעולה זו תמחק את כל בקשות הצ'ופרים, המתרימים והחוקים. רק מנהל ראשי רשאי לבצע זאת.</p>
                        <button 
                          onClick={() => setShowResetModal(true)}
                          className="w-full bg-red-100 text-red-600 py-3 rounded-2xl font-bold hover:bg-red-200 transition-all flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-5 h-5" />
                          איפוס נתונים מלא
                        </button>
                      </div>
                    )}

                    <div className="pt-8 border-t border-[#141414]/5">
                      <h3 className="text-lg font-bold mb-4">שינוי סיסמה אישית</h3>
                      <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold mb-1 mr-1">סיסמה נוכחית</label>
                          <input 
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className="w-full bg-[#F5F5F0] border-none rounded-2xl py-3 px-6 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1 mr-1">סיסמה חדשה</label>
                          <input 
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-[#F5F5F0] border-none rounded-2xl py-3 px-6 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1 mr-1">אימות סיסמה חדשה</label>
                          <input 
                            type="password"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="w-full bg-[#F5F5F0] border-none rounded-2xl py-3 px-6 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none"
                            required
                          />
                        </div>
                        <button 
                          type="submit"
                          disabled={changingPassword}
                          className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {changingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                          עדכן סיסמה
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "admins" && user?.role === 'super_admin' && (
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <Settings className="w-6 h-6 text-[#6366F1]" />
                    ניהול משתמשים
                  </h2>
                  
                  {user?.role === 'super_admin' && (
                    <form onSubmit={handleAddAdmin} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                      <input 
                        type="text" 
                        value={newAdminUsername}
                        onChange={(e) => setNewAdminUsername(e.target.value)}
                        placeholder="שם משתמש"
                        className="bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#6366F1]/20 transition-all outline-none text-right"
                        required
                      />
                      <input 
                        type="text" 
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        placeholder="קוד אישי / סיסמה"
                        className="bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#6366F1]/20 transition-all outline-none text-right"
                        required
                      />
                      <select
                        value={newAdminRole}
                        onChange={(e) => setNewAdminRole(e.target.value as any)}
                        className="bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#6366F1]/20 transition-all outline-none text-right font-bold appearance-none cursor-pointer"
                      >
                        <option value="user">משתמש (בלי גישת ניהול)</option>
                        <option value="admin">מנהל (בלי ניהול משתמשים)</option>
                        <option value="super_admin">מנהל ראשי (גישה להכל)</option>
                      </select>
                      <button 
                        type="submit"
                        disabled={addingAdmin}
                        className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white px-8 py-4 rounded-2xl font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50"
                      >
                        {addingAdmin ? "מוסיף..." : "הוסף"}
                      </button>
                    </form>
                  )}

                  <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 text-indigo-700 rounded-2xl text-sm font-bold flex items-center gap-2 border border-indigo-100">
                      <Settings className="w-4 h-4" />
                      מנהל מערכת ראשי: {ADMIN_NAME} (תפקיד: super_admin)
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="border-b border-[#141414]/5 text-xs text-[#141414]/40 uppercase tracking-widest">
                            <th className="pb-4 font-bold">שם משתמש</th>
                            <th className="pb-4 font-bold">קוד אישי</th>
                            <th className="pb-4 font-bold">תפקיד</th>
                            <th className="pb-4 font-bold text-left">פעולות</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {admins.map((admin) => (
                            <tr key={admin.username} className="border-b border-[#141414]/5 last:border-0 hover:bg-[#F5F5F0]/30 transition-colors">
                              <td className="py-4 font-bold text-[#2D3E50]">{admin.username}</td>
                              <td className="py-4 font-mono text-[#6366F1]">{admin.password}</td>
                              <td className="py-4">
                                <button
                                  onClick={() => user?.role === 'super_admin' && admin.username !== ADMIN_NAME && handleToggleAdminRole(admin.username, admin.role)}
                                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${
                                    admin.role === 'super_admin' 
                                      ? "bg-purple-100 text-purple-700 border-purple-200"
                                      : admin.role === 'admin' 
                                        ? "bg-green-100 text-green-700 border-green-200" 
                                        : "bg-gray-100 text-gray-600 border border-gray-200"
                                  } ${admin.username === ADMIN_NAME || user?.role !== 'super_admin' ? "opacity-70 cursor-default" : "hover:scale-105 active:scale-95"}`}
                                >
                                  {admin.role === 'super_admin' ? "מנהל ראשי" : admin.role === 'admin' ? "מנהל" : "משתמש"}
                                </button>
                              </td>
                              <td className="py-4 text-left">
                                {user?.role === 'super_admin' && admin.username !== ADMIN_NAME && (
                                  <button 
                                    onClick={() => setConfirmModal({
                                      title: "הסרת משתמש",
                                      message: `האם אתה בטוח שברצונך להסיר את המשתמש ${admin.username}?`,
                                      danger: true,
                                      onConfirm: () => fetch(`/api/admin/users/${encodeURIComponent(admin.username)}?requester=${encodeURIComponent(user?.username || ADMIN_NAME)}`, { method: "DELETE" }).then(() => fetchData())
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

              {activeTab === "suppliers" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-green-500" />
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight">ניהול ספקים</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                      <div className="bg-[#F5F5F0] p-6 rounded-2xl border border-[#141414]/5">
                        <h3 className="text-sm font-bold mb-4">הוספת ספק חדש</h3>
                        <div className="space-y-4">
                          <input 
                            type="text" 
                            placeholder="שם הספק"
                            value={supplierName}
                            onChange={(e) => setSupplierName(e.target.value)}
                            className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none text-sm"
                          />
                          <input 
                            type="email" 
                            placeholder="כתובת מייל להזמנות"
                            value={supplierEmail}
                            onChange={(e) => setSupplierEmail(e.target.value)}
                            className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none text-sm"
                          />
                          <button 
                            onClick={handleAddSupplier}
                            disabled={addingSupplier}
                            className="w-full bg-[#5A5A40] text-white rounded-xl py-3 px-4 font-bold hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {addingSupplier ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            הוסף ספק
                          </button>
                        </div>
                      </div>

                      <div className="bg-[#F5F5F0] p-6 rounded-2xl border border-[#141414]/5">
                        <h3 className="text-sm font-bold mb-4">רשימת ספקים</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {suppliers.map((s, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-xl flex justify-between items-center group">
                              <div>
                                <div className="font-bold text-sm">{s.name}</div>
                                <div className="text-[10px] text-gray-500">{s.email}</div>
                              </div>
                              <button 
                                onClick={() => handleDeleteSupplier(s.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          {suppliers.length === 0 && (
                            <div className="text-center py-4 text-gray-400 text-xs italic">אין ספקים רשומים</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                          <Box className="w-5 h-5 text-orange-500" />
                        </div>
                        <h3 className="text-lg font-bold tracking-tight">סיכום הזמנות לפי ספקים</h3>
                        <p className="text-xs text-gray-400 font-normal mr-2">(מחושב לפי צ'ופרים שבוצעו)</p>
                      </div>
                      
                      <div className="space-y-6">
                        {suppliers.length > 0 ? (
                          <>
                            {suppliers.map((supplier) => {
                              // Find ALL rewards for this supplier
                              const supplierRewards = rewards.filter(r => r.supplierId === supplier.id);
                              const rewardIds = supplierRewards.map(r => r.id);
                              const rewardCodes = supplierRewards.map(r => r.code).filter(code => code && code.toString().trim() !== "");
                              const rewardNames = supplierRewards.map(r => r.name);
                              
                              // Filter claims for these rewards
                              const supplierClaims = claims.filter(c => 
                                (c.rewardId && rewardIds.includes(c.rewardId)) ||
                                (c.rewardCode && rewardCodes.includes(c.rewardCode)) || 
                                (!c.rewardCode && rewardNames.includes(c.rewardName))
                              );
                              
                              // Skip if no rewards at all assigned to this supplier
                              if (supplierRewards.length === 0) return null;

                              // Group claims and apply inDisplay subtraction logic for ALL supplier rewards
                              const summaryEntries = supplierRewards.map(reward => {
                                // Match claims strictly by ID or exact code/name
                                const rewardClaims = claims.filter(c => {
                                  if (c.rewardId && reward.id) return c.rewardId === reward.id;
                                  
                                  const rCode = reward.code?.toString().trim();
                                  const cCode = c.rewardCode?.toString().trim();
                                  if (rCode && cCode) return rCode === cCode;
                                  
                                  return c.rewardName === reward.name;
                                });
                                
                                const count = rewardClaims.length;
                                const adjustedCount = reward.inDisplay ? count - 1 : count;
                                return { 
                                  name: reward.name, 
                                  count: adjustedCount, 
                                  isDisplay: reward.inDisplay, 
                                  originalCount: count 
                                };
                              }).filter(item => item.count !== 0 || (item.isDisplay && item.originalCount > 0));

                              const totalAdjustedItems = summaryEntries.reduce((sum, item) => sum + (item.count > 0 ? item.count : 0), 0);

                              return (
                                <div key={supplier.id} className="bg-[#F5F5F0] border border-[#141414]/5 rounded-2xl overflow-hidden shadow-sm">
                                  <div className="bg-[#5A5A40] p-4 text-white flex justify-between items-center">
                                    <div>
                                      <span className="font-bold">{supplier.name}</span>
                                      <span className="text-xs opacity-80 mr-4">({supplier.email})</span>
                                    </div>
                                    <div className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full flex items-center gap-2">
                                      <Box className="w-3 h-3" />
                                      סה"כ להזמנה: {totalAdjustedItems} פריטים
                                    </div>
                                    <div className="flex gap-2">
                                      {totalAdjustedItems > 0 && (
                                        <button 
                                          onClick={() => handleExportSupplier(supplier.id)}
                                          className="text-xs font-bold bg-white/20 hover:bg-white/40 px-3 py-1 rounded-full flex items-center gap-2 transition-all"
                                          title="ייצוא לאקסל"
                                        >
                                          <Download className="w-3 h-3" />
                                          ייצוא
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="p-4 bg-white">
                                    {summaryEntries.length > 0 ? (
                                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                        {summaryEntries.map(({name, count, isDisplay, originalCount}) => (
                                          <div key={name} className={`p-3 rounded-xl border border-[#141414]/5 group hover:border-[#5A5A40]/30 transition-all ${isDisplay ? 'bg-blue-50/30 border-blue-100' : 'bg-[#F5F5F0]'}`}>
                                            <div className="flex justify-between items-start mb-1">
                                              <div className="text-[10px] text-gray-500">שם הצ'ופר</div>
                                              {isDisplay && <span className="text-[8px] font-black text-blue-600 bg-blue-100 px-1 rounded">תצוגה (-1)</span>}
                                            </div>
                                            <div className="font-bold text-xs truncate mb-2" title={name}>{name}</div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-[10px] text-gray-400">כמות:</span>
                                              <div className="flex flex-col items-end">
                                                <span className={`text-sm font-black px-2 py-0.5 rounded-lg border border-[#141414]/5 ${count <= 0 ? (count === 0 ? 'text-gray-400 bg-gray-50' : 'text-red-500 bg-red-50 border-red-200') : 'text-[#5A5A40] bg-white '}`}>
                                                  {count}
                                                </span>
                                                {isDisplay && originalCount > 0 && (
                                                  <span className="text-[8px] text-gray-400 mt-0.5">מתוך {originalCount} (1- תצוגה)</span>
                                                )}
                                                {isDisplay && originalCount === 0 && (
                                                  <span className="text-[8px] text-blue-500 mt-0.5 font-bold">קיים רק בתצוגה</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-center py-6 text-gray-400 text-sm italic">
                                        אין הזמנות פעילות לספק זה (או שהכל הושלם מהתצוגה)
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            
                            {!suppliers.some(s => {
                              const sRewards = rewards.filter(r => r.supplierId === s.id);
                              const rIds = sRewards.map(r => r.id);
                              const rCodes = sRewards.map(r => r.code).filter(c => c);
                              const rNames = sRewards.map(r => r.name);
                              return claims.some(c => 
                                (c.rewardId && rIds.includes(c.rewardId)) ||
                                (c.rewardCode && rCodes.includes(c.rewardCode)) ||
                                (!c.rewardCode && rNames.includes(c.rewardName))
                              );
                            }) && (
                              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-[#141414]/10 text-gray-400">
                                <Box className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>אין נתוני הזמנות עבור אף ספק כרגע</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-12 bg-white rounded-2xl border border-[#141414]/5">
                            <Box className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-400 font-medium">לא הוגדרו ספקים במערכת.</p>
                          </div>
                        )}
                      </div>
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
                        <Settings className="w-6 h-6" />
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

      {/* Reset System Modal */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white p-8 rounded-[32px] shadow-2xl max-w-md w-full text-center border border-[#141414]/5"
            >
              <div className="bg-red-50 p-4 rounded-2xl mb-6">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-red-700 mb-2">איפוס כל נתוני המערכת</h2>
                <p className="text-sm text-red-600 font-medium">
                  פעולה זו תמחק לצמיתות את כל המימושים, המתרימים והצ'ופרים שהוגדרו ידנית. האם אינכם בטוחים?
                </p>
              </div>
              
              <form onSubmit={handleResetSystem} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-right mb-2 mr-2">לאישור נא הקש סיסמת מנהל:</label>
                  <input 
                    type="password"
                    value={resetVerifyCode}
                    onChange={(e) => setResetVerifyCode(e.target.value)}
                    className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 text-center text-lg focus:ring-2 focus:ring-red-500/20 transition-all outline-none"
                    placeholder="••••••"
                    autoFocus
                  />
                </div>
                
                <div className="flex gap-3">
                  <button 
                    type="submit"
                    disabled={resetting || !resetVerifyCode}
                    className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    {resetting ? "מבצע איפוס..." : "אשר איפוס מלא"}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowResetModal(false);
                      setResetVerifyCode("");
                    }}
                    className="flex-1 bg-[#F5F5F0] text-[#141414]/60 py-3 rounded-xl font-bold hover:bg-[#E5E5E0] transition-all"
                  >
                    ביטול
                  </button>
                </div>
              </form>
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
              toast.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 
              toast.type === 'info' ? 'bg-blue-50 border-blue-100 text-blue-700' :
              'bg-red-50 border-red-100 text-red-700'
            }`}
          >
            {toast.type === 'success' ? <Check className="w-5 h-5" /> : 
             toast.type === 'info' ? <Box className="w-5 h-5" /> :
             <AlertCircle className="w-5 h-5" />}
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
            <p className="text-blue-500 font-bold">מצב גישה: {user ? (user.isAnonymous ? "אנונימי" : user.username) : "ציבורי (סיסמה)"}</p>
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

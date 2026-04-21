import React, { useState, useEffect, useMemo, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { Search, TrendingUp, Users, Target, Loader2, AlertCircle, RefreshCw, Gift, ShieldCheck, User as UserIcon, LogIn, LogOut, Check, X, Sparkles, Box } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Fuse from "fuse.js";
import Admin from "./components/Admin";
import { Login } from "./components/Login";
import ErrorBoundary from "./components/ErrorBoundary";

interface CampaignData {
  CampaignName?: string;
  TotalAmount?: number;
  GoalAmount?: number;
  Percentage?: number;
}

interface GroupData {
  ID: string;
  GroupName: string;
  TotalAmount: number;
  Goal: number;
  Percentage?: number;
}

interface RewardData {
  id: string;
  name: string;
  description: string;
  minAmount: number;
  price: number;
  code?: string;
  image?: string;
}

interface BonusData {
  id: string;
  name: string;
  description: string;
  minPercentage: number;
  minGoal?: number;
}

interface CartItem {
  reward: RewardData | BonusData;
  type: 'reward' | 'bonus';
  paidInCash: boolean;
  amountToPay: number;
  isPaid?: boolean;
}

const App: React.FC = () => {
  const [mosad, setMosad] = useState("7011088");
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [manualGoal, setManualGoal] = useState<number | null>(null);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [manualGroups, setManualGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFundraiser, setSearchFundraiser] = useState("");
  const [searchReward, setSearchReward] = useState("");
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [rewards, setRewards] = useState<RewardData[]>([]);
  const [bonuses, setBonuses] = useState<BonusData[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [showAllRewards, setShowAllRewards] = useState(false);
  const [isPaidChecked, setIsPaidChecked] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: (replace: boolean) => void;
    buttons?: { text: string; action: (replace: boolean) => void; variant?: 'primary' | 'secondary' | 'danger' }[];
  } | null>(null);
  const [fundraiserClaims, setFundraiserClaims] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const lastFetchedMosad = useRef<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    // Check local storage for session
    const savedUser = localStorage.getItem('campee_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setAuthReady(true);

    // Fetch initial settings
    fetch("/api/db/settings").then(res => res.json()).then(data => {
      if (data && Array.isArray(data)) {
        const global = data.find((it: any) => it.id === "global");
        if (global) {
          if (global.mosadId) {
            setMosad(global.mosadId);
            fetchData(global.mosadId);
          }
          if (global.manualGoal !== undefined) {
            setManualGoal(global.manualGoal);
          }
        } else {
          fetchData(mosad);
        }
      }
    }).catch(err => {
      console.error("Settings fetch error:", err);
      fetchData(mosad);
    });
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem('campee_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('campee_user');
  };

  const displayGroups = useMemo(() => {
    const merged = [...groups];
    manualGroups.forEach(mg => {
      // Check multiple ID fields for robust matching
      if (!merged.find(g => (g.ID || (g as any).GroupId || (g as any).Code) === mg.ID)) {
        merged.push(mg);
      }
    });
    return merged.sort((a, b) => (b.TotalAmount || 0) - (a.TotalAmount || 0));
  }, [groups, manualGroups]);

  const fuse = useMemo(() => new Fuse(displayGroups, {
    keys: ["GroupName", "ID"],
    threshold: 0.35,
    distance: 100,
    includeMatches: true,
  }), [displayGroups]);

  const filteredGroups = useMemo(() => {
    if (!searchFundraiser.trim()) return displayGroups;
    return fuse.search(searchFundraiser).map(result => result.item);
  }, [fuse, searchFundraiser, displayGroups]);

  const selectedGroup = displayGroups.find(g => g.GroupName === selectedGroupName) || (filteredGroups.length === 1 ? filteredGroups[0] : null);

  useEffect(() => {
    if (selectedGroup) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch("/api/db/claims");
          const data = await res.json();
          if (data && Array.isArray(data)) {
            const filtered = data.filter((c: any) => c.fundraiserId === selectedGroup.ID);
            setFundraiserClaims(filtered);
          }
        } catch (e) {
          console.error("Polling claims error:", e);
        }
      }, 5000); // Poll every 5s for claims

      return () => clearInterval(interval);
    } else {
      setFundraiserClaims([]);
    }
  }, [selectedGroup?.ID]);

  const totalCollected = campaign?.TotalAmount || displayGroups.reduce((sum, g) => sum + (g.TotalAmount || 0), 0);
  const totalGoal = manualGoal || campaign?.Goal || displayGroups.reduce((sum, g) => sum + (g.Goal || 0), 0);
  const overallPercentage = totalGoal > 0 ? (totalCollected / totalGoal) * 100 : 0;

  const previousClaimsBudget = useMemo(() => {
    return fundraiserClaims.reduce((sum, c) => {
      if (c.type === 'reward') {
        const reward = rewards.find(r => r.id === c.rewardId);
        return sum + (reward?.minAmount || 0);
      }
      return sum;
    }, 0);
  }, [fundraiserClaims, rewards]);

  const usedBudget = cart.reduce((sum, item) => item.type === 'reward' ? sum + (item.reward as RewardData).minAmount : sum, 0);
  const remainingBudget = selectedGroup ? Math.max(0, selectedGroup.TotalAmount - usedBudget - previousClaimsBudget) : 0;

  const eligibleRewards = selectedGroup 
    ? rewards.filter(r => (selectedGroup.TotalAmount >= r.minAmount) || ((r.minAmount - remainingBudget) <= (totalGoal * 0.1)))
    : [];

  const shownRewards = useMemo(() => {
    let list = showAllRewards ? rewards : eligibleRewards;
    if (searchReward.trim()) {
      const fr = new Fuse(list, { keys: ["name", "code", "description"], threshold: 0.35 });
      return fr.search(searchReward).map(r => r.item);
    }
    return list.sort((a, b) => a.minAmount - b.minAmount);
  }, [showAllRewards, rewards, eligibleRewards, searchReward]);

  const eligibleBonuses = selectedGroup
    ? bonuses.filter(b => 
        (selectedGroup.Percentage || 0) >= (b.minPercentage || 0) && 
        (!b.minGoal || selectedGroup.TotalAmount >= b.minGoal)
      )
    : [];

  const nextReward = selectedGroup 
    ? rewards.find(r => remainingBudget < r.minAmount)
    : null;

  const handleAddToCart = (reward: RewardData | BonusData, type: 'reward' | 'bonus', paidInCash: boolean = false, forceAdd: boolean = false) => {
    if (!selectedGroup) return;
    
    const existingIndex = cart.findIndex(item => item.reward.id === reward.id);
    
    const calculateIsPaid = (isPaidRequested: boolean, isCash: boolean) => {
      // If it's free (not paid in cash), it's automatically "paid"
      if (!isCash) return true;
      // Otherwise, depend on the checkbox
      return isPaidRequested;
    };

    if (existingIndex !== -1 && !forceAdd) {
      setConfirmModal({
        title: "צ'ופר כבר קיים בסל",
        message: `צ'ופר זה ("${reward.name}") כבר נמצא בסל הקניות שלך. האם ברצונך להחליף את הקיים (לדרוס) או להוסיף אחד נוסף כבקשה חדשה?`,
        onConfirm: () => {}, // Not used as we define custom buttons
        buttons: [
          { 
            text: "לדרוס (החלף)", 
            action: () => {
              setCart(prev => {
                const newCart = [...prev];
                let amountToPay = 0;
                if (paidInCash && type === 'reward') {
                  const r = reward as RewardData;
                  // Calculate budget without the item being replaced to avoid double-counting
                  const otherItemsBudget = prev.filter((_, idx) => idx !== existingIndex)
                    .reduce((sum, item) => item.type === 'reward' ? sum + (item.reward as RewardData).minAmount : sum, 0);
                  const currentRemainingBudget = selectedGroup!.TotalAmount - otherItemsBudget;
                  const diff = Math.max(0, r.minAmount - currentRemainingBudget);
                  amountToPay = Math.round((diff / r.minAmount) * r.price);
                }
                newCart[existingIndex] = { reward, type, paidInCash, amountToPay, isPaid: calculateIsPaid(isPaidChecked, paidInCash) };
                return newCart;
              });
              setConfirmModal(null);
            },
            variant: 'secondary'
          },
          { 
            text: "הוסף לסל (חדש)", 
            action: () => {
              let amountToPay = 0;
              if (paidInCash && type === 'reward') {
                const r = reward as RewardData;
                const diff = Math.max(0, r.minAmount - remainingBudget);
                amountToPay = Math.round((diff / r.minAmount) * r.price);
              }
              setCart(prev => [...prev, { reward, type, paidInCash, amountToPay, isPaid: calculateIsPaid(isPaidChecked, paidInCash) }]);
              setConfirmModal(null);
            },
            variant: 'primary'
          },
          {
            text: "ביטול",
            action: () => setConfirmModal(null),
            variant: 'secondary'
          }
        ]
      });
      return;
    }

    let amountToPay = 0;
    if (paidInCash && type === 'reward') {
      const r = reward as RewardData;
      const diff = Math.max(0, r.minAmount - remainingBudget);
      amountToPay = Math.round((diff / r.minAmount) * r.price);
    }

    setCart(prev => [...prev, { reward, type, paidInCash, amountToPay, isPaid: calculateIsPaid(isPaidChecked, paidInCash) }]);
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleCheckout = async () => {
    if (!selectedGroup || cart.length === 0) return;
    setClaiming(true);
    try {
      for (const item of cart) {
        await fetch("/api/db/claims", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fundraiserId: selectedGroup.ID,
            fundraiserName: selectedGroup.GroupName,
            rewardId: item.reward.id,
            rewardName: item.reward.name,
            rewardCode: (item.reward as RewardData).code || "",
            type: item.type,
            status: 'pending',
            paidInCash: item.paidInCash,
            amountToPay: item.amountToPay,
            isPaid: item.isPaid || false,
            uid: user?.uid || 'guest',
            userEmail: user?.email || 'guest'
          })
        });
      }
      setToast({ message: "כל הבקשות נשלחו בהצלחה!", type: "success" });
      setCart([]);
    } catch (err) {
      console.error("Checkout error:", err);
      setToast({ message: "שגיאה בשליחת הבקשות", type: "error" });
    } finally {
      setClaiming(false);
    }
  };

  const handleClaimReward = async (reward: RewardData | BonusData, type: 'reward' | 'bonus', paidInCash: boolean = false) => {
    handleAddToCart(reward, type, paidInCash);
  };

  const fetchData = async (targetMosad: string) => {
    const cleanMosad = String(targetMosad || "").trim();
    if (!cleanMosad) return;
    lastFetchedMosad.current = cleanMosad;
    setLoading(true);
    setError(null);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      console.log(`[App] Fetching data for mosad: ${cleanMosad}`);
      const response = await fetch(`/api/campaign/${cleanMosad}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let parsedError;
        try { parsedError = JSON.parse(errorText); } catch(e) {}
        const message = parsedError?.error || `שגיאת שרת (${response.status}): ${errorText.substring(0, 100)}`;
        throw new Error(message);
      }
      const result = await response.json();
      console.log(`[App] Fetch result:`, result);
      
      let processedGroups: GroupData[] = [];
      if (result.success) {
        setCampaign(result.campaign);
        processedGroups = (result.groups || []).map((g: any) => {
          const totalAmount = Number(g.TotalAmount !== undefined ? g.TotalAmount : (g.Cumule !== undefined ? g.Cumule : (g.Amount || g.Sum || g.Total || g.MatrimTotal || 0)));
          const goal = Number(g.Goal !== undefined ? g.Goal : (g.Target || g.GoalAmount || g.MainGoal || g.MatrimGoal || 0));
          const groupName = String(g.GroupName || g.Name || g.Title || g.MatrimName || g.GroupTitle || "ללא שם").trim();
          const groupId = String(g.ID || g.GroupId || g.Code || g.GroupCode || g.MatrimId || "").trim();
          const percentage = g.Percentage !== undefined ? Number(g.Percentage) : (goal > 0 ? (totalAmount / goal) * 100 : 0);
          
          return {
            ID: groupId,
            GroupName: groupName,
            TotalAmount: totalAmount,
            Goal: goal,
            Percentage: percentage
          };
        }).filter((g: GroupData) => g.GroupName !== "ללא שם" || g.ID !== "")
          .sort((a: GroupData, b: GroupData) => b.TotalAmount - a.TotalAmount);
        
        setGroups(processedGroups);
      } else {
        console.warn("API returned success:false", result.error);
      }

      let manualData: GroupData[] = [];
      try {
        const res = await fetch("/api/db/fundraisers");
        manualData = await res.json();
        setManualGroups(manualData.sort((a, b) => b.TotalAmount - a.TotalAmount));
      } catch (err: any) {
        console.error("Manual fundraisers fetch error:", err);
      }

      // Only set error if BOTH sources are empty
      if (processedGroups.length === 0 && (Array.isArray(manualData) ? manualData.length : 0) === 0) {
        setError("לא נמצאו מתרימים במערכת. וודא שקוד המוסד תקין או העלה נתונים ידנית.");
      }

      try {
        const res = await fetch("/api/db/rewards");
        const rewardsData = await res.json();
        setRewards(rewardsData.sort((a: RewardData, b: RewardData) => a.minAmount - b.minAmount));
      } catch (err: any) {
        console.error("Rewards fetch error:", err);
        setError(`שגיאה בטעינת צ'ופרים: ${err.message}`);
      }

      try {
        const res = await fetch("/api/db/goalBonuses");
        const bonusesData = await res.json();
        setBonuses(bonusesData.sort((a: BonusData, b: BonusData) => a.minPercentage - b.minPercentage));
      } catch (err: any) {
        console.error("Bonuses fetch error:", err);
        setError(`שגיאה בטעינת הנחות: ${err.message}`);
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError("החיבור לשרת נדרים פלוס איטי מדי. נסה לרענן.");
      } else {
        setError(err.message || "An error occurred while fetching data");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const canPayForNextReward = selectedGroup && nextReward && totalGoal > 0 
    ? (nextReward.minAmount - remainingBudget) <= (totalGoal * 0.1)
    : false;

  const filteredRewards = eligibleRewards.filter(r => 
    r.name.toLowerCase().includes(searchReward.toLowerCase()) ||
    r.description.toLowerCase().includes(searchReward.toLowerCase()) ||
    r.id.toLowerCase().includes(searchReward.toLowerCase())
  );

  const filteredBonuses = eligibleBonuses.filter(b => 
    b.name.toLowerCase().includes(searchReward.toLowerCase()) ||
    b.description.toLowerCase().includes(searchReward.toLowerCase()) ||
    b.id.toLowerCase().includes(searchReward.toLowerCase())
  );

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#5A5A40]" />
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#6366F1] selection:text-white" dir="rtl">
        <header className="bg-white border-b border-[#141414]/10 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Link to="/" className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                <Box className="text-white w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-xl font-black tracking-tight text-[#2D3E50]">Campeee</h1>
                <p className="text-xs text-[#2D3E50]/60 font-bold uppercase tracking-wider">
                  {campaign?.CampaignName || "מעקב קמפיין"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              {user && (
                <div className="flex items-center gap-3 bg-white border border-[#F1F5F9] px-4 py-2 rounded-2xl shadow-sm">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#6366F1] to-[#4F46E5] rounded-full flex items-center justify-center text-white overflow-hidden font-bold text-xs shadow-inner">
                    {user.displayName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-black text-[#2D3E50] leading-none">{user.displayName}</p>
                    <button onClick={handleLogout} className="text-[10px] text-red-500 font-bold hover:underline">התנתק</button>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-2 w-full md:w-auto">
                <div className="flex gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => fetchData(mosad)}
                    className="p-2 bg-white border border-[#141414]/10 rounded-full hover:bg-[#F5F5F0] transition-all"
                    title="רענן נתונים"
                  >
                    <RefreshCw className={`w-4 h-4 text-[#5A5A40] ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#141414]/40 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="חיפוש מתרים (שם או קוד)..."
                      className="w-full bg-[#F5F5F0] border-none rounded-full py-2 pr-10 pl-4 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none"
                      value={searchFundraiser}
                      onChange={(e) => setSearchFundraiser(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchData(mosad)}
                    />
                  </div>
                  <button 
                    onClick={() => fetchData(mosad)}
                    className="bg-[#5A5A40] text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-[#4A4A30] transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    <Search className="w-4 h-4" />
                    חפש
                  </button>
                </div>
                <div className="relative w-full md:w-64">
                  <Gift className="absolute right-3 top-1/2 -translate-y-1/2 text-[#141414]/40 w-4 h-4" />
                  <input
                    type="text"
                    placeholder={selectedGroup ? `חיפוש צ'ופר (שם או קוד) עבור ${selectedGroup.GroupName}...` : "בחר מתרים לבדיקת זכאות..."}
                    className="w-full bg-[#F5F5F0] border-none rounded-full py-2 pr-10 pl-4 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none"
                    value={searchReward}
                    onChange={(e) => setSearchReward(e.target.value)}
                    disabled={!selectedGroup}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => fetchData(mosad)}
                  className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors"
                  title="רענן"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <Link to="/admin" className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors" title="ניהול">
                  <ShieldCheck className="w-5 h-5 text-[#141414]/40" />
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                <p className="font-medium">{error}</p>
              </div>
              <button 
                onClick={() => fetchData(mosad)}
                className="px-4 py-1.5 bg-red-600 text-white rounded-full text-sm font-bold hover:bg-red-700 transition-colors whitespace-nowrap"
              >
                נסה שוב
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-[32px] shadow-sm border border-[#141414]/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-50 p-2 rounded-lg"><Target className="text-blue-600 w-5 h-5" /></div>
                <span className="text-sm font-semibold text-[#141414]/60 uppercase tracking-wider">יעד ראשי</span>
              </div>
              <div className="text-3xl font-bold tracking-tighter">₪{totalGoal.toLocaleString()}</div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-6 rounded-[32px] shadow-sm border border-[#141414]/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-green-50 p-2 rounded-lg"><TrendingUp className="text-green-600 w-5 h-5" /></div>
                <span className="text-sm font-semibold text-[#141414]/60 uppercase tracking-wider">סה"כ נאסף</span>
              </div>
              <div className="text-3xl font-bold tracking-tighter">₪{totalCollected.toLocaleString()}</div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-6 rounded-[32px] shadow-sm border border-[#141414]/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-orange-50 p-2 rounded-lg"><Users className="text-orange-600 w-5 h-5" /></div>
                <span className="text-sm font-semibold text-[#141414]/60 uppercase tracking-wider">ביצוע כללי</span>
              </div>
              <div className="flex items-end gap-2">
                <div className="text-3xl font-bold tracking-tighter">{overallPercentage.toFixed(1)}%</div>
                <div className="w-full bg-[#F5F5F0] h-2 rounded-full mb-2 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${Math.min(overallPercentage, 100)}%` }} 
                    className="h-full bg-orange-500" 
                  />
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-3 space-y-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold serif italic">רשימת מתרימים</h2>
                <span className="text-sm text-[#141414]/40 font-mono">{filteredGroups.length} נמצאו</span>
              </div>

              <AnimatePresence mode="popLayout">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-[#5A5A40]" />
                    <p className="text-[#141414]/60 font-medium">מעבד נתונים...</p>
                    <button 
                      onClick={() => fetchData(mosad)}
                      className="text-xs text-[#5A5A40] underline mt-2"
                    >
                      טען מחדש
                    </button>
                  </div>
                ) : filteredGroups.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGroups.map((group, idx) => {
                      return (
                        <motion.div 
                          key={group.GroupName} 
                          layout 
                          initial={{ opacity: 0, scale: 0.95 }} 
                          animate={{ opacity: 1, scale: 1 }} 
                          transition={{ duration: 0.2 }} 
                          onClick={() => {
                            setSelectedGroupName(group.GroupName);
                            setCart([]);
                          }}
                          className="bg-white p-5 rounded-2xl border cursor-pointer transition-all group border-[#141414]/5 hover:border-[#5A5A40]/20 hover:shadow-md"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-bold text-lg group-hover:text-[#5A5A40] transition-colors">{group.GroupName}</h3>
                              <p className="text-xs text-[#141414]/40 font-mono">#{group.ID}</p>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-bold">₪{group.TotalAmount.toLocaleString()}</div>
                              <div className="text-[10px] text-[#141414]/40">מתוך ₪{group.Goal.toLocaleString()}</div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                              <span>התקדמות</span>
                              <span>{group.Percentage?.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-[#F5F5F0] h-1.5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }} 
                                animate={{ width: `${Math.min(group.Percentage || 0, 100)}%` }} 
                                className="h-full bg-[#5A5A40]" 
                              />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-[#141414]/10">
                    <p className="text-[#141414]/40">לא נמצאו מתרימים התואמים לחיפוש</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        <footer className="bg-white border-t border-[#141414]/10 py-12 mt-20">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <TrendingUp className="w-8 h-8 text-[#5A5A40] mx-auto mb-6" />
            <p className="text-sm text-[#141414]/40 font-medium">© 2024 מערכת מעקב קמפיין וצ'ופרים. כל הזכויות שמורות.</p>
          </div>
        </footer>

        {/* Global Store Modal */}
        <AnimatePresence>
          {selectedGroup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm overflow-hidden">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white p-0 md:p-8 rounded-none md:rounded-[32px] shadow-2xl max-w-5xl w-full h-full md:h-[90vh] border border-[#141414]/5 overflow-hidden flex flex-col"
              >
                {/* Modal Header */}
                <div className="bg-white border-b border-[#141414]/5 p-6 md:p-0 md:pb-6 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="bg-[#5A5A40] p-3 rounded-2xl text-white shadow-lg shadow-[#5A5A40]/20">
                        <Gift className="w-6 h-6" />
                     </div>
                     <div>
                        <h2 className="text-2xl font-bold">בחירת צ'ופרים עבור {selectedGroup.GroupName}</h2>
                        <p className="text-xs text-[#141414]/40 font-mono">מזהה: #{selectedGroup.ID} • יתרה למימוש: ₪{remainingBudget.toLocaleString()}</p>
                     </div>
                  </div>
                  <button 
                    onClick={() => setSelectedGroupName(null)}
                    className="p-3 bg-[#F5F5F0] hover:bg-red-50 hover:text-red-500 rounded-full transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                  {/* Left Sidebar: Filters & Cart Summary (Large screens) */}
                  <div className="w-full md:w-80 border-l border-[#141414]/5 p-6 overflow-y-auto shrink-0 bg-slate-50/50">
                    <div className="space-y-6">
                      <div className="p-4 bg-white rounded-2xl border border-[#141414]/5 shadow-sm">
                        <div className="flex justify-between items-center mb-1">
                           <p className="text-[10px] text-[#141414]/40 font-bold uppercase tracking-widest">נאסף ע"י המתרים</p>
                           <span className="text-[10px] font-bold text-[#5A5A40]">{selectedGroup.Percentage?.toFixed(1)}%</span>
                        </div>
                        <p className="text-xl font-bold">₪{selectedGroup.TotalAmount.toLocaleString()}</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] text-[#141414]/40 font-bold uppercase tracking-widest px-1">חיפוש מהיר</p>
                        <div className="relative">
                          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#141414]/40 w-4 h-4" />
                          <input
                            type="text"
                            placeholder="חפש צ'ופר..."
                            className="w-full bg-white border border-[#141414]/10 rounded-xl py-3 pr-10 pl-4 text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                            value={searchReward}
                            onChange={(e) => setSearchReward(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-[#141414]/5 shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                           <h3 className="text-sm font-bold">סגל צ'ופרים</h3>
                           <button 
                            onClick={() => setShowAllRewards(!showAllRewards)}
                            className={`text-[9px] font-bold px-2 py-1 rounded-lg transition-all ${showAllRewards ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] text-[#5A5A40]'}`}
                          >
                            {showAllRewards ? "זכאים" : "כל הסגל"}
                          </button>
                        </div>

                        {/* Payment Toggle - only shown if cart has paid items or if relevant */}
                        {((cart.length > 0 && cart.some(i => i.paidInCash)) || (!showAllRewards && rewards.some(r => !shownRewards.includes(r)))) && (
                          <div className="pt-2 border-t border-[#141414]/5">
                            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setIsPaidChecked(!isPaidChecked)}>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isPaidChecked ? 'bg-[#5A5A40] border-[#5A5A40]' : 'bg-[#F5F5F0] border-[#141414]/10'}`}>
                                {isPaidChecked && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-[11px] font-bold group-hover:text-[#5A5A40]">סמן כ"שולם" מראש</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {cart.length > 0 && (
                        <div className="bg-white p-4 rounded-2xl border border-[#141414]/5 shadow-sm">
                           <div className="flex justify-between items-center mb-4">
                             <h3 className="text-sm font-bold">הסל שלך ({cart.length})</h3>
                             <button onClick={() => setCart([])} className="text-[10px] text-red-500 font-bold hover:underline">נקה</button>
                           </div>
                           <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                              {cart.map((item, i) => (
                                <div key={i} className="flex justify-between items-center text-[11px] p-2 bg-[#F5F5F0] rounded-lg">
                                  <span className="truncate flex-1 ml-2">{item.reward.name}</span>
                                  <div className="text-left shrink-0">
                                     <span className="font-bold block">{item.paidInCash ? `₪${item.amountToPay}` : 'חינם'}</span>
                                     {item.paidInCash && <span className={`text-[8px] font-bold ${item.isPaid ? 'text-green-600' : 'text-red-500'}`}>{item.isPaid ? '✓ שולם' : '✘ לא שולם'}</span>}
                                  </div>
                                </div>
                              ))}
                           </div>
                           <button 
                            onClick={handleCheckout}
                            disabled={claiming}
                            className="w-full py-3 bg-[#5A5A40] text-white rounded-xl font-bold hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#5A5A40]/10"
                          >
                            {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                            {"אשר ושלח מימוש"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Main Product Grid */}
                  <div className="flex-1 overflow-y-auto p-6 bg-white">
                    {/* Bonuses Section */}
                    {eligibleBonuses.length > 0 && !searchReward && (
                      <div className="mb-12">
                        <div className="flex items-center gap-3 mb-6">
                           <Sparkles className="w-5 h-5 text-orange-400" />
                           <h3 className="font-bold text-lg">בונוסים שנתקבלו ביעד</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {eligibleBonuses.map(bonus => {
                             const alreadyInCart = cart.some(item => item.reward.id === bonus.id);
                             return (
                               <div key={bonus.id} className="p-5 bg-orange-50 rounded-2xl border border-orange-100 flex flex-col justify-between">
                                 <div>
                                    <div className="flex justify-between items-center mb-2">
                                       <h4 className="font-bold text-orange-900">{bonus.name}</h4>
                                       <span className="bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full text-[10px] font-bold">{bonus.minPercentage}%</span>
                                    </div>
                                    <p className="text-xs text-orange-800/60 mb-6">{bonus.description}</p>
                                 </div>
                                 <button 
                                  onClick={() => handleAddToCart(bonus, 'bonus')}
                                  className={`w-full py-3 rounded-xl font-bold transition-all text-xs ${alreadyInCart ? 'bg-orange-500/10 text-orange-600 border border-orange-200' : 'bg-orange-500 text-white shadow-md'}`}
                                >
                                  {alreadyInCart ? "הוסף בונוס נוסף" : "ממש בונוס"}
                                </button>
                               </div>
                             )
                           })}
                        </div>
                      </div>
                    )}

                    {/* Rewards Grid */}
                    <div className="flex items-center gap-3 mb-6">
                       <Gift className="w-5 h-5 text-blue-500" />
                       <h3 className="font-bold text-lg">קטלוג צ'ופרים</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {shownRewards.map((reward) => {
                          const isEligible = selectedGroup.TotalAmount >= reward.minAmount;
                          const canPayDiff = !isEligible && (reward.minAmount - remainingBudget) <= (totalGoal * 0.1);
                          const alreadyInCart = cart.some(item => item.reward.id === reward.id);
                          const missingAmount = Math.max(0, reward.minAmount - selectedGroup.TotalAmount);

                          return (
                            <div 
                              key={reward.id} 
                              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between h-full ${isEligible || canPayDiff ? 'bg-white border-[#5A5A40]/10 shadow-sm hover:shadow-md' : 'bg-slate-50 border-transparent opacity-60'}`}
                            >
                              <div className="mb-4">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex-1">
                                    <h4 className="font-bold leading-tight mb-1">{reward.name}</h4>
                                    {reward.code && <p className="text-[9px] font-mono text-[#141414]/30">#{reward.code}</p>}
                                  </div>
                                  <div className="text-left shrink-0">
                                    <div className="text-[10px] font-bold text-[#5A5A40] bg-[#5A5A40]/5 px-2 py-0.5 rounded-lg mb-1">יעד ₪{reward.minAmount.toLocaleString()}</div>
                                    <div className="text-[10px] text-[#141414]/40 font-bold">₪{reward.price.toLocaleString()}</div>
                                  </div>
                                </div>
                                <p className="text-xs text-[#141414]/60 leading-relaxed line-clamp-3">{reward.description}</p>
                              </div>
                              
                              <div className="space-y-3">
                                {missingAmount > 0 && (
                                  <div className={`text-[9px] py-1 px-3 rounded-lg font-bold w-full text-center ${canPayDiff ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-500'}`}>
                                    {canPayDiff ? `יתרת זכות: ₪${remainingBudget.toLocaleString()} • חסר ₪${missingAmount.toLocaleString()}` : `חסר ₪${missingAmount.toLocaleString()} ליעד`}
                                  </div>
                                )}
                                
                                {isEligible ? (
                                  <div className="space-y-2">
                                    <button 
                                      onClick={() => handleAddToCart(reward, 'reward')}
                                      className={`w-full py-3 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-2 ${alreadyInCart ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-[#5A5A40] text-white shadow-md'}`}
                                    >
                                      {alreadyInCart && <Check className="w-3 h-3" />}
                                      {alreadyInCart ? "הוסף עוד אחד" : "ממש צ'ופר"}
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <button 
                                      onClick={() => handleAddToCart(reward, 'reward', true)}
                                      disabled={!canPayDiff}
                                      className={`w-full py-3 border rounded-xl font-bold transition-all text-xs overflow-hidden relative ${!canPayDiff ? 'bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed' : alreadyInCart ? 'bg-[#5A5A40]/5 text-[#5A5A40] border-[#5A5A40]' : 'border-[#5A5A40] text-[#5A5A40] hover:bg-[#5A5A40] hover:text-white shadow-sm'}`}
                                    >
                                      <span className="relative z-10">
                                        {alreadyInCart ? "הוסף השלמה נוספת" : `השלם במזומן (₪${Math.round((missingAmount / reward.minAmount) * reward.price)})`}
                                      </span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
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
                <div className="w-16 h-16 rounded-2xl bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center mb-6">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">{confirmModal.title}</h3>
                <p className="text-[#141414]/60 mb-8 leading-relaxed">{confirmModal.message}</p>
                <div className="flex flex-col gap-3">
                  {confirmModal.buttons ? (
                    confirmModal.buttons.map((btn, i) => (
                      <button 
                        key={i}
                        onClick={() => btn.action(false)}
                        className={`w-full py-4 rounded-2xl font-bold transition-all ${
                          btn.variant === 'primary' ? 'bg-[#5A5A40] text-white hover:bg-[#4A4A30]' : 
                          btn.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' :
                          'bg-[#F5F5F0] text-[#141414] hover:bg-[#E4E3E0]'
                        }`}
                      >
                        {btn.text}
                      </button>
                    ))
                  ) : (
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setConfirmModal(null)}
                        className="flex-1 py-4 rounded-2xl font-bold bg-[#F5F5F0] hover:bg-[#E4E3E0] transition-all"
                      >
                        ביטול
                      </button>
                      <button 
                        onClick={() => {
                          confirmModal.onConfirm(false);
                          setConfirmModal(null);
                        }}
                        className="flex-1 py-4 rounded-2xl font-bold bg-[#5A5A40] text-white hover:bg-[#4A4A30] transition-all"
                      >
                        אישור
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-xl text-white font-bold flex items-center gap-3 ${toast.type === 'success' ? 'bg-[#5A5A40]' : 'bg-red-600'}`}
            >
              {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
};

const AppWrapper: React.FC = () => (
  <Router>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  </Router>
);

export default AppWrapper;

import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { Search, TrendingUp, Users, Target, Loader2, AlertCircle, RefreshCw, Gift, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import Admin from "./components/Admin";

interface CampaignData {
  CampaignName?: string;
  TotalAmount?: number;
  TotalGoal?: number;
  CurrencySymbol?: string;
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
  minAmount: number;
  description: string;
}

interface BonusData {
  id: string;
  name: string;
  minPercentage: number;
  description: string;
}

function Dashboard() {
  const [mosad, setMosad] = useState("7011088");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [rewards, setRewards] = useState<RewardData[]>([]);
  const [bonuses, setBonuses] = useState<BonusData[]>([]);
  
  const [searchFundraiser, setSearchFundraiser] = useState("");
  const [searchReward, setSearchReward] = useState("");
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);

  const fetchData = async (targetMosad: string) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch Campaign Data
      const response = await fetch(`/api/campaign/${targetMosad}`);
      const result = await response.json();
      
      if (result.success) {
        setCampaign(result.campaign);
        const processedGroups = (result.groups || []).map((g: any) => {
          const totalAmount = Number(g.TotalAmount || g.Amount || g.Sum || 0);
          const goal = Number(g.Goal || g.Target || g.GoalAmount || 0);
          const groupName = g.GroupName || g.Name || g.Title || "ללא שם";
          const groupId = String(g.ID || g.GroupId || g.Code || g.GroupCode || "");
          
          return {
            ID: groupId,
            GroupName: groupName,
            TotalAmount: totalAmount,
            Goal: goal,
            Percentage: g.Percentage || (goal > 0 ? (totalAmount / goal) * 100 : 0)
          };
        }).sort((a: GroupData, b: GroupData) => b.TotalAmount - a.TotalAmount);
        
        setGroups(processedGroups);
      } else {
        setError(result.error || "Failed to fetch data");
      }

      // Fetch Rewards from Firestore
      const rewardsSnapshot = await getDocs(collection(db, "rewards"));
      const rewardsData = rewardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RewardData));
      setRewards(rewardsData.sort((a, b) => a.minAmount - b.minAmount));

      // Fetch Bonuses from Firestore
      const bonusesSnapshot = await getDocs(collection(db, "goalBonuses"));
      const bonusesData = bonusesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BonusData));
      setBonuses(bonusesData.sort((a, b) => a.minPercentage - b.minPercentage));

    } catch (err) {
      setError("An error occurred while fetching data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(mosad);
  }, []);

  const filteredGroups = groups.filter(g => 
    g.GroupName.toLowerCase().includes(searchFundraiser.toLowerCase()) ||
    g.ID.toLowerCase().includes(searchFundraiser.toLowerCase())
  );

  const selectedGroup = groups.find(g => g.GroupName === selectedGroupName) || (filteredGroups.length === 1 ? filteredGroups[0] : null);

  const eligibleRewards = selectedGroup 
    ? rewards.filter(r => selectedGroup.TotalAmount >= r.minAmount)
    : [];

  const eligibleBonuses = selectedGroup
    ? bonuses.filter(b => (selectedGroup.Percentage || 0) >= b.minPercentage)
    : [];

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

  const totalCollected = groups.reduce((sum, g) => sum + g.TotalAmount, 0);
  const totalGoal = groups.reduce((sum, g) => sum + g.Goal, 0);
  const overallPercentage = totalGoal > 0 ? (totalCollected / totalGoal) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#5A5A40] selection:text-white" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-[#141414]/10 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="bg-[#5A5A40] p-2 rounded-xl">
              <TrendingUp className="text-white w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight">מעקב קמפיין וצ'ופרים</h1>
              <p className="text-xs text-[#141414]/60 font-medium uppercase tracking-wider">
                {campaign?.CampaignName || "טוען נתונים..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#141414]/40 w-4 h-4" />
                <input
                  type="text"
                  placeholder="חיפוש מתרים (שם או קוד)..."
                  className="w-full bg-[#F5F5F0] border-none rounded-full py-2 pr-10 pl-4 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none"
                  value={searchFundraiser}
                  onChange={(e) => setSearchFundraiser(e.target.value)}
                />
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
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl mb-8 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-[32px] shadow-sm border border-[#141414]/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-50 p-2 rounded-lg"><Target className="text-blue-600 w-5 h-5" /></div>
              <span className="text-sm font-semibold text-[#141414]/60 uppercase tracking-wider">סה"כ יעד</span>
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
              <div className="bg-purple-50 p-2 rounded-lg"><Users className="text-purple-600 w-5 h-5" /></div>
              <span className="text-sm font-semibold text-[#141414]/60 uppercase tracking-wider">אחוז ביצוע</span>
            </div>
            <div className="text-3xl font-bold tracking-tighter">{overallPercentage.toFixed(1)}%</div>
            <div className="mt-4 h-2 bg-[#F5F5F0] rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(overallPercentage, 100)}%` }} className="h-full bg-[#5A5A40]" />
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Fundraisers List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold serif italic">רשימת מתרימים</h2>
              <span className="text-sm text-[#141414]/40 font-mono">{filteredGroups.length} נמצאו</span>
            </div>

            <AnimatePresence mode="popLayout">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-[#5A5A40]" />
                  <p className="text-[#141414]/60 font-medium">מעבד נתונים...</p>
                </div>
              ) : filteredGroups.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredGroups.map((group, idx) => {
                    const isSelected = selectedGroup?.GroupName === group.GroupName;
                    // Find rewards this group qualifies for
                    const qualifiedRewards = rewards.filter(r => group.TotalAmount >= r.minAmount);
                    const nextReward = rewards.find(r => group.TotalAmount < r.minAmount);

                    return (
                      <motion.div 
                        key={group.GroupName} 
                        layout 
                        initial={{ opacity: 0, scale: 0.95 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        transition={{ delay: idx * 0.05 }} 
                        onClick={() => setSelectedGroupName(group.GroupName)}
                        className={`bg-white p-5 rounded-2xl border cursor-pointer transition-all group ${isSelected ? 'border-[#5A5A40] ring-2 ring-[#5A5A40]/10 shadow-md' : 'border-[#141414]/5 hover:border-[#5A5A40]/20'}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`font-bold text-lg transition-colors ${isSelected ? 'text-[#5A5A40]' : 'group-hover:text-[#5A5A40]'}`}>{group.GroupName}</h3>
                              <span className="text-[10px] bg-[#F5F5F0] text-[#141414]/40 px-1.5 py-0.5 rounded font-mono">#{group.ID}</span>
                            </div>
                            <p className="text-xs text-[#141414]/40 font-mono uppercase tracking-widest mt-1">יעד: ₪{group.Goal.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-bold tracking-tighter">₪{group.TotalAmount.toLocaleString()}</span>
                            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 block ${(group.Percentage || 0) >= 100 ? 'bg-green-100 text-green-700' : 'bg-[#F5F5F0] text-[#141414]/60'}`}>
                              {(group.Percentage || 0).toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        
                        <div className="relative h-1.5 bg-[#F5F5F0] rounded-full overflow-hidden mb-4">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(group.Percentage || 0, 100)}%` }} className={`h-full transition-all ${(group.Percentage || 0) >= 100 ? 'bg-green-500' : 'bg-[#5A5A40]'}`} />
                        </div>

                        {/* Rewards for this fundraiser */}
                        <div className="space-y-3">
                          <div>
                            <p className="text-[10px] font-bold text-[#141414]/40 uppercase tracking-widest mb-1">צ'ופרי סכום:</p>
                            <div className="flex flex-wrap gap-1">
                              {qualifiedRewards.length > 0 ? (
                                qualifiedRewards.slice(-2).map(r => (
                                  <span key={r.id} className="text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded-lg border border-green-100">✓ {r.name}</span>
                                ))
                              ) : (
                                <span className="text-[10px] text-[#141414]/40 italic">טרם הגיע ליעד</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-[#141414]/20">
                  <Users className="w-12 h-12 text-[#141414]/20 mx-auto mb-4" />
                  <p className="text-[#141414]/40 font-medium">לא נמצאו מתרימים</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Rewards Sidebar */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-[#141414]/5">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Gift className="text-[#5A5A40] w-5 h-5" />
                {selectedGroup ? `צ'ופרים עבור ${selectedGroup.GroupName}` : "בדיקת זכאות לצ'ופרים"}
              </h2>
              
              {!selectedGroup ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-[#141414]/10 mx-auto mb-4" />
                  <p className="text-sm text-[#141414]/40">בחר מתרים מהרשימה כדי לראות את הצ'ופרים וההנחות המגיעים לו.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Absolute Rewards */}
                  {filteredRewards.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-[#141414]/40 uppercase tracking-widest mb-3">צ'ופרים שהושגו (₪)</h3>
                      <div className="space-y-3">
                        {filteredRewards.map((reward) => (
                          <div key={reward.id} className="p-3 bg-green-50 rounded-xl border border-green-100">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex flex-col">
                                <h4 className="font-bold text-xs text-green-900">{reward.name}</h4>
                                <span className="text-[8px] text-green-600 font-mono">קוד: {reward.id.slice(-6).toUpperCase()}</span>
                              </div>
                              <span className="text-[9px] font-bold bg-green-600 text-white px-2 py-0.5 rounded-full">₪{reward.minAmount.toLocaleString()}</span>
                            </div>
                            <p className="text-[9px] text-green-700 leading-relaxed">{reward.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Percentage Bonuses */}
                  {filteredBonuses.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-[#141414]/40 uppercase tracking-widest mb-3">הנחות יעד שהושגו (%)</h3>
                      <div className="space-y-3">
                        {filteredBonuses.map((bonus) => (
                          <div key={bonus.id} className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex flex-col">
                                <h4 className="font-bold text-xs text-purple-900">{bonus.name}</h4>
                                <span className="text-[8px] text-purple-600 font-mono">קוד: {bonus.id.slice(-6).toUpperCase()}</span>
                              </div>
                              <span className="text-[9px] font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">{bonus.minPercentage}%</span>
                            </div>
                            <p className="text-[9px] text-purple-700 leading-relaxed">{bonus.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(filteredRewards.length === 0 && filteredBonuses.length === 0) && (
                    <div className="text-center py-8 bg-[#F5F5F0] rounded-2xl">
                      <p className="text-xs text-[#141414]/40 italic">המתרים טרם הגיע ליעד המזכה בצ'ופר.</p>
                    </div>
                  )}

                  {/* Next Reward Hint */}
                  {selectedGroup && (
                    <div className="pt-4 border-t border-[#141414]/5">
                      {rewards.find(r => selectedGroup.TotalAmount < r.minAmount) && (
                        <p className="text-[10px] text-[#141414]/60">
                          היעד הבא לצ'ופר: <span className="font-bold">₪{rewards.find(r => selectedGroup.TotalAmount < r.minAmount)?.minAmount.toLocaleString()}</span>
                          (חסר עוד ₪{(rewards.find(r => selectedGroup.TotalAmount < r.minAmount)!.minAmount - selectedGroup.TotalAmount).toLocaleString()})
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}

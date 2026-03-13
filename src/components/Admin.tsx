import React, { useState, useEffect, useRef } from "react";
import { auth, db, googleProvider } from "../firebase";
import { signInWithPopup, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, writeBatch, doc, addDoc, deleteDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { Upload, LogIn, ShieldCheck, AlertCircle, Loader2, Trash2, FileSpreadsheet, Sparkles, Send, Bot } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, Type } from "@google/genai";

const ADMIN_EMAIL = "yj3302006@gmail.com";

interface Message {
  role: "user" | "model";
  text: string;
}

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [rewards, setRewards] = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [campaignData, setCampaignData] = useState<any>(null);
  const [showDataViewer, setShowDataViewer] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: "reward" | "bonus"; name: string } | null>(null);
  
  // AI Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ name: string; args: any } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u && u.email === ADMIN_EMAIL) {
        fetchData();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchData = async () => {
    const rewardsSnap = await getDocs(collection(db, "rewards"));
    const rData = rewardsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setRewards(rData);

    const bonusesSnap = await getDocs(collection(db, "goalBonuses"));
    const bData = bonusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setBonuses(bData);

    // Also fetch campaign data for AI context
    try {
      const res = await fetch("/api/campaign/7011088"); // Default mosad
      const result = await res.json();
      if (result.success) {
        setCampaignData(result);
      }
    } catch (e) {
      console.error("Failed to fetch campaign data for AI", e);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping || pendingAction) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3.1-pro-preview";
      
      const context = {
        campaign: campaignData?.campaign,
        fundraisers: campaignData?.groups?.map((g: any) => ({
          id: g.ID || g.GroupId || g.Code || g.GroupCode,
          name: g.GroupName || g.Name,
          collected: g.TotalAmount || g.Amount,
          goal: g.Goal,
          percentage: g.Percentage
        })),
        rewardRules: rewards.map(r => ({ name: r.name, min: r.minAmount })),
        bonusRules: bonuses.map(b => ({ name: b.name, minPct: b.minPercentage }))
      };

      const systemInstruction = `אתה עוזר בינה מלאכותית למנהל קמפיין התרמה. 
נתוני הקמפיין הנוכחיים: ${JSON.stringify(context)}.
תפקידך לנתח את החשבונות, לזהות מתרימים מצטיינים, ולנהל את חוקי המחשבון (צ'ופרים והנחות).
אתה יכול להוסיף הנחות יעד (בונוסים לפי אחוזים) או צ'ופרים (לפי סכום) ישירות למערכת לפי פקודות המשתמש.
לדוגמה: "תוסיף הנחה של 10% למי שמגיע ל-120% יעד".
ענה בעברית בצורה מקצועית ומעודדת.`;

      const tools = [
        {
          functionDeclarations: [
            {
              name: "addGoalBonus",
              description: "הוספת הנחת יעד חדשה למערכת (בונוס לפי אחוז ביצוע)",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "שם ההנחה (למשל: הנחת 10% יעד)" },
                  minPercentage: { type: Type.NUMBER, description: "אחוז היעד המינימלי הנדרש (למשל: 120)" },
                  description: { type: Type.STRING, description: "תיאור קצר של ההנחה" }
                },
                required: ["name", "minPercentage", "description"]
              }
            },
            {
              name: "addReward",
              description: "הוספת צ'ופר חדש למערכת (לפי סכום כספי שנאסף)",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "שם הצ'ופר" },
                  minAmount: { type: Type.NUMBER, description: "סכום מינימלי הנדרש (בשקלים)" },
                  description: { type: Type.STRING, description: "תיאור הצ'ופר" }
                },
                required: ["name", "minAmount", "description"]
              }
            }
          ]
        }
      ];

      const response = await ai.models.generateContent({
        model,
        contents: [...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })), { role: "user", parts: [{ text: userMessage }] }],
        config: { systemInstruction, tools }
      });

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        setPendingAction({ name: call.name, args: call.args });
        
        let explanation = "";
        if (call.name === "addGoalBonus") {
          explanation = `אני הולך להוסיף הנחת יעד חדשה: **${call.args.name}**. 
ההנחה תינתן למי שיגיע ל-**${call.args.minPercentage}%** מהיעד שלו.
תיאור: ${call.args.description}`;
        } else if (call.name === "addReward") {
          explanation = `אני הולך להוסיף צ'ופר חדש: **${call.args.name}**. 
הצ'ופר יינתן למי שיאסוף לפחות **₪${Number(call.args.minAmount).toLocaleString()}**.
תיאור: ${call.args.description}`;
        }
        
        setMessages(prev => [...prev, { role: "model", text: explanation + "\n\nהאם לאשר את הפעולה?" }]);
      } else {
        const aiText = response.text || "מצטער, לא הצלחתי לעבד את הבקשה.";
        setMessages(prev => [...prev, { role: "model", text: aiText }]);
      }
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: "model", text: "אירעה שגיאה בתקשורת עם הבינה המלאכותית." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;
    setIsTyping(true);
    try {
      if (pendingAction.name === "addGoalBonus") {
        const { name, minPercentage, description } = pendingAction.args;
        await addDoc(collection(db, "goalBonuses"), { name, minPercentage, description });
        setMessages(prev => [...prev, { role: "model", text: "הפעולה אושרה ובוצעה בהצלחה! הנחת היעד נוספה למערכת." }]);
      } else if (pendingAction.name === "addReward") {
        const { name, minAmount, description } = pendingAction.args;
        await addDoc(collection(db, "rewards"), { name, minAmount, description });
        setMessages(prev => [...prev, { role: "model", text: "הפעולה אושרה ובוצעה בהצלחה! הצ'ופר נוסף למערכת." }]);
      }
      await fetchData();
    } catch (error) {
      console.error("Execution error:", error);
      setMessages(prev => [...prev, { role: "model", text: "אירעה שגיאה בביצוע הפעולה." }]);
    } finally {
      setPendingAction(null);
      setIsTyping(false);
    }
  };

  const cancelPendingAction = () => {
    setPendingAction(null);
    setMessages(prev => [...prev, { role: "model", text: "הפעולה בוטלה לבקשתך." }]);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const collectionName = confirmDelete.type === "reward" ? "rewards" : "goalBonuses";
      await deleteDoc(doc(db, collectionName, confirmDelete.id));
      await fetchData();
      setConfirmDelete(null);
    } catch (error) {
      console.error("Delete failed", error);
      alert("המחיקה נכשלה");
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
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
      
      // Check if it's percentage bonuses or absolute rewards
      const isPercentage = data.some((item: any) => item.minPercentage || item.MinPercentage);
      if (isPercentage) {
        await saveBonuses(data);
      } else {
        await saveRewards(data);
      }
    };
    reader.readAsBinaryString(file);
  };

  const saveBonuses = async (data: any[]) => {
    setUploading(true);
    try {
      const batch = writeBatch(db);
      const existing = await getDocs(collection(db, "goalBonuses"));
      existing.docs.forEach(d => batch.delete(d.ref));

      data.forEach((item) => {
        const bonusRef = doc(collection(db, "goalBonuses"));
        batch.set(bonusRef, {
          name: item.name || item.Name || "הנחה/צ'ופר יעד",
          minPercentage: Number(item.minPercentage || item.MinPercentage || 0),
          description: item.description || item.Description || ""
        });
      });

      await batch.commit();
      await fetchData();
      alert("הנחות היעד הועלו בהצלחה!");
    } catch (error) {
      console.error("Bonus upload failed", error);
      alert("העלאת הנחות נכשלה");
    } finally {
      setUploading(false);
    }
  };

  const saveRewards = async (data: any[]) => {
    setUploading(true);
    try {
      const batch = writeBatch(db);
      const existing = await getDocs(collection(db, "rewards"));
      existing.docs.forEach(d => batch.delete(d.ref));

      data.forEach((item) => {
        const rewardRef = doc(collection(db, "rewards"));
        batch.set(rewardRef, {
          name: item.name || item.Name || "ללא שם",
          minAmount: Number(item.minAmount || item.Goal || item.Amount || 0),
          description: item.description || item.Description || "",
          category: item.category || item.Category || ""
        });
      });

      await batch.commit();
      await fetchData();
      alert("הצ'ופרים הועלו בהצלחה!");
    } catch (error) {
      console.error("Upload failed", error);
      alert("העלאה נכשלה");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <Loader2 className="w-10 h-10 animate-spin text-[#5A5A40]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] p-4" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[32px] shadow-xl max-w-md w-full text-center border border-[#141414]/5"
        >
          <ShieldCheck className="w-16 h-16 text-[#5A5A40] mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">כניסת מנהל</h1>
          <p className="text-[#141414]/60 mb-8">אנא התחבר עם חשבון גוגל המורשה</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-[#4A4A30] transition-all"
          >
            <LogIn className="w-5 h-5" />
            התחבר עם Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] p-4" dir="rtl">
        <div className="bg-white p-8 rounded-[32px] shadow-xl max-w-md w-full text-center border border-red-100">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2 text-red-600">גישה נדחתה</h1>
          <p className="text-[#141414]/60 mb-8">אין לך הרשאות ניהול למערכת זו.</p>
          <button onClick={() => auth.signOut()} className="text-[#5A5A40] font-bold underline">התנתק</button>
        </div>
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
            <button 
              onClick={() => setShowDataViewer(!showDataViewer)}
              className="flex items-center gap-2 bg-[#5A5A40]/10 text-[#5A5A40] px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#5A5A40]/20 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {showDataViewer ? "חזור לניהול" : "צפייה בפרמטרים וחשבונות"}
            </button>
            <span className="text-sm text-[#141414]/60">{user.email}</span>
            <button onClick={() => auth.signOut()} className="text-xs font-bold uppercase tracking-widest hover:text-red-500 transition-colors">התנתק</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {showDataViewer ? (
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <Bot className="w-6 h-6 text-[#5A5A40]" />
                  חשבונות קמפיין (מתרימים)
                </h2>
                <div className="overflow-x-auto">
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
                      {campaignData?.groups?.map((g: any, i: number) => (
                        <tr key={i} className="border-b border-[#141414]/5 last:border-0">
                          <td className="py-4 font-mono text-xs text-[#141414]/40">#{g.ID || g.GroupId || g.Code || g.GroupCode}</td>
                          <td className="py-4 font-bold">{g.GroupName || g.Name}</td>
                          <td className="py-4">₪{(g.TotalAmount || g.Amount).toLocaleString()}</td>
                          <td className="py-4">₪{g.Goal.toLocaleString()}</td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded-lg font-bold text-xs ${g.Percentage >= 100 ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                              {g.Percentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
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
                            <h3 className="font-bold text-sm">{reward.name}</h3>
                            <span className="text-[10px] text-[#141414]/30 font-mono">#{reward.id.slice(-4).toUpperCase()}</span>
                          </div>
                          <p className="text-xs text-[#141414]/40">₪{reward.minAmount.toLocaleString()}</p>
                        </div>
                        <button 
                          onClick={() => setConfirmDelete({ id: reward.id, type: "reward", name: reward.name })}
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
                            <h3 className="font-bold text-sm">{bonus.name}</h3>
                            <span className="text-[10px] text-[#141414]/30 font-mono">#{bonus.id.slice(-4).toUpperCase()}</span>
                          </div>
                          <p className="text-xs text-[#141414]/40">{bonus.minPercentage}% יעד</p>
                        </div>
                        <button 
                          onClick={() => setConfirmDelete({ id: bonus.id, type: "bonus", name: bonus.name })}
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
          ) : (
            <>
              <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <Upload className="w-6 h-6 text-[#5A5A40]" />
                  העלאת טבלאות
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="p-4 bg-[#F5F5F0] rounded-2xl">
                    <h3 className="font-bold mb-2">צ'ופרים (לפי סכום)</h3>
                    <p className="text-xs text-[#141414]/60">עמודות: name, minAmount, description</p>
                  </div>
                  <div className="p-4 bg-[#F5F5F0] rounded-2xl">
                    <h3 className="font-bold mb-2">הנחות/בונוסים (לפי יעד %)</h3>
                    <p className="text-xs text-[#141414]/60">עמודות: name, minPercentage, description</p>
                  </div>
                </div>
                
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-[#141414]/10 rounded-[32px] cursor-pointer hover:bg-[#F5F5F0] transition-all group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {uploading ? (
                      <Loader2 className="w-12 h-12 text-[#5A5A40] animate-spin mb-4" />
                    ) : (
                      <FileSpreadsheet className="w-12 h-12 text-[#141414]/20 group-hover:text-[#5A5A40] mb-4 transition-colors" />
                    )}
                    <p className="mb-2 text-sm text-[#141414]/60"><span className="font-bold">לחץ להעלאה</span> או גרור קובץ לכאן</p>
                    <p className="text-xs text-[#141414]/40">המערכת תזהה אוטומטית את סוג הטבלה</p>
                  </div>
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={uploading} />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                  <h2 className="text-xl font-bold mb-6">צ'ופרי סכום ({rewards.length})</h2>
                  <div className="space-y-4">
                    {rewards.map((reward) => (
                      <div key={reward.id} className="p-4 bg-[#F5F5F0] rounded-2xl">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-sm">{reward.name}</h3>
                          <span className="bg-[#5A5A40] text-white px-2 py-0.5 rounded-full text-[10px] font-bold">₪{reward.minAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
                  <h2 className="text-xl font-bold mb-6">הנחות יעד ({bonuses.length})</h2>
                  <div className="space-y-4">
                    {bonuses.map((bonus) => (
                      <div key={bonus.id} className="p-4 bg-[#F5F5F0] rounded-2xl">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-sm">{bonus.name}</h3>
                          <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">{bonus.minPercentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* AI Assistant Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-[32px] shadow-sm border border-[#141414]/5 h-[calc(100vh-160px)] flex flex-col sticky top-24 overflow-hidden">
            <div className="p-6 border-b border-[#141414]/5 bg-[#5A5A40]/5 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#5A5A40] rounded-2xl flex items-center justify-center">
                <Sparkles className="text-white w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold">עוזר AI חכם</h2>
                <p className="text-[10px] text-[#5A5A40] font-bold uppercase tracking-widest">ניתוח נתוני קמפיין</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <Bot className="w-12 h-12 text-[#141414]/10 mx-auto mb-4" />
                  <p className="text-sm text-[#141414]/40">שלום! אני כאן כדי לעזור לך לנהל את חוקי המחשבון ולנתח נתונים. מה תרצה לעשות?</p>
                  <div className="mt-6 space-y-2">
                    <p className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-widest text-right mb-2">פקודות מחשבון (דוגמאות):</p>
                    <button onClick={() => setInput("תוסיף הנחה של 10% למי שמגיע ל-120% יעד")} className="block w-full text-right text-xs p-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors border border-purple-100">תוסיף הנחה של 10% למי שמגיע ל-120% יעד</button>
                    <button onClick={() => setInput("תוסיף צ'ופר 'ארוחת ערב' למי שאסף 5000 שקל")} className="block w-full text-right text-xs p-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors border border-green-100">תוסיף צ'ופר 'ארוחת ערב' למי שאסף 5000 שקל</button>
                    
                    <p className="text-[10px] font-bold text-[#141414]/40 uppercase tracking-widest text-right mt-4 mb-2">ניתוח נתונים:</p>
                    <button onClick={() => setInput("מי המתרים המוביל כרגע?")} className="block w-full text-right text-xs p-2 bg-[#F5F5F0] rounded-lg hover:bg-[#5A5A40]/10 transition-colors">מי המתרים המוביל כרגע?</button>
                    <button onClick={() => setInput("מי זקוק לעידוד?")} className="block w-full text-right text-xs p-2 bg-[#F5F5F0] rounded-lg hover:bg-[#5A5A40]/10 transition-colors">מי זקוק לעידוד?</button>
                  </div>
                </div>
              )}
              
              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
                  >
                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                      m.role === "user" 
                        ? "bg-[#F5F5F0] text-[#141414] rounded-tr-none" 
                        : "bg-[#5A5A40] text-white rounded-tl-none"
                    }`}>
                      {m.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isTyping && (
                <div className="flex justify-end">
                  <div className="bg-[#5A5A40] text-white p-4 rounded-2xl rounded-tl-none">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}

              {pendingAction && !isTyping && (
                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    onClick={executePendingAction}
                    className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition-colors"
                  >
                    אשר ביצוע
                  </button>
                  <button 
                    onClick={cancelPendingAction}
                    className="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-600 transition-colors"
                  >
                    בטל
                  </button>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 border-t border-[#141414]/5 bg-white">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder={pendingAction ? "אנא אשר או בטל את הפעולה..." : "שאל את ה-AI..."}
                  disabled={!!pendingAction}
                  className="w-full bg-[#F5F5F0] border-none rounded-2xl py-3 pr-4 pl-12 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 transition-all outline-none disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isTyping || !!pendingAction}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#5A5A40] text-white rounded-xl flex items-center justify-center hover:bg-[#4A4A30] transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white p-8 rounded-[32px] shadow-2xl max-w-sm w-full text-center border border-[#141414]/5"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">אישור מחיקה</h3>
              <p className="text-[#141414]/60 mb-8">האם אתה בטוח שברצונך למחוק את **{confirmDelete.name}**? פעולה זו אינה ניתנת לביטול.</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleDelete}
                  className="bg-red-500 text-white py-3 rounded-2xl font-bold hover:bg-red-600 transition-all"
                >
                  מחק לצמיתות
                </button>
                <button 
                  onClick={() => setConfirmDelete(null)}
                  className="bg-[#F5F5F0] text-[#141414] py-3 rounded-2xl font-bold hover:bg-[#141414]/5 transition-all"
                >
                  ביטול
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

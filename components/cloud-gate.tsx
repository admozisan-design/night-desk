"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {cloudClient,cloudConfigured,cloudStoreId,startCloudSync,stopCloudSync,cloudRole,setCloudRole} from "@/lib/cloud";

type Step="loading"|"login"|"waiting"|"ready"|"error";
type Member={store_id:string;role:"admin"|"staff"};
export function CloudGate({children}:{children:ReactNode}){
  const path=usePathname();
  const [user,setUser]=useState<User|null>(null);
  const [step,setStep]=useState<Step>("loading");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [register,setRegister]=useState(false);
  const [busy,setBusy]=useState(false);
  const [retry,setRetry]=useState(0);
  const [storeName,setStoreName]=useState("");
  const [memberships,setMemberships]=useState<Member[]>([]);
  const [isOwner,setIsOwner]=useState(false);

  useEffect(()=>{
    if(!cloudConfigured || !cloudClient) return;
    let alive=true;
    cloudClient.auth.getUser().then(({data,error})=>{
      if(!alive) return;
      if(error && error.status!==400) setError(error.message);
      setUser(data.user??null);
      if(!data.user) setStep("login");
    }).catch(err=>{
      if(alive){setError(err instanceof Error?err.message:"認証情報を取得できません");setStep("error");}
    });
    const {data:{subscription}}=cloudClient.auth.onAuthStateChange((event,session)=>{
      if(!alive) return;
      if(event==="SIGNED_OUT"){
        setUser(null);setStep("login");setMemberships([]);setIsOwner(false);
        void stopCloudSync(true);
      }else if(session?.user){
        setUser(session.user);
      }
    });
    return ()=>{alive=false;subscription.unsubscribe();};
  },[]);

  useEffect(()=>{
    if(!cloudConfigured || !cloudClient || !user) return;
    const client=cloudClient;
    let alive=true;
    setStep("loading");setError("");
    (async()=>{
      // The owner is recognized server-side by auth user ID; never by a
      // user-editable email value or a client-side administrator switch.
      const own=await client.rpc("nightdesk_is_owner");
      if(own.error) throw own.error;
      const isPlatformOwner=own.data===true;
      if(alive)setIsOwner(isPlatformOwner);

      let memberships:Member[];
      if(isPlatformOwner){
        // Owner can manage every store, even without explicit membership.
        const {data,error}=await client.from("nightdesk_stores")
          .select("id").order("created_at",{ascending:true});
        if(error) throw error;
        memberships=(data??[]).map(store=>({store_id:store.id as string,role:"admin" as const}));
      }else{
        const {data,error}=await client.from("nightdesk_memberships")
          .select("store_id,role").eq("user_id",user.id);
        if(error) throw error;
        memberships=(data??[]) as Member[];
        // Non-owners must have exactly one home store. Never silently pick
        // among unexpected extra memberships, even if RLS is misconfigured.
        if(memberships.length>1) throw new Error("複数店舗のアクセス権が検出されました。管理者にお問い合わせください。");
      }
      if(!alive) return;
      setMemberships(memberships);
      if(!memberships.length){
        // A removed employee must never keep seeing a previous store cache.
        await stopCloudSync(true);
        if(alive)setStep("waiting");
        return;
      }
      const wanted=isPlatformOwner?localStorage.getItem("nightdesk-current-store"):null;
      const member=(isPlatformOwner?memberships.find(m=>m.store_id===wanted):null)??memberships[0];
      localStorage.setItem("nightdesk-current-store",member.store_id);
      await startCloudSync(member.store_id);
      setCloudRole(isPlatformOwner?"owner":member.role);
      if(alive)setStep("ready");
    })().catch(err=>{
      if(alive){setError(err instanceof Error?err.message:"店舗データを読み込めませんでした");setStep("error");}
    });
    return ()=>{alive=false;};
  },[user?.id,retry]);

  // Membership revocation/role changes are checked on tab return and every
  // minute. RLS immediately denies remote access; this also clears the
  // previous employee's browser cache if their assignment was removed.
  useEffect(()=>{
    if(!cloudConfigured || !cloudClient || !user || step!=="ready" || isOwner) return;
    const client=cloudClient;
    let disposed=false;
    let checking=false;
    async function verifyMembership(){
      if(checking || disposed) return;
      checking=true;
      try{
        const {data,error}=await client.from("nightdesk_memberships")
          .select("store_id,role").eq("user_id",user!.id).limit(2);
        if(error) throw error;
        if(disposed) return;
        const next=(data??[]) as Member[];
        if(next.length!==1 || next[0].store_id!==cloudStoreId()){
          await stopCloudSync(true);
          if(disposed) return;
          setMemberships(next);
          setError(next.length?"所属店舗を再確認できません。管理者にお問い合わせください。":"所属店舗のアクセス権が解除されました。");
          setStep(next.length?"error":"waiting");
          return;
        }
        setMemberships(next);
        setCloudRole(next[0].role);
      }catch(err){
        if(disposed) return;
        await stopCloudSync(true);
        if(disposed) return;
        setError(err instanceof Error?err.message:"アクセス権の確認に失敗しました。");
        setStep("error");
      }finally{checking=false;}
    }
    const onVisibility=()=>{if(document.visibilityState==="visible")void verifyMembership();};
    const interval=window.setInterval(()=>void verifyMembership(),60_000);
    document.addEventListener("visibilitychange",onVisibility);
    return ()=>{disposed=true;window.clearInterval(interval);document.removeEventListener("visibilitychange",onVisibility);};
  },[user?.id,step,isOwner]);

  async function login(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!cloudClient)return;
    setBusy(true);setError("");setNotice("");
    const form=new FormData(e.currentTarget);
    const email=String(form.get("email")??"").trim();
    const password=String(form.get("password")??"");
    try{
      if(password.length<8) throw new Error("パスワードは8文字以上にしてください。");
      if(register){
        const {data,error}=await cloudClient.auth.signUp({email,password});
        if(error) throw error;
        if(!data.session) setNotice("確認メールを送信しました。メール内のリンクから認証してログインしてください。");
        else setUser(data.user);
      }else{
        const {data,error}=await cloudClient.auth.signInWithPassword({email,password});
        if(error) throw error;
        setUser(data.user);
      }
    }catch(err){
      setError(err instanceof Error?err.message:"ログインに失敗しました");
    }finally{setBusy(false);}
  }

  async function createStore(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!cloudClient)return;
    setBusy(true);setError("");
    try{
      const {data,error}=await cloudClient.rpc("nightdesk_create_store",{p_name:storeName.trim()});
      if(error) throw error;
      if(typeof data!=="string") throw new Error("店舗を作成できませんでした。");
      localStorage.setItem("nightdesk-current-store",data);
      setRetry(n=>n+1);
    }catch(err){
      setError(err instanceof Error?err.message:"店舗の作成に失敗しました。");
    }finally{setBusy(false);}
  }

  async function signOut(){
    await stopCloudSync(true);
    await cloudClient?.auth.signOut();
    setStep("login");setUser(null);setIsOwner(false);
  }

  if(!cloudConfigured) return <>{children}</>;
  if(step==="ready" && cloudStoreId()){
    const adminOnly=["/store","/pricing","/permissions","/staff",
      "/settings/team","/settings/backups","/settings/menu","/settings/dispatch","/settings/data"];
    const restricted=(cloudRole()==="staff" &&
      adminOnly.some(prefix=>path===prefix || path.startsWith(prefix+"/")))
      || ((path==="/owner" || path.startsWith("/owner/")) && cloudRole()!=="owner");
    if(restricted) return <div className="cloudGate">
      <div className="cloudGateCard">
        <h2>管理者専用の設定です</h2>
        <p>この操作には店舗管理者のログイン権限が必要です。</p>
        <a href="/" className="cloudGatePrimary" style={{display:"grid",placeItems:"center",textDecoration:"none"}}>配車管理に戻る</a>
      </div>
    </div>;
    return <>{children}</>;
  }

  return <div className="cloudGate">
    <div className="cloudGateCard">
      <div className="cloudGateLogo">N</div>
      <h1>NIGHT DESK</h1>
      {step==="loading" && <>
        <p>店舗データとアカウントを安全に読み込み中…</p>
        <div className="cloudGateLoader"/>
      </>}
      {step==="login" && <>
        <h2>{register?"アカウント登録":"スタッフログイン"}</h2>
        <p>承認されたスタッフだけが店舗データを閲覧・編集できます。</p>
        <form onSubmit={e=>void login(e)}>
          <label>メールアドレス<input name="email" type="email" required autoComplete="email" placeholder="staff@example.com"/></label>
          <label>パスワード<input name="password" type="password" required minLength={8} autoComplete={register?"new-password":"current-password"} placeholder="8文字以上"/></label>
          <button type="submit" className="cloudGatePrimary" disabled={busy}>{busy?"処理中…":register?"アカウント登録":"ログイン"}</button>
        </form>
        <button type="button" className="cloudGateTextButton" onClick={()=>{setRegister(!register);setError("");setNotice("");}}>
          {register?"ログイン画面に戻る":"初めて利用する方：アカウント登録"}
        </button>
      </>}
      {step==="waiting" && <>
        <h2>店舗へのアクセス設定</h2>
        <p>ログイン中：<strong>{user?.email}</strong></p>
        <div className="cloudGateHelp">
          {isOwner
            ? "システムオーナーとして認証されました。最初の店舗を作成してください。"
            : "担当店舗の店長にこのメールアドレスを伝えてください。アクセス許可後、下のボタンから確認できます。"}
        </div>
        <button type="button" className="cloudGatePrimary" disabled={busy} onClick={()=>setRetry(n=>n+1)}>アクセスを確認</button>
        {isOwner && <form className="cloudGateNewStore" onSubmit={e=>void createStore(e)}>
          <h3>新しい店舗の管理者として開始する</h3>
          <label>店舗名<input value={storeName} required maxLength={100} onChange={e=>setStoreName(e.target.value)} placeholder="例：NIGHT DESK 本店"/></label>
          <button type="submit" disabled={busy || !storeName.trim()}>専用店舗を作成</button>
          <small>新しい店舗はデータが空の状態で作成されます。</small>
        </form>}
        <button type="button" className="cloudGateTextButton" onClick={()=>void signOut()}>ログアウト</button>
      </>}
      {step==="error" && <>
        <h2>クラウド接続を確認してください</h2>
        <p>店舗データが読み込めない間は、安全のため編集画面を開きません。</p>
        <button type="button" className="cloudGatePrimary" onClick={()=>setRetry(n=>n+1)}>再接続する</button>
        <button type="button" className="cloudGateTextButton" onClick={()=>void signOut()}>ログアウト</button>
      </>}
      {error && <div className="cloudGateError" role="alert">{error}</div>}
      {notice && <div className="cloudGateSuccess" role="status">{notice}</div>}
      {memberships.length>1 && step==="error" && <p>アクセス可能な店舗数：{memberships.length}</p>}
    </div>
  </div>;
}

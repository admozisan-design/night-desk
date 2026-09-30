"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {cloudClient,cloudConfigured,cloudStoreId,downloadPreCloudBackup,hasPreCloudBackup,startCloudSync,stopCloudSync,cloudRole,setCloudRole} from "@/lib/cloud";

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
        setUser(null);setStep("login");setMemberships([]);
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
      const {data,error}=await client.from("nightdesk_memberships")
        .select("store_id,role").eq("user_id",user.id);
      if(error) throw error;
      if(!alive) return;
      const memberships=(data??[]) as Member[];
      setMemberships(memberships);
      if(!memberships.length){
        setStep("waiting");return;
      }
      const wanted=localStorage.getItem("nightdesk-current-store");
      const member=memberships.find(m=>m.store_id===wanted)??memberships[0];
      localStorage.setItem("nightdesk-current-store",member.store_id);
      setCloudRole(member.role);
      await startCloudSync(member.store_id);
      if(alive)setStep("ready");
    })().catch(err=>{
      if(alive){setError(err instanceof Error?err.message:"店舗データを読み込めませんでした");setStep("error");}
    });
    return ()=>{alive=false;};
  },[user?.id,retry]);

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
    setStep("login");setUser(null);
  }

  if(!cloudConfigured) return <>{children}</>;
  if(step==="ready" && cloudStoreId()){
    const adminOnly=["/store","/pricing","/permissions","/staff",
      "/settings/team","/settings/backups","/settings/menu","/settings/dispatch","/settings/data"];
    const restricted=cloudRole()==="staff" &&
      adminOnly.some(prefix=>path===prefix || path.startsWith(prefix+"/"));
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
          既存店舗のスタッフの場合、管理者にこのメールアドレスを伝えて権限を追加してもらってください。
          権限が追加されたら下の更新ボタンを押します。
        </div>
        <button type="button" className="cloudGatePrimary" disabled={busy} onClick={()=>setRetry(n=>n+1)}>アクセスを確認</button>
        <form className="cloudGateNewStore" onSubmit={e=>void createStore(e)}>
          <h3>新しい店舗の管理者として開始する</h3>
          <label>店舗名<input value={storeName} required maxLength={100} onChange={e=>setStoreName(e.target.value)} placeholder="例：NIGHT DESK 本店"/></label>
          <button type="submit" disabled={busy || !storeName.trim()}>専用店舗を作成</button>
          <small>作成したアカウントに管理者権限が付与されます。</small>
        </form>
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
      {hasPreCloudBackup() && <button type="button" className="cloudGateTextButton" onClick={downloadPreCloudBackup}>移行前のブラウザデータを保存（JSON）</button>}
      {memberships.length>1 && step==="error" && <p>アクセス可能な店舗数：{memberships.length}</p>}
    </div>
  </div>;
}

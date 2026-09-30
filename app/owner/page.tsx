"use client";

import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {cloudClient,cloudConfigured,cloudRole,cloudStoreId,stopCloudSync} from "@/lib/cloud";

type Store={id:string;name:string;created_at:string};

export default function OwnerDashboard(){
  const [stores,setStores]=useState<Store[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [storeName,setStoreName]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const isOwner=cloudConfigured && cloudRole()==="owner";

  const refresh=useCallback(async()=>{
    if(!cloudClient)return;
    setError("");
    const own=await cloudClient.rpc("nightdesk_is_owner");
    if(own.error || own.data!==true){
      setError("システムオーナー権限を確認できません。");
      setLoading(false);
      return;
    }
    const {data,error}=await cloudClient.from("nightdesk_stores")
      .select("id,name,created_at").order("created_at",{ascending:false});
    if(error)setError(error.message);
    else setStores((data??[]) as Store[]);
    setLoading(false);
  },[]);

  useEffect(()=>{if(isOwner)void refresh();else setLoading(false);},[isOwner,refresh]);

  async function createStore(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!cloudClient || !isOwner || !storeName.trim())return;
    setBusy(true);setError("");setNotice("");
    try{
      const {data,error}=await cloudClient.rpc("nightdesk_create_store",{p_name:storeName.trim()});
      if(error)throw error;
      if(!data)throw new Error("店舗作成に失敗しました。");
      setStoreName("");
      setNotice("空の店舗を作成しました。必要なら「この店舗を開く」から設定を始められます。");
      await refresh();
    }catch(e){
      setError(e instanceof Error?e.message:"店舗の作成に失敗しました");
    }finally{setBusy(false);}
  }

  async function switchStore(storeId:string){
    if(!isOwner)return;
    if(storeId===cloudStoreId()){window.location.href="/";return;}
    // Stop previous store subscriptions and clear its locally cached data
    // before loading another store. Unsent changes remain in its outbox.
    await stopCloudSync(true);
    localStorage.setItem("nightdesk-current-store",storeId);
    window.location.href="/";
  }

  if(!cloudConfigured)return <div className="panel ownerConsoleNotice">クラウド接続後に利用できます。</div>;
  if(!isOwner)return <div className="panel ownerConsoleNotice">システムオーナーのみ利用できます。</div>;

  return <div className="ownerConsole">
    <header className="pageHeader">
      <div>
        <p className="eyebrow">NIGHT DESK OWNER</p>
        <h1>全店舗管理</h1>
        <p>契約店舗を管理する、システムオーナー専用画面です。</p>
      </div>
    </header>
    <section className="ownerConsoleNotice">
      <strong>システムオーナー</strong>
      <span>各店舗の管理者からは、この画面を開いたりオーナー権限を付与したりできません。</span>
    </section>

    <section className="panel ownerConsolePanel">
      <h2>新しい店舗を作成</h2>
      <p>デモデータは入れず、登録情報が空の状態で新しい店舗を作成します。</p>
      <form className="ownerCreateForm" onSubmit={e=>void createStore(e)}>
        <label>店舗名
          <input type="text" maxLength={100} value={storeName}
            onChange={e=>setStoreName(e.target.value)}
            required placeholder="例：NIGHT DESK 新規契約店"/>
        </label>
        <button type="submit" disabled={busy || !storeName.trim()}>
          {busy?"作成中…":"空の店舗を作成"}
        </button>
      </form>
    </section>

    <section className="panel ownerConsolePanel">
      <div className="ownerConsoleHead">
        <h2>契約店舗一覧</h2>
        <button type="button" onClick={()=>void refresh()}>更新</button>
      </div>
      {loading && <p>店舗情報を読み込み中…</p>}
      {!loading && !stores.length && <p>まだ店舗がありません。</p>}
      <div className="ownerStoreList">{stores.map(store=><article key={store.id}>
        <div className="ownerStoreInfo">
          <strong>{store.name}</strong>
          <small>作成日：{new Date(store.created_at).toLocaleDateString("ja-JP")}</small>
          {cloudStoreId()===store.id && <span className="ownerActiveStore">現在操作中</span>}
        </div>
        <button type="button" disabled={busy} onClick={()=>void switchStore(store.id)}>
          {cloudStoreId()===store.id?"現在の店舗を開く":"この店舗を開く"}
        </button>
        {cloudStoreId()===store.id && <Link href="/settings/team">スタッフ管理</Link>}
      </article>)}</div>
    </section>

    {error && <div className="cloudGateError" role="alert">{error}</div>}
    {notice && <div className="cloudGateSuccess" role="status">{notice}</div>}
  </div>;
}

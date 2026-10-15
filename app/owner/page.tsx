"use client";

import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {cloudClient,cloudConfigured,cloudRole,cloudStoreId,stopCloudSync} from "@/lib/cloud";

type Store={id:string;name:string;created_at:string};
type BackupHealth={
  checkedAt:string;
  expectedDate:string;
  cronSecretConfigured:boolean;
  backupConnection:"ok"|"missing"|"error";
  backupConnectionDetail:"ok"|"missing_key"|"invalid_key"|
    "insufficient_privileges"|"database_unreachable"|"table_unavailable"|"unknown_error";
  backupHistoryTruncated:boolean;
  stores:Array<{id:string;name:string;latestBackup:string|null;latestSavedAt:string|null}>;
};

export default function OwnerDashboard(){
  const [stores,setStores]=useState<Store[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [storeName,setStoreName]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [backupHealth,setBackupHealth]=useState<BackupHealth|null>(null);
  const [backupBusy,setBackupBusy]=useState(false);
  const [backupError,setBackupError]=useState("");
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

  const refreshBackupHealth=useCallback(async()=>{
    if(!cloudClient)return;
    setBackupBusy(true);setBackupError("");
    try{
      const {data:{session},error:sessionError}=await cloudClient.auth.getSession();
      if(sessionError || !session)throw new Error("もう一度ログインしてください");
      const response=await fetch("/api/owner/backup-health",{
        headers:{Authorization:`Bearer ${session.access_token}`},
        cache:"no-store"
      });
      const data=await response.json() as BackupHealth&{error?:string};
      if(!response.ok)throw new Error(data.error??"バックアップ状態を取得できません");
      setBackupHealth(data);
    }catch(e){
      setBackupError(e instanceof Error?e.message:"バックアップ診断に失敗しました");
    }finally{setBackupBusy(false);}
  },[]);

  useEffect(()=>{
    if(isOwner){void refresh();void refreshBackupHealth();}
    else setLoading(false);
  },[isOwner,refresh,refreshBackupHealth]);

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
      await refreshBackupHealth();
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
      <div className="ownerConsoleHead">
        <h2>バックアップ監視</h2>
        <button type="button" disabled={backupBusy} onClick={()=>void refreshBackupHealth()}>
          {backupBusy?"確認中…":"状態を更新"}
        </button>
      </div>
      <p>毎朝5時（日本時間）に実行予定。ここでは保存履歴とサーバー設定を確認できます。</p>
      {!backupHealth && backupBusy && <p>バックアップの状態を読み込み中…</p>}
      {backupError && <div className="cloudGateError" role="alert">{backupError}</div>}
      {backupHealth && <>
        <p>確認日時：{new Date(backupHealth.checkedAt).toLocaleString("ja-JP")} ／ 判定対象：{backupHealth.expectedDate}分</p>
        <div className="ownerStoreList">
          <article>
            <div className="ownerStoreInfo">
              <strong>定期実行の認証設定</strong>
              <small>CRON_SECRET</small>
            </div>
            <strong>{backupHealth.cronSecretConfigured?"設定あり":"未設定・要対応"}</strong>
          </article>
          <article>
            <div className="ownerStoreInfo">
              <strong>バックアップ用データベース接続</strong>
              <small>サーバー内で接続確認（認証情報は表示しません）</small>
              {backupHealth.backupConnection!=="ok" && <small>{
                ({
                  missing_key:"管理用キーの環境変数が未設定です",
                  invalid_key:"認証エラー：接続先プロジェクトの管理用キーを確認してください",
                  insufficient_privileges:"権限不足：管理用キーのロールを確認してください",
                  database_unreachable:"通信エラー：データベースへの接続を確認してください",
                  table_unavailable:"対象テーブルを参照できません",
                  unknown_error:"原因を特定できません。管理者によるサーバー設定の確認が必要です",
                  ok:"正常"
                } as Record<BackupHealth["backupConnectionDetail"],string>)[backupHealth.backupConnectionDetail]
              }</small>}
            </div>
            <strong>{backupHealth.backupConnection==="ok"?"正常":backupHealth.backupConnection==="missing"?"未設定・要対応":"接続エラー・要対応"}</strong>
          </article>
          {backupHealth.stores.map(store=><article key={store.id}>
            <div className="ownerStoreInfo">
              <strong>{store.name}</strong>
              <small>最新バックアップ：{store.latestBackup??"なし"}{store.latestSavedAt?`（${new Date(store.latestSavedAt).toLocaleString("ja-JP")}作成）`:""}</small>
            </div>
            <strong>{store.latestBackup && store.latestBackup>=backupHealth.expectedDate?"保存済み":"未保存・要確認"}</strong>
          </article>)}
        </div>
        {backupHealth.backupHistoryTruncated && <p>保存履歴が多いため一部の店舗を確認できない場合があります。</p>}
        <p>※「保存済み」はその日のデータコピーが存在することを示します。自動実行が成功した証明ではありません。翌朝以降の記録も確認してください。</p>
      </>}
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

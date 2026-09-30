"use client";

import {useEffect,useState} from "react";
import {cloudClient,cloudConfigured,cloudStoreId,downloadPreCloudBackup,hasPreCloudBackup} from "@/lib/cloud";

type Daily={backup_date:string;created_at:string};
type Safety={id:string;created_at:string;restored_from:string};
export default function BackupManagementPage(){
  const storeId=cloudStoreId();
  const [daily,setDaily]=useState<Daily[]>([]);
  const [safety,setSafety]=useState<Safety[]>([]);
  const [admin,setAdmin]=useState(false);
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function refresh(){
    if(!cloudClient || !storeId)return;
    setError("");
    const {data:{user}}=await cloudClient.auth.getUser();
    const member=await cloudClient.from("nightdesk_memberships")
      .select("role").eq("store_id",storeId).eq("user_id",user?.id??"").maybeSingle();
    if(member.error){setError(member.error.message);setReady(true);return;}
    if(member.data?.role!=="admin"){setAdmin(false);setReady(true);return;}
    setAdmin(true);
    const [a,b]=await Promise.all([
      cloudClient.from("nightdesk_backups").select("backup_date,created_at")
        .eq("store_id",storeId).order("backup_date",{ascending:false}).limit(35),
      cloudClient.from("nightdesk_restore_safety").select("id,created_at,restored_from")
        .eq("store_id",storeId).order("created_at",{ascending:false}).limit(20)
    ]);
    if(a.error)setError(a.error.message);else setDaily((a.data??[]) as Daily[]);
    if(b.error)setError(b.error.message);else setSafety((b.data??[]) as Safety[]);
    setReady(true);
  }
  useEffect(()=>{void refresh();},[storeId]);

  async function restore(date:string,safetyId?:string){
    if(!cloudClient || !storeId)return;
    if(!window.confirm(`本当に${date}の状態へ戻しますか？\n現在の店舗データをすべて置き換えます。操作中のスタッフがいないことを確認してください。`))return;
    const check=window.prompt("復元を確定するには「復元」と入力してください。");
    if(check!=="復元")return;
    setBusy(true);setError("");setNotice("");
    const {error}=safetyId
      ? await cloudClient.rpc("nightdesk_restore_safety",{p_store_id:storeId,p_safety_id:safetyId})
      : await cloudClient.rpc("nightdesk_restore_backup",{p_store_id:storeId,p_date:date});
    setBusy(false);
    if(error)setError(error.message);
    else{
      setNotice("データを復元しました。ほかの端末も含め再読み込みしてください。");
      await refresh();
      window.setTimeout(()=>window.location.reload(),1300);
    }
  }

  return <div className="cloudManagePage">
    <header className="pageHeader">
      <div><p className="eyebrow">BACKUP & RESTORE</p><h1>自動バックアップ</h1>
      <p>毎日05:00（日本時間）のバックアップと、復元前の安全コピーを確認できます。</p></div>
    </header>
    {!cloudConfigured && <section className="panel cloudManagePanel">
      <h2>現在はデモモード</h2><p>専用クラウド接続後に自動バックアップが有効になります。</p>
    </section>}
    {cloudConfigured && ready && !admin && <section className="panel cloudManagePanel">
      <p>バックアップの操作は管理者だけが行えます。</p>
    </section>}
    {cloudConfigured && admin && <>
      <section className="panel cloudManagePanel">
        <h2>日次バックアップ（直近30日）</h2>
        <p>クラウドで保存された店舗データのスナップショットです。対象日時を確認してから復元してください。</p>
        {daily.length===0 && <p>バックアップはまだありません。最初の定時実行後に表示されます。</p>}
        <div className="cloudMemberList">{daily.map(row=><div key={row.backup_date}>
          <strong>{row.backup_date}</strong>
          <span>作成 {new Date(row.created_at).toLocaleString("ja-JP")}</span>
          <button type="button" disabled={busy} onClick={()=>void restore(row.backup_date)}>この日に復元</button>
        </div>)}</div>
      </section>
      <section className="panel cloudManagePanel">
        <h2>復元直前の安全コピー</h2>
        <p>復元処理を行う直前のデータも、別途保存します。</p>
        <div className="cloudMemberList">{safety.map(row=><div key={row.id}>
          <strong>{new Date(row.created_at).toLocaleString("ja-JP")}</strong>
          <span>復元元：{row.restored_from}</span>
          <button type="button" disabled={busy} onClick={()=>void restore(row.created_at,row.id)}>この状態に戻す</button>
        </div>)}</div>
      </section>
    </>}
    {hasPreCloudBackup() && <section className="panel cloudManagePanel">
      <h2>クラウド移行前のローカルデータ</h2>
      <p>旧ブラウザ内データの控えをJSONとして保存できます。クラウドへ自動アップロードはされません。</p>
      <button type="button" className="secondaryButton" onClick={downloadPreCloudBackup}>移行前データを保存</button>
    </section>}
    {error && <div role="alert" className="cloudGateError">{error}</div>}
    {notice && <div role="status" className="cloudGateSuccess">{notice}</div>}
  </div>;
}

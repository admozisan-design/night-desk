"use client";

import {useEffect,useState,type FormEvent} from "react";
import {cloudClient,cloudConfigured,cloudStoreId} from "@/lib/cloud";

type Member={user_id:string;email:string;role:"owner"|"admin"|"staff"};
const roleName=(role:Member["role"])=>role==="owner"?"システムオーナー":role==="admin"?"店長":"スタッフ";
export default function CloudTeamPage(){
  const [members,setMembers]=useState<Member[]>([]);
  const [isAdmin,setIsAdmin]=useState(false);
  const [isOwner,setIsOwner]=useState(false);
  const [currentUserId,setCurrentUserId]=useState("");
  const [email,setEmail]=useState("");
  const [role,setRole]=useState<"admin"|"staff">("staff");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [ready,setReady]=useState(false);
  const storeId=cloudStoreId();

  async function refresh(){
    if(!cloudClient || !storeId) return;
    setError("");
    const {data:{user}}=await cloudClient.auth.getUser();
    if(!user){setError("再ログインしてください。");setReady(true);return;}
    setCurrentUserId(user.id);
    const owner=await cloudClient.rpc("nightdesk_is_owner");
    if(owner.error){setError(owner.error.message);setReady(true);return;}
    const ownerAccess=owner.data===true;
    setIsOwner(ownerAccess);
    const {data,error}=await cloudClient.from("nightdesk_memberships")
      .select("role").eq("store_id",storeId).eq("user_id",user.id).maybeSingle();
    if(error){setError(error.message);setReady(true);return;}
    if(!ownerAccess && data?.role!=="admin"){setIsAdmin(false);setReady(true);return;}
    setIsAdmin(true);
    const team=await cloudClient.rpc("nightdesk_team",{p_store_id:storeId});
    if(team.error) setError(team.error.message);
    else setMembers((team.data??[]) as Member[]);
    setReady(true);
  }
  useEffect(()=>{void refresh();},[storeId]);

  async function grant(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!cloudClient || !storeId)return;
    if(role==="admin" && !isOwner)return;
    if(role==="admin"){
      const former=members.find(member=>member.role==="admin" && member.email.toLowerCase()!==email.trim().toLowerCase());
      if(former && !window.confirm("現在の店長を一般スタッフに変更して、新しい店長を任命しますか？"))return;
    }
    setError("");setNotice("");setBusy(true);
    try{
      const {data,error}=await cloudClient.rpc("nightdesk_grant_access",{
        p_store_id:storeId,p_email:email.trim(),p_role:role
      });
      if(error) throw error;
      if(!data) throw new Error("このメールアドレスの確認済みアカウントがありません。先にスタッフにアカウント登録をしてもらってください。");
      setEmail("");setNotice(role==="admin"?"店長を任命しました。":"スタッフのアクセス権を保存しました。");
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:"追加できませんでした。");}
    finally{setBusy(false);}
  }
  async function remove(member:Member){
    if(!cloudClient || !storeId || member.role==="owner"
      || member.user_id===currentUserId || (member.role==="admin" && !isOwner))return;
    if(!window.confirm(`${member.email} の店舗アクセスを取り消しますか？`))return;
    setBusy(true);setError("");
    const {error}=await cloudClient.rpc("nightdesk_remove_member",{
      p_store_id:storeId,p_user_id:member.user_id
    });
    setBusy(false);
    if(error)setError(error.message);
    else{setNotice("アクセス権を取り消しました。");await refresh();}
  }

  return <div className="cloudManagePage">
    <header className="pageHeader">
      <div><p className="eyebrow">STAFF ACCESS</p><h1>クラウド・ログイン管理</h1>
      <p>現在の担当店舗に限ってスタッフのアクセスを管理します。店長は他店舗の情報を閲覧できません。</p></div>
    </header>
    {!cloudConfigured && <section className="panel cloudManagePanel">
      <h2>現在はデモモード</h2><p>Supabaseプロジェクトの接続設定を完了すると利用できます。</p>
    </section>}
    {cloudConfigured && ready && !isAdmin && <section className="panel cloudManagePanel">
      <h2>閲覧できません</h2><p>スタッフの追加・削除はその店舗の店長とシステムオーナーだけが操作できます。</p>
    </section>}
    {cloudConfigured && isAdmin && <>
      <section className="panel cloudManagePanel">
        <h2>スタッフのログイン権限を追加</h2>
        <p>スタッフ本人が先にアカウント登録とメール認証を完了してください。スタッフの追加・削除は店長とオーナーのみ可能です。</p>
        <form onSubmit={e=>void grant(e)} className="cloudManageForm">
          <label>スタッフの登録メール<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="staff@example.com"/></label>
          <label>権限<select value={role} onChange={e=>setRole(e.target.value as "admin"|"staff")}>
            <option value="staff">スタッフ（業務データの閲覧・編集）</option>
            {isOwner && <option value="admin">店長（オーナーのみ任命可能）</option>}
          </select></label>
          <button type="submit" disabled={busy}>アクセスを追加・更新</button>
        </form>
        <small>店長は各店舗1名、担当店舗へのアクセスに限定されます。店長の任命・変更はシステムオーナーだけが行えます。ログイン権限は従来の「スタッフ登録」とは別管理です。</small>
      </section>
      <section className="panel cloudManagePanel">
        <h2>現在のアクセス許可</h2>
        <div className="cloudMemberList">{members.map(member=><div key={member.user_id}>
          <strong>{member.email}</strong>
          <span>{roleName(member.role)}</span>
          {(member.role==="owner" || member.user_id===currentUserId || (member.role==="admin" && !isOwner))
            ? <span>変更不可</span>
            : <button type="button" disabled={busy} onClick={()=>void remove(member)}>アクセス取消</button>}
        </div>)}</div>
      </section>
    </>}
    {error && <p className="cloudGateError" role="alert">{error}</p>}
    {notice && <p className="cloudGateSuccess" role="status">{notice}</p>}
  </div>;
}

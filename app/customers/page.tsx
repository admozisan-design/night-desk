"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { loadCustomers, loadOrders, saveCustomers } from "@/lib/storage";
import type { Customer, Order } from "@/lib/types";

function cloneCustomer(customer:Customer):Customer{return {...customer};}

export default function CustomersPage(){
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [orders,setOrders]=useState<Order[]>([]);
  const [drafts,setDrafts]=useState<Record<string,Customer>>({});
  const [isEditing,setIsEditing]=useState(false);
  const [addOpen,setAddOpen]=useState(false);
  const [saved,setSaved]=useState(false);
  const [query,setQuery]=useState("");

  useEffect(()=>{
    const refresh=()=>{
      setCustomers(loadCustomers());
      setOrders(loadOrders());
    };
    refresh();
    window.addEventListener("nightdesk:orders",refresh);
    window.addEventListener("nightdesk:customers",refresh);
    return ()=>{
      window.removeEventListener("nightdesk:orders",refresh);
      window.removeEventListener("nightdesk:customers",refresh);
    };
  },[]);

  function startEdit(){
    setDrafts(Object.fromEntries(customers.map(customer=>[customer.id,cloneCustomer(customer)])));
    setIsEditing(true);
  }

  function updateDraft(id:string,changes:Partial<Customer>){
    setDrafts(prev=>{
      const base=prev[id]??cloneCustomer(customers.find(customer=>customer.id===id)!);
      return {...prev,[id]:{...base,...changes}};
    });
  }

  function saveAll(){
    const next=customers.map(customer=>drafts[customer.id]?cloneCustomer(drafts[customer.id]):customer);
    saveCustomers(next);
    setCustomers(next);
    setDrafts({});
    setIsEditing(false);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1200);
  }

  function addCustomer(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const phone=String(fd.get("phone")||"").trim();
    if(!phone) return;
    if(customers.some(customer=>customer.phone===phone)) return;
    const customer:Customer={
      id:crypto.randomUUID(),
      phone,
      name:String(fd.get("name")||"").trim(),
      notes:String(fd.get("notes")||"").trim(),
      ngInfo:String(fd.get("ngInfo")||"").trim(),
      active:true
    };
    const next=[...customers,customer];
    saveCustomers(next);
    setCustomers(next);
    setAddOpen(false);
    e.currentTarget.reset();
  }

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q) return customers;
    return customers.filter(customer=>
      customer.phone.toLowerCase().includes(q) ||
      (customer.name??"").toLowerCase().includes(q) ||
      (customer.notes??"").toLowerCase().includes(q) ||
      (customer.ngInfo??"").toLowerCase().includes(q)
    );
  },[customers,query]);

  function stats(phone:string){
    const list=orders.filter(order=>order.customerPhone===phone && order.status!=="cancelled");
    const latest=[...list].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
    return {count:list.length,last:latest?new Date(latest.createdAt).toLocaleDateString("ja-JP"):"—"};
  }

  return <div className="customerManagementPage">
    <header className="pageHeader customerRegistryHeader">
      <div>
        <p className="eyebrow">CUSTOMER MANAGEMENT</p>
        <h1>顧客管理</h1>
        <p>電話番号、利用履歴、注意事項、NG情報を管理します。</p>
      </div>
      <div className="customerHeaderActions masterPageActions">
        {saved&&<span className="saveToast">保存しました</span>}
        <button className="masterEditButton" type="button" disabled={isEditing} onClick={startEdit}>編集</button>
        <button className="masterSaveButton" type="button" disabled={!isEditing} onClick={saveAll}>保存</button>
        <button className="primaryButton" type="button" onClick={()=>setAddOpen(true)}>＋ 顧客追加</button>
      </div>
    </header>

    <div className="customerToolbar">
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="電話番号・名前・メモで検索"/>
      <span>{filtered.length}件</span>
    </div>

    <section className="customerCardGrid">
      {filtered.map(customer=>{
        const current=isEditing?(drafts[customer.id]??customer):customer;
        const usage=stats(customer.phone);
        return <article key={customer.id} className={`customerCard ${current.active===false?"isInactive":""} ${isEditing?"isEditing":""}`}>
          <div className="customerCardHeader">
            <div><strong>{current.name||"名前未登録"}</strong><small>{current.phone}</small></div>
            <label className="switchLabel">
              <input type="checkbox" checked={current.active!==false} disabled={!isEditing}
                onChange={e=>updateDraft(customer.id,{active:e.target.checked})}/>
              <span>利用可</span>
            </label>
          </div>
          <div className="customerUsage">
            <div><span>利用回数</span><strong>{usage.count}回</strong></div>
            <div><span>最終利用</span><strong>{usage.last}</strong></div>
          </div>
          <div className="customerCardBody">
            <label>電話番号<input value={current.phone} disabled={!isEditing} onChange={e=>updateDraft(customer.id,{phone:e.target.value})}/></label>
            <label>名前・呼び名<input value={current.name??""} disabled={!isEditing} onChange={e=>updateDraft(customer.id,{name:e.target.value})}/></label>
            <label>注意事項<textarea rows={3} value={current.notes??""} disabled={!isEditing} onChange={e=>updateDraft(customer.id,{notes:e.target.value})}/></label>
            <label>NG情報<textarea rows={3} value={current.ngInfo??""} disabled={!isEditing} onChange={e=>updateDraft(customer.id,{ngInfo:e.target.value})}/></label>
          </div>
        </article>
      })}
      {!filtered.length&&<div className="masterEmpty">顧客データはまだありません。受付した電話番号も自動でここに追加されます。</div>}
    </section>

    {addOpen&&<div className="castModalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setAddOpen(false);}}>
      <div className="customerAddModal">
        <div className="castAddModalHeader">
          <div><p className="eyebrow">ADD CUSTOMER</p><h2>顧客追加</h2></div>
          <button className="castModalClose" type="button" onClick={()=>setAddOpen(false)}>×</button>
        </div>
        <form className="customerAddForm" onSubmit={addCustomer}>
          <label>電話番号<input name="phone" required autoFocus placeholder="090-0000-0000"/></label>
          <label>名前・呼び名<input name="name" placeholder="任意"/></label>
          <label>注意事項<textarea name="notes" rows={3}/></label>
          <label>NG情報<textarea name="ngInfo" rows={3}/></label>
          <div className="castAddModalActions">
            <button className="secondaryButton" type="button" onClick={()=>setAddOpen(false)}>キャンセル</button>
            <button className="primaryButton" type="submit">顧客を登録</button>
          </div>
        </form>
      </div>
    </div>}
  </div>
}
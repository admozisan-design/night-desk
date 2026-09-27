"use client";

import { useEffect, useMemo, useState } from "react";
import { staff as defaultStaff } from "@/lib/mock-data";
import { loadPermissions, loadStaff, savePermissions } from "@/lib/storage";
import type { Staff, StaffPermission } from "@/lib/types";

function defaultPermission(staffId:string):StaffPermission{
  return {staffId,reception:true,orders:true,sales:true,settings:true};
}

export default function PermissionsPage(){
  const [staff,setStaff]=useState<Staff[]>(defaultStaff);
  const [permissions,setPermissions]=useState<StaffPermission[]>([]);
  const [drafts,setDrafts]=useState<Record<string,StaffPermission>>({});
  const [isEditing,setIsEditing]=useState(false);
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    const staffList=loadStaff(defaultStaff);
    setStaff(staffList);
    const defaults=staffList.map(item=>defaultPermission(item.id));
    const stored=loadPermissions(defaults);
    const byId=new Map(stored.map(item=>[item.staffId,item]));
    setPermissions(staffList.map(item=>byId.get(item.id)??defaultPermission(item.id)));
  },[]);

  function startEdit(){
    setDrafts(Object.fromEntries(permissions.map(item=>[item.staffId,{...item}])));
    setIsEditing(true);
  }

  function patch(staffId:string,changes:Partial<StaffPermission>){
    setDrafts(prev=>{
      const base=prev[staffId]??permissions.find(item=>item.staffId===staffId)??defaultPermission(staffId);
      return {...prev,[staffId]:{...base,...changes}};
    });
  }

  function saveAll(){
    const next=permissions.map(item=>drafts[item.staffId]?{...drafts[item.staffId]}:item);
    savePermissions(next);
    setPermissions(next);
    setDrafts({});
    setIsEditing(false);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1200);
  }

  const rows=useMemo(()=>staff.map(person=>({
    person,
    permission:isEditing?(drafts[person.id]??permissions.find(item=>item.staffId===person.id)??defaultPermission(person.id))
      :(permissions.find(item=>item.staffId===person.id)??defaultPermission(person.id))
  })),[staff,permissions,drafts,isEditing]);

  const columns=[
    {key:"reception" as const,label:"受付"},
    {key:"orders" as const,label:"予約・配車"},
    {key:"sales" as const,label:"売上"},
    {key:"settings" as const,label:"設定変更"},
  ];

  return <div className="permissionManagementPage">
    <header className="pageHeader permissionRegistryHeader">
      <div>
        <p className="eyebrow">PERMISSIONS</p>
        <h1>スタッフ権限</h1>
        <p>スタッフごとに閲覧・受付・売上・設定変更の権限を管理します。</p>
      </div>
      <div className="permissionHeaderActions masterPageActions">
        {saved&&<span className="saveToast">保存しました</span>}
        <button className="masterEditButton" type="button" disabled={isEditing} onClick={startEdit}>編集</button>
        <button className="masterSaveButton" type="button" disabled={!isEditing} onClick={saveAll}>保存</button>
      </div>
    </header>

    <section className="panel permissionPanel">
      <div className="permissionTable">
        <div className="permissionRow permissionHead">
          <span>スタッフ</span>
          {columns.map(column=><span key={column.key}>{column.label}</span>)}
        </div>
        {rows.map(({person,permission})=><div className="permissionRow" key={person.id}>
          <div className="permissionStaff"><strong>{person.displayName||person.name}</strong><small>{person.loginId}</small></div>
          {columns.map(column=><label className="permissionToggle" key={column.key}>
            <input type="checkbox" disabled={!isEditing} checked={permission[column.key]}
              onChange={e=>patch(person.id,{[column.key]:e.target.checked})}/>
            <span>{permission[column.key]?"許可":"不可"}</span>
          </label>)}
        </div>)}
        {!rows.length&&<div className="masterEmpty compact">スタッフが登録されていません。</div>}
      </div>
    </section>
  </div>
}
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cloud mode activates ONLY after this deployment has been explicitly
 * configured with a dedicated Supabase URL and publishable key.
 * Existing demos remain local until then. Never put a service_role key here.
 */
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfigured=Boolean(url && publishableKey);
export const cloudClient:SupabaseClient|null=cloudConfigured
  ? createClient(url!,publishableKey!,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
      realtime:{params:{eventsPerSecond:10}}
    })
  : null;

type DataKind="list"|"object"|"single";
type Bucket={
  bucket:string;
  key:string;
  kind:DataKind;
  event:string;
};
export const cloudBuckets:Bucket[]=[
  {bucket:"orders",key:"night-desk-orders-sample-v02",kind:"list",event:"nightdesk:orders"},
  {bucket:"casts",key:"night-desk-casts-sample-v03",kind:"list",event:"nightdesk:casts"},
  {bucket:"drivers",key:"night-desk-drivers-sample-v01",kind:"list",event:"nightdesk:drivers"},
  {bucket:"hotels",key:"night-desk-hotels-sample-v01",kind:"list",event:"nightdesk:hotels"},
  {bucket:"staff",key:"night-desk-staff-sample-v01",kind:"list",event:"nightdesk:staff"},
  {bucket:"options",key:"night-desk-options-sample-v01",kind:"list",event:"nightdesk:options"},
  {bucket:"customers",key:"night-desk-customers-sample-v01",kind:"list",event:"nightdesk:customers"},
  {bucket:"pricing",key:"night-desk-pricing-sample-v01",kind:"single",event:"nightdesk:pricing"},
  {bucket:"store_settings",key:"night-desk-store-settings-v01",kind:"single",event:"nightdesk:store-settings"},
  {bucket:"permissions",key:"night-desk-permissions-sample-v01",kind:"list",event:"nightdesk:permissions"},
  {bucket:"settlement",key:"night-desk-cast-settlement-v01",kind:"object",event:"nightdesk:settlement"},
  {bucket:"settlement_daily",key:"night-desk-cast-settlement-daily-v01",kind:"object",event:"nightdesk:settlement"},
  {bucket:"shared_memo",key:"night-desk-shared-memo-v01",kind:"single",event:"nightdesk:shared-memo"},
  {bucket:"navigation",key:"night-desk-top-nav-v01",kind:"list",event:"nightdesk:navigation"},
  {bucket:"dispatch_widgets",key:"night-desk-dispatch-widgets-v01",kind:"list",event:"nightdesk:dispatch-widgets"},
  {bucket:"audit_logs",key:"night-desk-audit-log-v01",kind:"list",event:"nightdesk:logs"}
];
const byKey=new Map(cloudBuckets.map(item=>[item.key,item]));
const byBucket=new Map(cloudBuckets.map(item=>[item.bucket,item]));
type Entry={item_id:string;payload:{value:unknown;position?:number}};
type StoredRow={bucket:string;item_id:string;payload:{value:unknown;position?:number}};
export type CloudStatus={
  connected:boolean;busy:boolean;error:string|null;lastSync:string|null;storeId:string|null
};
let status:CloudStatus={connected:false,busy:false,error:null,lastSync:null,storeId:null};
let activeStore:string|null=null;
let role:"owner"|"admin"|"staff"|null=null;
export function cloudRole(){return cloudConfigured ? role : "admin";}
export function setCloudRole(value:"owner"|"admin"|"staff"){role=value;}
let pending=new Map<string,string>();
let snapshots=new Map<string,Map<string,string>>();
let tail:Promise<void>=Promise.resolve();
let timer:ReturnType<typeof setTimeout>|null=null;
let queuedRefreshes=new Set<string>();
let dirtyBuckets=new Set<string>();
let isStarting=false;
let channel:ReturnType<NonNullable<typeof cloudClient>["channel"]>|null=null;

function emit(patch:Partial<CloudStatus>){
  status={...status,...patch};
  if(typeof window!=="undefined")
    window.dispatchEvent(new CustomEvent("nightdesk:cloud-status",{detail:{...status}}));
}
export function cloudStatus(){return {...status};}
export function cloudStoreId(){return activeStore;}
function blankValue(kind:DataKind){return kind==="list"?"[]":kind==="object"?"{}":"";}
function asEntries(def:Bucket,raw:string):Entry[]{
  let value:unknown;
  if(def.kind==="single"){
    try{value=JSON.parse(raw);}catch{value=raw;}
    return [{item_id:"singleton",payload:{value}}];
  }
  try{value=JSON.parse(raw);}catch{throw new Error(`${def.bucket}のローカルデータ形式が不正です`);}
  if(def.kind==="list"){
    if(!Array.isArray(value)) throw new Error(`${def.bucket}は配列形式が必要です`);
    return value.map((item,index)=>{
      if(!item || typeof item!=="object" || !("id" in item) || !item.id)
        throw new Error(`${def.bucket}にIDのない行があります`);
      return {item_id:String(item.id),payload:{value:item,position:index}};
    });
  }
  if(!value || typeof value!=="object" || Array.isArray(value))
    throw new Error(`${def.bucket}はオブジェクト形式が必要です`);
  return Object.entries(value as Record<string,unknown>)
    .map(([key,item])=>({item_id:key,payload:{value:item}}));
}
function rawFromRows(def:Bucket,rows:StoredRow[]):string{
  if(def.kind==="single"){
    const item=rows.find(row=>row.item_id==="singleton");
    const value=item?.payload?.value;
    if(value===undefined) return "";
    return typeof value==="string"?value:JSON.stringify(value);
  }
  if(def.kind==="object"){
    return JSON.stringify(Object.fromEntries(rows.map(row=>[row.item_id,row.payload.value])));
  }
  const sorted=[...rows].sort((a,b)=>(a.payload.position??0)-(b.payload.position??0));
  return JSON.stringify(sorted.map(row=>row.payload.value));
}
function announce(def:Bucket){
  window.dispatchEvent(new Event(def.event));
  // Existing screens already listen to 'storage' for changes from other tabs.
  window.dispatchEvent(new Event("storage"));
}
function publishLocal(def:Bucket,rows:StoredRow[]){
  const next=rawFromRows(def,rows);
  const old=localStorage.getItem(def.key);
  if(next!==old){
    localStorage.setItem(def.key,next);
    announce(def);
  }
}
function pendingKey(store:string){return `nightdesk-cloud-outbox-${store}`;}
function persistPending(){
  if(!activeStore) return;
  localStorage.setItem(pendingKey(activeStore),JSON.stringify(Object.fromEntries(pending)));
}
function loadPending(store:string){
  try{
    const raw=localStorage.getItem(pendingKey(store));
    const parsed=raw?JSON.parse(raw) as Record<string,string>:{};
    pending=new Map(Object.entries(parsed).filter(([key])=>byKey.has(key)));
  }catch{pending=new Map();}
}
function saveSnapshot(def:Bucket,entries:Entry[]){
  snapshots.set(def.bucket,new Map(entries.map(item=>[item.item_id,JSON.stringify(item.payload)])));
}
async function getRows(bucket?:string){
  if(!cloudClient || !activeStore) return [] as StoredRow[];
  const rows:StoredRow[]=[];
  for(let from=0;;from+=1000){
    let query=cloudClient.from("nightdesk_records")
      .select("bucket,item_id,payload")
      .eq("store_id",activeStore)
      .order("bucket").order("item_id")
      .range(from,from+999);
    if(bucket) query=query.eq("bucket",bucket);
    const {data,error}=await query;
    if(error) throw error;
    const chunk=(data??[]) as StoredRow[];
    rows.push(...chunk);
    if(chunk.length<1000) break;
  }
  return rows;
}
async function refreshBucket(bucket:string){
  const def=byBucket.get(bucket);
  if(!def || !activeStore || dirtyBuckets.has(bucket)) return;
  const rows=await getRows(bucket);
  const entries=rows.map(row=>({item_id:row.item_id,payload:row.payload}));
  saveSnapshot(def,entries);
  publishLocal(def,rows);
}
function scheduleRefresh(bucket:string){
  queuedRefreshes.add(bucket);
  if(timer) clearTimeout(timer);
  timer=setTimeout(()=>{
    const names=[...queuedRefreshes];
    queuedRefreshes.clear();
    tail=tail.then(async()=>{
      for(const name of names) await refreshBucket(name);
      emit({lastSync:new Date().toISOString(),error:null});
    }).catch(error=>emit({error:error instanceof Error?error.message:"同期に失敗しました"}));
  },250);
}
async function flushBucket(def:Bucket,raw:string){
  if(!cloudClient || !activeStore) return;
  const next=asEntries(def,raw);
  const nextMap=new Map(next.map(item=>[item.item_id,JSON.stringify(item.payload)]));
  const before=snapshots.get(def.bucket)??new Map<string,string>();
  const changed=next.filter(item=>before.get(item.item_id)!==JSON.stringify(item.payload));
  const removed=[...before.keys()].filter(id=>!nextMap.has(id));
  const {data:{user}}=await cloudClient.auth.getUser();
  if(!user) throw new Error("セッションの有効期限が切れました");

  if(changed.length){
    const {error}=await cloudClient.from("nightdesk_records").upsert(
      changed.map(item=>({
        store_id:activeStore,bucket:def.bucket,item_id:item.item_id,
        payload:item.payload,updated_by:user.id,updated_at:new Date().toISOString()
      })),
      {onConflict:"store_id,bucket,item_id"}
    );
    if(error) throw error;
  }
  if(removed.length){
    const {error}=await cloudClient.from("nightdesk_records")
      .delete().eq("store_id",activeStore).eq("bucket",def.bucket).in("item_id",removed);
    if(error) throw error;
  }
  saveSnapshot(def,next);
}
async function flushPending(){
  if(!activeStore || !cloudClient || pending.size===0) return;
  emit({busy:true,error:null});
  for(const [key,raw] of [...pending.entries()]){
    const def=byKey.get(key);
    if(!def){pending.delete(key);continue;}
    dirtyBuckets.add(def.bucket);
    try{
      await flushBucket(def,raw);
      pending.delete(key);
      persistPending();
    }finally{dirtyBuckets.delete(def.bucket);}
  }
  emit({busy:false,lastSync:new Date().toISOString(),error:null});
}
export function writeCloudManaged(key:string,value:string){
  if(!cloudConfigured || !activeStore || !byKey.has(key)) return;
  pending.set(key,value);
  persistPending();
  const def=byKey.get(key)!;
  dirtyBuckets.add(def.bucket);
  tail=tail.then(async()=>{
    emit({busy:true,error:null});
    const raw=pending.get(key);
    if(raw===undefined) return;
    await flushBucket(def,raw);
    if(pending.get(key)===raw) pending.delete(key);
    persistPending();
    dirtyBuckets.delete(def.bucket);
    emit({busy:false,lastSync:new Date().toISOString(),error:null});
    if(queuedRefreshes.has(def.bucket)) scheduleRefresh(def.bucket);
  }).catch(error=>{
    dirtyBuckets.delete(def.bucket);
    emit({busy:false,error:error instanceof Error?error.message:"クラウド同期に失敗しました"});
  });
}
export function managedLocalBackup(){
  if(typeof window==="undefined") return {};
  return Object.fromEntries(cloudBuckets.flatMap(def=>{
    const value=localStorage.getItem(def.key);
    return value===null?[]:[[def.key,value]];
  }));
}
function preserveExistingLocalOnce(){
  const marker="nightdesk-cloud-local-preserved-v01";
  if(localStorage.getItem(marker)) return;
  const backup=managedLocalBackup();
  if(Object.keys(backup).length){
    localStorage.setItem("nightdesk-precloud-local-backup-v01",JSON.stringify({
      savedAt:new Date().toISOString(),data:backup
    }));
  }
  localStorage.setItem(marker,"1");
}
function clearManagedCache(){
  for(const def of cloudBuckets) localStorage.removeItem(def.key);
  localStorage.removeItem("night-desk-demo-seed-version");
}
export function hasPreCloudBackup(){
  return typeof window!=="undefined" && Boolean(localStorage.getItem("nightdesk-precloud-local-backup-v01"));
}
export function downloadPreCloudBackup(){
  if(typeof window==="undefined") return;
  const raw=localStorage.getItem("nightdesk-precloud-local-backup-v01");
  if(!raw) return;
  const blob=new Blob([raw],{type:"application/json;charset=utf-8"});
  const href=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=href;a.download=`NIGHTDESK_precloud_${new Date().toLocaleDateString("en-CA")}.json`;
  a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
}
export async function startCloudSync(storeId:string){
  if(!cloudClient || isStarting) return;
  if(activeStore===storeId && status.connected) return;
  isStarting=true;
  emit({busy:true,error:null,storeId});
  try{
    if(activeStore!==storeId){
      preserveExistingLocalOnce();
      activeStore=storeId;
      loadPending(storeId);
      clearManagedCache();
      snapshots=new Map();
    }
    const remote=await getRows();
    const grouped=new Map<string,StoredRow[]>();
    for(const row of remote){
      const list=grouped.get(row.bucket)??[];
      list.push(row);grouped.set(row.bucket,list);
    }
    for(const def of cloudBuckets){
      const rows=grouped.get(def.bucket)??[];
      saveSnapshot(def,rows.map(row=>({item_id:row.item_id,payload:row.payload})));
      // Pending offline edits always win locally until successfully flushed.
      const queued=pending.get(def.key);
      if(queued!==undefined) localStorage.setItem(def.key,queued);
      else if(rows.length) publishLocal(def,rows);
      else localStorage.setItem(def.key,blankValue(def.kind));
      announce(def);
    }
    if(channel) await cloudClient.removeChannel(channel);
    channel=cloudClient.channel(`nightdesk-${storeId}`)
      .on("postgres_changes",
        {event:"*",schema:"public",table:"nightdesk_records",filter:`store_id=eq.${storeId}`},
        payload=>{
          const row=((payload.new && Object.keys(payload.new).length)?payload.new:payload.old) as {bucket?:string};
          if(row?.bucket && byBucket.has(row.bucket)) scheduleRefresh(row.bucket);
        }
      ).subscribe();
    emit({connected:true,busy:false,error:null,lastSync:new Date().toISOString(),storeId});
    await flushPending();
  }catch(error){
    activeStore=null;
    emit({connected:false,busy:false,error:error instanceof Error?error.message:"クラウド接続に失敗しました",storeId:null});
    throw error;
  }finally{isStarting=false;}
}
export async function retryCloudSync(){
  if(!activeStore) return;
  await flushPending();
  for(const def of cloudBuckets) await refreshBucket(def.bucket);
}
export async function stopCloudSync(clearCache=true){
  if(cloudClient && channel){await cloudClient.removeChannel(channel);channel=null;}
  activeStore=null;role=null;snapshots=new Map();pending=new Map();dirtyBuckets.clear();
  if(clearCache) clearManagedCache();
  emit({connected:false,busy:false,error:null,lastSync:null,storeId:null});
}

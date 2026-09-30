import { casts as demoCasts, drivers as demoDrivers, hotels as demoHotels } from "./mock-data";
import {
  loadCasts, loadCustomers, loadDrivers, loadHotels, loadOrders,
  replaceOrdersFromCsv, saveCasts, saveCustomers, saveDrivers, saveHotels
} from "./storage";
import type { Cast, Customer, Driver, Hotel, Order } from "./types";

export type CsvDataset="casts"|"drivers"|"hotels"|"customers"|"orders";
type FieldKind="text"|"number"|"boolean"|"json";
type CsvField={key:string;label:string;kind:FieldKind};
export type CsvRecord=Record<string,unknown>;
export type CsvPatch=CsvRecord & {id:string};

const fields:Record<CsvDataset,CsvField[]>={
  casts:[
    ["id","管理ID","text"],["name","キャスト名","text"],["status","状態","text"],
    ["visible","表示","boolean"],["scheduledToday","本日出勤予定","boolean"],
    ["shiftStart","出勤時刻","text"],["shiftEnd","終了時刻","text"],
    ["availableAt","対応可能時刻","text"],["schedule","出勤スケジュール(JSON)","json"],
    ["unitPrice","基本単価","number"],["freeUnitPrice","フリー単価","number"],
    ["photoUnitPrice","写真指名単価","number"],["repeatUnitPrice","本指名単価","number"],
    ["ngDetails","NG情報(JSON)","json"],["availableOptions","可能OP(JSON)","json"],
    ["notes","備考","text"],["advertisingUrl","広告サイトURL","text"],
    ["interviewEvaluation","面接評価","text"],["age","年齢","number"],
    ["heightCm","身長","number"],["bustCm","B","number"],
    ["waistCm","W","number"],["hipCm","H","number"],["cupSize","カップ","text"]
  ].map(([key,label,kind])=>({key,label,kind:kind as FieldKind})),
  drivers:[
    ["id","管理ID","text"],["name","名前","text"],["phone","電話番号","text"],
    ["email","メールアドレス","text"],["vehicle","車両","text"],
    ["plate","ナンバー","text"],["notes","備考","text"],["active","有効","boolean"]
  ].map(([key,label,kind])=>({key,label,kind:kind as FieldKind})),
  hotels:[
    ["id","管理ID","text"],["name","場所名","text"],["travelFee","交通費","number"],
    ["visible","表示","boolean"],["kind","区分","text"],["address","住所","text"]
  ].map(([key,label,kind])=>({key,label,kind:kind as FieldKind})),
  customers:[
    ["id","管理ID","text"],["phone","電話番号","text"],["name","顧客名","text"],
    ["notes","備考","text"],["ngInfo","NG情報","text"],["active","利用可","boolean"]
  ].map(([key,label,kind])=>({key,label,kind:kind as FieldKind})),
  orders:[
    ["id","管理ID","text"],["createdAt","登録日時","text"],["serviceDate","営業日","text"],
    ["scheduledStart","開始予定","text"],["scheduledEnd","終了予定","text"],
    ["status","状態","text"],["castId","キャストID","text"],["castName","キャスト名","text"],
    ["driverId","送りID","text"],["driverName","送り名","text"],
    ["pickupDriverId","迎えID","text"],["pickupDriverName","迎え名","text"],
    ["courseId","コースID","text"],["courseMinutes","コース分数","number"],
    ["extensionMinutes","延長分数","number"],["extensionTotal","延長金額","number"],
    ["nominationType","指名種別","text"],["customerPhone","電話番号","text"],
    ["locationType","利用種別","text"],["locationName","利用場所","text"],
    ["room","部屋番号","text"],["address","住所","text"],
    ["selectedOptions","選択オプション(JSON)","json"],["optionsTotal","OP金額","number"],
    ["travelFee","交通費","number"],["discount","割引","number"],
    ["surcharge","割増","number"],["adjustment","調整","number"],
    ["paymentMethod","支払方法","text"],["cardFee","カード手数料","number"],
    ["changeFee","チェンジ料","number"],["cancelFee","キャンセル料","number"],
    ["changeCount","チェンジ回数","number"],["changeHistory","チェンジ履歴(JSON)","json"],
    ["cancelledAt","キャンセル日時","text"],["total","合計金額","number"],
    ["inTime","イン時間","text"],["note","備考","text"],["handoffNote","引継ぎ備考","text"]
  ].map(([key,label,kind])=>({key,label,kind:kind as FieldKind}))
};

export const csvDatasetLabels:Record<CsvDataset,string>={
  casts:"キャスト",drivers:"ドライバー",hotels:"ホテル・利用場所",
  customers:"顧客",orders:"オーダー"
};
export const csvDatasetKeys:CsvDataset[]=["casts","drivers","hotels","customers","orders"];
export function csvColumns(dataset:CsvDataset){return fields[dataset];}

export function readCsvDataset(dataset:CsvDataset):CsvRecord[]{
  switch(dataset){
    case "casts":return loadCasts(demoCasts) as unknown as CsvRecord[];
    case "drivers":return loadDrivers(demoDrivers) as unknown as CsvRecord[];
    case "hotels":return loadHotels(demoHotels) as unknown as CsvRecord[];
    case "customers":return loadCustomers() as unknown as CsvRecord[];
    case "orders":return loadOrders() as unknown as CsvRecord[];
  }
}
export function saveCsvDataset(dataset:CsvDataset,records:CsvRecord[]){
  switch(dataset){
    case "casts":saveCasts(records as unknown as Cast[]);break;
    case "drivers":saveDrivers(records as unknown as Driver[]);break;
    case "hotels":saveHotels(records as unknown as Hotel[]);break;
    case "customers":saveCustomers(records as unknown as Customer[]);break;
    case "orders":replaceOrdersFromCsv(records as unknown as Order[]);break;
  }
}

function escapeCell(value:string){
  const guarded=/^[=+\-@\t\r]/.test(value) ? "'"+value : value;
  return '"'+guarded.replaceAll('"','""')+'"';
}
function fieldValue(value:unknown,kind:FieldKind){
  if(value===null || value===undefined) return "";
  if(kind==="json") return JSON.stringify(value);
  if(kind==="boolean") return value ? "true" : "false";
  return String(value);
}
export function makeCsv(dataset:CsvDataset,records:CsvRecord[]){
  const columns=fields[dataset];
  const header=columns.map(field=>escapeCell(field.key)).join(",");
  const data=records.map(record=>columns.map(field=>{
    const value=record[field.key];
    // Numeric columns are data, not formula text; keep negative amounts intact.
    const raw=fieldValue(value,field.kind);
    return field.kind==="number"
      ? '"'+raw.replaceAll('"','""')+'"'
      : escapeCell(raw);
  }).join(","));
  // BOM ensures Japanese text opens as UTF-8 in Excel.
  return "\uFEFF"+[header,...data].join("\r\n")+"\r\n";
}
export function downloadCsv(dataset:CsvDataset,records:CsvRecord[],template=false){
  const contents=makeCsv(dataset,template?[]:records);
  const blob=new Blob([contents],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.download=`NIGHTDESK_${dataset}_${template?"template":new Date().toLocaleDateString("en-CA")}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function parseCsvText(source:string){
  const text=source.replace(/^\uFEFF/,"");
  const result:string[][]=[];
  let cells:string[]=[];
  let cell="";
  let quoted=false;
  let closed=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quoted){
      if(char==='"'){
        if(text[i+1]==='"'){cell+='"';i++;}
        else {quoted=false;closed=true;}
      }else{cell+=char;}
      continue;
    }
    if(char==='"'){
      if(cell!=="" || closed) throw new Error("CSVのダブルクォート形式が不正です。");
      quoted=true;
    }else if(char===","){
      cells.push(cell);cell="";closed=false;
    }else if(char==="\n" || char==="\r"){
      if(char==="\r" && text[i+1]==="\n") i++;
      cells.push(cell);
      if(cells.some(value=>value.trim()!=="")) result.push(cells);
      cells=[];cell="";closed=false;
    }else{
      if(closed && char!==" " && char!=="\t") throw new Error("CSVの引用符の後に不正な文字があります。");
      if(!closed) cell+=char;
    }
  }
  if(quoted) throw new Error("CSVの引用符が閉じられていません。");
  if(cell!=="" || cells.length>0){
    cells.push(cell);
    if(cells.some(value=>value.trim()!=="")) result.push(cells);
  }
  return result;
}

function decodeCell(raw:string,field:CsvField,line:number):unknown{
  const value=raw.replace(/^'(?=[=+\-@])/,"").replace(/^\t(?=\d)/,"");
  if(field.kind==="text") return value;
  if(value.trim()==="") return undefined;
  if(field.kind==="number"){
    const parsed=Number(value);
    if(!Number.isFinite(parsed)) throw new Error(`${line}行目「${field.label}」は数字で入力してください。`);
    return parsed;
  }
  if(field.kind==="boolean"){
    const token=value.trim().toLowerCase();
    if(["true","1","はい","有効"].includes(token)) return true;
    if(["false","0","いいえ","無効"].includes(token)) return false;
    throw new Error(`${line}行目「${field.label}」はtrueまたはfalseで入力してください。`);
  }
  try{
    const parsed=JSON.parse(value);
    if(!Array.isArray(parsed)) throw new Error();
    return parsed;
  }catch{
    throw new Error(`${line}行目「${field.label}」はJSON配列形式で入力してください。`);
  }
}
export function parseDatasetCsv(dataset:CsvDataset,text:string):CsvPatch[]{
  if(text.includes("\uFFFD")) throw new Error("文字コードをUTF-8にして保存してください。");
  const table=parseCsvText(text);
  if(!table.length) throw new Error("CSVが空です。");
  const header=table[0].map(cell=>cell.trim().replace(/^\uFEFF/,""));
  const validFields=new Map(fields[dataset].map(field=>[field.key,field]));
  if(!header.includes("id")) throw new Error("管理ID（id）列が必要です。CSV出力またはテンプレートを使用してください。");
  if(new Set(header).size!==header.length) throw new Error("列名が重複しています。");
  const unknown=header.filter(key=>!validFields.has(key));
  if(unknown.length) throw new Error(`未対応の列名：${unknown.join("、")}`);
  if(header.length<2) throw new Error("管理ID以外にも1列以上必要です。");

  const patches:CsvPatch[]=[];
  for(let i=1;i<table.length;i++){
    const line=table[i];
    if(line.length!==header.length) throw new Error(`${i+1}行目：列数が一致しません（${line.length}/${header.length}）。`);
    const patch:CsvRecord={};
    header.forEach((key,index)=>{
      patch[key]=decodeCell(line[index],validFields.get(key)!,i+1);
    });
    if(typeof patch.id!=="string") throw new Error(`${i+1}行目：管理IDが不正です。`);
    patch.id=patch.id.trim() || crypto.randomUUID();
    patches.push(patch as CsvPatch);
  }
  if(!patches.length) throw new Error("読み込み対象のデータ行がありません。");
  const ids=patches.map(p=>p.id);
  if(new Set(ids).size!==ids.length) throw new Error("CSV内に同じ管理IDが複数あります。");
  if(dataset==="customers"){
    const phones=patches.map(p=>String(p.phone??"").replace(/\D/g,"")).filter(Boolean);
    if(new Set(phones).size!==phones.length) throw new Error("CSV内に同じ電話番号の顧客が複数あります。");
  }
  return patches;
}

const base:Record<CsvDataset,()=>CsvRecord>={
  casts:()=>({status:"waiting",visible:true,scheduledToday:true,schedule:[],availableOptions:[],ngDetails:[]}),
  drivers:()=>({active:true}),
  hotels:()=>({travelFee:0,visible:true,kind:"love"}),
  customers:()=>({active:true}),
  orders:()=>({createdAt:new Date().toISOString(),status:"accepted",locationType:"hotel",
    nominationType:"free",optionsTotal:0,travelFee:0,discount:0,adjustment:0})
};
function requireText(record:CsvRecord,key:string,label:string){
  if(typeof record[key]!=="string" || !String(record[key]).trim()) throw new Error(`${label}を入力してください（管理ID: ${record.id}）。`);
}
function validateRecord(dataset:CsvDataset,row:CsvRecord){
  requireText(row,"id","管理ID");
  if(dataset==="casts"){
    requireText(row,"name","キャスト名");
    if(!["waiting","moving","serving","off"].includes(String(row.status))) throw new Error("キャスト状態はwaiting/moving/serving/offにしてください。");
  }
  if(dataset==="drivers" || dataset==="hotels") requireText(row,"name","名称");
  if(dataset==="hotels" && !["business","love","home"].includes(String(row.kind))) throw new Error("ホテル区分はbusiness/love/homeにしてください。");
  if(dataset==="customers"){
    requireText(row,"phone","電話番号");
    if(!/^[0-9+\-() ]+$/.test(String(row.phone))) throw new Error("顧客の電話番号が不正です。");
  }
  if(dataset==="orders"){
    ["castId","castName","scheduledStart","scheduledEnd","locationName"].forEach(key=>requireText(row,key,key));
    if(!["accepted","dispatching","serving","completed","cancelled"].includes(String(row.status))) throw new Error("オーダー状態が不正です。");
    if(!["free","photo","repeat"].includes(String(row.nominationType))) throw new Error("指名種別が不正です。");
    if(!["hotel","home"].includes(String(row.locationType))) throw new Error("利用種別が不正です。");
    if(row.paymentMethod && !["cash","card"].includes(String(row.paymentMethod))) throw new Error("支払方法が不正です。");
    for(const key of ["scheduledStart","scheduledEnd"]){
      if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(row[key]))) throw new Error(`${key}はHH:MM形式で入力してください。`);
    }
    if(typeof row.courseMinutes!=="number" || row.courseMinutes<=0) throw new Error("コース分数は正の数字にしてください。");
    if(typeof row.total!=="number") throw new Error("オーダー合計金額を入力してください。");
  }
}

export type CsvImportMode="merge"|"replace";
export type CsvImportPlan={result:CsvRecord[];added:number;updated:number;previous:number;received:number};
export function planCsvImport(dataset:CsvDataset,incoming:CsvPatch[],current:CsvRecord[],mode:CsvImportMode):CsvImportPlan{
  const result=mode==="replace" ? [] as CsvRecord[] : current.map(record=>({...record}));
  let added=0,updated=0;
  const phoneKey=(v:unknown)=>String(v??"").replace(/\D/g,"");
  for(const patch of incoming){
    let index=mode==="replace" ? -1 : result.findIndex(row=>row.id===patch.id);
    if(index<0 && dataset==="customers" && mode==="merge" && phoneKey(patch.phone)){
      index=result.findIndex(row=>phoneKey(row.phone)===phoneKey(patch.phone));
    }
    const original=index>=0?result[index]:base[dataset]();
    const row={...original,...patch};
    if(index>=0 && dataset==="customers") row.id=original.id;
    validateRecord(dataset,row);
    if(index>=0){result[index]=row;updated++;}
    else{result.push(row);added++;}
  }
  if(new Set(result.map(row=>row.id)).size!==result.length) throw new Error("取り込み後に管理IDが重複します。");
  if(dataset==="customers"){
    const phones=result.map(row=>phoneKey(row.phone));
    if(new Set(phones).size!==phones.length) throw new Error("取り込み後に顧客電話番号が重複します。");
  }
  return {result,added,updated,previous:current.length,received:incoming.length};
}

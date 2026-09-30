"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  csvDatasetKeys,csvDatasetLabels,csvColumns,downloadCsv,parseDatasetCsv,
  planCsvImport,readCsvDataset,saveCsvDataset
} from "@/lib/csv-data";
import type { CsvDataset,CsvImportMode,CsvPatch,CsvRecord } from "@/lib/csv-data";
import { appendAuditLog } from "@/lib/storage";

const previewFields:Record<CsvDataset,string[]>={
  casts:["id","name","status","freeUnitPrice"],
  drivers:["id","name","phone","email"],
  hotels:["id","name","kind","travelFee"],
  customers:["id","phone","name","ngInfo"],
  orders:["id","serviceDate","castName","total"]
};

function shortValue(value:unknown){
  if(value===undefined || value===null) return "—";
  if(Array.isArray(value)) return `JSON（${value.length}件）`;
  const raw=String(value);
  return raw.length>60 ? raw.slice(0,60)+"…" : raw || "—";
}

export default function CsvDataSettings(){
  const [dataset,setDataset]=useState<CsvDataset>("casts");
  const [current,setCurrent]=useState<CsvRecord[]>([]);
  const [upload,setUpload]=useState<{name:string;rows:CsvPatch[]}|null>(null);
  const [mode,setMode]=useState<CsvImportMode>("merge");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    setCurrent(readCsvDataset(dataset));
  },[dataset]);

  const planResult=useMemo(()=>{
    if(!upload) return null;
    try{
      return {plan:planCsvImport(dataset,upload.rows,current,mode),error:null};
    }catch(e){
      return {plan:null,error:e instanceof Error ? e.message : "CSVを確認してください。"};
    }
  },[dataset,upload,current,mode]);

  function changeDataset(next:CsvDataset){
    setDataset(next);
    setUpload(null);
    setMode("merge");
    setError("");
    setNotice("");
  }

  async function chooseFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];
    e.target.value="";
    setUpload(null);
    setError("");
    setNotice("");
    if(!file) return;
    if(file.size>10*1024*1024){
      setError("10MB以下のCSVファイルを選択してください。");
      return;
    }
    try{
      const text=await file.text();
      const rows=parseDatasetCsv(dataset,text);
      setUpload({name:file.name,rows});
    }catch(e){
      setError(e instanceof Error ? e.message : "CSVを読み込めませんでした。");
    }
  }

  function runImport(){
    if(!upload || !planResult?.plan) return;
    const plan=planResult.plan;
    if(mode==="replace" && !window.confirm(
      `${csvDatasetLabels[dataset]}の既存${plan.previous}件を全置換し、CSVの${plan.received}件だけを保存します。よろしいですか？`
    )) return;
    setSaving(true);
    try{
      saveCsvDataset(dataset,plan.result);
      appendAuditLog("CSV","CSV取り込み",`${csvDatasetLabels[dataset]} / ${mode==="merge"?"追加更新":"全置換"} / ${plan.received}件`);
      const updated=readCsvDataset(dataset);
      setCurrent(updated);
      setUpload(null);
      setError("");
      setNotice(`${csvDatasetLabels[dataset]}を取り込みました。追加${plan.added}件・更新${plan.updated}件、現在${updated.length}件です。`);
    }catch(e){
      setError(e instanceof Error ? e.message : "保存に失敗しました。");
    }finally{
      setSaving(false);
    }
  }

  return <div className="csvDataPage">
    <header className="pageHeader">
      <div>
        <p className="eyebrow">DATA MANAGEMENT</p>
        <h1>CSVデータ管理</h1>
        <p>登録情報をCSVに出力したり、編集済みCSVをまとめて取り込めます。</p>
      </div>
    </header>

    <div className="csvLocalNotice">
      <strong>データの保存先について</strong>
      <span>現在のデモ版では、このブラウザ内のデータを入出力します。他の端末にも反映する場合は、それぞれCSVを取り込んでください。</span>
    </div>

    <section className="panel csvMainPanel">
      <h2>① 対象データを選ぶ</h2>
      <div className="csvDatasetTabs">
        {csvDatasetKeys.map(key=><button
          type="button"
          key={key}
          className={dataset===key?"selected":""}
          onClick={()=>changeDataset(key)}
        >
          <strong>{csvDatasetLabels[key]}</strong>
          {dataset===key && <small>選択中</small>}
        </button>)}
      </div>
      <div className="csvDatasetInfo">
        <div><span>対象</span><strong>{csvDatasetLabels[dataset]}</strong></div>
        <div><span>現在の登録件数</span><strong>{current.length}件</strong></div>
        <div><span>CSV列数</span><strong>{csvColumns(dataset).length}列</strong></div>
      </div>
    </section>

    <section className="panel csvMainPanel">
      <h2>② CSVを出力する</h2>
      <p>登録済みのデータを出力します。項目名だけの空テンプレートも取得できます。</p>
      <div className="csvExportActions">
        <button type="button" className="csvPrimary" onClick={()=>downloadCsv(dataset,current)}>
          {csvDatasetLabels[dataset]}をCSV出力
        </button>
        <button type="button" className="csvSecondary" onClick={()=>downloadCsv(dataset,[],true)}>
          空テンプレート
        </button>
      </div>
    </section>

    <section className="panel csvMainPanel">
      <h2>③ CSVを入力する</h2>
      <p>UTF-8のCSVを選択してください。JSON列（出勤予定・チェンジ履歴など）は、出力したCSVの形式を維持してください。</p>
      <label className="csvFileInput">
        <strong>CSVファイルを選択</strong>
        <input type="file" accept=".csv,text/csv" onChange={e=>void chooseFile(e)}/>
        <span>ファイル選択後、内容と件数を確認してから取り込みます。</span>
      </label>

      {upload && <div className="csvImportReview">
        <div className="csvReviewHead">
          <div><strong>{upload.name}</strong><span>{upload.rows.length}件を読み込みました</span></div>
          <button type="button" onClick={()=>{setUpload(null);setError("");}}>選び直す</button>
        </div>

        <fieldset className="csvImportModes">
          <legend>取り込み方式</legend>
          <label className={mode==="merge"?"active":""}>
            <input type="radio" name="csvImportMode" value="merge" checked={mode==="merge"} onChange={()=>setMode("merge")}/>
            <div><strong>追加・更新</strong><small>同じ管理IDを更新、新しい管理IDを追加。顧客は電話番号の一致でも更新します。</small></div>
          </label>
          <label className={mode==="replace"?"active":""}>
            <input type="radio" name="csvImportMode" value="replace" checked={mode==="replace"} onChange={()=>setMode("replace")}/>
            <div><strong>全置換</strong><small>既存の${current.length}件をCSVの内容に置き換えます。確定前に再確認します。</small></div>
          </label>
        </fieldset>

        {planResult?.error
          ? <div className="csvError" role="alert">{planResult.error}</div>
          : planResult?.plan && <>
            <div className="csvImportCounts">
              <div><span>読み込み</span><strong>{planResult.plan.received}件</strong></div>
              <div><span>追加</span><strong>{planResult.plan.added}件</strong></div>
              <div><span>更新</span><strong>{planResult.plan.updated}件</strong></div>
              <div><span>保存後</span><strong>{planResult.plan.result.length}件</strong></div>
            </div>
            <div className="csvPreviewScroller">
              <table>
                <thead><tr>{previewFields[dataset].map(key=><th key={key}>{csvColumns(dataset).find(f=>f.key===key)?.label??key}</th>)}</tr></thead>
                <tbody>{upload.rows.slice(0,5).map((row,i)=><tr key={i}>
                  {previewFields[dataset].map(key=><td key={key}>{shortValue(row[key])}</td>)}
                </tr>)}</tbody>
              </table>
              {upload.rows.length>5 && <small>プレビューは先頭5件のみ表示しています。</small>}
            </div>
            <button type="button" className={mode==="replace"?"csvDanger":"csvPrimary"} onClick={runImport} disabled={saving}>
              {saving?"保存中…":mode==="replace"?"確認して全置換":"追加・更新を確定"}
            </button>
          </>}
      </div>}
      {error && <div className="csvError" role="alert">{error}</div>}
      {notice && <div className="csvSuccess" role="status">{notice}</div>}
    </section>

    <p className="csvFootnote">※ 電話番号はCSVをExcelで編集する際に「文字列」として扱ってください。顧客情報には注文履歴から自動生成された顧客も含まれます。個人情報を含むCSVの共有・保管にはご注意ください。</p>
  </div>;
}

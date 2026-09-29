import type { Cast, Order, StoreSettings } from "./types";

type EndOfDayExportInput={
  date:string;
  orders:Order[];
  casts:Cast[];
  storeSettings:StoreSettings;
};

const yen=new Intl.NumberFormat("ja-JP");

function formatYenValue(value:number){
  return yen.format(value)+"円";
}
function orderStatusLabel(status:Order["status"]){
  if(status==="dispatching") return "配車後";
  if(status==="serving") return "イン中";
  if(status==="completed") return "アウト";
  if(status==="cancelled") return "キャンセル";
  return "配車前";
}
function nominationLabel(value:Order["nominationType"]){
  if(value==="photo") return "写真指名";
  if(value==="repeat") return "本指名";
  return "フリー";
}
function locationLabel(order:Order){
  return order.locationType==="home" ? "自宅" : "ホテル";
}
function paymentLabel(order:Order){
  return order.paymentMethod==="card" ? "カード" : "現金";
}
function attendanceLabel(cast:Cast,date:string){
  const shift=cast.schedule?.find(item=>item.date===date);
  if(!shift) return "";
  if(shift.attendance==="present") return "出勤";
  if(shift.attendance==="late") return "遅刻";
  if(shift.attendance==="absent") return "当欠";
  if(shift.attendance==="leftEarly") return "早退";
  return shift.working ? "予定" : "休み";
}
function shiftLabel(cast:Cast,date:string){
  const shift=cast.schedule?.find(item=>item.date===date);
  if(!shift) return [cast.shiftStart??"",cast.shiftEnd??""].filter(Boolean).join(" - ");
  const endLabel=shift.endType==="reception" ? "受付終了" : "上がり";
  return `${shift.start} - ${endLabel} ${shift.endTime}`;
}
function activeOrders(orders:Order[]){
  return orders.filter(order=>order.status!=="cancelled");
}
function summary(input:EndOfDayExportInput){
  const valid=activeOrders(input.orders);
  const cash=valid.filter(order=>order.paymentMethod!=="card").reduce((sum,order)=>sum+order.total,0);
  const card=valid.filter(order=>order.paymentMethod==="card").reduce((sum,order)=>sum+order.total,0);
  return {
    total:valid.reduce((sum,order)=>sum+order.total,0),
    count:valid.length,
    cancelled:input.orders.filter(order=>order.status==="cancelled").length,
    cash,
    card
  };
}
function castRows(input:EndOfDayExportInput){
  return input.casts.map(cast=>{
    const orders=input.orders.filter(order=>order.castId===cast.id && order.status!=="cancelled");
    return [
      cast.name,
      attendanceLabel(cast,input.date),
      shiftLabel(cast,input.date),
      orders.length,
      orders.reduce((sum,order)=>sum+order.total,0)
    ];
  });
}
function orderRows(orders:Order[]){
  return [...orders]
    .sort((a,b)=>a.scheduledStart.localeCompare(b.scheduledStart))
    .map(order=>[
      order.scheduledStart,
      order.scheduledEnd,
      orderStatusLabel(order.status),
      order.castName,
      order.courseMinutes+(order.extensionMinutes??0),
      nominationLabel(order.nominationType),
      locationLabel(order),
      order.locationName,
      order.room??"",
      order.address??"",
      order.driverName??"",
      order.pickupDriverName??"",
      order.customerPhone??"",
      paymentLabel(order),
      order.optionsTotal,
      order.travelFee,
      order.discount,
      order.surcharge??0,
      order.cardFee??0,
      order.total,
      order.note??"",
      order.handoffNote??""
    ]);
}

export async function exportDailyExcel(input:EndOfDayExportInput){
  const XLSX=await import("xlsx");
  const totals=summary(input);

  const summarySheet=XLSX.utils.aoa_to_sheet([
    ["NIGHT DESK 終業レポート"],
    ["対象日",input.date],
    ["営業時間",`${input.storeSettings.openTime} - ${input.storeSettings.closeTime}`],
    ["出勤キャスト",input.casts.length],
    ["オーダー件数",totals.count],
    ["キャンセル",totals.cancelled],
    ["現金売上",totals.cash],
    ["カード売上",totals.card],
    ["売上合計",totals.total],
    ["出力日時",new Date().toLocaleString("ja-JP")]
  ]);
  summarySheet["!cols"]=[{wch:20},{wch:28}];

  const orderHeaders=[
    "開始","終了","状態","キャスト","分数","指名","利用種別","ホテル・自宅","部屋",
    "住所","送りドライバー","迎えドライバー","電話番号","支払","OP料金","交通費","割引","割増","カード手数料",
    "合計","備考","引継ぎ備考"
  ];
  const ordersSheet=XLSX.utils.aoa_to_sheet([orderHeaders,...orderRows(input.orders)]);
  ordersSheet["!cols"]=[
    {wch:9},{wch:9},{wch:10},{wch:12},{wch:8},{wch:10},{wch:10},{wch:22},{wch:9},
    {wch:28},{wch:14},{wch:14},{wch:16},{wch:10},{wch:11},{wch:11},{wch:11},{wch:11},{wch:13},
    {wch:13},{wch:30},{wch:30}
  ];

  const castsSheet=XLSX.utils.aoa_to_sheet([
    ["キャスト","勤怠","出勤・終了条件","本数","売上"],
    ...castRows(input)
  ]);
  castsSheet["!cols"]=[{wch:16},{wch:10},{wch:26},{wch:8},{wch:14}];

  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,summarySheet,"日次サマリー");
  XLSX.utils.book_append_sheet(workbook,ordersSheet,"オーダー一覧");
  XLSX.utils.book_append_sheet(workbook,castsSheet,"キャスト別集計");
  XLSX.writeFile(workbook,`終業レポート_${input.date}.xlsx`,{compression:true});
}

function escapeHtml(value:unknown){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

export function exportDailyPdf(input:EndOfDayExportInput){
  const totals=summary(input);
  const popup=window.open("","_blank","width=1280,height=900");
  if(!popup){
    window.alert("PDF画面を開けませんでした。ポップアップを許可してもう一度お試しください。");
    return;
  }

  const orderHtml=orderRows(input.orders).map(row=>`
    <tr>${row.map((cell,index)=>`<td class="${index>=14 && index<=19 ? "num" : ""}">${escapeHtml(index>=13 && index<=18 ? formatYenValue(Number(cell)||0) : cell)}</td>`).join("")}</tr>
  `).join("");

  const castHtml=castRows(input).map(row=>`
    <tr>
      <td>${escapeHtml(row[0])}</td>
      <td>${escapeHtml(row[1])}</td>
      <td>${escapeHtml(row[2])}</td>
      <td class="num">${escapeHtml(row[3])}</td>
      <td class="num">${escapeHtml(formatYenValue(Number(row[4])||0))}</td>
    </tr>
  `).join("");

  popup.document.open();
  popup.document.write(`<!doctype html>
  <html lang="ja">
    <head>
      <meta charset="utf-8"/>
      <title>終業レポート_${escapeHtml(input.date)}</title>
      <style>
        @page{size:A4 landscape;margin:9mm}
        *{box-sizing:border-box}
        body{margin:0;color:#17212b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Yu Gothic","Hiragino Kaku Gothic ProN",Meiryo,sans-serif;font-size:9px}
        h1{margin:0 0 3px;font-size:22px} h2{margin:18px 0 7px;font-size:14px}
        .sub{color:#65727d;margin-bottom:12px}
        .summary{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
        .summary div{border:1px solid #d7dfe5;border-radius:6px;padding:8px}
        .summary span{display:block;color:#75818b;font-size:8px}.summary strong{display:block;margin-top:3px;font-size:13px}
        table{width:100%;border-collapse:collapse;table-layout:fixed}
        th,td{border:1px solid #cfd7dd;padding:5px;vertical-align:top;word-break:break-word}
        th{background:#eef5df;font-size:8px;text-align:left}
        .num{text-align:right;white-space:nowrap}
        .orders{font-size:7px}
        .orders th:nth-child(10),.orders td:nth-child(10),
        .orders th:nth-child(20),.orders td:nth-child(20),
        .orders th:nth-child(21),.orders td:nth-child(21){width:9%}
        .footer{margin-top:9px;color:#7c8791;font-size:7px;text-align:right}
        @media print{button{display:none!important}}
      </style>
    </head>
    <body>
      <h1>NIGHT DESK 終業レポート</h1>
      <div class="sub">対象日：${escapeHtml(input.date)} / 営業時間：${escapeHtml(input.storeSettings.openTime)} - ${escapeHtml(input.storeSettings.closeTime)}</div>

      <div class="summary">
        <div><span>出勤キャスト</span><strong>${input.casts.length}人</strong></div>
        <div><span>オーダー</span><strong>${totals.count}件</strong></div>
        <div><span>キャンセル</span><strong>${totals.cancelled}件</strong></div>
        <div><span>現金売上</span><strong>${formatYenValue(totals.cash)}</strong></div>
        <div><span>カード売上</span><strong>${formatYenValue(totals.card)}</strong></div>
        <div><span>売上合計</span><strong>${formatYenValue(totals.total)}</strong></div>
      </div>

      <h2>キャスト別集計</h2>
      <table>
        <thead><tr><th>キャスト</th><th>勤怠</th><th>出勤・終了条件</th><th>本数</th><th>売上</th></tr></thead>
        <tbody>${castHtml}</tbody>
      </table>

      <h2>オーダー一覧</h2>
      <table class="orders">
        <thead><tr>
          ${["開始","終了","状態","キャスト","分","指名","種別","ホテル・自宅","部屋","住所","送りドライバー","迎えドライバー","電話番号","支払","OP","交通費","割引","割増","カード手数料","合計","備考","引継ぎ"].map(value=>`<th>${value}</th>`).join("")}
        </tr></thead>
        <tbody>${orderHtml}</tbody>
      </table>
      <div class="footer">出力日時：${escapeHtml(new Date().toLocaleString("ja-JP"))}</div>
      <script>
        window.addEventListener("load",()=>setTimeout(()=>window.print(),250));
        window.addEventListener("afterprint",()=>window.close());
      </script>
    </body>
  </html>`);
  popup.document.close();
}

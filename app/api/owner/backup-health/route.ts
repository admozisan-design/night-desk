import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function json(body:unknown,status=200){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store, max-age=0"}});
}

type BackupRow={store_id:string;backup_date:string;created_at:string};
type StoreRow={id:string;name:string};
type BackupConnectionDetail=
  "ok"|"missing_key"|"invalid_key"|"insufficient_privileges"|
  "database_unreachable"|"table_unavailable"|"unknown_error";
function classifyBackupError(code?:string,message?:string,status?:number):BackupConnectionDetail{
  const text=(message??"").toLowerCase();
  if(status===401 || status===403)return "invalid_key";
  if(code==="42501" || text.includes("permission denied") ||
     text.includes("row-level security") || text.includes("row level security"))
    return "insufficient_privileges";
  if(code==="PGRST301" || code==="PGRST302" || code==="401" || code==="403" ||
     text.includes("invalid api key") || text.includes("invalid jwt") ||
     text.includes("jwt") || text.includes("authentication failed"))
    return "invalid_key";
  if(code==="42P01" || code==="PGRST205" || text.includes("does not exist") ||
     text.includes("could not find the table"))return "table_unavailable";
  if(text.includes("fetch failed") || text.includes("failed to fetch") ||
     text.includes("network") || text.includes("timeout") || text.includes("connect"))
    return "database_unreachable";
  return "unknown_error";
}

type KeyKind="missing"|"modern_secret"|"modern_publishable"|
  "legacy_service_role"|"legacy_other_role"|"malformed";
function classifyKey(value:string|undefined):KeyKind{
  if(!value)return "missing";
  if(value.startsWith("sb_secret_"))return "modern_secret";
  if(value.startsWith("sb_publishable_"))return "modern_publishable";
  if(value.split(".").length!==3)return "malformed";
  try{
    const payload=JSON.parse(Buffer.from(value.split(".")[1],"base64url").toString("utf8")) as {role?:string};
    return payload.role==="service_role"?"legacy_service_role":"legacy_other_role";
  }catch{return "malformed";}
}
function safeProviderCode(value:unknown){
  return typeof value==="string" && /^[A-Z0-9_]{1,30}$/i.test(value)?value:null;
}

/** Read-only backup diagnostics, accessible to the verified platform owner only. */
export async function GET(request:NextRequest){
  const authorization=request.headers.get("authorization")??"";
  const match=/^Bearer\s+([^\s]+)$/i.exec(authorization);
  if(!match)return json({error:"ログインが必要です"},401);

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url || !publishableKey)return json({error:"クラウド接続設定が不足しています"},503);

  try{
    const userClient=createClient(url,publishableKey,{
      global:{headers:{Authorization:`Bearer ${match[1]}`}},
      auth:{persistSession:false,autoRefreshToken:false}
    });
    const {data:{user},error:userError}=await userClient.auth.getUser(match[1]);
    if(userError || !user)return json({error:"ログインを確認できません"},401);

    const {data:owner,error:ownerError}=await userClient.rpc("nightdesk_is_owner");
    if(ownerError)return json({error:"権限確認に失敗しました"},503);
    if(owner!==true)return json({error:"システムオーナー専用です"},403);

    const [{data:stores,error:storeError},{data:backups,error:backupError}]=await Promise.all([
      userClient.from("nightdesk_stores").select("id,name").order("created_at",{ascending:true}),
      userClient.from("nightdesk_backups")
        .select("store_id,backup_date,created_at")
        .order("backup_date",{ascending:false}).limit(1000)
    ]);
    if(storeError || backupError)return json({error:"バックアップ履歴の取得に失敗しました"},503);

    const latest=new Map<string,BackupRow>();
    for(const backup of (backups??[]) as BackupRow[]){
      if(!latest.has(backup.store_id))latest.set(backup.store_id,backup);
    }

    const localNow=new Date(Date.now()+9*60*60*1000);
    const expected=new Date(localNow.getTime());
    // Vercel Hobby daily cron can run within its scheduled hour.
    // Do not mark today's run as overdue before 07:00 JST.
    if(localNow.getUTCHours()<7)expected.setUTCDate(expected.getUTCDate()-1);
    const expectedDate=expected.toISOString().slice(0,10);
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    const backupKeyKind=classifyKey(serviceKey);
    let backupProviderCode:string|null=null;
    let backupHttpStatus:number|null=null;
    let backupConnection:"ok"|"missing"|"error"=serviceKey?"error":"missing";
    let backupConnectionDetail:BackupConnectionDetail=serviceKey?"unknown_error":"missing_key";
    if(serviceKey){
      try{
        const serviceClient=createClient(url,serviceKey,{
          auth:{persistSession:false,autoRefreshToken:false}
        });
        const {error,status}=await serviceClient.from("nightdesk_stores")
          .select("id",{head:true,count:"exact"});
        backupHttpStatus=status;
        backupProviderCode=safeProviderCode(error?.code);
        backupConnection=error?"error":"ok";
        backupConnectionDetail=error
          ?classifyBackupError(error.code,error.message,status)
          :"ok";
      }catch(error){
        backupConnection="error";
        backupConnectionDetail=classifyBackupError(
          undefined,error instanceof Error?error.message:"");
      }
    }

    return json({
      checkedAt:new Date().toISOString(),
      expectedDate,
      cronSecretConfigured:Boolean(process.env.CRON_SECRET),
      backupConnection,
      backupConnectionDetail,
      backupKeyKind,
      backupProviderCode,
      backupHttpStatus,
      backupHistoryTruncated:(backups??[]).length===1000,
      stores:((stores??[]) as StoreRow[]).map(store=>({
        id:store.id,
        name:store.name,
        latestBackup:latest.get(store.id)?.backup_date??null,
        latestSavedAt:latest.get(store.id)?.created_at??null
      }))
    });
  }catch{
    return json({error:"バックアップ診断に失敗しました"},503);
  }
}

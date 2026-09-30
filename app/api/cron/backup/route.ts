import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic="force-dynamic";
export const maxDuration=60;

/** Scheduled at 05:00 JST. All privileges stay on the server. */
export async function GET(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(!secret || request.headers.get("authorization")!==`Bearer ${secret}`){
    return NextResponse.json({error:"Unauthorized"},{status:401});
  }
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !serviceKey){
    return NextResponse.json({error:"Cloud backup environment is not configured"},{status:503});
  }
  const client=createClient(url,serviceKey,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data,error}=await client.rpc("nightdesk_daily_backup");
  if(error){
    console.error("NIGHT DESK daily backup failed:",error.code,error.message);
    return NextResponse.json({error:"Backup failed"},{status:500});
  }
  return NextResponse.json({ok:true,stores:Number(data??0),completedAt:new Date().toISOString()});
}

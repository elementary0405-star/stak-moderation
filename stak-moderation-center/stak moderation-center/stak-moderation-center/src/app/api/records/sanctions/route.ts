import { guard,json,errorResponse,readJson,db,audit,stringValue } from "@/lib/http";
export async function GET(request:Request){
  const {response}=await guard(request,"trailModerator");if(response)return response;
  const u=new URL(request.url),search=(u.searchParams.get("search")??"").trim(),playerId=u.searchParams.get("playerId")??"",status=u.searchParams.get("status")??"",type=u.searchParams.get("sanctionType")??"",q=`%${search}%`;
  const limit=Math.min(Math.max(Number(u.searchParams.get("limit")??50)||50,1),100),offset=Math.max(Number(u.searchParams.get("offset")??0)||0,0);
  const rows=await db().prepare(`SELECT c.*,p.player_name AS playerName,p.discord_name AS discordName,p.discord_id AS discordId,
    CASE WHEN c.status='active' AND c.expires_at IS NOT NULL AND c.expires_at<=CURRENT_TIMESTAMP THEN 'expired' ELSE c.status END AS effectiveStatus
    FROM cases c JOIN players p ON p.id=c.player_id WHERE c.sanction_type IN ('permanent_ban','temporary_ban','project_exclusion')
    AND (?='' OR c.player_id=?) AND (?='' OR c.status=? OR (?='expired' AND c.expires_at<=CURRENT_TIMESTAMP AND c.status='active'))
    AND (?='' OR c.sanction_type=?) AND (?='' OR c.case_number LIKE ? OR p.player_name LIKE ? OR p.discord_id LIKE ?)
    ORDER BY c.created_at DESC LIMIT ? OFFSET ?`).bind(playerId,playerId,status,status,status,type,type,search,q,q,q,limit,offset).all();
  return json({sanctions:(rows.results??[]).map((r:any)=>({...r,caseNumber:r.case_number,playerId:r.player_id,sanctionType:r.sanction_type,startedAt:r.started_at,expiresAt:r.expires_at,createdAt:r.created_at}))});
}
export async function PATCH(request:Request){
  const {user,response}=await guard(request,"staffManager");if(response)return response;
  try{const b=await readJson<any>(request),id=stringValue(b.caseId,100),reason=stringValue(b.reason,1000);if(!id||!reason)return errorResponse("Case ID and reason for lifting the sanction are required.");
    const current=await db().prepare("SELECT * FROM cases WHERE id=? AND sanction_type IN ('permanent_ban','temporary_ban','project_exclusion')").bind(id).first<any>();if(!current)return errorResponse("Sanction not found.",404);
    if(current.status!=='active')return errorResponse("Only active sanctions can be lifted.",409);
    await db().prepare("UPDATE cases SET status='lifted',lifted_at=CURRENT_TIMESTAMP,lifted_by_discord_id=?,lifted_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(user!.discordUserId,reason,id).run();
    await audit({actorDiscordId:user!.discordUserId,entityType:"case",entityId:id,action:"sanction_lifted",oldValues:{status:current.status},newValues:{status:"lifted",reason},reason});
    return json({ok:true});
  }catch(e){return errorResponse(e instanceof Error?e.message:"Could not lift sanction.");}
}

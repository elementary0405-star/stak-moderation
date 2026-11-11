import { guard, json, errorResponse, readJson, db, newId, audit, stringValue, nullableString } from "@/lib/http";
const TYPES = ["permanent_ban","temporary_ban","unban","kick","timeout","warning","project_exclusion","other"];
export async function GET(request: Request) {
  const { response } = await guard(request,"trailModerator"); if(response) return response;
  const u=new URL(request.url), search=(u.searchParams.get("search")??"").trim(), playerId=u.searchParams.get("playerId")??"", status=u.searchParams.get("status")??"", sanctionType=u.searchParams.get("sanctionType")??"";
  const limit=Math.min(Math.max(Number(u.searchParams.get("limit")??50)||50,1),100), offset=Math.max(Number(u.searchParams.get("offset")??0)||0,0), q=`%${search}%`;
  const rows=await db().prepare(`SELECT c.*, p.player_name AS playerName, p.discord_name AS discordName, p.discord_id AS discordId
    FROM cases c JOIN players p ON p.id=c.player_id
    WHERE (?='' OR c.player_id=?) AND (?='' OR c.status=?) AND (?='' OR c.sanction_type=?) AND (?='' OR c.case_number LIKE ? OR p.player_name LIKE ? OR p.discord_id LIKE ?)
    ORDER BY c.created_at DESC LIMIT ? OFFSET ?`).bind(playerId,playerId,status,status,sanctionType,sanctionType,search,q,q,q,limit,offset).all();
  const count=await db().prepare(`SELECT COUNT(*) AS count FROM cases c JOIN players p ON p.id=c.player_id WHERE (?='' OR c.player_id=?) AND (?='' OR c.status=?) AND (?='' OR c.sanction_type=?) AND (?='' OR c.case_number LIKE ? OR p.player_name LIKE ? OR p.discord_id LIKE ?)`)
    .bind(playerId,playerId,status,status,sanctionType,sanctionType,search,q,q,q).first<{count:number}>();
  const cases=(rows.results??[]).map((c:any)=>({...c, caseNumber:c.case_number,playerId:c.player_id,playerName:c.playerName,discordName:c.discordName,discordId:c.discordId,sanctionType:c.sanction_type,startedAt:c.started_at,durationSeconds:c.duration_seconds,expiresAt:c.expires_at,createdAt:c.created_at}));
  return json({cases,pagination:{limit,offset,total:count?.count??0,returned:cases.length}});
}
export async function POST(request: Request) {
  const {user,response}=await guard(request,"trailModerator"); if(response)return response;
  try {
    const b=await readJson<any>(request), playerId=stringValue(b.playerId,80), sanctionType=stringValue(b.sanctionType,40), reason=stringValue(b.reason,2000);
    if(!playerId||!TYPES.includes(sanctionType)||!reason)return errorResponse("Player, valid sanction type and reason are required.");
    const player=await db().prepare("SELECT id FROM players WHERE id=?").bind(playerId).first(); if(!player)return errorResponse("Player record not found.",404);
    const id=newId(), year=new Date().getUTCFullYear(), caseNumber=`STAK-${year}-${Date.now().toString().slice(-7)}`;
    const duration=b.durationSeconds==null?null:Math.max(0,Number(b.durationSeconds)||0); const expiresAt=sanctionType==="temporary_ban"&&duration?new Date(Date.now()+duration*1000).toISOString():null;
    const staff=await db().prepare("SELECT id FROM staff_users WHERE discord_user_id=?").bind(user!.discordUserId).first<{id:string}>();
    await db().prepare(`INSERT INTO cases (id,case_number,player_id,game,sanction_type,reason,notes,duration_seconds,expires_at,created_by,created_by_discord_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id,caseNumber,playerId,nullableString(b.game,80),sanctionType,reason,nullableString(b.notes,4000),duration,expiresAt,staff?.id??null,user!.discordUserId).run();
    await audit({actorDiscordId:user!.discordUserId,entityType:"case",entityId:id,action:"created",newValues:{caseNumber,playerId,sanctionType},reason});
    return json({id,caseId:id,caseNumber},201);
  } catch(e){return errorResponse(e instanceof Error?e.message:"Could not create case.");}
}

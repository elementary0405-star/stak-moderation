import { guard, json, errorResponse, readJson, db, audit, nullableString, stringValue } from "@/lib/http";
type Context = { params: Promise<{ caseId: string }> };
export async function GET(request: Request, context: Context) {
  const {response}=await guard(request,"trailModerator"); if(response)return response;
  const {caseId}=await context.params;
  const c=await db().prepare(`SELECT c.*,p.player_name AS player_name,p.discord_name AS discord_name,p.discord_id AS discord_id
    FROM cases c JOIN players p ON p.id=c.player_id WHERE c.id=? OR c.case_number=?`).bind(caseId,caseId).first<any>();
  if(!c)return errorResponse("Case not found.",404);
  const [identities,evidence]=await Promise.all([
    db().prepare("SELECT id,game,game_player_id AS gamePlayerId,game_player_name AS gamePlayerName FROM player_identities WHERE player_id=? ORDER BY created_at").bind(c.player_id).all(),
    db().prepare("SELECT id,file_name AS fileName,evidence_url AS evidenceUrl,description,uploaded_by_discord_id AS uploadedByDiscordId,created_at AS createdAt FROM case_evidence WHERE case_id=? ORDER BY created_at DESC").bind(c.id).all(),
  ]);
  return json({case:{...c,id:c.id,caseNumber:c.case_number,playerId:c.player_id,playerName:c.player_name,discordName:c.discord_name,discordId:c.discord_id,game:c.game,sanctionType:c.sanction_type,startedAt:c.started_at,durationSeconds:c.duration_seconds,expiresAt:c.expires_at,liftedAt:c.lifted_at,liftedByDiscordId:c.lifted_by_discord_id,liftedReason:c.lifted_reason,createdByDiscordId:c.created_by_discord_id,createdAt:c.created_at,identities:identities.results??[],evidence:evidence.results??[]}});
}
export async function PATCH(request: Request, context: Context) {
  const {user,response}=await guard(request,"staffManager"); if(response)return response;
  const {caseId}=await context.params;
  try {
    const b=await readJson<any>(request); const current=await db().prepare("SELECT * FROM cases WHERE id=? OR case_number=?").bind(caseId,caseId).first<any>(); if(!current)return errorResponse("Case not found.",404);
    const next={game: b.game===undefined?current.game:nullableString(b.game,80), reason:b.reason===undefined?current.reason:stringValue(b.reason,2000), notes:b.notes===undefined?current.notes:nullableString(b.notes,4000)};
    if(!next.reason)return errorResponse("Reason cannot be empty.");
    await db().prepare("UPDATE cases SET game=?,reason=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(next.game,next.reason,next.notes,current.id).run();
    await audit({actorDiscordId:user!.discordUserId,entityType:"case",entityId:current.id,action:"updated",oldValues:{game:current.game,reason:current.reason,notes:current.notes},newValues:next});
    return json({ok:true});
  }catch(e){return errorResponse(e instanceof Error?e.message:"Could not update case.");}
}

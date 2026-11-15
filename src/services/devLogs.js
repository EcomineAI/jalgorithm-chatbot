import { supabase } from '../lib/supabase.js'
import {
  identifyOwnerTrashLogIds,
  loadLocalPruneDays,
  loadStarredLogIds,
  normalizePruneDays,
  saveLocalPruneDays,
} from '../lib/devTools.js'

function isMissingSchemaError(error) {
  const msg = String(error?.message || '').toLowerCase()
  return (
    msg.includes('could not find the function') ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist') ||
    error?.code === 'PGRST202' ||
    error?.code === 'PGRST205' ||
    error?.code === '42883' ||
    error?.code === '42P01'
  )
}

export async function fetchDevLogOverview() {
  const [devRes, ownerRes, statsRes] = await Promise.all([
    supabase
      .from('dev_chat_logs')
      .select('id, session_id, user_message, bot_reply, intent_classified, confidence, entities, is_trash, owner_logged, source, created_at')
      .order('created_at', { ascending: false })
      .limit(400),
    supabase
      .from('chat_logs')
      .select('id, session_id, user_message, bot_reply, intent_classified, confidence, entities, created_at')
      .order('created_at', { ascending: false })
      .limit(400),
    supabase.rpc('jal_get_dev_log_stats'),
  ])

  const localPrune = loadLocalPruneDays()
  let stats = {
    chatLogsCount: ownerRes.data?.length ?? 0,
    devLogsCount: devRes.data?.length ?? 0,
    maxRows: 1000,
    autoPruneDays: localPrune,
    statsSource: 'fallback',
  }

  if (!statsRes.error && statsRes.data?.ok) {
    stats = {
      chatLogsCount: statsRes.data.chatLogsCount ?? 0,
      devLogsCount: statsRes.data.devLogsCount ?? 0,
      maxRows: statsRes.data.maxRows ?? 1000,
      autoPruneDays: normalizePruneDays(statsRes.data.autoPruneDays, localPrune),
      statsSource: 'rpc',
    }
    saveLocalPruneDays(stats.autoPruneDays)
  }

  const missingDevTable = Boolean(devRes.error && isMissingSchemaError(devRes.error))
  const missingStatsRpc = Boolean(statsRes.error && isMissingSchemaError(statsRes.error))

  return {
    devLogs: devRes.data ?? [],
    ownerLogs: ownerRes.data ?? [],
    devError: missingDevTable ? '' : devRes.error?.message || '',
    ownerError: ownerRes.error?.message || '',
    stats,
    migrationMissing: missingDevTable || missingStatsRpc,
  }
}

export async function updateDevAutoPruneDays(days) {
  const cleanDays = saveLocalPruneDays(days)
  const { data, error } = await supabase.rpc('jal_set_dev_prune_days', { p_days: cleanDays })
  if (error) {
    return {
      ok: !isMissingSchemaError(error),
      localOnly: isMissingSchemaError(error),
      autoPruneDays: cleanDays,
      error: error.message,
    }
  }
  return { ok: Boolean(data?.ok), autoPruneDays: data?.autoPruneDays ?? cleanDays }
}

export async function deleteSessionLogs(
  { sessionId = null, devIds = [], ownerTrashIds = [] },
  { client = supabase } = {},
) {
  const { data, error } = await client.rpc('jal_delete_log_session', {
    p_session_id: sessionId,
    p_dev_ids: devIds,
    p_owner_trash_ids: ownerTrashIds,
  })

  if (!error && data?.ok) {
    return {
      ok: true,
      deletedDev: data.deletedDev ?? 0,
      deletedOwnerTrash: data.deletedOwnerTrash ?? 0,
    }
  }

  // Fallback direct delete when RPC migration isn't applied yet.
  let deletedDev = 0
  let deletedOwnerTrash = 0

  if (devIds.length > 0) {
    const devDel = await client.from('dev_chat_logs').delete().in('id', devIds).select('id')
    if (devDel.error && !isMissingSchemaError(devDel.error)) {
      return { ok: false, error: devDel.error.message }
    }
    if (!devDel.error) {
      deletedDev = Array.isArray(devDel.data) ? devDel.data.length : devIds.length
    }
  }

  if (ownerTrashIds.length > 0) {
    const ownerDel = await client.from('chat_logs').delete().in('id', ownerTrashIds).select('id')
    if (ownerDel.error) return { ok: false, error: ownerDel.error.message }
    deletedOwnerTrash = Array.isArray(ownerDel.data) ? ownerDel.data.length : 0
    if (deletedOwnerTrash === 0) {
      return {
        ok: false,
        error:
          'Delete blocked by database permissions. Run 20261116_dev_cleanup_and_retention.sql (or setup_all.sql) in Supabase SQL Editor.',
      }
    }
  }

  if (devIds.length === 0 && ownerTrashIds.length === 0) {
    return {
      ok: false,
      error: 'No trash turns found in this session to delete (real client leads stay protected).',
    }
  }

  return { ok: true, deletedDev, deletedOwnerTrash }
}

export async function emptyAllTrashSessions(sessions = []) {
  const trashSessions = sessions.filter((s) => s.isTrashSession)
  const devIds = trashSessions.flatMap((s) => s.devIds)
  const ownerTrashIds = trashSessions.flatMap((s) => s.ownerTrashIds)

  if (devIds.length === 0 && ownerTrashIds.length === 0) {
    return { ok: true, deletedDev: 0, deletedOwnerTrash: 0, deletedSessions: 0 }
  }

  const res = await deleteSessionLogs({ sessionId: null, devIds, ownerTrashIds })
  return { ...res, deletedSessions: trashSessions.length }
}

export async function pruneExpiredLogs(days = null, { ownerLogs = [], devLogs = [] } = {}) {
  const { data, error } = await supabase.rpc('jal_prune_dev_and_trash_logs', {
    p_days: days === null ? null : normalizePruneDays(days, 3),
  })

  if (!error && data?.ok) {
    return {
      ok: true,
      skipped: Boolean(data.skipped),
      autoPruneDays: data.autoPruneDays ?? 0,
      deletedDev: data.deletedDev ?? 0,
      deletedOwnerTrash: data.deletedOwnerTrash ?? 0,
    }
  }

  if (error && !isMissingSchemaError(error)) {
    return { ok: false, error: error.message }
  }

  // Fallback client-side prune if RPC isn't installed yet.
  const activeDays = normalizePruneDays(days === null ? loadLocalPruneDays() : days, 3)
  if (activeDays <= 0) {
    return { ok: true, skipped: true, autoPruneDays: 0, deletedDev: 0, deletedOwnerTrash: 0 }
  }

  const cutoffMs = Date.now() - activeDays * 86_400_000
  const expiredDevIds = (devLogs ?? [])
    .filter((r) => r.created_at && new Date(r.created_at).getTime() < cutoffMs)
    .map((r) => r.id)
    .filter(Boolean)

  const starred = loadStarredLogIds()
  const trashOwnerSet = new Set(identifyOwnerTrashLogIds(ownerLogs, starred))
  const expiredOwnerTrashIds = (ownerLogs ?? [])
    .filter((r) => r.id && trashOwnerSet.has(r.id) && r.created_at && new Date(r.created_at).getTime() < cutoffMs)
    .map((r) => r.id)

  if (expiredDevIds.length === 0 && expiredOwnerTrashIds.length === 0) {
    return { ok: true, skipped: false, autoPruneDays: activeDays, deletedDev: 0, deletedOwnerTrash: 0 }
  }

  const delRes = await deleteSessionLogs({
    sessionId: null,
    devIds: expiredDevIds,
    ownerTrashIds: expiredOwnerTrashIds,
  })
  return { ...delRes, skipped: false, autoPruneDays: activeDays }
}

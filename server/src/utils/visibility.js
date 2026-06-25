// visibility.js — server-side fog-of-war computation
// All operations use the admin (service-role) client to bypass RLS.
//
// Axial hex adjacency: the six neighbours of (q, r) are:
//   (q+1,r), (q-1,r), (q,r+1), (q,r-1), (q+1,r-1), (q-1,r+1)

const HEX_NEIGHBOURS = [
  [+1, 0], [-1, 0],
  [0, +1], [0, -1],
  [+1, -1], [-1, +1],
];

/**
 * Compute visibility for a player's realm over all regions of a body.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminDb
 * @param {string} realmId
 * @param {string} bodyId
 * @returns {Promise<{ visible: Set<string>, scouted: Set<string> }>}
 *   visible — region IDs currently visible to this realm
 *   scouted — region IDs previously scouted but NOT currently visible
 */
export async function computeVisibility(adminDb, realmId, bodyId) {
  // 1. Fetch the body (need system_id and its hex position in the system sector grid).
  const { data: body, error: bodyErr } = await adminDb
    .from('celestial_bodies')
    .select('id, system_id, hex_q, hex_r')
    .eq('id', bodyId)
    .single();
  if (bodyErr || !body) return { visible: new Set(), scouted: new Set() };

  // 2. Fetch all regions for this body.
  const { data: regions, error: regErr } = await adminDb
    .from('regions')
    .select('id, hex_q, hex_r')
    .eq('body_id', bodyId);
  if (regErr || !regions || regions.length === 0) {
    return { visible: new Set(), scouted: new Set() };
  }

  // Build lookup maps for fast neighbour resolution.
  const regionByHex = new Map(); // "q,r" → region id
  for (const r of regions) {
    regionByHex.set(`${r.hex_q},${r.hex_r}`, r.id);
  }
  const regionHexById = new Map(); // region id → { hex_q, hex_r }
  for (const r of regions) {
    regionHexById.set(r.id, { hex_q: r.hex_q, hex_r: r.hex_r });
  }

  const regionIds = regions.map(r => r.id);
  const directlyVisible = new Set(); // region IDs visible before adjacency expansion

  // 3a. Regions where the realm has at least one control box.
  // Fetch control boxes owned by this realm, joining to settlements to get region_id.
  // We query settlements separately to avoid deep-nesting PostgREST issues.
  const { data: ownedBoxSettlements } = await adminDb
    .from('control_boxes')
    .select('settlement_id')
    .eq('owner_realm_id', realmId);

  if (ownedBoxSettlements && ownedBoxSettlements.length > 0) {
    const ownedSettlementIds = [...new Set(ownedBoxSettlements.map(b => b.settlement_id))];
    const { data: settRows } = await adminDb
      .from('settlements')
      .select('id, region_id')
      .in('id', ownedSettlementIds)
      .in('region_id', regionIds);
    for (const s of settRows ?? []) {
      if (s.region_id) directlyVisible.add(s.region_id);
    }
  }

  // 3b. Regions where the realm has ground units.
  const { data: unitRows } = await adminDb
    .from('units')
    .select('region_id')
    .eq('realm_id', realmId)
    .not('region_id', 'is', null)
    .in('region_id', regionIds);

  for (const u of unitRows ?? []) {
    if (u.region_id) directlyVisible.add(u.region_id);
  }

  // 3c. If the realm has a ship in the sector matching this body's hex → all regions visible.
  const { data: shipRows } = await adminDb
    .from('units')
    .select('id')
    .eq('realm_id', realmId)
    .eq('system_id', body.system_id)
    .eq('sector_hex_q', body.hex_q)
    .eq('sector_hex_r', body.hex_r)
    .is('region_id', null) // ships have no region_id
    .limit(1);

  if (shipRows && shipRows.length > 0) {
    // Ship in sector — all regions on this body are visible.
    for (const r of regions) directlyVisible.add(r.id);
  }

  // 3d. Expand directlyVisible by one hex ring (axial adjacency).
  const visible = new Set(directlyVisible);
  for (const regionId of directlyVisible) {
    const hex = regionHexById.get(regionId);
    if (!hex) continue;
    for (const [dq, dr] of HEX_NEIGHBOURS) {
      const key = `${hex.hex_q + dq},${hex.hex_r + dr}`;
      const neighbourId = regionByHex.get(key);
      if (neighbourId) visible.add(neighbourId);
    }
  }

  // 4. Fetch previously scouted regions for this realm on this body.
  const { data: scoutedRows } = await adminDb
    .from('scouted_regions')
    .select('region_id')
    .eq('realm_id', realmId)
    .in('region_id', regionIds);

  const scouted = new Set();
  for (const row of scoutedRows ?? []) {
    if (!visible.has(row.region_id)) {
      scouted.add(row.region_id);
    }
  }

  return { visible, scouted };
}

/**
 * Upsert newly visible regions into scouted_regions so they remain "scouted"
 * even after the player's units/control move away.
 *
 * Uses last_scouted_turn = 0 as a placeholder until turn tracking is wired up.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminDb
 * @param {string} realmId
 * @param {string[]} visibleRegionIds
 */
export async function markScouted(adminDb, realmId, visibleRegionIds) {
  if (!visibleRegionIds || visibleRegionIds.length === 0) return;

  const rows = visibleRegionIds.map(regionId => ({
    realm_id: realmId,
    region_id: regionId,
    last_scouted_turn: 0,
  }));

  await adminDb
    .from('scouted_regions')
    .upsert(rows, { onConflict: 'realm_id,region_id' });
}

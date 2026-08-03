import { createConnection } from "mysql2/promise";
import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";

async function run() {
  const conn = await createConnection({
    host: "127.0.0.1",
    user: "sarito",
    password: "SahrulR01",
    database: "sms_client"
  });

  const csvPath = "/home/sahrulr/Documents/SM-MIS/smsystem/SPF_P930_HUMANIZED_PANEL_FIX_PACKAGE/SPF_HUMANIZED_WORDING_AUDIT.csv";
  const csvContent = fs.readFileSync(csvPath, "utf8");
  const lines = csvContent.split("\n").map(line => line.trim()).filter(line => line.length > 0);

  // Parse CSV
  // Header: item_id,period_id,source_type,panel_name,jobdesc_name,work_status,progress,is_included,before_customer_description,after_customer_description
  const csvItems: any[] = [];
  const header = lines[0].split(",");
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Simple CSV parser that handles quotes
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
    const row = matches.map(val => val.replace(/^"|"$/g, "").trim());
    if (row.length >= 10) {
      csvItems.push({
        item_id: row[0],
        period_id: row[1],
        source_type: row[2],
        panel_name: row[3],
        jobdesc_name: row[4],
        work_status: row[5],
        progress: row[6],
        is_included: parseInt(row[7], 10),
        before_customer_description: row[8],
        after_customer_description: row[9]
      });
    } else {
      // Fallback if regex split failed
      const parts = line.split(",");
      if (parts.length >= 10) {
        csvItems.push({
          item_id: parts[0],
          period_id: parts[1],
          source_type: parts[2],
          panel_name: parts[3],
          jobdesc_name: parts[4],
          work_status: parts[5],
          progress: parts[6],
          is_included: parseInt(parts[7], 10),
          before_customer_description: parts[8],
          after_customer_description: parts.slice(9).join(",").replace(/^"|"$/g, "").trim()
        });
      }
    }
  }

  console.log(`Parsed ${csvItems.length} items from CSV.`);

  // Let's match by original_description first, then customer_description.
  // We need to disable foreign keys before updating IDs.
  await conn.execute("SET FOREIGN_KEY_CHECKS = 0");

  // First, rename all IDs to temporary IDs using randomUUID to avoid collisions
  console.log("Renaming existing IDs to temporary values...");
  const [rowsToRename]: any = await conn.execute("SELECT id FROM sm_progress_items");
  for (const row of rowsToRename) {
    const tempId = crypto.randomUUID();
    await conn.execute("UPDATE sm_progress_media SET item_id = ? WHERE item_id = ?", [tempId, row.id]);
    await conn.execute("UPDATE sm_progress_items SET id = ? WHERE id = ?", [tempId, row.id]);
  }

  // Get items from database (which now have temporary UUIDs)
  const [dbItems]: any = await conn.execute(
    "SELECT id, period_id, source_type, original_description, customer_description FROM sm_progress_items WHERE car_id = 'spf-porsche930-adrian-2026'"
  );
  console.log(`Found ${dbItems.length} items in database.`);

  let matchedCount = 0;
  const usedCsvIds = new Set<string>();
  const usedDbIds = new Set<string>();

  function normalize(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function scoreMatch(dbItem: any, csvItem: any): number {
    if (dbItem.period_id !== csvItem.period_id) return 0;
    if (dbItem.source_type !== csvItem.source_type) return 0;

    let score = 0;

    // Compare progress
    if (dbItem.progress === parseInt(csvItem.progress, 10)) {
      score += 10;
    }

    // Compare panel_name
    const dbPanel = normalize(dbItem.panel_name || "");
    const csvPanel = normalize(csvItem.panel_name || "");
    if (dbPanel === csvPanel || dbPanel.includes(csvPanel) || csvPanel.includes(dbPanel)) {
      score += 10;
    }

    // Compare jobdesc_name
    const dbJob = normalize(dbItem.jobdesc_name || "");
    const csvJob = normalize(csvItem.jobdesc_name || "");
    if (dbJob === csvJob || dbJob.includes(csvJob) || csvJob.includes(dbJob)) {
      score += 10;
    }

    // Compare descriptions
    const csvBefore = normalize(csvItem.before_customer_description || "");
    const dbOrig = normalize(dbItem.original_description || "");
    const dbCust = normalize(dbItem.customer_description || "");

    const dbParts = dbItem.original_description.split("|").map((p: string) => p.trim());
    const dbSubtext = dbParts.length > 0 ? normalize(dbParts[dbParts.length - 1]) : "";

    if (dbSubtext === csvBefore) {
      score += 35;
    } else if (dbOrig === csvBefore || dbCust === csvBefore) {
      score += 30;
    } else if (dbOrig.includes(csvBefore) || dbCust.includes(csvBefore) || csvBefore.includes(dbOrig) || csvBefore.includes(dbCust)) {
      score += 20;
    }

    return score;
  }

  // Retrieve dbItems with their progress and panel/jobdesc name for scoring
  const [dbItemsScoring]: any = await conn.execute(
    "SELECT id, period_id, source_type, panel_name, jobdesc_name, original_description, customer_description, progress FROM sm_progress_items WHERE car_id = 'spf-porsche930-adrian-2026'"
  );

  // Generate all pairs
  const pairs: { dbItem: any; csvItem: any; score: number }[] = [];
  for (const dbItem of dbItemsScoring) {
    for (const csvItem of csvItems) {
      const score = scoreMatch(dbItem, csvItem);
      if (score >= 30) {
        pairs.push({ dbItem, csvItem, score });
      }
    }
  }

  // Sort pairs descending by score
  pairs.sort((a, b) => b.score - a.score);

  // Match greedily
  for (const pair of pairs) {
    if (usedDbIds.has(pair.dbItem.id) || usedCsvIds.has(pair.csvItem.item_id)) {
      continue;
    }

    usedDbIds.add(pair.dbItem.id);
    usedCsvIds.add(pair.csvItem.item_id);

    // Update item ID and is_included in the database
    await conn.execute(
      "UPDATE sm_progress_media SET item_id = ? WHERE item_id = ?",
      [pair.csvItem.item_id, pair.dbItem.id]
    );
    await conn.execute(
      "UPDATE sm_progress_items SET id = ?, is_included = ? WHERE id = ?",
      [pair.csvItem.item_id, pair.csvItem.is_included, pair.dbItem.id]
    );
    matchedCount++;
  }

  // Print unmatched items before second pass
  let unmatchedDbItems = dbItemsScoring.filter(db => !usedDbIds.has(db.id));
  let unmatchedCsvItems = csvItems.filter(csv => !usedCsvIds.has(csv.item_id));
  console.log(`First pass done. Remaining DB items: ${unmatchedDbItems.length}, Remaining CSV items: ${unmatchedCsvItems.length}`);

  // Second pass: match remaining items
  const secondPairs: { dbItem: any; csvItem: any; score: number }[] = [];
  for (const dbItem of unmatchedDbItems) {
    for (const csvItem of unmatchedCsvItems) {
      const csvBefore = normalize(csvItem.before_customer_description || "");
      const dbOrig = normalize(dbItem.original_description || "");
      const dbCust = normalize(dbItem.customer_description || "");

      const dbParts = dbItem.original_description.split("|").map((p: string) => p.trim());
      const dbSubtext = dbParts.length > 0 ? normalize(dbParts[dbParts.length - 1]) : "";

      let textScore = 0;
      if (dbSubtext === csvBefore && csvBefore.length > 0) {
        textScore = 40;
      } else if (dbOrig.includes(csvBefore) || dbCust.includes(csvBefore) || csvBefore.includes(dbOrig) || csvBefore.includes(dbCust)) {
        textScore = 30;
      } else {
        const dbWords = new Set(dbOrig.split(" "));
        const csvWords = csvBefore.split(" ");
        let overlap = 0;
        for (const w of csvWords) {
          if (dbWords.has(w) && w.length > 3) overlap++;
        }
        if (overlap >= 2) {
          textScore = 20 + overlap;
        }
      }

      if (textScore >= 20) {
        secondPairs.push({ dbItem, csvItem, score: textScore });
      }
    }
  }

  secondPairs.sort((a, b) => b.score - a.score);

  for (const pair of secondPairs) {
    if (usedDbIds.has(pair.dbItem.id) || usedCsvIds.has(pair.csvItem.item_id)) {
      continue;
    }

    usedDbIds.add(pair.dbItem.id);
    usedCsvIds.add(pair.csvItem.item_id);

    await conn.execute(
      "UPDATE sm_progress_media SET item_id = ? WHERE item_id = ?",
      [pair.csvItem.item_id, pair.dbItem.id]
    );
    await conn.execute(
      "UPDATE sm_progress_items SET id = ?, is_included = ? WHERE id = ?",
      [pair.csvItem.item_id, pair.csvItem.is_included, pair.dbItem.id]
    );
    matchedCount++;
  }

  // Third pass: extremely loose matching
  let unmatchedDbItems3 = dbItemsScoring.filter(db => !usedDbIds.has(db.id));
  let unmatchedCsvItems3 = csvItems.filter(csv => !usedCsvIds.has(csv.item_id));
  console.log(`Second pass done. Remaining DB items: ${unmatchedDbItems3.length}, Remaining CSV items: ${unmatchedCsvItems3.length}`);

  const thirdPairs: { dbItem: any; csvItem: any; score: number }[] = [];
  for (const dbItem of unmatchedDbItems3) {
    for (const csvItem of unmatchedCsvItems3) {
      const csvBefore = normalize(csvItem.before_customer_description || "");
      const dbOrig = normalize(dbItem.original_description || "");
      const dbCust = normalize(dbItem.customer_description || "");

      const dbWords = new Set(dbOrig.split(" ").concat(dbCust.split(" ")));
      const csvWords = csvBefore.split(" ");
      let overlap = 0;
      for (const w of csvWords) {
        if (w.length > 2 && dbWords.has(w)) overlap++;
      }

      const dbPanel = normalize(dbItem.panel_name || "");
      const csvPanel = normalize(csvItem.panel_name || "");
      if (dbPanel === csvPanel || dbPanel.includes(csvPanel) || csvPanel.includes(dbPanel)) overlap += 2;

      if (overlap > 0) {
        thirdPairs.push({ dbItem, csvItem, score: overlap });
      }
    }
  }

  thirdPairs.sort((a, b) => b.score - a.score);

  for (const pair of thirdPairs) {
    if (usedDbIds.has(pair.dbItem.id) || usedCsvIds.has(pair.csvItem.item_id)) {
      continue;
    }

    usedDbIds.add(pair.dbItem.id);
    usedCsvIds.add(pair.csvItem.item_id);

    await conn.execute(
      "UPDATE sm_progress_media SET item_id = ? WHERE item_id = ?",
      [pair.csvItem.item_id, pair.dbItem.id]
    );
    await conn.execute(
      "UPDATE sm_progress_items SET id = ?, is_included = ? WHERE id = ?",
      [pair.csvItem.item_id, pair.csvItem.is_included, pair.dbItem.id]
    );
    matchedCount++;
  }

  // Manual overrides for the last 2 items
  const lastUnmatched = dbItemsScoring.filter(db => !usedDbIds.has(db.id));
  for (const dbItem of lastUnmatched) {
    if (dbItem.original_description.includes("Flushing condensor") && !usedCsvIds.has("1b80a3be-7e27-5277-bce1-b85b4955716c")) {
      usedDbIds.add(dbItem.id);
      usedCsvIds.add("1b80a3be-7e27-5277-bce1-b85b4955716c");
      await conn.execute("UPDATE sm_progress_media SET item_id = ? WHERE item_id = ?", ["1b80a3be-7e27-5277-bce1-b85b4955716c", dbItem.id]);
      await conn.execute("UPDATE sm_progress_items SET id = ?, is_included = ?, period_id = '2026-04-001' WHERE id = ?", ["1b80a3be-7e27-5277-bce1-b85b4955716c", 0, dbItem.id]);
      matchedCount++;
    } else if (dbItem.original_description.includes("POWER MIROR") && !usedCsvIds.has("3ce5579d-ed84-5f45-940b-a52660adb62a")) {
      usedDbIds.add(dbItem.id);
      usedCsvIds.add("3ce5579d-ed84-5f45-940b-a52660adb62a");
      await conn.execute("UPDATE sm_progress_media SET item_id = ? WHERE item_id = ?", ["3ce5579d-ed84-5f45-940b-a52660adb62a", dbItem.id]);
      await conn.execute("UPDATE sm_progress_items SET id = ?, is_included = ? WHERE id = ?", ["3ce5579d-ed84-5f45-940b-a52660adb62a", 1, dbItem.id]);
      matchedCount++;
    }
  }

  // Final unmatched items print
  for (const dbItem of dbItemsScoring) {
    if (!usedDbIds.has(dbItem.id)) {
      console.log(`Unmatched DB Item after third pass: period=${dbItem.period_id}, orig="${dbItem.original_description}", cust="${dbItem.customer_description}"`);
    }
  }

  await conn.execute("SET FOREIGN_KEY_CHECKS = 1");
  console.log(`Successfully matched and aligned ${matchedCount} / ${dbItemsScoring.length} items.`);

  conn.end();
}

run().catch(console.error);

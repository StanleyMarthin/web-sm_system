#!/usr/bin/env node

import mysql from "mysql2/promise";
import fs from "node:fs/promises";
import path from "node:path";

const DATABASES = ["sms_db", "sms_log", "sms_purchase", "sms_warehouse"];

function getConfig(prefix, fallbackPort, fallbackUser, fallbackPassword) {
  return {
    host: process.env[`${prefix}_HOST`] || "127.0.0.1",
    port: Number(process.env[`${prefix}_PORT`] || fallbackPort),
    user: process.env[`${prefix}_USER`] || fallbackUser,
    password: process.env[`${prefix}_PASSWORD`] || fallbackPassword,
  };
}

const localConfig = getConfig("LOCAL", 3306, "sarito", "SahrulR01");
const tunnelConfig = getConfig("TUNNEL", 3307, "root", "@pds0208");
const outputDir = process.env.OUTPUT_DIR || "/tmp/schema-compare";

function pick(row, ...keys) {
  for (const key of keys) {
    if (row[key] !== undefined) {
      return row[key];
    }
  }
  return undefined;
}

function normalizeRow(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replace(/`/g, "``")}\``;
}

function quoteValue(value) {
  if (value === null) {
    return "NULL";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fetchMap(connection, sql, params, keyBuilder) {
  const [rows] = await connection.query(sql, params);
  const map = new Map();
  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);
    map.set(keyBuilder(row), row);
  }
  return map;
}

async function fetchSchemaSnapshot(connection, schema) {
  const tables = await fetchMap(
    connection,
    `
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = ?
      ORDER BY table_name
    `,
    [schema],
    (row) => pick(row, "table_name", "TABLE_NAME"),
  );

  const columns = await fetchMap(
    connection,
    `
      SELECT
        table_name,
        column_name,
        ordinal_position,
        column_type,
        is_nullable,
        column_default,
        extra,
        column_comment,
        character_set_name,
        collation_name
      FROM information_schema.columns
      WHERE table_schema = ?
      ORDER BY table_name, ordinal_position
    `,
    [schema],
    (row) => `${pick(row, "table_name", "TABLE_NAME")}.${pick(row, "column_name", "COLUMN_NAME")}`,
  );

  const indexes = await fetchMap(
    connection,
    `
      SELECT
        table_name,
        index_name,
        non_unique,
        seq_in_index,
        column_name,
        sub_part,
        index_type,
        collation
      FROM information_schema.statistics
      WHERE table_schema = ?
      ORDER BY table_name, index_name, seq_in_index
    `,
    [schema],
    (row) =>
      [
        pick(row, "table_name", "TABLE_NAME"),
        pick(row, "index_name", "INDEX_NAME"),
        pick(row, "seq_in_index", "SEQ_IN_INDEX"),
        pick(row, "column_name", "COLUMN_NAME"),
        pick(row, "sub_part", "SUB_PART") ?? "",
      ].join("|"),
  );

  const [viewRows] = await connection.query(
    `
      SELECT table_name, view_definition
      FROM information_schema.views
      WHERE table_schema = ?
      ORDER BY table_name
    `,
    [schema],
  );

  const [triggerRows] = await connection.query(
    `
      SELECT trigger_name, event_object_table, action_timing, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE trigger_schema = ?
      ORDER BY trigger_name
    `,
    [schema],
  );

  const views = viewRows.map(normalizeRow);
  const triggers = triggerRows.map(normalizeRow);

  const createStatements = new Map();
  for (const row of tables.values()) {
    const target = `${quoteIdentifier(schema)}.${quoteIdentifier(row.table_name)}`;
    const command = row.table_type === "VIEW" ? `SHOW CREATE VIEW ${target}` : `SHOW CREATE TABLE ${target}`;
    const [createResult] = await connection.query(command);
    const createRow = normalizeRow(createResult[0]);
    const definitionKey = Object.keys(createRow).find((key) => key.toLowerCase().startsWith("create "));
    if (!definitionKey) {
      throw new Error(`Create statement not found for ${schema}.${row.table_name}`);
    }
    createStatements.set(row.table_name, createRow[definitionKey]);
  }

  return {
    tables,
    columns,
    indexes,
    views,
    triggers,
    createStatements,
  };
}

function buildColumnDefinition(column) {
  const parts = [quoteIdentifier(column.column_name), column.column_type];
  parts.push(column.is_nullable === "NO" ? "NOT NULL" : "NULL");

  if (column.column_default !== null) {
    const upperDefault = String(column.column_default).toUpperCase();
    const rawDefaults = new Set([
      "CURRENT_TIMESTAMP",
      "CURRENT_TIMESTAMP()",
      "NULL",
    ]);
    if (rawDefaults.has(upperDefault) || upperDefault.startsWith("CURRENT_TIMESTAMP")) {
      parts.push(`DEFAULT ${column.column_default}`);
    } else {
      parts.push(`DEFAULT ${quoteValue(column.column_default)}`);
    }
  } else if (column.is_nullable === "YES") {
    parts.push("DEFAULT NULL");
  }

  if (column.extra) {
    parts.push(column.extra);
  }

  if (column.column_comment) {
    parts.push(`COMMENT ${quoteValue(column.column_comment)}`);
  }

  return parts.join(" ");
}

function groupIndexes(indexMap) {
  const grouped = new Map();
  for (const row of indexMap.values()) {
    const key = `${row.table_name}.${row.index_name}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(row);
  }

  for (const rows of grouped.values()) {
    rows.sort((left, right) => left.seq_in_index - right.seq_in_index);
  }

  return grouped;
}

function renderIndexStatement(schema, rows) {
  const first = rows[0];
  if (first.index_name === "PRIMARY") {
    return null;
  }

  const columns = rows
    .map((row) => {
      const column = quoteIdentifier(row.column_name);
      return row.sub_part ? `${column}(${row.sub_part})` : column;
    })
    .join(", ");

  const unique = first.non_unique === 0 ? "UNIQUE " : "";
  return `CREATE ${unique}INDEX ${quoteIdentifier(first.index_name)} ON ${quoteIdentifier(schema)}.${quoteIdentifier(first.table_name)} (${columns});`;
}

function summarizeDiffs(schema, localSnapshot, tunnelSnapshot) {
  const localTables = new Set(localSnapshot.tables.keys());
  const tunnelTables = new Set(tunnelSnapshot.tables.keys());

  const missingTables = [...tunnelTables].filter((name) => !localTables.has(name));
  const extraTables = [...localTables].filter((name) => !tunnelTables.has(name));

  const missingColumns = [];
  const changedColumns = [];

  for (const [key, tunnelColumn] of tunnelSnapshot.columns.entries()) {
    const localColumn = localSnapshot.columns.get(key);
    if (!localColumn) {
      missingColumns.push(tunnelColumn);
      continue;
    }

    const comparableFields = [
      "column_type",
      "is_nullable",
      "column_default",
      "extra",
      "column_comment",
    ];

    const differences = comparableFields.filter(
      (field) => String(localColumn[field] ?? "") !== String(tunnelColumn[field] ?? ""),
    );
    if (differences.length > 0) {
      changedColumns.push({
        table_name: tunnelColumn.table_name,
        column_name: tunnelColumn.column_name,
        differences,
        local: localColumn,
        tunnel: tunnelColumn,
      });
    }
  }

  const localGroupedIndexes = groupIndexes(localSnapshot.indexes);
  const tunnelGroupedIndexes = groupIndexes(tunnelSnapshot.indexes);

  const missingIndexes = [];
  for (const [key, rows] of tunnelGroupedIndexes.entries()) {
    if (!localGroupedIndexes.has(key)) {
      missingIndexes.push(rows);
    }
  }

  const extraIndexes = [];
  for (const [key, rows] of localGroupedIndexes.entries()) {
    if (!tunnelGroupedIndexes.has(key)) {
      extraIndexes.push(rows);
    }
  }

  const localViews = new Set(localSnapshot.views.map((row) => row.table_name));
  const tunnelViews = new Set(tunnelSnapshot.views.map((row) => row.table_name));
  const missingViews = [...tunnelViews].filter((name) => !localViews.has(name));
  const extraViews = [...localViews].filter((name) => !tunnelViews.has(name));

  const localTriggers = new Set(localSnapshot.triggers.map((row) => row.trigger_name));
  const tunnelTriggers = new Set(tunnelSnapshot.triggers.map((row) => row.trigger_name));
  const missingTriggers = [...tunnelTriggers].filter((name) => !localTriggers.has(name));
  const extraTriggers = [...localTriggers].filter((name) => !tunnelTriggers.has(name));

  return {
    schema,
    missingTables,
    extraTables,
    missingColumns,
    changedColumns,
    missingIndexes,
    extraIndexes,
    missingViews,
    extraViews,
    missingTriggers,
    extraTriggers,
  };
}

function buildSyncSql(schema, localSnapshot, tunnelSnapshot, diffs) {
  const statements = [];

  for (const tableName of diffs.missingTables) {
    statements.push(`${tunnelSnapshot.createStatements.get(tableName)};`);
  }

  const addedColumnsByTable = new Map();
  for (const column of diffs.missingColumns) {
    const key = column.table_name;
    if (!addedColumnsByTable.has(key)) {
      addedColumnsByTable.set(key, []);
    }
    addedColumnsByTable.get(key).push(column);
  }

  for (const [tableName, columns] of addedColumnsByTable.entries()) {
    const orderedColumns = columns.sort((left, right) => left.ordinal_position - right.ordinal_position);
    const clauses = orderedColumns.map((column) => {
      const localColumns = [...localSnapshot.columns.values()]
        .filter((row) => row.table_name === tableName)
        .sort((left, right) => left.ordinal_position - right.ordinal_position);
      const previousColumn = localColumns
        .filter((row) => row.ordinal_position < column.ordinal_position)
        .at(-1);
      const positionClause = previousColumn
        ? `AFTER ${quoteIdentifier(previousColumn.column_name)}`
        : "FIRST";
      return `ADD COLUMN ${buildColumnDefinition(column)} ${positionClause}`;
    });
    statements.push(
      `ALTER TABLE ${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}\n  ${clauses.join(",\n  ")};`,
    );
  }

  for (const rows of diffs.missingIndexes) {
    const statement = renderIndexStatement(schema, rows);
    if (statement) {
      statements.push(statement);
    }
  }

  for (const viewName of diffs.missingViews) {
    statements.push(`${tunnelSnapshot.createStatements.get(viewName)};`);
  }

  return statements;
}

async function writeReport(dirPath, schema, diffs) {
  const lines = [
    `Schema: ${schema}`,
    `Missing tables in local: ${diffs.missingTables.length}`,
    `Extra tables in local: ${diffs.extraTables.length}`,
    `Missing columns in local: ${diffs.missingColumns.length}`,
    `Changed shared columns: ${diffs.changedColumns.length}`,
    `Missing indexes in local: ${diffs.missingIndexes.length}`,
    `Extra indexes in local: ${diffs.extraIndexes.length}`,
    `Missing views in local: ${diffs.missingViews.length}`,
    `Extra views in local: ${diffs.extraViews.length}`,
    `Missing triggers in local: ${diffs.missingTriggers.length}`,
    `Extra triggers in local: ${diffs.extraTriggers.length}`,
    "",
  ];

  if (diffs.missingTables.length > 0) {
    lines.push("[missing_tables]");
    lines.push(...diffs.missingTables);
    lines.push("");
  }

  if (diffs.extraTables.length > 0) {
    lines.push("[extra_tables]");
    lines.push(...diffs.extraTables);
    lines.push("");
  }

  if (diffs.missingColumns.length > 0) {
    lines.push("[missing_columns]");
    lines.push(...diffs.missingColumns.map((column) => `${column.table_name}.${column.column_name}`));
    lines.push("");
  }

  if (diffs.changedColumns.length > 0) {
    lines.push("[changed_columns]");
    lines.push(
      ...diffs.changedColumns.map(
        (column) =>
          `${column.table_name}.${column.column_name} :: ${column.differences.join(", ")}`,
      ),
    );
    lines.push("");
  }

  if (diffs.missingIndexes.length > 0) {
    lines.push("[missing_indexes]");
    lines.push(
      ...diffs.missingIndexes.map((rows) => `${rows[0].table_name}.${rows[0].index_name}`),
    );
    lines.push("");
  }

  if (diffs.extraIndexes.length > 0) {
    lines.push("[extra_indexes]");
    lines.push(...diffs.extraIndexes.map((rows) => `${rows[0].table_name}.${rows[0].index_name}`));
    lines.push("");
  }

  if (diffs.missingViews.length > 0) {
    lines.push("[missing_views]");
    lines.push(...diffs.missingViews);
    lines.push("");
  }

  if (diffs.extraViews.length > 0) {
    lines.push("[extra_views]");
    lines.push(...diffs.extraViews);
    lines.push("");
  }

  if (diffs.missingTriggers.length > 0) {
    lines.push("[missing_triggers]");
    lines.push(...diffs.missingTriggers);
    lines.push("");
  }

  if (diffs.extraTriggers.length > 0) {
    lines.push("[extra_triggers]");
    lines.push(...diffs.extraTriggers);
    lines.push("");
  }

  await fs.writeFile(path.join(dirPath, `${schema}.report.txt`), lines.join("\n"), "utf8");
}

async function main() {
  await ensureDir(outputDir);

  const local = await mysql.createConnection(localConfig);
  const tunnel = await mysql.createConnection(tunnelConfig);

  const combinedSql = [
    "-- Generated by scripts/compare-db-schema.mjs",
    "-- Safe sync: create missing tables/views, add missing columns/indexes.",
    "",
  ];

  try {
    for (const schema of DATABASES) {
      const [localSnapshot, tunnelSnapshot] = await Promise.all([
        fetchSchemaSnapshot(local, schema),
        fetchSchemaSnapshot(tunnel, schema),
      ]);

      const diffs = summarizeDiffs(schema, localSnapshot, tunnelSnapshot);
      await writeReport(outputDir, schema, diffs);

      const syncStatements = buildSyncSql(schema, localSnapshot, tunnelSnapshot, diffs);
      const syncContent = syncStatements.length > 0 ? `${syncStatements.join("\n\n")}\n` : "-- No additive sync needed.\n";
      await fs.writeFile(path.join(outputDir, `${schema}.sync.sql`), syncContent, "utf8");

      combinedSql.push(`-- ${schema}`);
      combinedSql.push(syncContent.trimEnd());
      combinedSql.push("");
    }

    await fs.writeFile(path.join(outputDir, "sync-local-from-tunnel.sql"), `${combinedSql.join("\n")}\n`, "utf8");
  } finally {
    await local.end();
    await tunnel.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

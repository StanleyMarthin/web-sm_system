export function qualifyTable(databaseName: string, tableName: string): string {
  if (!/^[A-Za-z0-9_]+$/u.test(databaseName)) {
    throw new Error(`Invalid database name: ${databaseName}`);
  }

  if (!/^[A-Za-z0-9_]+$/u.test(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }

  return `\`${databaseName}\`.\`${tableName}\``;
}

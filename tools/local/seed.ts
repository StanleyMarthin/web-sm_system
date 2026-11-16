import type { Pool, RowDataPacket } from "mysql2/promise";
import { SYSTEM_SUPERADMIN_EMPLOYEE_ID } from "../../packages/contracts/src/auth/auth";
import { permissionCatalog } from "../../packages/permissions/src/index";

export async function seedLocalAdmin(pool: Pool): Promise<boolean> {
  const connection = await pool.getConnection();
  try {
    const [marker] = await connection.query<RowDataPacket[]>("SELECT schema_version FROM sms_local_setup.installation WHERE id=1");
    if (marker[0]?.schema_version !== 1) throw new Error("Not an initialized local bootstrap database.");
    await connection.beginTransaction();
    const [accounts] = await connection.query<RowDataPacket[]>("SELECT employee_id FROM sms_db.sm_employee");
    if (accounts.length) {
      const [alias] = await connection.query<RowDataPacket[]>("SELECT employee_id FROM sms_local_setup.login_names WHERE login_name='admin'");
      if (!alias.length) throw new Error("Existing accounts found; bootstrap will not replace them.");
      await connection.rollback();
      return false;
    }
    await connection.execute("INSERT INTO sms_db.sm_role (role_name,description) VALUES ('mis','Local administrator')");
    const [roles] = await connection.query<RowDataPacket[]>("SELECT id FROM sms_db.sm_role WHERE role_name='mis'");
    const roleId = roles[0]!.id;
    await connection.execute("INSERT INTO sms_db.sm_divisi (name,code,isteknis) VALUES ('MIS','MIS',0)");
    const [divisions] = await connection.query<RowDataPacket[]>("SELECT id FROM sms_db.sm_divisi WHERE code='MIS'");
    const hash = await Bun.password.hash("admin", { algorithm: "bcrypt", cost: 10 });
    await connection.execute(`INSERT INTO sms_db.sm_employee
      (employee_id,full_name,password_hash,role_id,division_id,is_active)
      VALUES (?,'admin',?,?,?,1)`, [SYSTEM_SUPERADMIN_EMPLOYEE_ID, hash, roleId, divisions[0]!.id]);
    for (const code of permissionCatalog) {
      await connection.execute("INSERT IGNORE INTO sms_db.sys_permissions (permission_code,description,module_name) VALUES (?,?,?)",
        [code, code, code.split(/[._]/u)[0]]);
    }
    await connection.execute(`INSERT INTO sms_db.sys_role_permissions (role_id,permission_id)
      SELECT ?,id FROM sms_db.sys_permissions`, [roleId]);
    await connection.execute(`INSERT INTO sms_db.sys_role_profiles
      (role_id,role_level,scope_basis,web_enabled,mobile_enabled,approval_rank)
      VALUES (?,900,'GLOBAL',1,1,9)`, [roleId]);
    await connection.execute(`INSERT INTO sms_db.sys_role_scope_presets
      (role_id,division_mode,unit_mode) VALUES (?,'GLOBAL','GLOBAL')`, [roleId]);
    await connection.execute("INSERT INTO sms_local_setup.login_names (login_name,employee_id) VALUES ('admin',?)", [SYSTEM_SUPERADMIN_EMPLOYEE_ID]);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

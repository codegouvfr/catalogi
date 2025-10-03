// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

/**
 * TEMPORARY SCRIPT: Clean up old migration records before running migrations.
 *
 * This script removes old migration records from kysely_migration table
 * to allow the flattened migration (1760000000000_create-base-tables) to run.
 *
 * DELETE THIS FILE after the migration has been deployed to production.
 */

const { Kysely, PostgresDialect, sql } = require("kysely");
const { Pool } = require("pg");

async function cleanupMigrations() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    const db = new Kysely({
        dialect: new PostgresDialect({ pool })
    });

    try {
        // Check if kysely_migration table exists
        const { rows } = await sql`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'kysely_migration'
            ) as exists
        `.execute(db);

        if (!rows[0]?.exists) {
            console.log("No kysely_migration table found. Skipping cleanup.");
            return;
        }

        // Delete all old migration records except the flattened one
        const result = await db
            .deleteFrom("kysely_migration")
            .where("name", "!=", "1760000000000_create-base-tables")
            .executeTakeFirst();

        const numDeleted = Number(result.numDeletedRows || 0);

        if (numDeleted > 0) {
            console.log(`✓ Cleaned up ${numDeleted} old migration record(s)`);
        } else {
            console.log("No old migration records to clean up");
        }
    } catch (error) {
        console.error("Error cleaning up migrations:", error);
        throw error;
    } finally {
        await db.destroy();
    }
}

cleanupMigrations().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});

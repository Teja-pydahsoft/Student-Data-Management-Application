const { masterPool } = require("../config/database");

/**
 * Verify database schema and configuration
 */
async function verifyDatabase() {
  console.log("🔍 Verifying Database Schema...\n");

  try {
    // 1. Check database connection
    console.log("1️⃣  Testing database connection...");
    await masterPool.query("SELECT 1");
    console.log("   ✅ Database connection successful\n");

    // 2. Check certificate_templates table exists
    console.log("2️⃣  Checking certificate_templates table...");
    const [tables] = await masterPool.query(
      "SHOW TABLES LIKE 'certificate_templates'"
    );
    if (tables.length === 0) {
      console.log("   ❌ certificate_templates table does not exist\n");
      process.exit(1);
    }
    console.log("   ✅ certificate_templates table exists\n");

    // 3. Check all required columns
    console.log("3️⃣  Checking required columns...");
    const [columns] = await masterPool.query(
      "SHOW COLUMNS FROM certificate_templates"
    );

    const columnNames = columns.map((col) => col.Field);
    const requiredColumns = [
      "id",
      "service_id",
      "college_id",
      "top_content",
      "top_alignment",
      "middle_content",
      "middle_alignment",
      "bottom_content",
      "bottom_alignment",
      "padding_left",
      "padding_right",
      "padding_top",
      "padding_bottom",
      "top_section_padding",
      "middle_section_padding",
      "bottom_section_padding",
      "blank_variables",
      "font_size",
      "line_spacing",
      "header_height",
      "footer_height",
      "page_size",
      "page_orientation",
      "top_spacing",
      "middle_spacing",
      "bottom_spacing",
      "is_active",
      "created_at",
      "updated_at",
    ];

    const missingColumns = requiredColumns.filter(
      (col) => !columnNames.includes(col)
    );

    if (missingColumns.length > 0) {
      console.log("   ❌ Missing columns:");
      missingColumns.forEach((col) => console.log(`      - ${col}`));
      console.log("\n   Run migrations to add missing columns.\n");
      process.exit(1);
    }

    console.log("   ✅ All required columns present");
    console.log(`   📊 Total columns: ${columnNames.length}\n`);

    // 4. Check column details for critical fields
    console.log("4️⃣  Verifying column types...");

    const criticalColumns = {
      top_alignment: { type: "enum", values: ["left", "center", "right"] },
      middle_alignment: { type: "enum", values: ["left", "center", "right"] },
      bottom_alignment: { type: "enum", values: ["left", "center", "right"] },
      font_size: { type: "int" },
      line_spacing: { type: "decimal" },
      header_height: { type: "int" },
      footer_height: { type: "int" },
      top_section_padding: { type: "int" },
      middle_section_padding: { type: "int" },
      bottom_section_padding: { type: "int" },
    };

    let typeErrors = [];
    for (const [colName, expected] of Object.entries(criticalColumns)) {
      const column = columns.find((col) => col.Field === colName);
      if (column) {
        const actualType = column.Type.toLowerCase();
        if (expected.type === "enum" && !actualType.startsWith("enum")) {
          typeErrors.push(`${colName}: expected enum, got ${actualType}`);
        } else if (
          expected.type === "int" &&
          !actualType.startsWith("int")
        ) {
          typeErrors.push(`${colName}: expected int, got ${actualType}`);
        } else if (
          expected.type === "decimal" &&
          !actualType.startsWith("decimal")
        ) {
          typeErrors.push(`${colName}: expected decimal, got ${actualType}`);
        }
      }
    }

    if (typeErrors.length > 0) {
      console.log("   ⚠️  Column type warnings:");
      typeErrors.forEach((err) => console.log(`      - ${err}`));
      console.log();
    } else {
      console.log("   ✅ All column types correct\n");
    }

    // 5. Check migration tracking table
    console.log("5️⃣  Checking migration tracking...");
    const [migrationTables] = await masterPool.query(
      "SHOW TABLES LIKE 'schema_migrations'"
    );

    if (migrationTables.length === 0) {
      console.log(
        "   ⚠️  schema_migrations table does not exist (will be created on first migration)\n"
      );
    } else {
      const [migrations] = await masterPool.query(
        "SELECT * FROM schema_migrations ORDER BY executed_at DESC"
      );
      console.log(`   ✅ Migration tracking active`);
      console.log(`   📋 Executed migrations: ${migrations.length}`);
      if (migrations.length > 0) {
        console.log(`\n   Recent migrations:`);
        migrations.slice(0, 5).forEach((m) => {
          const date = new Date(m.executed_at).toLocaleString();
          console.log(`      - ${m.migration_name} (${date})`);
        });
      }
      console.log();
    }

    // 6. Summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ DATABASE VERIFICATION COMPLETE");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✓ Connection: OK");
    console.log(`✓ Columns: ${columnNames.length}/${requiredColumns.length}`);
    console.log("✓ Schema: READY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Verification failed:");
    console.error(`   Error: ${error.message}\n`);
    process.exit(1);
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyDatabase();
}

module.exports = { verifyDatabase };
